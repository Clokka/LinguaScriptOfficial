#!/usr/bin/env bash
# Builds the Firefox Add-ons (addons.mozilla.org) upload from the SAME code as Chrome:
#   extension-firefox/                         ← unzipped copy, load it in about:debugging to test
#   extension-build/linguascript-firefox-<version>.zip  ← upload this to AMO
#
# The Chrome extension folder (extension/) is never changed. Everything
# Firefox-specific happens to the copy, so Chrome (including old Chrome 111+) is untouched.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/extension"
OUT_DIR="$ROOT/extension-firefox"
cd "$SRC"
VERSION=$(node -p "require('./manifest.json').version")
ZIP="$ROOT/extension-build/linguascript-firefox-${VERSION}.zip"

# Same file list as the Chrome build (scripts/pack-extension.sh).
FILES=(manifest.json background.js ls-core.js page-bridge.js adapters/youtube.js adapters/netflix.js
  popup.html popup.js welcome.html welcome.js brand.css
  icons/icon16.png icons/icon32.png icons/icon48.png icons/icon128.png icons/logo.svg
  fonts/inter-latin-wght-normal.woff2 fonts/inter-latin-ext-wght-normal.woff2 fonts/OFL-Inter.txt)

# 1. Fresh copy
rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"
for f in "${FILES[@]}"; do mkdir -p "$OUT_DIR/$(dirname "$f")"; cp "$SRC/$f" "$OUT_DIR/$f"; done

# 2. Firefox version of the manifest (only the copy changes)
node - "$OUT_DIR/manifest.json" <<'NODE'
const fs = require('fs');
const file = process.argv[2];
const m = JSON.parse(fs.readFileSync(file, 'utf8'));
// Firefox allows max 45 characters in the name (Chrome allows 75).
m.name = 'LinguaScript – Learn with YouTube & Netflix';
// Firefox runs the background as a normal script, not a service worker.
m.background = { scripts: ['background.js'] };
// Chrome-only key; Firefox would warn about it.
delete m.minimum_chrome_version;
m.browser_specific_settings = {
  gecko: {
    // Firefox needs a permanent ID. NEVER change it after the first upload,
    // or Firefox treats it as a different add-on (and the sign-in redirect URL changes).
    id: 'linguascript@linguascript.co.uk',
    // 128 = first Firefox that supports "world": "MAIN" (page-bridge.js needs it).
    strict_min_version: '128.0',
    // Required for new add-ons on addons.mozilla.org: what data leaves the browser.
    // Sign-in details + email go to LinguaScript's server; subtitle text goes to translation.
    data_collection_permissions: {
      required: ['authenticationInfo', 'personallyIdentifyingInfo', 'websiteContent'],
    },
  },
  gecko_android: { strict_min_version: '128.0' },
};
fs.writeFileSync(file, JSON.stringify(m, null, 2) + '\n');
NODE

# 3. In Firefox, promises are guaranteed on browser.* (chrome.* callbacks also work),
#    so the "await chrome.x()" lines become "await browser.x()" in the copy only.
for f in "$OUT_DIR"/*.js "$OUT_DIR"/adapters/*.js; do
  sed -i 's/await chrome\./await browser./g' "$f"
  node --check "$f"
done

# 4. Zip it for upload
mkdir -p "$ROOT/extension-build"
rm -f "$ZIP"
(cd "$OUT_DIR" && zip -q -X -r "$ZIP" "${FILES[@]}")
echo "Built $ZIP"
echo "Test folder: $OUT_DIR  (Firefox → about:debugging → This Firefox → Load Temporary Add-on → pick manifest.json)"
