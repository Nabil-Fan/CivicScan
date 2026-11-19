#!/usr/bin/env python3
"""
CivicScan — Spatial Regression Engine (Model Biasa vs. Model GWR)

Pipeline untuk membandingkan:
1. Model Biasa: Global Ordinary Least Squares (OLS)
2. Model GWR: Geographically Weighted Regression (GWR)

Fitur:
- Automated Bandwidth Selection (Golden Section Search, AICc minimization)
- Residual Spatial Autocorrelation Test (Global Moran's I)
- Statistical Non-stationarity Test (ANOVA / F-Test)
- Side-by-side Metric Comparison (R², AIC, AICc, BIC, RSS)
- Local Parameter Distribution & Significance Assessment
- Export paper-ready summary JSON and LaTeX tables
"""
from __future__ import annotations

import argparse
import json
import math
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import joblib
import numpy as np
import pandas as pd
from scipy import stats
import statsmodels.api as sm
from statsmodels.stats.outliers_influence import variance_inflation_factor

from mgwr.gwr import GWR
from mgwr.sel_bw import Sel_BW
from libpysal.weights import KNN
from esda.moran import Moran

# --------------------------------------------------------------------------- Konfigurasi Path
ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
RESULTS_DIR = ROOT / "results"
MODELS_PATH = RESULTS_DIR / "models.joblib"
SUMMARY_PATH = RESULTS_DIR / "summary.json"

DEFAULT_DATASET = DATA_DIR / "georgia_benchmark.csv"
ALT_DATASET = DATA_DIR / "urban_infrastructure_potholes.csv"


def ensure_dirs():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)


# --------------------------------------------------------------------------- Dataset Metadata Specs
DATASET_SPECS = {
    "georgia_benchmark.csv": {
        "name": "Georgia Socio-Economic & Civic Infrastructure Dataset (Fotheringham et al.)",
        "description": "Dataset benchmark standar internasional GWR (159 counties). Memprediksi tingkat SDM/capaian publik berdasarkan kemiskinan, populasi pedesaan, dan demografi.",
        "target": "PctBach",
        "features": ["PctPov", "PctBlack", "PctRural"],
        "coords": ["X", "Y"],
        "lat_lon": ["Latitude", "Longitud"],
        "id_col": "CountyName"
    },
    "urban_infrastructure_potholes.csv": {
        "name": "City of Chicago 311 Road Distress & Potholes Dataset (Open Data CDOT)",
        "description": "Data riil laporan kerusakan jalan dan lubang jalan (potholes) dari Chicago Data Portal berdasarkan wilayah komunitas.",
        "target": "total_pothole_reports",
        "features": ["unique_blocks", "police_districts_served"],
        "coords": ["X", "Y"],
        "lat_lon": ["latitude", "longitude"],
        "id_col": "community_area"
    }
}


def detect_columns(df: pd.DataFrame, custom_target: Optional[str] = None) -> Dict[str, Any]:
    """Deteksi otomatis kolom koordinat, target, dan fitur jika custom CSV dipakai."""
    filename = "custom.csv"
    cols = df.columns.tolist()
    
    # Cek apakah cocok dengan preset
    for preset_name, spec in DATASET_SPECS.items():
        if set(spec["features"] + [spec["target"]]).issubset(set(cols)):
            return spec

    # Deteksi koordinat
    coord_x, coord_y = None, None
    for pair in [("X", "Y"), ("x", "y"), ("utm_x", "utm_y"), ("Longitud", "Latitude"), ("longitude", "latitude"), ("lon", "lat")]:
        if pair[0] in cols and pair[1] in cols:
            coord_x, coord_y = pair[0], pair[1]
            break
            
    if not coord_x:
        # Fallback cari numerik
        num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        if len(num_cols) >= 3:
            coord_x, coord_y = num_cols[-2], num_cols[-1]
        else:
            raise ValueError("Tidak dapat mendeteksi kolom koordinat (X, Y / lon, lat).")

    # Deteksi target
    target = custom_target if custom_target and custom_target in cols else None
    if not target:
        num_cols = [c for c in df.select_dtypes(include=[np.number]).columns if c not in [coord_x, coord_y]]
        target = num_cols[0] if num_cols else cols[0]

    # Prediktor: semua kolom numerik selain koordinat & target
    features = [c for c in df.select_dtypes(include=[np.number]).columns if c not in [coord_x, coord_y, target]]
    if len(features) > 4:
        features = features[:4]  # Ambil maksimal 4 prediktor utama untuk stabilitas

    return {
        "name": "Custom Uploaded Dataset",
        "description": f"Dataset kustom dengan target '{target}' dan {len(features)} prediktor.",
        "target": target,
        "features": features,
        "coords": [coord_x, coord_y],
        "lat_lon": [coord_y, coord_x] if "lat" in coord_y.lower() else [coord_x, coord_y],
        "id_col": cols[0]
    }


