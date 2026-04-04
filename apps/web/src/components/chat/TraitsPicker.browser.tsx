import "../../index.css";

import {
  type ModelSelection,
  type CopilotModelOptions,
  DEFAULT_MODEL_BY_PROVIDER,
  DEFAULT_SERVER_SETTINGS,
  ProjectId,
  type ServerProvider,
  ThreadId,
} from "@t3tools/contracts";
import { page } from "vitest/browser";
import { useCallback } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { TraitsPicker } from "./TraitsPicker";
import {
  COMPOSER_DRAFT_STORAGE_KEY,
  ComposerThreadDraftState,
  useComposerDraftStore,
  useComposerThreadDraft,
  useEffectiveComposerModelState,
} from "../../composerDraftStore";
import { DEFAULT_CLIENT_SETTINGS } from "@t3tools/contracts/settings";

// ── Copilot TraitsPicker tests ─────────────────────────────────────────

const COPILOT_THREAD_ID = ThreadId.makeUnsafe("thread-copilot-traits");
const TEST_PROVIDERS: ReadonlyArray<ServerProvider> = [
  {
    provider: "copilot",
    enabled: true,
    installed: true,
    version: "0.1.0",
    status: "ready",
    auth: { status: "authenticated" },
    checkedAt: "2026-01-01T00:00:00.000Z",
    models: [
      {
        slug: "gpt-5.4",
        name: "GPT-5.4",
        isCustom: false,
        capabilities: {
          reasoningEffortLevels: [
            { value: "low", label: "Low" },
            { value: "medium", label: "Medium" },
            { value: "high", label: "High", isDefault: true },
            { value: "xhigh", label: "Extra High" },
          ],
          supportsFastMode: false,
          supportsThinkingToggle: false,
          contextWindowOptions: [],
          promptInjectedEffortLevels: [],
        },
      },
    ],
  },
];

function CopilotTraitsPickerHarness(props: {
  model: string;
  fallbackModelSelection: ModelSelection | null;
  triggerVariant?: "ghost" | "outline";
}) {
  const prompt = useComposerThreadDraft(COPILOT_THREAD_ID).prompt;
  const setPrompt = useComposerDraftStore((store) => store.setPrompt);
  const { modelOptions, selectedModel } = useEffectiveComposerModelState({
    threadId: COPILOT_THREAD_ID,
    providers: TEST_PROVIDERS,
    selectedProvider: "copilot",
    threadModelSelection: props.fallbackModelSelection,
    projectModelSelection: null,
    settings: {
      ...DEFAULT_SERVER_SETTINGS,
      ...DEFAULT_CLIENT_SETTINGS,
    },
  });
  const handlePromptChange = useCallback(
    (nextPrompt: string) => {
      setPrompt(COPILOT_THREAD_ID, nextPrompt);
    },
    [setPrompt],
  );

  return (
    <TraitsPicker
      provider="copilot"
      models={TEST_PROVIDERS[0]!.models}
      threadId={COPILOT_THREAD_ID}
      model={selectedModel ?? props.model}
      prompt={prompt}
      modelOptions={modelOptions?.copilot}
      onPromptChange={handlePromptChange}
      triggerVariant={props.triggerVariant}
    />
  );
}

async function mountCopilotPicker(props?: {
  model?: string;
  prompt?: string;
  options?: CopilotModelOptions;
  fallbackModelOptions?: {
    reasoningEffort?: "low" | "medium" | "high" | "xhigh";
  } | null;
  skipDraftModelOptions?: boolean;
  triggerVariant?: "ghost" | "outline";
}) {
  const model = props?.model ?? DEFAULT_MODEL_BY_PROVIDER.copilot;
  const copilotOptions = !props?.skipDraftModelOptions ? props?.options : undefined;
  const draftsByThreadId: Record<ThreadId, ComposerThreadDraftState> = {
    [COPILOT_THREAD_ID]: {
      prompt: props?.prompt ?? "",
      images: [],
      nonPersistedImageIds: [],
      persistedAttachments: [],
      terminalContexts: [],
      modelSelectionByProvider: props?.skipDraftModelOptions
        ? {}
        : {
            copilot: {
              provider: "copilot",
              model,
              ...(copilotOptions && Object.keys(copilotOptions).length > 0
                ? { options: copilotOptions }
                : {}),
            },
          },
      activeProvider: "copilot",
      runtimeMode: null,
      interactionMode: null,
    },
  };
  useComposerDraftStore.setState({
    draftsByThreadId,
    draftThreadsByThreadId: {},
    projectDraftThreadIdByProjectId: {},
  });
  const host = document.createElement("div");
  document.body.append(host);
  const fallbackModelSelection =
    props?.fallbackModelOptions !== undefined
      ? ({
          provider: "copilot",
          model,
          ...(props.fallbackModelOptions ? { options: props.fallbackModelOptions } : {}),
        } satisfies ModelSelection)
      : null;
  const screen = await render(
    <CopilotTraitsPickerHarness
      model={model}
      fallbackModelSelection={fallbackModelSelection}
      {...(props?.triggerVariant ? { triggerVariant: props.triggerVariant } : {})}
    />,
    { container: host },
  );

  const cleanup = async () => {
    await screen.unmount();
    host.remove();
  };

  return {
    [Symbol.asyncDispose]: cleanup,
    cleanup,
  };
}

describe("TraitsPicker (Copilot)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.removeItem(COMPOSER_DRAFT_STORAGE_KEY);
    useComposerDraftStore.setState({
      draftsByThreadId: {},
      draftThreadsByThreadId: {},
      projectDraftThreadIdByProjectId: {},
      stickyModelSelectionByProvider: {},
    });
  });

  it("shows the provided effort options", async () => {
    await using _ = await mountCopilotPicker();

    await page.getByRole("button").click();

    await vi.waitFor(() => {
      const text = document.body.textContent ?? "";
      expect(text).toContain("Low");
      expect(text).toContain("Medium");
      expect(text).toContain("High");
      expect(text).toContain("Extra High");
    });
  });

  it("persists sticky copilot model options when traits change", async () => {
    await using _ = await mountCopilotPicker({
      options: { reasoningEffort: "medium" },
    });

    await page.getByRole("button").click();
    await page.getByRole("menuitemradio", { name: "Extra High" }).click();

    expect(useComposerDraftStore.getState().stickyModelSelectionByProvider.copilot).toMatchObject({
      provider: "copilot",
      options: { reasoningEffort: "xhigh" },
    });
  });

  it("accepts outline trigger styling", async () => {
    await using _ = await mountCopilotPicker({
      triggerVariant: "outline",
    });

    const button = document.querySelector("button");
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error("Expected traits trigger button to be rendered.");
    }
    expect(button.className).toContain("border-input");
    expect(button.className).toContain("bg-popover");
  });
});
