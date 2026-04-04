import { create } from "zustand";
import type { TicketListItem, TicketState, TicketStage } from "@t3tools/contracts";

export interface TicketStore {
  tickets: TicketListItem[];
  activeTicketId: string | null;
  ticketStates: Record<string, TicketState>;
  loading: boolean;
  error: string | null;

  // Actions
  setTickets: (tickets: TicketListItem[]) => void;
  setActiveTicket: (ticketId: string | null) => void;
  setTicketState: (ticketId: string, state: TicketState) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  addTicket: (ticket: TicketListItem) => void;
}

export const useTicketStore = create<TicketStore>((set) => ({
  tickets: [],
  activeTicketId: null,
  ticketStates: {},
  loading: false,
  error: null,

  setTickets: (tickets) => set({ tickets }),
  setActiveTicket: (activeTicketId) => set({ activeTicketId }),
  setTicketState: (ticketId, state) =>
    set((prev) => ({
      ticketStates: { ...prev.ticketStates, [ticketId]: state },
    })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  addTicket: (ticket) =>
    set((prev) => ({
      tickets: [...prev.tickets.filter((t) => t.ticketId !== ticket.ticketId), ticket],
    })),
}));

/** Group tickets by their current stage for sidebar display. */
export function groupTicketsByStage(
  tickets: readonly TicketListItem[],
): Record<TicketStage, TicketListItem[]> {
  const groups: Record<string, TicketListItem[]> = {
    "copilot-refinement": [],
    "triage": [],
    "refinement": [],
    "development": [],
    "qa": [],
    "release": [],
    "closed": [],
  };

  for (const ticket of tickets) {
    const stage = ticket.currentStage ?? "copilot-refinement";
    const bucket = groups[stage];
    if (bucket) {
      bucket.push(ticket);
    } else {
      groups["copilot-refinement"]!.push(ticket);
    }
  }

  return groups as Record<TicketStage, TicketListItem[]>;
}
