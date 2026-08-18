import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Mirrors the `@/*` path alias in tsconfig.json so tests import source modules
// the same way the app does.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
