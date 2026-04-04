import {
  type EditorId,
  type ProjectScript,
  type ResolvedKeybindingsConfig,
  type ThreadId,
  type TicketStage,
  type CopilotPhase,
} from "@t3tools/contracts";
import { memo, useState } from "react";
import { BookOpenIcon, BugIcon, StarIcon, LayersIcon, CheckSquareIcon, FileTextIcon, DiffIcon, TerminalSquareIcon, ZapIcon, LinkIcon } from "lucide-react";
import { createPortal } from "react-dom";
// Popover removed — using simple dropdown for reliability
import { StageIndicator } from "../ticket/StageIndicator";
import { ContextDrawer } from "../ticket/ContextDrawer";
import { ensureNativeApi } from "../../nativeApi";
import { newCommandId } from "../../lib/utils";
import { toastManager } from "../ui/toast";
import { getWsRpcClient } from "../../wsRpcClient";
import GitActionsControl from "../GitActionsControl";
import { Badge } from "../ui/badge";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import ProjectScriptsControl, { type NewProjectScriptInput } from "../ProjectScriptsControl";
import { Toggle } from "../ui/toggle";
import { SidebarTrigger } from "../ui/sidebar";
import { OpenInPicker } from "./OpenInPicker";

interface ChatHeaderProps {
  activeThreadId: ThreadId;
  activeThreadTitle: string;
  activeProjectName: string | undefined;
  isGitRepo: boolean;
  openInCwd: string | null;
  activeProjectScripts: ProjectScript[] | undefined;
  preferredScriptId: string | null;
  keybindings: ResolvedKeybindingsConfig;
  availableEditors: ReadonlyArray<EditorId>;
  terminalAvailable: boolean;
  terminalOpen: boolean;
  terminalToggleShortcutLabel: string | null;
  diffToggleShortcutLabel: string | null;
  gitCwd: string | null;
  diffOpen: boolean;
  /** Meridian: work item fields for inline header display */
  workItemId: string | null;
  workItemType: string | null;
  workItemStage: string | null;
  copilotPhase: string | null;
  onRunProjectScript: (script: ProjectScript) => void;
  onAddProjectScript: (input: NewProjectScriptInput) => Promise<void>;
  onUpdateProjectScript: (scriptId: string, input: NewProjectScriptInput) => Promise<void>;
  onDeleteProjectScript: (scriptId: string) => Promise<void>;
  onToggleTerminal: () => void;
  onToggleDiff: () => void;
  /** Callback: load a named prompt and inject into composer */
  onOpenPrompts?: (promptName: string) => void;
}

