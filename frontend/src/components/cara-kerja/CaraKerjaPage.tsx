import React from 'react';

export const CaraKerjaPage: React.FC = () => {
  return (
    <main>
      <section className="hero hero-slim">
        <svg className="blob blob-gold" aria-hidden="true"><use href="#blob" /></svg>
        <svg className="sprig sprig-hero" aria-hidden="true"><use href="#sprig" /></svg>
        <div className="container">
          <div className="badge badge-primary mb-xs">Fondasi Teori & Ekonometrika Spasial</div>
          <h1 className="display">Cara Kerja & Formulasi Matematika</h1>
          <p className="script">dari asumsi klasik OLS hingga pembobotan matriks spasial lokal GWR</p>
          <p className="lead" style={{ maxWidth: '820px', marginTop: '8px' }}>
            Pelajari bagaimana matematika mengubah model yang &quot;buta ruang&quot; menjadi model adaptif yang menghormati geografi nyata, lengkap dengan pembuktian analitis dan analogi dunia nyata.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          {/* Analogi Dunia Nyata */}
          <div className="card">
            <h2 className="h-sm">1. Landasan Filosofis & Analogi Sederhana</h2>
            <p className="lead narrow" style={{ marginTop: '10px' }}>
              Dalam statistika klasik, regresi mengasumsikan bahwa setiap titik data bersifat saling bebas dan seragam (<em>Independent and Identically Distributed / i.i.d</em>). Namun di dunia nyata, asumsi ini melanggar <strong>Hukum Pertama Geografi Waldo Tobler (1970)</strong>:
            </p>
            <blockquote className="notice" style={{ fontSize: '16px', fontStyle: 'italic', borderLeft: '4px solid var(--indigo)', marginTop: '12px' }}>
              &quot;Everything is related to everything else, but near things are more related than distant things.&quot;<br />
              <small style={{ fontStyle: 'normal', fontWeight: 600, color: 'var(--indigo)' }}>&mdash; Prof. Waldo Tobler, 1970</small>
            </blockquote>

            <div className="grid-2 mt" style={{ gap: '20px' }}>
              <div style={{ background: '#fdf7f7', padding: '18px', borderRadius: '8px', borderLeft: '4px solid var(--clay)' }}>
                <strong style={{ color: 'var(--clay)', fontSize: '14px' }}>Analogi Model Biasa (OLS) = Termometer Satu Negara</strong>
                <p style={{ fontSize: '13px', lineHeight: 1.55, marginTop: '6px', color: '#444' }}>
                  Bayangkan sebuah termometer yang mengukur suhu rata-rata seluruh Indonesia sebesar 28°C. Jika termometer ini dipakai untuk memprediksi suhu di Puncak Jaya Papua dan Pantai Kuta Bali, hasilnya akan salah total karena memukul rata keragaman alam hanya dengan satu angka tunggal.
                </p>
              </div>

              <div style={{ background: '#f7fbf8', padding: '18px', borderRadius: '8px', borderLeft: '4px solid #2e7d32' }}>
                <strong style={{ color: '#2e7d32', fontSize: '14px' }}>Analogi Model GWR = Jaringan Sensor Cuaca per Distrik</strong>
                <p style={{ fontSize: '13px', lineHeight: 1.55, marginTop: '6px', color: '#444' }}>
                  GWR menempatkan sensor di setiap kabupaten. Saat menghitung suhu di satu titik, sensor memberi bobot 100% pada pembacaan tetangga terdekatnya, dan secara bertahap mengurangi bobot wilayah yang berada ratusan kilometer jauhnya. Hasilnya: prediksi suhu sangat akurat di pegunungan maupun pantai.
                </p>
              </div>
            </div>
          </div>

          {/* Kamus Simbol */}
          <div className="card mt" style={{ background: '#fbf9f6', borderLeft: '5px solid var(--gold)' }}>
            <h3 className="h-xs" style={{ color: 'var(--indigo)' }}>Kamus Simbol: Menghubungkan Rumus dengan Data Nyata Georgia</h3>
            <p style={{ fontSize: '13px', color: '#444', marginTop: '4px' }}>
              Agar tidak membingungkan, setiap simbol matematika dalam platform ini berkorespondensi langsung dengan data nyata 159 kabupaten:
            </p>
            <div className="scroll-x mt-xs">
              <table className="tbl tbl-compact" style={{ fontSize: '13px', background: 'white' }}>
                <thead>
                  <tr>
                    <th>Simbol Rumus</th>
                    <th>Makna Matematis</th>
                    <th>Artinya di Dataset Georgia</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>yᵢ</strong></td>
                    <td>Variabel Terikat (Target)</td>
                    <td>Persentase penduduk lulusan Sarjana (S1) di kabupaten i (<code>PctBach</code>).</td>
                  </tr>
                  <tr>
                    <td><strong>(uᵢ, vᵢ)</strong></td>
                    <td>Koordinat Spasial Dua Dimensi</td>
                    <td>Titik bujur (Longitude / X) dan lintang (Latitude / Y) pusat kabupaten i.</td>
                  </tr>
                  <tr>
                    <td><strong>xᵢₖ</strong></td>
                    <td>Variabel Bebas ke-k</td>
                    <td>Faktor kemiskinan keluarga (<code>PctPov</code>), minoritas (<code>PctBlack</code>), pedesaan (<code>PctRural</code>).</td>
                  </tr>
                  <tr>
                    <td><strong>W(uᵢ, vᵢ)</strong></td>
                    <td>Matriks Pembobot Spasial</td>
                    <td>Matriks kernel adaptif yang memberi bobot tinggi ke tetangga dekat dan nol ke tetangga jauh.</td>
                  </tr>
                  <tr>
                    <td><strong>βₖ(uᵢ, vᵢ)</strong></td>
                    <td>Koefisien Estimasi Lokal</td>
                    <td>Sensitivitas dampak faktor kemiskinan khusus di sekitar kabupaten (uᵢ, vᵢ).</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Formulasi Matematika */}
          <div className="grid-2 mt" style={{ gap: '20px' }}>
            <div className="card">
              <h3 className="h-xs">2. Model Biasa (Global OLS Regression)</h3>
              <p className="hint">Persamaan linear skalar global:</p>
              <div className="notice" style={{ background: '#fbf9f6', fontSize: '16px', textAlign: 'center', padding: '16px', fontFamily: 'monospace' }}>
                yᵢ = β₀ + ∑ₖ βₖ xᵢₖ + εᵢ
              </div>
              <p style={{ fontSize: '13px', lineHeight: 1.5, marginTop: '8px', color: '#444' }}>
                Parameter β dihitung satu kali untuk seluruh penjuru negeri menggunakan estimasi kuadrat terkecil biasa:
              </p>
              <div style={{ background: '#fff', padding: '10px', borderRadius: '6px', fontFamily: 'monospace', fontSize: '13px', border: '1px solid #ebd4cb', textAlign: 'center', marginTop: '6px' }}>
                β̂_OLS = (Xᵀ X)⁻¹ Xᵀ Y
              </div>
            </div>

            <div className="card">
              <h3 className="h-xs">3. Model Pintar (GWR Regression)</h3>
              <p className="hint">Persamaan linear berbobot spasial lokal:</p>
              <div className="notice" style={{ background: '#fcfbf5', fontSize: '16px', textAlign: 'center', padding: '16px', fontFamily: 'monospace' }}>
                yᵢ = β₀(uᵢ, vᵢ) + ∑ₖ βₖ(uᵢ, vᵢ) xᵢₖ + εᵢ
              </div>
              <p style={{ fontSize: '13px', lineHeight: 1.5, marginTop: '8px', color: '#444' }}>
                Setiap kabupaten memiliki matriks pembobot spasial diagonal W(uᵢ, vᵢ) unik sehingga koefisien lokal dihitung per titik:
              </p>
              <div style={{ background: '#fff', padding: '10px', borderRadius: '6px', fontFamily: 'monospace', fontSize: '13px', border: '1px solid #eedeb5', textAlign: 'center', marginTop: '6px' }}>
                β̂(uᵢ, vᵢ) = [Xᵀ W(uᵢ, vᵢ) X]⁻¹ Xᵀ W(uᵢ, vᵢ) Y
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};
