"use client";

import { useState } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Ticket, TicketStatus, KANBAN_COLUMNS, PRIORITY_COLORS, STATUS_COLORS, statusColorStyle } from "@/lib/data";
import type { Status } from "@/lib/statusesApi";

interface KanbanBoardProps {
  tickets: Ticket[];
  projectId: string;
  onStatusChange: (ticketId: string, status: TicketStatus) => void;
  /**
   * Which statuses to render as columns, in order. Defaults to KANBAN_COLUMNS
   * from lib/data.ts, but callers can override this (e.g. per-project custom
   * workflows) without touching this component.
   */
  columns?: TicketStatus[];
  /**
   * Real status records from GET /api/statuses (id, name, color). When
   * provided, column headers and the "Move to" dropdown badges use each
   * status's actual backend color instead of the hardcoded STATUS_COLORS
   * fallback. Optional so the board still renders sensibly without it.
   */
  statuses?: Status[];
}

const PRIORITY_SHORT: Record<string, string> = {
  High: "H",
  Medium: "M",
  Low: "L",
};

// Looks up the backend color for a status name. Falls back to the static
// Tailwind classes in STATUS_COLORS (and then a neutral slate style) for
// statuses that aren't in the fetched list yet — e.g. before /api/statuses
// has loaded, or if it fails.
function statusBadge(status: TicketStatus, statuses: Status[] | undefined) {
  const match = statuses?.find((s) => s.name === status);
  if (match) {
    return { className: "border", style: statusColorStyle(match.color) };
  }
  return { className: STATUS_COLORS[status] ?? "bg-slate-100 text-slate-600", style: undefined };
}

