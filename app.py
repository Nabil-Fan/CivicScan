"""CivicScan — aplikasi web Flask (demo klasifikasi crop + dasbor hasil eksperimen).

Jalankan:  python app.py   ->  http://127.0.0.1:5000
Model & ringkasan dibuat oleh:  python pipeline.py all
"""
import json
import os

import joblib
from flask import Flask, abort, jsonify, render_template, request, send_from_directory
from PIL import Image, ImageOps, UnidentifiedImageError

import pipeline as P  # extract_features() yang sama dengan saat training + kelas ClusterAugmenter

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 8 * 1024 * 1024  # 8 MB
ALLOWED = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
_cache = {"mtime": None, "bundle": None}


def get_bundle():
    """Muat models.joblib; muat ulang otomatis jika file berubah."""
    if not P.MODELS_PATH.exists():
        return None
    m = P.MODELS_PATH.stat().st_mtime
    if _cache["mtime"] != m:
        _cache.update(bundle=joblib.load(P.MODELS_PATH), mtime=m)
    return _cache["bundle"]


def get_summary():
    f = P.RES / "summary.json"
    return json.loads(f.read_text(encoding="utf-8")) if f.exists() else None


@app.route("/")
def index():
    return render_template("index.html", page="demo")


@app.route("/results")
def results():
    return render_template("results.html", page="results")


@app.route("/api/status")
def status():
    b = get_bundle()
    if not b:
        return jsonify(ready=False)
    s = get_summary() or {}
    scen = {k: {"name": P.SCENARIOS[k]["name"], "macro_f1": b["oof_macro_f1"][k]} for k in b["pipelines"]}
    return jsonify(ready=True, best=b["best"], scenarios=scen, classes=b["class_names"],
                   n_crops=(s.get("meta") or {}).get("n_crops"))


@app.route("/api/results")
def api_results():
    s = get_summary()
    return jsonify(s) if s else (jsonify(error="Belum ada hasil. Jalankan: python pipeline.py all"), 404)


@app.route("/files/<path:name>")
def files(name):
    allowed = ("clusters/", "errors/", "audit_samples/")
    if not name.startswith(allowed):
        abort(404)
    return send_from_directory(P.RES, name)


