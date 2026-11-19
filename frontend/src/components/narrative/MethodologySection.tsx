import React from 'react';
import { Award, AlertTriangle } from 'lucide-react';

export const MethodologySection: React.FC = () => {
  return (
    <>
      {/* BABAK 4: Mengapa Wajib Menjalankan OLS Dulu Baru GWR? */}
      <section id="alur-diagnostik" className="section" style={{ background: '#faf8f5', borderTop: '1px solid rgba(0,0,0,0.06)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        <div className="container">
          <div style={{ maxWidth: '820px', marginInline: 'auto', textAlign: 'center' }}>
            <span className="badge badge-secondary">Metodologi Ilmiah & Alur Kerja</span>
            <h2 className="h-md mt-xs">Mengapa Kita Tidak Langsung Pakai GWR? Kenapa OLS Tetap Wajib?</h2>
            <p className="lead" style={{ marginTop: '8px' }}>
              Dalam kaidah ekonometrika ilmiah, GWR <strong>tidak boleh langsung dipakai tanpa OLS</strong>. OLS adalah fondasi diagnostik mutlak melalui 4 alasan:
            </p>
          </div>

          <div className="grid-2 mt" style={{ gap: '20px' }}>
            <div className="card" style={{ background: 'var(--white)' }}>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--indigo)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>1</div>
                <div>
                  <h3 className="h-xs" style={{ color: 'var(--indigo)', marginBottom: '4px' }}>Uji Diagnostik Moran&apos;s I Terhadap Residual OLS</h3>
                  <p style={{ fontSize: '13px', lineHeight: 1.5, color: '#444' }}>
                    Kita harus melatih OLS terlebih dahulu untuk memeriksa apakah residualnya (selisih tebakan) menyebar acak atau mengelompok. Jika residual OLS mengelompok secara spasial (Moran&apos;s I p &lt; 0.05), barulah kita memiliki <strong>legalitas ilmiah</strong> untuk menggunakan GWR.
                  </p>
                </div>
              </div>
            </div>

            <div className="card" style={{ background: 'var(--white)' }}>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--indigo)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>2</div>
                <div>
                  <h3 className="h-xs" style={{ color: 'var(--indigo)', marginBottom: '4px' }}>Titik Tolak Pembanding (Benchmark Baseline)</h3>
                  <p style={{ fontSize: '13px', lineHeight: 1.5, color: '#444' }}>
                    Bagaimana kita bisa menyatakan model GWR lebih unggul jika kita tidak punya standar pembanding? OLS bertindak sebagai garis dasar (*ground baseline*) untuk mengukur berapa persen lonjakan akurasi (R²) dan berapa poin penurunan AICc yang berhasil dicapai.
                  </p>
                </div>
              </div>
            </div>

            <div className="card" style={{ background: 'var(--white)' }}>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--indigo)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>3</div>
                <div>
                  <h3 className="h-xs" style={{ color: 'var(--indigo)', marginBottom: '4px' }}>Prinsip Parsimoni (Occam&apos;s Razor)</h3>
                  <p style={{ fontSize: '13px', lineHeight: 1.5, color: '#444' }}>
                    Hukum ilmiah menyatakan: <em>&quot;Jika model yang sederhana sudah cukup menjelaskan realitas, jangan gunakan model yang rumit.&quot;</em> Jika residual OLS sudah acak bersih, memakai GWR adalah kesalahan fatal (*overfitting*). GWR hanya sah dipakai jika OLS terbukti gagal.
                  </p>
                </div>
              </div>
            </div>

            <div className="card" style={{ background: 'var(--white)' }}>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--indigo)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>4</div>
                <div>
                  <h3 className="h-xs" style={{ color: 'var(--indigo)', marginBottom: '4px' }}>Identifikasi Bukti Non-Stasioneritas Nyata</h3>
                  <p style={{ fontSize: '13px', lineHeight: 1.5, color: '#444' }}>
                    Membandingkan koefisien tunggal global OLS dengan rentang sebaran koefisien lokal GWR membuktikan secara visual kepada pengambil kebijakan bahwa disparitas antarwilayah benar-benar nyata terjadi di lapangan.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BABAK 5: Di Mana GWR Menang & Kapan GWR Gagal (Batasan Ilmiah) */}
      <section className="section" style={{ background: 'var(--white)' }}>
        <div className="container">
          <div className="grid-2" style={{ gap: '28px' }}>
            {/* Kolom Kiri: Di Mana GWR Menang */}
            <div className="card" style={{ border: '2px solid #c2e0c6', background: '#fbfdfb' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Award size={26} color="#1b5e20" />
                <div>
                  <h3 className="h-sm" style={{ color: '#1b5e20' }}>Di Mana GWR Menang?</h3>
                  <p className="script" style={{ color: '#2e7d32' }}>tiga keunggulan mutlak model lokal</p>
                </div>
              </div>

              <div className="mt-sm" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ background: 'white', padding: '14px', borderRadius: '8px', border: '1px solid #e1efe3' }}>
                  <strong style={{ color: '#1a5323', fontSize: '14px' }}>1. Akurasi Tebakan Lebih Tinggi (R² Melonjak)</strong>
                  <p style={{ fontSize: '13px', lineHeight: 1.5, marginTop: '4px', color: '#333' }}>
                    R² naik signifikan dari 0.485 (OLS) ke 0.589 (GWR). Variasi faktor sosioekonomi lokal mampu menjelaskan hampir 60% disparitas pendidikan sarjana.
                  </p>
                </div>

                <div style={{ background: 'white', padding: '14px', borderRadius: '8px', border: '1px solid #e1efe3' }}>
                  <strong style={{ color: '#1a5323', fontSize: '14px' }}>2. Penalti Kompleksitas Lebih Efisien (ΔAICc = -9.97)</strong>
                  <p style={{ fontSize: '13px', lineHeight: 1.5, marginTop: '4px', color: '#333' }}>
                    AICc turun signifikan dari 906.32 ke 896.35. Dalam teori seleksi model (Burnham &amp; Anderson), penurunan mendekati 10 poin adalah bukti kuat bahwa model lokal jauh lebih baik dan tidak overfitting.
                  </p>
                </div>

                <div style={{ background: 'white', padding: '14px', borderRadius: '8px', border: '1px solid #e1efe3' }}>
                  <strong style={{ color: '#1a5323', fontSize: '14px' }}>3. Cacat Autokorelasi Terobati (Moran&apos;s I Lenyap)</strong>
                  <p style={{ fontSize: '13px', lineHeight: 1.5, marginTop: '4px', color: '#333' }}>
                    Residual OLS memiliki pola mengelompok (bias ruang p = 0.009). GWR berhasil mengubah residual menjadi acak bersih (Moran&apos;s I = 0.0113, p = 0.327), memenuhi asumsi independensi Gauss-Markov.
                  </p>
                </div>
              </div>
            </div>

            {/* Kolom Kanan: Kapan GWR Gagal (Batasan & Risiko) */}
            <div className="card" style={{ border: '2px solid #ebd4cb', background: '#fffcfb' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertTriangle size={26} color="#8a1f11" />
                <div>
                  <h3 className="h-sm" style={{ color: '#8a1f11' }}>Kapan GWR Gagal? (Batasan Model)</h3>
                  <p className="script" style={{ color: '#c0392b' }}>empat batasan teknis yang wajib diwaspadai</p>
                </div>
              </div>

              <div className="mt-sm" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ background: 'white', padding: '14px', borderRadius: '8px', border: '1px solid #fae5df' }}>
                  <strong style={{ color: '#8a1f11', fontSize: '14px' }}>1. Multikolinearitas Lokal (Local Collinearity)</strong>
                  <p style={{ fontSize: '13px', lineHeight: 1.5, marginTop: '4px', color: '#333' }}>
                    Meskipun variabel bebas aman secara global, di radius lokal sempit dua variabel bisa tiba-tiba berkorelasi tinggi. Hal ini dapat membuat variansi koefisien lokal membengkak (*inflated standard errors*).
                  </p>
                </div>

                <div style={{ background: 'white', padding: '14px', borderRadius: '8px', border: '1px solid #fae5df' }}>
                  <strong style={{ color: '#8a1f11', fontSize: '14px' }}>2. Efek Batas Wilayah (Edge / Boundary Effects)</strong>
                  <p style={{ fontSize: '13px', lineHeight: 1.5, marginTop: '4px', color: '#333' }}>
                    Kabupaten yang terletak di tepi negara bagian (misal pesisir laut Atlantik atau perbatasan Florida) hanya memiliki tetangga di satu sisi. Akibatnya estimasi lokal di tepian cenderung memiliki variansi lebih tinggi.
                  </p>
                </div>

                <div style={{ background: 'white', padding: '14px', borderRadius: '8px', border: '1px solid #fae5df' }}>
                  <strong style={{ color: '#8a1f11', fontSize: '14px' }}>3. Beban Komputasi Berat (O(n³))</strong>
                  <p style={{ fontSize: '13px', lineHeight: 1.5, marginTop: '4px', color: '#333' }}>
                    GWR harus membalik matriks pembobot (Xᵀ Wᵢ X)⁻¹ sebanyak N kali pada setiap iterasi bandwidth. Untuk jutaan titik data mikro, kalkulasi GWR membutuhkan waktu sangat lama tanpa akselerasi khusus.
                  </p>
                </div>

                <div style={{ background: 'white', padding: '14px', borderRadius: '8px', border: '1px solid #fae5df' }}>
                  <strong style={{ color: '#8a1f11', fontSize: '14px' }}>4. Tidak Bisa Ekstrapolasi ke Luar Wilayah</strong>
                  <p style={{ fontSize: '13px', lineHeight: 1.5, marginTop: '4px', color: '#333' }}>
                    Model GWR terlatih di Georgia <strong>tidak bisa digunakan untuk memprediksi daerah di negara bagian lain</strong> (seperti Alabama atau New York) karena bobot spasialnya terikat mutlak pada koordinat lokal.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};
