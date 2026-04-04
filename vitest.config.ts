import * as path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@t3tools\/contracts$/,
        replacement: path.resolve(import.meta.dirname, "./packages/contracts/src/index.ts"),
      },
    ],
  },
  test: {
    // Unit tests assume upstream-style defaults (Codex + Claude enabled). Runtime defaults stay
    // Copilot-first unless `T3_LEGACY_PROVIDERS` is set in the real process environment.
    env: {
      T3_LEGACY_PROVIDERS: "1",
    },
  },
});
