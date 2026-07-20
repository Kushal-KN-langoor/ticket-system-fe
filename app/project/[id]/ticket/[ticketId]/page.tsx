"use client";

import { useEffect, useState, use, useCallback, useMemo, useRef, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { apiClient } from "@/lib/apiClient";
import { applyStatusOverrides, setStatusOverride } from "@/lib/ticketStatusStore";
import {
  PRIORITY_COLORS,
  STATUS_COLORS,
  KANBAN_COLUMNS,
  statusColorStyle,
  TicketStatus,
  Ticket,
  Comment,
  Attachment,
  BackendTicket,
  mapBackendTicket,
} from "@/lib/data";
import { Status, fetchStatuses } from "@/lib/statusesApi";
import { useAppSelector } from "@/lib/redux/hooks";

interface ProjectMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

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

interface BackendAttachment {
  id?: string;
  _id?: string;
  attachment_id?: string;
  ticket_id?: string | null;
  ticketId?: string | null;
  ticket?: { id?: string } | null;
  comment_id?: string | null;
  commentId?: string | null;
  comment?: { id?: string } | null;
  file_name?: string;
  filename?: string;
  fileName?: string;
  file_path?: string;
  original_name?: string;
  originalName?: string;
  name?: string;
  file_size?: number;
  fileSize?: number;
  size?: number;
  mimetype?: string;
  created_at?: string;
  createdAt?: string;
  users?: { id: string; name: string; email: string } | null;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let val = bytes;
  let i = 0;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(val < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

function basename(path?: string): string | undefined {
  if (!path) return undefined;
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || undefined;
}

function mapBackendAttachment(raw: BackendAttachment): Attachment {
  const commentId = raw.comment_id ?? raw.commentId ?? raw.comment?.id ?? null;
  return {
    id: raw.id || raw._id || raw.attachment_id || "",
    name:
      raw.file_name ||
      raw.filename ||
      raw.fileName ||
      raw.original_name ||
      raw.originalName ||
      raw.name ||
      basename(raw.file_path) ||
      "Untitled file",
    size: formatBytes(raw.file_size ?? raw.fileSize ?? raw.size),
    commentId,
  };
}

function extractAttachmentArray(payload: unknown): BackendAttachment[] {
  if (Array.isArray(payload)) return payload as BackendAttachment[];
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.attachments)) return obj.attachments as BackendAttachment[];
    if (Array.isArray(obj.data)) return obj.data as BackendAttachment[];
    if (obj.data && typeof obj.data === "object") {
      const inner = obj.data as Record<string, unknown>;
      if (Array.isArray(inner.attachments)) return inner.attachments as BackendAttachment[];
    }
  }
  return [];
}

