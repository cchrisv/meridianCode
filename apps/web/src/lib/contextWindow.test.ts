import { describe, expect, it } from "vitest";
import { EventId, type OrchestrationThreadActivity, TurnId } from "@t3tools/contracts";

import type { ModelCapabilities } from "@t3tools/contracts";

import {
  deriveLatestContextWindowSnapshot,
  formatContextWindowTokens,
  mergeContextWindowSnapshotWithEstimatedMax,
  parseContextWindowOptionToMaxTokens,
  resolveEstimatedMaxTokensFromComposerModel,
} from "./contextWindow";

function makeActivity(id: string, kind: string, payload: unknown): OrchestrationThreadActivity {
  return {
    id: EventId.makeUnsafe(id),
    tone: "info",
    kind,
    summary: kind,
    payload,
    turnId: TurnId.makeUnsafe("turn-1"),
    createdAt: "2026-03-23T00:00:00.000Z",
  };
}

describe("contextWindow", () => {
  it("derives the latest valid context window snapshot", () => {
    const snapshot = deriveLatestContextWindowSnapshot([
      makeActivity("activity-1", "context-window.updated", {
        usedTokens: 1000,
      }),
      makeActivity("activity-2", "tool.started", {}),
      makeActivity("activity-3", "context-window.updated", {
        usedTokens: 14_000,
        maxTokens: 258_000,
        compactsAutomatically: true,
      }),
    ]);

    expect(snapshot).not.toBeNull();
    expect(snapshot?.usedTokens).toBe(14_000);
    expect(snapshot?.totalProcessedTokens).toBeNull();
    expect(snapshot?.maxTokens).toBe(258_000);
    expect(snapshot?.compactsAutomatically).toBe(true);
  });

  it("ignores malformed payloads", () => {
    const snapshot = deriveLatestContextWindowSnapshot([
      makeActivity("activity-1", "context-window.updated", {}),
    ]);

    expect(snapshot).toBeNull();
  });

  it("formats compact token counts", () => {
    expect(formatContextWindowTokens(999)).toBe("999");
    expect(formatContextWindowTokens(1400)).toBe("1.4k");
    expect(formatContextWindowTokens(14_000)).toBe("14k");
    expect(formatContextWindowTokens(258_000)).toBe("258k");
  });

  it("includes total processed tokens when available", () => {
    const snapshot = deriveLatestContextWindowSnapshot([
      makeActivity("activity-1", "context-window.updated", {
        usedTokens: 81_659,
        totalProcessedTokens: 748_126,
        maxTokens: 258_400,
        lastUsedTokens: 81_659,
      }),
    ]);

    expect(snapshot?.usedTokens).toBe(81_659);
    expect(snapshot?.totalProcessedTokens).toBe(748_126);
  });

  it("parses context window option tokens", () => {
    expect(parseContextWindowOptionToMaxTokens("200k")).toBe(200_000);
    expect(parseContextWindowOptionToMaxTokens("1.5m")).toBe(1_500_000);
    expect(parseContextWindowOptionToMaxTokens(null)).toBeNull();
  });

  it("merges estimated max tokens when provider omits max", () => {
    const base = deriveLatestContextWindowSnapshot([
      makeActivity("activity-1", "context-window.updated", {
        usedTokens: 50_000,
      }),
    ]);
    expect(base).not.toBeNull();
    const merged = mergeContextWindowSnapshotWithEstimatedMax(base!, 200_000);
    expect(merged.maxTokens).toBe(200_000);
    expect(merged.maxTokensIsEstimated).toBe(true);
    expect(merged.usedPercentage).toBeCloseTo(25, 5);
  });

  it("resolves estimated max from default context window option", () => {
    const caps: ModelCapabilities = {
      reasoningEffortLevels: [],
      supportsFastMode: false,
      supportsThinkingToggle: false,
      contextWindowOptions: [
        { value: "200k", label: "200k", isDefault: true },
        { value: "1m", label: "1M" },
      ],
      promptInjectedEffortLevels: [],
    };
    expect(
      resolveEstimatedMaxTokensFromComposerModel({
        provider: "copilot",
        modelOptions: { copilot: { reasoningEffort: "high" } },
        caps,
      }),
    ).toBe(200_000);
  });
});