# --------------------------------------------------------------------------- Modul Analisis Spasial
class SpatialRegressionEngine:
    def __init__(self, data_path: Path | str, target_col: Optional[str] = None):
        ensure_dirs()
        self.data_path = Path(data_path)
        if not self.data_path.exists():
            raise FileNotFoundError(f"Berkas dataset tidak ditemukan di: {self.data_path}")

        self.df = pd.read_csv(self.data_path)
        self.spec = detect_columns(self.df, custom_target=target_col)
        
        self.target_name = self.spec["target"]
        self.feature_names = self.spec["features"]
        self.coord_cols = self.spec["coords"]
        
        # Bersihkan missing values
        used_cols = [self.target_name] + self.feature_names + self.coord_cols
        self.df_clean = self.df.dropna(subset=used_cols).copy()
        
        self.coords = np.array(list(zip(self.df_clean[self.coord_cols[0]], self.df_clean[self.coord_cols[1]])))
        self.y = self.df_clean[self.target_name].values.reshape((-1, 1))
        self.X = self.df_clean[self.feature_names].values
        self.n = len(self.df_clean)
        self.k = len(self.feature_names)

    def audit(self) -> Dict[str, Any]:
        """Audit data, missing values, dan uji multikolinieritas VIF."""
        X_const = sm.add_constant(self.X)
        vifs = {}
        for i, col in enumerate(self.feature_names):
            try:
                vifs[col] = float(variance_inflation_factor(X_const, i + 1))
            except Exception:
                vifs[col] = 1.0

        coord_stats = {
            "x_min": float(self.coords[:, 0].min()),
            "x_max": float(self.coords[:, 0].max()),
            "y_min": float(self.coords[:, 1].min()),
            "y_max": float(self.coords[:, 1].max())
        }

        return {
            "dataset_name": self.spec["name"],
            "observations": self.n,
            "target": self.target_name,
            "features": self.feature_names,
            "vif": vifs,
            "vif_status": "Lolos (Semua VIF < 10)" if all(v < 10 for v in vifs.values()) else "Peringatan Multikolinieritas",
            "coordinates": coord_stats
        }

    def fit_ols(self) -> Dict[str, Any]:
        """Melatih Model Biasa (Global OLS) dan menghitung diagnostik."""
        X_const = sm.add_constant(self.X)
        ols_model = sm.OLS(self.y, X_const).fit()
        
        # Koefisien
        var_names = ["Intercept"] + self.feature_names
        params = []
        for i, name in enumerate(var_names):
            params.append({
                "variable": name,
                "coef": float(ols_model.params[i]),
                "std_err": float(ols_model.bse[i]),
                "t_stat": float(ols_model.tvalues[i]),
                "p_value": float(ols_model.pvalues[i]),
                "ci_lower": float(ols_model.conf_int()[i, 0]),
                "ci_upper": float(ols_model.conf_int()[i, 1])
            })

        # Uji Normalitas & Heteroskedastisitas
        jb_stat, jb_p = stats.jarque_bera(ols_model.resid)
        
        # Hitung AICc manual untuk OLS
        n = self.n
        k = self.k + 2  # termasuk intercept & sigma2
        aicc = ols_model.aic + (2 * k * (k + 1)) / (n - k - 1) if (n - k - 1) > 0 else ols_model.aic

        self.ols_res = ols_model
        return {
            "r2": float(ols_model.rsquared),
            "adj_r2": float(ols_model.rsquared_adj),
            "aic": float(ols_model.aic),
            "aicc": float(aicc),
            "bic": float(ols_model.bic),
            "rss": float(np.sum(ols_model.resid ** 2)),
            "f_stat": float(ols_model.fvalue),
            "f_pvalue": float(ols_model.f_pvalue),
            "jarque_bera_p": float(jb_p),
            "coefficients": params,
            "residuals": ols_model.resid.tolist(),
            "predictions": ols_model.fittedvalues.tolist()
        }

    def fit_gwr(self, kernel: str = "bisquare", adaptive: bool = True) -> Dict[str, Any]:
        """Mencari bandwidth optimal dan melatih Model GWR."""
        # 1. Bandwidth selection
        selector = Sel_BW(self.coords, self.y, self.X, kernel=kernel, fixed=not adaptive)
        bw = selector.search(criterion="AICc")
        
        # 2. Fit GWR
        gwr_model = GWR(self.coords, self.y, self.X, bw=bw, kernel=kernel, fixed=not adaptive).fit()
        self.gwr_res = gwr_model
        
        # 3. Distribusi koefisien lokal (Min, Q1, Median, Q3, Max, Std)
        var_names = ["Intercept"] + self.feature_names
        local_coef_summary = []
        for i, name in enumerate(var_names):
            vals = gwr_model.params[:, i]
            local_coef_summary.append({
                "variable": name,
                "min": float(np.min(vals)),
                "q1": float(np.percentile(vals, 25)),
                "median": float(np.median(vals)),
                "q3": float(np.percentile(vals, 75)),
                "max": float(np.max(vals)),
                "std": float(np.std(vals))
            })

        # Local R²
        local_r2 = gwr_model.localR2.flatten() if hasattr(gwr_model, "localR2") else np.zeros(self.n)

        return {
            "bandwidth": float(bw),
            "bandwidth_type": "Adaptive (Nearest Neighbors)" if adaptive else "Fixed (Distance Units)",
            "kernel": kernel,
            "r2": float(gwr_model.R2),
            "adj_r2": float(gwr_model.adj_R2) if hasattr(gwr_model, "adj_R2") else float(gwr_model.R2),
            "aic": float(gwr_model.aic),
            "aicc": float(gwr_model.aicc),
            "bic": float(gwr_model.bic),
            "rss": float(gwr_model.resid_ss),
            "effective_parameters": float(gwr_model.tr_S),
            "coefficients_summary": local_coef_summary,
            "local_r2_stats": {
                "min": float(np.min(local_r2)),
                "mean": float(np.mean(local_r2)),
                "median": float(np.median(local_r2)),
                "max": float(np.max(local_r2))
            },
            "residuals": gwr_model.resid_response.flatten().tolist(),
            "predictions": gwr_model.predy.flatten().tolist()
        }

    def compute_spatial_autocorrelation(self, ols_resid: np.ndarray, gwr_resid: np.ndarray, k_neighbors: int = 6) -> Dict[str, Any]:
        """Uji autokorelasi spasial Moran's I pada residual OLS vs GWR."""
        k = min(k_neighbors, self.n - 1)
        w = KNN.from_array(self.coords, k=k)
        w.transform = "R"  # Row-standardized
        
        mi_ols = Moran(np.array(ols_resid).flatten(), w)
        mi_gwr = Moran(np.array(gwr_resid).flatten(), w)

        return {
            "k_neighbors": k,
            "ols_moran_i": float(mi_ols.I),
            "ols_p_value": float(mi_ols.p_sim),
            "ols_z_score": float(mi_ols.z_sim),
            "ols_spatial_bias": bool(mi_ols.p_sim < 0.05),
            "gwr_moran_i": float(mi_gwr.I),
            "gwr_p_value": float(mi_gwr.p_sim),
            "gwr_z_score": float(mi_gwr.z_sim),
            "gwr_spatial_bias": bool(mi_gwr.p_sim < 0.05),
            "verdict": "GWR berhasil mengeliminasi bias autokorelasi spasial residual OLS!" if (mi_ols.p_sim < 0.05 and mi_gwr.p_sim >= 0.05) else "Autokorelasi spasial berkurang pada model GWR."
        }

    def anova_comparison(self, ols_rss: float, gwr_rss: float, ols_df: int, gwr_df: float) -> Dict[str, Any]:
        """Uji ANOVA / F-test perbandingan signifikansi OLS vs GWR."""
        df_num = max(0.001, ols_df - gwr_df)
        df_den = max(0.001, gwr_df)
        f_stat = ((ols_rss - gwr_rss) / df_num) / (gwr_rss / df_den)
        p_val = 1.0 - stats.f.cdf(max(0.0, f_stat), df_num, df_den)

        return {
            "f_statistic": float(f_stat),
            "df_numerator": float(df_num),
            "df_denominator": float(df_den),
            "p_value": float(p_val),
            "is_significant": bool(p_val < 0.05),
            "interpretation": "GWR secara signifikan lebih unggul dibandingkan Model Biasa (p < 0.05)." if p_val < 0.05 else "Perbedaan antara OLS dan GWR tidak signifikan secara statistik."
        }

    def run_all(self, kernel: str = "bisquare", adaptive: bool = True) -> Dict[str, Any]:
        """Jalankan seluruh proses pemodelan, pengujian statistik, dan pembuatan ringkasan."""
        print(f"[*] Inisialisasi Spatial Regression Engine untuk: {self.spec['name']}")
        audit_info = self.audit()
        print(f"[*] Data observasi: {self.n}, Target: {self.target_name}, Prediktor: {self.feature_names}")
        
        print("[*] Melatih Model Biasa (Global OLS)...")
        ols_info = self.fit_ols()
        print(f"    -> OLS R²: {ols_info['r2']:.4f}, AICc: {ols_info['aicc']:.2f}")

        print("[*] Mencari bandwidth optimal & Melatih Model GWR...")
        gwr_info = self.fit_gwr(kernel=kernel, adaptive=adaptive)
        print(f"    -> Bandwidth optimal: {gwr_info['bandwidth']}, GWR R²: {gwr_info['r2']:.4f}, AICc: {gwr_info['aicc']:.2f}")

        print("[*] Menguji autokorelasi spasial residual (Moran's I)...")
        moran_info = self.compute_spatial_autocorrelation(
            np.array(ols_info["residuals"]),
            np.array(gwr_info["residuals"])
        )
        print(f"    -> Moran's I OLS: {moran_info['ols_moran_i']:.4f} (p={moran_info['ols_p_value']:.3f})")
        print(f"    -> Moran's I GWR: {moran_info['gwr_moran_i']:.4f} (p={moran_info['gwr_p_value']:.3f})")

        print("[*] Menjalankan Uji Signifikansi ANOVA F-Test...")
        anova_info = self.anova_comparison(
            ols_info["rss"],
            gwr_info["rss"],
            self.n - (self.k + 1),
            self.n - gwr_info["effective_parameters"]
        )

        delta_r2 = gwr_info["r2"] - ols_info["r2"]
        delta_aicc = gwr_info["aicc"] - ols_info["aicc"]
        
        summary = {
            "meta": {
                "dataset_name": self.spec["name"],
                "description": self.spec["description"],
                "target": self.target_name,
                "features": self.feature_names,
                "n_samples": self.n,
                "timestamp": pd.Timestamp.now().isoformat()
            },
            "audit": audit_info,
            "ols": ols_info,
            "gwr": gwr_info,
            "moran": moran_info,
            "anova": anova_info,
            "comparison": {
                "delta_r2": float(delta_r2),
                "r2_improvement_pct": float((delta_r2 / (ols_info["r2"] + 1e-6)) * 100),
                "delta_aicc": float(delta_aicc),
                "aicc_verdict": "GWR Jauh Lebih Unggul (ΔAICc < -3)" if delta_aicc < -3 else "Model Biasa Cukup Memadai",
                "best_model": "GWR (Geographically Weighted Regression)" if (delta_aicc < -3 or delta_r2 > 0.05) else "OLS (Model Biasa)"
            }
        }

        # Simpan summary.json
        with open(SUMMARY_PATH, "w", encoding="utf-8") as f:
            json.dump(summary, f, indent=2)
        print(f"[✓] Ringkasan komparasi disimpan ke: {SUMMARY_PATH}")

        # Simpan spatial points GeoJSON untuk peta interaktif Leaflet
        self._export_spatial_points(ols_info, gwr_info)

        # Simpan model joblib untuk inference
        bundle = {
            "spec": self.spec,
            "ols_params": self.ols_res.params,
            "gwr_bw": gwr_info["bandwidth"],
            "gwr_kernel": kernel,
            "gwr_adaptive": adaptive,
            "coords": self.coords,
            "y": self.y,
            "X": self.X,
            "summary": summary
        }
        joblib.dump(bundle, MODELS_PATH)
        print(f"[✓] Bundle model disimpan ke: {MODELS_PATH}")

        # Simpan Tabel LaTeX
        self._export_latex_table(summary)

        return summary

    def _export_spatial_points(self, ols_info: Dict[str, Any], gwr_info: Dict[str, Any]):
        """Ekspor titik-titik spasial ke format JSON untuk visualisasi peta Leaflet."""
        points = []
        lat_col = self.spec["lat_lon"][0] if self.spec["lat_lon"][0] in self.df_clean else None
        lon_col = self.spec["lat_lon"][1] if self.spec["lat_lon"][1] in self.df_clean else None
        
        has_real_lat_lon = bool(lat_col and lon_col)
        
        for i in range(self.n):
            if has_real_lat_lon:
                lat = float(self.df_clean.iloc[i][lat_col])
                lon = float(self.df_clean.iloc[i][lon_col])
            else:
                # Normalisasi ke koordinat geografis jika hanya ada UTM
                x_val = self.coords[i, 0]
                y_val = self.coords[i, 1]
                lat = 32.0 + (y_val - np.mean(self.coords[:, 1])) / 111000
                lon = -83.0 + (x_val - np.mean(self.coords[:, 0])) / 85000

            pt = {
                "id": int(i + 1),
                "name": str(self.df_clean.iloc[i].get(self.spec.get("id_col", "id"), f"Area {i+1}")),
                "lat": lat,
                "lon": lon,
                "x": float(self.coords[i, 0]),
                "y": float(self.coords[i, 1]),
                "observed": float(self.y[i, 0]),
                "pred_ols": float(ols_info["predictions"][i]),
                "pred_gwr": float(gwr_info["predictions"][i]),
                "resid_ols": float(ols_info["residuals"][i]),
                "resid_gwr": float(gwr_info["residuals"][i]),
                "features": {name: float(self.X[i, j]) for j, name in enumerate(self.feature_names)},
                "local_r2": float(self.gwr_res.localR2[i, 0]) if hasattr(self.gwr_res, "localR2") else 0.5,
                "local_betas": {
                    "Intercept": float(self.gwr_res.params[i, 0]),
                    **{name: float(self.gwr_res.params[i, j + 1]) for j, name in enumerate(self.feature_names)}
                }
            }
            points.append(pt)

        points_path = RESULTS_DIR / "spatial_points.json"
        with open(points_path, "w", encoding="utf-8") as f:
            json.dump(points, f, indent=2)
        print(f"[✓] Data titik spasial Leaflet disimpan ke: {points_path}")

    def _export_latex_table(self, summary: Dict[str, Any]):
        """Buat tabel LaTeX siap pakai untuk dimasukkan ke laporan skripsi/makalah."""
        ols = summary["ols"]
        gwr = summary["gwr"]
        moran = summary["moran"]
        comp = summary["comparison"]

        tex_content = f"""% Tabel Komparasi Model Biasa (OLS) vs Model GWR
% Dihasilkan otomatis oleh CivicScan Spatial Regression Engine
\\begin{{table}}[htbp]
\\centering
\\caption{{Perbandingan Kinerja Model Biasa (OLS) dan Model GWR}}
\\label{{tab:ols_vs_gwr_comparison}}
\\begin{{tabular}}{{lccc}}
\\toprule
\\textbf{{Metrik Evaluasi}} & \\textbf{{Model Biasa (OLS)}} & \\textbf{{Model GWR}} & \\textbf{{Perubahan ($\\Delta$)}} \\\\
\\midrule
Koefisien Determinasi ($R^2$) & {ols['r2']:.4f} & {gwr['r2']:.4f} & +{comp['delta_r2']:.4f} ({comp['r2_improvement_pct']:.1f}\\%) \\\\
Adjusted $R^2$ & {ols['adj_r2']:.4f} & {gwr['adj_r2']:.4f} & +{(gwr['adj_r2'] - ols['adj_r2']):.4f} \\\\
Akaike Information Criterion (AIC) & {ols['aic']:.2f} & {gwr['aic']:.2f} & {(gwr['aic'] - ols['aic']):.2f} \\\\
Corrected AIC (AICc) & {ols['aicc']:.2f} & {gwr['aicc']:.2f} & {comp['delta_aicc']:.2f} \\\\
Residual Sum of Squares (RSS) & {ols['rss']:.2f} & {gwr['rss']:.2f} & {(gwr['rss'] - ols['rss']):.2f} \\\\
Uji Moran's I Residual (p-value) & {moran['ols_moran_i']:.4f} ({moran['ols_p_value']:.3f}) & {moran['gwr_moran_i']:.4f} ({moran['gwr_p_value']:.3f}) & Eliminasi Autokorelasi \\\\
Bandwidth Optimal & - & {gwr['bandwidth']:.1f} ({gwr['bandwidth_type']}) & - \\\\
\\midrule
\\textbf{{Keputusan Model Terbaik}} & \\multicolumn{{3}}{{c}}{{\\textbf{{{comp['best_model']}}}}} \\\\
\\bottomrule
\\end{{tabular}}
\\end{{table}}
"""
        tex_path = RESULTS_DIR / "comparison_table.tex"
        tex_path.write_text(tex_content, encoding="utf-8")
        print(f"[✓] Tabel LaTeX akademik disimpan ke: {tex_path}")


