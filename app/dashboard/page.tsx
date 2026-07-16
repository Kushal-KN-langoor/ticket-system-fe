"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { useAppSelector } from "@/lib/redux/hooks";
import { apiClient } from "@/lib/apiClient";

// Same list used on the signup page's Department picker, kept in sync so
// "category" here lines up with "department" there. If the backend ever
// exposes a real endpoint for this list, swap this constant for a fetch.
const CATEGORY_OPTIONS = [
  "HR",
  "Hardware",
  "Software",
  "Project Management",
  "Finance",
  "Sales",
  "Marketing",
  "IT Support",
  "Operations",
  "Legal",
];

// Colored pill per category, same visual language as the ticket priority
// badges (e.g. the red "High" tag on the kanban board).
const CATEGORY_COLORS: Record<string, string> = {
  HR: "bg-pink-100 text-pink-700",
  Hardware: "bg-orange-100 text-orange-700",
  Software: "bg-blue-100 text-blue-700",
  "Project Management": "bg-violet-100 text-violet-700",
  Finance: "bg-emerald-100 text-emerald-700",
  Sales: "bg-amber-100 text-amber-700",
  Marketing: "bg-fuchsia-100 text-fuchsia-700",
  "IT Support": "bg-cyan-100 text-cyan-700",
  Operations: "bg-indigo-100 text-indigo-700",
  Legal: "bg-slate-200 text-slate-700",
};
const DEFAULT_CATEGORY_COLOR = "bg-slate-100 text-slate-600";

interface Project {
  id?: string;
  _id?: string;
  name: string;
  description?: string;
  category?: string;
  department?: string;
  created_at?: string;
  createdAt?: string;
  user_id?: string;
  super_admin_id?: string | null;
}

