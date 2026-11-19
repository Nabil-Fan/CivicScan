"""CivicScan — Web Application (Spatial Regression: Model Biasa vs. Model GWR)

Endpoints:
- /                   : Spatial Studio (Peta Interaktif Leaflet + Spatial Point Estimator)
- /results            : Dashboard Komparasi OLS vs GWR + Bibliografi 22 Paper Acuan
- /api/status         : Status kesiapan model & metadata dataset
- /api/results        : Ringkasan hasil komparasi lengkap (summary.json)
- /api/spatial-points : Titik koordinat spasial observasi untuk peta Leaflet
- /api/predict        : Prediksi titik spasial (membandingkan OLS vs GWR lokal)
- /api/switch-dataset : Mengganti dataset aktif (Georgia Benchmark / Chicago Potholes)
- /api/papers         : Daftar 22 paper ilmiah acuan
"""
from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

import joblib
import numpy as np
import pandas as pd
from flask import Flask, abort, jsonify, render_template, request, send_file, send_from_directory

import pipeline as P

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024  # 16 MB

_cache: Dict[str, Any] = {"mtime": None, "bundle": None}


def get_bundle() -> Optional[Dict[str, Any]]:
    """Muat models.joblib; muat ulang otomatis jika file berubah."""
    if not P.MODELS_PATH.exists():
        return None
    m = P.MODELS_PATH.stat().st_mtime
    if _cache["mtime"] != m:
        _cache.update(bundle=joblib.load(P.MODELS_PATH), mtime=m)
    return _cache["bundle"]


