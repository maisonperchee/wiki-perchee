#!/usr/bin/env bash
# Remplace le bloc <script> contenant "const data = [" dans index.html
# par le contenu actuel de wikiperche-data.js

set -euo pipefail
cd "$(dirname "$0")"

DATA_FILE="wikiperche-data.js"
HTML_FILE="index.html"

if [[ ! -f "$DATA_FILE" || ! -f "$HTML_FILE" ]]; then
  echo "Erreur: $DATA_FILE ou $HTML_FILE introuvable." >&2
  exit 1
fi

python3 -c "
import re, sys

with open('$HTML_FILE', 'r') as f:
    html = f.read()

with open('$DATA_FILE', 'r') as f:
    data = f.read().strip()

# Match the <script> block that contains 'const data = ['
pattern = r'(<script>)\s*\n\s*const data = \[.*?\];\s*\n(\s*</script>)'
replacement = r'\1\n  ' + data.replace('\\\\', '\\\\\\\\').replace('\\n', '\\\\n') + r'\n\2'

# Use a function to avoid backreference issues
def replacer(m):
    return m.group(1) + '\n  ' + data + '\n' + m.group(2)

new_html, count = re.subn(pattern, replacer, html, count=1, flags=re.DOTALL)

if count == 0:
    print('Erreur: bloc data introuvable dans index.html', file=sys.stderr)
    sys.exit(1)

with open('$HTML_FILE', 'w') as f:
    f.write(new_html)

print(f'OK: data embarque dans {\"$HTML_FILE\"} ({len(data)} caracteres)')
"
