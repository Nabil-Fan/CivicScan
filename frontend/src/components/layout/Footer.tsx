import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="footer">
      <svg className="sprig sprig-footer" aria-hidden="true">
        <use href="#sprig" />
      </svg>
      <div className="container footer-in">
        <div>
          <p className="brand brand-light">CivicScan</p>
          <p className="footer-text">
            Studi Komparasi Pengaruh Heterogenitas Spasial: Model Biasa (OLS) vs. Geographically
            Weighted Regression (GWR) pada Studi Disparitas Pendidikan & Kemiskinan Publik.
          </p>
        </div>
        <div className="footer-text">
          <p>
            Pustaka Analisis: PySal (MGWR, SpReg, ESDA) & Statsmodels. 100% Offline & Open-Source,
            tanpa API Key eksternal.
          </p>
          <p>Modern React 19 + TypeScript SPA Client.</p>
        </div>
      </div>
    </footer>
  );
};
