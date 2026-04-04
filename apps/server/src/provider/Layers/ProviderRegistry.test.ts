import { describe, it, assert } from "@effect/vitest";
import type { ServerProvider } from "@t3tools/contracts";

import { haveProvidersChanged } from "./ProviderRegistry";

describe("ProviderRegistry", () => {
  describe("haveProvidersChanged", () => {
    it("treats equal provider snapshots as unchanged", () => {
      const providers = [
        {
          provider: "copilot",
          status: "ready",
          enabled: true,
          installed: true,
          auth: { status: "authenticated" },
          checkedAt: "2026-03-25T00:00:00.000Z",
          version: "1.0.0",
          models: [],
        },
      ] as const satisfies ReadonlyArray<ServerProvider>;

      assert.strictEqual(haveProvidersChanged(providers, [...providers]), false);
    });
  });
});
