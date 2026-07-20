import { TicketStatus } from "./data";

const STORAGE_KEY = "ticket-status-overrides";

function loadOverrides(): Map<string, TicketStatus> {
  if (typeof window === "undefined") return new Map();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw) as Record<string, TicketStatus>;
    return new Map(Object.entries(parsed));
  } catch {
    return new Map();
  }
}

function saveOverrides(overrides: Map<string, TicketStatus>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(Object.fromEntries(overrides))
    );
  } catch {
    // ignore write errors (e.g. storage disabled/full)
  }
}

const overrides = loadOverrides();

export function getStatusOverride(ticketId: string): TicketStatus | undefined {
  return overrides.get(ticketId);
}

export function setStatusOverride(ticketId: string, status: TicketStatus): void {
  overrides.set(ticketId, status);
  saveOverrides(overrides);
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