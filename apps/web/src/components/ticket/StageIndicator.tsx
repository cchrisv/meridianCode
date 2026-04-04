import {
  BotIcon,
  FilterIcon,
  ClipboardCheckIcon,
  CodeIcon,
  ShieldCheckIcon,
  RocketIcon,
  CheckIcon,
} from "lucide-react";
import { STAGE_DEFINITIONS, PHASE_DEFINITIONS, type TicketStage, type CopilotPhase } from "@t3tools/contracts";

const STAGE_ICONS = [BotIcon, FilterIcon, ClipboardCheckIcon, CodeIcon, ShieldCheckIcon, RocketIcon];

/**
 * Compact stage stepper designed to sit inside the chat header bar.
 * Shows stage icons in a horizontal row with connector lines.
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

  return (
    <div className="flex items-center gap-0 border-t border-border/50 px-3 py-1">
      {visibleStages.map((stageDef, index) => {
        const isActive = stageDef.stage === currentStage;
        const isCompleted = index < currentIndex;
        const Icon = STAGE_ICONS[index] ?? BotIcon;

        return (
          <div key={stageDef.stage} className="flex items-center">
            {/* Connector line */}
            {index > 0 && (
              <div
                className="h-[1.5px] w-3 transition-colors"
                style={{
                  backgroundColor: isCompleted ? stageDef.color : "var(--border)",
                }}
              />
            )}

            {/* Stage dot/icon */}
            <div className="group relative flex items-center">
              <div
                className="flex h-5 w-5 items-center justify-center rounded-full transition-all"
                style={{
                  backgroundColor: isActive
                    ? stageDef.color
                    : isCompleted
                      ? stageDef.color
                      : "transparent",
                  border: `1.5px solid ${isActive || isCompleted ? stageDef.color : "var(--border)"}`,
                  boxShadow: isActive ? `0 0 0 2px ${stageDef.color}25` : "none",
                }}
              >
                {isCompleted ? (
                  <CheckIcon className="h-2.5 w-2.5 text-white" />
                ) : (
                  <Icon
                    className="h-2.5 w-2.5"
                    style={{
                      color: isActive ? "white" : "var(--muted-foreground)",
                      opacity: isActive ? 1 : 0.5,
                    }}
                  />
                )}
              </div>

              {/* Tooltip label on hover */}
              <div className="pointer-events-none absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-popover px-1.5 py-0.5 text-[9px] font-medium text-popover-foreground shadow-sm border border-border opacity-0 group-hover:opacity-100 transition-opacity z-10">
                {stageDef.shortLabel}
              </div>
            </div>
          </div>
        );
      })}

      {/* Sub-phase pills (Stage 1 only) */}
      {currentStage === "copilot-refinement" && copilotPhase && (
        <>
          <div className="mx-1.5 h-3 w-px bg-border" />
          <div className="flex items-center gap-0.5">
            {PHASE_DEFINITIONS.map((phaseDef: { phase: string; shortLabel: string; index: number }) => {
              const currentPhaseIndex = PHASE_DEFINITIONS.findIndex(
                (p: { phase: string }) => p.phase === copilotPhase,
              );
              const isPhaseActive = phaseDef.phase === copilotPhase;
              const isPhaseCompleted = phaseDef.index < currentPhaseIndex;

              return (
                <div
                  key={phaseDef.phase}
                  className="rounded-sm px-1 py-px text-[8px] font-semibold leading-none"
                  style={{
                    backgroundColor: isPhaseActive
                      ? "#1565c0"
                      : isPhaseCompleted
                        ? "#1565c015"
                        : "transparent",
                    color: isPhaseActive
                      ? "white"
                      : isPhaseCompleted
                        ? "#1565c0"
                        : "var(--muted-foreground)",
                    opacity: !isPhaseActive && !isPhaseCompleted ? 0.4 : 1,
                  }}
                >
                  {phaseDef.shortLabel}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