export default function DashboardPage() {
  const user = useAppSelector((state) => state.auth.user);
  const router = useRouter();

  const [projects, setProjects] = useState<Project[]>([]);
  const [query, setQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [newProject, setNewProject] = useState({ name: "", description: "", category: "" });
  const [formError, setFormError] = useState("");
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const isAdmin = user?.role?.toLowerCase() === "admin";

  useEffect(() => {
    if (!user) {
      router.replace("/");
    }
  }, [user, router]);

  useEffect(() => {
    if (!user?.id) return;

    let isActive = true;

    const fetchDashboard = async () => {
      setLoading(true);
      setLoadError("");

      try {
        const res = await apiClient.get(`/api/users/${user.id}/dashboard`);
        const data = res.data;

        if (res.status < 200 || res.status >= 300) {
          if (isActive) {
            setLoadError(data.message || data.error || "Failed to load projects.");
          }
          return;
        }

        const list: Project[] = data.projects || [];
        // Newest first
        const sorted = [...list].sort((a, b) => {
          const dateA = new Date(a.created_at || a.createdAt || 0).getTime();
          const dateB = new Date(b.created_at || b.createdAt || 0).getTime();
          return dateB - dateA;
        });

        if (isActive) {
          setProjects(sorted);
        }
      } catch {
        if (isActive) {
          setLoadError("Could not reach the server.");
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    void fetchDashboard();

    return () => {
      isActive = false;
    };
  }, [user]);

  if (!user) {
    return null;
  }

  const filtered = projects.filter(
    (p) =>
      p.name?.toLowerCase().includes(query.toLowerCase()) ||
      (p.description || "").toLowerCase().includes(query.toLowerCase())
  );

  const handleCreate = async () => {
    if (!newProject.name.trim()) {
      setFormError("Project name is required.");
      return;
    }
    setCreating(true);
    setFormError("");
    try {
      // NOTE: backend endpoint is /api/project (not /project), and it
      // expects the field name "department" (not "category").
      const res = await apiClient.post("/api/project", {
        name: newProject.name.trim(),
        description: newProject.description.trim(),
        department: newProject.category,
      });
      const data = res.data;
      if (res.status < 200 || res.status >= 300) {
        setFormError(data.message || data.error || "Failed to create project.");
        return;
      }
      // Re-fetch the full list from the backend so it's accurate and correctly ordered
      if (!user?.id) return;
      const refreshed = await apiClient.get(`/api/users/${user.id}/dashboard`);
      const refreshedData = refreshed.data;
      const list: Project[] = refreshedData.projects || [];
      const sorted = [...list].sort((a, b) => {
        const dateA = new Date(a.created_at || a.createdAt || 0).getTime();
        const dateB = new Date(b.created_at || b.createdAt || 0).getTime();
        return dateB - dateA;
      });
      setProjects(sorted);
      setNewProject({ name: "", description: "", category: "" });
      setShowModal(false);
    } catch {
      setFormError("Could not reach the server.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar showSearch={false} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <div className="flex items-start sm:items-center justify-between mb-6 gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Dashboard</h1>
            <p className="text-sm text-slate-500 mt-0.5">Welcome back, {user.name}</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => { setFormError(""); setShowModal(true); }}
              className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-3 sm:px-4 py-2 rounded-lg transition-colors shadow-sm shadow-violet-200 shrink-0"
            >
              <i className="fi fi-rr-plus text-base"></i>
              <span className="hidden sm:inline">Create Project</span>
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <i className="fi fi-rr-search text-base absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"></i>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects..."
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 shadow-sm"
          />
        </div>

        {/* Project list */}
        <div className="space-y-3">
          {loading && (
            <div className="text-center py-16 text-slate-400">
              <p className="text-sm">Loading projects...</p>
            </div>
          )}

          {!loading && loadError && (
            <div className="text-center py-16 text-red-400">
              <p className="text-sm">{loadError}</p>
            </div>
          )}

          {!loading && !loadError && filtered.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <p className="text-sm">No projects yet.</p>
            </div>
          )}

          {!loading && !loadError && filtered.map((project, index) => {
            const id = project.id || project._id || "";
            return (
              <Link
                key={id || `${project.name}-${index}`}
                href={`/project/${id}`}
                className="block bg-white border border-slate-200 rounded-xl px-4 sm:px-5 py-4 hover:border-violet-300 hover:shadow-md hover:shadow-violet-50 transition-all group"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="font-semibold text-slate-900 text-base group-hover:text-violet-700 transition-colors truncate">
                        {project.name}
                      </h2>
                      {project.department && (
                        <span
                          className={`shrink-0 text-xs font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap ${CATEGORY_COLORS[project.department] || DEFAULT_CATEGORY_COLOR}`}
                        >
                          {project.department}
                        </span>
                      )}
                    </div>
                    {project.description && (
                      <p className="text-sm text-slate-500 truncate">{project.description}</p>
                    )}
                  </div>
                  <i className="fi fi-rr-angle-small-right text-lg text-slate-300 group-hover:text-violet-500 transition-colors shrink-0"></i>
                </div>
              </Link>
            );
          })}
        </div>
      </main>

      {/* Create project modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Create New Project</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                  Project Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  placeholder="e.g. Mobile App Support"
                  className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 ${!newProject.name && formError ? "border-red-300" : "border-slate-200"}`}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                  Description
                </label>
                <textarea
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                  placeholder="e.g. Handles all customer support tickets for the mobile app"
                  rows={3}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none"
                />
              </div>

              {/* Category (single-select dropdown) */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                  Category
                </label>
                <div className="relative">
                  <select
                    value={newProject.category}
                    onChange={(e) => setNewProject({ ...newProject, category: e.target.value })}
                    className="w-full appearance-none px-3 py-2.5 pr-9 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white text-left"
                  >
                    <option value="">Select a category</option>
                    {CATEGORY_OPTIONS.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>

              {formError && <p className="text-xs text-red-500">{formError}</p>}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowModal(false); setNewProject({ name: "", description: "", category: "" }); setFormError(""); }}
                className="flex-1 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                disabled={creating}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex-1 py-2.5 text-sm font-semibold bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors disabled:bg-violet-400"
              >
                {creating ? "Creating..." : "Create Project"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}