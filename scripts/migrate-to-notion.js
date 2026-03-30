#!/usr/bin/env node
/**
 * Migration one-shot : wikiperche-data.json → Notion DB
 * Usage : NOTION_TOKEN=... NOTION_DB_ID=... node scripts/migrate-to-notion.js
 */

const fs   = require("fs");
const path = require("path");
const https = require("https");

const TOKEN = process.env.NOTION_TOKEN;
const DB_ID = process.env.NOTION_DB_ID;

if (!TOKEN || !DB_ID) {
  console.error("Usage : NOTION_TOKEN=... NOTION_DB_ID=... node scripts/migrate-to-notion.js");
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

function truncate(str, max) {
  if (!str) return "";
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

async function migrate() {
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
