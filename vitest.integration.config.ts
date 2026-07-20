import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Separate from vitest.config.ts on purpose: these tests open real
 * Postgres connections (via src/lib/db/client-test.ts) to prove Row-Level
 * Security actually enforces tenant isolation — something the default
 * suite's jsdom environment and zero-credential CI runs can't do. Each
 * *.integration.test.ts skips itself gracefully when SUPABASE_DB_URL is
 * unset (see docs/development/supabase-setup.md), so `npm run
 * test:integration` is safe to run before a Supabase project exists —
 * it just reports everything skipped.
 */
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.integration.test.{ts,tsx}"],
    exclude: ["node_modules", ".next", "e2e"],
    testTimeout: 20_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
