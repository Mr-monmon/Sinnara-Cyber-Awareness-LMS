#!/usr/bin/env node
/**
 * verify-schema-alignment.mjs
 *
 * Production-readiness gate: ensures every database object the frontend
 * references (via supabase.from("…") tables/views and supabase.rpc("…")
 * functions) is actually created by a Supabase migration.
 *
 * It scans:
 *   - frontend .ts/.tsx files for  .from("…")  and  .rpc("…")
 *   - supabase migration .sql files for CREATE TABLE / VIEW / MATERIALIZED VIEW / FUNCTION
 *
 * Storage references (supabase.storage.from("bucket")) are NOT database
 * tables and are reported separately (informational), never as failures.
 *
 * Exit code 1 if any referenced table/view/RPC is missing from migrations.
 *
 * Usage:  node tools/verify-schema-alignment.mjs
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SRC_DIR = join(ROOT, 'src');
const MIGRATIONS_DIR = join(ROOT, 'supabase', 'migrations');

/* ──────────────────────────────────────────────────────────────────────────
 * Known objects that are provided by Supabase/Postgres itself or are storage
 * buckets — never expected to be created by a migration.
 * ────────────────────────────────────────────────────────────────────────── */
const STORAGE_BUCKETS = new Set(['emails', 'avatars', 'certificates-pdf', 'public', 'logos']);
// Postgres/PostgREST built-ins that may appear as rpc() targets.
const BUILTIN_RPCS = new Set([]);

/* ── Recursively collect files ── */
function walk(dir, exts, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist' || entry === '.git') continue;
      walk(full, exts, acc);
    } else if (exts.includes(extname(full))) {
      acc.push(full);
    }
  }
  return acc;
}

/* ── Extract frontend references ──
 * Captures the literal string argument of .from("x") and .rpc("x").
 * Skips .storage.from(...) and non-literal (template/variable) arguments.
 */
function extractFrontendRefs(files) {
  const tables = new Map();   // name -> Set(file)
  const rpcs = new Map();
  const storage = new Map();

  // .from('x') / .from("x") / .from(`x`)
  const fromRe = /(\.storage\s*)?\.from\(\s*(['"`])([^'"`]+)\2\s*\)/g;
  const rpcRe = /\.rpc\(\s*(['"`])([^'"`]+)\1/g;

  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const rel = file.replace(ROOT + '/', '');

    let m;
    while ((m = fromRe.exec(text)) !== null) {
      const isStorage = Boolean(m[1]);
      const name = m[3];
      if (!name || /[${}]/.test(name)) continue; // skip dynamic
      const bag = isStorage ? storage : tables;
      if (!bag.has(name)) bag.set(name, new Set());
      bag.get(name).add(rel);
    }
    while ((m = rpcRe.exec(text)) !== null) {
      const name = m[2];
      if (!name || /[${}]/.test(name)) continue;
      if (!rpcs.has(name)) rpcs.set(name, new Set());
      rpcs.get(name).add(rel);
    }
  }
  return { tables, rpcs, storage };
}

/* ── Extract created DB objects from migrations ── */
function extractMigrationObjects(files) {
  const tables = new Set();
  const views = new Set();
  const functions = new Set();

  const tableRe = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?["']?([a-zA-Z_][a-zA-Z0-9_]*)["']?/gi;
  const viewRe = /CREATE\s+(?:OR\s+REPLACE\s+)?(?:MATERIALIZED\s+)?VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?["']?([a-zA-Z_][a-zA-Z0-9_]*)["']?/gi;
  const fnRe = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?["']?([a-zA-Z_][a-zA-Z0-9_]*)["']?/gi;

  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    let m;
    while ((m = tableRe.exec(text)) !== null) tables.add(m[1]);
    while ((m = viewRe.exec(text)) !== null) views.add(m[1]);
    while ((m = fnRe.exec(text)) !== null) functions.add(m[1]);
  }
  return { tables, views, functions };
}

/* ── Main ── */
function main() {
  const srcFiles = walk(SRC_DIR, ['.ts', '.tsx']);
  const migFiles = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => join(MIGRATIONS_DIR, f));

  const { tables: refTables, rpcs: refRpcs, storage } = extractFrontendRefs(srcFiles);
  const { tables: migTables, views: migViews, functions: migFns } = extractMigrationObjects(migFiles);

  const relationExists = (name) =>
    migTables.has(name) || migViews.has(name);

  const missingTables = [];
  for (const [name, used] of refTables) {
    if (STORAGE_BUCKETS.has(name) && !relationExists(name)) continue; // storage bucket, not a relation
    if (!relationExists(name)) missingTables.push([name, [...used]]);
  }

  const missingRpcs = [];
  for (const [name, used] of refRpcs) {
    if (BUILTIN_RPCS.has(name)) continue;
    if (!migFns.has(name)) missingRpcs.push([name, [...used]]);
  }

  /* ── Report ── */
  console.log('Schema alignment report');
  console.log('========================');
  console.log(`Frontend files scanned : ${srcFiles.length}`);
  console.log(`Migrations scanned     : ${migFiles.length}`);
  console.log(`Tables/views referenced: ${refTables.size}`);
  console.log(`RPCs referenced        : ${refRpcs.size}`);
  console.log(`Tables created         : ${migTables.size}`);
  console.log(`Views created          : ${migViews.size}`);
  console.log(`Functions created      : ${migFns.size}`);
  if (storage.size) {
    console.log(`\nStorage buckets referenced (informational, not validated as relations):`);
    for (const [name, used] of storage) console.log(`  - ${name}  (${[...used][0]}${used.size > 1 ? `, +${used.size - 1} more` : ''})`);
  }

  let failed = false;
  if (missingTables.length) {
    failed = true;
    console.log(`\n❌ MISSING TABLES/VIEWS (${missingTables.length}):`);
    for (const [name, used] of missingTables.sort()) {
      console.log(`  - ${name}`);
      for (const f of used.slice(0, 5)) console.log(`        ${f}`);
    }
  }
  if (missingRpcs.length) {
    failed = true;
    console.log(`\n❌ MISSING RPCs (${missingRpcs.length}):`);
    for (const [name, used] of missingRpcs.sort()) {
      console.log(`  - ${name}`);
      for (const f of used.slice(0, 5)) console.log(`        ${f}`);
    }
  }

  if (failed) {
    console.log('\nResult: FAIL — frontend references database objects not created by any migration.');
    process.exit(1);
  }
  console.log('\nResult: PASS — every referenced table/view/RPC is created by a migration.');
}

main();
