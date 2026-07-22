#!/bin/bash

# LinguaScripts Migration Setup
# This script helps you apply the LinguaScripts database schema

echo "🚀 LinguaScript Migration Setup"
echo "================================"
echo ""

# Check if SERVICE_ROLE_KEY is already set
if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "ℹ️  SUPABASE_SERVICE_ROLE_KEY not set"
  echo ""
  echo "To get your Service Role Key:"
  echo "  1. Go to: https://app.supabase.com/projects"
  echo "  2. Select your LinguaScript project"
  echo "  3. Go to: Settings → API"
  echo "  4. Copy the 'Service Role' key (NOT the 'anon' key)"
  echo ""
  read -p "Paste your Service Role Key (or press Ctrl+C to cancel): " KEY
  export SUPABASE_SERVICE_ROLE_KEY="$KEY"
  echo ""
fi

echo "✅ Using Supabase project: ffephracinqeylfhqkiz"
echo ""
echo "Running migrations..."
echo ""

node scripts/apply-linguascripts-migration.js
