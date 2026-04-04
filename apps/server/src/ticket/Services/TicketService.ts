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
  readonly getTicketState: (ticketId: string) => Effect.Effect<TicketGetStateResult, Error>;
  readonly getTicketContext: (ticketId: string) => Effect.Effect<TicketGetContextResult, Error>;
  readonly transitionStage: (
    ticketId: string,
    targetStage: TicketStage,
  ) => Effect.Effect<TicketStageTransitionResult, Error>;
}

export class TicketService extends ServiceMap.Service<TicketService, TicketServiceShape>()(
  "TicketService",
) {}
