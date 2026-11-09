# CivicScan

K-Means sebagai fitur tambahan untuk klasifikasi crop objek perkotaan (KNN dan Decision Tree).
Proyek Machine Learning semester 5, mengikuti dokumen rancangan 31 Oktober 2026.

## Struktur

```
civicscan/
├── pipeline.py        # seluruh ML: audit, crop, fitur, eksperimen, model akhir
├── app.py             # Flask: demo klasifikasi + dasbor hasil
├── templates/         # base.html, index.html (demo), results.html (dasbor)
├── static/            # style.css, app.js
├── requirements.txt
└── data/ , results/   # dibuat otomatis oleh pipeline
```

## Menjalankan

```bash
pip install -r requirements.txt

# 1. Unduh Data_sets.zip dari https://zenodo.org/records/18871460
#    lalu letakkan zip ATAU hasil ekstraknya di data/raw/
# 2. Audit dulu, baca hasilnya, baru lanjut
python pipeline.py audit

# 3. Crop -> fitur -> eksperimen -> model akhir
python pipeline.py all --folds 5
# (boleh per tahap: crops | features | experiment)

# 4. Web
python app.py        # http://127.0.0.1:5000
```

Opsi `experiment`: `--folds 3|5`, `--k-mode grid|silhouette`, `--quick` (grid kecil, hanya untuk uji cepat; jangan dipakai untuk angka laporan).

## Keputusan desain yang perlu Anda ketahui

| Hal | Implementasi |
|---|---|
| Unit observasi | satu crop dari satu bounding box; `crops_manifest.csv` menyimpan `image_id` dan `group_id` |
| Kelompok split | `group_id` = hash isi file, atau nama sumber untuk salinan augmentasi bergaya Roboflow (`*.rf.<hash>`). Ini lebih ketat daripada `image_id` murni. Duplikat persis dibuang dan dicatat |
| Split luar | `StratifiedGroupKFold` (fold otomatis diturunkan bila kelas minoritas punya grup lebih sedikit dari jumlah fold) |
| Anti-kebocoran | Scaler, K-Means, dan classifier ada di dalam satu `sklearn.Pipeline`, sehingga di-fit ulang hanya pada training fold, termasuk di CV dalam |
| Pemilihan parameter | CV dalam berkelompok, skor macro-F1, hanya pada data latih |
| Jumlah cluster | `grid` (default): k ∈ {3,5,7,10} dipilih CV dalam. `silhouette`: dipilih tanpa label pada data latih, sehingga grid classifier A/B dan C/D identik. Jalankan keduanya dan laporkan keduanya |
| Fitur cluster | one-hot `cluster_id` + jarak ke semua centroid (jarak distandarkan dengan statistik data latih) |
| Skenario | M (mayoritas), A (KNN), B (DT), C (KNN+KM), D (DT+KM), fold luar identik |
| Fitur visual | 54 dimensi: histogram HSV 12/6/6, statistik HSV, intensitas, 2 kepadatan tepi, statistik gradien, orientasi gradien 8 bin, LBP uniform 10 bin. Kamus: `data/processed/feature_dictionary.csv` |
| Ambang crop | sisi ≥ 24 px dan luas ≥ 1024 px², ditetapkan di `CFG` sebelum melihat skor |

## Keluaran untuk paper

* `results/summary.json`: semua tabel (mean ± sd per fold, gabungan OOF, per kelas, confusion matrix, selisih C-A dan D-B, parameter terbaik per fold).
* `results/oof_predictions.csv`, `results/fold_assignments.csv`: prediksi out-of-fold dan fold tiap crop, agar hasil dapat dihitung ulang.
* `results/audit_report.json`, `results/provenance.json`, `data/processed/excluded.csv`: audit, jejak sumber, dan catatan eksklusi.
* `results/clusters/`, `results/errors/`, `results/audit_samples/`: sampel visual cluster, salah klasifikasi, dan validasi bounding box.

Perbandingan C-A dan D-B bersifat deskriptif (tidak ada uji signifikansi). Peningkatan kecil atau tidak konsisten antar fold tidak boleh ditulis sebagai peningkatan yang meyakinkan.

## Batasan yang harus ditulis di laporan

* Klasifikasi crop, bukan object detection; demo menerima crop yang sudah dipilih.
* Dataset gabungan sumber publik; lisensi sumber turunan harus diperiksa sebelum redistribusi.
* Duplikat semu (foto hampir sama dengan nama berbeda) tidak terdeteksi otomatis; periksa `audit_samples/` dan cluster secara visual.
* Pada mode `grid`, skenario C/D memilih dari ruang pencarian yang sedikit lebih besar (k) daripada A/B. Bandingkan juga dengan `--k-mode silhouette`.
* Probabilitas KNN/Decision Tree bukan probabilitas terkalibrasi.
* `data/raw/` dan `models.joblib` besar; jangan di-commit ke git.
