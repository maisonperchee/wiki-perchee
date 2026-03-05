#!/usr/bin/env python3
"""
Import de ressources enrichies dans wikiperche-data.js

Usage:
    python3 import-resources.py enriched_resources.json
    python3 import-resources.py enriched_resources.json --dry-run
    python3 import-resources.py enriched_resources.json --stats
"""

import json
import re
import sys
import unicodedata
from pathlib import Path

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

DATA_FILE = Path(__file__).parent / "wikiperche-data.js"
INDEX_FILE = Path(__file__).parent / "index.html"

# Mapping des types collecteur → types wiki existants
TYPE_MAP = {
    "Video/Film":      "Video / Film",
    "Podcast":         "Podcast",
    "Livre":           "Article / Livre",
    # Ajouter ici si de nouveaux types apparaissent dans le collecteur
}

# Mapping des troubles collecteur → troubles wiki existants
TROUBLE_MAP = {
    "TSPT":            "TSPT / PTSD",
    "Anxiete":        "Anxiete/Angoisse",
    "Borderline/TPL":  "Borderline / TPL",
    "Deuil":           "Deuil et perte",
    "Proches aidants": "Proches aidants",
    "TCA":             "TCA",
    "TDAH":            "TDAH adulte",
    "TSA":             "TSA / autisme",
    "Addictions":      "Addictions",
    "Bipolarite":     "Bipolarite",
    "Depression":     "Depression",
    "Schizophrenie":  "Schizophrenie",
    "Sommeil":         "Troubles du sommeil",
    "Autres":          "Autres troubles",
}

# Icone par type
ICON_MAP = {
    "Video / Film":       "\U0001f3ac",  # 🎬
    "Podcast":            "\U0001f399\ufe0f",  # 🎙️
    "Article / Livre":    "\U0001f4d6",  # 📖
    "Site internet / Blog": "\U0001f310",  # 🌐
    "Conference":        "\U0001f399\ufe0f",  # 🎙️
    "Infographie":        "\U0001f4ca",  # 📊
    "Applis":             "\U0001f4f1",  # 📱
    "Reseaux sociaux":   "\U0001f4f1",  # 📱
}

