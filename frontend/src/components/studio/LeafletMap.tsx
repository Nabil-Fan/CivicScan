import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { SpatialPoint, LayerType } from '../../types/spatial';
import { f2, getColor } from '../../utils/formatters';
import { generatePinpointDiagnosis } from '../../utils/diagnosisEngine';

interface LeafletMapProps {
  points: SpatialPoint[];
  activeLayer: LayerType;
  selectedPoint: SpatialPoint | null;
  onSelectPoint: (p: SpatialPoint) => void;
  flyTarget: { lat: number; lon: number; zoom?: number } | null;
}

const LAYER_LABELS: Record<LayerType, string> = {
  observed: 'Kondisi Nyata Lapangan (% Sarjana)',
  local_r2: 'Tingkat Akurasi (Local R²)',
  resid_ols: 'Salah Tebak Model Biasa (Error OLS)',
  resid_gwr: 'Salah Tebak Model GWR (Error GWR)',
};

const LAYER_HINTS: Record<LayerType, string> = {
  observed: 'Merah = % Sarjana tinggi, Biru = % Sarjana rendah',
  local_r2: 'Merah = Akurasi GWR sangat tinggi (R² > 0.7), Biru = Sedang',
  resid_ols: 'Merah = OLS tebak kekecilan (Underpredict), Biru = Tebak kebesaran',
  resid_gwr: 'Warna memudar netral = GWR berhasil menekan salah tebak mendekati 0',
};

export const LeafletMap: React.FC<LeafletMapProps> = ({
  points,
  activeLayer,
  onSelectPoint,
  flyTarget,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const [stats, setStats] = useState({ min: 0, mid: 0, max: 0 });

  // Inisialisasi Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      scrollWheelZoom: true,
      zoomControl: true,
    }).setView([32.5, -83.5], 7);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
      subdomains: ['a', 'b', 'c'],
    }).addTo(map);

    const markersGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = markersGroup;
    mapInstanceRef.current = map;

    // Landmarks
    const landmarks = [
      { name: 'Atlanta', lat: 33.749, lon: -84.388 },
      { name: 'Athens', lat: 33.9519, lon: -83.3576 },
      { name: 'Savannah', lat: 32.0809, lon: -81.0912 },
      { name: 'Macon', lat: 32.8407, lon: -83.6324 },
      { name: 'Augusta', lat: 33.4735, lon: -81.968 },
      { name: 'Dalton', lat: 34.7698, lon: -84.9702 },
    ];

    landmarks.forEach((lm) => {
      L.marker([lm.lat, lm.lon], {
        icon: L.divIcon({
          className: 'map-city-label',
          html: `<span>${lm.name}</span>`,
          iconSize: [80, 20],
          iconAnchor: [40, 24],
        }),
        interactive: false,
      }).addTo(map);
    });

    setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Markers ketika points atau activeLayer berubah
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = markersLayerRef.current;
    if (!map || !layerGroup || !points.length) return;

    layerGroup.clearLayers();

    const values = points.map((p) => Number(p[activeLayer] ?? 0));
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const midVal = (minVal + maxVal) / 2;

    setStats({ min: minVal, mid: midVal, max: maxVal });

    points.forEach((p) => {
      const val = Number(p[activeLayer] ?? 0);
      const color = getColor(val, minVal, maxVal);

      const circle = L.circleMarker([p.lat, p.lon], {
        radius: 7,
        fillColor: color,
        color: '#234386',
        weight: 1.2,
        opacity: 0.9,
        fillOpacity: 0.85,
      });

      const diag = generatePinpointDiagnosis(p);
      const errOls = p.observed != null && p.pred_ols != null ? p.observed - p.pred_ols : null;
      const errGwr = p.observed != null && p.pred_gwr != null ? p.observed - p.pred_gwr : null;

      circle.bindTooltip(
        `<strong>${p.name}</strong><br>
         &bull; Fakta Riil Sensus: <b>${f2(p.observed)}%</b> Sarjana<br>
         &bull; Tebakan OLS: <b>${f2(p.pred_ols)}%</b> ${errOls != null ? `(Err: ${errOls >= 0 ? '+' : ''}${f2(errOls)}%)` : ''}<br>
         &bull; Tebakan GWR: <b style="color:#c97d00;">${f2(p.pred_gwr)}%</b> ${errGwr != null ? `(Err: ${errGwr >= 0 ? '+' : ''}${f2(errGwr)}%)` : ''}<br>
         &bull; Status: <b>${diag.badgeText}</b>`,
        { direction: 'top', offset: [0, -5] }
      );

      circle.on('click', () => {
        onSelectPoint(p);
      });

      layerGroup.addLayer(circle);
    });
  }, [points, activeLayer, onSelectPoint]);

  // Efek Fly Target
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !flyTarget) return;
    map.flyTo([flyTarget.lat, flyTarget.lon], flyTarget.zoom ?? 9, { duration: 1.1 });
  }, [flyTarget]);

  return (
    <div className="card map-card">
      <div
        ref={mapContainerRef}
        id="spatial-map"
        className="map-container"
        style={{ height: '580px', borderRadius: '12px', zIndex: 1 }}
      />
      <div className="map-legend mt-sm" id="map-legend">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="hint">
            Skala Warna Peta: <strong>{LAYER_LABELS[activeLayer]}</strong>
          </span>
          <small className="hint">{LAYER_HINTS[activeLayer]}</small>
        </div>
        <div className="legend-bar mt-xs">
          <span className="legend-grad" />
          <div className="legend-labels">
            <small>Min: {f2(stats.min)}%</small>
            <small>Rerata: {f2(stats.mid)}%</small>
            <small>Max: {f2(stats.max)}%</small>
          </div>
        </div>
      </div>
    </div>
  );
};
