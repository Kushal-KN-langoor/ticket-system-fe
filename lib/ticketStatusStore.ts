

import { TicketStatus } from "./data";

const overrides = new Map<string, TicketStatus>();

export function getStatusOverride(ticketId: string): TicketStatus | undefined {
  return overrides.get(ticketId);
}

export function setStatusOverride(ticketId: string, status: TicketStatus): void {
  overrides.set(ticketId, status);
}

export function applyStatusOverrides<T extends { id: string; status: TicketStatus }>(
  tickets: T[]
): T[] {
  if (overrides.size === 0) return tickets;
  return tickets.map((t) => {
    const override = overrides.get(t.id);
    return override && override !== t.status ? { ...t, status: override } : t;
  });
}