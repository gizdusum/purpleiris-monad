import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
import { config } from "dotenv";

// Load apps/web/.env.local so ANTHROPIC_API_KEY is available in tests
config({ path: resolve(__dirname, "../../apps/web/.env.local") });

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    testTimeout: 90_000,
    hookTimeout: 30_000,
    include: ["tests/**/*.spec.ts"],
  },
});