@app.route("/api/predict", methods=["POST"])
def predict():
    b = get_bundle()
    if not b:
        return jsonify(error="Model belum dilatih. Jalankan: python pipeline.py all"), 503
    f = request.files.get("image")
    if not f or not f.filename:
        return jsonify(error="Pilih berkas gambar terlebih dahulu."), 400
    if os.path.splitext(f.filename)[1].lower() not in ALLOWED:
        return jsonify(error="Format tidak didukung. Gunakan JPG, PNG, WEBP, atau BMP."), 400
    try:
        img = ImageOps.exif_transpose(Image.open(f.stream)).convert("RGB")
    except (UnidentifiedImageError, OSError):
        return jsonify(error="Berkas tidak dapat dibaca sebagai gambar."), 400

    scen = request.form.get("scenario") or b["best"]
    if scen not in b["pipelines"]:
        return jsonify(error="Skenario model tidak dikenal."), 400
    pipe = b["pipelines"][scen]

    x = P.extract_features(img).reshape(1, -1)
    
    # Scale features
    x_scaled = pipe.named_steps["scaler"].transform(x)
    if "cluster" in pipe.named_steps:
        x_scaled = pipe.named_steps["cluster"].transform(x_scaled)
    
    proba = pipe.predict_proba(x)[0]
    names = [b["class_names"][b["class_ids"].index(c)] for c in pipe.classes_]
    order = proba.argsort()[::-1]
    probs = [{"label": names[i], "p": float(proba[i])} for i in order]

    cluster = None
    if "cluster" in pipe.named_steps:
        z = pipe.named_steps["scaler"].transform(x)
        cluster = {"id": int(pipe.named_steps["cluster"].cluster_ids(z)[0]),
                   "k": int(pipe.named_steps["cluster"].n_clusters)}

    # Feature breakdown untuk penjelasan
    feat_dict = P.feature_dictionary()
    feat_names = P.feature_names()
    features = {}
    for fam in ["warna", "intensitas", "tepi", "tekstur"]:
        fam_feats = feat_dict[feat_dict["family"] == fam]
        fam_values = {row["feature"]: float(x[0, feat_names.index(row["feature"])]) 
                      for _, row in fam_feats.iterrows()}
        features[fam] = {
            "values": fam_values,
            "summary": {
                "mean": float(sum(fam_values.values()) / len(fam_values)) if fam_values else 0,
                "max": float(max(fam_values.values())) if fam_values else 0,
                "count": len(fam_values)
            }
        }
    
    # Explanation: kenapa dapet skor ini
    explanation = {"method": scen}
    clf = pipe.named_steps["clf"]
    
    if scen in ["A", "B"]:  # KNN
        # Hitung distance ke semua training samples
        from sklearn.neighbors import KNeighborsClassifier
        if hasattr(clf, "kneighbors"):
            distances, indices = clf.kneighbors(x_scaled)
            neighbor_classes = clf._y[indices[0]]  # Classes of k-nearest neighbors
            
            # Count votes per class
            class_votes = {}
            for cls in pipe.classes_:
                class_votes[names[list(pipe.classes_).index(cls)]] = int(sum(neighbor_classes == cls))
            
            # Get feature differences with neighbors
            # Simplified: just show which features differ most
            explanation["knn"] = {
                "k": int(clf.n_neighbors),
                "votes": class_votes,
                "avg_distance": float(distances[0].mean()),
                "closest_distance": float(distances[0].min()),
                "farthest_distance": float(distances[0].max())
            }
    
    elif scen in ["C", "D"]:  # Decision Tree
        from sklearn.tree import DecisionTreeClassifier
        if hasattr(clf, "tree_"):
            # Get decision path
            node_indicator = clf.decision_path(x_scaled)
            leaf_id = clf.apply(x_scaled)[0]
            
            # Get feature importances from the tree
            feature_importance = clf.feature_importances_
            top_features_idx = feature_importance.argsort()[-5:][::-1]
            
            # Map back to original feature names (before cluster augmentation)
            n_orig_features = len(feat_names)
            top_features = []
            for idx in top_features_idx:
                if idx < n_orig_features:
                    top_features.append({
                        "name": feat_names[idx],
                        "importance": float(feature_importance[idx])
                    })
            
            # Get samples at leaf
            n_samples_leaf = int(clf.tree_.n_node_samples[leaf_id])
            
            explanation["tree"] = {
                "depth": int(clf.get_depth()),
                "n_leaves": int(clf.get_n_leaves()),
                "leaf_samples": n_samples_leaf,
                "top_features": top_features,
                "path_length": int(node_indicator.sum())
            }

    w, h = img.size
    warnings = []
    if min(w, h) < P.CFG["min_side_px"] or w * h < P.CFG["min_area_px"]:
        warnings.append("Crop sangat kecil; fitur visual dapat tidak stabil.")
    if min(w, h) > 1000:
        warnings.append("Gambar tampak seperti foto penuh. Model dilatih pada crop objek; "
                        "hasil dapat keliru. Pangkas ke area objek.")
    if probs[0]["p"] < 0.5:
        warnings.append("Keyakinan rendah (< 50%). Perlakukan sebagai petunjuk awal saja.")

    return jsonify(label=probs[0]["label"], confidence=probs[0]["p"], probs=probs, scenario=scen,
                   scenario_name=P.SCENARIOS[scen]["name"], cluster=cluster, size=[w, h],
                   oof_macro_f1=b["oof_macro_f1"][scen], warnings=warnings, features=features,
                   explanation=explanation,
                   proba_note=("Untuk KNN, nilai ini adalah proporsi suara tetangga; untuk Decision Tree, "
                               "proporsi kelas pada daun. Bukan probabilitas terkalibrasi."))


@app.errorhandler(413)
def too_large(_):
    return jsonify(error="Ukuran berkas melebihi 8 MB."), 413


if __name__ == "__main__":
    app.run(debug=False, host="127.0.0.1", port=int(os.environ.get("PORT", 5000)))
