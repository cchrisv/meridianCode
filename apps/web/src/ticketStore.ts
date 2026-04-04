import { create } from "zustand";
import { STAGE_DEFINITIONS, type TicketListItem, type TicketState, type TicketStage } from "@t3tools/contracts";

export interface TicketStore {
  tickets: TicketListItem[];
  activeWorkItemId: string | null;
  ticketStates: Record<string, TicketState>;
  loading: boolean;
  error: string | null;

  // Actions
  setTickets: (tickets: TicketListItem[]) => void;
  setActiveWorkItem: (workItemId: string | null) => void;
  setTicketState: (workItemId: string, state: TicketState) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  addTicket: (ticket: TicketListItem) => void;
}

export const useTicketStore = create<TicketStore>((set) => ({
  tickets: [],
  activeWorkItemId: null,
  ticketStates: {},
  loading: false,
  error: null,

  setTickets: (tickets) => set({ tickets }),
  setActiveWorkItem: (activeWorkItemId) => set({ activeWorkItemId }),
  setTicketState: (workItemId, state) =>
    set((prev) => ({
      ticketStates: { ...prev.ticketStates, [workItemId]: state },
    })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  addTicket: (ticket) =>
    set((prev) => ({
      tickets: [...prev.tickets.filter((t) => t.workItemId !== ticket.workItemId), ticket],
    })),
}));

/** Group tickets by their current stage for sidebar display. */
export function groupTicketsByStage(
  tickets: readonly TicketListItem[],
): Record<TicketStage, TicketListItem[]> {
  const groups = STAGE_DEFINITIONS.reduce(
    (acc, { stage }) => {
      acc[stage] = [];
      return acc;
    },
    {} as Record<TicketStage, TicketListItem[]>,
  ) satisfies Record<TicketStage, TicketListItem[]>;

  for (const ticket of tickets) {
    const stage = ticket.currentStage ?? "copilot-refinement";
    const bucket = groups[stage];
    if (bucket) {
      bucket.push(ticket);
    } else {
      groups["copilot-refinement"]!.push(ticket);
    }
  }

  return groups;
}
