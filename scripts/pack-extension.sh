#!/usr/bin/env bash
# Builds the Chrome Web Store upload: extension-build/linguascript-extension-<version>.zip
# Only the files the store version uses go in (Netflix adapter and notes stay out).
set -euo pipefail
cd "$(dirname "$0")/../extension"
VERSION=$(node -p "require('./manifest.json').version")
OUT="../extension-build/linguascript-extension-${VERSION}.zip"
mkdir -p ../extension-build
rm -f "$OUT"
for f in background.js ls-core.js adapters/youtube.js popup.js welcome.js; do node --check "$f"; done
zip -q -X -r "$OUT" \
  manifest.json background.js ls-core.js adapters/youtube.js \
  popup.html popup.js welcome.html welcome.js brand.css \
  icons/icon16.png icons/icon32.png icons/icon48.png icons/icon128.png \
  fonts/inter-latin-wght-normal.woff2 fonts/inter-latin-ext-wght-normal.woff2 fonts/OFL-Inter.txt
echo "Built $OUT"
unzip -l "$OUT"
