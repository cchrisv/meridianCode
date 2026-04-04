import { Schema } from "effect";
import { IsoDateTime, ThreadId, TrimmedNonEmptyString, TrimmedString } from "./baseSchemas";

// ── Branded IDs ──────────────────────────────────────────────────────

export const TicketId = TrimmedNonEmptyString;
export type TicketId = typeof TicketId.Type;

// ── Enums ────────────────────────────────────────────────────────────

/** The 6 Dream Team Process stages + closed. */
export const TicketStage = Schema.Literals([
  "copilot-refinement",
  "triage",
  "refinement",
  "development",
  "qa",
  "release",
  "closed",
]);
export type TicketStage = typeof TicketStage.Type;

/** The 5 AI phases within Stage 1 (Copilot Refinement). */
export const CopilotPhase = Schema.Literals([
  "research",
  "grooming",
  "solutioning-research",
  "solutioning",
  "finalization",
]);
export type CopilotPhase = typeof CopilotPhase.Type;

export const WorkItemType = Schema.Literals([
  "User Story",
  "Bug",
  "Feature",
  "Epic",
  "Task",
]);
export type WorkItemType = typeof WorkItemType.Type;

// ── ADO Board Column → Stage mapping ────────────────────────────────

const BOARD_COLUMN_TO_STAGE: Record<string, TicketStage> = {
  "New": "copilot-refinement",
  "Backlog": "triage",
  "Refinement": "refinement",
  "Ready": "development",
  "Development": "development",
  "QA": "qa",
  "UAT": "qa",
  "Release": "release",
  "Closed": "closed",
  "Done": "closed",
  "Removed": "closed",
};

/** Map an ADO board column name to a Dream Team stage. Defaults to "copilot-refinement". */
export function boardColumnToStage(column: string | null | undefined): TicketStage {
  if (!column) return "copilot-refinement";
  return BOARD_COLUMN_TO_STAGE[column] ?? "copilot-refinement";
}

// ── Ticket Metadata ──────────────────────────────────────────────────

export const TicketMetadata = Schema.Struct({
  workItemId: TrimmedNonEmptyString,
  title: TrimmedNonEmptyString,
  workItemType: Schema.NullOr(TrimmedString).pipe(Schema.withDecodingDefault(() => null)),
  platform: Schema.NullOr(TrimmedString).pipe(Schema.withDecodingDefault(() => null)),
  team: Schema.NullOr(TrimmedString).pipe(Schema.withDecodingDefault(() => null)),
  priority: Schema.NullOr(TrimmedString).pipe(Schema.withDecodingDefault(() => null)),
  storyPoints: Schema.NullOr(Schema.Number).pipe(Schema.withDecodingDefault(() => null)),
  wsjfScore: Schema.NullOr(Schema.Number).pipe(Schema.withDecodingDefault(() => null)),
  areaPath: Schema.NullOr(TrimmedString).pipe(Schema.withDecodingDefault(() => null)),
  iterationPath: Schema.NullOr(TrimmedString).pipe(Schema.withDecodingDefault(() => null)),
  boardColumn: Schema.NullOr(TrimmedString).pipe(Schema.withDecodingDefault(() => null)),
  assignedTo: Schema.NullOr(TrimmedString).pipe(Schema.withDecodingDefault(() => null)),
});
export type TicketMetadata = typeof TicketMetadata.Type;

// ── Ticket State ─────────────────────────────────────────────────────

