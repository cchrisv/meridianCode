import { describe, expect, it } from "vitest";
import type { ServerProviderModel } from "@t3tools/contracts";
import { getComposerProviderState } from "./composerProviderRegistry";

const COPILOT_MODELS: ReadonlyArray<ServerProviderModel> = [
  {
    slug: "gpt-5.4",
    name: "GPT-5.4",
    isCustom: false,
    capabilities: {
      reasoningEffortLevels: [
        { value: "xhigh", label: "Extra High" },
        { value: "high", label: "High", isDefault: true },
        { value: "medium", label: "Medium" },
        { value: "low", label: "Low" },
      ],
      supportsFastMode: false,
      supportsThinkingToggle: false,
      contextWindowOptions: [],
      promptInjectedEffortLevels: [],
    },
  },
  {
    slug: "gpt-5.4-mini",
    name: "GPT-5.4 Mini",
    isCustom: false,
    capabilities: {
      reasoningEffortLevels: [],
      supportsFastMode: false,
      supportsThinkingToggle: false,
      contextWindowOptions: [],
      promptInjectedEffortLevels: [],
    },
  },
  {
    slug: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    isCustom: false,
    capabilities: {
      reasoningEffortLevels: [
        { value: "low", label: "Low" },
        { value: "medium", label: "Medium" },
        { value: "high", label: "High", isDefault: true },
        { value: "ultrathink", label: "Ultrathink" },
      ],
      supportsFastMode: false,
      supportsThinkingToggle: false,
      contextWindowOptions: [],
      promptInjectedEffortLevels: ["ultrathink"],
    },
  },
];

describe("getComposerProviderState", () => {
  it("returns copilot defaults when no draft options exist", () => {
    const state = getComposerProviderState({
      provider: "copilot",
      model: "gpt-5.4",
      models: COPILOT_MODELS,
      prompt: "",
      modelOptions: undefined,
    });

    expect(state).toEqual({
      provider: "copilot",
      promptEffort: "high",
      modelOptionsForDispatch: {
        reasoningEffort: "high",
      },
    });
  });

  it("normalizes copilot dispatch options while preserving the selected effort", () => {
    const state = getComposerProviderState({
      provider: "copilot",
      model: "gpt-5.4",
      models: COPILOT_MODELS,
      prompt: "",
      modelOptions: {
        copilot: {
          reasoningEffort: "low",
        },
      },
    });

    expect(state).toEqual({
      provider: "copilot",
      promptEffort: "low",
      modelOptionsForDispatch: {
        reasoningEffort: "low",
      },
    });
  });

  it("preserves copilot default effort explicitly in dispatch options", () => {
    const state = getComposerProviderState({
      provider: "copilot",
      model: "gpt-5.4",
      models: COPILOT_MODELS,
      prompt: "",
      modelOptions: {
        copilot: {
          reasoningEffort: "high",
        },
      },
    });

    expect(state).toEqual({
      provider: "copilot",
      promptEffort: "high",
      modelOptionsForDispatch: {
        reasoningEffort: "high",
      },
    });
  });

  it("returns null promptEffort for models without effort levels", () => {
    const state = getComposerProviderState({
      provider: "copilot",
      model: "gpt-5.4-mini",
      models: COPILOT_MODELS,
      prompt: "",
      modelOptions: undefined,
    });

    expect(state).toEqual({
      provider: "copilot",
      promptEffort: null,
      modelOptionsForDispatch: undefined,
    });
  });

  it("drops unsupported reasoning effort for models without effort controls", () => {
    const state = getComposerProviderState({
      provider: "copilot",
      model: "gpt-5.4-mini",
      models: COPILOT_MODELS,
      prompt: "",
      modelOptions: {
        copilot: {
          reasoningEffort: "high",
        },
      },
    });

    expect(state).toEqual({
      provider: "copilot",
      promptEffort: null,
      modelOptionsForDispatch: undefined,
    });
  });

  it("tracks ultrathink from the prompt without changing dispatch effort", () => {
    const state = getComposerProviderState({
      provider: "copilot",
      model: "claude-sonnet-4-6",
      models: COPILOT_MODELS,
      prompt: "Ultrathink:\nInvestigate this failure",
      modelOptions: {
        copilot: {
          reasoningEffort: "medium",
        },
      },
    });

    expect(state).toEqual({
      provider: "copilot",
      promptEffort: "medium",
      modelOptionsForDispatch: {
        reasoningEffort: "medium",
      },
      composerFrameClassName: "ultrathink-frame",
      composerSurfaceClassName: "shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset]",
      modelPickerIconClassName: "ultrathink-chroma",
    });
  });

  it("does not apply ultrathink styling for models without promptInjectedEffortLevels", () => {
    const state = getComposerProviderState({
      provider: "copilot",
      model: "gpt-5.4",
      models: COPILOT_MODELS,
      prompt: "Ultrathink:\nInvestigate this failure",
      modelOptions: {
        copilot: {
          reasoningEffort: "high",
        },
      },
    });

    expect(state).toEqual({
      provider: "copilot",
      promptEffort: "high",
      modelOptionsForDispatch: {
        reasoningEffort: "high",
      },
    });
    expect(state).not.toHaveProperty("composerFrameClassName");
  });
});
