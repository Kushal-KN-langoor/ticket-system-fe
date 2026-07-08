"use client";

import { useState } from "react";
import Link from "next/link";
import { Ticket, TicketStatus, KANBAN_COLUMNS, PRIORITY_COLORS, STATUS_COLORS } from "@/lib/data";

interface KanbanBoardProps {
  tickets: Ticket[];
  projectId: string;
  onStatusChange: (ticketId: string, status: TicketStatus) => void;
}

const PRIORITY_SHORT: Record<string, string> = {
  High: "H",
  Medium: "M",
  Low: "L",
};

export default function KanbanBoard({ tickets, projectId, onStatusChange }: KanbanBoardProps) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<TicketStatus | null>(null);
  const [filter, setFilter] = useState({ category: "", assignee: "", priority: "" });

  const filtered = tickets.filter((t) => {
    if (filter.category && t.category !== filter.category) return false;
    if (filter.priority && t.priority !== filter.priority) return false;
    if (filter.assignee && t.assignee !== filter.assignee) return false;
    return true;
  });

  const byStatus = (status: TicketStatus) => filtered.filter((t) => t.status === status);
  const categories = [...new Set(tickets.map((t) => t.category))];
  const assignees = [...new Set(tickets.map((t) => t.assignee).filter((a) => a !== "Unassigned"))];

  const handleDragStart = (id: string) => setDragging(id);
  const handleDragEnd = () => { setDragging(null); setOverCol(null); };
  const handleDrop = (status: TicketStatus) => {
    if (!dragging) return;
    onStatusChange(dragging, status);
    setDragging(null);
    setOverCol(null);
  };

  const TicketCard = ({ ticket }: { ticket: Ticket }) => (
    <div
      draggable
      onDragStart={() => handleDragStart(ticket.id)}
      onDragEnd={handleDragEnd}
      className={`bg-white border border-slate-200 rounded-lg p-2.5 shadow-sm hover:shadow-md hover:border-violet-200 transition-all cursor-grab active:cursor-grabbing ${dragging === ticket.id ? "opacity-40" : ""}`}
    >
      <div className="flex items-start justify-between gap-1 mb-1.5">
        <Link
          href={`/project/${projectId}/ticket/${ticket.id}`}
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
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onStatusChange(ticket.id, e.target.value as TicketStatus)}
        className="mt-2 w-full text-[10px] border border-slate-200 rounded px-1.5 py-1 bg-slate-50 text-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-300"
      >
        {KANBAN_COLUMNS.map((col) => (
          <option key={col} value={col}>
            Move to: {col}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="w-full">

      {/* ── Filters: single scrollable row on mobile, wrap on sm+ ── */}
      <div
        className="flex gap-2 mb-5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0"
        style={{ scrollbarWidth: "none" } as React.CSSProperties}
      >
        <select
          value={filter.category}
          onChange={(e) => setFilter({ ...filter, category: e.target.value })}
          className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-300 shrink-0 min-w-max"
        >
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>

        <select
          value={filter.assignee}
          onChange={(e) => setFilter({ ...filter, assignee: e.target.value })}
          className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-300 shrink-0 min-w-max"
        >
          <option value="">All Assignees</option>
          {assignees.map((a) => <option key={a}>{a}</option>)}
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

        {(filter.category || filter.priority || filter.assignee) && (
          <button
            onClick={() => setFilter({ category: "", assignee: "", priority: "" })}
            className="text-xs text-red-500 hover:text-red-700 px-2 shrink-0 min-w-max"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ── Kanban Grid ── */}
      {/* Always scrolls horizontally. Each column min 150px on mobile, 180px on sm+ */}
      <div className="w-full overflow-x-auto pb-4">
        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns: `repeat(${KANBAN_COLUMNS.length}, minmax(150px, 1fr))`,
            minWidth: `${KANBAN_COLUMNS.length * 150}px`,
          }}
        >
          {KANBAN_COLUMNS.map((col) => {
            const colTickets = byStatus(col);
            const isOver = overCol === col;
            return (
              <div
                key={col}
                className={`rounded-xl transition-colors ${isOver ? "bg-violet-50 ring-2 ring-violet-300" : "bg-slate-100"}`}
                onDragOver={(e) => { e.preventDefault(); setOverCol(col); }}
                onDrop={() => handleDrop(col)}
                onDragLeave={() => setOverCol(null)}
              >
                <div className="flex items-center gap-1.5 px-3 py-2.5">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_COLORS[col]}`}>
                    {col}
                  </span>
                  <span className="text-xs text-slate-400 font-medium shrink-0">
                    ({colTickets.length})
                  </span>
                </div>

                <div className="px-2 pb-2 space-y-2 min-h-24">
                  {colTickets.map((ticket) => (
                    <TicketCard key={ticket.id} ticket={ticket} />
                  ))}
                  {colTickets.length === 0 && (
                    <div className="text-xs text-slate-300 text-center py-4">
                      Drop tickets here
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}