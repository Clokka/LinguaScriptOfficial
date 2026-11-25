#!/usr/bin/env bash
# Is the LinguaScript backend answering? Run: bash scripts/check-backend.sh
#
# Uses only the public (publishable) key from .env and a MADE-UP account,
# never a real password. Healthy backend = every line says OK.
#   522 (after ~20 s) = Supabase's gateway can't reach the project's server:
#                       the project is paused/stopped (e.g. out of Cloud credits).
set -u
cd "$(dirname "$0")/.."
URL=$(grep '^VITE_SUPABASE_URL' .env | cut -d= -f2- | tr -d '"')
KEY=$(grep '^VITE_SUPABASE_PUBLISHABLE_KEY' .env | cut -d= -f2- | tr -d '"')
[ -z "$URL" ] || [ -z "$KEY" ] && { echo "VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY missing in .env"; exit 2; }

fail=0
check() { # name, expected codes (regex), curl args...
  local name=$1 want=$2; shift 2
  local out code secs
  out=$(curl -sS -m 30 -o /dev/null -w "%{http_code} %{time_total}" "$@" 2>&1) || true
  code=${out%% *}; secs=${out##* }
  if [[ $code =~ ^($want)$ ]]; then echo "OK    $name  (HTTP $code, ${secs}s)"
  else echo "FAIL  $name  (HTTP $code, ${secs}s)"; fail=1; fi
}

echo "Backend: $URL"
check "login service health        " "200"     -H "apikey: $KEY" "$URL/auth/v1/health"
check "password login (fake account)" "400"     -X POST -H "apikey: $KEY" -H "Content-Type: application/json" \
      -d '{"email":"nobody-test-12345@example.com","password":"not-a-real-password"}' "$URL/auth/v1/token?grant_type=password"
check "database read (public table) " "200|206" -H "apikey: $KEY" -H "Authorization: Bearer $KEY" "$URL/rest/v1/core_vocabulary?select=word&limit=1"
check "google-auth function         " "401"     -X POST -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
      -d '{"id_token":"fake","nonce":"x"}' "$URL/functions/v1/google-auth"

if [ $fail = 0 ]; then echo; echo "Backend is up. If login still fails, the problem is in the app."
else echo; echo "Backend is NOT answering. 522 = project server paused/stopped; only the project owner (Lovable Cloud) can restart it."; fi
exit $fail
