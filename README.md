# CivicScan

K-Means sebagai fitur tambahan untuk klasifikasi crop objek perkotaan (KNN dan Decision Tree).
Proyek Machine Learning semester 5.

> Ini klasifikasi crop, bukan object detection. Hasil prediksi bukan penilaian resmi tingkat bahaya.

## Struktur

```
civicscan/
├── pipeline.py        # seluruh proses ML
├── app.py             # aplikasi web Flask
├── requirements.txt
├── templates/         # base.html, index.html, results.html
├── static/            # style.css, app.js
└── data/raw/          # <- taruh dataset di sini
```

`data/` dan `results/` dibuat otomatis saat pipeline dijalankan.

## 1. Instalasi

Butuh Python 3.10 atau lebih baru.

```bash
pip install -r requirements.txt
```

## 2. Dataset

- Halaman dataset: https://zenodo.org/records/18871460
- Unduh langsung: https://zenodo.org/records/18871460/files/Data_sets.zip?download=1
- Berkas: `Data_sets.zip` (703,1 MB), MD5 `d1560309bf372b14c896113722ae2532`
- Lisensi: CC BY 4.0. Dataset diturunkan dari sumber publik lain (Kaggle dan Open Images), jadi periksa lisensi sumbernya sebelum redistribusi.

**Cara menaruh:** buat folder `data/raw/` lalu taruh `Data_sets.zip` di dalamnya. Zip akan diekstrak otomatis saat pipeline dijalankan.

```
civicscan/
└── data/
    └── raw/
        └── Data_sets.zip
```

Atau lewat terminal:

```bash
mkdir -p data/raw
curl -L -o data/raw/Data_sets.zip "https://zenodo.org/records/18871460/files/Data_sets.zip?download=1"
```

## 3. Audit dataset

```bash
python pipeline.py audit
```

Cek hasilnya sebelum lanjut:

- `class_names_source` harus berawalan `yaml:` atau `txt:`. Jika tertulis `fallback-dokumen`, daftar kelas tidak ditemukan di dataset dan urutan kelas harus diverifikasi manual.
- Jumlah gambar per kelas mendekati data Zenodo (Animal 600, Traffic Light 600, Waste Container 600, Pothole 300, Cracks 166, Open Manhole 152, Good Road 100).
- `labels_without_image` dan `images_without_label` kecil atau nol.
- Kelas Good Road punya bounding box. Jika tidak, kelas itu tidak akan punya crop.
- Gambar di `results/audit_samples/`: kotak oranye harus menempel pada objek.

## 4. Jalankan semua

```bash
python pipeline.py all
```

Perintah ini membuat crop, mengekstrak fitur, menjalankan eksperimen (skenario A, B, C, D), dan melatih model untuk demo. Prosesnya lama; biarkan sampai selesai.

Hasilnya ada di `results/`, terutama `summary.json` (semua metrik untuk paper).

## 5. Jalankan web

```bash
python app.py
```

Buka http://127.0.0.1:5000

- `/` : demo, unggah crop satu objek (bukan foto jalan penuh)
- `/results` : tabel metrik, confusion matrix, cluster, contoh salah klasifikasi

## Skenario yang dibandingkan

| Kode | Fitur | Model |
|---|---|---|
| M | - | Mayoritas kelas (pembanding minimum) |
| A | Fitur dasar | KNN |
| B | Fitur dasar | Decision Tree |
| C | Fitur dasar + K-Means | KNN |
| D | Fitur dasar + K-Means | Decision Tree |

Pembagian data berkelompok per gambar sumber, dan scaler, K-Means, serta model hanya di-fit pada data latih, jadi tidak ada kebocoran data. Metrik utama: macro-F1 dan balanced accuracy.

## Jika ada masalah

| Gejala | Solusi |
|---|---|
| `Tidak ada gambar di .../data/raw` | Dataset belum ditaruh di `data/raw/` |
| Banyak `labels_without_image` | Struktur folder dataset tidak terbaca; kirim hasil `ls`/`tree` folder `data/raw/` |
| Halaman `/results` kosong atau demo bilang model belum dilatih | `python pipeline.py all` belum selesai |
| Error `StratifiedGroupKFold` | `pip install -U "scikit-learn>=1.3"` |
| `python` tidak dikenali | Coba `python3` atau `py` |

## Catatan

- Semua angka di paper harus berasal dari `results/summary.json` hasil eksperimen pada dataset asli Anda.
- Kode sudah diuji end-to-end pada dataset sintetis kecil, belum pada dataset Zenodo asli.
- Perbandingan C dengan A dan D dengan B bersifat deskriptif, tanpa uji signifikansi.
- Jangan commit `data/` dan `results/models.joblib` ke git.

## Sitasi dataset

Paudel, R. (2026). *Urban Community Issues Object Detection Dataset* (v1). Zenodo. https://doi.org/10.5281/zenodo.18871460