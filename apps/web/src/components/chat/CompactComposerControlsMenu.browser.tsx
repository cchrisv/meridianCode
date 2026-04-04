import { DEFAULT_MODEL_BY_PROVIDER, ModelSelection, ThreadId } from "@t3tools/contracts";
import "../../index.css";

import { page } from "vitest/browser";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { CompactComposerControlsMenu } from "./CompactComposerControlsMenu";
import { TraitsMenuContent } from "./TraitsPicker";
import { useComposerDraftStore } from "../../composerDraftStore";

async function mountMenu(props?: { modelSelection?: ModelSelection; prompt?: string }) {
  const threadId = ThreadId.makeUnsafe("thread-compact-menu");
  const provider = props?.modelSelection?.provider ?? "copilot";
  const draftsByThreadId = {} as ReturnType<
    typeof useComposerDraftStore.getState
  >["draftsByThreadId"];
  const model = props?.modelSelection?.model ?? DEFAULT_MODEL_BY_PROVIDER[provider];

  draftsByThreadId[threadId] = {
    prompt: props?.prompt ?? "",
    images: [],
    nonPersistedImageIds: [],
    persistedAttachments: [],
    terminalContexts: [],
    modelSelectionByProvider: {
      [provider]: {
        provider,
        model,
        ...(props?.modelSelection?.options ? { options: props.modelSelection.options } : {}),
      },
    },
    activeProvider: provider,
    runtimeMode: null,
    interactionMode: null,
  };
  useComposerDraftStore.setState({
    draftsByThreadId,
    draftThreadsByThreadId: {},
    projectDraftThreadIdByProjectId: {},
  });
  const host = document.createElement("div");
  document.body.append(host);
  const onPromptChange = vi.fn();
  const providerOptions = props?.modelSelection?.options;
  const models = [
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
  ];
  const screen = await render(
    <CompactComposerControlsMenu
      activePlan={false}
      interactionMode="default"
      planSidebarOpen={false}
      runtimeMode="approval-required"
      traitsMenuContent={
        <TraitsMenuContent
          provider={provider}
          models={models}
          threadId={threadId}
          model={model}
          prompt={props?.prompt ?? ""}
          modelOptions={providerOptions}
          onPromptChange={onPromptChange}
        />
      }
      onToggleInteractionMode={vi.fn()}
      onTogglePlanSidebar={vi.fn()}
      onToggleRuntimeMode={vi.fn()}
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

describe("CompactComposerControlsMenu", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    useComposerDraftStore.setState({
      draftsByThreadId: {},
      draftThreadsByThreadId: {},
      projectDraftThreadIdByProjectId: {},
      stickyModelSelectionByProvider: {},
    });
  });

  it("shows the provided reasoning effort options for copilot", async () => {
    await using _ = await mountMenu({
      modelSelection: { provider: "copilot", model: "gpt-5.4" },
    });

    await page.getByLabelText("More composer controls").click();

    await vi.waitFor(() => {
      const text = document.body.textContent ?? "";
      expect(text).toContain("Extra High");
      expect(text).toContain("High");
      expect(text).toContain("Medium");
      expect(text).toContain("Low");
    });
  });

  it("renders without effort controls for models without effort levels", async () => {
    await using _ = await mountMenu({
      modelSelection: { provider: "copilot", model: "gpt-5.4-mini" },
    });

    await page.getByLabelText("More composer controls").click();

    await vi.waitFor(() => {
      const text = document.body.textContent ?? "";
      expect(text).not.toContain("Extra High");
      expect(text).not.toContain("Low");
    });
  });

  it("renders with explicit reasoning effort option", async () => {
    await using _ = await mountMenu({
      modelSelection: {
        provider: "copilot",
        model: "gpt-5.4",
        options: { reasoningEffort: "low" },
      },
    });

    await page.getByLabelText("More composer controls").click();

    await vi.waitFor(() => {
      const text = document.body.textContent ?? "";
      expect(text).toContain("Low");
      expect(text).toContain("High");
    });
  });
});
