export const f1 = (v: number | null | undefined): string =>
  v == null || isNaN(v) ? '–' : Number(v).toFixed(1);

export const f2 = (v: number | null | undefined): string =>
  v == null || isNaN(v) ? '–' : Number(v).toFixed(2);

export const f3 = (v: number | null | undefined): string =>
  v == null || isNaN(v) ? '–' : Number(v).toFixed(3);

export const f4 = (v: number | null | undefined): string =>
  v == null || isNaN(v) ? '–' : Number(v).toFixed(4);

export function getColor(val: number, min: number, max: number): string {
  if (min === max) return '#234386';
  const t = Math.max(0, Math.min(1, (val - min) / (max - min)));
  // Spectral gradient: blue (0) -> yellow (0.5) -> red (1)
  if (t < 0.25) return '#4575b4';
  if (t < 0.5) return '#91bfdb';
  if (t < 0.7) return '#fee090';
  if (t < 0.85) return '#fc8d59';
  return '#d73027';
}
