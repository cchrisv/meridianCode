import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Absolute path to the Meridian Brain knowledge tree shipped with the app (`meridianBrain/` at repo root).
 *
 * Resolution order:
 * 1. `MERIDIAN_BRAIN_ROOT` (set by the desktop host from `resolveAppRoot()/meridianBrain`)
 * 2. Relative to this module: works for bundled `bin.mjs` and dev TypeScript layouts
 */
export function resolveBundledMeridianBrainPath(): string {
  const env = process.env.MERIDIAN_BRAIN_ROOT?.trim();
  if (env) {
    return env;
  }

  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, "../../../meridianBrain"),
    join(here, "../../../../meridianBrain"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) {
      return c;
    }
  }
  return candidates[0]!;
}
