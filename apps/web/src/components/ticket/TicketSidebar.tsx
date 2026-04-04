import { useState } from "react";
import {
  STAGE_DEFINITIONS,
  PHASE_DEFINITIONS,
  type TicketListItem,
  type TicketStage,
} from "@t3tools/contracts";
import { useTicketStore, groupTicketsByStage } from "../../ticketStore";
import { TicketImportDialog } from "./TicketImportDialog";
import { resolvePlatformVisual, formatPlatformLabel } from "../settings/meridianPlatformVisuals";

/**
 * Ticket-centric sidebar content.
 * Groups tickets by Dream Team stage with collapsible sections.
 */
export function TicketSidebar({
  onSelectTicket,
  onImportTicket,
}: {
  onSelectTicket: (ticketId: string, threadId?: string) => void;
  onImportTicket: (workItemId: string) => void;
}) {
  const tickets = useTicketStore((s) => s.tickets);
  const activeTicketId = useTicketStore((s) => s.activeTicketId);
  const [importOpen, setImportOpen] = useState(false);
  const [collapsedStages, setCollapsedStages] = useState<Set<string>>(new Set(["closed"]));

  const grouped = groupTicketsByStage(tickets);
  const visibleStages = STAGE_DEFINITIONS.filter((s) => s.stage !== "closed");

  const toggleStage = (stage: string) => {
    setCollapsedStages((prev) => {
      const next = new Set(prev);
      if (next.has(stage)) next.delete(stage);
      else next.add(stage);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-0.5">
      {/* Import button */}
      <button
        onClick={() => setImportOpen(true)}
        className="mx-2 mb-2 flex items-center justify-center gap-1.5 rounded-md border border-dashed border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
      >
        + Import Ticket
      </button>

      {/* Stage groups */}
      {visibleStages.map((stageDef) => {
        const stageTickets = grouped[stageDef.stage] ?? [];
        const isCollapsed = collapsedStages.has(stageDef.stage);
        const count = stageTickets.length;

        return (
          <div key={stageDef.stage}>
            <button
              onClick={() => toggleStage(stageDef.stage)}
              className="flex w-full items-center gap-1.5 px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <span className="text-[10px]">{isCollapsed ? "\u25B8" : "\u25BE"}</span>
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: stageDef.color }}
              />
              <span className="flex-1 text-left">{stageDef.shortLabel}</span>
              {count > 0 && (
                <span className="text-[10px] text-muted-foreground">({count})</span>
              )}
            </button>

            {!isCollapsed &&
              stageTickets.map((ticket) => (
                <TicketSidebarItem
                  key={ticket.ticketId}
                  ticket={ticket}
                  isActive={ticket.ticketId === activeTicketId}
                  onClick={() => onSelectTicket(ticket.ticketId, ticket.threadId ?? undefined)}
                />
              ))}
          </div>
        );
      })}

      <TicketImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={(workItemId) => {
          setImportOpen(false);
          onImportTicket(workItemId);
        }}
      />
    </div>
  );
}

function TicketSidebarItem({
  ticket,
  isActive,
  onClick,
}: {
  ticket: TicketListItem;
  isActive: boolean;
  onClick: () => void;
}) {
  const platformLabel = ticket.platform
    ? formatPlatformLabel(ticket.platform)
    : null;
  const platformPalette = ticket.platform
    ? resolvePlatformVisual(ticket.platform).paletteClass
    : null;

  const phaseLabel =
    ticket.currentStage === "copilot-refinement" && ticket.copilotPhase
      ? PHASE_DEFINITIONS.find((p) => p.phase === ticket.copilotPhase)
      : null;

  return (
    <button
      onClick={onClick}
      className={`flex w-full flex-col gap-0.5 rounded-md px-3 py-1.5 text-left transition-colors ${
        isActive
          ? "bg-accent text-accent-foreground"
          : "text-foreground hover:bg-muted"
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground">#{ticket.workItemId}</span>
        <span className="flex-1 truncate text-xs font-medium">{ticket.title}</span>
      </div>
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        {platformLabel && (
          <span className={`rounded px-1 py-0.5 ${platformPalette ?? ""}`}>
            {platformLabel}
          </span>
        )}
        {ticket.priority && <span>{ticket.priority}</span>}
        {phaseLabel && <span>Phase {phaseLabel.index + 1}/5</span>}
        {ticket.assignedTo && <span>@{ticket.assignedTo.split("@")[0]}</span>}
      </div>
    </button>
  );
}