function extractErrorMessage(err: unknown, fallback: string) {
  return (
    (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data
      ?.message ||
    (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data
      ?.error ||
    fallback
  );
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
  const [statuses, setStatuses] = useState<Status[]>([]);

  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [showAssigneeMenu, setShowAssigneeMenu] = useState(false);

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(true);
  const [attachError, setAttachError] = useState("");
  const [attachSuccess, setAttachSuccess] = useState("");

  const [draftFiles, setDraftFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) {
      router.replace("/");
    }
  }, [user, router]);

  // Statuses are PER-PROJECT — see lib/statusesApi.ts (GET /api/statuses/:projectId
  // returns the full list for this project in one call). Falls back to the
  // static KANBAN_COLUMNS default list further down if this fails or hasn't
  // loaded yet.
  useEffect(() => {
    if (!user) return;
    fetchStatuses(id)
      .then(setStatuses)
      .catch((err) => console.warn("Could not load statuses:", err));
  }, [user, id]);

  // Project members, used to populate the "Assignee" dropdown — same
  // /project/:id/members route the create-ticket page already uses.
  useEffect(() => {
    if (!user) return;
    apiClient
      .get(`/project/${id}/members`)
      .then((res) => setMembers(res.data?.members || []))
      .catch((err) => console.warn("Could not load project members:", err));
  }, [user, id]);

  const allStatuses: TicketStatus[] = statuses.length > 0 ? statuses.map((s) => s.name) : KANBAN_COLUMNS;

  const statusBadgeStyle = (status: TicketStatus) => {
    const match = statuses.find((s) => s.name === status);
    if (match) return { className: "border", style: statusColorStyle(match.color) };
    return { className: STATUS_COLORS[status] ?? "bg-slate-100 text-slate-600", style: undefined as CSSProperties | undefined };
  };

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

        // `statuses` is the full per-project list from fetchStatuses(id) above,
        // so no per-id resolution is needed here anymore.
        setTicket(applyStatusOverrides([mapBackendTicket(raw, statuses)])[0]);
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
    // Re-run when `statuses` finishes loading too, so the ticket gets
    // remapped correctly once the project's status list is available.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, ticketId, user, statuses]);

  const fetchComments = useCallback(async (): Promise<string[]> => {
    setCommentsLoading(true);
    try {
      const res = await apiClient.get(`/tickets/${ticketId}/comments`);
      const raw: BackendComment[] = res.data?.comments || [];
      const mapped = raw.map(mapBackendComment);
      setComments(mapped);
      return mapped.map((c) => c.id);
    } catch {
      return [];
    } finally {
      setCommentsLoading(false);
    }
  }, [ticketId]);

  const fetchAttachments = useCallback(
    async (commentIds: string[] = []) => {
      setAttachmentsLoading(true);
      setAttachError("");
      try {
        const ticketRes = await apiClient.get(`/attachments/ticket/${ticketId}`);
        // eslint-disable-next-line no-console
        console.log("raw ticket attachments response:", ticketRes.data);
        const ticketRaw = extractAttachmentArray(ticketRes.data);

        let commentRaw: BackendAttachment[] = [];
        if (commentIds.length > 0) {
          const commentResults = await Promise.allSettled(
            commentIds.map((cid) => apiClient.get(`/attachments/comment/${cid}`))
          );
          commentResults.forEach((r) => {
            if (r.status === "fulfilled") {
              // eslint-disable-next-line no-console
              console.log("raw comment attachments response:", r.value.data);
              commentRaw = commentRaw.concat(extractAttachmentArray(r.value.data));
            } else {
              // eslint-disable-next-line no-console
              console.log("comment attachments fetch failed:", r.reason);
            }
          });
        }

        const merged = [...ticketRaw, ...commentRaw];
        setAttachments(merged.map(mapBackendAttachment));
      } catch (err) {
        // eslint-disable-next-line no-console
        console.log("attachments fetch failed:", err);
        setAttachError("Could not refresh attachments list.");
      } finally {
        setAttachmentsLoading(false);
      }
    },
    [ticketId]
  );

  useEffect(() => {
    if (!user) return;
    (async () => {
      const commentIds = await fetchComments();
      await fetchAttachments(commentIds);
    })();
  }, [user, fetchComments, fetchAttachments]);

  const ticketLevelAttachments = useMemo(
    () => attachments.filter((a) => !a.commentId),
    [attachments]
  );

  const attachmentsByComment = useMemo(() => {
    const map: Record<string, Attachment[]> = {};
    for (const a of attachments) {
      if (!a.commentId) continue;
      if (!map[a.commentId]) map[a.commentId] = [];
      map[a.commentId].push(a);
    }
    return map;
  }, [attachments]);

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
    if (!text && draftFiles.length === 0) return;
    if (sendingComment || uploading) return;

    setSendingComment(true);
    setCommentError("");
    setAttachError("");
    setAttachSuccess("");
    try {
      const res = await apiClient.post(`/tickets/${ticketId}/comments`, {
        comment_text: text || "📎 Sent an attachment",
      });

      const created = res.data?.comment || res.data?.data || res.data;
      const newCommentId: string | undefined = created?.id;

      setComment("");

      if (draftFiles.length > 0) {
        if (newCommentId) {
          setUploading(true);
          const results = await Promise.allSettled(
            draftFiles.map((file) => {
              const formData = new FormData();
              formData.append("comment_id", newCommentId);
              formData.append("file", file);
              return apiClient.post("/attachments", formData, {
                headers: { "Content-Type": undefined },
              });
            })
          );
          const failed = results.filter(
            (r): r is PromiseRejectedResult => r.status === "rejected"
          );
          const succeededCount = results.length - failed.length;
          if (failed.length > 0) {
            const firstReason = extractErrorMessage(failed[0].reason, "upload failed");
            setAttachError(
              `Comment posted, but ${failed.length} of ${draftFiles.length} attachment(s) failed to upload (${firstReason}).`
            );
          } else {
            setAttachSuccess(`${succeededCount} attachment(s) uploaded successfully.`);
          }
          setUploading(false);
        } else {
          setAttachError(
            "Comment posted, but couldn't confirm its ID, so the attached file(s) weren't uploaded."
          );
        }
        setDraftFiles([]);
      }

      const commentIds = await fetchComments();
      await fetchAttachments(commentIds);
    } catch (err: unknown) {
      setCommentError(extractErrorMessage(err, "Failed to post comment."));
    } finally {
      setSendingComment(false);
    }
  };

  const handleDownload = async (att: Attachment) => {
    setAttachError("");
    try {
      const res = await apiClient.get(`/attachments/${att.id}`, {
        responseType: "blob",
      });
      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = att.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      setAttachError("Could not download that file.");
    }
  };

  const handleDeleteAttachment = async (attId: string) => {
    if (!window.confirm("Delete this attachment?")) return;
    setAttachError("");
    try {
      await apiClient.delete(`/attachments/${attId}`);
      setAttachments((prev) => prev.filter((a) => a.id !== attId));
    } catch {
      setAttachError("Could not delete that attachment.");
    }
  };

  // Sends both the display name and the matching status_id (if we have
  // one), since the backend's ticket status column likely expects the id
  // rather than the name.
  const handleSetStatus = (s: TicketStatus) => {
    setStatusOverride(ticketId, s);
    setTicket((prev) => (prev ? { ...prev, status: s } : prev));
    setShowStatusMenu(false);

    const statusRecord = statuses.find((st) => st.name === s);
    const patchBody = statusRecord ? { status: s, status_id: statusRecord.id } : { status: s };

    apiClient.patch(`/tickets/${ticketId}`, patchBody).catch((err) => {
      console.warn("Status change may not have been saved to the server:", err);
    });
  };

  // Reassigns the ticket. `member` is null for "Unassigned". NOT YET
  // CONFIRMED against the backend — this assumes PATCH /tickets/:id
  // accepts `assigned_to` the same way POST /tickets does when a ticket
  // is created. If reassigning doesn't persist after a refresh, check the
  // Network tab response for this PATCH call.
  const handleSetAssignee = (member: ProjectMember | null) => {
    setTicket((prev) =>
      prev
        ? { ...prev, assignee: member ? member.name : "Unassigned", assignedToId: member?.id }
        : prev
    );
    setShowAssigneeMenu(false);

    apiClient
      .patch(`/tickets/${ticketId}`, { assigned_to: member?.id ?? null })
      .catch((err) => {
        console.warn("Assignee change may not have been saved to the server:", err);
      });
  };

  const AttachmentRow = ({ a }: { a: Attachment }) => (
    <div
      key={a.id}
      className="flex items-center justify-between text-xs bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 mt-1.5"
    >
      <span className="text-slate-600 truncate flex-1 mr-2">
        📄 {a.name} {a.size && <span className="text-slate-400">({a.size})</span>}
      </span>
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={() => handleDownload(a)}
          className="text-violet-600 hover:text-violet-800 font-semibold"
        >
          Download
        </button>
        <button
          onClick={() => handleDeleteAttachment(a.id)}
          className="text-red-500 hover:text-red-700 font-semibold"
        >
          Delete
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar
        showDashboardBtn
        breadcrumb={`/ ${id} / ${ticket.ticketNumber || ticketId}`}
        showSearch={false}
      />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-5">
          <Link
            href={`/project/${id}?tab=Board`}
            className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-violet-700 transition-colors font-medium"
          >
            ← Back to Board
          </Link>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setShowStatusMenu(!showStatusMenu)}
                className={`flex items-center gap-2 text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors ${statusBadgeStyle(ticket.status).className}`}
                style={statusBadgeStyle(ticket.status).style}
              >
                <span className="w-2 h-2 rounded-full bg-current opacity-60" />
                {ticket.status} ▾
              </button>
              {showStatusMenu && (
                <div className="absolute right-0 top-9 bg-white border border-slate-200 rounded-xl shadow-xl shadow-slate-200 py-1 z-30 w-40">
                  {allStatuses.map((s) => (
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

        <div className="bg-white border border-slate-200 rounded-xl px-4 sm:px-5 py-4 mb-5 flex flex-wrap items-center gap-3">
          <h1 className="text-base sm:text-lg font-bold text-slate-900 flex-1 min-w-0 break-words">
            {ticket.ticketNumber || ticketId} — {ticket.title}
          </h1>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded border shrink-0 ${PRIORITY_COLORS[ticket.priority]}`}>
            Priority: {ticket.priority}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <div className="bg-white border border-slate-100 rounded-lg px-3 py-2.5">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Priority</div>
            <div className="text-sm text-slate-800 font-medium">{ticket.priority}</div>
          </div>

          <div className="relative bg-white border border-slate-100 rounded-lg px-3 py-2.5">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Assignee</div>
            <button
              type="button"
              onClick={() => setShowAssigneeMenu(!showAssigneeMenu)}
              className="text-sm text-slate-800 font-medium hover:text-violet-700 transition-colors"
            >
              {ticket.assignee} ▾
            </button>
            {showAssigneeMenu && (
              <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl shadow-slate-200 py-1 z-30 w-48 max-h-56 overflow-y-auto">
                <button
                  onClick={() => handleSetAssignee(null)}
                  className={`w-full text-left text-xs px-4 py-2 hover:bg-slate-50 transition-colors ${
                    ticket.assignee === "Unassigned" ? "font-bold text-violet-700" : "text-slate-700"
                  }`}
                >
                  Unassigned
                </button>
                {members.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handleSetAssignee(m)}
                    className={`w-full text-left text-xs px-4 py-2 hover:bg-slate-50 transition-colors truncate ${
                      ticket.assignedToId === m.id ? "font-bold text-violet-700" : "text-slate-700"
                    }`}
                  >
                    {m.name}
                  </button>
                ))}
                {members.length === 0 && (
                  <p className="text-xs text-slate-400 px-4 py-2">No members found.</p>
                )}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-100 rounded-lg px-3 py-2.5">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Created On</div>
            <div className="text-sm text-slate-800 font-medium">{ticket.createdAt}</div>
          </div>

          <div className="bg-white border border-slate-100 rounded-lg px-3 py-2.5">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Last Updated</div>
            <div className="text-sm text-slate-800 font-medium">{ticket.updatedAt}</div>
          </div>

          <div className="bg-white border border-slate-100 rounded-lg px-3 py-2.5">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Reporter</div>
            <div className="text-sm text-slate-800 font-medium">{ticket.reporter ?? "—"}</div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">Description</h2>
            <p className="text-sm text-slate-600 leading-relaxed">{ticket.description}</p>
          </div>

          {(attachmentsLoading || ticketLevelAttachments.length > 0) && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                📎 Ticket Attachments
                {ticketLevelAttachments.length > 0 && (
                  <span className="text-slate-400 font-normal normal-case">
                    ({ticketLevelAttachments.length})
                  </span>
                )}
              </h2>

              {attachmentsLoading && <p className="text-xs text-slate-400">Loading attachments...</p>}
              {!attachmentsLoading &&
                ticketLevelAttachments.map((a) => <AttachmentRow key={a.id} a={a} />)}
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">
              Comments ({comments.length})
            </h2>

            <div className="space-y-3 mb-4">
              {commentsLoading && <p className="text-sm text-slate-400">Loading comments...</p>}

              {!commentsLoading &&
                comments.map((c) => (
                  <div key={c.id} className="border border-slate-100 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <div className="w-6 h-6 bg-violet-100 rounded-full flex items-center justify-center text-xs font-bold text-violet-700 shrink-0">
                        {c.author[0]}
                      </div>
                      <span className="text-xs font-semibold text-slate-700">{c.author}</span>
                      <span className="text-xs text-slate-400">{c.timestamp}</span>
                    </div>
                    <p className="text-sm text-slate-600 ml-8 break-words">{c.text}</p>
                    {attachmentsByComment[c.id]?.length > 0 && (
                      <div className="ml-8">
                        {attachmentsByComment[c.id].map((a) => (
                          <AttachmentRow key={a.id} a={a} />
                        ))}
                      </div>
                    )}
                  </div>
                ))}

              {!commentsLoading && comments.length === 0 && (
                <p className="text-sm text-slate-400">No comments yet.</p>
              )}
            </div>

            {commentError && <p className="text-xs text-red-500 mb-2">{commentError}</p>}
            {attachError && <p className="text-xs text-red-500 mb-2">{attachError}</p>}
            {attachSuccess && !attachError && (
              <p className="text-xs text-emerald-600 mb-2">{attachSuccess}</p>
            )}

            {draftFiles.length > 0 && (
              <div className="mb-2 space-y-1.5">
                {draftFiles.map((f, idx) => (
                  <div
                    key={`${f.name}-${idx}`}
                    className="flex items-center justify-between text-xs bg-slate-50 border border-slate-100 rounded-lg px-3 py-2"
                  >
                    <span className="text-slate-700 truncate flex-1 mr-2">
                      📄 {f.name} <span className="text-slate-400">({formatBytes(f.size)})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setDraftFiles((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-red-500 hover:text-red-700 font-semibold shrink-0"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <p className="text-xs text-slate-400">
                  These will upload when you send the comment below.
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={sendingComment || uploading}
                title="Attach a file"
                className="shrink-0 flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-lg border border-slate-300 bg-white text-sm sm:text-base hover:border-violet-400 hover:bg-violet-50 transition-colors disabled:opacity-50"
              >
                📎
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  const picked = Array.from(e.target.files ?? []);
                  setDraftFiles((prev) => [...prev, ...picked]);
                  e.target.value = "";
                }}
              />
              <input
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendComment()}
                placeholder="Write a comment..."
                disabled={sendingComment || uploading}
                className="flex-1 min-w-0 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300 disabled:bg-slate-50"
              />
              <button
                onClick={handleSendComment}
                disabled={sendingComment || uploading}
                className="shrink-0 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 text-white rounded-lg px-3 py-2 transition-colors"
              >
                {sendingComment || uploading ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                ) : (
                  "➤"
                )}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}