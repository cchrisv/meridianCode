import { useState } from "react";
import { createPortal } from "react-dom";
import { getWsRpcClient } from "../../wsRpcClient";
import type { PromptItem } from "./UtilityActionMenu";

/**
 * Wizard dialog that collects inputs for a utility prompt, pre-fills from
 * ticket context, then loads and returns the prompt content for injection
 * into the chat as a user turn.
 */
export function UtilityWizardDialog({
  prompt,
  ticketId,
  workItemId,
  platform,
  onClose,
  onSubmit,
}: {
  prompt: PromptItem;
  ticketId?: string | null;
  workItemId?: string | null;
  platform?: string | null;
  onClose: () => void;
  onSubmit: (promptContent: string) => void;
}) {
  // Build initial variable values from ticket context
  const [variables, setVariables] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {};
    for (const v of prompt.variables) {
      if (v === "work_item_id" && workItemId) defaults[v] = workItemId;
      else if (v === "platform" && platform) defaults[v] = platform;
      else if (v === "context_file" && workItemId) {
        defaults[v] = `core/.ai-artifacts/${workItemId}/ticket-context.json`;
      } else {
        defaults[v] = "";
      }
    }
    return defaults;
  });

  const [loading, setLoading] = useState(false);

  // Filter to variables that aren't auto-filled (need user input)
  const editableVars = prompt.variables.filter(
    (v) => !["work_item_id", "platform", "context_file"].includes(v) || !variables[v],
  );

  const handleRun = async () => {
    setLoading(true);
    try {
      const rpc = getWsRpcClient();
      const result = await rpc.prompt.load({ name: prompt.name, variables });
      onSubmit(result.content);
    } catch (err) {
      console.error("Failed to load prompt:", err);
      // Fallback: submit the prompt name as text
      onSubmit(`Run the ${prompt.label} workflow for work item ${workItemId ?? "unknown"}`);
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-foreground">{prompt.label}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{prompt.description}</p>

        <div className="mt-4 flex flex-col gap-3">
          {/* Pre-filled context (read-only display) */}
          {workItemId && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Work Item:</span>
              <span className="font-mono text-foreground">#{workItemId}</span>
            </div>
          )}
          {platform && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Platform:</span>
              <span className="font-mono text-foreground">{platform}</span>
            </div>
          )}

          {/* Editable variables */}
          {editableVars.map((varName) => (
            <div key={varName} className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">
                {varName.replace(/_/g, " ")}
              </label>
              <input
                type="text"
                value={variables[varName] ?? ""}
                onChange={(e) =>
                  setVariables((prev) => ({ ...prev, [varName]: e.target.value }))
                }
                placeholder={`Enter ${varName.replace(/_/g, " ")}`}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          ))}

          {editableVars.length === 0 && !workItemId && !platform && (
            <p className="text-xs text-muted-foreground italic">
              No additional inputs needed. Click Run to execute.
            </p>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleRun}
            disabled={loading}
            className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {loading ? "Loading..." : "Run"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
