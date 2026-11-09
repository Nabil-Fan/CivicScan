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
