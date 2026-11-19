import { SpatialPoint } from '../types/spatial';
import { StatusResponse, ResultsData, ScientificPaper } from '../types/summary';

export async function fetchStatus(): Promise<StatusResponse> {
  const res = await fetch('/api/status');
  if (!res.ok) throw new Error('Gagal mengambil status API');
  return res.json();
}

export async function fetchSpatialPoints(): Promise<SpatialPoint[]> {
  const res = await fetch('/api/spatial-points');
  if (!res.ok) throw new Error('Gagal mengambil titik spasial');
  return res.json();
}

export async function fetchResults(): Promise<ResultsData> {
  const res = await fetch('/api/results');
  if (!res.ok) throw new Error('Gagal mengambil data hasil ekonometrika');
  return res.json();
}

export async function fetchPapers(): Promise<ScientificPaper[]> {
  const res = await fetch('/api/papers');
  if (!res.ok) throw new Error('Gagal mengambil data paper ilmiah acuan');
  const data = await res.json();
  return data.papers || [];
}
