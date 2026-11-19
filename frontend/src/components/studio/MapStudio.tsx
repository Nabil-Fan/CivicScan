import React, { useState } from 'react';
import { SpatialPoint, LayerType } from '../../types/spatial';
import { LeafletMap } from './LeafletMap';
import { PinpointInspector } from './PinpointInspector';

interface MapStudioProps {
  points: SpatialPoint[];
  selectedPoint: SpatialPoint | null;
  onSelectPoint: (p: SpatialPoint) => void;
}

export const MapStudio: React.FC<MapStudioProps> = ({
  points,
  selectedPoint,
  onSelectPoint,
}) => {
  const [activeLayer, setActiveLayer] = useState<LayerType>('observed');
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lon: number; zoom?: number } | null>(null);

  const handleTour = (countyQuery: string) => {
    const target = points.find((p) => p.name.toLowerCase().includes(countyQuery.toLowerCase()));
    if (target) {
      onSelectPoint(target);
      setFlyTarget({ lat: target.lat, lon: target.lon, zoom: 9 });
    }
  };

  const handleSelectCountyName = (name: string) => {
    const target = points.find((p) => p.name === name);
    if (target) {
      onSelectPoint(target);
      setFlyTarget({ lat: target.lat, lon: target.lon, zoom: 9 });
    }
  };

  return (
    <section id="studio" className="section" style={{ paddingTop: '20px' }}>
      <div className="container">
        {/* BANNER PANDUAN UTAMA */}
        <div className="card mb" style={{ borderLeft: '6px solid var(--gold)', background: '#fffcf4', padding: '22px 24px', boxShadow: 'var(--shadow-card)' }}>
          <div>
            <h3 className="h-xs" style={{ color: 'var(--indigo)', fontSize: '15px', marginBottom: '6px', letterSpacing: '0.05em' }}>
              PANDUAN PEMAHAMAN: APA SEBENARNYA YANG SEDANG DIHITUNG DI PETA INI?
            </h3>
            <p style={{ fontSize: '14px', lineHeight: 1.65, color: '#222', margin: 0 }}>
              <strong>Target yang Dihitung &amp; Ditebak:</strong> Persentase warga dewasa yang <strong>lulus kuliah Sarjana (S1)</strong> di 159 kabupaten negara bagian Georgia.<br />
              <strong>Faktor Penentu:</strong> Model menebak kelulusan kuliah berdasarkan <em>tingkat kemiskinan keluarga</em>, <em>populasi minoritas</em>, dan <em>isolasi pedesaan</em>.<br />
              <strong>Pertarungan Dua Model:</strong>{' '}
              <strong>Model Biasa (OLS)</strong> memukul rata bahwa kemiskinan berdampak sama mematikannya di mana pun.
              <strong>Model GWR</strong> membaca realitas lokal: di kota besar (Atlanta) orang miskin tetap bisa kuliah karena banyak beasiswa &amp; kampus dekat; sebaliknya di pelosok hutan (Clinch) kemiskinan memutus akses kuliah secara total.
            </p>
          </div>
        </div>

        {/* Studio Header & Layer Pills */}
        <div className="studio-header">
          <div>
            <span className="badge badge-primary">Eksplorasi Spasial 159 Kabupaten</span>
            <h2 className="h-md mt-xs">Peta Capaian Kelulusan Sarjana & Error Model</h2>
            <p className="lead narrow">
              Pilih layer pewarnaan untuk melihat data sensus riil, akurasi lokal, atau daerah di mana model biasa salah tebak paling parah.
            </p>
          </div>

          <div className="map-controls">
            <span className="label">Layer Pewarnaan Titik:</span>
            <div className="pill-row" role="radiogroup">
              <button
                type="button"
                className={`pill ${activeLayer === 'observed' ? 'active' : ''}`}
                onClick={() => setActiveLayer('observed')}
              >
                Kondisi Nyata Lapangan
              </button>
              <button
                type="button"
                className={`pill ${activeLayer === 'local_r2' ? 'active' : ''}`}
                onClick={() => setActiveLayer('local_r2')}
              >
                Tingkat Akurasi (Local R²)
              </button>
              <button
                type="button"
                className={`pill ${activeLayer === 'resid_ols' ? 'active' : ''}`}
                onClick={() => setActiveLayer('resid_ols')}
              >
                Salah Tebak Model Biasa
              </button>
              <button
                type="button"
                className={`pill ${activeLayer === 'resid_gwr' ? 'active' : ''}`}
                onClick={() => setActiveLayer('resid_gwr')}
              >
                Salah Tebak Model GWR
              </button>
            </div>
          </div>
        </div>

        {/* Tur Terpandu 4 Wilayah Kunci */}
        <div className="card mt-sm mb" style={{ background: '#fbf9f6', borderLeft: '4px solid var(--indigo)', padding: '18px 20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <strong style={{ color: 'var(--indigo)', fontSize: '14px' }}>Tur Terpandu: Jelajahi 4 Wilayah dengan Karakter Ekstrem</strong>
                <p className="hint" style={{ marginTop: '2px' }}>
                  Pilih salah satu kartu wilayah di bawah untuk memusatkan kamera peta dan menganalisis akurasi model:
                </p>
              </div>
              <span className="badge badge-secondary" style={{ fontSize: '11px' }}>Navigasi Cepat</span>
            </div>

            <div className="btn-row" style={{ marginTop: '6px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => handleTour('Fulton')}
                style={{ borderColor: 'var(--indigo)', color: 'var(--indigo)', fontWeight: 600, textAlign: 'left', padding: '10px 14px', borderRadius: '8px' }}
              >
                <strong>1. Atlanta (Fulton)</strong><br />
                <small style={{ fontSize: '11px', textTransform: 'none', opacity: 0.85 }}>Pusat Bisnis (Riil 31.6% Sarjana)</small>
              </button>

              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => handleTour('Clarke')}
                style={{ borderColor: '#2e7d32', color: '#2e7d32', fontWeight: 600, textAlign: 'left', padding: '10px 14px', borderRadius: '8px' }}
              >
                <strong>2. Athens (Clarke)</strong><br />
                <small style={{ fontSize: '11px', textTransform: 'none', opacity: 0.85 }}>Kota Universitas (Riil 37.5% Sarjana)</small>
              </button>

              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => handleTour('Whitfield')}
                style={{ borderColor: '#d97706', color: '#b45309', fontWeight: 600, textAlign: 'left', padding: '10px 14px', borderRadius: '8px' }}
              >
                <strong>3. Dalton (Whitfield)</strong><br />
                <small style={{ fontSize: '11px', textTransform: 'none', opacity: 0.85 }}>Sentra Pabrik Karpet (Riil 9.6% Sarjana)</small>
              </button>

              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => handleTour('Clinch')}
                style={{ borderColor: 'var(--clay)', color: 'var(--clay)', fontWeight: 600, textAlign: 'left', padding: '10px 14px', borderRadius: '8px' }}
              >
                <strong>4. Clinch County</strong><br />
                <small style={{ fontSize: '11px', textTransform: 'none', opacity: 0.85 }}>Pelosok Pedalaman (Riil 5.1% Sarjana)</small>
              </button>
            </div>
          </div>
        </div>

        {/* Peta + Pinpoint Inspector Grid */}
        <div className="grid-2-asym mt">
          <LeafletMap
            points={points}
            activeLayer={activeLayer}
            selectedPoint={selectedPoint}
            onSelectPoint={onSelectPoint}
            flyTarget={flyTarget}
          />
          <PinpointInspector
            point={selectedPoint}
            allPoints={points}
            onSelectCountyName={handleSelectCountyName}
          />
        </div>
      </div>
    </section>
  );
};
