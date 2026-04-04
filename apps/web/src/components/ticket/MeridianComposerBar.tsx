import { useState, useCallback } from "react";
import { UtilityActionMenu, type PromptItem } from "./UtilityActionMenu";
import { UtilityWizardDialog } from "./UtilityWizardDialog";
import { ContextDrawer } from "./ContextDrawer";

/**
 * Bar that sits above the main composer, providing [Actions] and [Context] buttons.
 * When a utility action is selected and the wizard completes, the prompt content
 * is passed to onSendPrompt to be injected as a user turn.
 */
export function MeridianComposerBar({
  ticketId,
  workItemId,
  stage,
  platform,
  onSendPrompt,
}: {
  ticketId: string | null;
  workItemId: string | null;
  stage: string | null;
  platform: string | null;
  onSendPrompt: (content: string) => void;
}) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<PromptItem | null>(null);

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

        {ticketId && (
          <button
            onClick={() => setContextOpen(!contextOpen)}
            className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <span>Context</span>
          </button>
        )}

        {ticketId && (
          <span className="ml-auto text-[10px] text-muted-foreground">
            #{workItemId} {platform ? `\u00b7 ${platform}` : ""} {stage ? `\u00b7 ${stage}` : ""}
          </span>
        )}
      </div>

      {/* Wizard dialog */}
      {selectedPrompt && (
        <UtilityWizardDialog
          prompt={selectedPrompt}
          ticketId={ticketId}
          workItemId={workItemId}
          platform={platform}
          onClose={() => setSelectedPrompt(null)}
          onSubmit={handleWizardSubmit}
        />
      )}

      {/* Context drawer */}
      <ContextDrawer
        ticketId={ticketId}
        open={contextOpen}
        onClose={() => setContextOpen(false)}
      />
    </>
  );
}
