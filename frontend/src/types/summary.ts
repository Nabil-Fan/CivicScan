export interface StatusResponse {
  ready: boolean;
  dataset_name: string;
  n_samples: number;
  target: string;
  features: string[];
  delta_aicc: number;
  best_model?: string;
  r2_improvement_pct?: number;
}

export interface ScientificPaper {
  number: number;
  short_author: string;
  title: string;
  authors: string;
  journal: string;
  doi: string;
  doi_url: string;
  focus_comparison: string;
}

export interface OlsCoefficient {
  variable: string;
  coef: number;
  std_err: number;
  t_stat: number;
  p_value: number;
  ci_lower: number;
  ci_upper: number;
}

export interface GwrCoefficientSummary {
  variable: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  std: number;
}

export interface ResultsData {
  meta: {
    dataset_name: string;
    description: string;
    target: string;
    features: string[];
    n_samples: number;
    timestamp: string;
  };
  audit: {
    dataset_name: string;
    observations: number;
    target: string;
    features: string[];
    vif: Record<string, number>;
    vif_status: string;
    coordinates?: {
      x_min: number;
      x_max: number;
      y_min: number;
      y_max: number;
    };
  };
  ols: {
    r2: number;
    adj_r2: number;
    aic: number;
    aicc: number;
    bic: number;
    rss: number;
    f_stat: number;
    f_pvalue: number;
    coefficients: OlsCoefficient[];
  };
  gwr: {
    bandwidth: number;
    bandwidth_type: string;
    kernel: string;
    r2: number;
    adj_r2: number;
    aic: number;
    aicc: number;
    bic: number;
    rss: number;
    coefficients_summary: GwrCoefficientSummary[];
  };
  moran: {
    ols_moran_i: number;
    ols_p_value: number;
    ols_z_score: number;
    ols_spatial_bias: boolean;
    gwr_moran_i: number;
    gwr_p_value: number;
    gwr_z_score: number;
    gwr_spatial_bias: boolean;
    verdict: string;
    k_neighbors: number;
  };
  anova: {
    f_statistic: number;
    p_value: number;
    is_significant: boolean;
    interpretation: string;
    df_numerator?: number;
    df_denominator?: number;
  };
  comparison: {
    best_model: string;
    delta_aicc: number;
    delta_r2: number;
    r2_improvement_pct: number;
    aicc_verdict: string;
  };
}

// Alias for backward compatibility
export type ModelSummary = ResultsData;
