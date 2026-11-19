import { SpatialPoint, PinpointDiagnosis } from '../types/spatial';
import { f1, f2, f3, f4 } from './formatters';

export const GLOBAL_OLS_BETAS = {
  Intercept: 23.8546,
  PctPov: -0.3458,
  PctBlack: 0.0583,
  PctRural: -0.1114,
};

export function generatePinpointDiagnosis(p: SpatialPoint): PinpointDiagnosis {
  const errOls = Math.abs(p.observed - p.pred_ols);
  const errGwr = Math.abs(p.observed - p.pred_gwr);
  const diff = errOls - errGwr; // positive: GWR has smaller error (more accurate)
  const pctGain = errOls > 0.01 ? Math.max(0, ((errOls - errGwr) / errOls) * 100) : 0;
  const pctOlsGain = errGwr > 0.01 ? Math.max(0, ((errGwr - errOls) / errGwr) * 100) : 0;

  const rural = p.features?.PctRural ?? 0;
  const localR2 = p.local_r2 ?? 0;

  const bRuralLocal = p.local_betas?.PctRural ?? GLOBAL_OLS_BETAS.PctRural;
  const bIntLocal = p.local_betas?.Intercept ?? GLOBAL_OLS_BETAS.Intercept;

  let winner: 'gwr' | 'ols' | 'tie' = 'tie';
  let badgeClass = 'badge-winner-tie';
  let badgeText = `Model Berimbang (Selisih ±${f2(Math.abs(diff))}%)`;
  let headline = '';
  let reason = '';

  if (diff > 0.25) {
    winner = 'gwr';
    badgeClass = 'badge-winner-gwr';
    badgeText = `GWR Lebih Presisi (+${f1(pctGain)}%)`;

    if (p.name.includes('Fulton') || p.name.includes('Atlanta') || (rural < 10 && p.observed > 25)) {
      headline = 'Kawasan Aglomerasi Metropolitan & Pasar Kerja Inovasi';
      reason = `GWR unggul mutlak karena menangkap efek aglomerasi perkotaan. Model OLS meratakan rumus ke seluruh negara bagian sehingga salah tebak sebesar ${f2(errOls)}%. GWR secara adaptif meningkatkan Intersep lokal menjadi ${f2(bIntLocal)} (vs OLS 23.85), mengkompensasi tingginya daya tarik lapangan kerja sarjana dan konsentrasi perguruan tinggi di Atlanta.`;
    } else if (p.name.includes('Clarke') || p.name.includes('Athens') || p.observed > 30) {
      headline = 'Kawasan Kampus Universitas (Konsentrasi Intelektual)';
      reason = `GWR unggul telak karena menangkap keberadaan University of Georgia. OLS memproyeksikan angka sarjana rendah akibat kemiskinan semu kalangan mahasiswa, sedangkan GWR membaca densitas spasial sarjana lokal yang sesungguhnya sehingga selisih galat terpangkas menjadi ±${f2(errGwr)}% saja.`;
    } else if (p.name.includes('Whitfield') || (rural < 30 && p.observed < 12)) {
      headline = 'Sentra Industri Manufaktur & Tenaga Kerja Pabrik';
      reason = `GWR unggul karena membaca karakter ekonomi manufaktur lokal (industri karpet). OLS salah mengira kawasan urban otomatis didominasi sarjana, sedangkan GWR menyesuaikan bobot lokal dengan realitas tingginya penyerapan lulusan vokasi/SMA di sektor pabrik.`;
    } else if (rural > 80) {
      headline = 'Wilayah Pedesaan / Pelosok Terisolasi (Hambatan Geografis)';
      reason = `GWR unggul karena memperhitungkan jarak spasial terhadap perguruan tinggi di pelosok. Koefisien lokal pedesaan bergeser menjadi ${f4(bRuralLocal)}, mengeliminasi galat OLS yang terlalu optimis menyamaratakan akses pendidikan pedalaman dengan perkotaan.`;
    } else {
      headline = 'Keunggulan Variasi Spasial Lokal (Non-Stasioneritas Nyata)';
      reason = `GWR lebih akurat karena elastisitas kemiskinan dan demografi di kabupaten ini berbeda secara signifikan dari rata-rata negara bagian. Pembobotan spasial tetangga terdekat berhasil memangkas error OLS sebesar ${f1(pctGain)}% (Akurasi lokal R² = ${f3(localR2)}).`;
    }
  } else if (diff < -0.25) {
    winner = 'ols';
    badgeClass = 'badge-winner-ols';
    badgeText = `OLS Lebih Presisi (+${f2(Math.abs(diff))}%)`;
    headline = 'Wilayah Karakter Rata-Rata (Sesuai Tren Garis Makro Global)';
    reason = `Model Biasa (OLS) lebih unggul di titik ini karena kombinasi sosioekonomi kabupaten ini berada tepat di garis tren rata-rata seluruh negara bagian (mendekati nilai tengah X̄, Ȳ). Pada kondisi di mana hubungan variabel bersifat homogen dan stasioner, regresi global OLS meminimalkan kuadrat galat secara optimal tanpa terdistorsi oleh variansi lokal tetangga terdekat.`;
  } else {
    winner = 'tie';
    badgeClass = 'badge-winner-tie';
    badgeText = `Model Berimbang (Selisih ±${f2(Math.abs(diff))}%)`;
    headline = 'Karakteristik Spasial Bersifat Stasioner / Netral';
    reason = `Kedua model menghasilkan akurasi yang sebanding (selisih galat ≤ 0.25%) karena parameter lokal GWR di titik ini hampir identik dengan garis lurus OLS global. Tidak terdapat anomali geografis ekstrem yang membuat model lokal menyimpang dari tren makro.`;
  }

  return {
    winner,
    badgeClass,
    badgeText,
    headline,
    reason,
    errOls,
    errGwr,
    pctGain,
    pctOlsGain,
  };
}
