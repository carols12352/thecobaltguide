import { defineConfig } from "vitest/config";
import path from "path";

/**
 * RLS policy suite against a live local Supabase (migrations applied).
 * Run with: npm run test:rls
 * Not part of the default `npm test` job.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["supabase/tests/rls/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