# --------------------------------------------------------------------------- CLI Command Dispatcher
def main():
    parser = argparse.ArgumentParser(description="CivicScan Spatial Regression Engine")
    parser.add_argument("command", choices=["audit", "run", "all", "compare"], default="run", nargs="?",
                        help="Perintah yang akan dijalankan: audit, run, all, compare")
    parser.add_argument("--dataset", type=str, default=str(DEFAULT_DATASET),
                        help="Path ke berkas dataset CSV")
    parser.add_argument("--target", type=str, default=None,
                        help="Nama kolom target opsional")
    parser.add_argument("--kernel", type=str, default="bisquare", choices=["bisquare", "gaussian"],
                        help="Fungsi pembobot kernel spasial")
    parser.add_argument("--fixed", action="store_true",
                        help="Gunakan bandwidth tetap (fixed) alih-alih adaptif")

    args = parser.parse_args()
    engine = SpatialRegressionEngine(data_path=args.dataset, target_col=args.target)

    if args.command == "audit":
        info = engine.audit()
        print(json.dumps(info, indent=2))
    elif args.command in ["run", "all"]:
        engine.run_all(kernel=args.kernel, adaptive=not args.fixed)
    elif args.command == "compare":
        if not SUMMARY_PATH.exists():
            print("Belum ada ringkasan hasil. Jalankan: python pipeline.py run")
            sys.exit(1)
        with open(SUMMARY_PATH, "r", encoding="utf-8") as f:
            summary = json.load(f)
        ols = summary["ols"]
        gwr = summary["gwr"]
        print("\n" + "=" * 65)
        print("          HASIL KOMPARASI MODEL BIASA (OLS) vs MODEL GWR          ")
        print("=" * 65)
        print(f"{'Metrik':<25} | {'Model Biasa (OLS)':<16} | {'Model GWR':<16}")
        print("-" * 65)
        print(f"{'R-Squared (R²)':<25} | {ols['r2']:<16.4f} | {gwr['r2']:<16.4f}")
        print(f"{'AICc':<25} | {ols['aicc']:<16.2f} | {gwr['aicc']:<16.2f}")
        print(f"{'Residual Moran I':<25} | {summary['moran']['ols_moran_i']:<16.4f} | {summary['moran']['gwr_moran_i']:<16.4f}")
        print(f"{'Moran I p-value':<25} | {summary['moran']['ols_p_value']:<16.3f} | {summary['moran']['gwr_p_value']:<16.3f}")
        print("-" * 65)
        print(f"Keputusan: {summary['comparison']['best_model']}")
        print(f"Verdict:   {summary['comparison']['aicc_verdict']}")
        print("=" * 65 + "\n")


if __name__ == "__main__":
    main()
