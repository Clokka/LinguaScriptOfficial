#!/usr/bin/env bash
# Builds the Chrome Web Store upload: extension-build/linguascript-extension-<version>.zip
# Only the files the store version uses go in (notes stay out).
set -euo pipefail
cd "$(dirname "$0")/../extension"
VERSION=$(node -p "require('./manifest.json').version")
# The Chrome Web Store rejects the upload if these are too long.
node -e "const m=require('./manifest.json'); if (m.description.length > 132 || m.name.length > 75) { console.error('manifest description must be <= 132 chars (is ' + m.description.length + '), name <= 75 (is ' + m.name.length + ')'); process.exit(1); }"
OUT="../extension-build/linguascript-extension-${VERSION}.zip"
mkdir -p ../extension-build
rm -f "$OUT"
for f in background.js ls-core.js adapters/youtube.js adapters/netflix.js popup.js welcome.js; do node --check "$f"; done
zip -q -X -r "$OUT" \
  manifest.json background.js ls-core.js adapters/youtube.js adapters/netflix.js \
  popup.html popup.js welcome.html welcome.js brand.css \
  icons/icon16.png icons/icon32.png icons/icon48.png icons/icon128.png icons/logo.svg \
  fonts/inter-latin-wght-normal.woff2 fonts/inter-latin-ext-wght-normal.woff2 fonts/OFL-Inter.txt
echo "Built $OUT"
unzip -l "$OUT"
