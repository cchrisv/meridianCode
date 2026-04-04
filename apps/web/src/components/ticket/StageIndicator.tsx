import { STAGE_DEFINITIONS, type TicketStage, type CopilotPhase, PHASE_DEFINITIONS } from "@t3tools/contracts";

/**
 * Compact inline stage dots — designed to sit in the header bar next to the thread title.
 * Shows 6 small dots (one per Dream Team stage). Active dot is filled and slightly larger.
 * Hover shows stage name as a tooltip.
 */
export function StageIndicator({
  currentStage,
  copilotPhase,
}: {
  currentStage: TicketStage;
  copilotPhase?: CopilotPhase | null;
}) {
  const visibleStages = STAGE_DEFINITIONS.filter((s) => s.stage !== "closed");
  const currentIndex = visibleStages.findIndex((s) => s.stage === currentStage);

  // Build the tooltip text
  const activeStageDef = visibleStages[currentIndex];
  const phaseLabel = copilotPhase
    ? PHASE_DEFINITIONS.find((p: { phase: string }) => p.phase === copilotPhase)?.label
    : null;

  return (
    <div
      className="inline-flex items-center gap-[3px] px-1.5"
      title={
        phaseLabel
          ? `${activeStageDef?.label ?? "Unknown"} — ${phaseLabel}`
          : activeStageDef?.label ?? "Unknown"
      }
    >
      {visibleStages.map((stageDef, index) => {
        const isActive = index === currentIndex;
        const isCompleted = index < currentIndex;

        return (
          <div
            key={stageDef.stage}
            className="rounded-full transition-all"
            style={{
              width: isActive ? 7 : 5,
              height: isActive ? 7 : 5,
              backgroundColor: isActive
                ? stageDef.color
                : isCompleted
                  ? stageDef.color
                  : "var(--muted-foreground)",
              opacity: isActive ? 1 : isCompleted ? 0.7 : 0.2,
              boxShadow: isActive ? `0 0 0 2px ${stageDef.color}30` : "none",
            }}
          />
        );
      })}
    </div>
  );
}
