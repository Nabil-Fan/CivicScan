/* CivicScan — JS tanpa dependensi. Halaman demo (/) dan dasbor hasil (/results). */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const NS = "http://www.w3.org/2000/svg";
  const f3 = (v) => (v == null ? "–" : Number(v).toFixed(3));
  const pct = (v) => (v * 100).toFixed(1) + "%";
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const titleCase = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());
  const PAL = ["#234386", "#ed7328", "#ffc400", "#a2d3a6", "#6aa8dc", "#d2b68c", "#000000"];
  const SC_ORDER = ["M", "A", "B", "C", "D"];

  function svg(tag, attrs = {}, text) {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (text != null) n.textContent = text;
    return n;
  }
  function pills(container, items, selected, onChange, name) {
    container.innerHTML = "";
    items.forEach(([value, label]) => {
      const l = document.createElement("label");
      l.className = "pill";
      l.innerHTML = `<input type="radio" name="${name}" value="${esc(value)}" ${value === selected ? "checked" : ""}><span>${esc(label)}</span>`;
      l.firstChild.addEventListener("change", () => onChange(value));
      container.appendChild(l);
    });
  }

  /* ===================================================== halaman demo ===================================================== */
  function initDemo() {
    const form = $("#predict-form"), file = $("#file"), preview = $("#preview"), dzText = $("#dz-text");
    const dz = $("#dropzone"), btn = $("#submit"), err = $("#form-error"), banner = $("#model-banner");
    let scenario = null, ready = false;

    fetch("/api/status").then((r) => r.json()).then((s) => {
      ready = s.ready;
      if (!s.ready) {
        banner.hidden = false;
        banner.innerHTML = "Model belum dilatih. Jalankan <code>python pipeline.py all</code>, lalu muat ulang halaman.";
        return;
      }
      scenario = s.best;
      const items = Object.entries(s.scenarios).map(([k, v]) => [k, `${k} · ${v.name}${k === s.best ? " (terbaik)" : ""}`]);
      pills($("#scenario-pills"), items, s.best, (v) => (scenario = v), "scenario");
      btn.disabled = !file.files.length;
    }).catch(() => { banner.hidden = false; banner.textContent = "Server tidak merespons."; });

    function showFile(f) {
      err.hidden = true;
      if (!f) return;
      preview.src = URL.createObjectURL(f);
      preview.hidden = false;
      dzText.hidden = true;
      btn.disabled = !ready;
    }
    file.addEventListener("change", () => showFile(file.files[0]));
    ["dragenter", "dragover"].forEach((e) => dz.addEventListener(e, (ev) => { ev.preventDefault(); dz.classList.add("over"); }));
    ["dragleave", "drop"].forEach((e) => dz.addEventListener(e, (ev) => { ev.preventDefault(); dz.classList.remove("over"); }));
    dz.addEventListener("drop", (ev) => {
      if (ev.dataTransfer.files.length) { file.files = ev.dataTransfer.files; showFile(file.files[0]); }
    });

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      if (!file.files.length) return;
      err.hidden = true;
      btn.disabled = true;
      const old = btn.textContent;
      btn.textContent = "Menganalisis…";
      const fd = new FormData();
      fd.append("image", file.files[0]);
      if (scenario) fd.append("scenario", scenario);
      try {
        const r = await fetch("/api/predict", { method: "POST", body: fd });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Gagal memproses gambar.");
        showResult(d);
      } catch (e) {
        err.textContent = e.message;
        err.hidden = false;
      } finally {
        btn.textContent = old;
        btn.disabled = false;
      }
    });

    function showResult(d) {
      $("#result-img").src = preview.src;
      $("#result-label").textContent = d.label;
      const parts = [`Keyakinan ${pct(d.confidence)}`, `Model ${d.scenario} · ${d.scenario_name}`,
        `Macro-F1 out-of-fold ${f3(d.oof_macro_f1)}`, `Ukuran ${d.size[0]}×${d.size[1]} px`];
      if (d.cluster) parts.push(`Cluster K-Means ${d.cluster.id + 1} dari ${d.cluster.k}`);
      $("#result-meta").textContent = parts.join(" · ");
      const w = $("#result-warnings");
      w.innerHTML = d.warnings.map((x) => `<li>${esc(x)}</li>`).join("");
      $("#result-bars").innerHTML = d.probs.map((p, i) =>
        `<div class="bar-row ${i === 0 ? "top" : ""}"><span>${esc(titleCase(p.label))}</span>` +
        `<div class="bar-track"><div class="bar-fill" style="width:${(p.p * 100).toFixed(1)}%"></div></div>` +
        `<span class="bar-val">${pct(p.p)}</span></div>`).join("");
      $("#result-note").textContent = d.proba_note + " Ini prediksi awal, bukan penilaian resmi.";
      
      // Explanation section
      if (d.explanation) {
        const explSec = $("#explanation-section");
        const explContent = $("#explanation-content");
        explSec.hidden = false;
        
        let html = "";
        
        if (d.explanation.knn) {
          const knn = d.explanation.knn;
          const sortedVotes = Object.entries(knn.votes).sort((a, b) => b[1] - a[1]);
          
          // SVG pie/donut chart for votes
          const W = 300, H = 300, cx = W/2, cy = H/2, R = 100;
          let startAngle = -Math.PI / 2;
          const slices = sortedVotes.map(([cls, votes]) => {
            const angle = (votes / knn.k) * 2 * Math.PI;
            const endAngle = startAngle + angle;
            const x1 = cx + R * Math.cos(startAngle);
            const y1 = cy + R * Math.sin(startAngle);
            const x2 = cx + R * Math.cos(endAngle);
            const y2 = cy + R * Math.sin(endAngle);
            const largeArc = angle > Math.PI ? 1 : 0;
            const path = votes > 0 ? `M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2} Z` : "";
            const midAngle = startAngle + angle / 2;
            const labelX = cx + (R + 30) * Math.cos(midAngle);
            const labelY = cy + (R + 30) * Math.sin(midAngle);
            startAngle = endAngle;
            return { cls, votes, path, labelX, labelY, pct: (votes / knn.k * 100).toFixed(0) };
          });
          
          html += `<div class="explain-box">
            <h4>Perhitungan Model K-Nearest Neighbors (k=${knn.k})</h4>
            <p>Model mencari <b>${knn.k} tetangga terdekat</b> dalam data training berdasarkan kesamaan fitur, 
            kemudian menghitung voting dari kelas tetangga tersebut:</p>
            <div style="display: flex; gap: 24px; align-items: center; margin: 20px 0;">
              <svg viewBox="0 0 ${W} ${H}" style="width: ${W}px; height: ${H}px;">
                ${slices.map((s, i) => s.votes > 0 ? `
                  <path d="${s.path}" fill="${PAL[i % PAL.length]}" stroke="#fff" stroke-width="2"/>
                  <text x="${s.labelX}" y="${s.labelY}" text-anchor="middle" font-size="11" font-weight="600">${s.pct}%</text>
                ` : "").join("")}
              </svg>
              <div class="vote-legend">
                ${sortedVotes.map(([cls, votes], i) => `
                  <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                    <div style="width: 16px; height: 16px; background: ${PAL[i % PAL.length]}; border-radius: 3px;"></div>
                    <span style="font-weight: 500;">${esc(titleCase(cls))}</span>
                    <span style="color: #666; margin-left: auto;">${votes}/${knn.k} suara</span>
                  </div>
                `).join("")}
              </div>
            </div>
            <div style="background: #fff; padding: 14px; border-radius: 6px; margin-top: 16px;">
              <p style="margin: 0; font-size: 13px;"><b>Analisis Jarak:</b></p>
              <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 10px; font-size: 13px;">
                <div><span style="color: #666;">Rata-rata:</span> <b>${f3(knn.avg_distance)}</b></div>
                <div><span style="color: #666;">Terdekat:</span> <b>${f3(knn.closest_distance)}</b></div>
                <div><span style="color: #666;">Terjauh:</span> <b>${f3(knn.farthest_distance)}</b></div>
              </div>
              <p class="hint" style="margin-top: 10px;">Jarak diukur di ruang fitur yang sudah dinormalisasi. 
              Semakin kecil jarak rata-rata, semakin mirip gambar Anda dengan data training, sehingga prediksi lebih yakin.</p>
            </div>
          </div>`;
        }
        
        if (d.explanation.tree) {
          const tree = d.explanation.tree;
          html += `<div class="explain-box">
            <h4>Perhitungan Model Decision Tree</h4>
            <p>Model mengikuti <b>path dari akar ke daun</b> dengan ${tree.path_length} keputusan if-else. 
            Tree ini punya depth ${tree.depth} dan ${tree.n_leaves} daun total.</p>
            
            ${tree.top_features.length > 0 ? `
              <div style="background: #fff; padding: 14px; border-radius: 6px; margin: 16px 0;">
                <p style="margin: 0 0 12px 0; font-weight: 600;">Top 5 Fitur Paling Berpengaruh:</p>
                <div class="feat-importance">
                  ${tree.top_features.map((f, i) => `<div class="imp-row">
                    <span class="imp-rank">${i + 1}</span>
                    <span class="imp-name">${esc(f.name)}</span>
                    <div class="bar-track"><div class="bar-fill" style="width:${(f.importance * 100).toFixed(1)}%; background: ${PAL[i % PAL.length]};"></div></div>
                    <span class="imp-val">${(f.importance * 100).toFixed(1)}%</span>
                  </div>`).join("")}
                </div>
                <p class="hint" style="margin-top: 12px;">Feature importance = seberapa sering fitur ini dipakai untuk split nodes di seluruh tree. 
                Nilai tinggi artinya fitur ini sangat menentukan dalam memisahkan kelas-kelas.</p>
              </div>
            ` : ""}
            
            <div style="background: #fff; padding: 14px; border-radius: 6px;">
              <p style="margin: 0; font-size: 13px;">Prediksi final diambil dari <b>daun dengan ${tree.leaf_samples} sampel training</b>. 
              Distribusi kelas di daun ini yang menentukan probabilitas masing-masing kelas di bar chart atas.</p>
            </div>
          </div>`;
        }
        
        if (!d.explanation.knn && !d.explanation.tree) {
          html = `<p class="hint">Model baseline (M) tidak menyediakan penjelasan detail.</p>`;
        }
        
        explContent.innerHTML = html;
      }
      
      // Feature breakdown
      if (d.features) {
        const famLabels = { warna: "Warna (histogram HSV)", intensitas: "Intensitas (grayscale)", 
                           tepi: "Deteksi Tepi", tekstur: "Tekstur (gradien & LBP)" };
        const famDesc = {
          warna: "Distribusi warna dalam ruang HSV - menangkap perbedaan antara objek hijau (rumput), coklat (tanah), abu-abu (jalan), dll.",
          intensitas: "Kecerahan rata-rata gambar - objek gelap vs terang",
          tepi: "Kepadatan tepi - jalan retak punya banyak edge, jalan mulus lebih sedikit",
          tekstur: "Pola tekstur mikro - permukaan kasar vs halus, pola repetitif"
        };
        $("#feature-breakdown").innerHTML = Object.entries(d.features).map(([fam, data]) => {
          const vals = Object.values(data.values);
          const max = Math.max(...vals, 0.01);
          return `<div class="feat-group"><h4>${famLabels[fam]}</h4><p class="hint">${famDesc[fam]}</p>` +
            `<div class="feat-summary"><span><b>${data.summary.count}</b> fitur</span>` +
            `<span>Rata-rata: <b>${f3(data.summary.mean)}</b></span>` +
            `<span>Maksimum: <b>${f3(data.summary.max)}</b></span></div>` +
            `<div class="feat-bars">${Object.entries(data.values).slice(0, 10).map(([k, v]) => 
              `<div class="mini-bar"><span class="mini-label">${esc(k)}</span>` +
              `<div class="bar-track"><div class="bar-fill" style="width:${(v / max * 100).toFixed(1)}%"></div></div>` +
              `<span class="mini-val">${f3(v)}</span></div>`).join("")}` +
            (vals.length > 10 ? `<p class="hint">...dan ${vals.length - 10} fitur lainnya</p>` : "") +
            `</div></div>`;
        }).join("") + `<p class="hint">Model menggunakan kombinasi ke-54 fitur ini untuk menentukan kelas objek. ` +
          `Fitur yang dominan bervariasi tergantung objek - misalnya warna hijau tinggi untuk rumput/hewan di padang, ` +
          `edge density tinggi untuk crack, dll.</p>`;
      }
      
      const sec = $("#hasil");
      sec.hidden = false;
      sec.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  /* ===================================================== dasbor ===================================================== */
  function initDash() {
    fetch("/api/results").then((r) => (r.ok ? r.json() : Promise.reject())).then(render)
      .catch((e) => { if (e) console.error(e); $("#dash-empty").hidden = false; });
  }

  function render(S) {
    $("#dash").hidden = false;
    const names = S.class_names, sc = S.scenarios, best = S.meta.best_scenario;
    const nm = (n) => titleCase(n);

    // ----- ringkasan
    const bm = sc[best];
    $("#stats").innerHTML = [
      [S.meta.n_crops.toLocaleString("id-ID"), "crop valid"],
      [S.meta.n_groups.toLocaleString("id-ID"), "gambar sumber (grup split)"],
      [S.meta.n_splits, "fold luar (StratifiedGroupKFold)"],
      [`${f3(bm.mean.macro_f1)}`, `macro-F1 terbaik · skenario ${best} (± ${f3(bm.std.macro_f1)})`],
    ].map(([a, b]) => `<div class="stat"><b>${a}</b><span>${b}</span></div>`).join("");

    // ----- tabel skenario
    const bestRow = (k) => (k === best ? "best" : "");
    $("#tbl-scen").innerHTML = `<thead><tr><th>Kode</th><th>Model</th><th class="num">Macro-F1</th><th class="num">Balanced acc.</th><th class="num">Accuracy</th><th class="num">Macro-F1 gabungan</th></tr></thead><tbody>` +
      SC_ORDER.map((k) => { const s = sc[k]; return `<tr class="${bestRow(k)}"><td>${k}</td><td>${esc(s.name)}</td>` +
        `<td class="num">${f3(s.mean.macro_f1)} ± ${f3(s.std.macro_f1)}</td><td class="num">${f3(s.mean.balanced_acc)} ± ${f3(s.std.balanced_acc)}</td>` +
        `<td class="num">${f3(s.mean.accuracy)} ± ${f3(s.std.accuracy)}</td><td class="num">${f3(s.pooled.macro_f1)}</td></tr>`; }).join("") + "</tbody>";
    metricsRadar(sc, best);

    $("#tbl-folds").innerHTML = `<thead><tr><th>Fold</th>${SC_ORDER.map((k) => `<th class="num">${k}</th>`).join("")}<th class="num">Crop uji</th></tr></thead><tbody>` +
      S.folds.map((f, i) => `<tr><td>${f.fold}</td>${SC_ORDER.map((k) => `<td class="num">${f3(sc[k].per_fold[i].macro_f1)}</td>`).join("")}<td class="num">${f.n_test}</td></tr>`).join("") + "</tbody>";

    f1Chart(sc);

    // ----- perbandingan cluster
    const patt = { konsisten_naik: "naik pada semua fold", konsisten_turun: "turun pada semua fold", tidak_konsisten: "tidak konsisten antar fold" };
    $("#compare").innerHTML = Object.entries(S.comparison).map(([k, c]) => {
      const [n, b] = k.split("_vs_");
      const d = c.delta_macro_f1_mean;
      return `<div class="cmp"><b class="${d >= 0 ? "delta-pos" : "delta-neg"}">${d >= 0 ? "+" : ""}${f3(d)}</b> macro-F1, skenario ${n} dibanding ${b}.<br>` +
        `Naik pada ${c.folds_improved_macro_f1} dari ${c.n_folds} fold (${patt[c.pattern]}). Δ balanced acc. ${c.delta_balanced_acc_mean >= 0 ? "+" : ""}${f3(c.delta_balanced_acc_mean)}.</div>`;
    }).join("") + `<p class="hint">Deskriptif saja: tanpa uji signifikansi. Peningkatan kecil atau tidak konsisten bukan bukti yang meyakinkan.</p>`;

    // ----- per kelas + confusion
    let cur = best;
    const items = SC_ORDER.map((k) => [k, `${k} · ${sc[k].name}`]);
    const drawClass = () => { classTable(sc[cur], names); confusion(sc[cur], names); };
    pills($("#pills-class"), items, cur, (v) => { cur = v; drawClass(); }, "cls");
    drawClass();
    $("#confusions").innerHTML = S.top_confusions.length
      ? S.top_confusions.map((c) => `<li>${esc(nm(c.true))} diprediksi sebagai ${esc(nm(c.pred))}: ${c.count} crop</li>`).join("")
      : "<li>Tidak ada kesalahan.</li>";
    $("#errors").innerHTML = S.error_montage
      ? `<img class="errors-img" src="/files/${S.error_montage}" alt="Contoh crop yang salah diklasifikasi"><p class="hint">Keterangan: kelas sebenarnya &gt; prediksi (skenario ${best}, sampel acak).</p>`
      : "<p>Tidak ada contoh.</p>";

    // ----- cluster
    const ca = S.cluster_analysis;
    $("#cluster-note").textContent = `Model akhir skenario ${ca.scenario} dengan k = ${ca.k} (mode pemilihan: ${ca.k_mode}), silhouette ${f3(ca.silhouette_all)}. ` +
      `Cluster tidak harus sama dengan kelas; tinjau sampel visualnya untuk melihat apakah yang tertangkap adalah bentuk objek, latar, atau pencahayaan. ${ca.note}`;
    let colorBy = "cluster";
    const drawPca = () => pcaPlot(ca, names, colorBy);
    pills($("#pills-pca"), [["cluster", "Warna: cluster"], ["cls", "Warna: kelas"]], colorBy, (v) => { colorBy = v; drawPca(); }, "pca");
    drawPca();
    elbowChart(ca.elbow);
    contingency(ca, names);
    $("#cluster-imgs").innerHTML = ca.purity.map((p) =>
      `<figure><figcaption><b>Cluster ${p.cluster + 1}</b> · ${p.size} crop · dominan ${esc(p.dominant_class ? nm(p.dominant_class) : "-")} (${pct(p.dominant_share)})</figcaption>` +
      (ca.montages[p.cluster] ? `<img src="/files/${ca.montages[p.cluster]}" alt="Sampel crop cluster ${p.cluster + 1}" loading="lazy">` : "") + `</figure>`).join("");

    // ----- audit & distribusi
    distChart(S, names);
    const A = S.audit || {};
    const rows = [["Gambar ditemukan", A.images_total], ["Berkas label", A.label_files_total], ["Label tanpa gambar", A.labels_without_image],
      ["Gambar tanpa label", A.images_without_label], ["Gambar tidak terbaca", A.images_unreadable], ["Gambar duplikat (dibuang)", A.duplicate_images_dropped],
      ["Baris label rusak", A.label_lines_malformed], ["Class ID tidak dikenal", A.unknown_class_ids], ["Box melewati batas gambar (dipotong)", A.boxes_out_of_bounds_clipped],
      ["Box berukuran nol", A.boxes_zero_size], ["Box terlalu kecil (dikeluarkan)", A.boxes_too_small], ["Box duplikat", A.boxes_duplicate], ["Box dipakai", A.boxes_kept],
      ["Crop akhir", A.crops_total], ["Sumber nama kelas", A.class_names_source]];
    $("#tbl-audit").innerHTML = "<tbody>" + rows.map(([k, v]) => `<tr><td>${k}</td><td class="num">${v == null ? "–" : esc(v)}</td></tr>`).join("") + "</tbody>";
    const m = S.meta, cfg = A.config || {};
    const defs = [["CV luar", `${m.cv}; ${m.n_splits} fold`], ["Random state", m.seed], ["Pemilihan k K-Means", m.k_mode === "grid" ? "CV dalam (macro-F1, data latih)" : "silhouette pada data latih"],
      ["Fitur", `${m.n_features} fitur visual, resize ${cfg.resize || "–"}×${cfg.resize || "–"}`], ["Ambang crop", `sisi ≥ ${cfg.min_side_px || "–"} px, luas ≥ ${cfg.min_area_px || "–"} px²`],
      ["Mode cepat", m.quick ? "YA (bukan untuk laporan)" : "tidak"], ["Pustaka", Object.entries(m.libraries).map(([k, v]) => `${k} ${v}`).join(", ")], ["Dibuat", m.created]];
    $("#protocol").innerHTML = defs.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("");
  }

  function f1Chart(sc) {
    const W = 520, rowH = 46, H = SC_ORDER.length * rowH + 34, L = 150, R = 20, x = (v) => L + v * (W - L - R);
    const s = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "chart", role: "img", "aria-label": "Macro-F1 rata-rata per skenario dengan simpangan baku" });
    [0, .25, .5, .75, 1].forEach((t) => {
      s.appendChild(svg("line", { x1: x(t), x2: x(t), y1: 6, y2: H - 24, stroke: "#000", "stroke-opacity": .12 }));
      s.appendChild(svg("text", { x: x(t), y: H - 8, "text-anchor": "middle" }, t.toFixed(2)));
    });
    SC_ORDER.forEach((k, i) => {
      const y = 12 + i * rowH, m = sc[k].mean.macro_f1, sd = sc[k].std.macro_f1;
      s.appendChild(svg("text", { x: L - 10, y: y + 17, "text-anchor": "end" }, `${k} · ${sc[k].name.replace(" - fitur dasar", "")}`));
      s.appendChild(svg("rect", { x: L, y, width: Math.max(1, x(m) - L), height: 24, rx: 4, fill: k === "M" ? "#d2b68c" : "#234386", stroke: "#000", "stroke-width": .8 }));
      s.appendChild(svg("line", { x1: x(Math.max(0, m - sd)), x2: x(Math.min(1, m + sd)), y1: y + 12, y2: y + 12, stroke: "#ffc400", "stroke-width": 3 }));
      s.appendChild(svg("text", { x: x(Math.min(1, m + sd)) + 6, y: y + 16 }, f3(m)));
    });
    $("#chart-f1").innerHTML = "";
    $("#chart-f1").appendChild(s);
    $("#chart-f1").insertAdjacentHTML("beforeend", `<p class="hint">Batang = rata-rata antar fold; garis emas = ± 1 simpangan baku.</p>`);
  }

  function metricsRadar(sc, best) {
    const W = 440, H = 420, cx = W / 2, cy = H / 2, R = 160;
    const metrics = ["Macro-F1", "Balanced Acc", "Accuracy"];
    const angles = metrics.map((_, i) => -Math.PI / 2 + (i * 2 * Math.PI / metrics.length));
    const s = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "chart", role: "img", "aria-label": "Perbandingan metrik evaluasi antar skenario" });
    s.appendChild(svg("rect", { x: 0, y: 0, width: W, height: H, fill: "#fbf9f6", rx: 8 }));
    
    // Grid circles
    [0.2, 0.4, 0.6, 0.8, 1.0].forEach((r) => {
      s.appendChild(svg("circle", { cx, cy, r: R * r, fill: "none", stroke: "#000", "stroke-opacity": .08, "stroke-width": 1 }));
    });
    
    // Axes
    angles.forEach((a, i) => {
      const x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
      s.appendChild(svg("line", { x1: cx, y1: cy, x2: x, y2: y, stroke: "#000", "stroke-opacity": .15, "stroke-width": 1 }));
      const labelDist = R + 30;
      const lx = cx + labelDist * Math.cos(a), ly = cy + labelDist * Math.sin(a);
      s.appendChild(svg("text", { x: lx, y: ly, "text-anchor": "middle", "dominant-baseline": "middle", "font-weight": "600" }, metrics[i]));
    });
    
    // Scenario polygons
    const scenColors = { M: "#d2b68c", A: "#234386", B: "#ed7328", C: "#6aa8dc", D: "#a2d3a6" };
    SC_ORDER.forEach((k) => {
      const sc_data = sc[k];
      const values = [sc_data.mean.macro_f1, sc_data.mean.balanced_acc, sc_data.mean.accuracy];
      const points = angles.map((a, i) => {
        const r = R * values[i];
        return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
      }).join(" ");
      const isBest = k === best;
      s.appendChild(svg("polygon", { 
        points, 
        fill: scenColors[k], 
        "fill-opacity": isBest ? .35 : .15, 
        stroke: scenColors[k], 
        "stroke-width": isBest ? 2.5 : 1.5 
      }));
      
      // Dots on vertices
      angles.forEach((a, i) => {
        const r = R * values[i];
        const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
        s.appendChild(svg("circle", { cx: x, cy: y, r: isBest ? 4 : 3, fill: scenColors[k], stroke: "#fff", "stroke-width": 1 }));
      });
    });
    
    const box = $("#chart-metrics"); 
    box.innerHTML = ""; 
    box.appendChild(s);
    box.insertAdjacentHTML("beforeend", `<div class="legend">${SC_ORDER.map((k) => `<span><i style="background:${scenColors[k]}"></i>${k} · ${esc(sc[k].name.replace(" - fitur dasar", ""))}${k === best ? " (terbaik)" : ""}</span>`).join("")}</div>` +
      `<p class="hint">Semakin luar, semakin baik. Polygon tebal = model terbaik berdasarkan macro-F1.</p>`);
  }

  function classTable(s, names) {
    $("#tbl-class").innerHTML = `<thead><tr><th>Kelas</th><th class="num">Precision</th><th class="num">Recall</th><th class="num">F1</th><th class="num">Jumlah crop</th></tr></thead><tbody>` +
      names.map((n) => { const c = s.per_class[n]; return `<tr><td>${esc(titleCase(n))}</td><td class="num">${f3(c.precision)}</td><td class="num">${f3(c.recall)}</td><td class="num">${f3(c["f1-score"])}</td><td class="num">${c.support}</td></tr>`; }).join("") + "</tbody>";
  }

  function heat(rowLabels, colLabels, M, cornerNote) {
    const th = colLabels.map((c) => `<th>${esc(c.length > 9 ? c.slice(0, 8) + "…" : c)}</th>`).join("");
    const body = M.map((row, i) => {
      const tot = row.reduce((a, b) => a + b, 0) || 1;
      return `<tr><th class="rowh">${esc(rowLabels[i])}</th>` + row.map((v) => {
        const a = v / tot;
        return `<td style="background:rgba(35,67,134,${(a * 0.95).toFixed(3)});color:${a > .5 ? "#fff" : "#000"}">${v}</td>`;
      }).join("") + "</tr>";
    }).join("");
    return `<table class="heat"><thead><tr><th>${cornerNote}</th>${th}</tr></thead><tbody>${body}</tbody></table>`;
  }
  const confusion = (s, names) => { $("#confusion").innerHTML = heat(names.map(titleCase), names.map(titleCase), s.confusion, "benar ↓ / prediksi →"); };
  const contingency = (ca, names) => { $("#contingency").innerHTML = heat(ca.contingency.map((_, i) => `Cluster ${i + 1}`), names.map(titleCase), ca.contingency, "cluster ↓ / kelas →"); };

  function pcaPlot(ca, names, by) {
    const W = 520, H = 380, P = ca.pca_points;
    const xs = P.map((p) => p.x), ys = P.map((p) => p.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const sx = (v) => 16 + ((v - x0) / (x1 - x0 || 1)) * (W - 32), sy = (v) => H - 16 - ((v - y0) / (y1 - y0 || 1)) * (H - 32);
    const keys = by === "cluster" ? [...Array(ca.k).keys()] : names;
    const color = (k) => PAL[keys.indexOf(k) % PAL.length];
    const s = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "chart", role: "img", "aria-label": "Proyeksi PCA dua dimensi" });
    s.appendChild(svg("rect", { x: 0, y: 0, width: W, height: H, fill: "#fbf9f6", stroke: "#000", "stroke-width": .8, rx: 8 }));
    P.forEach((p) => s.appendChild(svg("circle", { cx: sx(p.x), cy: sy(p.y), r: 3.4, fill: color(by === "cluster" ? p.cluster : p.cls), "fill-opacity": .8, stroke: "#000", "stroke-width": .3 })));
    const box = $("#pca"); box.innerHTML = ""; box.appendChild(s);
    box.insertAdjacentHTML("beforeend", `<div class="legend">${keys.map((k) => `<span><i style="background:${color(k)}"></i>${esc(by === "cluster" ? "Cluster " + (k + 1) : titleCase(k))}</span>`).join("")}</div>` +
      `<p class="hint">Varians dijelaskan PC1 ${pct(ca.pca_explained_variance[0])}, PC2 ${pct(ca.pca_explained_variance[1])}. Jarak di proyeksi ini hanya gambaran kasar.</p>`);
  }

  function elbowChart(curve) {
    const W = 520, H = 300, L = 44, R = 44, T = 20, B = 36;
    const ks = curve.map((c) => c.k), kx = (k) => L + ((k - ks[0]) / (ks[ks.length - 1] - ks[0] || 1)) * (W - L - R);
    const ins = curve.map((c) => c.inertia), i0 = Math.min(...ins), i1 = Math.max(...ins);
    const sils = curve.map((c) => c.silhouette ?? 0), s0 = Math.min(0, ...sils), s1 = Math.max(...sils, 0.01);
    const yi = (v) => T + (1 - (v - i0) / (i1 - i0 || 1)) * (H - T - B), ys = (v) => T + (1 - (v - s0) / (s1 - s0 || 1)) * (H - T - B);
    const s = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "chart", role: "img", "aria-label": "Inertia dan silhouette terhadap k" });
    s.appendChild(svg("rect", { x: L, y: T, width: W - L - R, height: H - T - B, fill: "none", stroke: "#000", "stroke-width": .8 }));
    ks.forEach((k) => s.appendChild(svg("text", { x: kx(k), y: H - 14, "text-anchor": "middle" }, k)));
    s.appendChild(svg("text", { x: W / 2, y: H - 2, "text-anchor": "middle" }, "jumlah cluster k"));
    s.appendChild(svg("polyline", { points: curve.map((c) => `${kx(c.k)},${yi(c.inertia)}`).join(" "), fill: "none", stroke: "#234386", "stroke-width": 2 }));
    s.appendChild(svg("polyline", { points: curve.map((c) => `${kx(c.k)},${ys(c.silhouette ?? 0)}`).join(" "), fill: "none", stroke: "#ed7328", "stroke-width": 2 }));
    curve.forEach((c) => { s.appendChild(svg("circle", { cx: kx(c.k), cy: yi(c.inertia), r: 3.5, fill: "#234386" })); s.appendChild(svg("circle", { cx: kx(c.k), cy: ys(c.silhouette ?? 0), r: 3.5, fill: "#ed7328" })); });
    const box = $("#elbow"); box.innerHTML = ""; box.appendChild(s);
    box.insertAdjacentHTML("beforeend", `<div class="legend"><span><i style="background:#234386"></i>Inertia (elbow)</span><span><i style="background:#ed7328"></i>Silhouette</span></div>` +
      `<p class="hint">Alat bantu, bukan bukti jumlah cluster yang paling benar. Dihitung pada seluruh data hanya untuk eksplorasi.</p>`);
  }

  function distChart(S, names) {
    const max = Math.max(...names.map((n) => S.class_distribution[n].crops), 1);
    const decl = (S.audit && S.audit.zenodo_declared_images) || {};
    $("#dist").innerHTML = names.map((n) => {
      const d = S.class_distribution[n];
      return `<div class="bar-row" style="grid-template-columns:130px 1fr 120px"><span>${esc(titleCase(n))}</span>` +
        `<div class="bar-track"><div class="bar-fill" style="width:${(d.crops / max * 100).toFixed(1)}%"></div></div>` +
        `<span class="bar-val">${d.crops} crop · ${d.groups} gbr</span></div>`;
    }).join("") + `<p class="hint">Jumlah crop tidak sama dengan jumlah gambar. Zenodo mencantumkan jumlah gambar per kelas: ` +
      names.map((n) => `${esc(titleCase(n))} ${decl[n] ?? "?"}`).join(", ") + ".</p>";
  }

  document.addEventListener("DOMContentLoaded", () => {
    const page = document.body.dataset.page;
    if (page === "demo") initDemo();
    if (page === "results") initDash();
  });
})();
