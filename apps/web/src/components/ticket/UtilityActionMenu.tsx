import { useState, useEffect } from "react";
import { getWsRpcClient } from "../../wsRpcClient";

export interface PromptItem {
  readonly name: string;
  readonly label: string;
  readonly description: string;
  readonly variables: readonly string[];
}

/**
 * Stage-aware dropdown of available utility prompts.
 * Fetches prompts from the server PromptLoader, filtered by current stage.
 */
export function UtilityActionMenu({
  stage,
  open,
  onClose,
  onSelectPrompt,
}: {
  stage?: string | null;
  open: boolean;
  onClose: () => void;
  onSelectPrompt: (prompt: PromptItem) => void;
}) {
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const rpc = getWsRpcClient();
    rpc.prompt
      .list({ stage: stage ?? undefined })
      .then((result) => setPrompts([...result.prompts]))
      .catch(() => setPrompts([]))
      .finally(() => setLoading(false));
  }, [open, stage]);

  if (!open) return null;

  return (
    <div className="absolute bottom-full left-0 z-50 mb-1 w-80 max-h-72 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
      <div className="sticky top-0 border-b border-border bg-popover px-3 py-2">
        <div className="text-xs font-semibold text-foreground">Utility Actions</div>
        {stage && (
          <div className="text-[10px] text-muted-foreground">
            Showing actions for: {stage}
          </div>
        )}
      </div>

      {loading ? (
        <div className="px-3 py-4 text-center text-xs text-muted-foreground">Loading...</div>
      ) : prompts.length === 0 ? (
        <div className="px-3 py-4 text-center text-xs text-muted-foreground">
          No actions available
        </div>
      ) : (
        <div className="py-1">
          {prompts.map((prompt) => (
            <button
              key={prompt.name}
              onClick={() => {
                onSelectPrompt(prompt);
                onClose();
              }}
              className="flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors hover:bg-accent"
            >
              <span className="text-xs font-medium text-foreground">{prompt.label}</span>
              <span className="text-[10px] text-muted-foreground">{prompt.description}</span>
            </button>
          ))}
        </div>
      )}

      <div className="sticky bottom-0 border-t border-border bg-popover px-3 py-1.5">
        <button
          onClick={onClose}
          className="text-[10px] text-muted-foreground hover:text-foreground"
        >
          Close
        </button>
      </div>
    </div>
  );
}
