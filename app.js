/* =========================================================
   EMMA Value Sheet — app logic (vanilla JS, no build step)
   Parts and values come from data/parts.json (EMMA ASIA values).
   Competitors pick parts; they never type a price.
   ========================================================= */
(() => {
  "use strict";

  /* ---------- Settings ---------- */
  // Unit shown next to values, e.g. "€" or "pts". Leave "" to show plain numbers.
  const VALUE_UNIT = "";
  const DATA_URL = "data/parts.json";
  const PAGE_SIZE = 60;

  /* ---------- Reference data ---------- */
  const CLASSES = [
    "SQ Super Entry", "SQ E-Cat 3000", "SQ E-Cat unlimited", "SQ S-Cat 4000", "SQ S-Cat unlimited",
    "SQ S-Cat OEM", "SQ M-Cat 8000", "SQ M-Cat OEM", "SQ M-Cat limited", "SQ M-Cat unlimited",
    "SQ X-Cat limited", "SQ X-Cat unlimited", "SQ M-Cat OEM 4000", "MM M-Cat", "Tuning Stock+",
    "Tuning Custom Trunk", "Tuning Custom unlimited", "ESPL Trunk 3000", "ESPL Trunk Limited",
    "ESPL B/R 4000", "ESPL B/R Limited", "ESPL Wall 8000", "ESPL Wall Limited", "ESPL Expert",
    "ESQL Limited", "ESQL Unlimited"
  ];

  // `type` in parts.json uses these ids
  const CATEGORIES = [
    { id: "source",  label: "Source unit" },
    { id: "dsp",     label: "Processor / DSP" },
    { id: "amp",     label: "Amplifier" },
    { id: "speaker", label: "Speaker" },
    { id: "sub",     label: "Subwoofer" },
    { id: "power",   label: "Power & battery" },
    { id: "cable",   label: "Cables & wiring" },
    { id: "other",   label: "Other" }
  ];

  const CAR_BRANDS = [
    "Audi", "BMW", "BYD", "Chevrolet", "Ford", "Honda", "Hyundai", "Isuzu", "Kia", "Lexus", "Mazda",
    "Mercedes-Benz", "MINI", "Mitsubishi", "Nissan", "Porsche", "Subaru", "Suzuki", "Tesla", "Toyota",
    "Volkswagen", "Volvo"
  ];

  /* ---------- Helpers ---------- */
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const num = (v) => { const n = parseFloat(String(v ?? "").replace(/[^\d.\-]/g, "")); return Number.isFinite(n) ? n : 0; };
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const partId = (brand, model) => (brand + "|" + model).toLowerCase().replace(/\s+/g, " ").trim();
  const nf = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
  const fmt = (v) => (VALUE_UNIT && VALUE_UNIT.length === 1 ? VALUE_UNIT : "") + nf.format(v) + (VALUE_UNIT.length > 1 ? " " + VALUE_UNIT : "");
  const catLabel = (id) => (CATEGORIES.find((c) => c.id === id) || CATEGORIES.at(-1)).label;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------- Catalog ---------- */
  let CATALOG = [];           // [{id, brand, model, type, from, till, description, value, year, _hay}]
  let CATALOG_BY_ID = new Map();

  async function loadCatalog() {
    try {
      const res = await fetch(DATA_URL, { cache: "no-cache" });
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      const rows = Array.isArray(data) ? data : data.parts || [];
      CATALOG = rows
        .filter((r) => r && r.brand && r.model)
        .map((r) => {
          const item = {
            id: r.id ? String(r.id) : partId(r.brand, r.model) + (r.year ? "|" + r.year : ""),
            brand: String(r.brand).trim(),
            model: String(r.model).trim(),
            type: CATEGORIES.some((c) => c.id === r.type) ? r.type : "other",
            from: r.from ? String(r.from) : "",
            till: r.till ? String(r.till) : "",
            description: r.description ? String(r.description) : "",
            value: num(r.value),
            year: r.year ? String(r.year) : ""
          };
          item._hay = (item.brand + " " + item.model + " " + item.description).toLowerCase();
          return item;
        })
        .sort((a, b) => a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model, undefined, { numeric: true }) || String(b.year).localeCompare(String(a.year)));
      CATALOG_BY_ID = new Map(CATALOG.map((p) => [p.id, p]));
      catalogMeta = data.updated ? `Values as of ${data.updated}` : "";
    } catch (e) {
      catalogError = true;
    }
  }
  let catalogMeta = "";
  let catalogError = false;

  /* ---------- Storage ---------- */
  const STORE_KEY = "emma-value-sheet:v2";
  const OLD_KEY = "emma-value-sheet:v1";

  const blankProfile = () => ({
    id: uid(),
    firstName: "", lastName: "", team: "",
    carBrand: "", carModel: "", carYear: "",
    cls: CLASSES[1],
    parts: [],               // [{pid, qty, snap:{brand, model, type, description, value, year}}]
    updated: Date.now()
  });

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data && data.profiles && Object.keys(data.profiles).length) {
          if (!data.profiles[data.activeId]) data.activeId = Object.keys(data.profiles)[0];
          return data;
        }
      }
      // migrate profile details from v1 (manual prices are dropped on purpose)
      const old = JSON.parse(localStorage.getItem(OLD_KEY) || "null");
      if (old && old.profiles) {
        const profiles = {};
        Object.values(old.profiles).forEach((p) => {
          const n = { ...blankProfile(), ...pick(p, ["firstName", "lastName", "team", "carBrand", "carModel", "carYear", "cls"]), id: p.id || uid() };
          profiles[n.id] = n;
        });
        const ids = Object.keys(profiles);
        if (ids.length) return { activeId: profiles[old.activeId] ? old.activeId : ids[0], profiles };
      }
    } catch (e) { /* storage blocked or corrupt — start fresh */ }
    const p = blankProfile();
    return { activeId: p.id, profiles: { [p.id]: p } };
  }
  const pick = (o, keys) => keys.reduce((a, k) => (o && o[k] != null ? ((a[k] = String(o[k])), a) : a), {});

  let state = load();
  let saveTimer = null;
  function save() {
    active().updated = Date.now();
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
    flashSaved();
  }
  const active = () => state.profiles[state.activeId];

  // Resolve a sheet line to live catalog data (falls back to snapshot if a part was removed from the database)
  function resolve(line) {
    const live = CATALOG_BY_ID.get(line.pid);
    return live ? { ...live, missing: false } : { ...line.snap, id: line.pid, missing: CATALOG.length > 0 };
  }
  const lineTotal = (line) => num(line.qty) * num(resolve(line).value);
  const total = (prof = active()) => prof.parts.reduce((s, l) => s + lineTotal(l), 0);
  const qtyOf = (pid) => (active().parts.find((l) => l.pid === pid) || {}).qty || 0;

  function profileName(p) {
    const name = [p.firstName, p.lastName].filter(Boolean).join(" ");
    const car = [p.carBrand, p.carModel].filter(Boolean).join(" ");
    return name || car || "Untitled profile";
  }
  const carTitle = (p) => [p.carBrand, p.carModel].filter(Boolean).join(" ") || "Your car";
  function classLimit(cls) {
    const m = /(\d{4,5})\s*$/.exec(cls || "");
    return m ? parseInt(m[1], 10) : null;
  }

  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("is-on"), 2200);
  }
  function flashSaved() {
    const el = $("#savedIndicator");
    el.classList.add("is-on");
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => el.classList.remove("is-on"), 1400);
  }

  /* ---------- Static UI ---------- */
  function fillStatic() {
    $("#classSelect").innerHTML = CLASSES.map((c) => `<option>${esc(c)}</option>`).join("");
    $("#carBrands").innerHTML = CAR_BRANDS.map((b) => `<option value="${esc(b)}"></option>`).join("");
  }

  function fillCatalogFilters() {
    const brands = [...new Set(CATALOG.map((p) => p.brand))];
    $("#brandFilter").innerHTML = `<option value="">All brands (${brands.length})</option>` +
      brands.map((b) => `<option value="${esc(b)}">${esc(b)}</option>`).join("");
    const present = new Set(CATALOG.map((p) => p.type));
    const cats = CATEGORIES.filter((c) => present.has(c.id));
    $("#typeChips").innerHTML = `<button type="button" class="chip" role="radio" data-type="" aria-checked="true">All</button>` +
      cats.map((c) => `<button type="button" class="chip" role="radio" data-type="${c.id}" aria-checked="false">${c.label}</button>`).join("");
    $("#catMeta").textContent = catalogMeta;
  }

  /* ---------- Catalog rendering ---------- */
  const filters = { q: "", brand: "", type: "", limit: PAGE_SIZE };

  function filteredCatalog() {
    const terms = filters.q.toLowerCase().split(/\s+/).filter(Boolean);
    return CATALOG.filter((p) =>
      (!filters.brand || p.brand === filters.brand) &&
      (!filters.type || p.type === filters.type) &&
      terms.every((t) => p._hay.includes(t))
    );
  }

  function renderCatalog() {
    const body = $("#catBody");
    const empty = $("#catEmpty");
    if (catalogError) {
      body.innerHTML = "";
      empty.hidden = false;
      empty.innerHTML = `<strong>Parts database couldn’t load.</strong><br>Check that <code>data/parts.json</code> is deployed with the site.`;
      $("#catCount").textContent = "";
      $("#catMore").hidden = true;
      return;
    }
    const rows = filteredCatalog();
    const shown = rows.slice(0, filters.limit);
    empty.hidden = rows.length > 0;
    if (!rows.length) empty.innerHTML = CATALOG.length
      ? `No parts match “${esc(filters.q)}”. Try a shorter search or another brand.`
      : "The parts database is empty.";

    body.innerHTML = shown.map((p) => {
      const q = qtyOf(p.id);
      return `<tr data-pid="${esc(p.id)}" class="${q ? "is-added" : ""}">
        <td class="c-name">
          <span class="c-brand">${esc(p.brand)}</span>
          <span class="c-model">${esc(p.model)}</span>
          <span class="c-type">${esc(catLabel(p.type))}</span>
          ${p.from || p.till ? `<span class="c-span">${esc(p.from || "…")}–${esc(p.till || "")}</span>` : ""}
        </td>
        <td class="c-from" data-label="From">${esc(p.from) || "—"}</td>
        <td class="c-till" data-label="Till">${esc(p.till) || "—"}</td>
        <td class="c-desc">${esc(p.description)}</td>
        <td class="num c-val">${fmt(p.value)}</td>
        <td class="num c-year">${esc(p.year)}</td>
        <td class="c-add">
          <button type="button" class="add-btn" data-add aria-label="Add ${esc(p.brand)} ${esc(p.model)}">
            ${q ? `<span class="add-btn__q">${q}</span>` : ""}
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
          </button>
        </td>
      </tr>`;
    }).join("");

    $("#catCount").textContent = rows.length
      ? `Showing ${shown.length} of ${rows.length.toLocaleString()} parts`
      : "";
    $("#catMore").hidden = rows.length <= shown.length;
  }

  function bindCatalog() {
    let t;
    $("#catSearch").addEventListener("input", (e) => {
      clearTimeout(t);
      t = setTimeout(() => { filters.q = e.target.value.trim(); filters.limit = PAGE_SIZE; renderCatalog(); }, 120);
    });
    $("#brandFilter").addEventListener("change", (e) => { filters.brand = e.target.value; filters.limit = PAGE_SIZE; renderCatalog(); });
    $("#typeChips").addEventListener("click", (e) => {
      const b = e.target.closest(".chip");
      if (!b) return;
      filters.type = b.dataset.type;
      filters.limit = PAGE_SIZE;
      $$("#typeChips .chip").forEach((c) => c.setAttribute("aria-checked", String(c === b)));
      renderCatalog();
    });
    $("#catMore").addEventListener("click", () => { filters.limit += PAGE_SIZE; renderCatalog(); });
    $("#catBody").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-add]");
      if (!btn) return;
      addPart(btn.closest("tr").dataset.pid);
    });
  }

  function addPart(pid) {
    const p = CATALOG_BY_ID.get(pid);
    if (!p) return;
    const prof = active();
    const line = prof.parts.find((l) => l.pid === pid);
    if (line) line.qty += 1;
    else prof.parts.push({ pid, qty: 1, snap: snapOf(p) });
    save();
    toast(`${p.brand} ${p.model} added${line ? ` · ×${line.qty}` : ""}`);
    const bar = $("#sheetBar");
    bar.classList.remove("is-pulse"); void bar.offsetWidth; bar.classList.add("is-pulse");
    renderHero(); renderSheet(); renderCatalog();
  }
  const snapOf = (p) => ({ brand: p.brand, model: p.model, type: p.type, description: p.description, value: p.value, year: p.year });

  /* ---------- Hero / profile ---------- */
  function renderProfileSelect() {
    const sel = $("#profileSelect");
    sel.innerHTML = "";
    Object.values(state.profiles).sort((a, b) => b.updated - a.updated).forEach((p) => {
      const o = document.createElement("option");
      o.value = p.id;
      o.textContent = profileName(p);
      o.selected = p.id === state.activeId;
      sel.appendChild(o);
    });
  }

  function renderProfileForm() {
    const p = active();
    const f = $("#profileForm");
    ["firstName", "lastName", "team", "carBrand", "carModel", "carYear", "cls"].forEach((k) => {
      if (f.elements[k]) f.elements[k].value = p[k] ?? "";
    });
  }

  function renderHero() {
    const p = active();
    const t = total(p);
    const heroCar = $("#heroCar");
    heroCar.textContent = "";
    const words = carTitle(p).split(" ");
    heroCar.append(document.createTextNode(words[0] + (words.length > 1 ? " " : "")));
    if (words.length > 1) { const b = document.createElement("b"); b.textContent = words.slice(1).join(" "); heroCar.append(b); }
    if (p.carYear) heroCar.append(document.createTextNode(" ’" + String(p.carYear).slice(-2)));

    const name = [p.firstName, p.lastName].filter(Boolean).join(" ");
    $("#heroOwner").textContent = name ? name + (p.team ? " — " + p.team : "") : (p.team || "Add your name and team below");
    $("#heroClass").textContent = (p.cls || "Sound Quality") + " · Value Sheet";
    $("#heroTotal").textContent = fmt(t);
    const pieces = p.parts.reduce((s, l) => s + num(l.qty), 0);
    $("#barTotal").textContent = fmt(t);
    $("#barCount").textContent = `${pieces} part${pieces === 1 ? "" : "s"} · total`;
    renderProfileSummary();
    $("#heroCount").textContent = p.parts.reduce((s, l) => s + num(l.qty), 0);
    $("#heroCats").textContent = new Set(p.parts.map((l) => resolve(l).type)).size;

    const limit = classLimit(p.cls);
    const box = $("#limitBox");
    box.hidden = !limit;
    if (limit) {
      $("#limitFill").style.width = Math.min(100, (t / limit) * 100) + "%";
      $("#limitLabel").textContent = `${p.cls} limit`;
      const left = limit - t;
      $("#limitText").textContent = left >= 0 ? `${fmt(t)} of ${fmt(limit)} · ${fmt(left)} left` : `${fmt(-left)} over ${fmt(limit)}`;
      box.classList.toggle("is-over", left < 0);
    }
  }

  /* ---------- Sheet ---------- */
  function renderSheet() {
    const p = active();
    const body = $("#sheetBody");
    body.innerHTML = "";

    if (!p.parts.length) {
      body.innerHTML = `<div class="empty">
        <p class="empty__title">No components yet</p>
        <p>Find your parts in the catalog and press <b>+</b>. Values fill in automatically from the EMMA ASIA database.</p>
      </div>`;
    } else {
      const lines = p.parts.map((l) => ({ l, r: resolve(l) }));
      CATEGORIES.forEach((c) => {
        const items = lines.filter((x) => x.r.type === c.id);
        if (!items.length) return;
        const g = document.createElement("div");
        g.className = "group";
        g.innerHTML = `<div class="group__head"><span class="group__name">${c.label}</span>
          <span class="group__sub">${fmt(items.reduce((s, x) => s + lineTotal(x.l), 0))}</span></div>`;
        items.forEach(({ l, r }) => {
          const row = document.createElement("div");
          row.className = "item" + (r.missing ? " is-missing" : "");
          row.dataset.pid = l.pid;
          row.innerHTML = `
            <div class="item__main">
              <div class="item__brand">${esc(r.brand)}</div>
              <div class="item__model">${esc(r.model)}</div>
              <div class="item__note">${r.description ? esc(r.description) + " · " : ""}ASIA value ${fmt(r.value)}${r.year ? " (" + esc(r.year) + ")" : ""}${r.missing ? " · <em>no longer in database</em>" : ""}</div>
            </div>
            <div class="qty" aria-label="Quantity">
              <button type="button" data-act="minus" aria-label="Decrease quantity">−</button>
              <span>${num(l.qty)}</span>
              <button type="button" data-act="plus" aria-label="Increase quantity">+</button>
            </div>
            <div class="item__total">${fmt(lineTotal(l))}</div>
            <div class="item__actions"><button type="button" class="link-btn link-btn--danger" data-act="del">Remove</button></div>`;
          g.appendChild(row);
        });
        body.appendChild(g);
      });
    }
    $("#sheetTotal").textContent = fmt(total(p));
  }

  function bindSheet() {
    $("#sheetBody").addEventListener("click", (e) => {
      const b = e.target.closest("[data-act]");
      if (!b) return;
      const pid = b.closest(".item").dataset.pid;
      const prof = active();
      const idx = prof.parts.findIndex((l) => l.pid === pid);
      if (idx < 0) return;
      const line = prof.parts[idx];
      if (b.dataset.act === "plus") line.qty += 1;
      if (b.dataset.act === "minus") line.qty = Math.max(1, line.qty - 1);
      if (b.dataset.act === "del") {
        prof.parts.splice(idx, 1);
        const r = resolve(line);
        toast(`${r.brand} ${r.model} removed`);
      }
      save(); renderHero(); renderSheet(); renderCatalog();
    });
  }

  /* ---------- Profile form ---------- */
  function bindProfileForm() {
    const f = $("#profileForm");
    f.addEventListener("input", (e) => {
      const k = e.target.name;
      if (!k) return;
      active()[k] = e.target.value;
      save();
      renderHero();
      if (["firstName", "lastName", "carBrand", "carModel"].includes(k)) renderProfileSelect();
    });
    f.addEventListener("submit", (e) => e.preventDefault());
  }

  /* ---------- Profiles ---------- */
  function renderAll() {
    renderProfileSelect();
    renderProfileForm();
    renderHero();
    renderSheet();
    renderCatalog();
  }

  function switchProfile(id) {
    state.activeId = id;
    const p = state.profiles[id];
    if (p && !(p.firstName && p.carBrand)) setProfileCollapsed(false);
    save();
    renderAll();
  }

  function bindProfiles() {
    $("#profileSelect").addEventListener("change", (e) => switchProfile(e.target.value));
    $("#newProfileBtn").addEventListener("click", () => {
      const p = blankProfile();
      state.profiles[p.id] = p;
      switchProfile(p.id);
      toast("New profile created");
      $("#profileForm").elements.firstName.focus();
    });

    const menuBtn = $("#menuBtn"), panel = $("#menuPanel");
    const closeMenu = () => { panel.hidden = true; menuBtn.setAttribute("aria-expanded", "false"); };
    menuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      panel.hidden = !panel.hidden;
      menuBtn.setAttribute("aria-expanded", String(!panel.hidden));
    });
    document.addEventListener("click", (e) => { if (!panel.contains(e.target)) closeMenu(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });

    panel.addEventListener("click", (e) => {
      const act = e.target.dataset.action;
      if (!act) return;
      closeMenu();
      const p = active();
      if (act === "duplicate") {
        const copy = JSON.parse(JSON.stringify(p));
        copy.id = uid();
        copy.carModel = (copy.carModel || "") + " (copy)";
        state.profiles[copy.id] = copy;
        switchProfile(copy.id);
        toast("Profile duplicated");
      }
      if (act === "delete") {
        if (!confirm(`Delete “${profileName(p)}” and all its components?`)) return;
        delete state.profiles[p.id];
        if (!Object.keys(state.profiles).length) { const n = blankProfile(); state.profiles[n.id] = n; }
        switchProfile(Object.values(state.profiles).sort((a, b) => b.updated - a.updated)[0].id);
        toast("Profile deleted");
      }
      if (act === "export") exportJSON();
      if (act === "import") $("#importInput").click();
    });

    $("#importInput").addEventListener("change", async (e) => {
      const file = e.target.files[0];
      e.target.value = "";
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        const list = data.profiles ? Object.values(data.profiles) : (Array.isArray(data) ? data : [data]);
        let lastId = null, count = 0;
        list.forEach((raw) => {
          if (!raw || typeof raw !== "object") return;
          const p = { ...blankProfile(), ...pick(raw, ["firstName", "lastName", "team", "carBrand", "carModel", "carYear"]) };
          if (CLASSES.includes(raw.cls)) p.cls = raw.cls;
          // Only parts that exist in the database are imported, so values can't be edited by hand
          (Array.isArray(raw.parts) ? raw.parts : []).slice(0, 500).forEach((l) => {
            const live = l && CATALOG_BY_ID.get(l.pid);
            if (live) p.parts.push({ pid: live.id, qty: Math.max(1, Math.round(num(l.qty)) || 1), snap: snapOf(live) });
          });
          state.profiles[p.id] = p; lastId = p.id; count++;
        });
        if (!count) throw new Error("no profiles");
        switchProfile(lastId);
        toast(`Imported ${count} profile${count > 1 ? "s" : ""}`);
      } catch (err) {
        toast("That file isn’t a valid value sheet export");
      }
    });
  }

  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "value-sheet";

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function exportJSON() {
    const p = active();
    const blob = new Blob([JSON.stringify({ app: "emma-value-sheet", version: 2, profiles: { [p.id]: p } }, null, 2)], { type: "application/json" });
    downloadBlob(blob, `emma-${slug(profileName(p))}.json`);
    toast("Data exported");
  }

  /* =========================================================
     IMAGE EXPORT — drawn natively on <canvas>
     ========================================================= */
  const logoImg = new Image();
  let logoReady = false;
  logoImg.onload = () => { logoReady = true; };
  logoImg.src = "assets/emma-logo.png";

  function fitText(ctx, text, maxW) {
    text = String(text ?? "");
    if (maxW <= 0) return "";
    if (ctx.measureText(text).width <= maxW) return text;
    let t = text;
    while (t.length > 1 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
    return t + "…";
  }

  async function renderImage() {
    const p = active();
    if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (e) {} }

    const W = 1200, PAD = 72, SCALE = 2;
    const DISP = '"Archivo", "Helvetica Neue", Arial, sans-serif';
    const BODY = '"Inter", "Helvetica Neue", Arial, sans-serif';
    const INK = "#0e0e12", INK2 = "#3b3b42", MUTED = "#7a7a82", LINE = "#e2e0db", ACCENT = "#c8102e";

    const lines = p.parts.map((l) => ({ l, r: resolve(l) }));
    const groups = CATEGORIES.map((c) => ({ c, items: lines.filter((x) => x.r.type === c.id) })).filter((g) => g.items.length);
    const ROW = 64, GROUP_HEAD = 58, HEADER = 150, HERO = 300, TABLE_HEAD = 44, TOTAL = 150, FOOT = 80;
    const rowsH = groups.reduce((s, g) => s + GROUP_HEAD + g.items.length * ROW, 0) || 90;
    const H = HEADER + HERO + TABLE_HEAD + rowsH + 40 + TOTAL + FOOT;

    const cv = document.createElement("canvas");
    cv.width = W * SCALE; cv.height = H * SCALE;
    const ctx = cv.getContext("2d");
    ctx.scale(SCALE, SCALE);

    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = ACCENT; ctx.fillRect(0, 0, W, 6);

    // header
    let y = 56;
    if (logoReady && logoImg.naturalWidth) {
      const lh = 60, lw = (logoImg.naturalWidth / logoImg.naturalHeight) * lh;
      ctx.drawImage(logoImg, PAD, y, Math.min(lw, 260), lh);
    } else {
      ctx.fillStyle = INK; ctx.font = `800 40px ${DISP}`;
      ctx.fillText("EMMA", PAD, y + 46);
    }
    ctx.textAlign = "right";
    ctx.fillStyle = INK; ctx.font = `600 15px ${DISP}`;
    ctx.fillText("CAR AUDIO VALUE SHEET", W - PAD, y + 24);
    ctx.fillStyle = MUTED; ctx.font = `400 14px ${BODY}`;
    ctx.fillText(new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }), W - PAD, y + 48);
    ctx.textAlign = "left";

    y = HEADER;
    ctx.fillStyle = INK; ctx.fillRect(PAD, y, W - PAD * 2, 1.5);

    // hero
    y += 54;
    ctx.fillStyle = ACCENT; ctx.font = `600 14px ${DISP}`;
    ctx.fillText((p.cls || "").toUpperCase(), PAD, y);
    y += 64;
    ctx.fillStyle = INK; ctx.font = `300 56px ${DISP}`;
    ctx.fillText(fitText(ctx, carTitle(p) + (p.carYear ? `  ${p.carYear}` : ""), W - PAD * 2), PAD, y);
    y += 44;
    const name = [p.firstName, p.lastName].filter(Boolean).join(" ") || "—";
    ctx.fillStyle = INK2; ctx.font = `500 20px ${BODY}`;
    ctx.fillText(fitText(ctx, name + (p.team ? "   ·   " + p.team : ""), W - PAD * 2), PAD, y);

    y += 62;
    const colW = (W - PAD * 2) / 3;
    const limit = classLimit(p.cls);
    [["COMPONENTS", String(lines.reduce((s, x) => s + num(x.l.qty), 0))],
     ["CATEGORIES", String(groups.length)],
     ["CLASS LIMIT", limit ? fmt(limit) : "—"]].forEach(([k, v], i) => {
      const x = PAD + colW * i;
      ctx.fillStyle = MUTED; ctx.font = `500 12px ${DISP}`; ctx.fillText(k, x, y);
      ctx.fillStyle = INK; ctx.font = `500 26px ${DISP}`; ctx.fillText(v, x, y + 34);
    });

    // table header
    y = HEADER + HERO;
    const C_QTY = W - PAD - 330, C_UNIT = W - PAD - 170, C_TOT = W - PAD;
    ctx.fillStyle = MUTED; ctx.font = `500 12px ${DISP}`;
    ctx.fillText("COMPONENT", PAD, y + 26);
    ctx.textAlign = "right";
    ctx.fillText("QTY", C_QTY, y + 26);
    ctx.fillText("ASIA VALUE", C_UNIT, y + 26);
    ctx.fillText("TOTAL", C_TOT, y + 26);
    ctx.textAlign = "left";
    y += TABLE_HEAD;
    ctx.fillStyle = LINE; ctx.fillRect(PAD, y - 1, W - PAD * 2, 1);

    if (!groups.length) {
      ctx.fillStyle = MUTED; ctx.font = `400 18px ${BODY}`;
      ctx.fillText("No components added yet.", PAD, y + 54);
      y += 90;
    }
    groups.forEach((g) => {
      y += 40;
      ctx.fillStyle = INK; ctx.font = `700 13px ${DISP}`;
      ctx.fillText(g.c.label.toUpperCase(), PAD, y);
      ctx.textAlign = "right"; ctx.font = `500 14px ${BODY}`; ctx.fillStyle = INK2;
      ctx.fillText(fmt(g.items.reduce((s, x) => s + lineTotal(x.l), 0)), C_TOT, y);
      ctx.textAlign = "left";
      y += 18;
      ctx.fillStyle = INK; ctx.fillRect(PAD, y - 1, W - PAD * 2, 1.2);

      g.items.forEach(({ l, r }) => {
        const maxW = C_QTY - PAD - 80;
        ctx.fillStyle = MUTED; ctx.font = `500 12px ${BODY}`;
        ctx.fillText(fitText(ctx, r.brand.toUpperCase(), maxW), PAD, y + 24);
        ctx.fillStyle = INK; ctx.font = `600 18px ${BODY}`;
        const model = fitText(ctx, r.model, maxW);
        ctx.fillText(model, PAD, y + 48);
        const sub = [r.description, r.year ? `value ${r.year}` : ""].filter(Boolean).join(" · ");
        if (sub) {
          const mw = ctx.measureText(model).width;
          ctx.fillStyle = MUTED; ctx.font = `400 14px ${BODY}`;
          ctx.fillText(fitText(ctx, "  ·  " + sub, maxW - mw), PAD + mw, y + 48);
        }
        ctx.textAlign = "right";
        ctx.fillStyle = INK2; ctx.font = `400 16px ${BODY}`;
        ctx.fillText(String(num(l.qty)), C_QTY, y + 40);
        ctx.fillText(fmt(r.value), C_UNIT, y + 40);
        ctx.fillStyle = INK; ctx.font = `600 18px ${DISP}`;
        ctx.fillText(fmt(lineTotal(l)), C_TOT, y + 40);
        ctx.textAlign = "left";
        y += ROW;
        ctx.fillStyle = LINE; ctx.fillRect(PAD, y - 1, W - PAD * 2, 1);
      });
    });

    // total band
    y += 40;
    ctx.fillStyle = INK; ctx.fillRect(PAD, y, W - PAD * 2, TOTAL - 30);
    ctx.fillStyle = "rgba(255,255,255,.7)"; ctx.font = `500 14px ${DISP}`;
    ctx.fillText("TOTAL SYSTEM VALUE", PAD + 36, y + 70);
    if (limit) {
      const t = total(p);
      ctx.fillStyle = t > limit ? "#ff8a9a" : "rgba(255,255,255,.5)"; ctx.font = `400 14px ${BODY}`;
      ctx.fillText(t > limit ? `${fmt(t - limit)} over class limit` : `${fmt(limit - t)} under class limit`, PAD + 36, y + 94);
    }
    ctx.textAlign = "right"; ctx.fillStyle = "#fff"; ctx.font = `600 52px ${DISP}`;
    ctx.fillText(fmt(total(p)), W - PAD - 36, y + 80);
    ctx.textAlign = "left";

    y += TOTAL + 10;
    ctx.fillStyle = MUTED; ctx.font = `400 12.5px ${BODY}`;
    ctx.fillText("Values from the EMMA ASIA value database" + (catalogMeta ? ` (${catalogMeta.replace(/^Values /, "")})` : "") + ". Subject to verification by EMMA judges.", PAD, y);

    return cv;
  }

  async function downloadImage() {
    const btn = $("#downloadBtn");
    btn.disabled = true;
    try {
      const cv = await renderImage();
      const name = `emma-value-sheet-${slug(profileName(active()))}.png`;
      await new Promise((resolveP, reject) => {
        cv.toBlob((blob) => {
          if (!blob) return reject(new Error("toBlob failed"));
          const file = typeof File === "function" ? new File([blob], name, { type: "image/png" }) : null;
          if (file && navigator.canShare && navigator.canShare({ files: [file] }) && matchMedia("(pointer: coarse)").matches) {
            navigator.share({ files: [file], title: "EMMA Value Sheet" }).catch(() => downloadBlob(blob, name)).finally(resolveP);
          } else {
            downloadBlob(blob, name);
            resolveP();
          }
        }, "image/png");
      });
      toast("Value sheet saved as image");
    } catch (e) {
      console.error(e);
      toast("Couldn’t create the image — try again");
    } finally {
      btn.disabled = false;
    }
  }

  /* ---------- Mobile / tablet: sheet drawer + collapsible profile ---------- */
  const compactMQ = matchMedia("(max-width: 960px)");

  function setSheetOpen(open) {
    const panel = $("#sheetPanel");
    panel.classList.toggle("is-open", open);
    $("#backdrop").hidden = !open;
    document.body.classList.toggle("drawer-open", open);
    $("#openSheet").setAttribute("aria-expanded", String(open));
    if (open) panel.scrollTop = 0;
  }

  function bindDrawer() {
    $("#openSheet").addEventListener("click", () => setSheetOpen(true));
    $("#closeSheet").addEventListener("click", () => setSheetOpen(false));
    $("#backdrop").addEventListener("click", () => setSheetOpen(false));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") setSheetOpen(false); });
    compactMQ.addEventListener("change", (e) => { if (!e.matches) setSheetOpen(false); });

    // swipe down on the handle/header to close
    let startY = null;
    const head = $("#sheetPanel .card__head");
    const handle = $("#sheetPanel .drawer-handle");
    [head, handle].forEach((el) => {
      el.addEventListener("touchstart", (e) => { startY = e.touches[0].clientY; }, { passive: true });
      el.addEventListener("touchend", (e) => {
        if (startY !== null && e.changedTouches[0].clientY - startY > 60) setSheetOpen(false);
        startY = null;
      });
    });
  }

  function renderProfileSummary() {
    const p = active();
    const name = [p.firstName, p.lastName].filter(Boolean).join(" ");
    const el = $("#profileSummary");
    if (el) el.textContent = [name, carTitle(p) !== "Your car" ? carTitle(p) : ""].filter(Boolean).join(" · ");
  }

  function setProfileCollapsed(collapsed) {
    $("#profileForm").closest(".card").classList.toggle("is-collapsed", collapsed);
    $("#profileToggle").setAttribute("aria-expanded", String(!collapsed));
  }

  function bindProfileToggle() {
    $("#profileToggle").addEventListener("click", () => {
      const card = $("#profileForm").closest(".card");
      setProfileCollapsed(!card.classList.contains("is-collapsed"));
    });
  }

  /* ---------- Init ---------- */
  async function init() {
    fillStatic();
    bindProfileForm();
    bindCatalog();
    bindSheet();
    bindProfiles();
    $("#downloadBtn").addEventListener("click", downloadImage);
    bindDrawer();
    bindProfileToggle();
    // On phones/tablets, start with the profile folded away once it's filled in
    if (compactMQ.matches && active().firstName && active().carBrand) setProfileCollapsed(true);
    renderProfileSelect(); renderProfileForm(); renderHero(); renderSheet();
    $("#catBody").innerHTML = `<tr><td colspan="7" class="loading">Loading parts database…</td></tr>`;
    await loadCatalog();
    fillCatalogFilters();
    renderAll();
  }
  init();

  window.__emma = { renderImage, state: () => state, addPart };
})();
