"use client";

import { useEffect, useState, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import SummaryTab, { TrendPoint, CategorySlice } from "@/components/SummaryTab";
import KanbanBoard from "@/components/KanbanBoard";
import { useApp } from "@/context/AppStore";
import { useAppSelector } from "@/lib/redux/hooks";
import { apiClient } from "@/lib/apiClient";
import { Ticket, BackendTicket, mapBackendTicket } from "@/lib/data";
import { applyStatusOverrides, setStatusOverride } from "@/lib/ticketStatusStore";

type Tab = "Summary" | "Board" | "Members";
type MemberMode = "new" | "existing";

interface FetchedProject {
  id: string;
  name: string;
  description?: string;
  ticketCount: number;
  tickets: Ticket[];
}

interface ProjectMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

// Backend field names for /summary/:id are unconfirmed, so every field is
// read defensively with several possible aliases. If the console debug log
// (search "raw summary response") shows a field name not covered here, add
// it to the relevant alias chain below.
interface BackendSummary {
  total?: number;
  total_tickets?: number;
  totalTickets?: number;
  open?: number;
  open_tickets?: number;
  openTickets?: number;
  in_progress?: number;
  inProgress?: number;
  resolved?: number;
  resolved_tickets?: number;
  done?: number;
  closed?: number;
  trend?: Array<Record<string, unknown>>;
  ticket_trend?: Array<Record<string, unknown>>;
  trends?: Array<Record<string, unknown>>;
  category?: Array<Record<string, unknown>>;
  categories?: Array<Record<string, unknown>>;
  category_breakdown?: Array<Record<string, unknown>>;
  by_category?: Array<Record<string, unknown>>;
  data?: BackendSummary;
  summary?: BackendSummary;
}

interface SummaryState {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  trend: TrendPoint[];
  categories: CategorySlice[];
}

// Unwraps {data: {...}} / {summary: {...}} nesting so we can read the
// actual stats regardless of how the backend wraps the payload.
function unwrapSummary(raw: BackendSummary): BackendSummary {
  return raw.data ?? raw.summary ?? raw;
}

function extractArray(raw: BackendSummary, keys: (keyof BackendSummary)[]): Array<Record<string, unknown>> {
  for (const key of keys) {
    const val = raw[key];
    if (Array.isArray(val)) return val as Array<Record<string, unknown>>;
  }
  return [];
}

function mapBackendSummary(payload: unknown): SummaryState {
  const outer = (payload as BackendSummary) || {};
  const raw = unwrapSummary(outer);

  const trendRaw = extractArray(raw, ["trend", "ticket_trend", "trends"]);
  const categoryRaw = extractArray(raw, ["category", "categories", "category_breakdown", "by_category"]);

  const trend: TrendPoint[] = trendRaw.map((t) => ({
    day: String(t.day ?? t.date ?? t.label ?? t.name ?? ""),
    tickets: Number(t.tickets ?? t.count ?? t.total ?? 0),
  }));

  const categories: CategorySlice[] = categoryRaw.map((c) => ({
    name: String(c.name ?? c.category ?? c.label ?? "Other"),
    value: Number(c.value ?? c.count ?? c.total ?? 0),
    color: typeof c.color === "string" ? c.color : undefined,
  }));

  return {
    total: Number(raw.total ?? raw.total_tickets ?? raw.totalTickets ?? 0),
    open: Number(raw.open ?? raw.open_tickets ?? raw.openTickets ?? 0),
    inProgress: Number(raw.in_progress ?? raw.inProgress ?? 0),
    resolved: Number(raw.resolved ?? raw.resolved_tickets ?? raw.done ?? raw.closed ?? 0),
    trend,
    categories,
  };
}

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { projects: mockProjects } = useApp();
  const user = useAppSelector((state) => state.auth.user);
  const router = useRouter();
  const searchParams = useSearchParams();

  const tabParam = searchParams.get("tab") as Tab | null;
  const [activeTab, setActiveTab] = useState<Tab>(tabParam === "Board" ? "Board" : "Summary");

  const fallbackName = searchParams.get("name") || "";
  const fallbackDescription = searchParams.get("description") || "";

  const [project, setProject] = useState<FetchedProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [showAddMember, setShowAddMember] = useState(false);
  const [memberMode, setMemberMode] = useState<MemberMode>("new");

  const [memberName, setMemberName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberPassword, setMemberPassword] = useState("");
  const [memberRole, setMemberRole] = useState("User");

  const [existingEmail, setExistingEmail] = useState("");

  const [addingMember, setAddingMember] = useState(false);
  const [memberError, setMemberError] = useState("");
  const [memberSuccess, setMemberSuccess] = useState("");

  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersError, setMembersError] = useState("");

  // Real tickets from the backend, filtered down to this project.
  // GET /api/tickets returns every ticket across every project — there's
  // no project-scoped endpoint — so we fetch all and filter client-side.
  const [realTickets, setRealTickets] = useState<Ticket[] | null>(null);
  const [ticketsError, setTicketsError] = useState("");

  const [summary, setSummary] = useState<SummaryState | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState("");

  const isAdmin = user?.role?.toLowerCase() === "admin";

  useEffect(() => {
    if (!user) {
      router.replace("/");
    }
  }, [user, router]);

  useEffect(() => {
    if (!user?.id) return;

    let isActive = true;

    const fetchProject = async () => {
      setLoading(true);
      setLoadError("");
      try {
        // There's no GET /project/:id on the backend — the dashboard
        // endpoint is the only place project data comes from, so fetch
        // the full list and pick out the one we need.
        const res = await apiClient.get(`/api/users/${user.id}/dashboard`);
        const data = res.data;

        if (res.status < 200 || res.status >= 300) {
          if (isActive) {
            if (fallbackName) {
              setProject({
                id,
                name: fallbackName,
                description: fallbackDescription,
                ticketCount: 0,
                tickets: mockProjects.find((p) => p.id === id)?.tickets || [],
              });
            } else {
              setLoadError(data.message || data.error || "Failed to load project.");
            }
          }
          return;
        }

        const list: Array<Record<string, unknown>> = data.projects || [];
        const raw = list.find((p) => (p.id || p._id) === id);

        if (!raw) {
          if (isActive) {
            if (fallbackName) {
              setProject({
                id,
                name: fallbackName,
                description: fallbackDescription,
                ticketCount: 0,
                tickets: mockProjects.find((p) => p.id === id)?.tickets || [],
              });
            } else {
              setLoadError("Project not found.");
            }
          }
          return;
        }

        if (isActive) {
          setProject({
            id: (raw.id as string) || (raw._id as string) || id,
            name: raw.name as string,
            description: raw.description as string | undefined,
            ticketCount: (raw.ticketCount as number) ?? 0,
            tickets: mockProjects.find((p) => p.id === id)?.tickets || [],
          });
        }
      } catch {
        const mock = mockProjects.find((p) => p.id === id);
        if (isActive) {
          if (mock) {
            setProject({
              id: mock.id,
              name: mock.name,
              description: mock.category,
              ticketCount: mock.ticketCount,
              tickets: mock.tickets,
            });
          } else if (fallbackName) {
            setProject({
              id,
              name: fallbackName,
              description: fallbackDescription,
              ticketCount: 0,
              tickets: [],
            });
          } else {
            setLoadError("Could not reach the server.");
          }
        }
      } finally {
        if (isActive) setLoading(false);
      }
    };

    void fetchProject();

    return () => {
      isActive = false;
    };
  }, [id, user, mockProjects]);

  const fetchTickets = async () => {
    setTicketsError("");
    try {
      const res = await apiClient.get("/tickets");
      const all: BackendTicket[] = res.data?.tickets || [];
      const mine = all.filter((t) => t.project_id === id).map(mapBackendTicket);
      setRealTickets(applyStatusOverrides(mine));
    } catch {
      setTicketsError("Could not load tickets from the server.");
      setRealTickets(null);
    }
  };

  useEffect(() => {
    if (!user) return;
    void fetchTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user]);

  const fetchMembers = async () => {
    setMembersLoading(true);
    setMembersError("");
    try {
      const res = await apiClient.get(`/project/${id}/members`);
      const data = res.data;

      if (res.status < 200 || res.status >= 300) {
        setMembersError(data?.message || data?.error || "Failed to load members.");
        return;
      }

      setMembers(data.members || []);
    } catch {
      setMembersError("Could not reach the server.");
    } finally {
      setMembersLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    void fetchMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user]);

  const fetchSummary = async () => {
    setSummaryLoading(true);
    setSummaryError("");
    try {
      const res = await apiClient.get(`/api/summary/${id}`);
      // TEMP DEBUG: check your browser console to see the exact shape the
      // backend returns — if stats/trend/categories look wrong on screen,
      // paste this log and the field aliases in mapBackendSummary can be
      // adjusted to match.
      // eslint-disable-next-line no-console
      console.log("raw summary response:", res.data);
      setSummary(mapBackendSummary(res.data));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log("summary fetch failed:", err);
      setSummaryError("Could not load live summary data.");
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    void fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user]);

  const resetMemberForm = () => {
    setMemberName("");
    setMemberEmail("");
    setMemberPassword("");
    setMemberRole("User");
    setExistingEmail("");
    setMemberError("");
    setMemberSuccess("");
  };

  const handleAddMember = async () => {
    setMemberError("");
    setMemberSuccess("");

    if (memberMode === "new") {
      if (!memberName.trim() || !memberEmail.trim() || !memberPassword.trim()) {
        setMemberError("Name, email, and password are required.");
        return;
      }
      if (memberPassword.length < 8) {
        setMemberError("Password must be at least 8 characters.");
        return;
      }
    } else {
      if (!existingEmail.trim()) {
        setMemberError("Email is required.");
        return;
      }
    }

    setAddingMember(true);
    setMemberError("");
    setMemberSuccess("");

    try {
      let memberUserId: string | undefined;

      if (memberMode === "new") {
        // Create the new member's account first so we have a user_id to attach.
        const signupRes = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: memberName.trim(),
            email: memberEmail.trim(),
            password: memberPassword,
            role: memberRole,
          }),
        });
        const signupData = await signupRes.json();

        if (!signupRes.ok || !signupData?.user?.id) {
          setMemberError(
            signupData?.message || signupData?.error || "Could not create the new member's account."
          );
          return;
        }
        memberUserId = signupData.user.id;
      }

      const res = await apiClient.post(`/project/${id}/members`, {
        members:
          memberMode === "new"
            ? [{ user_id: memberUserId }]
            : [{ email: existingEmail.trim() }],
      });

      if (res.status < 200 || res.status >= 300) {
        setMemberError(res.data?.message || res.data?.error || "Failed to add member.");
        return;
      }

      setMemberSuccess("Member added successfully!");
      void fetchMembers();
      setTimeout(() => {
        setShowAddMember(false);
        resetMemberForm();
      }, 1200);
    } catch {
      setMemberError("Could not reach the server.");
    } finally {
      setAddingMember(false);
    }
  };

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-400 text-sm">Loading project...</p>
      </div>
    );
  }

  if (!project || loadError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 mb-4">{loadError || "Project not found."}</p>
          <Link href="/dashboard" className="text-violet-600 hover:underline text-sm">← Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  // Drag-and-drop status change: updates the board immediately (optimistic),
  // and *attempts* to persist it to the backend. There's no confirmed
  // "update ticket status" endpoint yet, so this guesses the conventional
  // PATCH /tickets/:id shape. If that guess is wrong the request will just
  // fail quietly (console-logged) and the board stays correct locally — but
  // the change won't survive a refresh until the real endpoint is confirmed.
  const handleTicketStatusChange = (ticketId: string, status: Ticket["status"]) => {
    setStatusOverride(ticketId, status);
    setRealTickets((prev) =>
      (prev ?? project.tickets).map((t) => (t.id === ticketId ? { ...t, status } : t))
    );
    apiClient.patch(`/tickets/${ticketId}`, { status }).catch((err) => {
      console.warn("Status change may not have been saved to the server:", err);
    });
  };

  const displayedTickets = realTickets ?? project.tickets;

  const open = displayedTickets.filter((t) => t.status === "Backlog" || t.status === "To Do").length;
  const inProgress = displayedTickets.filter((t) => t.status === "In Progress").length;
  const resolved = displayedTickets.filter((t) => t.status === "Done").length;

  const tabs: Tab[] = ["Summary", "Board", "Members"];

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar
        showDashboardBtn
        breadcrumb={`/ ${project.name}`}
        searchPlaceholder="Search tickets..."
        projectTickets={displayedTickets}
        projectId={project.id}
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="bg-white border border-slate-200 rounded-xl px-4 sm:px-5 py-4 mb-5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-900 truncate">{project.name}</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {displayedTickets.length} tickets
              {ticketsError && <span className="text-red-400"> · {ticketsError}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isAdmin && activeTab === "Members" && (
              <button
                onClick={() => { resetMemberForm(); setMemberMode("new"); setShowAddMember(true); }}
                className="flex items-center gap-1.5 text-sm font-semibold text-violet-700 border border-violet-200 bg-violet-50 hover:bg-violet-100 rounded-lg px-3 py-1.5 transition-colors"
              >
                <i className="fi fi-rr-user-add text-sm"></i>
                <span className="hidden sm:inline">Add Member</span>
              </button>
            )}
            {activeTab === "Board" && (
              <Link
                href={`/create-ticket?project=${project.id}&tab=Board&name=${encodeURIComponent(project.name)}&description=${encodeURIComponent(project.description || "")}`}
                className="flex items-center gap-1.5 text-sm font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-3 py-1.5 transition-colors shadow-sm shadow-violet-200"
              >
                <i className="fi fi-rr-plus text-sm"></i>
                <span className="hidden sm:inline">Create Ticket</span>
              </Link>
            )}
          </div>
        </div>

        <div className="flex gap-0 border-b border-slate-200 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? "border-violet-600 text-violet-700"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === "Summary" && (
          <SummaryTab
            total={summary?.total ?? displayedTickets.length}
            open={summary?.open ?? open}
            inProgress={summary?.inProgress ?? inProgress}
            resolved={summary?.resolved ?? resolved}
            trend={summary?.trend}
            categories={summary?.categories}
            loading={summaryLoading}
            error={summaryError}
          />
        )}
        {activeTab === "Board" && (
          <KanbanBoard
            tickets={displayedTickets}
            projectId={project.id}
            onStatusChange={handleTicketStatusChange}
          />
        )}

        {activeTab === "Members" && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {membersLoading && (
              <div className="text-center py-16 text-slate-400">
                <p className="text-sm">Loading members...</p>
              </div>
            )}

            {!membersLoading && membersError && (
              <div className="text-center py-16 text-red-400">
                <p className="text-sm">{membersError}</p>
              </div>
            )}

            {!membersLoading && !membersError && members.length === 0 && (
              <div className="text-center py-16 text-slate-400">
                <p className="text-sm">No members yet.</p>
              </div>
            )}

            {!membersLoading && !membersError && members.length > 0 && (
              <ul className="divide-y divide-slate-100">
                {members.map((member) => (
                  <li key={member.id} className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-violet-100 text-violet-700 font-semibold text-sm flex items-center justify-center shrink-0">
                        {member.name?.charAt(0).toUpperCase() || "?"}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{member.name}</p>
                        <p className="text-xs text-slate-500 truncate">{member.email}</p>
                      </div>
                    </div>
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${
                        member.role?.toLowerCase() === "admin"
                          ? "bg-violet-100 text-violet-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {member.role}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </main>

      {showAddMember && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Add Member</h2>

            <div className="flex gap-0 border border-slate-200 rounded-lg p-1 mb-4 bg-slate-50">
              <button
                onClick={() => { setMemberMode("new"); setMemberError(""); setMemberSuccess(""); }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  memberMode === "new"
                    ? "bg-white text-violet-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                New Member
              </button>
              <button
                onClick={() => { setMemberMode("existing"); setMemberError(""); setMemberSuccess(""); }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  memberMode === "existing"
                    ? "bg-white text-violet-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Existing Member
              </button>
            </div>

            <div className="space-y-4">
              {memberMode === "new" ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={memberName}
                      onChange={(e) => setMemberName(e.target.value)}
                      placeholder="Jane Doe"
                      className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={memberEmail}
                      onChange={(e) => setMemberEmail(e.target.value)}
                      placeholder="teammate@company.com"
                      className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                      Password <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={memberPassword}
                      onChange={(e) => setMemberPassword(e.target.value)}
                      placeholder="••••••••"
                      className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 ${
                        memberPassword && memberPassword.length < 8 ? "border-red-300" : "border-slate-200"
                      }`}
                    />
                    <p className={`text-xs mt-1 ${memberPassword && memberPassword.length < 8 ? "text-red-500" : "text-slate-400"}`}>
                      Must be at least 8 characters
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                      Role
                    </label>
                    <select
                      value={memberRole}
                      onChange={(e) => setMemberRole(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300"
                    >
                      <option value="User">User</option>
                      <option value="Admin">Admin</option>
                    </select>
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={existingEmail}
                    onChange={(e) => setExistingEmail(e.target.value)}
                    placeholder="teammate@company.com"
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300"
                    autoFocus
                  />
                </div>
              )}

              {memberError && <p className="text-xs text-red-500">{memberError}</p>}
              {memberSuccess && <p className="text-xs text-emerald-600">{memberSuccess}</p>}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowAddMember(false); resetMemberForm(); }}
                className="flex-1 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                disabled={addingMember}
              >
                Close
              </button>
              <button
                onClick={handleAddMember}
                disabled={addingMember}
                className="flex-1 py-2.5 text-sm font-semibold bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors disabled:bg-violet-400"
              >
                {addingMember ? "Adding..." : "Add Member"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}