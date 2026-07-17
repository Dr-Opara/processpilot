#!/usr/bin/env node
// Validates that variables required by the *current* phase of ProcessPilot
// are present in the environment. Run in Codespaces before starting work,
// and as a guard in CI/build steps that depend on runtime configuration.
//
// REQUIRED_VARS is intentionally maintained by hand (not derived from
// .env.example): .env.example documents every variable planned across all
// phases, but only a subset is wired into the app at any given time. Add a
// name here when the code that consumes it is actually implemented.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const exampleFile = path.resolve(__dirname, "..", ".env.example");

if (!fs.existsSync(exampleFile)) {
  console.error("Missing .env.example — cannot cross-check required environment variables.");
  process.exit(1);
}

// Populate this as each integration (database, auth, storage, billing,
// queues, email, AI) lands.
const REQUIRED_VARS = [
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "CLERK_WEBHOOK_SIGNING_SECRET",
];

const documented = new Set(
  fs
    .readFileSync(exampleFile, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.split("=")[0].trim()),
);

const undocumented = REQUIRED_VARS.filter((name) => !documented.has(name));
if (undocumented.length > 0) {
  console.error(
    `REQUIRED_VARS references variables missing from .env.example: ${undocumented.join(", ")}`,
  );
  process.exit(1);
}

if (REQUIRED_VARS.length === 0) {
  console.log("No environment variables are required for the current phase — nothing to check.");
  process.exit(0);
}

const missing = REQUIRED_VARS.filter((name) => {
  const value = process.env[name];
  return value === undefined || value === "";
});

if (missing.length > 0) {
  console.error("Missing required environment variables:");
  for (const name of missing) {
    console.error(`  - ${name}`);
  }
  console.error(
    "\nSet these in GitHub Codespaces secrets, GitHub Actions secrets, or Vercel " +
      "environment variables. See docs/development/environment-variables.md.",
  );
  process.exit(1);
}

console.log(`All ${REQUIRED_VARS.length} required environment variables are set.`);
