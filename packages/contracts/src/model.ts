import { Schema } from "effect";
import { TrimmedNonEmptyString } from "./baseSchemas";
import type { ProviderKind } from "./orchestration";

export const COPILOT_REASONING_EFFORT_OPTIONS = ["xhigh", "high", "medium", "low"] as const;
export type CopilotReasoningEffort = (typeof COPILOT_REASONING_EFFORT_OPTIONS)[number];
export type ProviderReasoningEffort = CopilotReasoningEffort;

export const CopilotModelOptions = Schema.Struct({
  reasoningEffort: Schema.optional(Schema.Literals(COPILOT_REASONING_EFFORT_OPTIONS)),
});
export type CopilotModelOptions = typeof CopilotModelOptions.Type;

export const ProviderModelOptions = Schema.Struct({
  copilot: Schema.optional(CopilotModelOptions),
});
export type ProviderModelOptions = typeof ProviderModelOptions.Type;

export const EffortOption = Schema.Struct({
  value: TrimmedNonEmptyString,
  label: TrimmedNonEmptyString,
  isDefault: Schema.optional(Schema.Boolean),
});
export type EffortOption = typeof EffortOption.Type;

export const ContextWindowOption = Schema.Struct({
  value: TrimmedNonEmptyString,
  label: TrimmedNonEmptyString,
  isDefault: Schema.optional(Schema.Boolean),
});
export type ContextWindowOption = typeof ContextWindowOption.Type;

export const ModelCapabilities = Schema.Struct({
  reasoningEffortLevels: Schema.Array(EffortOption),
  supportsFastMode: Schema.Boolean,
  supportsThinkingToggle: Schema.Boolean,
  contextWindowOptions: Schema.Array(ContextWindowOption),
  promptInjectedEffortLevels: Schema.Array(TrimmedNonEmptyString),
});
export type ModelCapabilities = typeof ModelCapabilities.Type;

export const DEFAULT_MODEL_BY_PROVIDER: Record<ProviderKind, string> = {
  copilot: "claude-sonnet-4-6",
};

export const DEFAULT_MODEL = DEFAULT_MODEL_BY_PROVIDER.copilot;

/** Per-provider text generation model defaults. */
export const DEFAULT_GIT_TEXT_GENERATION_MODEL_BY_PROVIDER: Record<ProviderKind, string> = {
  copilot: "gpt-5.4-mini",
};

export const MODEL_SLUG_ALIASES_BY_PROVIDER: Record<ProviderKind, Record<string, string>> = {
  copilot: {
    "4.1": "gpt-4.1",
    "5.4": "gpt-5.4",
    "5.4-mini": "gpt-5.4-mini",
    "5-mini": "gpt-5-mini",
    "5.1": "gpt-5.1",
    "5.1-codex": "gpt-5.1-codex",
    "5.1-max": "gpt-5.1-codex-max",
    "5.1-mini": "gpt-5.1-codex-mini",
    "5.2": "gpt-5.2",
    "5.2-codex": "gpt-5.2-codex",
    "5.3": "gpt-5.3-codex",
    haiku: "claude-haiku-4-5",
    sonnet: "claude-sonnet-4-6",
    opus: "claude-opus-4-6",
    gemini: "gemini-3-pro-preview",
    "gemini-3.1": "gemini-3.1-pro",
    raptor: "raptor-mini",
  },
};

// ── Provider display names ────────────────────────────────────────────

export const PROVIDER_DISPLAY_NAMES: Record<ProviderKind, string> = {
  copilot: "GitHub Copilot",
};
