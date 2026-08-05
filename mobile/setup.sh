#!/usr/bin/env bash
# LinguaScript mobile — one-command setup helper.
#
# Run from the mobile/ folder:
#   bash setup.sh
#
# What it does:
#   1. Checks you have Node.js
#   2. Installs deps if missing
#   3. Creates .env from .env.example if missing
#   4. Type-checks your project
#   5. Tells you exactly what command to run next

set -euo pipefail

cd "$(dirname "$0")"

BOLD="\033[1m"
GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
RESET="\033[0m"

say() { printf "${BOLD}${GREEN}▶${RESET} %s\n" "$*"; }
warn() { printf "${BOLD}${YELLOW}⚠${RESET} %s\n" "$*"; }
fail() { printf "${BOLD}${RED}✘${RESET} %s\n" "$*" >&2; exit 1; }

say "Checking Node.js…"
if ! command -v node >/dev/null 2>&1; then
  fail "Node.js is not installed. Get it from https://nodejs.org (LTS installer), then re-run this script."
fi
NODE_MAJOR=$(node -v | sed 's/^v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 20 ]; then
  fail "Node.js $NODE_MAJOR is too old. Upgrade to Node 20+ from https://nodejs.org."
fi
say "Node.js $(node -v) ✓"

if [ ! -d node_modules ]; then
  say "Installing dependencies (~2 min, one-time)…"
  npm install --no-audit --no-fund
else
  say "Dependencies already installed ✓"
fi

if [ ! -f .env ]; then
  say "Creating .env from .env.example…"
  cp .env.example .env
  warn "Open mobile/.env in an editor and confirm EXPO_PUBLIC_SUPABASE_ANON_KEY is filled in."
else
  say ".env exists ✓"
fi

say "Type-checking the project…"
if npx tsc --noEmit; then
  say "Type check passed ✓"
else
  fail "Type check failed — paste the errors above to Claude for a fix."
fi

echo
echo "════════════════════════════════════════════════════════════"
printf "${BOLD}${GREEN}Setup complete.${RESET} Choose what to do next:\n"
echo "════════════════════════════════════════════════════════════"
echo
printf "  ${BOLD}Preview on your phone (Expo Go, 2 min):${RESET}\n"
echo   "    1. Install 'Expo Go' from the Play Store on your phone"
echo   "    2. Run:  npx expo start"
echo   "    3. Scan the QR code with Expo Go (same WiFi as this computer)"
echo
printf "  ${BOLD}Build a real installable APK (EAS Build, one-time 10 min then ~15 min build):${RESET}\n"
echo   "    1. Sign up:  https://expo.dev/signup"
echo   "    2. Run:  npm install -g eas-cli"
echo   "    3. Run:  eas login"
echo   "    4. Run:  eas init"
echo   "    5. Run:  eas build --profile preview --platform android"
echo
printf "  ${BOLD}Full guide:${RESET} open mobile/SETUP.md\n"
echo
