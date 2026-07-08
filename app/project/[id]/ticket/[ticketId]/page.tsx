"use client";

import { useEffect, useState, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { apiClient } from "@/lib/apiClient";
import { applyStatusOverrides, setStatusOverride } from "@/lib/ticketStatusStore";
import {
  PRIORITY_COLORS,
  STATUS_COLORS,
  TicketStatus,
  Ticket,
  Comment,
  BackendTicket,
  mapBackendTicket,
} from "@/lib/data";
import { useAppSelector } from "@/lib/redux/hooks";

const ALL_STATUSES: TicketStatus[] = ["Backlog", "To Do", "In Progress", "Review", "Done"];

interface BackendComment {
  id: string;
  ticket_id: string;
  user_id: string;
  comment_text: string;
  created_at: string;
  users?: { id: string; name: string; email: string } | null;
}

function mapBackendComment(raw: BackendComment): Comment {
  return {
    id: raw.id,
    author: raw.users?.name || "User",
    text: raw.comment_text,
    timestamp: new Date(raw.created_at).toLocaleString(),
  };
}

export default function TicketPage({
  params,
}: {
  params: Promise<{ id: string; ticketId: string }>;
}) {
  const { id, ticketId } = use(params);
  const user = useAppSelector((state) => state.auth.user);
  const router = useRouter();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);

  const [comment, setComment] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [commentError, setCommentError] = useState("");

  const [showStatusMenu, setShowStatusMenu] = useState(false);

  useEffect(() => {
    if (!user) {
      router.replace("/");
    }
  }, [user, router]);

  // There's no GET /tickets/:id — only GET /tickets (all of them) — so we
  // fetch the full list and pick out the one we need, same approach as the
  // project page.
  useEffect(() => {
    if (!user) return;
    let isActive = true;

    const fetchTicket = async () => {
      setLoading(true);
      setLoadError("");
      try {
        const res = await apiClient.get("/tickets");
        const all: BackendTicket[] = res.data?.tickets || [];
        const raw = all.find((t) => t.id === ticketId && t.project_id === id);
        if (!isActive) return;
        if (!raw) {
          setLoadError("Ticket not found.");
          return;
        }
        setTicket(applyStatusOverrides([mapBackendTicket(raw)])[0]);
      } catch {
        if (isActive) setLoadError("Could not reach the server.");
      } finally {
        if (isActive) setLoading(false);
      }
    };

    void fetchTicket();
    return () => {
      isActive = false;
    };
  }, [id, ticketId, user]);

  const fetchComments = useCallback(async () => {
    setCommentsLoading(true);
    try {
      const res = await apiClient.get(`/tickets/${ticketId}/comments`);
      const raw: BackendComment[] = res.data?.comments || [];
      setComments(raw.map(mapBackendComment));
    } catch {
      // Leave whatever comments we already have (e.g. from the ticket's
      // own payload) rather than wiping the list on a transient error.
    } finally {
      setCommentsLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    if (!user) return;
    void fetchComments();
  }, [user, fetchComments]);

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-400 text-sm">Loading ticket...</p>
      </div>
    );
  }

  if (!ticket || loadError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 mb-4">{loadError || "Ticket not found."}</p>
          <Link href={`/project/${id}`} className="text-violet-600 hover:underline text-sm">← Back to Project</Link>
        </div>
      </div>
    );
  }

  const handleSendComment = async () => {
    const text = comment.trim();
    if (!text || sendingComment) return;

    setSendingComment(true);
    setCommentError("");
    try {
      await apiClient.post(`/tickets/${ticketId}/comments`, {
        comment_text: text,
      });
      setComment("");
      await fetchComments();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data
          ?.message ||
        (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data
          ?.error ||
        "Failed to post comment.";
      setCommentError(message);
    } finally {
      setSendingComment(false);
    }
  };

  // NOTE: same caveat as the board — there's no confirmed backend endpoint
  // for changing ticket status yet, so this is a best-effort PATCH guess.
  // The override cache is what actually keeps this consistent with the
  // board when you navigate back, regardless of whether the request lands.
  const handleSetStatus = (s: TicketStatus) => {
    setStatusOverride(ticketId, s);
    setTicket((prev) => (prev ? { ...prev, status: s } : prev));
    setShowStatusMenu(false);
    apiClient.patch(`/tickets/${ticketId}`, { status: s }).catch((err) => {
      console.warn("Status change may not have been saved to the server:", err);
    });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar
        showDashboardBtn
        breadcrumb={`/ ${id} / ${ticket.ticketNumber || ticketId}`}
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
            {ticket.ticketNumber || ticketId} — {ticket.title}
          </h1>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded border ${PRIORITY_COLORS[ticket.priority]}`}>
            Priority: {ticket.priority}
          </span>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
          {[
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
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comments */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">
              Comments ({comments.length})
            </h2>
            <div className="space-y-3 mb-4">
              {commentsLoading && <p className="text-sm text-slate-400">Loading comments...</p>}
              {!commentsLoading &&
                comments.map((c) => (
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
              {!commentsLoading && comments.length === 0 && (
                <p className="text-sm text-slate-400">No comments yet.</p>
              )}
            </div>
            {commentError && <p className="text-xs text-red-500 mb-2">{commentError}</p>}
            <div className="flex gap-2">
              <input
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendComment()}
                placeholder="Write a comment..."
                disabled={sendingComment}
                className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300 disabled:bg-slate-50"
              />
              <button
                onClick={handleSendComment}
                disabled={sendingComment}
                className="bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 text-white rounded-lg px-3 py-2 transition-colors"
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