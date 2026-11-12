#!/usr/bin/env bash
# Builds the app from src/. Run from anywhere:  bash scripts/build.sh
#   apps-script/Index.html  the version you paste into Google Apps Script
#   index.html + sw.js      the installable version GitHub Pages serves
set -euo pipefail
cd "$(dirname "$0")/.."
body() {
  echo '<script type="text/plain" id="gasCode">'
  cat apps-script/Code.gs; echo
  echo '</script>'
  echo '<script>'
  cat src/app-core.js src/app-screens.js src/app-plan.js src/app-auth.js src/app-actions.js
  echo '</script>'
  echo '</body>'
  echo '</html>'
}
{ cat src/shell.html; body; } > apps-script/Index.html
{ awk 'FNR==NR{h=h $0 "\n";next} {print} /<title>Badyet<\/title>/{printf "%s", h}' src/web-head.html src/shell.html; body; } > index.html
build=$(sha1sum index.html | cut -c1-10)
sed "s/__BUILD__/$build/" src/sw.js > sw.js
echo "Built apps-script/Index.html, index.html and sw.js (build $build)"
