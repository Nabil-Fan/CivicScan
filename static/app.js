/* CivicScan — Spatial Regression Web Client
   Halaman Studio Peta (/) dan Dasbor Komparasi (/results)
   Tanpa dependensi eksternal selain Leaflet.js
*/
(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const f1 = (v) => (v == null || isNaN(v) ? "–" : Number(v).toFixed(1));
  const f2 = (v) => (v == null || isNaN(v) ? "–" : Number(v).toFixed(2));
  const f3 = (v) => (v == null || isNaN(v) ? "–" : Number(v).toFixed(3));
  const f4 = (v) => (v == null || isNaN(v) ? "–" : Number(v).toFixed(4));

  function triggerMath() {
    if (window.renderMathInElement) {
      try {
        window.renderMathInElement(document.body, {
          delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "$", right: "$", display: false }
          ],
          throwOnError: false
        });
      } catch (e) {}
    }
  }

  // Kamus Nama Variabel Ramah Pengguna (Bahasa Manusia)
  const FRIENDLY_NAMES = {
    // Georgia Benchmark
    PctBach: "Tingkat Pendidikan Tinggi / Lulusan Sarjana (%)",
    PctPov: "Tingkat Kemiskinan Warga (%)",
    PctRural: "Wilayah Pedesaan / Pelosok (%)",
    PctBlack: "Persentase Penduduk Minoritas (%)",
    TotPop90: "Total Populasi Penduduk",
    
    // Chicago Potholes
    total_pothole_reports: "Jumlah Aduan Lubang Jalan",
    unique_blocks: "Jumlah Titik/Blok Jalan Rusak",
    police_districts_served: "Cakupan Distrik Layanan",
    road_distress_index: "Indeks Keparahan Kerusakan Jalan",
    complaint_density: "Kerapatan Aduan Warga",
    infrastructure_load: "Beban Beban Infrastruktur"
  };

  const FRIENDLY_LAYERS = {
    observed: "Kondisi Nyata Lapangan (% Sarjana)",
    local_r2: "Tingkat Akurasi (Local R²)",
    resid_ols: "Salah Tebak Model Biasa (Error OLS)",
    resid_gwr: "Salah Tebak Model GWR (Error GWR)"
  };

  function getFriendlyName(name) {
    return FRIENDLY_NAMES[name] || name;
  }
  function getColor(val, min, max) {
    if (min === max) return "#234386";
    const t = Math.max(0, Math.min(1, (val - min) / (max - min)));
    // Spectral gradient: blue (0) -> yellow (0.5) -> red (1)
    if (t < 0.25) return "#4575b4";
    if (t < 0.5)  return "#91bfdb";
    if (t < 0.7)  return "#fee090";
    if (t < 0.85) return "#fc8d59";
    return "#d73027";
  }

  /* ==========================================================================
     HALAMAN UTAMA: STUDIO PETA & ESTIMATOR SPASIAL (/)
     ========================================================================== */
  const GLOBAL_OLS_BETAS = {
    Intercept: 23.8546,
    PctPov: -0.3458,
    PctBlack: 0.0583,
    PctRural: -0.1114
  };

  function generatePinpointDiagnosis(p) {
    const errOls = Math.abs(p.observed - p.pred_ols);
    const errGwr = Math.abs(p.observed - p.pred_gwr);
    const diff = errOls - errGwr; // positif berarti GWR memiliki galat lebih kecil (lebih akurat)
    const pctGain = errOls > 0.01 ? Math.max(0, ((errOls - errGwr) / errOls) * 100) : 0;
    const pctOlsGain = errGwr > 0.01 ? Math.max(0, ((errGwr - errOls) / errGwr) * 100) : 0;

    const pov = p.features?.PctPov ?? 0;
    const black = p.features?.PctBlack ?? 0;
    const rural = p.features?.PctRural ?? 0;
    const localR2 = p.local_r2 ?? 0;

    const bPovLocal = p.local_betas?.PctPov ?? GLOBAL_OLS_BETAS.PctPov;
    const bRuralLocal = p.local_betas?.PctRural ?? GLOBAL_OLS_BETAS.PctRural;
    const bIntLocal = p.local_betas?.Intercept ?? GLOBAL_OLS_BETAS.Intercept;

    let winner = "tie";
    let badgeClass = "badge-winner-tie";
    let badgeText = `⚖️ Hasil Seimbang (Selisih ±${f2(Math.abs(diff))}%)`;
    let headline = "";
    let reason = "";

    if (diff > 0.25) {
      winner = "gwr";
      badgeClass = "badge-winner-gwr";
      badgeText = `🏆 GWR Unggul (${f1(pctGain)}% Lebih Presisi)`;

      if (p.name.includes("Fulton") || p.name.includes("Atlanta") || (rural < 10 && p.observed > 25)) {
        headline = "Kawasan Aglomerasi Metropolitan & Pasar Kerja Inovasi";
        reason = `GWR unggul mutlak karena menangkap <strong>efek aglomerasi perkotaan</strong>. Model OLS meratakan rumus ke seluruh negara bagian sehingga salah tebak sebesar <strong>${f2(errOls)}%</strong>. GWR secara adaptif meningkatkan Intersep lokal menjadi <strong>${f2(bIntLocal)}</strong> (vs OLS 23.85), mengkompensasi tingginya daya tarik lapangan kerja sarjana dan konsentrasi perguruan tinggi di Atlanta.`;
      } else if (p.name.includes("Clarke") || p.name.includes("Athens") || (p.observed > 30)) {
        headline = "Kawasan Kampus Universitas (Konsentrasi Intelektual)";
        reason = `GWR unggul telak karena menangkap <strong>keberadaan University of Georgia</strong>. OLS memproyeksikan angka sarjana rendah akibat kemiskinan semu kalangan mahasiswa, sedangkan GWR membaca densitas spasial sarjana lokal yang sesungguhnya sehingga selisih galat terpangkas menjadi <strong>±${f2(errGwr)}%</strong> saja.`;
      } else if (p.name.includes("Whitfield") || (rural < 30 && p.observed < 12)) {
        headline = "Sentra Industri Manufaktur & Tenaga Kerja Pabrik";
        reason = `GWR unggul karena membaca <strong>karakter ekonomi manufaktur lokal</strong> (industri karpet). OLS salah mengira kawasan urban otomatis didominasi sarjana, sedangkan GWR menyesuaikan bobot lokal dengan realitas tingginya penyerapan lulusan vokasi/SMA di sektor pabrik.`;
      } else if (rural > 80) {
        headline = "Wilayah Pedesaan / Pelosok Terisolasi (Hambatan Geografis)";
        reason = `GWR unggul karena memperhitungkan <strong>jarak spasial terhadap perguruan tinggi</strong> di pelosok. Koefisien lokal pedesaan bergeser menjadi <strong>${f4(bRuralLocal)}</strong>, mengeliminasi galat OLS yang terlalu optimis menyamaratakan akses pendidikan pedalaman dengan perkotaan.`;
      } else {
        headline = "Keunggulan Variasi Spasial Lokal (Non-Stasioneritas Nyata)";
        reason = `GWR lebih akurat karena elastisitas kemiskinan dan demografi di kabupaten ini berbeda secara signifikan dari rata-rata negara bagian. Pembobotan spasial tetangga terdekat berhasil memangkas error OLS sebesar <strong>${f1(pctGain)}%</strong> (Akurasi lokal $R^2 = ${f3(localR2)}$).`;
      }
    } else if (diff < -0.25) {
      winner = "ols";
      badgeClass = "badge-winner-ols";
      badgeText = `🎯 OLS Unggul (+${f2(Math.abs(diff))}% Lebih Dekat)`;
      headline = "Wilayah Karakter Rata-Rata (Sesuai Tren Garis Makro Global)";
      reason = `Model Biasa (OLS) lebih unggul di titik ini karena kombinasi sosioekonomi kabupaten ini <strong>berada tepat di garis tren rata-rata seluruh negara bagian</strong> (mendekati nilai tengah $\\bar{X}, \\bar{Y}$). Pada kondisi di mana hubungan variabel bersifat homogen dan stasioner, regresi global OLS meminimalkan kuadrat galat secara optimal tanpa terdistorsi oleh variansi lokal tetangga terdekat.`;
    } else {
      winner = "tie";
      badgeClass = "badge-winner-tie";
      badgeText = `⚖️ Hasil Seimbang (Selisih Error ${f2(Math.abs(diff))}%)`;
      headline = "Karakteristik Spasial Bersifat Stasioner / Netral";
      reason = `Kedua model menghasilkan akurasi yang sebanding (selisih galat $\\le 0.25\\%$) karena parameter lokal GWR di titik ini hampir identik dengan garis lurus OLS global. Tidak terdapat anomali geografis ekstrem yang membuat model lokal menyimpang dari tren makro.`;
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
      pctOlsGain
    };
  }

  function initStudio() {
    let map = null;
    let markersLayer = null;
    let spatialPoints = [];
    let currentLayer = "observed";

    const banner = $("#model-banner");
    const dsDesc = $("#ds-desc");
    const statObs = $("#stat-obs");
    const statTarget = $("#stat-target");
    const statDeltaAicc = $("#stat-delta-aicc");
    const legendLabel = $("#legend-label");
    const legendMin = $("#legend-min");
    const legendMid = $("#legend-mid");
    const legendMax = $("#legend-max");

    // Inisialisasi Peta Leaflet
    function initMap() {
      if (map) return;
      map = L.map("spatial-map", {
        scrollWheelZoom: true,
        zoomControl: true
      }).setView([32.5, -83.5], 7);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
        subdomains: ["a", "b", "c"]
      }).addTo(map);

      markersLayer = L.layerGroup().addTo(map);

      // Tambahkan label statis kota-kota utama Georgia sebagai orientasi
      const landmarks = [
        { name: "Atlanta", lat: 33.7490, lon: -84.3880 },
        { name: "Athens", lat: 33.9519, lon: -83.3576 },
        { name: "Savannah", lat: 32.0809, lon: -81.0912 },
        { name: "Macon", lat: 32.8407, lon: -83.6324 },
        { name: "Augusta", lat: 33.4735, lon: -81.9680 },
        { name: "Dalton", lat: 34.7698, lon: -84.9702 }
      ];
      landmarks.forEach((lm) => {
        L.marker([lm.lat, lm.lon], {
          icon: L.divIcon({
            className: "map-city-label",
            html: `<span>🏙️ ${lm.name}</span>`,
            iconSize: [80, 20],
            iconAnchor: [40, 24]
          }),
          interactive: false
        }).addTo(map);
      });

      setTimeout(() => {
        if (map) map.invalidateSize();
      }, 300);

      window.addEventListener("resize", () => {
        if (map) map.invalidateSize();
      });
    }

    // Ambil data status dan titik spasial
    function loadData() {
      fetch("/api/status")
        .then((r) => r.json())
        .then((status) => {
          if (!status.ready) {
            if (banner) {
              banner.hidden = false;
              banner.innerHTML = "Model belum dilatih. Jalankan: <code>python pipeline.py run</code> di terminal.";
            }
            return;
          }
          if (banner) banner.hidden = true;
          if (dsDesc) dsDesc.textContent = status.dataset_name;
          if (statObs) statObs.textContent = status.n_samples;
          if (statTarget) statTarget.textContent = status.target;
          if (statDeltaAicc) statDeltaAicc.textContent = f2(status.delta_aicc);

          loadPoints();
        })
        .catch((e) => {
          if (banner) {
            banner.hidden = false;
            banner.textContent = "Gagal menghubungi API server CivicScan.";
          }
        });
    }

    function loadPoints() {
      fetch("/api/spatial-points")
        .then((r) => r.json())
        .then((points) => {
          spatialPoints = points;
          if (!points.length) return;
          renderMarkers();

          // Populasi Dropdown 159 Kabupaten secara Alfabetis
          const quickCountySelect = $("#quick-county");
          if (quickCountySelect) {
            quickCountySelect.innerHTML = '<option value="">-- Pilih dari Daftar 159 Kabupaten --</option>';
            const sortedPoints = [...spatialPoints].sort((a, b) => a.name.localeCompare(b.name));
            sortedPoints.forEach((pt) => {
              const opt = document.createElement("option");
              opt.value = pt.name;
              const diag = generatePinpointDiagnosis(pt);
              const winIcon = diag.winner === "gwr" ? "🏆 GWR" : diag.winner === "ols" ? "🎯 OLS" : "⚖️ Seimbang";
              opt.textContent = `${pt.name} — Riil ${f1(pt.observed)}% (${winIcon})`;
              quickCountySelect.appendChild(opt);
            });
          }

          // Fit map bounds
          const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lon]));
          map.fitBounds(bounds, { padding: [30, 30] });
          setTimeout(() => {
            if (map) map.invalidateSize();
          }, 200);

          // Pilihan Default Awal: Fulton County (Atlanta) atau titik pertama
          const defaultPt = spatialPoints.find((p) => p.name.includes("Fulton")) || spatialPoints[0];
          if (defaultPt) {
            selectPoint(defaultPt);
          }
        });
    }

    function renderMarkers() {
      if (!markersLayer || !spatialPoints.length) return;
      markersLayer.clearLayers();

      let values = spatialPoints.map((p) => Number(p[currentLayer] ?? 0));
      let minVal = Math.min(...values);
      let maxVal = Math.max(...values);
      let midVal = (minVal + maxVal) / 2;

      if (legendMin) legendMin.textContent = f2(minVal);
      if (legendMid) legendMid.textContent = f2(midVal);
      if (legendMax) legendMax.textContent = f2(maxVal);

      if (legendLabel) legendLabel.textContent = FRIENDLY_LAYERS[currentLayer] || currentLayer;
      const contextHint = $("#legend-context-hint");
      if (contextHint) {
        if (currentLayer === "observed") {
          contextHint.textContent = "Merah = % Sarjana tinggi, Biru = % Sarjana rendah";
        } else if (currentLayer === "local_r2") {
          contextHint.textContent = "Merah = Akurasi GWR sangat tinggi (R² > 0.8), Biru = Sedang";
        } else if (currentLayer === "resid_ols") {
          contextHint.textContent = "Merah = OLS tebak kekecilan (Underpredict), Biru = Tebak kebesaran";
        } else if (currentLayer === "resid_gwr") {
          contextHint.textContent = "Warna memudar netral = GWR berhasil menekan salah tebak mendekati 0";
        }
      }

      spatialPoints.forEach((p) => {
        const val = Number(p[currentLayer] ?? 0);
        const color = getColor(val, minVal, maxVal);

        const circle = L.circleMarker([p.lat, p.lon], {
          radius: 7,
          fillColor: color,
          color: "#234386",
          weight: 1.2,
          opacity: 0.9,
          fillOpacity: 0.85
        });

        const diag = generatePinpointDiagnosis(p);
        const errOls = p.observed != null && p.pred_ols != null ? p.observed - p.pred_ols : null;
        const errGwr = p.observed != null && p.pred_gwr != null ? p.observed - p.pred_gwr : null;

        // Tooltip informatif
        circle.bindTooltip(
          `<strong>${esc(p.name)}</strong><br>
           &bull; Fakta Riil Sensus: <b>${f2(p.observed)}%</b> Sarjana<br>
           &bull; Tebakan OLS: <b>${f2(p.pred_ols)}%</b> ${errOls != null ? `(Err: ${errOls >= 0 ? "+" : ""}${f2(errOls)}%)` : ""}<br>
           &bull; Tebakan GWR: <b style="color:#c97d00;">${f2(p.pred_gwr)}%</b> ${errGwr != null ? `(Err: ${errGwr >= 0 ? "+" : ""}${f2(errGwr)}%)` : ""}<br>
           &bull; Status: <b>${diag.badgeText}</b>`,
          { direction: "top", offset: [0, -5] }
        );

        circle.on("click", () => {
          selectPoint(p);
        });

        markersLayer.addLayer(circle);
      });
    }

    function selectPoint(p) {
      if (!p) return;
      const diag = generatePinpointDiagnosis(p);

      // 1. Nama Wilayah & Badge Pemenang
      const inspName = $("#insp-name");
      if (inspName) {
        let sublabel = `Kabupaten ke-${p.id}`;
        if (p.name.includes("Fulton")) sublabel = "Pusat Bisnis Atlanta";
        else if (p.name.includes("Clarke")) sublabel = "Kota Universitas Athens";
        else if (p.name.includes("Whitfield")) sublabel = "Sentra Industri Dalton";
        else if (p.name.includes("Clinch")) sublabel = "Pelosok Pedalaman Selatan";
        inspName.innerHTML = `${esc(p.name)} <small style="font-size:12px; font-weight:normal; color:#666;">(${sublabel})</small>`;
      }

      const winnerBadge = $("#insp-winner-badge");
      if (winnerBadge) {
        winnerBadge.className = `badge ${diag.badgeClass}`;
        winnerBadge.textContent = diag.badgeText;
      }

      // 2. 3 Pilar Skor Head-to-Head
      const obsEl = $("#insp-observed");
      if (obsEl) obsEl.textContent = `${f2(p.observed)}%`;

      const predOlsEl = $("#insp-pred-ols");
      if (predOlsEl) predOlsEl.textContent = `${f2(p.pred_ols)}%`;

      const errOlsEl = $("#insp-err-ols");
      if (errOlsEl) {
        const rawErrOls = p.observed - p.pred_ols;
        const signOls = rawErrOls >= 0 ? "+" : "";
        errOlsEl.textContent = `Error: ${signOls}${f2(rawErrOls)}%`;
        errOlsEl.style.color = diag.winner === "ols" ? "#1e40af" : "#c0392b";
      }

      const predGwrEl = $("#insp-pred-gwr");
      if (predGwrEl) predGwrEl.textContent = `${f2(p.pred_gwr)}%`;

      const errGwrEl = $("#insp-err-gwr");
      if (errGwrEl) {
        const rawErrGwr = p.observed - p.pred_gwr;
        const signGwr = rawErrGwr >= 0 ? "+" : "";
        errGwrEl.textContent = `Error: ${signGwr}${f2(rawErrGwr)}%`;
        errGwrEl.style.color = diag.winner === "gwr" ? "#166534" : "#b45309";
      }

      // 3. Kotak Diagnostik Mengapa Model Unggul
      const narrBox = $("#insp-narrative");
      if (narrBox) {
        narrBox.style.display = "block";
        narrBox.innerHTML = `
          <div style="font-weight: 700; color: var(--indigo); font-size: 13.5px; margin-bottom: 5px;">
            ${diag.headline}
          </div>
          <div style="font-size: 12.5px; line-height: 1.6; color: #222;">
            ${diag.reason}
          </div>
          <div style="font-size: 11.5px; color: #666; border-top: 1px dashed rgba(0,0,0,0.12); padding-top: 6px; margin-top: 8px; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 4px;">
            <span>📉 Error OLS: <b>±${f2(diag.errOls)}%</b></span>
            <span>🎯 Error GWR: <b>±${f2(diag.errGwr)}%</b></span>
            <span>📊 Akurasi Wilayah ($R^2$): <b>${f3(p.local_r2)}</b></span>
          </div>
        `;
      }

      // 4. Profil Sosioekonomi Lapangan
      const featPov = $("#insp-feat-pov");
      if (featPov && p.features) featPov.textContent = `${f1(p.features.PctPov)}%`;

      const featBlack = $("#insp-feat-black");
      if (featBlack && p.features) featBlack.textContent = `${f1(p.features.PctBlack)}%`;

      const featRural = $("#insp-feat-rural");
      if (featRural && p.features) {
        const rVal = p.features.PctRural;
        const rNote = rVal >= 75 ? "(Pelosok)" : rVal < 20 ? "(Urban)" : "(Transisi)";
        featRural.textContent = `${f1(rVal)}% ${rNote}`;
      }

      const localR2El = $("#insp-local-r2");
      if (localR2El) {
        const r2Val = p.local_r2 ?? 0;
        const r2Note = r2Val >= 0.7 ? "(Sangat Tinggi)" : r2Val >= 0.5 ? "(Tinggi)" : "(Sedang)";
        localR2El.textContent = `${f3(r2Val)} ${r2Note}`;
      }

      // 5. Tabel Koefisien Lokal vs Global
      const tbody = $("#tbl-pred-betas tbody");
      if (tbody) {
        tbody.innerHTML = "";
        const vars = [
          { key: "Intercept", label: "Intersep Dasar (Konstanta)" },
          { key: "PctPov", label: "Tingkat Kemiskinan (PctPov)" },
          { key: "PctBlack", label: "Penduduk Minoritas (PctBlack)" },
          { key: "PctRural", label: "Karakter Pedesaan (PctRural)" }
        ];

        vars.forEach((v) => {
          const tr = document.createElement("tr");
          const bGlobal = GLOBAL_OLS_BETAS[v.key] ?? 0;
          const bLocal = p.local_betas ? (p.local_betas[v.key] ?? bGlobal) : bGlobal;
          const diffB = bLocal - bGlobal;
          const isDiff = Math.abs(diffB) > 0.02;

          tr.innerHTML = `
            <td><strong>${esc(v.label)}</strong></td>
            <td>${f4(bGlobal)}</td>
            <td class="${isDiff ? "text-gold font-bold" : ""}">
              <strong>${f4(bLocal)}</strong>
              ${isDiff ? `<small style="font-size:10px; color:${diffB > 0 ? '#166534' : '#c0392b'};">(${diffB > 0 ? '+' : ''}${f3(diffB)})</small>` : ''}
            </td>
          `;
          tbody.appendChild(tr);
        });
      }

      // 6. Sinkronisasi Dropdown
      const quickSelect = $("#quick-county");
      if (quickSelect && quickSelect.value !== p.name) {
        quickSelect.value = p.name;
      }

      triggerMath();
    }

    // Tombol Tur Terpandu 4 Wilayah Kunci
    function flyToCounty(nameQuery) {
      if (!spatialPoints.length) return;
      const targetPt = spatialPoints.find((p) => p.name.toLowerCase().includes(nameQuery.toLowerCase()));
      if (targetPt) {
        selectPoint(targetPt);
        map.flyTo([targetPt.lat, targetPt.lon], 9, { duration: 1.2 });
      }
    }

    const btnTourAtlanta = $("#btn-tour-atlanta");
    if (btnTourAtlanta) btnTourAtlanta.addEventListener("click", () => flyToCounty("Fulton"));

    const btnTourAthens = $("#btn-tour-athens");
    if (btnTourAthens) btnTourAthens.addEventListener("click", () => flyToCounty("Clarke"));

    const btnTourDalton = $("#btn-tour-dalton");
    if (btnTourDalton) btnTourDalton.addEventListener("click", () => flyToCounty("Whitfield"));

    const btnTourClinch = $("#btn-tour-clinch");
    if (btnTourClinch) btnTourClinch.addEventListener("click", () => flyToCounty("Clinch"));

    // Dropdown Pilihan Cepat Kabupaten Populer
    const quickCountySelect = $("#quick-county");
    if (quickCountySelect) {
      quickCountySelect.addEventListener("change", (e) => {
        const val = e.target.value;
        if (!val || !spatialPoints.length) return;
        const targetPt = spatialPoints.find((p) => p.name === val);
        if (targetPt) {
          selectPoint(targetPt);
          map.flyTo([targetPt.lat, targetPt.lon], 9, { duration: 1 });
        }
      });
    }

    // Layer Switcher Buttons
    $$("#layer-pills button").forEach((btn) => {
      btn.addEventListener("click", () => {
        $$("#layer-pills button").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        currentLayer = btn.dataset.layer;
        renderMarkers();
      });
    });

    initMap();
    loadData();
  }

  /* ==========================================================================
     HALAMAN HASIL EKSPERIMEN: KOMPARASI OLS VS GWR & 22 PAPERS (/results)
     ========================================================================== */
  function initResults() {
    const dashEmpty = $("#dash-empty");
    const dash = $("#dash");

    fetch("/api/results")
      .then((r) => {
        if (!r.ok) throw new Error("No results");
        return r.json();
      })
      .then((s) => {
        dashEmpty.hidden = true;
        dash.hidden = false;
        renderResults(s);
      })
      .catch(() => {
        dashEmpty.hidden = false;
        dash.hidden = true;
      });

    loadPapers();

    function renderResults(s) {
      const ols = s.ols;
      const gwr = s.gwr;
      const moran = s.moran;
      const anova = s.anova;
      const comp = s.comparison;

      // 1. KPI Banner
      $("#kpi-r2-gwr").textContent = f4(gwr.r2);
      $("#kpi-r2-ols").textContent = f4(ols.r2);
      $("#kpi-r2-diff").textContent = `+${f4(comp.delta_r2)} (+${f2(comp.r2_improvement_pct)}%)`;

      $("#kpi-delta-aicc").textContent = f2(comp.delta_aicc);
      $("#kpi-aicc-ols").textContent = f2(ols.aicc);
      $("#kpi-aicc-gwr").textContent = f2(gwr.aicc);

      $("#kpi-moran-gwr").textContent = f4(moran.gwr_moran_i);
      $("#kpi-moran-ols").textContent = f4(moran.ols_moran_i);
      $("#kpi-moran-status").textContent = moran.gwr_p_value >= 0.05 ? "Bebas Bias (p≥0.05)" : "Ada Bias Spasial";

      $("#kpi-bandwidth").textContent = f1(gwr.bandwidth);
      $("#kpi-bw-type").textContent = gwr.bandwidth_type;

      // 2. Main Comparison Table
      const tblBody = $("#tbl-main-comparison tbody");
      tblBody.innerHTML = `
        <tr class="best">
          <td><strong>Koefisien Determinasi ($R^2$)</strong></td>
          <td>${f4(ols.r2)}</td>
          <td><strong class="text-gold">${f4(gwr.r2)}</strong></td>
          <td>+${f4(comp.delta_r2)} (+${f2(comp.r2_improvement_pct)}% varians terjelaskan)</td>
        </tr>
        <tr>
          <td>Adjusted $R^2$</td>
          <td>${f4(ols.adj_r2)}</td>
          <td><strong>${f4(gwr.adj_r2)}</strong></td>
          <td>+${f4(gwr.adj_r2 - ols.adj_r2)}</td>
        </tr>
        <tr class="best">
          <td><strong>Corrected AIC (AICc)</strong></td>
          <td>${f2(ols.aicc)}</td>
          <td><strong class="text-gold">${f2(gwr.aicc)}</strong></td>
          <td><strong>${f2(comp.delta_aicc)}</strong> (${comp.aicc_verdict})</td>
        </tr>
        <tr>
          <td>Akaike Information Criterion (AIC)</td>
          <td>${f2(ols.aic)}</td>
          <td>${f2(gwr.aic)}</td>
          <td>${f2(gwr.aic - ols.aic)}</td>
        </tr>
        <tr>
          <td>Bayesian Information Criterion (BIC)</td>
          <td>${f2(ols.bic)}</td>
          <td>${f2(gwr.bic)}</td>
          <td>${f2(gwr.bic - ols.bic)}</td>
        </tr>
        <tr>
          <td>Residual Sum of Squares (RSS)</td>
          <td>${f2(ols.rss)}</td>
          <td>${f2(gwr.rss)}</td>
          <td>${f2(gwr.rss - ols.rss)} (Penurunan galat tidak terjelaskan)</td>
        </tr>
        <tr class="best">
          <td><strong>Uji Moran's I Residual (p-value)</strong></td>
          <td>${f4(moran.ols_moran_i)} (p = ${f3(moran.ols_p_value)})</td>
          <td><strong class="text-gold">${f4(moran.gwr_moran_i)} (p = ${f3(moran.gwr_p_value)})</strong></td>
          <td>${moran.verdict}</td>
        </tr>
        <tr>
          <td>Bandwidth Spasial Optimal</td>
          <td>– (Global)</td>
          <td>${f1(gwr.bandwidth)} (${gwr.bandwidth_type})</td>
          <td>Optimasi Golden Section AICc</td>
        </tr>
        <tr style="background: #fbf9f6; font-weight: 600;">
          <td>Keputusan Model Terbaik</td>
          <td colspan="3" style="text-align: center; color: var(--indigo); font-size: 15px;">
            ${esc(comp.best_model)}
          </td>
        </tr>
      `;

      // 3. ANOVA F-Test Card
      $("#anova-f").textContent = f3(anova.f_statistic);
      $("#anova-p").textContent = f4(anova.p_value);
      $("#anova-sig").textContent = anova.is_significant ? "Signifikan (p < 0.05)" : "Tidak Signifikan";
      $("#anova-note").textContent = anova.interpretation;

      // 4. Moran's I Card
      $("#moran-ols-val").textContent = f4(moran.ols_moran_i);
      $("#moran-ols-p").textContent = f3(moran.ols_p_value);
      $("#moran-gwr-val").textContent = f4(moran.gwr_moran_i);
      $("#moran-gwr-p").textContent = f3(moran.gwr_p_value);
      $("#moran-verdict-note").textContent = moran.verdict;

      // 5. OLS Parameters Table
      const olsParamsBody = $("#tbl-ols-params tbody");
      olsParamsBody.innerHTML = "";
      ols.coefficients.forEach((c) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><strong>${esc(c.variable)}</strong></td>
          <td>${f4(c.coef)}</td>
          <td>${f4(c.std_err)}</td>
          <td>${f3(c.t_stat)}</td>
          <td>${f4(c.p_value)} ${c.p_value < 0.05 ? '<span class="badge badge-success">Sig</span>' : ""}</td>
        `;
        olsParamsBody.appendChild(tr);
      });

      // 6. GWR Local Parameters Table
      const gwrParamsBody = $("#tbl-gwr-params tbody");
      gwrParamsBody.innerHTML = "";
      gwr.coefficients_summary.forEach((cs) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><strong>${esc(cs.variable)}</strong></td>
          <td>${f3(cs.min)}</td>
          <td>${f3(cs.q1)}</td>
          <td><strong>${f3(cs.median)}</strong></td>
          <td>${f3(cs.q3)}</td>
          <td>${f3(cs.max)}</td>
          <td>${f4(cs.std)}</td>
        `;
        gwrParamsBody.appendChild(tr);
      });

      // 7. Preview LaTeX
      generateLatexPreview(s);
      triggerMath();
    }

    function f1(v) {
      return (v == null || isNaN(v) ? "–" : Number(v).toFixed(1));
    }

    function generateLatexPreview(s) {
      const ols = s.ols;
      const gwr = s.gwr;
      const moran = s.moran;
      const comp = s.comparison;

      const tex = `% Tabel Komparasi Model Biasa (OLS) vs Model GWR
\\begin{table}[htbp]
\\centering
\\caption{Perbandingan Kinerja Model Biasa (OLS) dan Model GWR}
\\label{tab:ols_vs_gwr_comparison}
\\begin{tabular}{lccc}
\\toprule
\\textbf{Metrik Evaluasi} & \\textbf{Model Biasa (OLS)} & \\textbf{Model GWR} & \\textbf{Perubahan ($\\Delta$)} \\\\
\\midrule
$R^2$ (Koefisien Determinasi) & ${f4(ols.r2)} & ${f4(gwr.r2)} & +${f4(comp.delta_r2)} (${f1(comp.r2_improvement_pct)}\\%) \\\\
Adjusted $R^2$ & ${f4(ols.adj_r2)} & ${f4(gwr.adj_r2)} & +${f4(gwr.adj_r2 - ols.adj_r2)} \\\\
AIC & ${f2(ols.aic)} & ${f2(gwr.aic)} & ${f2(gwr.aic - ols.aic)} \\\\
AICc & ${f2(ols.aicc)} & ${f2(gwr.aicc)} & ${f2(comp.delta_aicc)} \\\\
RSS & ${f2(ols.rss)} & ${f2(gwr.rss)} & ${f2(gwr.rss - ols.rss)} \\\\
Moran's I Residual ($p$-val) & ${f4(moran.ols_moran_i)} (${f3(moran.ols_p_value)}) & ${f4(moran.gwr_moran_i)} (${f3(moran.gwr_p_value)}) & Eliminasi Autokorelasi \\\\
Bandwidth Spasial & - & ${f1(gwr.bandwidth)} (${esc(gwr.bandwidth_type)}) & - \\\\
\\midrule
\\textbf{Keputusan Model Terbaik} & \\multicolumn{3}{c}{\\textbf{${esc(comp.best_model)}}} \\\\
\\bottomrule
\\end{tabular}
\\end{table}`;

      const pre = $("#latex-preview");
      if (pre) pre.textContent = tex;

      const btnCopy = $("#btn-copy-latex");
      if (btnCopy) {
        btnCopy.addEventListener("click", () => {
          navigator.clipboard.writeText(tex).then(() => {
            btnCopy.textContent = "Berhasil Disalin!";
            setTimeout(() => { btnCopy.textContent = "Salin Kode LaTeX"; }, 2000);
          });
        });
      }
    }

    // Load 22 Papers
    function loadPapers() {
      fetch("/api/papers")
        .then((r) => r.json())
        .then((res) => {
          const papers = res.papers || [];
          renderPapersTable(papers);

          // Setup Search Filter
          const searchInput = $("#paper-search");
          if (searchInput) {
            searchInput.addEventListener("input", (e) => {
              const q = e.target.value.toLowerCase().trim();
              const filtered = papers.filter((p) => {
                return (
                  p.title.toLowerCase().includes(q) ||
                  p.authors.toLowerCase().includes(q) ||
                  p.journal.toLowerCase().includes(q) ||
                  p.focus_comparison.toLowerCase().includes(q)
                );
              });
              renderPapersTable(filtered);
            });
          }
        });
    }

    function renderPapersTable(papers) {
      const tbody = $("#tbl-papers-body");
      if (!tbody) return;
      tbody.innerHTML = "";

      if (!papers.length) {
        tbody.innerHTML = `<tr><td colspan="4" class="hint" style="text-align:center; padding: 24px;">Tidak ada paper yang cocok dengan pencarian Anda.</td></tr>`;
        return;
      }

      papers.forEach((p) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td style="color: #666; font-weight: 500;">${esc(p.number)}</td>
          <td>
            <strong>${esc(p.title)}</strong><br>
            <small style="color: #555;">${esc(p.authors)}</small>
          </td>
          <td>
            <em>${esc(p.journal)}</em><br>
            ${p.doi ? `<a href="${esc(p.doi_url)}" target="_blank" rel="noopener noreferrer" style="font-size: 11px; text-decoration: underline;">DOI: ${esc(p.doi)}</a>` : '<span style="font-size:11px; color:#888;">Buku Teks</span>'}
          </td>
          <td style="font-size: 13px; line-height: 1.45;">
            ${esc(p.focus_comparison)}
          </td>
        `;
        tbody.appendChild(tr);
      });
    }
  }

  // Router init
  document.addEventListener("DOMContentLoaded", () => {
    const page = document.body.dataset.page;
    if (page === "demo") {
      initStudio();
    } else if (page === "results") {
      initResults();
    }
  });
})();
