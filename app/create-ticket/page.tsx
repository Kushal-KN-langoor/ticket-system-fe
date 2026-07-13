"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { useAppSelector } from "@/lib/redux/hooks";
import { apiClient } from "@/lib/apiClient";
import { Priority } from "@/lib/data";

interface ProjectMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

function formatBytes(bytes: number): string {
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

function extractErrorMessage(err: unknown, fallback: string) {
  return (
    (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data
      ?.message ||
    (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data
      ?.error ||
    fallback
  );
}

function CreateTicketForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project") || "";
  const projectName = searchParams.get("name") || "";
  const user = useAppSelector((state) => state.auth.user);

  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "" as Priority | "",
    assignedTo: "",
    dueDate: "",
  });

  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState("");

  // Files are only staged here — they can't actually be uploaded until the
  // ticket exists, since /attachments requires a ticket_id.
  const [files, setFiles] = useState<File[]>([]);
  const [attachmentWarning, setAttachmentWarning] = useState("");

  useEffect(() => {
    if (!user) {
      router.replace("/");
    }
  }, [user, router]);

  useEffect(() => {
    if (!projectId) return;
    apiClient
      .get(`/project/${projectId}/members`)
      .then((res) => setMembers(res.data.members || []))
      .catch(() => setMembers([]));
  }, [projectId]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = "Title is required";
    if (!form.description.trim()) e.description = "Description is required";
    if (!form.priority) e.priority = "Priority is required";
    return e;
  };

  const handleSubmit = async () => {
    setApiError("");
    setAttachmentWarning("");
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }

    setLoading(true);
    try {
      // Confirmed backend shape (verified via curl):
      // POST /tickets { title, description, status, priority, project_id, ticket_order }
      // assigned_to / due_date are sent as optional extras since the UI
      // supports them — if the backend ignores or rejects them, they can
      // be moved to a separate PATCH /tickets/:id call after creation.
      const res = await apiClient.post("/tickets", {
        title: form.title.trim(),
        description: form.description.trim(),
        status: "To Do",
        priority: form.priority,
        project_id: projectId,
        ticket_order: "1",
        assigned_to: form.assignedTo || undefined,
        due_date: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
      });

      const created = res.data?.ticket || res.data?.data || res.data;
      const newTicketId: string | undefined = created?.id;

      if (files.length > 0 && newTicketId) {
        const results = await Promise.allSettled(
          files.map((file) => {
            const formData = new FormData();
            formData.append("ticket_id", newTicketId);
            formData.append("file", file);
            // ⚠️ Must override Content-Type here — apiClient defaults to
            // application/json, which breaks the multipart boundary and
            // causes the backend to 400 this request.
            return apiClient.post("/attachments", formData, {
              headers: { "Content-Type": undefined },
            });
          })
        );
        const failed = results.filter(
          (r): r is PromiseRejectedResult => r.status === "rejected"
        );
        if (failed.length > 0) {
          const firstReason = extractErrorMessage(
            failed[0].reason,
            "attachment upload failed"
          );
          setAttachmentWarning(
            `Ticket created, but ${failed.length} of ${files.length} attachment(s) failed to upload (${firstReason}). You can retry from the ticket page.`
          );
        }
      } else if (files.length > 0 && !newTicketId) {
        setAttachmentWarning(
          "Ticket created, but couldn't confirm its ID, so attachments weren't uploaded. Add them from the ticket page."
        );
      }

      setSubmitted(true);
      setTimeout(() => {
        router.push(`/project/${projectId}?tab=Board`);
      }, 1400);
    } catch (err: unknown) {
      setApiError(extractErrorMessage(err, "Failed to create ticket. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return null;
  }

  if (submitted) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl text-emerald-600">✓</span>
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Ticket Created!</h2>
        {attachmentWarning ? (
          <p className="text-amber-600 text-sm max-w-sm mx-auto">{attachmentWarning}</p>
        ) : (
          <p className="text-slate-500 text-sm">Redirecting to project...</p>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={projectId ? `/project/${projectId}?tab=Board` : "/dashboard"}
          className="text-slate-500 hover:text-violet-600 transition-colors"
        >
          <i className="fi fi-rr-arrow-left text-lg"></i>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Create New Ticket</h1>
          {projectName && <p className="text-sm text-slate-500">Project: {projectName}</p>}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Enter a clear, specific ticket title"
            className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 transition-all ${
              errors.title ? "border-red-300 bg-red-50" : "border-slate-200"
            }`}
          />
          {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Describe the issue in detail — steps to reproduce, expected vs actual behavior, etc."
            rows={4}
            className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none transition-all ${
              errors.description ? "border-red-300 bg-red-50" : "border-slate-200"
            }`}
          />
          {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
            Priority <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2">
            {(["High", "Medium", "Low"] as Priority[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setForm({ ...form, priority: p })}
                className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-all ${
                  form.priority === p
                    ? p === "High"
                      ? "bg-red-100 border-red-300 text-red-700"
                      : p === "Medium"
                      ? "bg-amber-100 border-amber-300 text-amber-700"
                      : "bg-green-100 border-green-300 text-green-700"
                    : "border-slate-200 text-slate-500 hover:border-slate-300"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          {errors.priority && <p className="text-xs text-red-500 mt-1">{errors.priority}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
            Assignee <span className="text-xs font-normal text-slate-400">(optional)</span>
          </label>
          <select
            value={form.assignedTo}
            onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white"
          >
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.email})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
            Due Date <span className="text-xs font-normal text-slate-400">(optional)</span>
          </label>
          <input
            type="date"
            value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
            Attachments <span className="text-xs font-normal text-slate-400">(optional)</span>
          </label>
          <label className="flex items-center justify-center gap-2 w-full px-3 py-3 text-sm border border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-violet-300 hover:text-violet-600 cursor-pointer transition-colors">
            <i className="fi fi-rr-paperclip text-sm"></i>
            Click to add file(s)
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                const picked = Array.from(e.target.files ?? []);
                setFiles((prev) => [...prev, ...picked]);
                e.target.value = "";
              }}
            />
          </label>

          {files.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {files.map((f, idx) => (
                <div
                  key={`${f.name}-${idx}`}
                  className="flex items-center justify-between text-xs bg-slate-50 border border-slate-100 rounded-lg px-3 py-2"
                >
                  <span className="text-slate-700 truncate flex-1 mr-2">
                    📄 {f.name} <span className="text-slate-400">({formatBytes(f.size)})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}
                    className="text-red-500 hover:text-red-700 font-semibold shrink-0"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {apiError && <p className="text-xs text-red-500">{apiError}</p>}

        <p className="text-xs text-slate-400">* Required fields</p>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 text-white font-semibold py-2.5 rounded-lg transition-all shadow-sm shadow-violet-200 text-sm"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Submitting...
              </span>
            ) : (
              "Submit Ticket"
            )}
          </button>
          <Link
            href={projectId ? `/project/${projectId}?tab=Board` : "/dashboard"}
            className="flex-1 text-center py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function CreateTicketPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar showDashboardBtn showSearch={false} />
      <main className="max-w-4xl mx-auto px-6 py-8">
        <Suspense fallback={<div className="text-slate-500">Loading...</div>}>
          <CreateTicketForm />
        </Suspense>
      </main>
    </div>
  );
}