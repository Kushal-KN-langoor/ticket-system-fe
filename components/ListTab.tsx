"use client";

import { useState } from "react";
import Link from "next/link";
import { Ticket } from "@/lib/data";

interface ListTabProps {
  tickets: Ticket[];
  projectId: string;
}

export default function ListTab({ tickets, projectId }: ListTabProps) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("id");
  const PER_PAGE = 10;

  const filtered = tickets
    .filter(
      (t) =>
        t.id.toLowerCase().includes(query.toLowerCase()) ||
        t.title.toLowerCase().includes(query.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === "id") return a.id.localeCompare(b.id);
      if (sortBy === "priority")
        return (
          ["High", "Medium", "Low"].indexOf(a.priority) -
          ["High", "Medium", "Low"].indexOf(b.priority)
        );
      return a.title.localeCompare(b.title);
    });

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <i className="fi fi-rr-search text-sm"></i> 
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            placeholder="Search by ID or title..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white"
          />
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-1 border border-slate-200 rounded-lg px-3 py-2 bg-white text-xs text-slate-600 cursor-pointer hover:border-violet-300">
            <i className="fi fi-rr-arrow-up-down text-sm"></i>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-xs bg-transparent outline-none cursor-pointer"
            >
              <option value="id">Sort by ID</option>
              <option value="title">Sort by Title</option>
              <option value="priority">Sort by Priority</option>
            </select>
          </div>
          <Link
            href={`/create-ticket?project=${projectId}`}
            className="flex items-center gap-1 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
          >
            <i className="fi fi-rr-plus text-sm"></i> New Ticket
          </Link>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[400px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 w-32">
                  Ticket ID
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">
                  Report
                </th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-10 text-center text-sm text-slate-400">
                    No tickets found.
                  </td>
                </tr>
              )}
              {paged.map((ticket, i) => (
                <tr
                  key={ticket.id}
                  className={`border-b border-slate-100 hover:bg-violet-50/50 transition-colors ${i % 2 === 0 ? "" : "bg-slate-50/50"}`}
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/project/${projectId}/ticket/${ticket.id}`}
                      className="text-sm font-bold text-violet-600 hover:text-violet-800 transition-colors font-mono"
                    >
                      {ticket.id}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/project/${projectId}/ticket/${ticket.id}`}
                      className="text-sm text-slate-800 hover:text-violet-700 transition-colors"
                    >
                      {ticket.title}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col xs:flex-row items-center justify-between mt-4 gap-2">
          <p className="text-xs text-slate-500">
            Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length}
          </p>
          <div className="flex items-center gap-1 flex-wrap justify-center">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <i className="fi fi-rr-angle-small-left text-sm"></i>
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => setPage(n)}
                className={`w-7 h-7 text-xs rounded-lg border transition-colors ${
                  page === n
                    ? "bg-violet-600 text-white border-violet-600"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {n}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <i className="fi fi-rr-angle-small-right text-sm"></i>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}