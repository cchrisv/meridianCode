import { useState, useCallback } from "react";
import { UtilityActionMenu, type PromptItem } from "./UtilityActionMenu";
import { UtilityWizardDialog } from "./UtilityWizardDialog";
import { ContextDrawer } from "./ContextDrawer";
import { createPortal } from "react-dom";
import { ensureNativeApi } from "../../nativeApi";
import { newCommandId } from "../../lib/utils";
import { toastManager } from "../ui/toast";
import type { ThreadId } from "@t3tools/contracts";

/**
 * Bar that sits above the main composer, providing [Actions], [Context],
 * and [Link to Work Item] buttons.
 */
export function MeridianComposerBar({
  workItemId,
  threadId,
  stage,
  platform,
  onSendPrompt,
}: {
  workItemId: string | null;
  threadId: string | null;
  stage: string | null;
  platform: string | null;
  onSendPrompt: (content: string) => void;
}) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<PromptItem | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);

  const handleSelectPrompt = useCallback((prompt: PromptItem) => {
    setSelectedPrompt(prompt);
  }, []);

  const handleWizardSubmit = useCallback(
    (content: string) => {
      setSelectedPrompt(null);
      onSendPrompt(content);
    },
    [onSendPrompt],
  );

  return (
    <>
      {/* Action bar */}
      <div className="flex items-center gap-1 px-3 py-1 border-b border-border/50">
        <div className="relative">
          <button
            onClick={() => setActionsOpen(!actionsOpen)}
            className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <span>Actions</span>
          </button>
          <UtilityActionMenu
            stage={stage}
            open={actionsOpen}
            onClose={() => setActionsOpen(false)}
            onSelectPrompt={handleSelectPrompt}
          />
        </div>

        {workItemId && (
          <button
            onClick={() => setContextOpen(!contextOpen)}
            className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <span>Context</span>
          </button>
        )}

        {!workItemId && threadId && (
          <button
            onClick={() => setLinkDialogOpen(true)}
            className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <span>Link to Work Item</span>
          </button>
        )}

        {workItemId && (
          <span className="ml-auto text-[10px] text-muted-foreground">
            #{workItemId} {platform ? `\u00b7 ${platform}` : ""} {stage ? `\u00b7 ${stage}` : ""}
          </span>
        )}
      </div>

      {/* Wizard dialog */}
      {selectedPrompt && (
        <UtilityWizardDialog
          prompt={selectedPrompt}
          workItemId={workItemId}
          platform={platform}
          onClose={() => setSelectedPrompt(null)}
          onSubmit={handleWizardSubmit}
        />
      )}

      {/* Context drawer */}
      <ContextDrawer
        workItemId={workItemId}
        open={contextOpen}
        onClose={() => setContextOpen(false)}
      />

      {/* Link to Work Item dialog */}
      {linkDialogOpen && threadId && (
        <LinkWorkItemDialog
          threadId={threadId}
          onClose={() => setLinkDialogOpen(false)}
        />
      )}
    </>
  );
}

function LinkWorkItemDialog({
  threadId,
  onClose,
}: {
  threadId: string;
  onClose: () => void;
}) {
  const [workItemId, setWorkItemId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = workItemId.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);

    try {
      const api = ensureNativeApi();
      await api.orchestration.dispatchCommand({
        type: "thread.linkWorkItem",
        commandId: newCommandId(),
        threadId: threadId as unknown as ThreadId,
        workItemId: trimmed,
        workItemStage: null,
        copilotPhase: null,
      } as any);

      toastManager.add({
        type: "success" as const,
        title: "Work item linked",
        description: `Thread linked to #${trimmed}`,
      });
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-foreground">Link to Work Item</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter an ADO work item ID to link this thread
        </p>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          <input
            type="text"
            placeholder="Work item ID (e.g., 269688)"
            value={workItemId}
            onChange={(e) => setWorkItemId(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            autoFocus
            disabled={loading}
          />

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!workItemId.trim() || loading}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {loading ? "Linking..." : "Link"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
