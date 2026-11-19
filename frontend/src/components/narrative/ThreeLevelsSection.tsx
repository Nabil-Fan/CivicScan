import React from 'react';

export const ThreeLevelsSection: React.FC = () => {
  return (
    <section id="tiga-tingkat" className="section">
      <div className="container">
        <div style={{ textAlign: 'center', maxWidth: '800px', marginInline: 'auto' }}>
          <span className="badge badge-primary">Tiga Tingkat Pemahaman</span>
          <h2 className="h-md mt-xs">Dari Data Lapangan Menuju Model Spasial Pintar</h2>
          <p className="lead" style={{ margin: '12px auto 0', maxWidth: '64ch' }}>
            Lihat bagaimana perbedaan cara kerja antara data riil di lapangan, model biasa yang kaku, dan model GWR yang adaptif secara geografis.
          </p>
        </div>

        <div className="grid-3 mt" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          {/* Tingkat 1: Data Riil */}
          <div className="card" style={{ border: '2px solid rgba(0,0,0,0.08)', position: 'relative' }}>
            <span className="badge badge-secondary" style={{ position: 'absolute', top: '16px', right: '16px' }}>Tahap 1</span>
            <h3 className="h-sm" style={{ color: 'var(--indigo)' }}>Kondisi Nyata Lapangan</h3>
            <p className="script" style={{ fontSize: '14px' }}>Ground Truth Data Riil</p>
            <p style={{ fontSize: '14px', lineHeight: 1.6, marginTop: '12px' }}>
              Fakta empiris dari survei sensus di 159 kabupaten. Menunjukkan ketimpangan ekstrem yang nyata tanpa rekayasa:
            </p>
            <ul className="warn-list mt-sm" style={{ fontSize: '13px' }}>
              <li><strong>Wilayah Kampus (Clarke / Athens):</strong> 37.5% penduduk adalah sarjana.</li>
              <li><strong>Pusat Finansial (Fulton / Atlanta):</strong> 31.6% penduduk adalah sarjana.</li>
              <li><strong>Pelosok Hutan Pinus (Clinch):</strong> Hanya 5.1% penduduk sarjana.</li>
              <li><strong>Perbatasan Selatan (Echols):</strong> Hanya 4.2% penduduk sarjana.</li>
            </ul>
            <div className="notice mt-sm" style={{ padding: '10px', fontSize: '12px', background: '#f4f6fa' }}>
              &bull; Variasi ini memiliki pola spasial jelas: klaster kota berpendidikan tinggi vs klaster pelosok yang tertinggal.
            </div>
          </div>

          {/* Tingkat 2: Model Biasa OLS */}
          <div className="card" style={{ border: '2px solid var(--clay)', position: 'relative', background: '#fffdfb' }}>
            <span className="badge" style={{ position: 'absolute', top: '16px', right: '16px', background: '#fad2cf', color: '#8a1f11' }}>Tahap 2</span>
            <h3 className="h-sm" style={{ color: 'var(--clay)' }}>Model Biasa (OLS)</h3>
            <p className="script" style={{ fontSize: '14px' }}>Ilusi &quot;Satu Rumus Nasional&quot;</p>
            <p style={{ fontSize: '14px', lineHeight: 1.6, marginTop: '12px' }}>
              Regresi linier standar memaksakan satu garis lurus global untuk seluruh penjuru negara bagian:
            </p>
            <div style={{ background: '#fff', padding: '8px 12px', borderRadius: '6px', fontFamily: 'monospace', fontSize: '12px', border: '1px solid #ebd4cb', margin: '8px 0' }}>
              Y = 23.85 - 0.35(Kemiskinan) + 0.06(Minoritas) - 0.11(Desa)
            </div>
            <ul className="warn-list mt-sm" style={{ fontSize: '13px' }}>
              <li><strong>Kelemahan Fatal:</strong> Mengasumsikan pengaruh kemiskinan bernilai tepat -0.35 di semua tempat.</li>
              <li><strong>Salah Tebak di Kota:</strong> Meremehkan Atlanta (tebak 17.3%, riil 31.6% &rarr; <strong>Error -14.3%</strong>).</li>
              <li><strong>Salah Tebak di Pelosok:</strong> Melebih-lebihkan Clinch (tebak 11.9%, riil 5.1% &rarr; <strong>Error +6.8%</strong>).</li>
            </ul>
            <div className="notice mt-sm" style={{ padding: '10px', fontSize: '12px', background: '#fef0ee', color: '#8a1f11' }}>
              &bull; Residual OLS menghasilkan <strong>Moran&apos;s I = 0.1022 (p &lt; 0.05)</strong>, membuktikan model bias spasial!
            </div>
          </div>

          {/* Tingkat 3: Model GWR */}
          <div className="card" style={{ border: '2px solid var(--gold)', position: 'relative', background: '#fcfbf7' }}>
            <span className="badge badge-primary" style={{ position: 'absolute', top: '16px', right: '16px' }}>Tahap 3</span>
            <h3 className="h-sm" style={{ color: 'var(--indigo)' }}>Model Pintar (GWR)</h3>
            <p className="script" style={{ fontSize: '14px' }}>Kamera Zoom Spasial Adaptif</p>
            <p style={{ fontSize: '14px', lineHeight: 1.6, marginTop: '12px' }}>
              GWR menghitung bobot kernel spasial lokal sehingga setiap kabupaten mendapatkan rumus unik β(u, v):
            </p>
            <div style={{ background: '#fff', padding: '8px 12px', borderRadius: '6px', fontFamily: 'monospace', fontSize: '12px', border: '1px solid #eedeb5', margin: '8px 0' }}>
              Y(u, v) = β₀(u, v) + β₁(u, v)&middot;Kemiskinan + ...
            </div>
            <ul className="warn-list mt-sm" style={{ fontSize: '13px' }}>
              <li><strong>Sensitif Geografis:</strong> Koefisien kemiskinan di Atlanta hanya -0.09, sedangkan di selatan melonjak ke -0.42.</li>
              <li><strong>Akurasi Melonjak:</strong> R² naik dari 0.485 &rarr; 0.589 (+21.4% peningkatan performa).</li>
              <li><strong>Bebas Bias:</strong> Moran&apos;s I residual turun ke 0.0113 (p = 0.327), residual bersih menjadi acak sempurna.</li>
            </ul>
            <div className="notice mt-sm" style={{ padding: '10px', fontSize: '12px', background: '#edf7ed', color: '#1e4620' }}>
              &bull; <strong>Δ AICc = -9.97 poin</strong>, bukti statistik mutlak bahwa GWR adalah model yang jauh lebih tepat.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
