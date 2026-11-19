export interface LocalBetas {
  Intercept: number;
  PctPov: number;
  PctBlack: number;
  PctRural: number;
  [key: string]: number;
}

export interface SpatialFeatures {
  PctPov: number;
  PctBlack: number;
  PctRural: number;
  [key: string]: number;
}

export interface SpatialPoint {
  id: number;
  name: string;
  lat: number;
  lon: number;
  x: number;
  y: number;
  observed: number;
  pred_ols: number;
  pred_gwr: number;
  resid_ols: number;
  resid_gwr: number;
  features: SpatialFeatures;
  local_r2: number;
  local_betas: LocalBetas;
}

export type WinnerState = 'gwr' | 'ols' | 'tie';

export interface PinpointDiagnosis {
  winner: WinnerState;
  badgeClass: string;
  badgeText: string;
  headline: string;
  reason: string;
  errOls: number;
  errGwr: number;
  pctGain: number;
  pctOlsGain: number;
}

export type LayerType = 'observed' | 'local_r2' | 'resid_ols' | 'resid_gwr';
