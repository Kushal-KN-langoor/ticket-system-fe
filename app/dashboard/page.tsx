"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { useAppSelector } from "@/lib/redux/hooks";
import { apiClient } from "@/lib/apiClient";

interface Project {
  id?: string;
  _id?: string;
  name: string;
  description?: string;
  created_at?: string;
  createdAt?: string;
  user_id?: string;
  super_admin_id?: string | null;
}

export default function DashboardPage() {
  const user = useAppSelector((state) => state.auth.user);
  const accessToken = useAppSelector((state) => state.auth.accessToken);
  const router = useRouter();

  const [projects, setProjects] = useState<Project[]>([]);
  const [query, setQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [newProject, setNewProject] = useState({ name: "", description: "" });
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

  // Fetch the user's dashboard (project list) from the backend
  const fetchDashboard = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setLoadError("");
    try {
      const res = await apiClient(`/api/users/${user.id}/dashboard`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { "x-auth-token": accessToken } : {}),
        },
      });
      const data = await res.json();
      if (!res.ok) {
        setLoadError(data.message || data.error || "Failed to load projects.");
        return;
      }
      const list: Project[] = data.projects || [];
      // Newest first
      const sorted = [...list].sort((a, b) => {
        const dateA = new Date(a.created_at || a.createdAt || 0).getTime();
        const dateB = new Date(b.created_at || b.createdAt || 0).getTime();
        return dateB - dateA;
      });
      setProjects(sorted);
    } catch {
      setLoadError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }, [user?.id, accessToken]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

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
      const res = await apiClient("/project", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newProject.name.trim(),
          description: newProject.description.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.message || data.error || "Failed to create project.");
        return;
      }
      // Re-fetch the full list from the backend so it's accurate and correctly ordered
      await fetchDashboard();
      setNewProject({ name: "", description: "" });
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
                    <h2 className="font-semibold text-slate-900 text-base group-hover:text-violet-700 transition-colors truncate mb-1">
                      {project.name}
                    </h2>
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
              {formError && <p className="text-xs text-red-500">{formError}</p>}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowModal(false); setNewProject({ name: "", description: "" }); setFormError(""); }}
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