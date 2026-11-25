#!/usr/bin/env node
// Point the website, Chrome extension and deploy workflow at a NEW Supabase project.
//
// Usage:
//   node scripts/switch-backend.mjs <project-ref> <publishable-key> [--dry-run]
//
//   project-ref      the part before .supabase.co in the new project's URL
//   publishable-key  the "anon / publishable" key from Settings → API (never the service_role key)
//
// It rewrites: .env, supabase/config.toml, extension/background.js,
// extension/manifest.json (host permission + version bump), and the
// deploy-supabase-functions workflow. Run the build and tests after it.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const OLD_REF = "ffephracinqeylfhqkiz";
const [, , ref, key, flag] = process.argv;
const dryRun = flag === "--dry-run" || key === "--dry-run";

if (!ref || !key || !/^[a-z0-9]{15,30}$/.test(ref)) {
  console.error("Usage: node scripts/switch-backend.mjs <project-ref> <publishable-key> [--dry-run]");
  console.error("project-ref looks like: abcdefghijklmnopqrst (from https://<project-ref>.supabase.co)");
  process.exit(1);
}
if (ref === OLD_REF) {
  console.error("That is already the old project. Pass the NEW project's ref.");
  process.exit(1);
}
if (!/^(sb_publishable_|eyJ)/.test(key)) {
  console.error("That doesn't look like a publishable/anon key. Use the 'anon' or 'publishable' key, not the service_role key.");
  process.exit(1);
}

const root = resolve(import.meta.dirname, "..");
const newUrl = `https://${ref}.supabase.co`;

const edits = [
  {
    file: ".env",
    replace: (t) => t
      .replaceAll(`https://${OLD_REF}.supabase.co`, newUrl)
      .replaceAll(`VITE_SUPABASE_PROJECT_ID="${OLD_REF}"`, `VITE_SUPABASE_PROJECT_ID="${ref}"`)
      .replace(/^(VITE_SUPABASE_PUBLISHABLE_KEY|SUPABASE_PUBLISHABLE_KEY)=.*$/gm, (_, name) => `${name}="${key}"`),
  },
  {
    file: "supabase/config.toml",
    replace: (t) => t.replace(`project_id = "${OLD_REF}"`, `project_id = "${ref}"`),
  },
  {
    file: "extension/background.js",
    replace: (t) => t
      .replaceAll(`https://${OLD_REF}.supabase.co`, newUrl)
      .replace(/const SUPABASE_ANON_KEY = '[^']*';/, `const SUPABASE_ANON_KEY = '${key}';`),
  },
  {
    file: "extension/manifest.json",
    replace: (t) => t
      .replaceAll(`https://${OLD_REF}.supabase.co/*`, `${newUrl}/*`)
      // Chrome users must approve a changed host, so bump the version.
      .replace(/"version": "(\d+)\.(\d+)\.(\d+)"/, (_, a, b, c) => `"version": "${a}.${b}.${Number(c) + 1}"`),
  },
  {
    file: ".github/workflows/deploy-supabase-functions.yml",
    replace: (t) => t.replaceAll(`--project-ref ${OLD_REF}`, `--project-ref ${ref}`),
  },
];

for (const { file, replace } of edits) {
  const path = resolve(root, file);
  const before = readFileSync(path, "utf8");
  const after = replace(before);
  const changed = before !== after;
  console.log(`${changed ? "changed " : "no change"}  ${file}`);
  if (changed && !dryRun) writeFileSync(path, after);
}

// Safety check: nothing in the edited files should still point at the old project.
const stillOld = edits
  .map((e) => e.file)
  .filter((f) => !dryRun && readFileSync(resolve(root, f), "utf8").includes(OLD_REF));
if (stillOld.length) {
  console.error(`\nStill mentions the old project in: ${stillOld.join(", ")}`);
  process.exit(1);
}

if (!dryRun && !readFileSync(resolve(root, "extension/background.js"), "utf8").includes(key)) {
  console.warn("\nWarning: extension/background.js key was not updated.");
}

console.log(dryRun ? "\nDry run only. Nothing was written." : `\nDone. Now: npm ci && npx vite build, then commit and push to main.`);
