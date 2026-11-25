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
# Every file the extension uses goes in; only notes (*.md) stay out, so a new
# file (word packs, adapters, sites.js…) can never be forgotten again.
for f in $(find . -name '*.js' -not -path './node_modules/*'); do node --check "$f"; done
zip -q -X -r "$OUT" . -x '*.md' -x 'node_modules/*' -x '.DS_Store'
echo "Built $OUT"
unzip -l "$OUT"