export const ChatHeader = memo(function ChatHeader({
  activeThreadId,
  activeThreadTitle,
  activeProjectName,
  isGitRepo,
  openInCwd,
  activeProjectScripts,
  preferredScriptId,
  keybindings,
  availableEditors,
  terminalAvailable,
  terminalOpen,
  terminalToggleShortcutLabel,
  diffToggleShortcutLabel,
  gitCwd,
  diffOpen,
  workItemId,
  workItemType,
  workItemStage,
  copilotPhase,
  onOpenPrompts,
  onRunProjectScript,
  onAddProjectScript,
  onUpdateProjectScript,
  onDeleteProjectScript,
  onToggleTerminal,
  onToggleDiff,
}: ChatHeaderProps) {
  return (
    <div className="@container/header-actions flex min-w-0 flex-1 items-center gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden sm:gap-3">
        <SidebarTrigger className="size-7 shrink-0 md:hidden" />
        <h2
          className="min-w-0 shrink truncate text-sm font-medium text-foreground"
          title={activeThreadTitle}
        >
          {activeThreadTitle}
        </h2>
        {workItemId && (
          <StageIndicator
            currentStage={(workItemStage as TicketStage) ?? "copilot-refinement"}
            copilotPhase={copilotPhase as CopilotPhase}
          />
        )}
        {activeProjectName && (
          <Badge variant="outline" className="min-w-0 shrink overflow-hidden">
            <span className="min-w-0 truncate">{activeProjectName}</span>
          </Badge>
        )}
        {activeProjectName && !isGitRepo && (
          <Badge variant="outline" className="shrink-0 text-[10px] text-amber-700">
            No Git
          </Badge>
        )}
      </div>
      <div className="flex shrink-0 items-center justify-end gap-2 @3xl/header-actions:gap-3">
        {/* Meridian: Prompts popover */}
        {onOpenPrompts && (
          <PromptsPopover onSelectPrompt={onOpenPrompts} />
        )}
        {/* Meridian: work item context button OR link button */}
        {workItemId ? (
          <WorkItemContextButton workItemId={workItemId} workItemType={workItemType} />
        ) : (
          <LinkWorkItemButton threadId={activeThreadId} />
        )}
        {activeProjectScripts && (
          <ProjectScriptsControl
            scripts={activeProjectScripts}
            keybindings={keybindings}
            preferredScriptId={preferredScriptId}
            onRunScript={onRunProjectScript}
            onAddScript={onAddProjectScript}
            onUpdateScript={onUpdateProjectScript}
            onDeleteScript={onDeleteProjectScript}
          />
        )}
        {activeProjectName && (
          <OpenInPicker
            keybindings={keybindings}
            availableEditors={availableEditors}
            openInCwd={openInCwd}
          />
        )}
        {activeProjectName && <GitActionsControl gitCwd={gitCwd} activeThreadId={activeThreadId} />}
        <Tooltip>
          <TooltipTrigger
            render={
              <Toggle
                className="shrink-0"
                pressed={terminalOpen}
                onPressedChange={onToggleTerminal}
                aria-label="Toggle terminal drawer"
                variant="outline"
                size="xs"
                disabled={!terminalAvailable}
              >
                <TerminalSquareIcon className="size-3" />
              </Toggle>
            }
          />
          <TooltipPopup side="bottom">
            {!terminalAvailable
              ? "Terminal is unavailable until this thread has an active feature."
              : terminalToggleShortcutLabel
                ? `Toggle terminal drawer (${terminalToggleShortcutLabel})`
                : "Toggle terminal drawer"}
          </TooltipPopup>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Toggle
                className="shrink-0"
                pressed={diffOpen}
                onPressedChange={onToggleDiff}
                aria-label="Toggle diff panel"
                variant="outline"
                size="xs"
                disabled={!isGitRepo}
              >
                <DiffIcon className="size-3" />
              </Toggle>
            }
          />
          <TooltipPopup side="bottom">
            {!isGitRepo
              ? "Diff panel is unavailable because this workspace is not a git repository."
              : diffToggleShortcutLabel
                ? `Toggle diff panel (${diffToggleShortcutLabel})`
                : "Toggle diff panel"}
          </TooltipPopup>
        </Tooltip>
      </div>
    </div>
  );
});

// ── Work Item Context Button ─────────────────────────────────────────

function getWorkItemTypeIcon(type: string | null) {
  switch (type) {
    case "User Story": return { Icon: BookOpenIcon, color: "#1565c0" };
    case "Bug": return { Icon: BugIcon, color: "#c62828" };
    case "Feature": return { Icon: StarIcon, color: "#7b1fa2" };
    case "Epic": return { Icon: LayersIcon, color: "#f57c00" };
    case "Task": return { Icon: CheckSquareIcon, color: "#388e3c" };
    default: return { Icon: FileTextIcon, color: "var(--muted-foreground)" };
  }
}

