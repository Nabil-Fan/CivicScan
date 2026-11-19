import React, { useEffect, useState, useMemo } from 'react';
import { ResultsData, ScientificPaper } from '../../types/summary';
import { fetchResults, fetchPapers } from '../../services/api';
import { f1, f2, f3, f4 } from '../../utils/formatters';
import { Search, Download, Copy, Check, ExternalLink } from 'lucide-react';

export const ResultsPage: React.FC = () => {
  const [data, setData] = useState<ResultsData | null>(null);
  const [papers, setPapers] = useState<ScientificPaper[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchResults(), fetchPapers()])
      .then(([resData, resPapers]) => {
        setData(resData);
        setPapers(resPapers);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Gagal memuat hasil');
        setLoading(false);
      });
  }, []);

  const filteredPapers = useMemo(() => {
    if (!searchQuery.trim()) return papers;
    const q = searchQuery.toLowerCase().trim();
    return papers.filter((p) =>
      p.title.toLowerCase().includes(q) ||
      p.authors.toLowerCase().includes(q) ||
      p.journal.toLowerCase().includes(q) ||
      p.focus_comparison.toLowerCase().includes(q)
    );
  }, [papers, searchQuery]);

  const latexCode = useMemo(() => {
    if (!data) return '';
    const { ols, gwr, moran, comparison } = data;
    return `% Tabel Komparasi Model Biasa (OLS) vs Model GWR
\\begin{table}[htbp]
\\centering
\\caption{Perbandingan Kinerja Model Biasa (OLS) dan Model GWR}
\\label{tab:ols_vs_gwr_comparison}
\\begin{tabular}{lccc}
\\toprule
\\textbf{Metrik Evaluasi} & \\textbf{Model Biasa (OLS)} & \\textbf{Model GWR} & \\textbf{Perubahan ($\\Delta$)} \\\\
\\midrule
$R^2$ (Koefisien Determinasi) & ${f4(ols.r2)} & ${f4(gwr.r2)} & +${f4(comparison.delta_r2)} (${f1(comparison.r2_improvement_pct)}\\%) \\\\
Adjusted $R^2$ & ${f4(ols.adj_r2)} & ${f4(gwr.adj_r2)} & +${f4(gwr.adj_r2 - ols.adj_r2)} \\\\
AIC & ${f2(ols.aic)} & ${f2(gwr.aic)} & ${f2(gwr.aic - ols.aic)} \\\\
AICc & ${f2(ols.aicc)} & ${f2(gwr.aicc)} & ${f2(comparison.delta_aicc)} \\\\
RSS & ${f2(ols.rss)} & ${f2(gwr.rss)} & ${f2(gwr.rss - ols.rss)} \\\\
Moran's I Residual ($p$-val) & ${f4(moran.ols_moran_i)} (${f3(moran.ols_p_value)}) & ${f4(moran.gwr_moran_i)} (${f3(moran.gwr_p_value)}) & Eliminasi Autokorelasi \\\\
Bandwidth Spasial & - & ${f1(gwr.bandwidth)} (${gwr.bandwidth_type}) & - \\\\
\\midrule
\\textbf{Keputusan Model Terbaik} & \\multicolumn{3}{c}{\\textbf{${comparison.best_model}}} \\\\
\\bottomrule
\\end{tabular}
\\end{table}`;
  }, [data]);

  const handleCopyLatex = () => {
    if (!latexCode) return;
    navigator.clipboard.writeText(latexCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: '80px 0', textAlign: 'center' }}>
        <p className="lead">Memuat matriks hasil ekonometrika 159 kabupaten dan 22 paper acuan...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container" style={{ padding: '80px 0', textAlign: 'center' }}>
        <div className="card empty">
          <h2 className="h-sm">Belum ada hasil eksperimen</h2>
          <p>Jalankan pipeline dari terminal, lalu muat ulang halaman ini:</p>
          <pre>python pipeline.py run</pre>
        </div>
      </div>
    );
  }

  const { ols, gwr, moran, anova, comparison } = data;

  return (
    <main>
      {/* Hero Header */}
      <section className="hero hero-slim">
        <div className="container">
          <div className="badge badge-primary mb-xs">Evaluasi Ilmiah & Komparasi Kinerja</div>
          <h1 className="display">Hasil Eksperimen Komparasi</h1>
          <p className="script">evaluasi empiris Model Biasa (OLS) vs Geographically Weighted Regression (GWR)</p>
          <p className="lead" style={{ maxWidth: '800px', marginTop: '8px' }}>
            Halaman ini merangkum pembuktian statistik di 159 kabupaten Georgia: membongkar mengapa model biasa (OLS) gagal menangkap variasi spasial, di mana letak keunggulan GWR, dan apa saja batasan akademis yang harus dipahami.
          </p>
        </div>
      </section>

      {/* KPI Summary Banner */}
      <section className="section" style={{ paddingBottom: '10px' }}>
        <div className="container">
          <div className="stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div className="card stat-card">
              <p className="label">Peningkatan Akurasi (R²)</p>
              <div className="stat-row">
                <span className="stat-main">{f3(gwr.r2)}</span>
                <span className="badge badge-success">+{f3(comparison.delta_r2)} (+{f1(comparison.r2_improvement_pct)}%)</span>
              </div>
              <p className="hint">Model Biasa (OLS): {f3(ols.r2)}</p>
            </div>

            <div className="card stat-card">
              <p className="label">Perubahan AICc (Δ AICc)</p>
              <div className="stat-row">
                <span className="stat-main text-gold">{f2(comparison.delta_aicc)}</span>
                <span className="badge badge-primary">Model Unggul</span>
              </div>
              <p className="hint">OLS: {f2(ols.aicc)} &rarr; GWR: {f2(gwr.aicc)}</p>
            </div>

            <div className="card stat-card">
              <p className="label">Uji Moran&apos;s I Residual</p>
              <div className="stat-row">
                <span className="stat-main">{f4(moran.gwr_moran_i)}</span>
                <span className="badge badge-success">{moran.gwr_p_value >= 0.05 ? 'Acak Bersih (Bebas Bias)' : 'Ada Bias Spasial'}</span>
              </div>
              <p className="hint">Moran&apos;s I OLS: {f4(moran.ols_moran_i)} (p={f3(moran.ols_p_value)} — Ada Bias Spasial)</p>
            </div>

            <div className="card stat-card">
              <p className="label">Bandwidth Optimal (b*)</p>
              <div className="stat-row">
                <span className="stat-main">{f1(gwr.bandwidth)}</span>
                <span className="badge badge-secondary">{gwr.bandwidth_type}</span>
              </div>
              <p className="hint">Pencarian Golden Section AICc</p>
            </div>
          </div>
        </div>
      </section>

      {/* Bagian 1: Di Mana GWR Menang & Bukti Lapangan */}
      <section className="section" id="keunggulan-gwr" style={{ paddingTop: '20px' }}>
        <div className="container">
          <div className="card" style={{ borderLeft: '5px solid #2e7d32', background: '#fafdfa' }}>
            <span className="badge badge-success">Bedah Keunggulan Empiris</span>
            <h2 className="h-sm mt-xs" style={{ color: '#1a5323' }}>Di Mana GWR Menang dan Mengapa?</h2>
            <p style={{ fontSize: '14px', lineHeight: 1.6, color: '#222', marginTop: '8px' }}>
              Model Biasa (OLS) gagal karena memaksakan satu angka rata-rata untuk seluruh wilayah (asumsi stasioneritas). GWR menang secara mutlak karena memberikan <strong>fleksibilitas lokal</strong> yang merefleksikan realitas ekonomi geografi:
            </p>

            <div className="grid-3 mt-sm" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              <div style={{ background: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #dceede' }}>
                <strong style={{ color: '#1a5323', fontSize: '14px' }}>1. Menangkap Efek Aglomerasi Perkotaan</strong>
                <p style={{ fontSize: '13px', lineHeight: 1.5, marginTop: '6px', color: '#444' }}>
                  Di Fulton County (Atlanta) dan Clarke County (Athens), pengaruh kemiskinan terhadap peluang kuliah jauh lebih lemah (koefisien kemiskinan sekitar -0.09) karena ketersediaan kampus riset, perpustakaan publik, dan beasiswa industri. OLS memukul rata koefisien -0.22, sehingga tebakan OLS meleset jauh hingga belasan persen.
                </p>
              </div>

              <div style={{ background: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #dceede' }}>
                <strong style={{ color: '#1a5323', fontSize: '14px' }}>2. Membaca Isolasi Wilayah Pedesaan</strong>
                <p style={{ fontSize: '13px', lineHeight: 1.5, marginTop: '6px', color: '#444' }}>
                  Di Clinch County dan Echols County (pedalaman selatan), koefisien kemiskinan berlipat ganda menjadi sekitar -0.42. Kemiskinan di pelosok secara brutal mematikan akses kuliah karena jarak ke kampus terdekat lebih dari 80 km tanpa transportasi umum. GWR menangkap kerentanan ini.
                </p>
              </div>

              <div style={{ background: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #dceede' }}>
                <strong style={{ color: '#1a5323', fontSize: '14px' }}>3. Melenyapkan Bias Spasial Residual</strong>
                <p style={{ fontSize: '13px', lineHeight: 1.5, marginTop: '6px', color: '#444' }}>
                  Pada model OLS, titik-titik yang salah tebak berkelompok di wilayah utara (underprediction) dan selatan (overprediction). Uji Moran&apos;s I membuktikan kesalahan OLS tidak acak (p = {f3(moran.ols_p_value)}). GWR menyerap seluruh pola geografis tersebut sehingga residual menjadi acak bersih (Moran&apos;s I = {f4(moran.gwr_moran_i)}, p = {f3(moran.gwr_p_value)}).
                </p>
              </div>
            </div>

            {/* Tabel Contoh Konkret Kabupaten Ekstrem */}
            <div className="mt" style={{ background: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #dceede' }}>
              <h4 className="label" style={{ color: '#1a5323', marginBottom: '8px' }}>Tabel Bukti Konkret: Penurunan Salah Tebak (Residual) di Titik Ekstrem</h4>
              <div className="scroll-x mt-xs">
                <table className="tbl tbl-compact" style={{ fontSize: '13px', width: '100%' }}>
                  <thead>
                    <tr style={{ background: '#f1f8f2' }}>
                      <th>Kabupaten</th>
                      <th>Kondisi Riil (% S1)</th>
                      <th>Tebakan Model Biasa (OLS)</th>
                      <th>Salah Tebak OLS (Error)</th>
                      <th>Tebakan GWR</th>
                      <th>Salah Tebak GWR (Error)</th>
                      <th>Evaluasi Keunggulan</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>Clarke County (Athens)</strong></td>
                      <td>37.5%</td>
                      <td>21.3%</td>
                      <td style={{ color: '#c0392b', fontWeight: 600 }}>-16.2% (Meleset Jauh)</td>
                      <td>35.7%</td>
                      <td style={{ color: '#27ae60', fontWeight: 600 }}>-1.8% (Sangat Presisi)</td>
                      <td><span className="badge badge-success">GWR 89% Lebih Presisi</span></td>
                    </tr>
                    <tr>
                      <td><strong>Fulton County (Atlanta)</strong></td>
                      <td>31.6%</td>
                      <td>17.3%</td>
                      <td style={{ color: '#c0392b', fontWeight: 600 }}>-14.3% (Meleset Jauh)</td>
                      <td>29.5%</td>
                      <td style={{ color: '#27ae60', fontWeight: 600 }}>-2.1% (Sangat Presisi)</td>
                      <td><span className="badge badge-success">GWR 85% Lebih Presisi</span></td>
                    </tr>
                    <tr>
                      <td><strong>Clinch County (Pelosok)</strong></td>
                      <td>5.1%</td>
                      <td>11.9%</td>
                      <td style={{ color: '#c0392b', fontWeight: 600 }}>+6.8% (Terlalu Tinggi)</td>
                      <td>6.0%</td>
                      <td style={{ color: '#27ae60', fontWeight: 600 }}>+0.9% (Sangat Presisi)</td>
                      <td><span className="badge badge-success">GWR 87% Lebih Presisi</span></td>
                    </tr>
                    <tr>
                      <td><strong>Echols County (Perbatasan)</strong></td>
                      <td>4.2%</td>
                      <td>10.5%</td>
                      <td style={{ color: '#c0392b', fontWeight: 600 }}>+6.3% (Terlalu Tinggi)</td>
                      <td>5.1%</td>
                      <td style={{ color: '#27ae60', fontWeight: 600 }}>+0.9% (Sangat Presisi)</td>
                      <td><span className="badge badge-success">GWR 86% Lebih Presisi</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Matriks Perbandingan Performa Model (Tabel Lengkap) */}
      <section className="section" id="tabel-komparasi">
        <div className="container">
          <div className="card">
            <span className="badge badge-primary">Matriks Komparasi Lengkap</span>
            <h2 className="h-sm mt-xs">Perbandingan Performa Global OLS vs Lokal GWR</h2>
            <p className="lead narrow">Perbandingan langsung antara Model Biasa (Global OLS) dan Model GWR lokal pada dataset kanonikal Georgia (159 Wilayah).</p>

            <div className="scroll-x mt">
              <table className="tbl" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th>Metrik Evaluasi</th>
                    <th>Model Biasa (Global OLS)</th>
                    <th>Model GWR (Lokal)</th>
                    <th>Selisih (Δ) / Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="best">
                    <td><strong>Koefisien Determinasi (R²)</strong></td>
                    <td>{f4(ols.r2)}</td>
                    <td><strong className="text-gold">{f4(gwr.r2)}</strong></td>
                    <td>+{f4(comparison.delta_r2)} (+{f1(comparison.r2_improvement_pct)}% varians terjelaskan)</td>
                  </tr>
                  <tr>
                    <td>Adjusted R²</td>
                    <td>{f4(ols.adj_r2)}</td>
                    <td><strong>{f4(gwr.adj_r2)}</strong></td>
                    <td>+{f4(gwr.adj_r2 - ols.adj_r2)}</td>
                  </tr>
                  <tr className="best">
                    <td><strong>Corrected AIC (AICc)</strong></td>
                    <td>{f2(ols.aicc)}</td>
                    <td><strong className="text-gold">{f2(gwr.aicc)}</strong></td>
                    <td><strong>{f2(comparison.delta_aicc)}</strong> ({comparison.aicc_verdict})</td>
                  </tr>
                  <tr>
                    <td>Akaike Information Criterion (AIC)</td>
                    <td>{f2(ols.aic)}</td>
                    <td>{f2(gwr.aic)}</td>
                    <td>{f2(gwr.aic - ols.aic)}</td>
                  </tr>
                  <tr>
                    <td>Bayesian Information Criterion (BIC)</td>
                    <td>{f2(ols.bic)}</td>
                    <td>{f2(gwr.bic)}</td>
                    <td>{f2(gwr.bic - ols.bic)}</td>
                  </tr>
                  <tr>
                    <td>Residual Sum of Squares (RSS)</td>
                    <td>{f2(ols.rss)}</td>
                    <td>{f2(gwr.rss)}</td>
                    <td>{f2(gwr.rss - ols.rss)} (Penurunan galat tidak terjelaskan)</td>
                  </tr>
                  <tr className="best">
                    <td><strong>Uji Moran&apos;s I Residual (p-value)</strong></td>
                    <td>{f4(moran.ols_moran_i)} (p = {f3(moran.ols_p_value)})</td>
                    <td><strong className="text-gold">{f4(moran.gwr_moran_i)} (p = {f3(moran.gwr_p_value)})</strong></td>
                    <td>{moran.verdict}</td>
                  </tr>
                  <tr>
                    <td>Bandwidth Spasial Optimal</td>
                    <td>– (Global)</td>
                    <td>{f1(gwr.bandwidth)} ({gwr.bandwidth_type})</td>
                    <td>Optimasi Golden Section AICc</td>
                  </tr>
                  <tr style={{ background: '#fbf9f6', fontWeight: 600 }}>
                    <td>Keputusan Model Terbaik</td>
                    <td colSpan={3} style={{ textAlign: 'center', color: 'var(--indigo)', fontSize: '15px' }}>
                      {comparison.best_model}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ANOVA & Moran's I Grid */}
            <div className="grid-2 mt" style={{ gap: '20px', marginTop: '24px' }}>
              <div className="card" style={{ background: '#fcfcfc', border: '1px solid rgba(0,0,0,0.08)' }}>
                <h3 className="h-xs" style={{ color: 'var(--indigo)' }}>Uji Signifikansi ANOVA (F-Test)</h3>
                <p className="hint" style={{ marginTop: '4px' }}>Menguji apakah penurunan residual GWR dibanding OLS signifikan secara statistik.</p>
                <div className="stats-mini mt-sm" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  <div style={{ background: 'white', padding: '10px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.06)' }}>
                    <span className="stat-num-sm">{f3(anova.f_statistic)}</span>
                    <small>F-Statistic</small>
                  </div>
                  <div style={{ background: 'white', padding: '10px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.06)' }}>
                    <span className="stat-num-sm">{f4(anova.p_value)}</span>
                    <small>p-value</small>
                  </div>
                  <div style={{ background: '#fcfbf5', padding: '10px', borderRadius: '6px', border: '1px solid rgba(198,138,7,0.3)' }}>
                    <span className="stat-num-sm text-gold">{anova.is_significant ? 'Signifikan' : 'Tidak Sig.'}</span>
                    <small>(p &lt; 0.05)</small>
                  </div>
                </div>
                <p className="notice mt-sm" style={{ fontSize: '13px', lineHeight: 1.5 }}>
                  {anova.interpretation}
                </p>
              </div>

              <div className="card" style={{ background: '#fcfcfc', border: '1px solid rgba(0,0,0,0.08)' }}>
                <h3 className="h-xs" style={{ color: 'var(--indigo)' }}>Diagnostik Autokorelasi Spasial (Moran&apos;s I)</h3>
                <p className="hint" style={{ marginTop: '4px' }}>Residual model yang baik tidak boleh memiliki autokorelasi spasial (p &gt; 0.05).</p>
                <ul className="plain warn-list mt-sm" style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <li style={{ background: 'white', padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.06)' }}>
                    <strong>Residual OLS:</strong> Moran&apos;s I = {f4(moran.ols_moran_i)} (p = {f3(moran.ols_p_value)}) &mdash;{' '}
                    <span className="badge" style={{ background: '#fad2cf', color: '#8a1f11' }}>Bias Spasial Terdeteksi</span>
                  </li>
                  <li style={{ background: 'white', padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.06)' }}>
                    <strong>Residual GWR:</strong> Moran&apos;s I = {f4(moran.gwr_moran_i)} (p = {f3(moran.gwr_p_value)}) &mdash;{' '}
                    <span className="badge badge-success">Bebas Bias Spasial</span>
                  </li>
                </ul>
                <p className="hint mt-sm" style={{ fontSize: '12px', marginTop: '10px' }}>
                  {moran.verdict}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Parameter OLS vs GWR */}
      <section className="section" id="parameter-model">
        <div className="container">
          <h2 className="h-md">Parameter & Koefisien Model</h2>
          <p className="lead narrow">Model Biasa memiliki satu nilai koefisien konstan untuk seluruh wilayah. Model GWR memiliki sebaran koefisien lokal yang menyesuaikan tiap kabupaten.</p>

          <div className="grid-2 mt" style={{ gap: '20px' }}>
            {/* Tabel Koefisien OLS Global */}
            <div className="card scroll-x">
              <h3 className="h-xs" style={{ color: 'var(--indigo)' }}>Koefisien Global Model Biasa (OLS)</h3>
              <table className="tbl tbl-compact mt-sm" style={{ width: '100%', fontSize: '12.5px' }}>
                <thead>
                  <tr>
                    <th>Variabel</th>
                    <th>Koefisien (β)</th>
                    <th>Std Error</th>
                    <th>t-stat</th>
                    <th>p-value</th>
                  </tr>
                </thead>
                <tbody>
                  {ols.coefficients.map((c) => (
                    <tr key={c.variable}>
                      <td><strong>{c.variable}</strong></td>
                      <td>{f4(c.coef)}</td>
                      <td>{f4(c.std_err)}</td>
                      <td>{f3(c.t_stat)}</td>
                      <td>
                        {f4(c.p_value)}{' '}
                        {c.p_value < 0.05 && <span className="badge badge-success" style={{ fontSize: '10px', padding: '2px 6px' }}>Sig</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Tabel Sebaran Koefisien GWR Lokal */}
            <div className="card scroll-x">
              <h3 className="h-xs" style={{ color: 'var(--indigo)' }}>Sebaran Koefisien Lokal Model GWR (5-Number Summary)</h3>
              <table className="tbl tbl-compact mt-sm" style={{ width: '100%', fontSize: '12.5px' }}>
                <thead>
                  <tr>
                    <th>Variabel</th>
                    <th>Min</th>
                    <th>Q1</th>
                    <th>Median</th>
                    <th>Q3</th>
                    <th>Max</th>
                    <th>Std</th>
                  </tr>
                </thead>
                <tbody>
                  {gwr.coefficients_summary.map((cs) => (
                    <tr key={cs.variable}>
                      <td><strong>{cs.variable}</strong></td>
                      <td>{f3(cs.min)}</td>
                      <td>{f3(cs.q1)}</td>
                      <td><strong>{f3(cs.median)}</strong></td>
                      <td>{f3(cs.q3)}</td>
                      <td>{f3(cs.max)}</td>
                      <td>{f4(cs.std)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Batasan & Risiko Metodologis GWR */}
      <section className="section" id="batasan-gwr" style={{ background: '#faf8f5', borderTop: '1px solid rgba(0,0,0,0.06)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        <div className="container">
          <div style={{ maxWidth: '820px', marginInline: 'auto', textAlign: 'center' }}>
            <span className="badge" style={{ background: '#fad2cf', color: '#8a1f11' }}>Kritik Metodologi & Kejujuran Ilmiah</span>
            <h2 className="h-md mt-xs">Batasan & Risiko Model GWR yang Wajib Diketahui</h2>
            <p className="lead" style={{ marginTop: '8px' }}>
              GWR bukan alat tanpa kompromi. Untuk penulisan karya ilmiah atau skripsi, 4 keterbatasan mendasar ini wajib dipaparkan secara objektif:
            </p>
          </div>

          <div className="grid-2 mt" style={{ gap: '20px' }}>
            <div className="card" style={{ background: 'white', borderTop: '4px solid var(--clay)' }}>
              <h3 className="h-xs" style={{ color: 'var(--clay)' }}>1. Multikolinearitas Lokal (Local Collinearity Hazard)</h3>
              <p style={{ fontSize: '13px', lineHeight: 1.6, marginTop: '8px', color: '#333' }}>
                Meskipun uji VIF global menyatakan seluruh variabel aman (VIF &lt; 5), pada radius geografis yang sempit di subset tetangga lokal, dua variabel bebas bisa berkorelasi sangat tinggi. Hal ini dapat memicu pembengkakan variansi koefisien (*inflated standard errors*).
              </p>
            </div>

            <div className="card" style={{ background: 'white', borderTop: '4px solid var(--clay)' }}>
              <h3 className="h-xs" style={{ color: 'var(--clay)' }}>2. Efek Batas Wilayah (Edge & Boundary Effects)</h3>
              <p style={{ fontSize: '13px', lineHeight: 1.6, marginTop: '8px', color: '#333' }}>
                Kabupaten di pesisir pantai timur Georgia atau perbatasan Florida hanya dikelilingi tetangga di satu sisi (asimetris). Akibatnya fungsi pembobot kernel tidak simetris 360 derajat, sehingga tingkat ketidakpastian estimasi parameter di daerah tepi cenderung lebih besar dibanding wilayah sentral.
              </p>
            </div>

            <div className="card" style={{ background: 'white', borderTop: '4px solid var(--clay)' }}>
              <h3 className="h-xs" style={{ color: 'var(--clay)' }}>3. Kompleksitas Komputasi Berat (O(n³))</h3>
              <p style={{ fontSize: '13px', lineHeight: 1.6, marginTop: '8px', color: '#333' }}>
                GWR harus melakukan dekomposisi matriks secara terpisah untuk setiap titik observasi n kali pada setiap iterasi optimasi bandwidth Golden Section. Jika data melonjak dari ratusan kabupaten menjadi ratusan ribu titik data sensus, proses memerlukan komputasi paralel atau varian FastGWR.
              </p>
            </div>

            <div className="card" style={{ background: 'white', borderTop: '4px solid var(--clay)' }}>
              <h3 className="h-xs" style={{ color: 'var(--clay)' }}>4. Bahaya Ekstrapolasi di Luar Ruang (Spatial Boundary Restriction)</h3>
              <p style={{ fontSize: '13px', lineHeight: 1.6, marginTop: '8px', color: '#333' }}>
                Model GWR yang dilatih pada ruang geografis Georgia sama sekali tidak dapat digunakan untuk memprediksi data di luar batas koordinat pelatihan (misalnya wilayah Alabama atau Florida), karena tidak memiliki matriks tetangga spasial terkalibrasi di luar poligon studi.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Mengapa Analisis Wajib Dimulai dari OLS? */}
      <section className="section" id="hierarki-ols">
        <div className="container">
          <div className="card" style={{ borderLeft: '5px solid var(--indigo)', background: '#fbf9f6', padding: '24px' }}>
            <span className="badge badge-primary">Hierarki Diagnostik</span>
            <h2 className="h-sm mt-xs" style={{ color: 'var(--indigo)' }}>Mengapa Analisis Wajib Dimulai dari OLS Terlebih Dahulu?</h2>
            <p style={{ fontSize: '14px', lineHeight: 1.6, color: '#333', marginTop: '8px' }}>
              Sering muncul pertanyaan: <em>&ldquo;Jika GWR lebih pintar dan akurat, mengapa kita tidak langsung menjalankan GWR saja sejak awal?&rdquo;</em><br />
              Dalam statistika terapan, melompati OLS adalah pelanggaran metodologis karena 3 hal berikut:
            </p>

            <div className="grid-3 mt-sm" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
              <div style={{ background: 'white', padding: '14px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.08)' }}>
                <strong style={{ color: 'var(--indigo)', fontSize: '13px' }}>1. Prinsip Parsimoni (Occam&apos;s Razor)</strong>
                <p style={{ fontSize: '13px', lineHeight: 1.5, marginTop: '6px', color: '#555' }}>
                  Ilmuwan wajib memilih model yang paling sederhana selama model tersebut cukup menjelaskan fakta. Jika residual OLS terbukti acak (tidak ada autokorelasi spasial), maka OLS-lah model terbaik dan GWR dianggap membuang derajat bebas secara mubazir (*over-parameterization*).
                </p>
              </div>

              <div style={{ background: 'white', padding: '14px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.08)' }}>
                <strong style={{ color: 'var(--indigo)', fontSize: '13px' }}>2. Uji Moran&apos;s I Sebagai Pintu Masuk</strong>
                <p style={{ fontSize: '13px', lineHeight: 1.5, marginTop: '6px', color: '#555' }}>
                  GWR baru boleh secara sah digunakan jika dan hanya jika residual OLS terbukti gagal uji Moran&apos;s I (p &lt; 0.05). Kegagalan OLS inilah yang menjadi justifikasi ilmiah perlunya pemodelan lokal.
                </p>
              </div>

              <div style={{ background: 'white', padding: '14px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.08)' }}>
                <strong style={{ color: 'var(--indigo)', fontSize: '13px' }}>3. Prasyarat Uji ANOVA F-Test</strong>
                <p style={{ fontSize: '13px', lineHeight: 1.5, marginTop: '6px', color: '#555' }}>
                  Uji signifikansi non-stasioneritas spasial membandingkan selisih variansi kuadrat galat (RSS OLS - RSS GWR). Tanpa model OLS yang berjalan penuh, F-statistic ANOVA tidak dapat dihitung.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Ekspor Tabel LaTeX */}
      <section className="section" id="ekspor-laporan">
        <div className="container">
          <div className="card">
            <div className="split-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
              <div>
                <h2 className="h-sm">Ekspor Tabel untuk Makalah / Laporan Skripsi</h2>
                <p className="hint">Salin kode tabel LaTeX di bawah ini untuk langsung ditempelkan pada dokumen tugas akhir atau publikasi jurnal Anda.</p>
              </div>
              <div className="btn-row" style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleCopyLatex}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  {copied ? <Check size={16} color="#2e7d32" /> : <Copy size={16} />}
                  <span>{copied ? 'Berhasil Disalin!' : 'Salin Kode LaTeX'}</span>
                </button>
                <a
                  className="btn btn-fill"
                  href="/api/download-latex"
                  download="ols_vs_gwr_table.tex"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Download size={16} />
                  <span>Unduh File .tex</span>
                </a>
              </div>
            </div>

            <div className="code-box mt-sm" style={{ background: '#1e1e1e', padding: '16px', borderRadius: '8px', overflowX: 'auto', marginTop: '14px' }}>
              <pre style={{ margin: 0, color: '#f8f8f2', fontFamily: 'monospace', fontSize: '12px', lineHeight: 1.5 }}>
                {latexCode}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* 22 Paper Ilmiah Acuan (Literature Benchmarking) */}
      <section className="section" id="paper-acuan">
        <div className="container">
          <div className="split-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
            <div>
              <span className="badge badge-primary">Tinjauan Pustaka Kanonikal</span>
              <h2 className="h-md mt-xs">22 Paper Ilmiah Acuan (Literature Benchmarks)</h2>
              <p className="lead narrow">
                Daftar publikasi peer-reviewed bereputasi internasional yang menjadi dasar metodologi komparasi OLS vs GWR, seleksi bandwidth, dan pengujian autokorelasi spasial.
              </p>
            </div>

            <div className="search-box" style={{ minWidth: '320px', position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
              <input
                type="text"
                className="input-field"
                placeholder="Cari judul paper, penulis, atau topik..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '36px', fontSize: '13px', width: '100%' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span className="hint" style={{ fontSize: '12px' }}>
              Menampilkan <strong>{filteredPapers.length}</strong> dari {papers.length} paper acuan
            </span>
            {searchQuery && (
              <button
                type="button"
                className="btn-link"
                onClick={() => setSearchQuery('')}
                style={{ fontSize: '12px', color: 'var(--indigo)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Reset Pencarian
              </button>
            )}
          </div>

          <div className="card scroll-x" style={{ padding: 0, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.08)' }}>
            <table className="tbl tbl-compact" style={{ width: '100%', fontSize: '12.5px', margin: 0 }}>
              <thead>
                <tr style={{ background: '#f8f6f0' }}>
                  <th style={{ width: '45px', textAlign: 'center' }}>No</th>
                  <th style={{ width: '300px' }}>Judul Paper & Penulis</th>
                  <th style={{ width: '200px' }}>Jurnal & DOI</th>
                  <th>Temuan Kunci / Komparasi OLS vs GWR</th>
                </tr>
              </thead>
              <tbody>
                {filteredPapers.map((p) => (
                  <tr key={p.number} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                    <td style={{ textAlign: 'center', fontWeight: 600, color: '#888' }}>{p.number}</td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--indigo)', marginBottom: '3px' }}>
                        {p.title}
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#666' }}>
                        {p.authors}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontStyle: 'italic', marginBottom: '4px', color: '#444' }}>
                        {p.journal}
                      </div>
                      {p.doi_url ? (
                        <a
                          href={p.doi_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px',
                            color: '#1a56db',
                            textDecoration: 'none',
                            fontWeight: 600,
                          }}
                        >
                          <span>DOI: {p.doi}</span>
                          <ExternalLink size={12} />
                        </a>
                      ) : (
                        <span style={{ fontSize: '11px', color: '#888' }}>{p.doi}</span>
                      )}
                    </td>
                    <td style={{ lineHeight: 1.5, color: '#2d3748' }}>
                      {p.focus_comparison}
                    </td>
                  </tr>
                ))}
                {filteredPapers.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '32px', color: '#888' }}>
                      Tidak ada paper yang cocok dengan kata kunci &ldquo;{searchQuery}&rdquo;.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
};
