#!/usr/bin/env node
// Proves (not just asserts by code review) that service-role database
// access never reaches a client bundle: scans .next/static — the only
// directory Next.js actually serves to the browser — for anything that
// would indicate src/lib/db/client-admin.ts or a raw SUPABASE_DB_URL
// value got bundled into client-side JavaScript. Requires `npm run
// build` to have already run; see docs/development/database-migrations.md.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientBundleDir = path.resolve(__dirname, "..", ".next", "static");

const FORBIDDEN_MARKERS = ["getAdminSql", "client-admin", "SUPABASE_DB_URL"];

if (!fs.existsSync(clientBundleDir)) {
  console.error(
    `${clientBundleDir} does not exist — run "npm run build" first, then re-run this check.`,
  );
  process.exit(1);
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else if (entry.name.endsWith(".js")) {
      files.push(fullPath);
    }
  }
  return files;
}

const jsFiles = walk(clientBundleDir);
const findings = [];

for (const file of jsFiles) {
  const content = fs.readFileSync(file, "utf8");
  for (const marker of FORBIDDEN_MARKERS) {
    if (content.includes(marker)) {
      findings.push({ file: path.relative(process.cwd(), file), marker });
    }
  }
}

if (findings.length > 0) {
  console.error(`Found ${findings.length} forbidden marker(s) in client bundle output:`);
  for (const { file, marker } of findings) {
    console.error(`  - "${marker}" in ${file}`);
  }
  console.error(
    "\nThis means service-role database access leaked into code the browser can download. " +
      'Check for a stray import of src/lib/db/client-admin.ts from a "use client" component.',
  );
  process.exit(1);
}

console.log(`Checked ${jsFiles.length} client bundle file(s) — no service-role markers found.`);
