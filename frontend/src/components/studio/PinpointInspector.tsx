import React from 'react';
import { SpatialPoint } from '../../types/spatial';
import { f1, f2, f3, f4 } from '../../utils/formatters';
import { generatePinpointDiagnosis, GLOBAL_OLS_BETAS } from '../../utils/diagnosisEngine';

interface PinpointInspectorProps {
  point: SpatialPoint | null;
  allPoints: SpatialPoint[];
  onSelectCountyName: (name: string) => void;
}

export const PinpointInspector: React.FC<PinpointInspectorProps> = ({
  point,
  allPoints,
  onSelectCountyName,
}) => {
  if (!point) {
    return (
      <div className="card inspector-card" style={{ padding: '22px' }}>
        <p className="hint">Pilih titik kabupaten pada peta untuk melihat evaluasi model.</p>
      </div>
    );
  }

  const diag = generatePinpointDiagnosis(point);

  const rawErrOls = point.observed - point.pred_ols;
  const signOls = rawErrOls >= 0 ? '+' : '';

  const rawErrGwr = point.observed - point.pred_gwr;
  const signGwr = rawErrGwr >= 0 ? '+' : '';

  let sublabel = `Kabupaten ke-${point.id}`;
  if (point.name.includes('Fulton')) sublabel = 'Pusat Bisnis Atlanta';
  else if (point.name.includes('Clarke')) sublabel = 'Kota Universitas Athens';
  else if (point.name.includes('Whitfield')) sublabel = 'Sentra Industri Dalton';
  else if (point.name.includes('Clinch')) sublabel = 'Pelosok Pedalaman Selatan';

  const rVal = point.features?.PctRural ?? 0;
  const rNote = rVal >= 75 ? '(Pelosok)' : rVal < 20 ? '(Urban)' : '(Transisi)';

  const r2Val = point.local_r2 ?? 0;
  const r2Note = r2Val >= 0.7 ? '(Sangat Tinggi)' : r2Val >= 0.5 ? '(Tinggi)' : '(Sedang)';

  const sortedPoints = [...allPoints].sort((a, b) => a.name.localeCompare(b.name));

  const betaVars = [
    { key: 'Intercept', label: 'Intersep Dasar (Konstanta)' },
    { key: 'PctPov', label: 'Tingkat Kemiskinan (PctPov)' },
    { key: 'PctBlack', label: 'Penduduk Minoritas (PctBlack)' },
    { key: 'PctRural', label: 'Karakter Pedesaan (PctRural)' },
  ];

  return (
    <div
      className="card inspector-card"
      style={{
        boxShadow: 'var(--shadow-card)',
        padding: '22px',
        borderRadius: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        maxHeight: '660px',
        overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <span className="badge badge-primary">Inspeksi Data Sensus Riil</span>
          <h3 className="h-xs mt-xs" style={{ fontSize: '18px', color: 'var(--indigo)', marginBottom: '2px' }}>
            {point.name} <small style={{ fontSize: '12px', fontWeight: 'normal', color: '#666' }}>({sublabel})</small>
          </h3>
          <p className="hint" style={{ fontSize: '12px', margin: 0 }}>
            Koordinat: ({point.lat.toFixed(3)}, {point.lon.toFixed(3)}) &bull; 159 Kabupaten Georgia
          </p>
        </div>
        <span className={`badge ${diag.badgeClass}`} style={{ fontSize: '11px', padding: '6px 12px', fontWeight: 700 }}>
          {diag.badgeText}
        </span>
      </div>

      {/* 3 Pilar Skor Head-to-Head */}
      <div className="stats-mini" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
        <div style={{ background: '#f4f6fa', borderTop: '3px solid var(--indigo)', padding: '10px 8px', borderRadius: '6px' }}>
          <span className="stat-num-sm" style={{ color: 'var(--indigo)' }}>
            {f2(point.observed)}%
          </span>
          <small style={{ color: '#444', fontWeight: 700 }}>Sensus Riil (Y)</small>
        </div>
        <div style={{ background: '#fff8f6', borderTop: '3px solid var(--clay)', padding: '10px 8px', borderRadius: '6px' }}>
          <span className="stat-num-sm" style={{ color: 'var(--clay)' }}>
            {f2(point.pred_ols)}%
          </span>
          <small style={{ color: diag.winner === 'ols' ? '#1e40af' : '#c0392b', fontWeight: 700 }}>
            Error: {signOls}
            {f2(rawErrOls)}%
          </small>
        </div>
        <div style={{ background: '#fcfbf5', borderTop: '3px solid var(--gold)', padding: '10px 8px', borderRadius: '6px' }}>
          <span className="stat-num-sm text-gold">
            {f2(point.pred_gwr)}%
          </span>
          <small style={{ color: diag.winner === 'gwr' ? '#166534' : '#b45309', fontWeight: 700 }}>
            Error: {signGwr}
            {f2(rawErrGwr)}%
          </small>
        </div>
      </div>

      {/* Kotak Diagnostik Mengapa Model Unggul di Titik Ini */}
      <div
        className="notice"
        style={{
          margin: 0,
          background: '#fffcf7',
          borderLeft: '4px solid var(--gold)',
          padding: '14px 16px',
          fontSize: '13px',
          lineHeight: 1.6,
        }}
      >
        <div style={{ fontWeight: 700, color: 'var(--indigo)', fontSize: '13.5px', marginBottom: '5px' }}>
          {diag.headline}
        </div>
        <div style={{ fontSize: '12.5px', lineHeight: 1.6, color: '#222' }}>
          {diag.reason}
        </div>
        <div
          style={{
            fontSize: '11.5px',
            color: '#666',
            borderTop: '1px dashed rgba(0,0,0,0.12)',
            paddingTop: '6px',
            marginTop: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '4px',
          }}
        >
          <span>Error OLS: <b>±{f2(diag.errOls)}%</b></span>
          <span>Error GWR: <b>±{f2(diag.errGwr)}%</b></span>
          <span>Akurasi Wilayah (R²): <b>{f3(point.local_r2)}</b></span>
        </div>
      </div>

      {/* Profil Sosioekonomi Kabupaten Riil */}
      <div style={{ background: '#fcfcfc', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '8px', padding: '12px 14px' }}>
        <h4 className="label-sm" style={{ color: 'var(--indigo)', marginBottom: '8px' }}>
          Karakteristik Sosioekonomi Lapangan:
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px', fontSize: '12px' }}>
          <div>
            <span className="hint" style={{ display: 'block', fontSize: '11px', marginTop: 0 }}>Kemiskinan Keluarga:</span>
            <strong>{f1(point.features?.PctPov)}%</strong>
          </div>
          <div>
            <span className="hint" style={{ display: 'block', fontSize: '11px', marginTop: 0 }}>Populasi Minoritas:</span>
            <strong>{f1(point.features?.PctBlack)}%</strong>
          </div>
          <div>
            <span className="hint" style={{ display: 'block', fontSize: '11px', marginTop: 0 }}>Karakter Pedesaan:</span>
            <strong>{f1(rVal)}% {rNote}</strong>
          </div>
          <div>
            <span className="hint" style={{ display: 'block', fontSize: '11px', marginTop: 0 }}>Akurasi Wilayah (R²):</span>
            <strong className="text-gold">{f3(r2Val)} {r2Note}</strong>
          </div>
        </div>
      </div>

      {/* Dropdown Pintas 159 Kabupaten */}
      <div>
        <label htmlFor="quick-county-select" className="label-sm">
          Cari dari 159 Kabupaten:
        </label>
        <select
          id="quick-county-select"
          className="input-field"
          style={{ cursor: 'pointer', fontSize: '13px' }}
          value={point.name}
          onChange={(e) => onSelectCountyName(e.target.value)}
        >
          {sortedPoints.map((pt) => {
            const ptDiag = generatePinpointDiagnosis(pt);
            const winTag = ptDiag.winner === 'gwr' ? '[GWR]' : ptDiag.winner === 'ols' ? '[OLS]' : '[Netral]';
            return (
              <option key={pt.id} value={pt.name}>
                {pt.name} — Riil {f1(pt.observed)}% {winTag}
              </option>
            );
          })}
        </select>
      </div>

      {/* Detail Koefisien Matematika Lokal */}
      <details style={{ background: '#faf8f5', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '6px', padding: '8px 12px', fontSize: '12px' }}>
        <summary style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--indigo)', fontSize: '11px', textTransform: 'uppercase' }}>
          Rincian Koefisien Lokal βₖ(u,v) vs Global OLS
        </summary>
        <div className="scroll-x mt-xs">
          <table className="tbl tbl-compact" style={{ fontSize: '12px', background: 'white' }}>
            <thead>
              <tr>
                <th>Faktor</th>
                <th>Global OLS (β)</th>
                <th>Lokal GWR (β(u,v))</th>
              </tr>
            </thead>
            <tbody>
              {betaVars.map((v) => {
                const bGlobal = GLOBAL_OLS_BETAS[v.key as keyof typeof GLOBAL_OLS_BETAS] ?? 0;
                const bLocal = point.local_betas ? (point.local_betas[v.key] ?? bGlobal) : bGlobal;
                const diffB = bLocal - bGlobal;
                const isDiff = Math.abs(diffB) > 0.02;

                return (
                  <tr key={v.key}>
                    <td><strong>{v.label}</strong></td>
                    <td>{f4(bGlobal)}</td>
                    <td className={isDiff ? 'text-gold font-bold' : ''}>
                      <strong>{f4(bLocal)}</strong>
                      {isDiff && (
                        <small style={{ fontSize: '10px', marginLeft: '6px', color: diffB > 0 ? '#166534' : '#c0392b' }}>
                          ({diffB > 0 ? '+' : ''}{f3(diffB)})
                        </small>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
};
