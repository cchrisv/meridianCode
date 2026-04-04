import { STAGE_DEFINITIONS, PHASE_DEFINITIONS, type TicketStage, type CopilotPhase } from "@t3tools/contracts";

export function StageIndicator({
  currentStage,
  copilotPhase,
  activeAction,
}: {
  currentStage: TicketStage;
  copilotPhase?: CopilotPhase | null;
  activeAction?: string | null;
}) {
  const visibleStages = STAGE_DEFINITIONS.filter((s) => s.stage !== "closed");
  const currentIndex = visibleStages.findIndex((s) => s.stage === currentStage);

  return (
    <div className="flex flex-col gap-1 border-b border-border px-4 py-2">
      {/* Stage bar */}
      <div className="flex items-center gap-1">
        {visibleStages.map((stageDef, index) => {
          const isActive = stageDef.stage === currentStage;
          const isCompleted = index < currentIndex;

          return (
            <div key={stageDef.stage} className="flex items-center">
              {index > 0 && (
                <div
                  className="mx-0.5 h-px w-3"
                  style={{
                    backgroundColor: isCompleted ? stageDef.color : "var(--border)",
                  }}
                />
              )}
              <div
                className="rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors"
                style={{
                  backgroundColor: isActive
                    ? stageDef.color
                    : isCompleted
                      ? `${stageDef.color}30`
                      : "transparent",
                  color: isActive
                    ? "white"
                    : isCompleted
                      ? stageDef.color
                      : "var(--muted-foreground)",
                  border: `1px solid ${isActive || isCompleted ? stageDef.color : "var(--border)"}`,
                }}
              >
                {stageDef.shortLabel}
              </div>
            </div>
          );
        })}
      </div>

      {/* Sub-phases (Stage 1 only) */}
      {currentStage === "copilot-refinement" && copilotPhase && (
        <div className="flex items-center gap-1 pl-1">
          {PHASE_DEFINITIONS.map((phaseDef, index) => {
            const currentPhaseIndex = PHASE_DEFINITIONS.findIndex(
              (p) => p.phase === copilotPhase,
            );
            const isActive = phaseDef.phase === copilotPhase;
            const isCompleted = index < currentPhaseIndex;

            return (
              <div
                key={phaseDef.phase}
                className="rounded px-1.5 py-0.5 text-[9px] font-medium"
                style={{
                  backgroundColor: isActive
                    ? "#1565c0"
                    : isCompleted
                      ? "#1565c020"
                      : "transparent",
                  color: isActive
                    ? "white"
                    : isCompleted
                      ? "#1565c0"
                      : "var(--muted-foreground)",
                }}
              >
                {phaseDef.shortLabel}
              </div>
            );
          })}
        </div>
      )}

      {/* Active action */}
      {activeAction && (
        <div className="text-[10px] text-muted-foreground">
          Active: {activeAction}
        </div>
      )}
    </div>
  );
}
