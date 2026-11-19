import React from 'react';

interface HeroCenteredProps {
  nObs: number;
  target: string;
  deltaAicc: number;
  onExploreMap: () => void;
  onLearnVariables: () => void;
  onViewResults: () => void;
}

export const HeroCentered: React.FC<HeroCenteredProps> = ({
  nObs,
  target,
  deltaAicc,
  onExploreMap,
  onLearnVariables,
  onViewResults,
}) => {
  return (
    <section className="hero hero-centered" style={{ textAlign: 'center', padding: '56px 0 44px', position: 'relative' }}>
      <div className="container" style={{ maxWidth: '920px', marginInline: 'auto' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '14px' }}>
          <span className="badge badge-primary" style={{ fontSize: '11px', padding: '5px 14px', letterSpacing: '0.08em', fontWeight: 700 }}>
            STUDI KOMPARASI METODE EKONOMETRIKA SPASIAL
          </span>
        </div>

        <h1
          className="display"
          style={{
            maxWidth: '22ch',
            marginInline: 'auto',
            fontSize: 'clamp(38px, 5.2vw, 64px)',
            lineHeight: 1.05,
            letterSpacing: '0.02em',
          }}
        >
          GWR vs OLS: Pemodelan Regresi Spasial
        </h1>

        <p className="script" style={{ fontSize: 'clamp(20px, 2.3vw, 28px)', lineHeight: 1.3, margin: '8px auto 0', color: 'var(--indigo)' }}>
          Membuktikan Keunggulan Model Spasial Lokal atas Model Klasik Global
        </p>

        <p className="lead" style={{ margin: '16px auto 0', fontSize: '15.5px', lineHeight: 1.65, maxWidth: '64ch', color: '#2d3748' }}>
          Apakah satu rumus linier nasional mampu memotret realitas di semua daerah? Melalui data sensus empiris 159 kabupaten, platform{' '}
          <strong>CivicScan</strong> menguji akurasi <strong>Geographically Weighted Regression (GWR)</strong> melawan{' '}
          <strong>Ordinary Least Squares (OLS)</strong> untuk membuktikan bagaimana pembobotan spasial adaptif mengeliminasi bias autokorelasi (Moran&apos;s I) dan membongkar variasi koefisien lokal di lapangan.
        </p>

        {/* 3 Pilar Statistik Inti (Center Strip) */}
        <div
          className="stats-mini mt-sm"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '14px',
            maxWidth: '580px',
            margin: '24px auto 0',
          }}
        >
          <div style={{ background: 'white', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '8px', padding: '10px 12px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
            <span className="stat-num-sm" style={{ color: 'var(--indigo)', fontSize: '18px' }}>
              {nObs || 159} Wilayah
            </span>
            <small style={{ fontSize: '11px', fontWeight: 600 }}>Data Sensus Riil</small>
          </div>
          <div style={{ background: 'white', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '8px', padding: '10px 12px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
            <span className="stat-num-sm" style={{ color: 'var(--indigo)', fontSize: '18px' }}>
              {target || 'PctBach'}
            </span>
            <small style={{ fontSize: '11px', fontWeight: 600 }}>Target: % Sarjana</small>
          </div>
          <div style={{ background: '#fcfbf5', border: '1px solid rgba(198,138,7,0.3)', borderRadius: '8px', padding: '10px 12px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
            <span className="stat-num-sm text-gold" style={{ fontSize: '18px' }}>
              {deltaAicc ? deltaAicc.toFixed(2) : '-9.97'}
            </span>
            <small style={{ fontSize: '11px', fontWeight: 700, color: '#92400e' }}>Δ AICc (GWR Menang)</small>
          </div>
        </div>

        {/* Tombol Aksi Cepat */}
        <div className="btn-row" style={{ justifyContent: 'center', marginTop: '26px', gap: '14px' }}>
          <button type="button" className="btn btn-fill" onClick={onExploreMap} style={{ padding: '13px 26px', fontWeight: 600, cursor: 'pointer' }}>
            Eksplorasi Peta Interaktif &rarr;
          </button>
          <button type="button" className="btn btn-outline" onClick={onLearnVariables} style={{ padding: '13px 22px', cursor: 'pointer' }}>
            4 Variabel Riset
          </button>
          <button type="button" className="btn btn-outline" onClick={onViewResults} style={{ padding: '13px 22px', cursor: 'pointer' }}>
            Matriks Hasil & Paper
          </button>
        </div>
      </div>
    </section>
  );
};
