#!/usr/bin/env node
/**
 * Build script for WikiPerché
 *
 * Usage:
 *   node scripts/build.js              → validate + minify to dist/
 *   node scripts/build.js --validate-only  → validate only, no output written
 */

const fs   = require("fs");
const path = require("path");

const ROOT         = path.resolve(__dirname, "..");
const VALIDATE_ONLY = process.argv.includes("--validate-only");

// ── 1. Validate JSON data ──────────────────────────────────────────────────

const Ajv        = require("ajv");
const addFormats = require("ajv-formats");

const ajv    = new Ajv({ allErrors: true });
addFormats(ajv);

const schema = JSON.parse(fs.readFileSync(path.join(ROOT, "schema.json"), "utf8"));
const data   = JSON.parse(fs.readFileSync(path.join(ROOT, "wikiperche-data.json"), "utf8"));

const validate = ajv.compile(schema);
const valid    = validate(data);

if (!valid) {
  console.error("❌ Schema validation failed:");
  for (const err of validate.errors) {
    console.error(`   ${err.instancePath || "/"} — ${err.message}`);
  }
  process.exit(1);
}

// Count total items
const total = data.reduce((n, section) => n + section.items.length, 0);
console.log(`✅ Data valid — ${data.length} sections, ${total} items`);

if (VALIDATE_ONLY) process.exit(0);

// ── 2. Minify CSS & JS → dist/ ─────────────────────────────────────────────

const { minify: terser } = require("terser");
const CleanCSS           = require("clean-css");

const DIST = path.join(ROOT, "dist");
if (!fs.existsSync(DIST)) fs.mkdirSync(DIST);

// Copy static files that don't need transformation
const STATIC = ["index.html", "favicon.svg", "wikiperche-data.json", "wikiperche-data.js"];
for (const file of STATIC) {
  fs.copyFileSync(path.join(ROOT, file), path.join(DIST, file));
}

// Copy fonts directory
const fontsSrc  = path.join(ROOT, "fonts");
const fontsDest = path.join(DIST, "fonts");
if (!fs.existsSync(fontsDest)) fs.mkdirSync(fontsDest);
for (const f of fs.readdirSync(fontsSrc)) {
  fs.copyFileSync(path.join(fontsSrc, f), path.join(fontsDest, f));
}

// Minify CSS
const cssSource = fs.readFileSync(path.join(ROOT, "style.css"), "utf8");
const cssResult = new CleanCSS({ level: 2 }).minify(cssSource);
if (cssResult.errors.length) {
  console.error("❌ CSS minification errors:", cssResult.errors);
  process.exit(1);
}
fs.writeFileSync(path.join(DIST, "style.css"), cssResult.styles);
const cssSaved = ((1 - cssResult.stats.minifiedSize / cssResult.stats.originalSize) * 100).toFixed(1);
console.log(`🎨 style.css   ${cssResult.stats.originalSize} → ${cssResult.stats.minifiedSize} bytes (−${cssSaved}%)`);

// Minify JS
async function minifyJS() {
  const appSource = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
  const result = await terser(appSource, {
    compress: true,
    mangle: true,
    format: { comments: false }
  });
  if (!result.code) { console.error("❌ JS minification failed"); process.exit(1); }
  fs.writeFileSync(path.join(DIST, "app.js"), result.code);
  const origSize = Buffer.byteLength(appSource);
  const minSize  = Buffer.byteLength(result.code);
  const saved    = ((1 - minSize / origSize) * 100).toFixed(1);
  console.log(`⚙️  app.js      ${origSize} → ${minSize} bytes (−${saved}%)`);
  console.log(`\n📦 Build complete → dist/`);
}

minifyJS().catch(err => { console.error(err); process.exit(1); });
