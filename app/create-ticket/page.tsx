"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { useApp } from "@/context/AppStore";
import { useAppSelector } from "@/lib/redux/hooks";
import { Priority } from "@/lib/data";

function CreateTicketForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project") || "";
  const { createTicket, projects } = useApp();
  const user = useAppSelector((state) => state.auth.user); // new Redux

  const project = projects.find((p) => p.id === projectId);

  const [form, setForm] = useState({
    title: "",
    category: "",
    description: "",
    priority: "" as Priority | "",
    assignee: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = "Title is required";
    if (!form.category) e.category = "Category is required";
    if (!form.description.trim()) e.description = "Description is required";
    if (!form.priority) e.priority = "Priority is required";
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 700));
    createTicket(projectId, {
      title: form.title,
      category: form.category,
      description: form.description,
      priority: form.priority as Priority,
      assignee: form.assignee,
    });
    setLoading(false);
    setSubmitted(true);
    await new Promise((r) => setTimeout(r, 1200));
    router.push(`/project/${projectId}`);
  };

  useEffect(() => {
    if (!user) {
      router.replace("/");
    }
  }, [user, router]);

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
        <p className="text-slate-500 text-sm">Redirecting to project...</p>
      </div>
    );
  }

  const teamMembers = ["John Doe", "Jane Smith", "Emily Davis", "Mike Johnson", "Alex Chen", "Sarah Park"];

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href={projectId ? `/project/${projectId}` : "/dashboard"} className="text-slate-500 hover:text-violet-600 transition-colors">
          <i className="fi fi-rr-arrow-left text-lg"></i>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Create New Ticket</h1>
          {project && <p className="text-sm text-slate-500">Project: {project.name}</p>}
        </div>
      </div>

      <div className="space-y-4">
        {/* Title */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Enter a clear, specific ticket title"
            className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 transition-all ${errors.title ? "border-red-300 bg-red-50" : "border-slate-200"}`}
          />
          {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title}</p>}
        </div>

        {/* Category */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
            Category <span className="text-red-500">*</span>
          </label>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white transition-all ${errors.category ? "border-red-300 bg-red-50" : "border-slate-200"}`}
          >
            <option value="">Select Category</option>
            <option>IT Support</option>
            <option>Network</option>
            <option>Software</option>
            <option>Hardware</option>
            <option>DevOps</option>
            <option>Other</option>
          </select>
          {errors.category && <p className="text-xs text-red-500 mt-1">{errors.category}</p>}
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Describe the issue in detail — steps to reproduce, expected vs actual behavior, etc."
            rows={4}
            className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none transition-all ${errors.description ? "border-red-300 bg-red-50" : "border-slate-200"}`}
          />
          {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description}</p>}
        </div>

        {/* Priority */}
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
                    ? p === "High" ? "bg-red-100 border-red-300 text-red-700"
                    : p === "Medium" ? "bg-amber-100 border-amber-300 text-amber-700"
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

        {/* Assignee */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
            Assignee <span className="text-xs font-normal text-slate-400">(optional)</span>
          </label>
          <select
            value={form.assignee}
            onChange={(e) => setForm({ ...form, assignee: e.target.value })}
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white"
          >
            <option value="">Unassigned</option>
            {teamMembers.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>

        {/* Attachment */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
            Attachment <span className="text-xs font-normal text-slate-400">(optional)</span>
          </label>
          <label className="block border-2 border-dashed border-slate-200 hover:border-violet-300 rounded-xl p-6 text-center cursor-pointer transition-colors group">
            <i className="fi fi-rr-upload text-xl mx-auto text-slate-300 group-hover:text-violet-400 mb-2 transition-colors"></i>
            {file ? (
              <span className="text-sm text-violet-700 font-medium">{file.name}</span>
            ) : (
              <>
                <span className="text-sm text-slate-400">Upload File</span>
                <span className="block text-xs text-slate-300 mt-0.5">or drag and drop</span>
              </>
            )}
            <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
        </div>

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
            ) : "Submit Ticket"}
          </button>
          <Link
            href={projectId ? `/project/${projectId}` : "/dashboard"}
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