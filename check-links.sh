#!/usr/bin/env python3
"""
check-links.sh — Verifie la disponibilite de toutes les URLs dans wikiperche-data.js

Usage:
  ./check-links.sh              Affiche uniquement les erreurs
  ./check-links.sh --verbose    Affiche aussi les liens OK

Codes de sortie :
  0  Tous les liens sont OK
  1  Au moins un lien est en erreur
"""

import json
import sys
import os
import urllib.request
import urllib.error
import ssl
import concurrent.futures
from pathlib import Path

TIMEOUT = 15
MAX_WORKERS = 10
USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) WikiPercheBot/1.0"

# Couleurs
RED = "\033[0;31m"
YELLOW = "\033[0;33m"
GREEN = "\033[0;32m"
GRAY = "\033[0;90m"
BOLD = "\033[1m"
NC = "\033[0m"

verbose = "--verbose" in sys.argv


def load_data():
    data_file = Path(__file__).parent / "wikiperche-data.js"
    content = data_file.read_text(encoding="utf-8")
    json_str = content[len("const data = "):].rstrip().rstrip(";")
    return json.loads(json_str)


def check_url(item):
    """Retourne (http_code, item). http_code=0 pour timeout/DNS, -1 pour URL invalide."""
    url = item["link"]
    if not url.startswith(("http://", "https://")):
        return (-1, item)

    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    req = urllib.request.Request(url, method="GET", headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT, context=ctx) as resp:
            return (resp.getcode(), item)
    except urllib.error.HTTPError as e:
        return (e.code, item)
    except Exception:
        return (0, item)


def main():
    data = load_data()
    items = []
    for section in data:
        for res in section["items"]:
            if res.get("link"):
                items.append({**res, "_section": section["id"]})

    total = len(items)
    print(f"{BOLD}Verification de {total} liens...{NC}\n")

    errors = 0
    warnings = 0
    ok = 0

    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = {pool.submit(check_url, item): item for item in items}
        done_count = 0

        for future in concurrent.futures.as_completed(futures):
            done_count += 1
            code, item = future.result()
            section = item["_section"]
            title = item["title"]
            url = item["link"]

            # Barre de progression sur stderr
            sys.stderr.write(f"\r{GRAY}  [{done_count}/{total}]{NC}")
            sys.stderr.flush()

            if 200 <= code < 400:
                ok += 1
                if verbose:
                    print(f"  {GREEN}{code}{NC} {GRAY}[{section}]{NC} {title}")
            elif code == -1:
                warnings += 1
                print(f"  {YELLOW}URL INVALIDE{NC} {GRAY}[{section}]{NC} {BOLD}{title}{NC}")
                print(f"              {GRAY}{url}{NC}")
            elif code == 0:
                errors += 1
                print(f"  {RED}TIMEOUT/DNS{NC} {GRAY}[{section}]{NC} {BOLD}{title}{NC}")
                print(f"              {GRAY}{url}{NC}")
            elif 400 <= code < 500:
                errors += 1
                print(f"  {RED}{code}{NC}         {GRAY}[{section}]{NC} {BOLD}{title}{NC}")
                print(f"              {GRAY}{url}{NC}")
            elif 500 <= code < 600:
                warnings += 1
                print(f"  {YELLOW}{code}{NC}         {GRAY}[{section}]{NC} {BOLD}{title}{NC}")
                print(f"              {GRAY}{url}{NC}")
            else:
                warnings += 1
                print(f"  {YELLOW}{code}{NC}         {GRAY}[{section}]{NC} {BOLD}{title}{NC}")
                print(f"              {GRAY}{url}{NC}")

    # Effacer la barre de progression
    sys.stderr.write("\r" + " " * 40 + "\r")

    print(f"\n{BOLD}Resume :{NC}")
    print(f"  {GREEN}OK :{NC}             {ok}")
    if warnings > 0:
        print(f"  {YELLOW}Avertissements :{NC}  {warnings} {GRAY}(erreurs serveur, reponses inattendues){NC}")
    if errors > 0:
        print(f"  {RED}Erreurs :{NC}        {errors} {GRAY}(404, timeout, DNS){NC}")
    print(f"  {GRAY}Total :{NC}          {total}")

    if errors > 0:
        print(f"\n{RED}Des liens semblent casses. Verifiez-les manuellement.{NC}")
        sys.exit(1)
    else:
        print(f"\n{GREEN}Tous les liens sont accessibles.{NC}")
        sys.exit(0)


if __name__ == "__main__":
    main()
