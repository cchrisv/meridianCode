import { Effect, ServiceMap } from "effect";
import type {
  TicketGetContextResult,
  TicketGetStateResult,
  TicketImportResult,
  TicketListItem,
  TicketStage,
  TicketStageTransitionResult,
} from "@t3tools/contracts";

export interface TicketServiceShape {
  readonly importTicket: (workItemId: string) => Effect.Effect<TicketImportResult, Error>;
  readonly listTickets: () => Effect.Effect<readonly TicketListItem[], Error>;
  readonly getTicketState: (workItemId: string) => Effect.Effect<TicketGetStateResult, Error>;
  readonly getTicketContext: (workItemId: string) => Effect.Effect<TicketGetContextResult, Error>;
  readonly transitionStage: (
    workItemId: string,
    targetStage: TicketStage,
  ) => Effect.Effect<TicketStageTransitionResult, Error>;
}

export class TicketService extends ServiceMap.Service<TicketService, TicketServiceShape>()(
  "TicketService",
) {}
