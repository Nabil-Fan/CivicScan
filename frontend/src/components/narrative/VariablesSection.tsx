import React from 'react';

export const VariablesSection: React.FC = () => {
  return (
    <section id="konteks-masalah" className="section" style={{ background: '#faf8f5', borderTop: '1px solid rgba(0,0,0,0.06)', borderBottom: '1px solid rgba(0,0,0,0.06)', textAlign: 'center' }}>
      <div className="container">
        <div style={{ maxWidth: '820px', marginInline: 'auto', textAlign: 'center' }}>
          <span className="badge badge-secondary">Konteks Nyata Masalah Publik</span>
          <h2 className="h-md mt-xs">Apa Sebenarnya yang Sedang Dianalisis di Sini?</h2>
          <p className="lead" style={{ margin: '12px auto 0', maxWidth: '68ch', fontSize: '15px', lineHeight: 1.65, color: '#333' }}>
            Bukan angka acak atau simulasi fiktif. Data ini adalah <strong>Dataset Benchmark Resmi Ekonometrika Spasial Georgia</strong> (Prof. Stewart Fotheringham, perintis GWR). Kita menganalisis <strong>jurang ketimpangan lulusan sarjana (S1)</strong> di 159 kabupaten negara bagian Georgia, Amerika Serikat.
          </p>
        </div>

        {/* Bento Grid Kamus Variabel */}
        <div className="grid-4 mt" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '18px', textAlign: 'left' }}>
          <div className="card" style={{ borderTop: '4px solid var(--gold)', background: 'var(--white)' }}>
            <div className="label-sm" style={{ color: 'var(--gold)', fontWeight: 700 }}>VARIABEL TARGET (Y)</div>
            <h3 className="h-xs mt-xs">Persentase Lulusan Sarjana (S1)</h3>
            <p className="hint" style={{ fontFamily: 'monospace', fontSize: '11px', marginTop: '2px' }}>Kolom: PctBach</p>
            <p style={{ fontSize: '13px', lineHeight: 1.5, marginTop: '8px' }}>
              Persentase warga dewasa berusia 25+ yang berhasil menyelesaikan pendidikan tinggi (S1). Kisarannya ekstrem: dari <strong>4.2% di pelosok</strong> hingga <strong>37.5% di pusat kota/kampus</strong>.
            </p>
          </div>

          <div className="card" style={{ borderTop: '4px solid var(--indigo)', background: 'var(--white)' }}>
            <div className="label-sm" style={{ color: 'var(--indigo)', fontWeight: 700 }}>FAKTOR PENYEBAB 1 (X₁)</div>
            <h3 className="h-xs mt-xs">Tingkat Kemiskinan Keluarga</h3>
            <p className="hint" style={{ fontFamily: 'monospace', fontSize: '11px', marginTop: '2px' }}>Kolom: PctPov</p>
            <p style={{ fontSize: '13px', lineHeight: 1.5, marginTop: '8px' }}>
              Persentase keluarga yang hidup di bawah garis kemiskinan federal. Menguji seberapa kuat faktor kemiskinan mematikan kesempatan warga untuk kuliah.
            </p>
          </div>

          <div className="card" style={{ borderTop: '4px solid var(--teal)', background: 'var(--white)' }}>
            <div className="label-sm" style={{ color: 'var(--teal)', fontWeight: 700 }}>FAKTOR PENYEBAB 2 (X₂)</div>
            <h3 className="h-xs mt-xs">Komposisi Penduduk Minoritas</h3>
            <p className="hint" style={{ fontFamily: 'monospace', fontSize: '11px', marginTop: '2px' }}>Kolom: PctBlack</p>
            <p style={{ fontSize: '13px', lineHeight: 1.5, marginTop: '8px' }}>
              Persentase populasi ras Afrika-Amerika di setiap kabupaten. Mencerminkan warisan disparitas sosioekonomi historis di wilayah selatan AS.
            </p>
          </div>

          <div className="card" style={{ borderTop: '4px solid var(--clay)', background: 'var(--white)' }}>
            <div className="label-sm" style={{ color: 'var(--clay)', fontWeight: 700 }}>FAKTOR PENYEBAB 3 (X₃)</div>
            <h3 className="h-xs mt-xs">Karakter Pedesaan / Pelosok</h3>
            <p className="hint" style={{ fontFamily: 'monospace', fontSize: '11px', marginTop: '2px' }}>Kolom: PctRural</p>
            <p style={{ fontSize: '13px', lineHeight: 1.5, marginTop: '8px' }}>
              Tingkat isolasi geografis wilayah pedesaan vs metropolitan. Mengukur seberapa jauh warga terisolasi dari pusat institusi dan kampus perguruan tinggi.
            </p>
          </div>
        </div>

        {/* Pertanyaan Riset Utama */}
        <div className="notice mt" style={{ background: '#fffdf9', borderLeft: '5px solid var(--gold)', padding: '18px 24px', borderRadius: '8px', textAlign: 'left' }}>
          <strong style={{ color: 'var(--indigo)', fontSize: '15px' }}>Pertanyaan Inti yang Dijawab:</strong>
          <p style={{ fontSize: '14px', marginTop: '6px', lineHeight: 1.6, color: '#333' }}>
            <em>&quot;Apakah dampak kemiskinan terhadap peluang kuliah sama mematikannya di kota metropolitan modern seperti Atlanta dibandingkan di pelosok pedalaman Clinch County?&quot;</em><br />
            <strong>Model Biasa (OLS) menjawab:</strong> Ya, sama rata di seluruh wilayah.<br />
            <strong>Model GWR & Kenyataan Lapangan membuktikan:</strong> Sangat berbeda! Di kota besar, kemiskinan tidak mematikan kuliah karena beasiswa dan kampus dekat. Di pelosok, kemiskinan membuat kuliah mustahil terjangkau.
          </p>
        </div>
      </div>
    </section>
  );
};