// ── Draggable ticket card ──────────────────────────────────────────────
function TicketCard({
  ticket,
  projectId,
  onStatusChange,
  columns,
  isDragOverlay = false,
}: {
  ticket: Ticket;
  projectId: string;
  onStatusChange: (ticketId: string, status: TicketStatus) => void;
  columns: TicketStatus[];
  isDragOverlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: ticket.id,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`bg-white border border-slate-200 rounded-lg p-2.5 shadow-sm hover:shadow-md hover:border-violet-200 transition-shadow cursor-grab active:cursor-grabbing touch-none ${
        isDragging ? "opacity-30" : ""
      } ${isDragOverlay ? "shadow-xl scale-105 rotate-1 ring-2 ring-violet-300" : ""}`}
    >
      <div className="flex items-start justify-between gap-1 mb-1.5">
        <Link
          href={`/project/${projectId}/ticket/${ticket.id}`}
          onPointerDown={(e) => e.stopPropagation()}
          className="text-[10px] font-bold text-slate-400 hover:text-violet-600 transition-colors font-mono leading-tight"
        >
          {ticket.ticketNumber || ticket.id}
        </Link>

        {/* Mobile: show H / M / L */}
        <span className={`sm:hidden text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border shrink-0 ${PRIORITY_COLORS[ticket.priority]}`}>
          {PRIORITY_SHORT[ticket.priority] ?? ticket.priority[0]}
        </span>

        {/* Desktop: show full label */}
        <span className={`hidden sm:inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded border whitespace-nowrap shrink-0 ${PRIORITY_COLORS[ticket.priority]}`}>
          {ticket.priority}
        </span>
      </div>

      <Link
        href={`/project/${projectId}/ticket/${ticket.id}`}
        onPointerDown={(e) => e.stopPropagation()}
        className="text-[11px] font-medium text-slate-800 hover:text-violet-700 transition-colors line-clamp-2 block leading-snug"
      >
        {ticket.title}
      </Link>
      {ticket.assignee !== "Unassigned" && (
        <div className="flex items-center gap-1 mt-2">
          <div className="w-4 h-4 bg-violet-100 rounded-full flex items-center justify-center text-[9px] font-bold text-violet-700 shrink-0">
            {ticket.assignee[0]}
          </div>
          <span className="text-[10px] text-slate-400 truncate">{ticket.assignee}</span>
        </div>
      )}

      {/* Explicit "move to" control — works even if drag-and-drop doesn't
          (e.g. on touch devices, or browsers that block native HTML5 DnD) */}
      <select
        value={ticket.status}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onStatusChange(ticket.id, e.target.value as TicketStatus)}
        className="mt-2 w-full text-[10px] border border-slate-200 rounded px-1.5 py-1 bg-slate-50 text-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-300"
      >
        {columns.map((col) => (
          <option key={col} value={col}>
            Move to: {col}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── Droppable column ────────────────────────────────────────────────────
function KanbanColumn({
  status,
  ticketsInColumn,
  projectId,
  onStatusChange,
  columns,
  statuses,
}: {
  status: TicketStatus;
  ticketsInColumn: Ticket[];
  projectId: string;
  onStatusChange: (ticketId: string, status: TicketStatus) => void;
  columns: TicketStatus[];
  statuses: Status[] | undefined;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const badge = statusBadge(status, statuses);

  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl transition-colors duration-150 ${
        isOver ? "bg-violet-50 ring-2 ring-violet-300" : "bg-slate-100"
      }`}
    >
      <div className="flex items-center gap-1.5 px-3 py-2.5">
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${badge.className}`}
          style={badge.style}
        >
          {status}
        </span>
        <span className="text-xs text-slate-400 font-medium shrink-0">
          ({ticketsInColumn.length})
        </span>
      </div>

      <div className="px-2 pb-2 space-y-2 min-h-24">
        {ticketsInColumn.map((ticket) => (
          <TicketCard
            key={ticket.id}
            ticket={ticket}
            projectId={projectId}
            onStatusChange={onStatusChange}
            columns={columns}
          />
        ))}
        {ticketsInColumn.length === 0 && (
          <div
            className={`text-xs text-center py-4 rounded-lg border-2 border-dashed transition-colors ${
              isOver ? "border-violet-300 text-violet-400" : "border-transparent text-slate-300"
            }`}
          >
            Drop tickets here
          </div>
        )}
      </div>
    </div>
  );
}

export default function KanbanBoard({ tickets, projectId, onStatusChange, columns = KANBAN_COLUMNS, statuses }: KanbanBoardProps) {
  const [filter, setFilter] = useState({ assignee: "", priority: "" });
  const [activeId, setActiveId] = useState<string | null>(null);

  // Small activation distance so clicks on the card's links/select still
  // work normally, but any real drag gesture kicks in smoothly and
  // immediately — no native HTML5 DnD ghost image / jank.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
  );

  // Use a stable key per assignee (their id when we have one, otherwise the
  // name) so two different tickets assigned to the same person always match,
  // and so the dropdown works even for "Unassigned" tickets.
  const assigneeKey = (t: Ticket) => t.assignedToId || t.assignee;

  const filtered = tickets.filter((t) => {
    if (filter.priority && t.priority !== filter.priority) return false;
    if (filter.assignee && assigneeKey(t) !== filter.assignee) return false;
    return true;
  });

  const byStatus = (status: TicketStatus) => filtered.filter((t) => t.status === status);

  // De-duplicated list of { key, label } assignee options, built from the
  // full ticket list (not the already-filtered one) so the dropdown always
  // shows every possible choice.
  const assignees = Array.from(
    new Map(tickets.map((t) => [assigneeKey(t), t.assignee])).entries()
  ).map(([key, label]) => ({ key, label }));

  const activeTicket = activeId ? tickets.find((t) => t.id === activeId) ?? null : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;
    const newStatus = over.id as TicketStatus;
    const ticket = tickets.find((t) => t.id === active.id);
    if (ticket && ticket.status !== newStatus) {
      onStatusChange(String(active.id), newStatus);
    }
  };

  return (
    <div className="w-full">

      {/* ── Filters: single scrollable row on mobile, wrap on sm+ ── */}
      <div
        className="flex gap-2 mb-5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0"
        style={{ scrollbarWidth: "none" } as React.CSSProperties}
      >
        <select
          value={filter.assignee}
          onChange={(e) => setFilter({ ...filter, assignee: e.target.value })}
          className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-300 shrink-0 min-w-max"
        >
          <option value="">All Assignees</option>
          {assignees.map((a) => (
            <option key={a.key} value={a.key}>{a.label}</option>
          ))}
        </select>

        <select
          value={filter.priority}
          onChange={(e) => setFilter({ ...filter, priority: e.target.value })}
          className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-300 shrink-0 min-w-max"
        >
          <option value="">All Priorities</option>
          <option>High</option>
          <option>Medium</option>
          <option>Low</option>
        </select>

        {(filter.priority || filter.assignee) && (
          <button
            onClick={() => setFilter({ assignee: "", priority: "" })}
            className="text-xs text-red-500 hover:text-red-700 px-2 shrink-0 min-w-max"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ── Kanban Grid ── */}
      {/* Always scrolls horizontally. Column count/order comes from the
          `columns` prop (defaults to KANBAN_COLUMNS) instead of being
          hardcoded here, so it can be reused for a custom workflow. */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="w-full overflow-x-auto pb-4">
          <div
            className="grid gap-3"
            style={{
              gridTemplateColumns: `repeat(${columns.length}, minmax(150px, 1fr))`,
              minWidth: `${columns.length * 150}px`,
            }}
          >
            {columns.map((col) => (
              <KanbanColumn
                key={col}
                status={col}
                ticketsInColumn={byStatus(col)}
                projectId={projectId}
                onStatusChange={onStatusChange}
                columns={columns}
                statuses={statuses}
              />
            ))}
          </div>
        </div>

        <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)" }}>
          {activeTicket ? (
            <TicketCard
              ticket={activeTicket}
              projectId={projectId}
              onStatusChange={onStatusChange}
              columns={columns}
              isDragOverlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>

    </div>
  );
}