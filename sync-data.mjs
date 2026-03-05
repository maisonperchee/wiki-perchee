#!/usr/bin/env node
/**
 * Sync script: reads the Notion CSV export (_all.csv) and generates wikiperche-data.js
 *
 * Usage:  node sync-data.mjs
 *         node sync-data.mjs --dry-run   # prints diff stats without writing
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Config ──────────────────────────────────────────────────────────────────
const CSV_PATH = join(
  __dirname,
  "extract-wiki-perchee",
  "Le WikiPerché de La Maison Perchée e26e3901e14883afbab301f5192fbe74_all.csv"
);
const OUTPUT_PATH = join(__dirname, "wikiperche-data.js");
const DRY_RUN = process.argv.includes("--dry-run");

// ── Category mapping ────────────────────────────────────────────────────────
const SECTION_MAP = {
  "Vivre avec": { id: "vivre", label: "\u{1F331} Vivre avec" },
  "Vers le rétablissement": { id: "retablissement", label: "\u{1F33F} Vers le rétablissement" },
  "Maladie psy et société": { id: "societe", label: "\u{1F91D} Maladie psy et société" },
};

// ── Icon mapping (type → emoji) ─────────────────────────────────────────────
const ICON_MAP = {
  "Article / Livre": "\u{1F4D6}",
  "Vidéo / Film": "\u{1F3AC}",
  "Podcast": "\u{1F399}\uFE0F",
  "Site internet / Blog": "\u{1F310}",
  "Conférence": "\u{1F3A4}",
  "Infographie": "\u{1F4CA}",
  "Applis": "\u{1F4F1}",
  "Réseaux sociaux": "\u{1F4F2}",
};

function iconForType(type) {
  if (!type) return "\u{1F4D6}";
  // If multiple types (e.g. "Conférence, Site internet / Blog"), pick the first
  const first = type.split(",")[0].trim();
  return ICON_MAP[first] || "\u{1F4D6}";
}

// ── CSV parser (handles quoted fields with commas & newlines) ────────────────
function parseCSV(text) {
  const rows = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        rows[rows.length - 1].push(current);
        current = "";
      } else if (ch === "\n" || (ch === "\r" && text[i + 1] === "\n")) {
        rows[rows.length - 1].push(current);
        current = "";
        if (ch === "\r") i++; // skip \n after \r
        rows.push([]);
      } else {
        current += ch;
      }
    }
    if (rows.length === 0) rows.push([]);
  }
  // flush last field
  if (current || (rows.length > 0 && rows[rows.length - 1].length > 0)) {
    rows[rows.length - 1].push(current);
  }
  // remove empty trailing row
  if (rows.length > 0 && rows[rows.length - 1].length === 0) rows.pop();

  return rows;
}

// ── Slugify (produces an id like the existing data) ─────────────────────────
function slugify(str) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")    // non-alphanum → dash
    .replace(/^-+|-+$/g, "")        // trim leading/trailing dashes
    .slice(0, 50);                   // cap length like existing ids
}

// ── Parse troubles field ────────────────────────────────────────────────────
function parseTroubles(raw) {
  if (!raw || !raw.trim()) return [];
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

// ── Main ────────────────────────────────────────────────────────────────────
const csvText = readFileSync(CSV_PATH, "utf-8");
const rows = parseCSV(csvText);
const headers = rows[0];
const dataRows = rows.slice(1);

// Build column index
const col = {};
headers.forEach((h, i) => (col[h.trim()] = i));

const sections = {
  vivre: [],
  retablissement: [],
  societe: [],
};

const seenIds = new Set();

for (const fields of dataRows) {
  const title = (fields[col["Titre Article"]] || "").trim();
  if (!title) continue;

  const catPrincipale = (fields[col["Categorie Principale"]] || "").trim();
  const section = SECTION_MAP[catPrincipale];
  if (!section) {
    // Items without a valid category default to "retablissement"
    console.warn(`[DEFAULT→retablissement] No category for: "${title}" (got "${catPrincipale}")`);
  }
  const sectionId = section ? section.id : "retablissement";

  const intro = (fields[col["Intro"]] || "").trim();
  const link = (fields[col["Lien URL"]] || "").trim();
  const trouble = (fields[col["Trouble"]] || "").trim();
  const typologie = (fields[col["Typologie"]] || "").trim();
  const descLien = (fields[col["description du lien"]] || "").trim();

  // Build description: prefer Intro, fallback to description du lien
  let desc = intro || descLien || "";
  // Clean up multiline descriptions
  desc = desc.replace(/\n/g, " ").replace(/\s{2,}/g, " ").trim();

  // Determine primary type (first one if multiple)
  const typeRaw = typologie.split(",")[0].trim() || "";

  // Generate unique id
  let baseId = slugify(title);
  let id = baseId;
  let suffix = 2;
  while (seenIds.has(id)) {
    id = `${baseId}-${suffix}`;
    suffix++;
  }
  seenIds.add(id);

  const item = {
    id,
    icon: iconForType(typeRaw),
    title: title.replace(/^\*\s*/, "").replace(/^"|"$/g, ""), // strip leading * or quotes
    desc,
    type: typeRaw,
    troubles: parseTroubles(trouble),
  };
  if (link) item.link = link.trim();

  sections[sectionId].push(item);
}

// ── Build output ────────────────────────────────────────────────────────────
const data = [
  { id: "vivre", label: SECTION_MAP["Vivre avec"].label, items: sections.vivre },
  { id: "retablissement", label: SECTION_MAP["Vers le rétablissement"].label, items: sections.retablissement },
  { id: "societe", label: SECTION_MAP["Maladie psy et société"].label, items: sections.societe },
];

const totalItems = data.reduce((s, sec) => s + sec.items.length, 0);

console.log(`\nSections:`);
data.forEach((s) => console.log(`  ${s.label}: ${s.items.length} items`));
console.log(`  Total: ${totalItems} items\n`);

if (DRY_RUN) {
  console.log("Dry run — not writing file.");
  process.exit(0);
}

const jsContent = "const data = " + JSON.stringify(data, null, 2) + ";\n";
writeFileSync(OUTPUT_PATH, jsContent, "utf-8");
console.log(`Written to ${OUTPUT_PATH}`);
