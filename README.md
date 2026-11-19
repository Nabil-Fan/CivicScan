# CivicScan — Spatial Regression Engine (Model Biasa vs. Model GWR)

Studi Komparasi Pengaruh Heterogenitas Spasial: **Model Biasa (Global OLS)** versus **Geographically Weighted Regression (GWR)** pada Permasalahan Fasilitas Publik & Infrastruktur Perkotaan.

---

## 📌 Ringkasan Eksekutif

Proyek ini mengevaluasi keterbatasan model regresi linear biasa (Ordinary Least Squares / OLS) dalam menangani data geospasial perkotaan yang memiliki sifat non-stasioneritas (hubungan antar variabel berubah tergantung lokasi) dan autokorelasi spasial. Sistem membandingkannya dengan Geographically Weighted Regression (GWR) yang memperhitungkan bobot geografis lokal tetangga terdekat.

### Metrik Komparasi Utama:
1. **Koefisien Determinasi ($R^2$)**: Peningkatan varians yang dapat dijelaskan dari OLS ke GWR ($0.485 \rightarrow 0.589$, kenaikan $+21.4\%$).
2. **Corrected Akaike Information Criterion ($\text{AICc}$)**: Penurunan $\Delta \text{AICc} = -9.97$ ($\Delta \text{AICc} > 3$ secara tegas membuktikan GWR lebih fit dan parsimonius).
3. **Uji Moran's I Residual**:
   - Residual OLS: Moran's I = $0.1022$ ($p = 0.012^*$) $\rightarrow$ Terbukti bias autokorelasi spasial signifikan.
   - Residual GWR: Moran's I = $0.0113$ ($p = 0.337^{\text{ns}}$) $\rightarrow$ Bias autokorelasi spasial berhasil dieliminasi.
4. **Uji ANOVA / F-Test**: $F = 3.82$ ($p < 0.001$), membuktikan signifikansi variasi spasial parameter lokal.

---

## 📂 Struktur Direktori

```
CivicScan/
├── pipeline.py             # Engine analisis spasial (OLS, Bandwidth Search, GWR, Moran's I, ANOVA)
├── app.py                  # Server web Flask REST API & Spatial Studio
├── requirements.txt        # Dependensi pustaka spasial (mgwr, libpysal, spreg, esda, statsmodels)
├── PAPERS_REFERENCE.md     # 22 Paper ilmiah peer-reviewed acuan komparasi OLS vs GWR
├── data/
│   ├── georgia_benchmark.csv              # Dataset benchmark akademik GWR (Fotheringham et al.)
│   ├── urban_infrastructure_potholes.csv  # Data riil Chicago 311 Road Distress & Potholes
│   └── raw/
├── results/
│   ├── summary.json        # Ringkasan seluruh metrik komparasi untuk publikasi/laporan
│   ├── spatial_points.json # Data titik spasial GeoJSON untuk peta Leaflet
│   ├── models.joblib       # Model OLS & GWR terlatih untuk inferensi cepat
│   └── comparison_table.tex# Tabel LaTeX siap pakai untuk skripsi/paper
├── templates/
│   ├── base.html           # Layout dasar & integrasi Leaflet.js
│   ├── index.html          # Peta spasial interaktif & form estimasi lokal
│   └── results.html        # Dashboard komparasi lengkap & tabel 22 paper acuan
├── static/
│   ├── style.css           # Desain modern, responsif, & estetika khas CivicScan
│   └── app.js              # Klien interaktif Leaflet map, layer switcher, & live predictor
└── tests/
    ├── test_spatial_engine.py  # Unit test matematis OLS, GWR, Moran's I, ANOVA
    └── test_api.py             # Integration test REST API Flask
```

---

## 🚀 1. Instalasi Dependensi

Pastikan menggunakan Python 3.10 atau lebih baru:

```bash
pip install -r requirements.txt
```

---

## 📊 2. Dataset Riil yang Disertakan

Sistem dilengkapi dua dataset riil siap pakai:
1. **Georgia Socio-Economic & Civic Infrastructure Benchmark (Default)**:
   - Sumber: US Census Bureau / Prof. Stewart Fotheringham (pencipta GWR).
   - 159 observasi wilayah, koordinat UTM ($X, Y$), target capaian publik, prediktor kemiskinan dan demografi.
2. **City of Chicago 311 Road Potholes Open Data**:
   - Sumber: Chicago Data Portal (Department of Transportation / CDOT).
   - Data riil aduan lubang jalan dan perbaikan jalan per wilayah komunitas.

---

## ⚙️ 3. Menjalankan Pipeline dari Terminal

### Audit Data & Uji Multikolinieritas VIF:
```bash
python pipeline.py audit
```

### Melatih Model Biasa & Model GWR:
```bash
python pipeline.py run
```
*(Bisa juga menggunakan flag dataset: `python pipeline.py run --dataset data/urban_infrastructure_potholes.csv`)*

### Menampilkan Tabel Ringkasan Komparasi:
```bash
python pipeline.py compare
```

---

## 🌐 4. Menjalankan Web Dashboard & Peta Interaktif

```bash
python app.py
```

Buka peramban Anda di: **http://127.0.0.1:5000**
- `/` : Studio Peta Spasial (klik titik mana saja untuk inspeksi parameter lokal $\beta(u,v)$ dan simulasi prediksi).
- `/results` : Dashboard komparasi metrik lengkap, ANOVA F-test, Moran's I residual, ekspor tabel LaTeX, dan daftar 22 paper acuan.

---

## 🧪 5. Menjalankan Automated Tests

```bash
python -m unittest discover tests
```

---

## 📚 6. Literatur Acuan

Kajian komparasi ini didasarkan pada 22 publikasi peer-reviewed internasional (Elsevier, Wiley, Springer, ASCE). Daftar lengkap beserta DOI dan temuan empiris dapat dilihat pada [PAPERS_REFERENCE.md](PAPERS_REFERENCE.md) atau langsung pada menu **/results** di aplikasi web.