def get_summary() -> Optional[Dict[str, Any]]:
    """Muat summary.json."""
    if not P.SUMMARY_PATH.exists():
        return None
    try:
        with open(P.SUMMARY_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def get_spatial_points() -> List[Dict[str, Any]]:
    """Muat spatial_points.json."""
    p = P.RESULTS_DIR / "spatial_points.json"
    if not p.exists():
        return []
    try:
        with open(p, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def parse_papers_markdown() -> List[Dict[str, str]]:
    """Parsing 22 paper dari PAPERS_REFERENCE.md."""
    ref_file = P.ROOT / "PAPERS_REFERENCE.md"
    if not ref_file.exists():
        return []
    
    text = ref_file.read_text(encoding="utf-8")
    blocks = re.split(r"### (\d+)\.\s+", text)
    papers = []
    
    for i in range(1, len(blocks), 2):
        num = blocks[i]
        content = blocks[i + 1]
        lines = content.strip().split("\n")
        
        paper = {
            "number": num,
            "short_author": lines[0].strip(),
            "title": "",
            "authors": "",
            "journal": "",
            "doi": "",
            "doi_url": "",
            "focus_comparison": ""
        }
        for line in lines[1:]:
            line = line.strip()
            if line.startswith("- **Judul**:"):
                paper["title"] = line.replace("- **Judul**:", "").replace("*", "").strip()
            elif line.startswith("- **Penulis**:"):
                paper["authors"] = line.replace("- **Penulis**:", "").strip()
            elif line.startswith("- **Jurnal**:"):
                paper["journal"] = line.replace("- **Jurnal**:", "").replace("*", "").strip()
            elif line.startswith("- **Penerbit**:"):
                paper["journal"] = line.replace("- **Penerbit**:", "").replace("*", "").strip()
            elif line.startswith("- **DOI**:"):
                m_doi = re.search(r"\[([^\]]+)\]\(([^)]+)\)", line)
                if m_doi:
                    paper["doi"] = m_doi.group(1).strip()
                    paper["doi_url"] = m_doi.group(2).strip()
            elif line.startswith("- **Komparasi**:"):
                paper["focus_comparison"] = line.replace("- **Komparasi**:", "").strip()
            elif line.startswith("- **Fokus**:"):
                paper["focus_comparison"] = line.replace("- **Fokus**:", "").strip()
        papers.append(paper)
        
    return papers


# --------------------------------------------------------------------------- Halaman Frontend (React SPA + Jinja Fallback)
FRONTEND_DIST = Path(__file__).resolve().parent / "frontend" / "dist"


@app.route("/assets/<path:path>")
def serve_assets(path: str):
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.exists():
        return send_from_directory(assets_dir, path)
    return abort(404)


@app.route("/")
def index():
    if not request.args.get("legacy") and FRONTEND_DIST.exists() and (FRONTEND_DIST / "index.html").exists():
        return send_from_directory(FRONTEND_DIST, "index.html")
    return render_template("index.html", page="demo")


@app.route("/results")
def results():
    if not request.args.get("legacy") and FRONTEND_DIST.exists() and (FRONTEND_DIST / "index.html").exists():
        return send_from_directory(FRONTEND_DIST, "index.html")
    return render_template("results.html", page="results")


@app.route("/cara-kerja")
def cara_kerja():
    if not request.args.get("legacy") and FRONTEND_DIST.exists() and (FRONTEND_DIST / "index.html").exists():
        return send_from_directory(FRONTEND_DIST, "index.html")
    return render_template("cara_kerja.html", page="cara-kerja")


# --------------------------------------------------------------------------- REST API
@app.route("/api/status")
def api_status():
    b = get_bundle()
    s = get_summary()
    if not b or not s:
        return jsonify(ready=False, message="Model belum dilatih. Jalankan: python pipeline.py run")
    
    meta = s.get("meta", {})
    comp = s.get("comparison", {})
    return jsonify(
        ready=True,
        dataset_name=meta.get("dataset_name", "Spatial Dataset"),
        target=meta.get("target", "Target"),
        features=meta.get("features", []),
        n_samples=meta.get("n_samples", 0),
        best_model=comp.get("best_model", "GWR"),
        r2_improvement_pct=comp.get("r2_improvement_pct", 0),
        delta_aicc=comp.get("delta_aicc", 0)
    )


@app.route("/api/results")
def api_results():
    s = get_summary()
    if not s:
        return jsonify(error="Belum ada hasil eksperimen. Jalankan: python pipeline.py run"), 404
    return jsonify(s)


@app.route("/api/spatial-points")
def api_spatial_points():
    pts = get_spatial_points()
    return jsonify(pts)


@app.route("/api/papers")
def api_papers():
    papers = parse_papers_markdown()
    return jsonify(papers=papers, total=len(papers))


@app.route("/api/download-latex")
def download_latex():
    tex_path = P.RESULTS_DIR / "comparison_table.tex"
    if not tex_path.exists():
        abort(404)
    return send_file(tex_path, as_attachment=True, download_name="ols_vs_gwr_table.tex")


@app.route("/api/switch-dataset", methods=["POST"])
def switch_dataset():
    data = request.get_json(silent=True) or {}
    dataset_name = data.get("dataset", "georgia")
    
    if dataset_name == "chicago":
        target_path = P.ALT_DATASET
    else:
        target_path = P.DEFAULT_DATASET

    if not target_path.exists():
        return jsonify(error=f"Berkas dataset {target_path.name} tidak ditemukan."), 404

    try:
        engine = P.SpatialRegressionEngine(data_path=target_path)
        engine.run_all()
        # Invalidate cache
        _cache["mtime"] = None
        _cache["bundle"] = None
        return jsonify(success=True, message=f"Dataset berhasil diganti ke: {target_path.name}")
    except Exception as e:
        return jsonify(error=f"Gagal memuat dataset: {str(e)}"), 500


@app.route("/api/predict", methods=["POST"])
def predict():
    b = get_bundle()
    if not b:
        return jsonify(error="Model belum dilatih. Jalankan: python pipeline.py run"), 503

    payload = request.get_json(silent=True) or {}
    x_coord = payload.get("x")
    y_coord = payload.get("y")
    features_input = payload.get("features", {})

    if x_coord is None or y_coord is None:
        return jsonify(error="Koordinat spasial X dan Y wajib diisi."), 400

    try:
        x_val = float(x_coord)
        y_val = float(y_coord)
    except (ValueError, TypeError):
        return jsonify(error="Koordinat X dan Y harus berupa angka numerik."), 400

    spec = b["spec"]
    feature_names = spec["features"]
    
    # Kumpulkan nilai prediktor
    x_vec = []
    for f in feature_names:
        val = features_input.get(f)
        if val is None:
            # Fallback ke nilai median training
            idx = feature_names.index(f)
            val = float(np.median(b["X"][:, idx]))
        try:
            x_vec.append(float(val))
        except (ValueError, TypeError):
            x_vec.append(0.0)

    x_arr = np.array(x_vec)

    # 1. Prediksi Model Biasa (OLS)
    ols_params = b["ols_params"]
    pred_ols = float(ols_params[0] + np.dot(x_arr, ols_params[1:]))

    # 2. Prediksi Model GWR (Spatial Weighted Local Beta)
    train_coords = b["coords"]
    dists = np.sqrt((train_coords[:, 0] - x_val) ** 2 + (train_coords[:, 1] - y_val) ** 2)
    min_dist = float(np.min(dists))
    nearest_idx = int(np.argmin(dists))

    bw = b["gwr_bw"]
    kernel = b.get("gwr_kernel", "bisquare")
    adaptive = b.get("gwr_adaptive", True)

    # Hitung bandwidth distance efektif
    if adaptive:
        # bw adalah jumlah nearest neighbors
        k_neighbors = int(min(max(2, bw), len(train_coords)))
        dists_sorted = np.sort(dists)
        bw_dist = max(1e-5, dists_sorted[k_neighbors - 1])
    else:
        bw_dist = max(1e-5, bw)

    # Hitung bobot kernel bisquare
    u = dists / bw_dist
    weights = np.zeros(len(dists))
    mask = u < 1.0
    if kernel == "bisquare":
        weights[mask] = (1.0 - u[mask] ** 2) ** 2
    else:  # gaussian
        weights = np.exp(-0.5 * (dists / bw_dist) ** 2)

    # Weighted Least Squares lokal
    X_train = np.hstack([np.ones((len(b["X"]), 1)), b["X"]])
    y_train = b["y"]

    W_diag = np.sqrt(weights)
    X_w = X_train * W_diag[:, np.newaxis]
    y_w = y_train * W_diag[:, np.newaxis]

    try:
        XtX = np.dot(X_w.T, X_w)
        # Ridge regularizer kecil untuk stabilitas numerik
        XtX += np.eye(XtX.shape[0]) * 1e-6
        XtY = np.dot(X_w.T, y_w)
        local_betas = np.linalg.solve(XtX, XtY).flatten()
    except Exception:
        # Fallback ke nearest neighbor parameters jika matriks singular
        points_data = get_spatial_points()
        if nearest_idx < len(points_data):
            local_betas = np.array([points_data[nearest_idx]["local_betas"]["Intercept"]] + 
                                   [points_data[nearest_idx]["local_betas"][fn] for fn in feature_names])
        else:
            local_betas = ols_params

    pred_gwr = float(local_betas[0] + np.dot(x_arr, local_betas[1:]))
    delta_pred = pred_gwr - pred_ols

    beta_breakdown = {
        "Intercept": float(local_betas[0]),
        **{fn: float(local_betas[i + 1]) for i, fn in enumerate(feature_names)}
    }

    ols_beta_breakdown = {
        "Intercept": float(ols_params[0]),
        **{fn: float(ols_params[i + 1]) for i, fn in enumerate(feature_names)}
    }

    return jsonify(
        coordinates={"x": x_val, "y": y_val},
        distance_to_nearest_observation=min_dist,
        pred_ols=pred_ols,
        pred_gwr=pred_gwr,
        difference=delta_pred,
        local_betas_gwr=beta_breakdown,
        global_betas_ols=ols_beta_breakdown,
        features_used={fn: float(x_arr[i]) for i, fn in enumerate(feature_names)},
        target_name=spec["target"],
        interpretation=f"Pada titik ({x_val:.1f}, {y_val:.1f}), Model GWR menghasilkan estimasi {pred_gwr:.2f} ({'+' if delta_pred >= 0 else ''}{delta_pred:.2f} dibanding Model Biasa) karena memperhitungkan karakteristik spasial lokal."
    )


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5005))
    print(f"[*] Menjalankan CivicScan di http://127.0.0.1:{port} (bebas dari konflik AirPlay port 5000)")
    app.run(debug=False, host="127.0.0.1", port=port)
