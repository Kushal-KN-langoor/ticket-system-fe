"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { PRIORITY_COLORS, STATUS_COLORS, TicketStatus } from "@/lib/data";
import { useApp } from "@/context/AppStore";
import { useAppSelector } from "@/lib/redux/hooks";

const ALL_STATUSES: TicketStatus[] = ["Backlog", "To Do", "In Progress", "Review", "Done"];

export default function TicketPage({
  params,
}: {
  params: Promise<{ id: string; ticketId: string }>;
}) {
  const { id, ticketId } = use(params);
  const { projects, updateTicketStatus, addComment } = useApp();
  const user = useAppSelector((state) => state.auth.user); // new Redux
  const router = useRouter();

  const [comment, setComment] = useState("");
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  useEffect(() => {
    if (!user) {
      router.replace("/");
    }
  }, [user, router]);

  if (!user) {
    return null;
  }

  const project = projects.find((p) => p.id === id);
  const ticket = project?.tickets.find((t) => t.id === ticketId);

  if (!ticket) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 mb-4">Ticket not found.</p>
          <Link href={`/project/${id}`} className="text-violet-600 hover:underline text-sm">← Back to Project</Link>
        </div>
      </div>
    );
  }

  const handleSendComment = () => {
    if (!comment.trim()) return;
    addComment(id, ticketId, comment.trim());
    setComment("");
  };

  const handleSetStatus = (s: TicketStatus) => {
    updateTicketStatus(id, ticketId, s);
    setShowStatusMenu(false);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar
        showDashboardBtn
        breadcrumb={`/ ${id} / ${ticketId}`}
        showSearch={false}
      />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between mb-5">
          <Link
            href={`/project/${id}?tab=Board`}
            className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-violet-700 transition-colors font-medium"
          >
            <i className="fi fi-rr-arrow-left text-base"></i> Back to Board
          </Link>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setShowStatusMenu(!showStatusMenu)}
                className={`flex items-center gap-2 text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors ${STATUS_COLORS[ticket.status]}`}
              >
                <span className="w-2 h-2 rounded-full bg-current opacity-60" />
                {ticket.status} <i className="fi fi-rr-angle-small-down text-xs"></i>
              </button>
              {showStatusMenu && (
                <div className="absolute right-0 top-9 bg-white border border-slate-200 rounded-xl shadow-xl shadow-slate-200 py-1 z-30 w-40">
                  {ALL_STATUSES.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSetStatus(s)}
                      className={`w-full text-left text-xs px-4 py-2 hover:bg-slate-50 transition-colors ${ticket.status === s ? "font-bold text-violet-700" : "text-slate-700"}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 mb-5 flex items-center gap-3">
          <h1 className="text-lg font-bold text-slate-900 flex-1">
            {ticketId} — {ticket.title}
          </h1>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded border ${PRIORITY_COLORS[ticket.priority]}`}>
            Priority: {ticket.priority}
          </span>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
          {[
            { key: "Category", val: ticket.category },
            { key: "Priority", val: ticket.priority },
            { key: "Assignee", val: ticket.assignee },
            { key: "Created On", val: ticket.createdAt },
            { key: "Last Updated", val: ticket.updatedAt },
            { key: "Reporter", val: ticket.reporter ?? "—" },
          ].map(({ key, val }) => (
            <div key={key} className="bg-white border border-slate-100 rounded-lg px-3 py-2.5">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">{key}</div>
              <div className="text-sm text-slate-800 font-medium">{val}</div>
            </div>
          ))}
        </div>

        <div className="space-y-5">
          {/* Description */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">Description</h2>
            <p className="text-sm text-slate-600 leading-relaxed">{ticket.description}</p>
          </div>

          {/* Attachments */}
          {ticket.attachments.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                <i className="fi fi-rr-paperclip text-xs"></i> Attachments ({ticket.attachments.length})
              </h2>
              <div className="space-y-2">
                {ticket.attachments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between text-sm border border-slate-100 rounded-lg px-3 py-2 hover:bg-slate-50">
                    <span className="text-slate-700">📄 {a.name}</span>
                    <div className="flex items-center gap-2 text-slate-400">
                      <span className="text-xs">{a.size}</span>
                      <i className="fi fi-rr-download text-xs hover:text-violet-600 cursor-pointer" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comments */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">
              Comments ({ticket.comments.length})
            </h2>
            <div className="space-y-3 mb-4">
              {ticket.comments.map((c) => (
                <div key={c.id} className="border border-slate-100 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-6 h-6 bg-violet-100 rounded-full flex items-center justify-center text-xs font-bold text-violet-700">
                      {c.author[0]}
                    </div>
                    <span className="text-xs font-semibold text-slate-700">{c.author}</span>
                    <span className="text-xs text-slate-400">{c.timestamp}</span>
                  </div>
                  <p className="text-sm text-slate-600 ml-8">{c.text}</p>
                </div>
              ))}
              {ticket.comments.length === 0 && <p className="text-sm text-slate-400">No comments yet.</p>}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendComment()}
                placeholder="Write a comment..."
                className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300"
              />
              <button
                onClick={handleSendComment}
                className="bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-3 py-2 transition-colors"
              >
                <i className="fi fi-rr-paper-plane text-sm"></i>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}