import { describe, expect, it } from "vitest";
import { Schema } from "effect";

import { ProviderSendTurnInput, ProviderSessionStartInput } from "./provider";

const decodeProviderSessionStartInput = Schema.decodeUnknownSync(ProviderSessionStartInput);
const decodeProviderSendTurnInput = Schema.decodeUnknownSync(ProviderSendTurnInput);

describe("ProviderSessionStartInput", () => {
  it("accepts copilot-compatible payloads", () => {
    const parsed = decodeProviderSessionStartInput({
      threadId: "thread-1",
      provider: "copilot",
      cwd: "/tmp/workspace",
      modelSelection: {
        provider: "copilot",
        model: "gpt-5.3-codex",
        options: {
          reasoningEffort: "high",
        },
      },
      runtimeMode: "full-access",
    });
    expect(parsed.runtimeMode).toBe("full-access");
    expect(parsed.modelSelection?.provider).toBe("copilot");
    expect(parsed.modelSelection?.model).toBe("gpt-5.3-codex");
    expect(parsed.modelSelection?.options?.reasoningEffort).toBe("high");
  });

  it("rejects payloads without runtime mode", () => {
    expect(() =>
      decodeProviderSessionStartInput({
        threadId: "thread-1",
        provider: "copilot",
      }),
    ).toThrow();
  });
});

describe("ProviderSendTurnInput", () => {
  it("accepts copilot modelSelection", () => {
    const parsed = decodeProviderSendTurnInput({
      threadId: "thread-1",
      modelSelection: {
        provider: "copilot",
        model: "gpt-5.3-codex",
        options: {
          reasoningEffort: "xhigh",
        },
      },
    });

    expect(parsed.modelSelection?.provider).toBe("copilot");
    expect(parsed.modelSelection?.model).toBe("gpt-5.3-codex");
    expect(parsed.modelSelection?.options?.reasoningEffort).toBe("xhigh");
  });
});
