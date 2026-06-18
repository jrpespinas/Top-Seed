import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    setupFiles: ["./src/test/setup.ts", "./src/test/setup-dom.ts"],
    environmentMatchGlobs: [["**/*.test.tsx", "jsdom"]],
  },
});
