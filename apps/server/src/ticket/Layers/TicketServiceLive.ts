import { Effect, Layer } from "effect";
import {
  boardColumnToStage,
  type TicketGetContextResult,
  type TicketGetStateResult,
  type TicketImportResult,
  type TicketListItem,
  type TicketStageTransitionResult,
  type TicketState,
  type TicketStage,
} from "@t3tools/contracts";
import { spawnCli } from "../../provider/Layers/cliSpawner";
import { TicketArtifactStore } from "./TicketArtifactStore";
import { TicketService } from "../Services/TicketService";

const store = new TicketArtifactStore();

function makeTicketId(workItemId: string): string {
  return `ticket-${workItemId}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

const importTicket = (workItemId: string): Effect.Effect<TicketImportResult, Error> =>
  Effect.gen(function* () {
    // 1. Fetch the work item from ADO
    const adoResult = yield* Effect.tryPromise({
      try: () => spawnCli("ado-tools", ["get", workItemId, "-e", "All"]),
      catch: (e) => new Error(`Failed to fetch ADO work item ${workItemId}: ${e}`),
    });

    if (adoResult.exitCode !== 0) {
      return yield* Effect.fail(
        new Error(`ado-tools get failed (exit ${adoResult.exitCode}): ${adoResult.stderr}`),
      );
    }

    // 2. Initialize workflow artifacts
    const workflowResult = yield* Effect.tryPromise({
      try: () => spawnCli("workflow-tools", ["prepare", "-w", workItemId]),
      catch: (e) => new Error(`Failed to prepare workflow for ${workItemId}: ${e}`),
    });

    if (workflowResult.exitCode !== 0) {
      return yield* Effect.fail(
        new Error(
          `workflow-tools prepare failed (exit ${workflowResult.exitCode}): ${workflowResult.stderr}`,
        ),
      );
    }

    // 3. Read the created context to extract metadata
    const context = store.readContext(workItemId) as Record<string, unknown> | null;
    const adoData = adoResult.json as Record<string, unknown> | null;

    const ticketId = makeTicketId(workItemId);
    const title =
      (adoData?.title as string) ??
      (context?.metadata as Record<string, unknown>)?.title as string ??
      `Work Item ${workItemId}`;
    const boardColumn = (adoData?.boardColumn as string) ?? null;
    const currentStage = boardColumnToStage(boardColumn);
    const now = nowIso();

    // Thread ID will be assigned by the orchestration engine when the thread is created.
    // For now, generate a placeholder that the UI will use to create the thread.
    const threadId = `thread-ticket-${workItemId}` as any;

    const state: TicketState = {
      ticketId: ticketId as any,
      metadata: {
        workItemId: workItemId as any,
        title: title as any,
        workItemType: adoData?.workItemType as string | undefined,
        platform: (context?.metadata as Record<string, unknown>)?.platform as string | undefined,
        priority: adoData?.priority as string | undefined,
        storyPoints: adoData?.storyPoints as number | undefined,
        areaPath: adoData?.areaPath as string | undefined,
        iterationPath: adoData?.iterationPath as string | undefined,
        boardColumn: boardColumn as string | undefined,
        assignedTo: adoData?.assignedTo as string | undefined,
      },
      currentStage,
      copilotPhase: currentStage === "copilot-refinement" ? "research" as any : undefined,
      phasesCompleted: [],
      contextPath: store.getContextPath(workItemId),
      threadId,
      createdAt: now as any,
      updatedAt: now as any,
    };

    return {
      ticketId: ticketId as any,
      threadId,
      state,
    };
  });

const listTickets = (): Effect.Effect<readonly TicketListItem[], Error> =>
  Effect.try({
    try: () => {
      const workItemIds = store.listWorkItemIds();
      const now = nowIso();

      return workItemIds.map((workItemId): TicketListItem => {
        const context = store.readContext(workItemId) as Record<string, unknown> | null;
        const meta = context ? store.extractMetadataFromContext(workItemId, context) : null;
        const ticketId = makeTicketId(workItemId);

        return {
          ticketId: ticketId as any,
          workItemId: workItemId as any,
          title: (meta?.title ?? `Work Item ${workItemId}`) as any,
          workItemType: meta?.workItemType,
          currentStage: "copilot-refinement" as TicketStage,
          copilotPhase: meta?.currentPhase as any,
          platform: meta?.platform,
          priority: undefined,
          assignedTo: undefined,
          threadId: undefined,
          updatedAt: now as any,
        };
      });
    },
    catch: (e) => new Error(`Failed to list tickets: ${e}`),
  });

const getTicketState = (ticketId: string): Effect.Effect<TicketGetStateResult, Error> =>
  Effect.try({
    try: () => {
      const workItemId = ticketId.replace("ticket-", "");
      const context = store.readContext(workItemId) as Record<string, unknown> | null;

      if (!context) {
        throw new Error(`No ticket context found for ${ticketId}`);
      }

      const meta = store.extractMetadataFromContext(workItemId, context);
      const now = nowIso();

      const state: TicketState = {
        ticketId: ticketId as any,
        metadata: {
          workItemId: workItemId as any,
          title: meta.title as any,
          workItemType: meta.workItemType,
          platform: meta.platform,
        },
        currentStage: "copilot-refinement",
        copilotPhase: meta.currentPhase as any,
        phasesCompleted: (meta.phasesCompleted ?? []) as any,
        contextPath: store.getContextPath(workItemId),
        createdAt: now as any,
        updatedAt: now as any,
      };

      return { state };
    },
    catch: (e) => new Error(`Failed to get ticket state: ${e}`),
  });

const getTicketContext = (ticketId: string): Effect.Effect<TicketGetContextResult, Error> =>
  Effect.try({
    try: () => {
      const workItemId = ticketId.replace("ticket-", "");
      const context = store.readContext(workItemId);

      if (context == null) {
        throw new Error(`No ticket context found for ${ticketId}`);
      }

      return { context };
    },
    catch: (e) => new Error(`Failed to get ticket context: ${e}`),
  });

const transitionStage = (
  ticketId: string,
  targetStage: TicketStage,
): Effect.Effect<TicketStageTransitionResult, Error> =>
  Effect.try({
    try: () => {
      const workItemId = ticketId.replace("ticket-", "");
      const context = store.readContext(workItemId) as Record<string, unknown> | null;

      if (!context) {
        throw new Error(`No ticket context found for ${ticketId}`);
      }

      const metadata = (context.metadata ?? {}) as Record<string, unknown>;
      const previousStage = boardColumnToStage(metadata.board_column as string | undefined);

      // Update the metadata with the new stage info
      metadata.current_stage = targetStage;
      context.metadata = metadata;
      store.writeContext(workItemId, context);

      return {
        ticketId: ticketId as any,
        previousStage,
        currentStage: targetStage as TicketStage,
      };
    },
    catch: (e) => new Error(`Failed to transition stage: ${e}`),
  });

export const TicketServiceLive = Layer.succeed(TicketService, TicketService.of({
  importTicket,
  listTickets,
  getTicketState,
  getTicketContext,
  transitionStage,
}));
