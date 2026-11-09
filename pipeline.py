#!/usr/bin/env python3
"""
CivicScan — pipeline machine learning (satu file).

Alur (sesuai dokumen rancangan 31 Oktober 2026):
    python pipeline.py audit        # audit file + anotasi YOLO, tanpa membuat crop
    python pipeline.py crops        # audit + ekstraksi crop dari bounding box
    python pipeline.py features     # fitur visual per crop (HSV, intensitas, tepi, tekstur)
    python pipeline.py experiment   # skenario M/A/B/C/D, CV bertingkat berkelompok, model akhir
    python pipeline.py all          # semuanya berurutan

Prinsip anti-kebocoran data:
  * Split luar : StratifiedGroupKFold, groups = group_id (satu gambar sumber -> satu fold).
  * Scaler, K-Means, dan classifier berada di dalam sklearn Pipeline, sehingga selalu
    di-fit ulang hanya pada training fold (luar maupun dalam).
  * Hiperparameter dan jumlah cluster dipilih lewat CV dalam (juga berkelompok) pada data latih.
  * Skenario A/B dan C/D memakai fold luar, crop, dan fitur dasar yang identik.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import random
import shutil
import sys
import warnings
import zipfile
from datetime import datetime
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from PIL import Image, ImageDraw, ImageOps
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.dummy import DummyClassifier
from sklearn.metrics import (accuracy_score, balanced_accuracy_score, classification_report,
                             confusion_matrix, f1_score, silhouette_score)
from sklearn.model_selection import GridSearchCV, StratifiedGroupKFold
from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.tree import DecisionTreeClassifier

# --------------------------------------------------------------------------- konfigurasi
ROOT = Path(__file__).resolve().parent
RAW, CROPS, PROC, RES = (ROOT / "data" / "raw", ROOT / "data" / "crops",
                         ROOT / "data" / "processed", ROOT / "results")
MODELS_PATH = RES / "models.joblib"
SEED = 42

# Ambang & parameter ditetapkan SEBELUM melihat skor model (lihat dokumen bab 4-5).
CFG = {
    "image_exts": (".jpg", ".jpeg", ".png", ".bmp", ".webp"),
    "min_side_px": 24,          # sisi terpendek crop minimum
    "min_area_px": 1024,        # luas crop minimum
    "resize": 128,              # semua crop di-resize ke 128x128 sebelum ekstraksi fitur
    "hsv_bins": (12, 6, 6),     # H, S, V
    "ori_bins": 8,              # histogram orientasi gradien
    "lbp_points": 8, "lbp_radius": 1,
    "edge_thresholds": (0.05, 0.15),
    "scaler": "StandardScaler",
    "k_candidates": (3, 5, 7, 10),
    "cluster_representation": "both",   # one-hot cluster_id + jarak centroid
}
IGNORED_TXT = {"classes.txt", "readme.txt", "labels.txt", "license.txt", "notes.txt", "obj.names"}
DEFAULT_CLASSES = ["animal", "traffic light", "waste container", "pothole",
                   "cracks", "open manhole", "good road"]   # HANYA cadangan; verifikasi dengan data.yaml
ZENODO_DECLARED_IMAGES = {"animal": 600, "traffic light": 600, "waste container": 600, "pothole": 300,
                          "cracks": 166, "open manhole": 152, "good road": 100}
DATASET_META = {
    "name": "Urban Community Issues Object Detection Dataset", "author": "Paudel, R.",
    "version": "v1", "published": "2026-03-05", "doi": "10.5281/zenodo.18871460",
    "url": "https://zenodo.org/records/18871460",
    "license_note": "Dataset turunan dari sumber publik lain: periksa lisensi sumber sebelum redistribusi.",
}
SCENARIOS = {
    "M": {"name": "Baseline mayoritas", "clf": "majority", "cluster": False,
          "desc": "Selalu menebak kelas terbanyak (pembanding minimum)."},
    "A": {"name": "KNN - fitur dasar", "clf": "knn", "cluster": False, "desc": "Baseline KNN."},
    "B": {"name": "Decision Tree - fitur dasar", "clf": "dt", "cluster": False, "desc": "Baseline pohon."},
    "C": {"name": "KNN + K-Means", "clf": "knn", "cluster": True, "desc": "Fitur dasar + fitur cluster."},
    "D": {"name": "Decision Tree + K-Means", "clf": "dt", "cluster": True, "desc": "Fitur dasar + fitur cluster."},
}
META_COLS = ["crop_id", "image_id", "group_id", "class_id", "class_name"]

warnings.filterwarnings("ignore")


def log(*a):
    print(*a, flush=True)


def jsonable(o):
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (np.floating,)):
        return None if math.isnan(float(o)) else float(o)
    if isinstance(o, np.ndarray):
        return o.tolist()
    if isinstance(o, (Path,)):
        return str(o)
    raise TypeError(f"tidak bisa serialisasi {type(o)}")


def write_json(path: Path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False, default=jsonable), encoding="utf-8")


def safe_name(s: str) -> str:
    return "".join(c if c.isalnum() or c in "-_" else "_" for c in s.lower()).strip("_")


# --------------------------------------------------------------------------- 1. audit data
def prepare_raw():
    RAW.mkdir(parents=True, exist_ok=True)
    has_img = any(p.suffix.lower() in CFG["image_exts"] for p in RAW.rglob("*") if p.is_file())
    if not has_img:
        for z in sorted(RAW.glob("*.zip")):
            log(f"Mengekstrak {z.name} ...")
            with zipfile.ZipFile(z) as zf:
                zf.extractall(RAW)


def load_class_names():
    import yaml
    for y in sorted(list(RAW.rglob("*.yaml")) + list(RAW.rglob("*.yml"))):
        try:
            d = yaml.safe_load(y.read_text(encoding="utf-8", errors="ignore"))
        except Exception:
            continue
        if isinstance(d, dict) and "names" in d:
            n = d["names"]
            names = [n[k] for k in sorted(n, key=int)] if isinstance(n, dict) else list(n)
            return [str(x) for x in names], f"yaml:{y.relative_to(RAW).as_posix()}"
    for t in sorted(list(RAW.rglob("classes.txt")) + list(RAW.rglob("obj.names"))):
        names = [l.strip() for l in t.read_text(encoding="utf-8", errors="ignore").splitlines() if l.strip()]
        if names:
            return names, f"txt:{t.relative_to(RAW).as_posix()}"
    log("PERINGATAN: data.yaml tidak ditemukan. Memakai urutan kelas dari dokumen - VERIFIKASI MANUAL.")
    return list(DEFAULT_CLASSES), "fallback-dokumen (verifikasi manual!)"


def list_files():
    imgs, lbls = [], []
    for p in sorted(RAW.rglob("*")):
        if not p.is_file() or "__MACOSX" in p.parts or p.name.startswith("._"):
            continue
        s = p.suffix.lower()
        if s in CFG["image_exts"]:
            imgs.append(p)
        elif s == ".txt" and p.name.lower() not in IGNORED_TXT:
            lbls.append(p)
    return imgs, lbls


def file_md5(p: Path) -> str:
    h = hashlib.md5()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def image_info(p: Path):
    """Ukuran gambar setelah koreksi orientasi EXIF (sama dengan saat crop)."""
    try:
        with Image.open(p) as im:
            im.verify()
        with Image.open(p) as im:
            w, h = im.size
            if im.getexif().get(274, 1) in (5, 6, 7, 8):
                w, h = h, w
        return w, h
    except Exception:
        return None, None


def pair_label(lbl: Path, img_index: dict, by_stem: dict):
    parts = lbl.parts
    for i in range(len(parts) - 2, -1, -1):
        if parts[i].lower() == "labels":
            key = Path(*parts[:i], "images", *parts[i + 1:-1], lbl.stem).as_posix()
            if key in img_index:
                return img_index[key]
    k = lbl.with_suffix("").as_posix()
    if k in img_index:
        return img_index[k]
    c = by_stem.get(lbl.stem, [])
    return c[0] if len(c) == 1 else None


def parse_label(path: Path):
    rows, bad = [], 0
    for i, line in enumerate(path.read_text(encoding="utf-8", errors="ignore").splitlines(), 1):
        parts = line.split()
        if not parts:
            continue
        try:
            v = [float(x) for x in parts]
        except ValueError:
            bad += 1
            continue
        if v[0] != int(v[0]):
            bad += 1
            continue
        if len(v) == 5:
            xc, yc, w, h = v[1:]
            kind = "bbox"
        elif len(v) >= 7 and len(v) % 2 == 1:       # segmentasi poligon -> bounding box
            xs, ys = v[1::2], v[2::2]
            xc, yc, w, h = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, max(xs) - min(xs), max(ys) - min(ys)
            kind = "polygon"
        else:
            bad += 1
            continue
        rows.append({"line_no": i, "class_id": int(v[0]), "xc": xc, "yc": yc, "w": w, "h": h, "kind": kind})
    return rows, bad


def box_to_px(xc, yc, w, h, W, H):
    x1, x2, y1, y2 = (xc - w / 2) * W, (xc + w / 2) * W, (yc - h / 2) * H, (yc + h / 2) * H
    oob = x1 < -1 or y1 < -1 or x2 > W + 1 or y2 > H + 1
    return (max(0, int(math.floor(x1))), max(0, int(math.floor(y1))),
            min(W, int(math.ceil(x2))), min(H, int(math.ceil(y2))), oob)


def box_status(x1, y1, x2, y2):
    cw, ch = x2 - x1, y2 - y1
    if cw <= 1 or ch <= 1:
        return "outside_image"
    if min(cw, ch) < CFG["min_side_px"] or cw * ch < CFG["min_area_px"]:
        return "too_small"
    return "kept"


def group_key(img: Path, md5: str) -> str:
    """Kelompok split. Salinan augmentasi bergaya Roboflow ('nama_jpg.rf.<hash>') berbagi kelompok;
    selain itu kelompok = hash isi file (menyatukan duplikat persis)."""
    return "rf_" + img.stem.split(".rf.")[0] if ".rf." in img.stem else "h_" + md5[:16]


def scan(save_samples=False):
    prepare_raw()
    names, names_src = load_class_names()
    imgs, lbls = list_files()
    if not imgs:
        sys.exit(f"Tidak ada gambar di {RAW}. Letakkan/ekstrak Data_sets.zip ke folder tersebut.")
    img_index = {p.with_suffix("").as_posix(): p for p in imgs}
    by_stem = {}
    for p in imgs:
        by_stem.setdefault(p.stem, []).append(p)

    rep = {"created": datetime.now().isoformat(timespec="seconds"), "class_names": names,
           "class_names_source": names_src, "images_total": len(imgs), "label_files_total": len(lbls),
           "config": {k: CFG[k] for k in ("min_side_px", "min_area_px", "resize")}}
    pairs, unpaired_lbl = [], 0
    for l in lbls:
        im = pair_label(l, img_index, by_stem)
        if im is None:
            unpaired_lbl += 1
        else:
            pairs.append((im, l))
    pairs.sort(key=lambda t: t[0].as_posix())
    paired_imgs = {p for p, _ in pairs}
    rep["labels_without_image"] = unpaired_lbl
    rep["images_without_label"] = len(imgs) - len(paired_imgs)

    rows, seen_md5, seen_box = [], {}, set()
    unreadable = bad_lines = empty_labels = dup_images = 0
    log(f"Memindai {len(pairs)} pasangan gambar-label ...")
    for n, (img, lbl) in enumerate(pairs, 1):
        if n % 500 == 0:
            log(f"  {n}/{len(pairs)}")
        image_id = img.relative_to(RAW).as_posix()
        W, H = image_info(img)
        md5 = file_md5(img)
        gid = group_key(img, md5)
        anns, bad = parse_label(lbl)
        bad_lines += bad
        if not anns and bad == 0:
            empty_labels += 1
        is_dup = md5 in seen_md5
        dup_images += int(is_dup)
        seen_md5.setdefault(md5, image_id)
        if W is None:
            unreadable += 1
        for a in anns:
            r = dict(a, image_id=image_id, group_id=gid, W=W, H=H, oob=False,
                     class_name=names[a["class_id"]] if 0 <= a["class_id"] < len(names) else None)
            if W is None:
                st = "unreadable_image"
            elif is_dup:
                st = "duplicate_image"
            elif r["class_name"] is None:
                st = "unknown_class"
            elif a["w"] <= 0 or a["h"] <= 0:
                st = "zero_size"
            else:
                x1, y1, x2, y2, oob = box_to_px(a["xc"], a["yc"], a["w"], a["h"], W, H)
                r["oob"] = bool(oob)
                st = box_status(x1, y1, x2, y2)
                if st == "kept":
                    key = (image_id, a["class_id"], round(a["xc"], 4), round(a["yc"], 4),
                           round(a["w"], 4), round(a["h"], 4))
                    if key in seen_box:
                        st = "duplicate_box"
                    seen_box.add(key)
            r["status"] = st
            rows.append(r)

    if not rows:
        sys.exit("Tidak ada anotasi yang berhasil dibaca. Periksa struktur folder dan format label YOLO.")
    ann = pd.DataFrame(rows)
    kept = ann[ann.status == "kept"]
    valid_cls = ann[ann.class_name.notna()]
    rep.update({
        "images_unreadable": unreadable, "images_paired": len(pairs), "empty_label_files": empty_labels,
        "duplicate_images_dropped": dup_images, "label_lines_parsed": int(len(ann)),
        "label_lines_malformed": bad_lines,
        "unknown_class_ids": int((ann.status == "unknown_class").sum()),
        "boxes_out_of_bounds_clipped": int(ann.oob.sum()),
        "boxes_zero_size": int((ann.status == "zero_size").sum()),
        "boxes_too_small": int((ann.status == "too_small").sum()),
        "boxes_duplicate": int((ann.status == "duplicate_box").sum()),
        "polygon_labels_converted": int((ann.kind == "polygon").sum()),
        "boxes_kept": int(len(kept)),
        "exclusion_reasons": ann[ann.status != "kept"].status.value_counts().to_dict(),
        "boxes_per_class": {c: int((valid_cls.class_name == c).sum()) for c in names},
        "kept_boxes_per_class": {c: int((kept.class_name == c).sum()) for c in names},
        "images_per_class": {c: int(valid_cls[valid_cls.class_name == c].image_id.nunique()) for c in names},
        "kept_images_per_class": {c: int(kept[kept.class_name == c].image_id.nunique()) for c in names},
        "kept_groups_per_class": {c: int(kept[kept.class_name == c].group_id.nunique()) for c in names},
        "zenodo_declared_images": ZENODO_DECLARED_IMAGES,
    })
    if save_samples:
        draw_samples(kept)
    return ann, rep, names


def draw_samples(kept: pd.DataFrame, n=12):
    out = RES / "audit_samples"
    shutil.rmtree(out, ignore_errors=True)
    out.mkdir(parents=True, exist_ok=True)
    ids = sorted(kept.image_id.unique())
    random.Random(SEED).shuffle(ids)
    for i, iid in enumerate(ids[:n]):
        try:
            im = ImageOps.exif_transpose(Image.open(RAW / iid)).convert("RGB")
        except Exception:
            continue
        d = ImageDraw.Draw(im)
        W, H = im.size
        for r in kept[kept.image_id == iid].itertuples():
            x1, y1, x2, y2, _ = box_to_px(r.xc, r.yc, r.w, r.h, W, H)
            d.rectangle([x1, y1, x2, y2], outline="#ed7328", width=max(2, W // 250))
            d.text((x1 + 3, y1 + 3), r.class_name, fill="#ffc400")
        im.thumbnail((800, 800))
        im.save(out / f"sample_{i:02d}.jpg", quality=88)


def write_provenance():
    zips = sorted(RAW.glob("*.zip"))
    info = {"dataset": DATASET_META, "downloaded_or_checked_at": datetime.now().isoformat(timespec="seconds"),
            "archive": [{"name": z.name, "bytes": z.stat().st_size, "md5": file_md5(z)} for z in zips],
            "libraries": library_versions(), "python": sys.version.split()[0], "config": CFG, "seed": SEED}
    write_json(RES / "provenance.json", info)


def library_versions():
    import PIL, sklearn, skimage
    return {"numpy": np.__version__, "pandas": pd.__version__, "scikit-learn": sklearn.__version__,
            "scikit-image": skimage.__version__, "pillow": PIL.__version__}


def cmd_audit():
    ann, rep, _ = scan(save_samples=True)
    write_json(RES / "audit_report.json", rep)
    write_provenance()
    show_audit(rep)


def show_audit(rep):
    log("\n=== RINGKASAN AUDIT ===")
    for k, v in rep.items():
        if not isinstance(v, (dict, list)):
            log(f"{k:32s}: {v}")
    log(f"{'kelas':18s} {'gambar':>7s} {'box':>7s} {'box dipakai':>12s} {'grup dipakai':>13s} {'Zenodo':>7s}")
    for c in rep["class_names"]:
        log(f"{c:18s} {rep['images_per_class'][c]:7d} {rep['boxes_per_class'][c]:7d} "
            f"{rep['kept_boxes_per_class'][c]:12d} {rep['kept_groups_per_class'][c]:13d} "
            f"{rep['zenodo_declared_images'].get(c, '-')!s:>7s}")


# --------------------------------------------------------------------------- 2. crop
def cmd_crops():
    ann, rep, names = scan(save_samples=True)
    shutil.rmtree(CROPS, ignore_errors=True)
    PROC.mkdir(parents=True, exist_ok=True)
    manifest, extra_excl = [], []
    kept = ann[ann.status == "kept"]
    log(f"Mengekstrak crop dari {kept.image_id.nunique()} gambar ...")
    for n, (iid, grp) in enumerate(kept.groupby("image_id", sort=True), 1):
        if n % 500 == 0:
            log(f"  {n} gambar")
        try:
            im = ImageOps.exif_transpose(Image.open(RAW / iid)).convert("RGB")
        except Exception:
            extra_excl += [(iid, "unreadable_image")] * len(grp)
            continue
        W, H = im.size
        h8 = hashlib.md5(iid.encode()).hexdigest()[:8]
        for k, r in enumerate(grp.itertuples()):
            x1, y1, x2, y2, _ = box_to_px(r.xc, r.yc, r.w, r.h, W, H)
            st = box_status(x1, y1, x2, y2)
            if st != "kept":
                extra_excl.append((iid, st + "_actual"))
                continue
            crop_id = f"{safe_name(Path(iid).stem)[:30]}_{h8}_{k:02d}"
            d = CROPS / safe_name(r.class_name)
            d.mkdir(parents=True, exist_ok=True)
            path = d / f"{crop_id}.jpg"
            im.crop((x1, y1, x2, y2)).save(path, quality=95)
            manifest.append({"crop_id": crop_id, "image_id": iid, "group_id": r.group_id,
                             "class_id": r.class_id, "class_name": r.class_name,
                             "x_center": r.xc, "y_center": r.yc, "box_width": r.w, "box_height": r.h,
                             "crop_width": x2 - x1, "crop_height": y2 - y1,
                             "crop_path": path.relative_to(ROOT).as_posix()})
    man = pd.DataFrame(manifest)
    if man.empty:
        sys.exit("Tidak ada crop valid yang dihasilkan.")
    man.to_csv(PROC / "crops_manifest.csv", index=False)
    excl = ann[ann.status != "kept"][["image_id", "class_id", "class_name", "status"]]
    excl = pd.concat([excl, pd.DataFrame(extra_excl, columns=["image_id", "status"])], ignore_index=True)
    excl.to_csv(PROC / "excluded.csv", index=False)
    rep["crops_total"] = int(len(man))
    rep["crops_per_class"] = {c: int((man.class_name == c).sum()) for c in names}
    rep["source_images_per_class"] = {c: int(man[man.class_name == c].image_id.nunique()) for c in names}
    rep["source_groups_per_class"] = {c: int(man[man.class_name == c].group_id.nunique()) for c in names}
    write_json(RES / "audit_report.json", rep)
    write_provenance()
    show_audit(rep)
    log(f"\nCrop valid: {len(man)} | dikeluarkan: {len(excl)} (lihat data/processed/excluded.csv)")
    small = [c for c in names if rep["source_groups_per_class"][c] < 10]
    if small:
        log(f"PERINGATAN: kelas dengan <10 gambar sumber: {small}. Konsultasikan penggabungan kelas/ruang lingkup.")


# --------------------------------------------------------------------------- 3. fitur visual
def feature_names():
    hb, sb, vb = CFG["hsv_bins"]
    n = [f"h_hist_{i}" for i in range(hb)] + [f"s_hist_{i}" for i in range(sb)] + [f"v_hist_{i}" for i in range(vb)]
    n += ["hue_cos_mean", "hue_sin_mean", "s_mean", "v_mean", "s_std", "v_std", "gray_mean", "gray_std",
          "edge_density_low", "edge_density_high", "grad_mean", "grad_std"]
    n += [f"grad_ori_{i}" for i in range(CFG["ori_bins"])]
    n += [f"lbp_{i}" for i in range(CFG["lbp_points"] + 2)]
    return n


def feature_dictionary():
    rows = []
    for n in feature_names():
        if n.endswith(tuple("0123456789")) and "_hist_" in n:
            fam, desc = "warna", f"Proporsi piksel pada bin histogram {n.split('_')[0].upper()}"
        elif n.startswith(("hue", "s_", "v_")):
            fam, desc = "warna", "Statistik ruang warna HSV (hue memakai rata-rata sirkular cos/sin)"
        elif n.startswith("gray"):
            fam, desc = "intensitas", "Rata-rata/simpangan baku grayscale (0-1)"
        elif n.startswith("edge"):
            fam, desc = "tepi", "Proporsi piksel dengan magnitudo gradien di atas ambang tetap"
        elif n.startswith("grad_ori"):
            fam, desc = "tekstur", "Histogram orientasi gradien (berbobot magnitudo)"
        elif n.startswith("grad"):
            fam, desc = "tekstur", "Statistik magnitudo gradien"
        else:
            fam, desc = "tekstur", "Histogram Local Binary Pattern (uniform, P=8, R=1)"
        rows.append({"feature": n, "family": fam, "description": desc})
    return pd.DataFrame(rows)


def extract_features(img: Image.Image) -> np.ndarray:
    """Satu fungsi ekstraksi yang dipakai training DAN demo web agar identik."""
    from skimage.feature import local_binary_pattern
    S = CFG["resize"]
    rgb = img.convert("RGB").resize((S, S), Image.BILINEAR)
    hsv = np.asarray(rgb.convert("HSV"), dtype=np.float32)
    g8 = np.asarray(rgb.convert("L"), dtype=np.uint8)
    g = g8.astype(np.float32) / 255.0
    f = []
    for c, b in enumerate(CFG["hsv_bins"]):
        hist, _ = np.histogram(hsv[..., c], bins=b, range=(0, 256))
        f.extend(hist / hist.sum())
    ang = hsv[..., 0] / 255.0 * 2 * np.pi
    f += [np.cos(ang).mean(), np.sin(ang).mean(), hsv[..., 1].mean() / 255, hsv[..., 2].mean() / 255,
          hsv[..., 1].std() / 255, hsv[..., 2].std() / 255, g.mean(), g.std()]
    gy, gx = np.gradient(g)
    mag = np.hypot(gx, gy)
    lo, hi = CFG["edge_thresholds"]
    f += [(mag > lo).mean(), (mag > hi).mean(), mag.mean(), mag.std()]
    theta = np.arctan2(gy, gx) % np.pi
    oh, _ = np.histogram(theta, bins=CFG["ori_bins"], range=(0, np.pi), weights=mag)
    f.extend(oh / (oh.sum() + 1e-9))
    lbp = local_binary_pattern(g8, CFG["lbp_points"], CFG["lbp_radius"], method="uniform")
    f.extend(np.bincount(lbp.astype(int).ravel(), minlength=CFG["lbp_points"] + 2) / lbp.size)
    return np.asarray(f, dtype=np.float32)


def _feat_from_path(rel):
    with Image.open(ROOT / rel) as im:
        return extract_features(im)


def cmd_features():
    man_path = PROC / "crops_manifest.csv"
    if not man_path.exists():
        sys.exit("crops_manifest.csv belum ada. Jalankan: python pipeline.py crops")
    man = pd.read_csv(man_path)
    log(f"Mengekstrak fitur dari {len(man)} crop ...")
    feats = joblib.Parallel(n_jobs=-1, batch_size=64)(joblib.delayed(_feat_from_path)(p) for p in man.crop_path)
    names = feature_names()
    F = pd.DataFrame(np.vstack(feats), columns=names)
    assert not F.isna().any().any(), "NaN pada fitur"
    out = pd.concat([man[META_COLS], F], axis=1)
    out.to_csv(PROC / "features.csv", index=False)
    feature_dictionary().to_csv(PROC / "feature_dictionary.csv", index=False)
    # pemeriksaan fitur konstan & korelasi tinggi (tidak dibuang otomatis; putuskan manual & catat)
    const = [c for c in names if F[c].std() < 1e-8]
    corr = F.drop(columns=const).corr().abs()
    pairs = [(a, b, float(corr.loc[a, b])) for i, a in enumerate(corr.columns) for b in corr.columns[i + 1:]
             if corr.loc[a, b] > 0.98]
    write_json(RES / "feature_check.json", {"n_features": len(names), "constant": const,
                                            "near_duplicate_pairs(|r|>0.98)": pairs})
    log(f"Fitur: {len(names)} dimensi | konstan: {len(const)} | pasangan korelasi >0.98: {len(pairs)}")
    log("Tersimpan: data/processed/features.csv, feature_dictionary.csv")


# --------------------------------------------------------------------------- 4. model
class ClusterAugmenter(BaseEstimator, TransformerMixin):
    """Menambahkan informasi K-Means ke fitur (yang sudah diskalakan).
    fit() hanya dipanggil pada data latih oleh Pipeline -> tidak ada kebocoran."""

    def __init__(self, n_clusters=5, representation="both", random_state=SEED):
        self.n_clusters = n_clusters
        self.representation = representation
        self.random_state = random_state

    def fit(self, X, y=None):
        self.km_ = KMeans(n_clusters=self.n_clusters, n_init=5, random_state=self.random_state).fit(X)
        d = self.km_.transform(X)
        self.d_mu_, self.d_sd_ = d.mean(0), d.std(0) + 1e-9
        return self

    def cluster_ids(self, X):
        return self.km_.predict(X)

    def transform(self, X):
        parts = [X]
        if self.representation in ("onehot", "both"):
            parts.append(np.eye(self.n_clusters)[self.km_.predict(X)])        # cluster_id nominal (bukan ordinal)
        if self.representation in ("distance", "both"):
            parts.append((self.km_.transform(X) - self.d_mu_) / self.d_sd_)   # jarak ke tiap centroid
        return np.hstack(parts)


def make_pipeline(clf: str, use_cluster: bool) -> Pipeline:
    steps = [("scaler", StandardScaler())]
    if use_cluster:
        steps.append(("cluster", ClusterAugmenter(representation=CFG["cluster_representation"])))
    est = {"knn": KNeighborsClassifier(), "dt": DecisionTreeClassifier(random_state=SEED),
           "majority": DummyClassifier(strategy="most_frequent")}[clf]
    steps.append(("clf", est))
    return Pipeline(steps)


def param_grid(clf: str, quick: bool):
    if clf == "knn":
        return {"clf__n_neighbors": [5, 9] if quick else [3, 5, 7, 9], "clf__weights": ["uniform", "distance"]}
    return {"clf__max_depth": [6, None] if quick else [4, 6, 8, 12, None],
            "clf__min_samples_leaf": [1, 5] if quick else [1, 5, 10],
            "clf__class_weight": [None, "balanced"]}


def fit_scenario(Xtr, ytr, gtr, spec, k_mode="grid", quick=False):
    """Fit satu skenario pada data latih. Pemilihan parameter lewat CV dalam berkelompok (macro-F1)."""
    pipe = make_pipeline(spec["clf"], spec["cluster"])
    info = {}
    if spec["clf"] == "majority":
        return pipe.fit(Xtr, ytr), info
    grid = param_grid(spec["clf"], quick)
    if spec["cluster"]:
        ks = list(CFG["k_candidates"])[::2] if quick else list(CFG["k_candidates"])
        if k_mode == "silhouette":      # jumlah cluster dipilih tanpa label, hanya dari data latih
            Z = StandardScaler().fit_transform(Xtr)
            sil = {}
            for k in ks:
                lab = KMeans(k, n_init=3, random_state=SEED).fit_predict(Z)
                sil[k] = float(silhouette_score(Z, lab, sample_size=min(3000, len(Z)), random_state=SEED))
            ks = [max(sil, key=sil.get)]
            info["silhouette_by_k"] = sil
        grid["cluster__n_clusters"] = ks
    n_groups_min = pd.Series(gtr).groupby(ytr).nunique().min()
    n_inner = int(max(2, min(3, n_groups_min)))
    cv = list(StratifiedGroupKFold(n_inner, shuffle=True, random_state=SEED).split(Xtr, ytr, gtr))
    gs = GridSearchCV(pipe, grid, scoring="f1_macro", cv=cv, n_jobs=-1, refit=True)
    gs.fit(Xtr, ytr)
    info["best_params"] = {k.split("__", 1)[1]: v for k, v in gs.best_params_.items()}
    info["inner_macro_f1"] = float(gs.best_score_)
    info["inner_folds"] = n_inner
    return gs.best_estimator_, info


def fold_metrics(yt, yp):
    return {"macro_f1": float(f1_score(yt, yp, average="macro", zero_division=0)),
            "balanced_acc": float(balanced_accuracy_score(yt, yp)),
            "accuracy": float(accuracy_score(yt, yp))}


def mean_std(vals):
    a = np.asarray(vals, float)
    return float(a.mean()), float(a.std(ddof=1)) if len(a) > 1 else 0.0


def pattern(deltas):
    m = float(np.mean(deltas))
    if all(d > 0 for d in deltas) and m >= 0.01:
        return "konsisten_naik"
    if all(d < 0 for d in deltas) and m <= -0.01:
        return "konsisten_turun"
    return "tidak_konsisten"


def montage(items, out: Path, cols=6, cell=104):
    """items: list[(path, caption)] -> satu gambar kontak untuk inspeksi visual."""
    if not items:
        return None
    rows = math.ceil(len(items) / cols)
    cap_h = 14
    canvas = Image.new("RGB", (cols * cell, rows * (cell + cap_h)), "#fbf9f6")
    d = ImageDraw.Draw(canvas)
    for i, (p, cap) in enumerate(items):
        x, y = (i % cols) * cell, (i // cols) * (cell + cap_h)
        try:
            with Image.open(ROOT / p) as im:
                canvas.paste(ImageOps.fit(im.convert("RGB"), (cell - 4, cell - 4)), (x + 2, y + 2))
        except Exception:
            pass
        d.text((x + 3, y + cell), cap[:20], fill="#234386")
    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out, quality=88)
    return out.relative_to(RES).as_posix()


def cmd_experiment(n_folds=5, k_mode="grid", quick=False):
    feat_path = PROC / "features.csv"
    if not feat_path.exists():
        sys.exit("features.csv belum ada. Jalankan: python pipeline.py features")
    df = pd.read_csv(feat_path)
    fcols = [c for c in df.columns if c not in META_COLS]
    assert "class_id" not in fcols and "class_name" not in fcols, "label bocor ke fitur!"
    X, y, g = df[fcols].to_numpy(np.float32), df.class_id.to_numpy(), df.group_id.to_numpy()
    cls_name = df.drop_duplicates("class_id").set_index("class_id").class_name.to_dict()
    present = sorted(cls_name)
    names = [cls_name[c] for c in present]
    man = pd.read_csv(PROC / "crops_manifest.csv").set_index("crop_id")
    paths = man.loc[df.crop_id, "crop_path"].to_numpy()
    audit = json.loads((RES / "audit_report.json").read_text(encoding="utf-8")) if (RES / "audit_report.json").exists() else {}

    g_per_class = df.groupby("class_id").group_id.nunique()
    n_splits = int(min(n_folds, g_per_class.min()))
    if n_splits < 2:
        sys.exit("Ada kelas dengan <2 gambar sumber. Revisi ruang lingkup/gabungkan kelas (lihat dokumen bab 2).")
    if n_splits < n_folds:
        log(f"PERINGATAN: fold diturunkan {n_folds}->{n_splits} (kelas minoritas hanya {g_per_class.min()} grup).")
    sgkf = StratifiedGroupKFold(n_splits, shuffle=True, random_state=SEED)
    folds = list(sgkf.split(X, y, g))
    fold_id = np.zeros(len(df), int)
    for i, (tr, te) in enumerate(folds, 1):
        assert not set(g[tr]) & set(g[te]), "kebocoran grup antar train/test!"
        fold_id[te] = i
    pd.DataFrame({"crop_id": df.crop_id, "image_id": df.image_id, "group_id": df.group_id,
                  "fold_id": fold_id}).to_csv(RES / "fold_assignments.csv", index=False)

    oof = {s: np.full(len(df), -1) for s in SCENARIOS}
    oof_p = {s: np.zeros(len(df)) for s in SCENARIOS}
    oof_fold = np.zeros(len(df), int)
    per_fold = {s: [] for s in SCENARIOS}
    fold_info = []
    for fi, (tr, te) in enumerate(folds, 1):
        oof_fold[te] = fi
        fold_info.append({"fold": fi, "n_train": int(len(tr)), "n_test": int(len(te)),
                          "groups_test": int(len(set(g[te]))),
                          "test_class_counts": {cls_name[c]: int((y[te] == c).sum()) for c in present}})
        log(f"\n--- Fold {fi}/{n_splits}: train={len(tr)} test={len(te)} ---")
        for s, spec in SCENARIOS.items():
            pipe, info = fit_scenario(X[tr], y[tr], g[tr], spec, k_mode, quick)
            pred = pipe.predict(X[te])
            oof[s][te] = pred
            oof_p[s][te] = pipe.predict_proba(X[te]).max(1)
            m = fold_metrics(y[te], pred)
            per_fold[s].append({"fold": fi, **m, **info})
            log(f"  {s} {spec['name']:28s} macroF1={m['macro_f1']:.3f} balAcc={m['balanced_acc']:.3f} "
                f"acc={m['accuracy']:.3f} {info.get('best_params', '')}")

    # ---- agregasi
    scen_out = {}
    for s, spec in SCENARIOS.items():
        rows = per_fold[s]
        mean, std = {}, {}
        for k in ("macro_f1", "balanced_acc", "accuracy"):
            mean[k], std[k] = mean_std([r[k] for r in rows])
        rep = classification_report(y, oof[s], labels=present, target_names=names, output_dict=True, zero_division=0)
        scen_out[s] = {**spec, "per_fold": rows, "mean": mean, "std": std,
                       "pooled": fold_metrics(y, oof[s]),
                       "per_class": {n: {k: rep[n][k] for k in ("precision", "recall", "f1-score", "support")} for n in names},
                       "confusion": confusion_matrix(y, oof[s], labels=present).tolist()}
    comparison = {}
    for new, base in (("C", "A"), ("D", "B")):
        d_f1 = [a["macro_f1"] - b["macro_f1"] for a, b in zip(per_fold[new], per_fold[base])]
        d_ba = [a["balanced_acc"] - b["balanced_acc"] for a, b in zip(per_fold[new], per_fold[base])]
        comparison[f"{new}_vs_{base}"] = {
            "delta_macro_f1_per_fold": d_f1, "delta_macro_f1_mean": float(np.mean(d_f1)),
            "delta_balanced_acc_per_fold": d_ba, "delta_balanced_acc_mean": float(np.mean(d_ba)),
            "folds_improved_macro_f1": int(sum(d > 0 for d in d_f1)), "n_folds": n_splits,
            "pattern": pattern(d_f1),
            "delta_recall_per_class": {n: scen_out[new]["per_class"][n]["recall"] - scen_out[base]["per_class"][n]["recall"] for n in names},
            "note": "Deskriptif. Tidak ada uji signifikansi; peningkatan kecil/tidak konsisten bukan bukti meyakinkan."}

    pd.DataFrame([{"scenario": s, "crop_id": df.crop_id[i], "image_id": df.image_id[i], "fold_id": oof_fold[i],
                   "y_true": cls_name[y[i]], "y_pred": cls_name[oof[s][i]], "max_proba": round(float(oof_p[s][i]), 4)}
                  for s in SCENARIOS for i in range(len(df))]).to_csv(RES / "oof_predictions.csv", index=False)

    # ---- model akhir (data penuh, prosedur pemilihan parameter yang sama). Skor jujur = skor OOF di atas.
    log("\n--- Melatih model akhir (seluruh data) untuk demo ---")
    ab = [s for s in "ABCD"]
    best = max(ab, key=lambda s: scen_out[s]["mean"]["macro_f1"])
    pipes, finals = {}, {}
    for s in ab:
        pipes[s], finals[s] = fit_scenario(X, y, g, SCENARIOS[s], k_mode, quick)
        log(f"  final {s}: {finals[s].get('best_params')}")
    best_cluster = max("CD", key=lambda s: scen_out[s]["mean"]["macro_f1"])
    cluster_analysis = analyse_clusters(paths, X, y, cls_name, present, names, pipes[best_cluster], best_cluster, k_mode, quick)
    err_img = error_montage(paths, y, oof[best], cls_name, best)
    pooled_cm = np.array(scen_out[best]["confusion"])
    off = [(names[i], names[j], int(pooled_cm[i, j])) for i in range(len(names)) for j in range(len(names))
           if i != j and pooled_cm[i, j] > 0]
    off.sort(key=lambda t: -t[2])

    joblib.dump({"pipelines": pipes, "class_ids": present, "class_names": names, "best": best,
                 "final_info": finals, "features": fcols, "oof_macro_f1": {s: scen_out[s]["mean"]["macro_f1"] for s in ab},
                 "created": datetime.now().isoformat(timespec="seconds")}, MODELS_PATH)

    summary = {
        "meta": {"created": datetime.now().isoformat(timespec="seconds"), "n_crops": int(len(df)),
                 "n_groups": int(df.group_id.nunique()), "n_features": len(fcols), "n_splits": n_splits,
                 "seed": SEED, "k_mode": k_mode, "quick": quick, "best_scenario": best,
                 "best_cluster_scenario": best_cluster, "libraries": library_versions(),
                 "cv": "StratifiedGroupKFold luar; CV dalam StratifiedGroupKFold (macro-F1); groups=group_id"},
        "class_names": names,
        "class_distribution": {n: {"crops": int((df.class_name == n).sum()),
                                   "groups": int(df[df.class_name == n].group_id.nunique())} for n in names},
        "audit": audit, "folds": fold_info, "scenarios": scen_out, "comparison": comparison,
        "final_models": finals, "top_confusions": [{"true": a, "pred": b, "count": c} for a, b, c in off[:8]],
        "error_montage": err_img, "cluster_analysis": cluster_analysis,
    }
    write_json(RES / "summary.json", summary)
    log("\n=== RINGKASAN (rata-rata fold ± simpangan baku) ===")
    for s in SCENARIOS:
        m, sd = scen_out[s]["mean"], scen_out[s]["std"]
        log(f"{s} {SCENARIOS[s]['name']:28s} macroF1={m['macro_f1']:.3f}±{sd['macro_f1']:.3f} "
            f"balAcc={m['balanced_acc']:.3f}±{sd['balanced_acc']:.3f} acc={m['accuracy']:.3f}±{sd['accuracy']:.3f}")
    for k, v in comparison.items():
        log(f"{k}: Δmacro-F1={v['delta_macro_f1_mean']:+.3f} ({v['folds_improved_macro_f1']}/{v['n_folds']} fold naik, {v['pattern']})")
    log(f"\nModel demo default: skenario {best}. Jalankan: python app.py")


def analyse_clusters(paths, X, y, cls_name, present, names, pipe, scen, k_mode, quick):
    """Analisis EKSPLORATIF pada model akhir (bukan untuk evaluasi): tabel cluster x kelas, PCA 2D, elbow, sampel."""
    Z = pipe.named_steps["scaler"].transform(X)
    aug = pipe.named_steps["cluster"]
    cl = aug.cluster_ids(Z)
    k = aug.n_clusters
    cont = np.zeros((k, len(present)), int)
    for c, yy in zip(cl, y):
        cont[c, present.index(yy)] += 1
    rng = np.random.RandomState(SEED)
    idx = rng.choice(len(Z), min(2500, len(Z)), replace=False)
    pca = PCA(2, random_state=SEED).fit(Z)
    P = pca.transform(Z[idx])
    sil_idx = rng.choice(len(Z), min(3000, len(Z)), replace=False)
    curve = []
    for kk in range(2, 3 if quick else 13):
        km = KMeans(kk, n_init=3, random_state=SEED).fit(Z)
        sl = float(silhouette_score(Z[sil_idx], km.predict(Z[sil_idx]))) if len(set(km.predict(Z[sil_idx]))) > 1 else None
        curve.append({"k": kk, "inertia": float(km.inertia_), "silhouette": sl})
    imgs = {}
    for c in range(k):
        members = np.where(cl == c)[0]
        pick = rng.choice(members, min(12, len(members)), replace=False) if len(members) else []
        imgs[c] = montage([(paths[i], cls_name[y[i]]) for i in pick], RES / "clusters" / f"cluster_{c}.jpg", cols=6)
    purity = [{"cluster": c, "size": int(cont[c].sum()),
               "dominant_class": names[int(cont[c].argmax())] if cont[c].sum() else None,
               "dominant_share": float(cont[c].max() / cont[c].sum()) if cont[c].sum() else 0.0} for c in range(k)]
    return {"scenario": scen, "k": int(k), "k_mode": k_mode,
            "silhouette_all": float(silhouette_score(Z[sil_idx], cl[sil_idx])) if len(set(cl[sil_idx])) > 1 else None,
            "contingency": cont.tolist(), "purity": purity, "elbow": curve,
            "pca_explained_variance": [float(v) for v in pca.explained_variance_ratio_],
            "pca_points": [{"x": float(P[i, 0]), "y": float(P[i, 1]), "cluster": int(cl[j]),
                            "cls": cls_name[y[j]]} for i, j in enumerate(idx)],
            "montages": {str(c): p for c, p in imgs.items()},
            "note": "Dihitung pada seluruh data hanya untuk interpretasi/visualisasi; PCA bukan algoritma utama."}


def error_montage(paths, y, pred, cls_name, scen):
    wrong = np.where(pred != y)[0]
    if not len(wrong):
        return None
    pick = np.random.RandomState(SEED).choice(wrong, min(24, len(wrong)), replace=False)
    items = [(paths[i], f"{cls_name[y[i]][:8]}>{cls_name[pred[i]][:8]}") for i in pick]
    return montage(items, RES / "errors" / f"errors_{scen}.jpg", cols=6)


def main():
    ap = argparse.ArgumentParser(description="CivicScan ML pipeline")
    ap.add_argument("command", choices=["audit", "crops", "features", "experiment", "all"])
    ap.add_argument("--folds", type=int, default=5, help="jumlah fold luar (3 atau 5)")
    ap.add_argument("--k-mode", choices=["grid", "silhouette"], default="grid",
                    help="grid: k dipilih lewat CV dalam (macro-F1, data latih). silhouette: k dipilih tanpa label.")
    ap.add_argument("--quick", action="store_true", help="grid kecil untuk uji cepat (bukan untuk hasil laporan)")
    a = ap.parse_args()
    if a.command in ("audit",):
        cmd_audit()
    if a.command in ("crops", "all"):
        cmd_crops()
    if a.command in ("features", "all"):
        cmd_features()
    if a.command in ("experiment", "all"):
        cmd_experiment(a.folds, a.k_mode, a.quick)


if __name__ == "__main__":
    # Impor ulang sebagai modul 'pipeline' agar kelas yang di-pickle (ClusterAugmenter) dapat dimuat oleh Flask.
    import pipeline as _self
    _self.main()
