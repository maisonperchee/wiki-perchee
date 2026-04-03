#!/usr/bin/env node
/**
 * Sync Notion → wikiperche-data.json
 *
 * Usage :
 *   NOTION_TOKEN=... NOTION_DB_ID=... node scripts/sync-from-notion.js
 *
 * Ne récupère que les pages avec "Publié" coché.
 * Regroupe par Section et trie dans l'ordre d'origine (vivre / retablissement / societe).
 */

const fs    = require("fs");
const path  = require("path");
const https = require("https");

// Charge .env si présent
const envPath = path.join(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8").split("\n").forEach(line => {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  });
}


const TOKEN = process.env.NOTION_TOKEN;
let DB_ID = process.env.NOTION_DB_ID;
const PARENT_PAGE_ID = process.env.NOTION_PARENT_PAGE_ID || "333e3901e14880be8193f344a8963078";

if (!TOKEN) {
  console.error("Usage : NOTION_TOKEN=... node scripts/sync-from-notion.js");
  process.exit(1);
}

const SECTION_ORDER = ["vivre", "retablissement", "societe"];
const SECTION_LABELS = {
  vivre:          "🌱 Vivre avec",
  retablissement: "🌿 Vers le rétablissement",
  societe:        "🤝 Maladie psy et société",
};

function notionRequest(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = https.request({
      hostname: "api.notion.com",
      path: `/v1/${endpoint}`,
      method,
      headers: {
        "Authorization": `Bearer ${TOKEN}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    }, res => {
      let raw = "";
      res.on("data", c => raw += c);
      res.on("end", () => {
        const parsed = JSON.parse(raw);
        if (parsed.object === "error") reject(new Error(`${parsed.status} ${parsed.message}`));
        else resolve(parsed);
      });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

async function trouverDatabase() {
  const res = await notionRequest("POST", "search", {
    filter: { value: "database", property: "object" },
    query: "WikiPerché",
  });
  const db = res.results.find(r =>
    r.parent?.page_id?.replace(/-/g, "") === PARENT_PAGE_ID.replace(/-/g, "")
  );
  if (!db) throw new Error("Base de données introuvable sous la page parente. Lance d'abord npm run sync:up.");
  console.log(`  Base trouvée : ${db.id}`);
  return db.id;
}

function getText(prop) {
  return prop?.rich_text?.map(r => r.plain_text).join("") ?? "";
}

function pageToItem(page) {
  const p = page.properties;
  return {
    id:      getText(p["ID"]) || page.id,
    icon:    getText(p["Icône"]),
    title:   p["Titre"]?.title?.map(r => r.plain_text).join("") ?? "",
    desc:    getText(p["Description"]),
    type:    p["Type"]?.select?.name ?? "",
    troubles: p["Troubles"]?.multi_select?.map(t => t.name) ?? [],
    ...(p["Lien"]?.url ? { link: p["Lien"].url } : {}),
  };
}

async function fetchAllPages() {
  const pages = [];
  let cursor = undefined;

  do {
    const body = {
      filter: { property: "Publié", checkbox: { equals: true } },
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    };
    const res = await notionRequest("POST", `databases/${DB_ID}/query`, body);
    pages.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);

  return pages;
}

async function sync() {
  if (!DB_ID) {
    console.log("NOTION_DB_ID absent, recherche de la base…");
    DB_ID = await trouverDatabase();
  }

  console.log("Récupération des ressources depuis Notion…");
  const pages = await fetchAllPages();
  console.log(`  ${pages.length} ressources publiées trouvées`);

  // Charger les données existantes
  const outPath = path.join(__dirname, "../wikiperche-data.json");
  let existing = [];
  if (fs.existsSync(outPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(outPath, "utf8"));
    } catch (e) {
      console.warn("  Impossible de lire wikiperche-data.json, on repart de zéro.");
    }
  }

  // Construire un Set des IDs déjà présents
  const existingIds = new Set(
    existing.flatMap(section => section.items.map(item => item.id))
  );

  // Grouper les nouvelles pages par section (uniquement celles absentes)
  const bySection = {};
  let skipped = 0;
  for (const page of pages) {
    const item = pageToItem(page);
    if (existingIds.has(item.id)) {
      skipped++;
      continue;
    }
    const section = page.properties["Section"]?.select?.name ?? "vivre";
    if (!bySection[section]) bySection[section] = [];
    bySection[section].push(item);
  }
  console.log(`  ${skipped} doublons ignorés, ${pages.length - skipped} nouvelles ressources`);

  if (pages.length - skipped === 0) {
    console.log("✅ Aucune nouvelle ressource — wikiperche-data.json inchangé");
    return;
  }

  // Merger : partir de l'existant et ajouter les nouveaux items dans chaque section
  const merged = SECTION_ORDER.map(id => {
    const existingSection = existing.find(s => s.id === id);
    const existingItems = existingSection?.items ?? [];
    const newItems = bySection[id] ?? [];
    if (existingItems.length === 0 && newItems.length === 0) return null;
    return {
      id,
      label: SECTION_LABELS[id],
      items: [...existingItems, ...newItems],
    };
  }).filter(Boolean);

  const total = merged.reduce((n, s) => n + s.items.length, 0);
  fs.writeFileSync(outPath, JSON.stringify(merged, null, 2), "utf8");

  console.log(`✅ wikiperche-data.json mis à jour — ${merged.length} sections, ${total} ressources (${pages.length - skipped} ajoutées)`);
}

sync().catch(err => { console.error("Erreur :", err.message); process.exit(1); });