function WorkItemContextButton({
  workItemId,
  workItemType,
}: {
  workItemId: string;
  workItemType: string | null;
}) {
  const [contextOpen, setContextOpen] = useState(false);
  const { Icon, color } = getWorkItemTypeIcon(workItemType);

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Toggle
              className="shrink-0 gap-1"
              pressed={contextOpen}
              onPressedChange={() => setContextOpen(!contextOpen)}
              aria-label={`${workItemType ?? "Work Item"} #${workItemId}`}
              variant="outline"
              size="xs"
            >
              <Icon className="size-3" style={{ color }} />
              <span className="text-[10px] tabular-nums">#{workItemId}</span>
            </Toggle>
          }
        />
        <TooltipPopup side="bottom">
          {workItemType ?? "Work Item"} #{workItemId} — View context
        </TooltipPopup>
      </Tooltip>

      <ContextDrawer
        workItemId={workItemId}
        open={contextOpen}
        onClose={() => setContextOpen(false)}
      />
    </>
  );
}

// ── Link Work Item Button ────────────────────────────────────────────

// ── Prompts Popover ──────────────────────────────────────────────────

interface PromptItem {
  name: string;
  label: string;
  description: string;
}

function PromptsPopover({ onSelectPrompt }: { onSelectPrompt: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !loaded) {
      const rpc = getWsRpcClient();
      rpc.prompt
        .list({})
        .then((result) => { setPrompts([...result.prompts]); setLoaded(true); })
        .catch(() => setLoaded(true));
    }
  };

  return (
    <div className="relative">
      <Tooltip>
        <TooltipTrigger
          render={
            <Toggle
              className="shrink-0"
              pressed={open}
              onPressedChange={handleToggle}
              aria-label="Prompts"
              variant="outline"
              size="xs"
            >
              <ZapIcon className="size-3" />
            </Toggle>
          }
        />
        <TooltipPopup side="bottom">Prompts</TooltipPopup>
      </Tooltip>

      {open && (
        <>
          {/* Backdrop to close on outside click */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          {/* Dropdown */}
          <div className="absolute right-0 top-full z-50 mt-1 w-72 max-h-72 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
            <div className="py-1">
              {prompts.length === 0 && loaded && (
                <div className="px-3 py-4 text-center text-xs text-muted-foreground">No prompts available</div>
              )}
              {prompts.length === 0 && !loaded && (
                <div className="px-3 py-4 text-center text-xs text-muted-foreground">Loading...</div>
              )}
              {prompts.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  className="flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors hover:bg-accent"
                  onClick={() => {
                    setOpen(false);
                    onSelectPrompt(p.name);
                  }}
                >
                  <span className="text-xs font-medium text-foreground">{p.label}</span>
                  <span className="text-[10px] text-muted-foreground">{p.description}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Link Work Item Button ────────────────────────────────────────────

function LinkWorkItemButton({ threadId }: { threadId: ThreadId }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [workItemId, setWorkItemId] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = workItemId.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      const api = ensureNativeApi();
      await api.orchestration.dispatchCommand({
        type: "thread.link-work-item",
        commandId: newCommandId(),
        threadId,
        workItemId: trimmed,
        workItemType: null,
        workItemStage: null,
        copilotPhase: null,
      } as any);
      toastManager.add({ type: "success" as const, title: "Linked", description: `#${trimmed}` });
      setDialogOpen(false);
      setWorkItemId("");
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Toggle
              className="shrink-0"
              pressed={false}
              onPressedChange={() => setDialogOpen(true)}
              aria-label="Link to work item"
              variant="outline"
              size="xs"
            >
              <LinkIcon className="size-3" />
            </Toggle>
          }
        />
        <TooltipPopup side="bottom">Link to work item</TooltipPopup>
      </Tooltip>

      {dialogOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
            onClick={(e) => { if (e.target === e.currentTarget) setDialogOpen(false); }}
          >
            <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-lg">
              <h2 className="text-lg font-semibold text-foreground">Link to Work Item</h2>
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
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setDialogOpen(false)} className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground" disabled={loading}>Cancel</button>
                  <button type="submit" disabled={!workItemId.trim() || loading} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">{loading ? "Linking..." : "Link"}</button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
