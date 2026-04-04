import {
  type EditorId,
  type ProjectScript,
  type ResolvedKeybindingsConfig,
  type ThreadId,
  type TicketStage,
  type CopilotPhase,
} from "@t3tools/contracts";
import { memo, useState } from "react";
import { BookOpenIcon, BugIcon, StarIcon, LayersIcon, CheckSquareIcon, FileTextIcon, DiffIcon, TerminalSquareIcon } from "lucide-react";
import { StageIndicator } from "../ticket/StageIndicator";
import { ContextDrawer } from "../ticket/ContextDrawer";
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
        {/* Meridian: work item context button — icon + ID, click opens context drawer */}
        {workItemId && (
          <WorkItemContextButton workItemId={workItemId} workItemType={workItemType} />
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
            <button
              type="button"
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border/60 px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              onClick={() => setContextOpen(true)}
            />
          }
        >
          <Icon className="h-3 w-3" style={{ color }} />
          <span>#{workItemId}</span>
        </TooltipTrigger>
        <TooltipPopup side="bottom">
          {workItemType ?? "Work Item"} #{workItemId} — Click to view context
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
