#!/usr/bin/env node
/**
 * Migration one-shot : wikiperche-data.json → Notion DB
 * Usage : NOTION_TOKEN=... NOTION_DB_ID=... node scripts/migrate-to-notion.js
 */

const fs   = require("fs");
const path = require("path");
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
  console.error("Usage : NOTION_TOKEN=... node scripts/migrate-to-notion.js");
  process.exit(1);
}

const data = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../wikiperche-data.json"), "utf8")
);

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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function creerDatabase() {
  console.log("Création de la base de données Notion…");
  const db = await notionRequest("POST", "databases", {
    parent: { type: "page_id", page_id: PARENT_PAGE_ID },
    title: [{ type: "text", text: { content: "WikiPerché — Ressources" } }],
    properties: {
      "Titre":       { title: {} },
      "Section":     { select: {} },
      "Icône":       { rich_text: {} },
      "ID":          { rich_text: {} },
      "Publié":      { checkbox: {} },
      "Description": { rich_text: {} },
      "Type":        { select: {} },
      "Troubles":    { multi_select: {} },
      "Lien":        { url: {} },
    },
  });
  console.log(`✅ Base créée : ${db.id}`);
  console.log(`   → Ajoute NOTION_DB_ID=${db.id} dans ton .env pour les prochains syncs\n`);
  return db.id;
}

function truncate(str, max) {
  if (!str) return "";
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

async function migrate() {
  if (!DB_ID) {
    DB_ID = await creerDatabase();
  }

  const items = data.flatMap(section =>
    section.items.map(item => ({ ...item, section: section.id }))
  );

  console.log(`Migration de ${items.length} ressources vers Notion…\n`);
  let ok = 0, errors = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    const properties = {
      "Titre": {
        title: [{ text: { content: truncate(item.title, 2000) } }]
      },
      "Section": {
        select: { name: item.section }
      },
      "Icône": {
        rich_text: [{ text: { content: item.icon || "" } }]
      },
      "ID": {
        rich_text: [{ text: { content: item.id } }]
      },
      "Publié": { checkbox: true },
    };

    if (item.desc) {
      properties["Description"] = {
        rich_text: [{ text: { content: truncate(item.desc, 2000) } }]
      };
    }

    if (item.type) {
      properties["Type"] = { select: { name: item.type } };
    }

    if (item.troubles && item.troubles.length > 0) {
      properties["Troubles"] = {
        multi_select: item.troubles.map(t => ({ name: t }))
      };
    }

    if (item.link) {
      properties["Lien"] = { url: item.link };
    }

    try {
      await notionRequest("POST", "pages", {
        parent: { database_id: DB_ID },
        properties,
      });
      ok++;
      if (ok % 50 === 0) console.log(`  ${ok}/${items.length}…`);
    } catch (err) {
      errors++;
      console.error(`  ✗ [${item.id}] ${err.message}`);
    }

    // Notion rate limit : 3 req/s → attendre 350ms entre chaque
    await sleep(350);
  }

  console.log(`\n✅ Migration terminée : ${ok} succès, ${errors} erreurs`);
}

migrate().catch(err => { console.error(err); process.exit(1); });
