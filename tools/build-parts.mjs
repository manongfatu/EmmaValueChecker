#!/usr/bin/env node
/**
 * Builds data/parts.json from the brand tables in data/source/.
 *
 * One file per brand: data/source/<anything>.tsv (or .txt / .csv)
 * Paste the table straight from emmanet.com — tab-separated is what browsers copy.
 *
 *   # brand: A/D/S          <- required (brand name exactly as on emmanet)
 *   # type: amp             <- optional default category for this file
 *   model	from	till	description	ASIA value	of	[type]
 *   460MX			4-channel amplifier	1342	2018
 *
 * Header row is optional (detected if it contains "model"). Columns are matched by name,
 * so an extra "more" column or the empty icon column copied from the site is ignored.
 * An optional "type" column overrides the category per row.
 * Category ids: source, dsp, amp, speaker, sub, power, cable, other.
 * If no type is given, it is guessed from the description.
 *
 * Also reads data/source/*.html — the "All articles" table saved from emmanet.com
 * (cmd=LA without a brand). Brand, category icon and article id come from the HTML.
 *
 * Run:  node tools/build-parts.mjs
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "data", "source");
const outFile = join(root, "data", "parts.json");
const TYPES = ["source", "dsp", "amp", "speaker", "sub", "power", "cable", "other"];

function guessType(desc) {
  const d = (desc || "").toLowerCase();
  if (/sub ?woofer|subwoofer/.test(d)) return "sub";
  if (/amp(lifier)?\b|channel/.test(d)) return "amp";
  if (/dsp|processor|equali[sz]er|crossover/.test(d)) return "dsp";
  if (/tweeter|mid ?range|woofer|speaker|component|coax|full ?range/.test(d)) return "speaker";
  if (/head ?unit|player|radio|receiver|source|dap|streamer|dac/.test(d)) return "source";
  if (/battery|capacitor|power|fuse|distribution/.test(d)) return "power";
  if (/cable|wire|rca|interconnect/.test(d)) return "cable";
  return null;
}

function splitLine(line, sep) {
  if (sep === "\t") return line.split("\t").map((s) => s.trim());
  // minimal CSV with quotes
  const out = []; let cur = ""; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true; else if (c === sep) { out.push(cur.trim()); cur = ""; } else cur += c;
  }
  out.push(cur.trim());
  return out;
}

const ICON_TYPES = {
  "speaker": "speaker", "amplifier": "amp", "subwoofer": "sub", "headunit": "source",
  "sound prozessor": "dsp", "sound processor": "dsp", "battery": "power",
  "changer or other head unit": "source", "cable": "cable"
};
function decode(s) {
  return s.replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/\s+/g, " ").trim();
}

const parts = [];
const seen = new Set();
const warnings = [];

for (const file of readdirSync(srcDir).filter((f) => /\.html?$/i.test(f)).sort()) {
  const text = readFileSync(join(srcDir, file), "utf8");
  for (const [, tr] of text.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]);
    if (cells.length < 8) continue;
    const brand = decode(cells[0]), model = decode(cells[1]);
    const value = parseFloat(decode(cells[6]).replace(/[^\d.]/g, ""));
    if (!brand || !model) continue;
    if (!Number.isFinite(value)) { warnings.push(`${file}: "${brand} ${model}" has no value, skipped`); continue; }
    const icon = ((/alt="([^"]*)"/i.exec(cells[2]) || [])[1] || "").toLowerCase();
    const aid = (/aid=([^"&]+)/i.exec(cells[8] || "") || [])[1] || "";
    const type = ICON_TYPES[icon] || guessType(decode(cells[5])) || "other";
    const key = aid || (brand + "|" + model + "|" + decode(cells[7])).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const row = { id: aid || undefined, brand, model, type, from: decode(cells[3]), till: decode(cells[4]), description: decode(cells[5]), value, year: decode(cells[7]) };
    parts.push(row);
  }
}

for (const file of readdirSync(srcDir).filter((f) => /\.(tsv|txt|csv)$/i.test(f)).sort()) {
  const text = readFileSync(join(srcDir, file), "utf8").replace(/\r/g, "");
  let brand = "", defType = "";
  const lines = [];
  for (const raw of text.split("\n")) {
    const m = /^#\s*(brand|type)\s*:\s*(.+)$/i.exec(raw.trim());
    if (m) { if (m[1].toLowerCase() === "brand") brand = m[2].trim(); else defType = m[2].trim().toLowerCase(); continue; }
    if (raw.trim() && !raw.trim().startsWith("#") && !/^\d+\s+articles?$/i.test(raw.trim())) lines.push(raw);
  }
  if (!brand) { warnings.push(`${file}: missing "# brand:" line, skipped`); continue; }
  if (!lines.length) continue;

  const sep = lines[0].includes("\t") ? "\t" : ",";
  let cols = { model: 0, from: 1, till: 2, description: 3, value: 4, year: 5, type: -1 };
  const head = splitLine(lines[0], sep).map((h) => h.toLowerCase());
  if (head.includes("model")) {
    const idx = (re) => head.findIndex((h) => re.test(h));
    cols = {
      model: idx(/^model/), from: idx(/^from/), till: idx(/^till|^to$/),
      description: idx(/^desc/), value: idx(/value|price/), year: idx(/^of$|year/), type: idx(/^type|^cat/)
    };
    lines.shift();
  }

  for (const line of lines) {
    const c = splitLine(line, sep);
    const get = (k) => (cols[k] >= 0 ? c[cols[k]] || "" : "");
    const model = get("model");
    const value = parseFloat(get("value").replace(/[^\d.]/g, ""));
    if (!model) continue;
    if (!Number.isFinite(value)) { warnings.push(`${file}: "${model}" has no value, skipped`); continue; }
    let type = (get("type") || "").toLowerCase();
    if (!TYPES.includes(type)) type = guessType(get("description")) || (TYPES.includes(defType) ? defType : "other");
    const key = (brand + "|" + model).toLowerCase();
    if (seen.has(key)) { warnings.push(`${file}: duplicate ${brand} ${model}, kept first`); continue; }
    seen.add(key);
    parts.push({ brand, model, type, from: get("from"), till: get("till"), description: get("description"), value, year: get("year") });
  }
}

parts.sort((a, b) => a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model, undefined, { numeric: true }));
const updated = new Date().toISOString().slice(0, 10);
const compact = parts.map((p) => Object.fromEntries(Object.entries(p).filter(([, v]) => v !== "" && v !== undefined)));
writeFileSync(outFile, JSON.stringify({ source: "EMMA ASIA value database", updated, parts: compact }) + "\n");

const brands = new Set(parts.map((p) => p.brand)).size;
console.log(`Wrote ${parts.length} parts from ${brands} brand(s) to data/parts.json`);
warnings.forEach((w) => console.warn("  ! " + w));