DEFAULT_ICON = "\U0001f310"  # 🌐


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def slugify(text, max_len=60):
    """Genere un slug ASCII a partir d'un titre."""
    text = unicodedata.normalize("NFD", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    text = re.sub(r"[^a-z0-9]+", "-", text.lower())
    return text.strip("-")[:max_len]


def load_existing():
    """Charge wikiperche-data.js et retourne (data, ids, urls, titles)."""
    content = DATA_FILE.read_text(encoding="utf-8")
    json_str = content.replace("const data = ", "", 1).rstrip().rstrip(";")
    data = json.loads(json_str)

    ids, urls, titles = set(), set(), set()
    for section in data:
        for item in section["items"]:
            ids.add(item["id"])
            if item.get("link"):
                urls.add(item["link"])
            titles.add(item["title"].lower().strip())

    return data, ids, urls, titles


def save_data(data):
    """Ecrit data dans wikiperche-data.js et synchronise index.html."""
    # 1. wikiperche-data.js (format lisible)
    output = json.dumps(data, ensure_ascii=False, indent=2)
    DATA_FILE.write_text("const data = " + output + ";\n", encoding="utf-8")

    # 2. index.html (inline, compact)
    if INDEX_FILE.exists():
        html = INDEX_FILE.read_text(encoding="utf-8")
        compact = json.dumps(data, ensure_ascii=False, separators=(",", ": "))
        html = re.sub(
            r"const data = \[.*?\];",
            "const data = " + compact + ";",
            html,
            count=1,
        )
        INDEX_FILE.write_text(html, encoding="utf-8")


def pick_section(resource):
    """Determine la section cible a partir des categories du collecteur."""
    cats = set(resource.get("_categories", []))
    tags_public = resource.get("enrichment", {}).get("tags_public", [])

    if "aidants" in cats:
        return "vivre"
    if tags_public == ["proche"]:
        return "vivre"
    if "suicide" in cats:
        return "societe"
    if "traitements" in cats:
        return "retablissement"

    # Heuristique : si la ressource parle surtout de vivre au quotidien
    vivre_cats = {"aidants", "burnout"}
    societe_cats = {"suicide"}
    if cats & vivre_cats:
        return "vivre"
    if cats & societe_cats:
        return "societe"

    return "retablissement"


def map_type(raw_type):
    return TYPE_MAP.get(raw_type, raw_type)


def map_troubles(raw_troubles):
    seen = []
    for t in raw_troubles:
        mt = TROUBLE_MAP.get(t, t)
        if mt not in seen:
            seen.append(mt)
    return seen


def transform_resource(r, existing_ids):
    """Transforme une ressource enrichie en item wiki."""
    enrichment = r.get("enrichment", {})
    title = r.get("title", "").strip()
    url = r.get("url", "")

    # Type
    tags_type = enrichment.get("tags_type", [])
    raw_type = tags_type[0] if tags_type else r.get("type", "")
    mapped_type = map_type(raw_type)

    # Troubles
    raw_troubles = enrichment.get("tags_troubles", [])
    mapped_troubles = map_troubles(raw_troubles)

    # ID
    item_id = slugify(title)
    if item_id in existing_ids:
        item_id = item_id + "-" + r["id"][:8]

    # Icon
    icon = ICON_MAP.get(mapped_type, DEFAULT_ICON)

    # Description enrichie, sinon brute
    desc = enrichment.get("description", r.get("description_brute", ""))
    if len(desc) > 500:
        desc = desc[:497] + "..."

    item = {
        "id": item_id,
        "icon": icon,
        "title": title,
        "desc": desc,
        "type": mapped_type,
        "troubles": mapped_troubles,
    }
    if url:
        item["link"] = url

    return item


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def run(input_path, dry_run=False, stats_only=False):
    with open(input_path, encoding="utf-8") as f:
        new_resources = json.load(f)

    data, existing_ids, existing_urls, existing_titles = load_existing()
    section_map = {s["id"]: s for s in data}

    counts = {"added": {}, "rejected": 0, "duplicate": 0}
    for sid in section_map:
        counts["added"][sid] = 0

    before = {s["id"]: len(s["items"]) for s in data}

    for r in new_resources:
        enrichment = r.get("enrichment", {})

        # Filtrer les rejets
        if enrichment.get("flag_validation") == "REJETER":
            counts["rejected"] += 1
            continue

        # Dedup par URL et titre
        url = r.get("url", "")
        title = r.get("title", "").strip()
        if url in existing_urls or title.lower() in existing_titles:
            counts["duplicate"] += 1
            continue

        item = transform_resource(r, existing_ids)
        section_id = pick_section(r)

        if not dry_run and not stats_only:
            section_map[section_id]["items"].append(item)

        existing_ids.add(item["id"])
        existing_urls.add(url)
        existing_titles.add(title.lower())
        counts["added"][section_id] += 1

    total_added = sum(counts["added"].values())

    # Affichage
    print(f"\n{'=' * 50}")
    print(f"  Import {'(DRY RUN) ' if dry_run else ''}depuis {input_path}")
    print(f"{'=' * 50}")
    print(f"  Ressources en entree : {len(new_resources)}")
    print(f"  Rejetees (flag)      : {counts['rejected']}")
    print(f"  Doublons ignores     : {counts['duplicate']}")
    print(f"  Ajoutees             : {total_added}")
    print()
    print(f"  {'Section':<30} {'Avant':>6} {'+ Ajout':>8} {'Total':>6}")
    print(f"  {'-' * 52}")
    for s in data:
        sid = s["id"]
        b = before[sid]
        a = counts["added"][sid]
        print(f"  {s['label']:<30} {b:>6} {'+' + str(a):>8} {b + a:>6}")
    print()

    if not dry_run and not stats_only:
        save_data(data)
        print(f"  -> {DATA_FILE.name} + {INDEX_FILE.name} mis a jour!")
    elif dry_run:
        print("  -> Aucune modification (dry run)")
    print()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    input_file = sys.argv[1]
    dry_run = "--dry-run" in sys.argv
    stats_only = "--stats" in sys.argv

    run(input_file, dry_run=dry_run, stats_only=stats_only)
