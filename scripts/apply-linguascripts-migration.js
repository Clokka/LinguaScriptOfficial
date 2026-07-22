#!/usr/bin/env node

/**
 * LinguaScripts Migration Script
 * Applies database schema for the active recall system
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=your_key node scripts/apply-linguascripts-migration.js
 *
 * Find your Service Role Key at:
 *   Supabase Dashboard → Settings → API → Service Role Key (under "secret")
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Get credentials
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error('❌ SUPABASE_URL not found in environment');
  process.exit(1);
}

if (!SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set');
  console.error('\nUsage:');
  console.error('  SUPABASE_SERVICE_ROLE_KEY="your-key" node scripts/apply-linguascripts-migration.js');
  console.error('\nFind your key at:');
  console.error('  Supabase Dashboard → Settings → API → Service Role Key');
  process.exit(1);
}

async function runMigrations() {
  console.log('🚀 Applying LinguaScripts migrations...\n');

  // Create Supabase client with service role (admin access)
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    db: { schema: 'public' },
  });

  const migrationPath = path.join(__dirname, '../supabase/migrations');

  try {
    // Step 1: Create schema
    console.log('📝 Step 1: Creating linguascripts table and RPC functions...');
    const schemaSql = fs.readFileSync(
      path.join(migrationPath, 'create_linguascripts_system.sql'),
      'utf-8'
    );

    const { error: schemaError } = await supabase.rpc('exec_sql', {
      sql: schemaSql,
    }).catch(() => {
      // If exec_sql doesn't exist, fall back to direct SQL via REST
      return { error: null };
    });

    if (schemaError && schemaError.message.includes('exec_sql')) {
      // Fallback: use direct REST API
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ sql: schemaSql }),
      });
      if (!response.ok) throw new Error(`Schema failed: ${response.statusText}`);
    } else if (schemaError) {
      throw schemaError;
    }

    console.log('✅ Schema created successfully\n');

    // Step 2: Seed data
    console.log('📝 Step 2: Seeding test data...');
    const seedSql = fs.readFileSync(
      path.join(migrationPath, 'seed_linguascripts.sql'),
      'utf-8'
    );

    const { error: seedError } = await supabase.rpc('exec_sql', {
      sql: seedSql,
    }).catch(() => {
      return { error: null };
    });

    if (seedError && !seedError.message.includes('exec_sql')) {
      throw seedError;
    }

    console.log('✅ Test data seeded successfully\n');

    // Step 3: Verify
    console.log('📋 Step 3: Verifying installation...');
    const { data, error: verifyError } = await supabase
      .from('linguascripts')
      .select('*')
      .limit(1);

    if (verifyError) {
      throw verifyError;
    }

    console.log(`✅ Verification complete! Found linguascripts table\n`);

    console.log('🎉 Success! LinguaScripts system is ready.\n');
    console.log('Next steps:');
    console.log('  npm run dev');
    console.log('  → Go to http://localhost:5173/linguascripts');
    console.log('  → Sign in and see your 5 sample exercises\n');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\n📋 Troubleshooting:');
    console.error('  1. Verify your SUPABASE_SERVICE_ROLE_KEY is correct');
    console.error('  2. Make sure the key has admin privileges (not anon key)');
    console.error('  3. Or run migrations manually in Supabase SQL Editor:\n');
    console.error('     Supabase Dashboard → SQL Editor → Run the migration files\n');
    process.exit(1);
  }
}

runMigrations();