export const TicketState = Schema.Struct({
  workItemId: TicketId,
  metadata: TicketMetadata,
  currentStage: TicketStage,
  copilotPhase: Schema.NullOr(TrimmedString).pipe(Schema.withDecodingDefault(() => null)),
  phasesCompleted: Schema.Array(TrimmedString).pipe(Schema.withDecodingDefault(() => [])),
  contextPath: Schema.NullOr(TrimmedString).pipe(Schema.withDecodingDefault(() => null)),
  threadId: Schema.NullOr(TrimmedString).pipe(Schema.withDecodingDefault(() => null)),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
export type TicketState = typeof TicketState.Type;

// ── Ticket List Item (lightweight for sidebar) ───────────────────────

export const TicketListItem = Schema.Struct({
  workItemId: TrimmedNonEmptyString,
  title: TrimmedNonEmptyString,
  workItemType: Schema.NullOr(TrimmedString).pipe(Schema.withDecodingDefault(() => null)),
  currentStage: TicketStage,
  copilotPhase: Schema.NullOr(TrimmedString).pipe(Schema.withDecodingDefault(() => null)),
  platform: Schema.NullOr(TrimmedString).pipe(Schema.withDecodingDefault(() => null)),
  priority: Schema.NullOr(TrimmedString).pipe(Schema.withDecodingDefault(() => null)),
  assignedTo: Schema.NullOr(TrimmedString).pipe(Schema.withDecodingDefault(() => null)),
  threadId: Schema.NullOr(TrimmedString).pipe(Schema.withDecodingDefault(() => null)),
  updatedAt: IsoDateTime,
});
export type TicketListItem = typeof TicketListItem.Type;

// ── RPC Input/Output ─────────────────────────────────────────────────

export const TicketImportInput = Schema.Struct({
  workItemId: TrimmedNonEmptyString,
});
export type TicketImportInput = typeof TicketImportInput.Type;

export const TicketImportResult = Schema.Struct({
  workItemId: TicketId,
  threadId: ThreadId,
  state: TicketState,
});
export type TicketImportResult = typeof TicketImportResult.Type;

export const TicketListInput = Schema.Struct({
  areaPath: Schema.optional(TrimmedString),
});
export type TicketListInput = typeof TicketListInput.Type;

export const TicketListResult = Schema.Struct({
  tickets: Schema.Array(TicketListItem),
});
export type TicketListResult = typeof TicketListResult.Type;

export const TicketGetStateInput = Schema.Struct({
  workItemId: TicketId,
});
export type TicketGetStateInput = typeof TicketGetStateInput.Type;

export const TicketGetStateResult = Schema.Struct({
  state: TicketState,
});
export type TicketGetStateResult = typeof TicketGetStateResult.Type;

export const TicketGetContextInput = Schema.Struct({
  workItemId: TicketId,
});
export type TicketGetContextInput = typeof TicketGetContextInput.Type;

export const TicketGetContextResult = Schema.Struct({
  context: Schema.Unknown,
});
export type TicketGetContextResult = typeof TicketGetContextResult.Type;

export const TicketStageTransitionInput = Schema.Struct({
  workItemId: TicketId,
  targetStage: TicketStage,
});
export type TicketStageTransitionInput = typeof TicketStageTransitionInput.Type;

export const TicketStageTransitionResult = Schema.Struct({
  workItemId: TicketId,
  previousStage: TicketStage,
  currentStage: TicketStage,
});
export type TicketStageTransitionResult = typeof TicketStageTransitionResult.Type;

// ── Stage display helpers ────────────────────────────────────────────

export const STAGE_DEFINITIONS: ReadonlyArray<{
  readonly stage: TicketStage;
  readonly label: string;
  readonly shortLabel: string;
  readonly color: string;
}> = [
  { stage: "copilot-refinement", label: "Copilot Refinement", shortLabel: "Copilot", color: "#1565c0" },
  { stage: "triage", label: "Triage & Prioritization", shortLabel: "Triage", color: "#7b1fa2" },
  { stage: "refinement", label: "Refinement", shortLabel: "Refine", color: "#388e3c" },
  { stage: "development", label: "Development", shortLabel: "Dev", color: "#f57c00" },
  { stage: "qa", label: "Quality Assurance", shortLabel: "QA", color: "#c2185b" },
  { stage: "release", label: "Release & Production", shortLabel: "Release", color: "#00897b" },
  { stage: "closed", label: "Closed", shortLabel: "Closed", color: "#616161" },
] as const;

export const PHASE_DEFINITIONS: ReadonlyArray<{
  readonly phase: CopilotPhase;
  readonly label: string;
  readonly shortLabel: string;
  readonly index: number;
}> = [
  { phase: "research", label: "Research & Discovery", shortLabel: "Rsch", index: 0 },
  { phase: "grooming", label: "Grooming & Refinement", shortLabel: "Groom", index: 1 },
  { phase: "solutioning-research", label: "Solutioning Research", shortLabel: "Solve R", index: 2 },
  { phase: "solutioning", label: "Solutioning & Design", shortLabel: "Solve", index: 3 },
  { phase: "finalization", label: "Finalization & Sizing", shortLabel: "Final", index: 4 },
] as const;
