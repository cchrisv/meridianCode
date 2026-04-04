import {
  BotIcon,
  FilterIcon,
  ClipboardCheckIcon,
  CodeIcon,
  ShieldCheckIcon,
  RocketIcon,
} from "lucide-react";
import { STAGE_DEFINITIONS, PHASE_DEFINITIONS, type TicketStage, type CopilotPhase } from "@t3tools/contracts";

const STAGE_ICONS = [BotIcon, FilterIcon, ClipboardCheckIcon, CodeIcon, ShieldCheckIcon, RocketIcon];

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
    <div className="border-b border-border bg-card/50 px-4 py-3">
      {/* Stage stepper */}
      <div className="flex items-start justify-between">
        {visibleStages.map((stageDef, index) => {
          const isActive = stageDef.stage === currentStage;
          const isCompleted = index < currentIndex;
          const isFuture = index > currentIndex;
          const Icon = STAGE_ICONS[index] ?? BotIcon;
          const stepNumber = index + 1;

          return (
            <div key={stageDef.stage} className="flex flex-1 items-start">
              {/* Step content */}
              <div className="flex flex-col items-center gap-1.5 flex-1">
                {/* Circle with icon + step number */}
                <div className="relative">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full transition-all"
                    style={{
                      backgroundColor: isActive
                        ? stageDef.color
                        : isCompleted
                          ? stageDef.color
                          : "var(--muted)",
                      color: isActive || isCompleted ? "white" : "var(--muted-foreground)",
                      boxShadow: isActive ? `0 0 0 3px ${stageDef.color}30` : "none",
                    }}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  {/* Step number badge */}
                  <span
                    className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-bold"
                    style={{
                      backgroundColor: isActive || isCompleted ? stageDef.color : "var(--muted-foreground)",
                      color: "white",
                      border: "1.5px solid var(--card)",
                    }}
                  >
                    {stepNumber}
                  </span>
                </div>

                {/* Label */}
                <span
                  className="text-[9px] font-semibold text-center leading-tight max-w-[60px]"
                  style={{
                    color: isActive
                      ? stageDef.color
                      : isCompleted
                        ? stageDef.color
                        : "var(--muted-foreground)",
                    opacity: isFuture ? 0.5 : 1,
                  }}
                >
                  {stageDef.shortLabel}
                </span>
              </div>

              {/* Connector line */}
              {index < visibleStages.length - 1 && (
                <div className="flex items-center pt-4 px-0.5 flex-shrink-0">
                  <div
                    className="h-[2px] w-4 rounded-full transition-colors"
                    style={{
                      backgroundColor: index < currentIndex ? visibleStages[index + 1]?.color ?? "var(--border)" : "var(--border)",
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Sub-phases (Stage 1 only) */}
      {currentStage === "copilot-refinement" && copilotPhase && (
        <div className="mt-2 flex items-center justify-center gap-1">
          {PHASE_DEFINITIONS.map((phaseDef: { phase: string; label: string; shortLabel: string; index: number }) => {
            const currentPhaseIndex = PHASE_DEFINITIONS.findIndex(
              (p: { phase: string }) => p.phase === copilotPhase,
            );
            const isActive = phaseDef.phase === copilotPhase;
            const isCompleted = phaseDef.index < currentPhaseIndex;

            return (
              <div key={phaseDef.phase} className="flex items-center">
                {phaseDef.index > 0 && (
                  <div
                    className="mx-0.5 h-[1.5px] w-2 rounded-full"
                    style={{
                      backgroundColor: isCompleted ? "#1565c0" : "var(--border)",
                    }}
                  />
                )}
                <div
                  className="rounded-full px-1.5 py-0.5 text-[8px] font-semibold transition-colors"
                  style={{
                    backgroundColor: isActive
                      ? "#1565c0"
                      : isCompleted
                        ? "#1565c015"
                        : "transparent",
                    color: isActive
                      ? "white"
                      : isCompleted
                        ? "#1565c0"
                        : "var(--muted-foreground)",
                    border: `1px solid ${isActive ? "#1565c0" : isCompleted ? "#1565c040" : "var(--border)"}`,
                  }}
                >
                  {phaseDef.shortLabel}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Active action */}
      {activeAction && (
        <div className="mt-1.5 text-center text-[10px] text-muted-foreground">
          {activeAction}
        </div>
      )}
    </div>
  );
}
