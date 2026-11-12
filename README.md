# CivicScan

**Analisis Pengaruh Informasi K-Means Clustering terhadap Performa KNN dan Decision Tree dalam Klasifikasi Permasalahan Fasilitas Umum Berbasis Citra**

Proyek Machine Learning semester 5. Setiap objek yang punya anotasi bounding box dipotong menjadi *crop*, diubah menjadi fitur numerik (warna, intensitas, tepi, tekstur), lalu diklasifikasikan ke tujuh kategori oleh KNN dan Decision Tree. Model baseline dibandingkan dengan model yang mendapat tambahan informasi cluster dari K-Means. Hasilnya dapat dilihat dan dicoba lewat aplikasi web Flask.

> **Ruang lingkup.** Ini klasifikasi crop objek, **bukan** object detection. Hasil prediksi bukan penilaian resmi tingkat bahaya, bukan pengganti inspeksi petugas, dan tidak mengirim laporan ke instansi mana pun.

---

## Daftar isi

1. [Struktur proyek](#1-struktur-proyek)
2. [Prasyarat dan instalasi](#2-prasyarat-dan-instalasi)
3. [Dataset: link, cara unduh, cara menaruh](#3-dataset-link-cara-unduh-cara-menaruh)
4. [Menjalankan pipeline](#4-menjalankan-pipeline)
5. [Menjalankan aplikasi web](#5-menjalankan-aplikasi-web)
6. [Metode dan protokol eksperimen](#6-metode-dan-protokol-eksperimen)
7. [Keluaran dan pemakaiannya untuk paper](#7-keluaran-dan-pemakaiannya-untuk-paper)
8. [Pemecahan masalah](#8-pemecahan-masalah)
9. [Batasan dan catatan jujur](#9-batasan-dan-catatan-jujur)
10. [Sitasi dan lisensi](#10-sitasi-dan-lisensi)

---

## 1. Struktur proyek

```
civicscan/
├── pipeline.py          # seluruh ML: audit, crop, fitur, eksperimen, model akhir
├── app.py               # Flask: halaman demo + dasbor hasil + API
├── requirements.txt
├── README.md
├── templates/
│   ├── base.html        # kerangka, navigasi, footer
│   ├── index.html       # halaman demo (unggah crop)
│   └── results.html     # dasbor hasil eksperimen
├── static/
│   ├── style.css        # desain (mengikuti style reference Pa'lais)
│   └── app.js           # logika halaman demo dan dasbor
│
├── data/                # DIBUAT otomatis / diisi oleh Anda
│   ├── raw/             # <- tempat menaruh dataset asli (lihat bagian 3)
│   ├── crops/           # crop per kelas (dibuat pipeline)
│   └── processed/       # crops_manifest.csv, features.csv, feature_dictionary.csv, excluded.csv
└── results/             # DIBUAT pipeline: summary.json, models.joblib, prediksi, gambar sampel
```

Folder `data/` dan `results/` tidak ikut dalam kode. Keduanya dibuat saat pipeline dijalankan.

---

## 2. Prasyarat dan instalasi

- **Python 3.10 atau lebih baru**
- Ruang disk kosong minimal sekitar **3 GB** (zip dataset 703 MB, hasil ekstrak, dan crop)
- RAM 8 GB disarankan

```bash
# (disarankan) buat virtual environment
python -m venv venv
source venv/bin/activate            # Windows: venv\Scripts\activate

pip install -r requirements.txt
```

Pustaka utama: Flask, NumPy, pandas, Pillow, scikit-learn (≥ 1.3, wajib karena memakai `StratifiedGroupKFold`), scikit-image, joblib, PyYAML.

Jika perintah `python` tidak dikenali, coba `python3` (Mac/Linux) atau `py` (Windows).

---

## 3. Dataset: link, cara unduh, cara menaruh

### 3.1 Informasi dataset

| Item | Keterangan |
|---|---|
| Nama | Urban Community Issues Object Detection Dataset |
| Pembuat | Paudel, Rajeev (Project leader); Pandey, Abishek (Research group) |
| Versi / tanggal rilis | v1, 5 Maret 2026 |
| **Halaman dataset** | **https://zenodo.org/records/18871460** |
| DOI | https://doi.org/10.5281/zenodo.18871460 |
| **Link unduh langsung** | **https://zenodo.org/records/18871460/files/Data_sets.zip?download=1** |
| Berkas | `Data_sets.zip`, 703,1 MB |
| MD5 | `d1560309bf372b14c896113722ae2532` |
| Format anotasi | YOLO (satu file `.txt` per gambar) |
| Lisensi | Creative Commons Attribution 4.0 (CC BY 4.0) |
| Mirror di Kaggle | https://www.kaggle.com/datasets/rajeevpaudel1/urban-community-issues |

Dataset ini **diturunkan dari sumber publik lain** (menurut halaman Zenodo):

- Kaggle, *Pothole, Cracks and Open Manhole*: https://www.kaggle.com/datasets/sabidrahman/pothole-cracks-and-openmanhole
- Open Images (Google): https://storage.googleapis.com/openimages/web/index.html

Tanggal rilis 2026 tidak berarti seluruh gambar baru dikumpulkan pada 2026. Periksa lisensi sumber turunan sebelum mendistribusikan ulang gambar atau crop.

Jumlah **gambar** per kelas yang tercantum di Zenodo (bukan jumlah bounding box atau crop):

| Kelas | Gambar | Kelas | Gambar |
|---|---:|---|---:|
| Animal | 600 | Cracks | 166 |
| Traffic Light | 600 | Open Manhole | 152 |
| Waste Container | 600 | Good Road | 100 |
| Pothole | 300 | **Total** | **2.518** |

Dataset tidak seimbang. Karena itu metrik utama adalah macro-F1 dan balanced accuracy.

### 3.2 Mengunduh

**Lewat browser:** buka halaman dataset di atas, lalu klik *Download* pada `Data_sets.zip`.

**Lewat terminal** (dari folder `civicscan`):

```bash
mkdir -p data/raw
curl -L -o data/raw/Data_sets.zip "https://zenodo.org/records/18871460/files/Data_sets.zip?download=1"
```

### 3.3 Memeriksa keutuhan file

Hasilnya harus `d1560309bf372b14c896113722ae2532`. Jika berbeda, unduh ulang.

```bash
md5sum data/raw/Data_sets.zip              # Linux
md5 data/raw/Data_sets.zip                 # macOS
certutil -hashfile data\raw\Data_sets.zip MD5   # Windows (Command Prompt)
```

Saat `audit` dijalankan, MD5 zip juga dicatat otomatis di `results/provenance.json` (untuk jejak sumber di laporan).

### 3.4 Menaruh dataset

Taruh dataset di **`data/raw/`** (relatif terhadap folder proyek). Ada dua cara, pilih salah satu:

**Cara A: taruh zip saja (paling mudah).** Pipeline mengekstraknya otomatis jika `data/raw/` belum berisi gambar.

```
civicscan/
└── data/
    └── raw/
        └── Data_sets.zip
```

**Cara B: ekstrak sendiri ke `data/raw/`.** Hasil ekstrak boleh berada di subfolder mana pun di dalam `data/raw/`.

```
civicscan/
└── data/
    └── raw/
        └── Data_sets/          # nama folder bisa berbeda
            ├── data.yaml       # daftar nama kelas (jika ada)
            ├── train/
            │   ├── images/  *.jpg
            │   └── labels/  *.txt
            ├── valid/ ...
            └── test/  ...
```

Struktur persis di dalam `Data_sets.zip` belum dapat dipastikan dari halaman Zenodo, jadi pipeline dibuat toleran. Ia mencari gambar dan label secara rekursif, dan mendukung:

- `images/` dan `labels/` yang paralel, dengan atau tanpa pembagian `train/valid/test`;
- file label yang berada satu folder dengan gambarnya;
- pencocokan berdasarkan nama file yang sama (mis. `foto1.jpg` dan `foto1.txt`);
- nama kelas dari `data.yaml` (`names:` berupa list atau dict), atau `classes.txt` / `obj.names`;
- label berupa bounding box (5 nilai) maupun poligon (otomatis diubah menjadi bounding box).

Pembagian `train/valid/test` bawaan dataset **diabaikan**. Pipeline membuat sendiri pembagian berkelompok per gambar sumber (bagian 6) agar tidak ada kebocoran data.

### 3.5 Memverifikasi dataset (wajib sebelum eksperimen)

```bash
python pipeline.py audit
```

Hal yang harus Anda baca dari hasilnya:

| Periksa | Yang diharapkan |
|---|---|
| `class_names_source` | Berawalan `yaml:` atau `txt:`. Jika tertulis **`fallback-dokumen`**, daftar kelas tidak ditemukan di dataset. Urutan kelas hanya dugaan dari dokumen, **verifikasi manual** sebelum lanjut, karena urutan yang salah menukar semua label |
| Gambar per kelas | Mendekati tabel Zenodo (kolom `Zenodo` di output ditampilkan berdampingan) |
| `labels_without_image` / `images_without_label` | Idealnya nol atau kecil. Jika besar, struktur folder mungkin tidak terbaca benar |
| `unknown_class_ids`, `label_lines_malformed` | Idealnya nol |
| `boxes_too_small`, `boxes_out_of_bounds_clipped`, `duplicate_images_dropped` | Dicatat; tidak menggagalkan proses |
| Kelas **Good Road** | Perhatikan jumlah box-nya. Jika kelas ini tidak punya bounding box (mis. hanya foto jalan utuh), ia tidak akan punya crop. Putuskan bersama dosen: digabung, dibuang, atau satu gambar utuh dipakai sebagai satu crop |
| Gambar di `results/audit_samples/` | Kotak oranye harus menempel pada objeknya. Jika meleset, koordinat atau orientasi gambar bermasalah |

Jika audit menunjukkan sesuatu yang janggal, perbaiki atau tanyakan dulu sebelum melanjutkan.

---

## 4. Menjalankan pipeline

### 4.1 Semua tahap sekaligus

```bash
python pipeline.py all --folds 5
```

### 4.2 Per tahap

| Perintah | Yang dilakukan | Keluaran utama |
|---|---|---|
| `python pipeline.py audit` | Memindai gambar dan label, memeriksa anotasi, menggambar sampel bounding box. **Tanpa** membuat crop | `results/audit_report.json`, `results/provenance.json`, `results/audit_samples/` |
| `python pipeline.py crops` | Audit + memotong tiap bounding box menjadi crop | `data/crops/<kelas>/*.jpg`, `data/processed/crops_manifest.csv`, `excluded.csv` |
| `python pipeline.py features` | Ekstraksi 54 fitur visual per crop, pemeriksaan fitur konstan/berkorelasi tinggi | `data/processed/features.csv`, `feature_dictionary.csv`, `results/feature_check.json` |
| `python pipeline.py experiment` | Skenario M/A/B/C/D dengan CV bertingkat berkelompok, melatih model akhir untuk demo | `results/summary.json`, `oof_predictions.csv`, `fold_assignments.csv`, `models.joblib`, `clusters/`, `errors/` |
| `python pipeline.py all` | `crops` → `features` → `experiment` (audit sudah ikut di `crops`) | semua di atas |

### 4.3 Opsi

| Opsi | Nilai | Keterangan |
|---|---|---|
| `--folds` | `3` atau `5` (default 5) | Jumlah fold luar. Otomatis diturunkan jika ada kelas dengan gambar sumber lebih sedikit dari jumlah fold |
| `--k-mode` | `grid` (default) / `silhouette` | `grid`: jumlah cluster k ∈ {3,5,7,10} dipilih lewat CV dalam (macro-F1, data latih). `silhouette`: k dipilih tanpa label dari data latih, sehingga grid classifier A/B dan C/D identik |
| `--quick` | (flag) | Grid hiperparameter kecil untuk uji cepat. **Jangan dipakai untuk angka laporan** |

Disarankan menjalankan eksperimen dua kali, dengan `--k-mode grid` dan `--k-mode silhouette`, lalu melaporkan keduanya. Hasil run kedua menimpa `results/summary.json`, jadi salin folder `results/` run pertama (mis. menjadi `results_grid/`) sebelum menjalankan yang kedua.

```bash
python pipeline.py experiment --folds 5 --k-mode grid
cp -r results results_grid
python pipeline.py experiment --folds 5 --k-mode silhouette
```

### 4.4 Waktu proses

Tahap `experiment` paling lama karena melakukan pencarian hiperparameter berlapis (CV dalam di dalam CV luar) untuk lima skenario. Lamanya bergantung pada jumlah crop dan jumlah inti CPU. Biarkan sampai selesai. Pipeline memakai semua inti CPU (`n_jobs=-1`).

### 4.5 Mengulang dari awal

`crops` otomatis menghapus dan membuat ulang `data/crops/`. Jika dataset atau parameter crop/fitur berubah, jalankan ulang seluruh pipeline (`python pipeline.py all`). Jangan menjalankan `experiment` dengan `features.csv` yang berasal dari versi data lama.

---

## 5. Menjalankan aplikasi web

Pastikan pipeline sudah selesai (`results/models.joblib` dan `results/summary.json` ada), lalu:

```bash
python app.py
```

Buka **http://127.0.0.1:5000**. Port dapat diganti: `PORT=8000 python app.py` (Windows PowerShell: `$env:PORT=8000; python app.py`).

| Halaman / endpoint | Fungsi |
|---|---|
| `/` | Demo: unggah crop objek, pilih model A–D, lihat prediksi, skor tiap kelas, dan nomor cluster (untuk C/D) |
| `/results` | Dasbor: tabel metrik, macro-F1 per skenario dan per fold, selisih akibat cluster, metrik per kelas, confusion matrix, PCA, elbow/silhouette, sampel visual tiap cluster, contoh salah klasifikasi, audit data |
| `POST /api/predict` | Field form `image` (JPG/PNG/WEBP/BMP, maks. 8 MB) dan `scenario` (opsional: `A`–`D`) |
| `GET /api/status`, `GET /api/results` | Status model dan seluruh `summary.json` |

Cara memakai demo: **unggah crop satu objek**, bukan foto jalan penuh. Aplikasi tidak mencari lokasi objek sendiri. Aplikasi memberi peringatan jika gambar terlalu kecil, tampak seperti foto penuh, atau keyakinan model rendah (< 50%). Contoh crop untuk dicoba ada di `data/crops/<kelas>/`. Untuk uji yang jujur, pakai crop atau foto yang tidak ada di data latih.

Probabilitas yang ditampilkan bukan probabilitas terkalibrasi: untuk KNN berupa proporsi suara tetangga, untuk Decision Tree berupa proporsi kelas pada daun.

---

## 6. Metode dan protokol eksperimen

### 6.1 Unit analisis

Satu observasi = satu crop dari satu bounding box. Satu gambar dapat menghasilkan banyak crop, sehingga jumlah crop ≠ jumlah gambar (keduanya dilaporkan). Setiap crop menyimpan `image_id` dan `group_id`.

### 6.2 Aturan pembersihan (ditetapkan sebelum melihat skor)

- Crop dipotong pada batas gambar. Sisi terpendek harus ≥ **24 px** dan luas ≥ **1024 px²**; yang lebih kecil dikeluarkan dan dicatat di `data/processed/excluded.csv`.
- Duplikat gambar persis (hash MD5 sama) dan duplikat bounding box dibuang dan dicatat.
- Orientasi EXIF dikoreksi sebelum koordinat dipakai.

### 6.3 Fitur visual (54 dimensi)

Semua crop di-resize ke 128×128 lalu diekstraksi dengan fungsi `extract_features()`, yang juga dipakai demo web agar identik dengan training.

| Keluarga | Fitur |
|---|---|
| Warna | Histogram HSV (12 bin H, 6 bin S, 6 bin V), rata-rata sirkular hue, rata-rata dan simpangan baku S dan V |
| Intensitas | Rata-rata dan simpangan baku grayscale |
| Tepi | Kepadatan tepi pada dua ambang tetap |
| Tekstur | Rata-rata dan simpangan baku magnitudo gradien, histogram orientasi gradien (8 bin), histogram LBP *uniform* (10 bin) |

Kamus lengkap: `data/processed/feature_dictionary.csv`.

### 6.4 Pembagian data dan pencegahan kebocoran

- **Kelompok split (`group_id`)** = hash isi file gambar; untuk salinan augmentasi bergaya Roboflow (`nama_jpg.rf.<hash>`) kelompoknya adalah nama sumber. Ini sedikit lebih ketat daripada `image_id` murni. Semua crop dari satu kelompok selalu berada di fold yang sama.
- **Fold luar:** `StratifiedGroupKFold` (shuffle, `random_state=42`). Pipeline memeriksa bahwa tidak ada grup yang muncul di train sekaligus test.
- **Scaler (StandardScaler), K-Means, dan classifier** berada di dalam satu `sklearn.Pipeline`, sehingga di-fit ulang hanya pada data latih di setiap fold luar maupun dalam.
- **Pemilihan hiperparameter** lewat CV dalam berkelompok (3 fold, skor macro-F1) hanya pada data latih. Skor fold uji tidak dipakai memilih apa pun.

### 6.5 Skenario

| Kode | Fitur | Classifier | Tujuan |
|---|---|---|---|
| M | (tidak ada) | Majority class | Pembanding minimum |
| A | Fitur dasar | KNN | Baseline KNN |
| B | Fitur dasar | Decision Tree | Baseline pohon |
| C | Fitur dasar + fitur K-Means | KNN | Pengaruh cluster pada KNN |
| D | Fitur dasar + fitur K-Means | Decision Tree | Pengaruh cluster pada pohon |

Grid hiperparameter: KNN `k` ∈ {3,5,7,9} dan bobot {uniform, distance}; Decision Tree `max_depth` ∈ {4,6,8,12,None}, `min_samples_leaf` ∈ {1,5,10}, `class_weight` ∈ {None, balanced}.

### 6.6 Fitur K-Means

K-Means di-fit hanya pada fitur latih yang sudah diskalakan. Untuk tiap crop dihasilkan one-hot `cluster_id` (nominal, bukan ordinal) dan jarak ke semua centroid (distandarkan memakai statistik data latih), lalu digabung dengan fitur dasar. Cluster tidak harus sama jumlahnya dengan jumlah kelas.

### 6.7 Metrik

Utama: **macro-F1** dan **balanced accuracy**. Pendukung: accuracy, precision/recall/F1 per kelas, confusion matrix gabungan out-of-fold, dan jumlah sampel per kelas. Perbandingan C−A dan D−B dilaporkan sebagai selisih per fold, jumlah fold yang naik, dan perubahan recall per kelas.

**Tidak ada uji signifikansi.** Peningkatan kecil atau tidak konsisten antar fold tidak boleh ditulis sebagai peningkatan yang meyakinkan, dan hasil negatif tetap dilaporkan.

---

## 7. Keluaran dan pemakaiannya untuk paper

| Berkas | Isi | Dipakai untuk |
|---|---|---|
| `results/summary.json` | Semua metrik: per fold, rata-rata ± simpangan baku, gabungan OOF, per kelas, confusion matrix, selisih C−A dan D−B, parameter terbaik per fold, analisis cluster | Tabel hasil (Fold × Skenario × Macro-F1/Balanced Acc./Accuracy), pembahasan |
| `results/oof_predictions.csv` | Prediksi out-of-fold per crop dan skenario | Analisis kesalahan, hitung ulang metrik |
| `results/fold_assignments.csv` | Fold tiap crop | Reproduksibilitas |
| `results/audit_report.json` | Hitungan audit lengkap | Bab data/audit |
| `results/provenance.json` | DOI, MD5 zip, versi pustaka, konfigurasi, seed | Jejak sumber dan metadata |
| `results/feature_check.json` | Fitur konstan dan pasangan berkorelasi > 0,98 | Seleksi fitur |
| `data/processed/excluded.csv` | Crop yang dikeluarkan beserta alasan | Catatan eksklusi |
| `results/audit_samples/` | Validasi visual bounding box | Lampiran audit |
| `results/clusters/` | Sampel crop tiap cluster | Interpretasi cluster |
| `results/errors/` | Contoh salah klasifikasi | Analisis kesalahan |
| `results/models.joblib` | Model akhir A–D (dilatih pada seluruh data) | Demo web |

Catatan: skor yang jujur adalah skor **out-of-fold** (rata-rata fold), bukan skor model akhir. Model akhir dilatih pada seluruh data hanya untuk demo.

Semua angka di paper harus berasal dari `summary.json` hasil eksperimen pada dataset asli Anda.

---

## 8. Pemecahan masalah

| Gejala | Penyebab / solusi |
|---|---|
| `Tidak ada gambar di .../data/raw` | Dataset belum ditaruh di `data/raw/` (lihat 3.4) |
| `Tidak ada anotasi yang berhasil dibaca` | Struktur atau format label tidak terbaca. Periksa isi `data/raw/`, pastikan file `.txt` label ada, lalu jalankan `audit` |
| Banyak `labels_without_image` | Gambar dan label tidak berpasangan seperti pola yang didukung. Kirim hasil `tree`/`ls` folder dataset untuk menyesuaikan kode |
| `class_names_source: fallback-dokumen` | `data.yaml` tidak ditemukan. Tambahkan `data.yaml` berisi `names:` atau `classes.txt` (satu nama per baris, sesuai urutan class_id) di dalam `data/raw/` |
| `crops_manifest.csv belum ada` | Jalankan `python pipeline.py crops` dulu |
| `features.csv belum ada` | Jalankan `python pipeline.py features` dulu |
| `Ada kelas dengan <2 gambar sumber` | Kelas terlalu sedikit untuk di-split. Gabungkan kelas atau revisi ruang lingkup (lihat dokumen rancangan bab 2) |
| Peringatan "fold diturunkan" | Normal jika kelas minoritas punya sedikit gambar sumber. Catat di bagian keterbatasan |
| Halaman `/results` kosong | `experiment` belum selesai atau belum dijalankan |
| Demo: "Model belum dilatih" | `results/models.joblib` belum ada; jalankan `experiment` |
| Gagal memuat `models.joblib` (`ClusterAugmenter`) | Jalankan `app.py` dari folder proyek yang sama dengan `pipeline.py`, dan jangan mengganti nama `pipeline.py` |
| Error versi scikit-learn (`StratifiedGroupKFold`) | `pip install -U "scikit-learn>=1.3"` |
| Proses sangat lambat / kehabisan memori | Tutup aplikasi lain; gunakan `--folds 3`. Untuk uji kode saja, `--quick` |
| Font tidak muncul di web | Font dimuat dari Google Fonts, butuh internet. Tanpa internet tampilan memakai font cadangan sistem |

---

## 9. Batasan dan catatan jujur

- Ini klasifikasi crop. Demo tidak menemukan lokasi objek di foto penuh dan tidak menentukan urgensi atau tingkat bahaya.
- Dataset adalah kompilasi sumber publik (Kaggle dan Open Images) dan belum tentu mewakili kondisi jalan di Indonesia. Karena sumber berbeda untuk kelas berbeda, gaya foto atau resolusi bisa ikut menjadi pembeda kelas. Tulis ini sebagai ancaman validitas.
- Foto yang hampir sama tetapi berbeda nama dan isi file (duplikat semu) tidak terdeteksi otomatis. Periksa `audit_samples/` dan sampel cluster secara visual.
- Fitur warna dan tekstur sederhana dapat gagal membedakan kelas yang mirip (mis. pothole dan cracks, good road dan cracks). Hasil buruk tetap dilaporkan.
- K-Means bisa mengelompokkan latar atau pencahayaan, bukan bentuk objek. Interpretasikan cluster lewat sampel visual.
- Pada mode `grid`, skenario C/D memilih dari ruang pencarian yang sedikit lebih besar (nilai k) daripada A/B. Bandingkan juga dengan `--k-mode silhouette`.
- Analisis cluster (PCA, elbow, tabel cluster × kelas) dihitung pada seluruh data hanya untuk interpretasi, bukan untuk evaluasi. PCA bukan algoritma utama penelitian.
- Dataset yang baru dirilis tidak otomatis menjamin kebaruan ilmiah. Lakukan penelusuran literatur sebelum mengklaim kontribusi.
- **Status pengujian kode:** alur dan aplikasi web sudah diuji end-to-end pada dataset YOLO sintetis kecil (termasuk kasus label rusak, duplikat, dan box di luar batas), tetapi belum pada dataset Zenodo asli. Angka dari data sintetis tidak boleh dipakai di paper.

---

## 10. Sitasi dan lisensi

Sitasi dataset (sesuaikan format dengan ketentuan kampus):

```bibtex
@dataset{paudel2026urban,
  author    = {Paudel, Rajeev},
  title     = {Urban Community Issues Object Detection Dataset},
  year      = {2026},
  publisher = {Zenodo},
  version   = {v1},
  doi       = {10.5281/zenodo.18871460},
  url       = {https://zenodo.org/records/18871460}
}
```

Sebutkan juga sumber turunannya:

- Kaggle, *Pothole, Cracks and Open Manhole* (sabidrahman): https://www.kaggle.com/datasets/sabidrahman/pothole-cracks-and-openmanhole
- Open Images: https://storage.googleapis.com/openimages/web/index.html

Pustaka: scikit-learn (KNeighborsClassifier, DecisionTreeClassifier, KMeans, StandardScaler, StratifiedGroupKFold, metrik klasifikasi). Catat versi dan tanggal akses dokumentasi saat menulis paper; versi pustaka yang dipakai tercatat otomatis di `results/provenance.json`.

Dataset berlisensi CC BY 4.0 (wajib atribusi). Karena dataset turunan dari sumber lain, periksa ketentuan lisensi sumbernya sebelum mempublikasikan atau mendistribusikan ulang gambar dan crop. Jangan meng-commit `data/raw/`, `data/crops/`, dan `results/models.joblib` ke git; tambahkan ke `.gitignore`.