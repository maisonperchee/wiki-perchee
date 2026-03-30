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

const TOKEN = process.env.NOTION_TOKEN;
const DB_ID = process.env.NOTION_DB_ID;

if (!TOKEN || !DB_ID) {
  console.error("Usage : NOTION_TOKEN=... NOTION_DB_ID=... node scripts/sync-from-notion.js");
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
  console.log("Récupération des ressources depuis Notion…");
  const pages = await fetchAllPages();
  console.log(`  ${pages.length} ressources publiées trouvées`);

  // Grouper par section
  const bySection = {};
  for (const page of pages) {
    const section = page.properties["Section"]?.select?.name ?? "vivre";
    if (!bySection[section]) bySection[section] = [];
    bySection[section].push(pageToItem(page));
  }

  // Construire le tableau final dans l'ordre des sections
  const result = SECTION_ORDER
    .filter(id => bySection[id]?.length > 0)
    .map(id => ({
      id,
      label: SECTION_LABELS[id],
      items: bySection[id],
    }));

  const total = result.reduce((n, s) => n + s.items.length, 0);
  const outPath = path.join(__dirname, "../wikiperche-data.json");
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), "utf8");

  console.log(`✅ wikiperche-data.json mis à jour — ${result.length} sections, ${total} ressources`);
}

sync().catch(err => { console.error("Erreur :", err.message); process.exit(1); });
