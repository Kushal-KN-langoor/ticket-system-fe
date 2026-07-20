import type { CSSProperties } from "react";
import type { Status } from "./statusesApi";

export type Priority = "High" | "Medium" | "Low" | "Critical";
// Statuses used to be a fixed union, but they're now managed through the
// /api/statuses CRUD endpoints (see lib/statusesApi.ts) and can be
// renamed/added/removed at runtime, so this is just a string now.
export type TicketStatus = string;
export type ProjectStatus = "In Progress" | "Active" | "Completed";

export interface Ticket {
  id: string;
  ticketNumber?: string;
  title: string;
  category: string;
  priority: Priority;
  status: TicketStatus;
  assignee: string;
  assignedToId?: string | null;
  reporter: string;
  createdAt: string;
  updatedAt: string;
  description: string;
  comments: Comment[];
  attachments: Attachment[];
  workLog: WorkLogEntry[];
  estimatedTime: string;
  timeSpent: string;
  remaining: string;
}

// ---- Backend -> frontend ticket mapping ----
const KNOWN_PRIORITIES: Priority[] = ["Low", "Medium", "High", "Critical"];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Exported so callers (project page, ticket page) can figure out which
// status ids they need to resolve via ensureStatusesLoaded() BEFORE calling
// mapBackendTicket, instead of mapBackendTicket silently defaulting to
// "Backlog" when it doesn't have a matching status in its list yet.
export function looksLikeUuid(value: string): boolean {
  return UUID_RE.test(value);
}

// Kept for backward compatibility / callers that just need "some non-empty
// name or Backlog" without id resolution. mapBackendTicket below no longer
// uses this directly — see resolveTicketStatus.
export function normalizeStatus(raw: string | null | undefined): TicketStatus {
  const trimmed = raw?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "Backlog";
}

export function normalizePriority(raw: string | null | undefined): Priority {
  if (raw && (KNOWN_PRIORITIES as string[]).includes(raw)) return raw as Priority;
  return "Medium";
}

// Minimal shape of one item from the backend's tickets array — only the
// fields we actually read are typed, everything else is ignored.
//
// Status shape: ticket creation sends `status_id` (a UUID), so GET /tickets
// may return the status as a flat name string, a flat UUID, a
// `status_id`/`statusId` foreign key, or a joined `statuses` relation
// object. All of these are typed here and resolveTicketStatus() below reads
// across all of them defensively.
export interface BackendTicket {
  id: string;
  ticket_number?: string;
  title: string;
  description?: string;
  status?: string;
  status_id?: string;
  statusId?: string;
  statuses?: { id?: string; name?: string; color?: string } | null;
  priority?: string;
  project_id: string;
  created_at?: string;
  updated_at?: string;
  due_date?: string | null;
  assigned_to?: string | null;
  users_tickets_assigned_toTousers?: { id: string; name: string; email: string } | null;
  users_tickets_created_byTousers?: { id: string; name: string; email: string } | null;
  comments?: Array<{ id: string; user_id: string; comment_text: string; created_at: string }>;
  attachments?: Array<{ id: string; file_name: string }>;
}

// Resolves a ticket's status to a display name, checked in this order:
//  1. A joined `statuses` relation object (e.g. `{ id, name, color }`) —
//     preferred since it's unambiguous.
//  2. A `status_id` / `statusId` field, OR a `status` field that looks like
//     a raw UUID — resolved against `statusList` (from GET /api/statuses,
//     see lib/statusesApi.ts) to find the matching name.
//  3. A `status` field that does NOT look like a UUID — used directly as
//     the name.
// Falls back to "Backlog" only when nothing usable was found (e.g. the
// status list hasn't loaded yet and we can't resolve an id) — callers
// should call ensureStatusesLoaded() first to minimize this happening.
export function resolveTicketStatus(raw: BackendTicket, statusList: Status[] = []): TicketStatus {
  if (raw.statuses?.name) return raw.statuses.name;

  const idCandidate =
    raw.status_id ?? raw.statusId ?? (raw.status && looksLikeUuid(raw.status) ? raw.status : undefined);

  if (idCandidate) {
    const match = statusList.find((s) => s.id === idCandidate);
    if (match) return match.name;
    // eslint-disable-next-line no-console
    console.warn(
      "Ticket has a status id that doesn't match any loaded status (statuses may still be loading):",
      idCandidate
    );
  }

  if (raw.status && !looksLikeUuid(raw.status)) return raw.status;

  return "Backlog";
}

export function mapBackendTicket(raw: BackendTicket, statusList: Status[] = []): Ticket {
  return {
    id: raw.id,
    ticketNumber: raw.ticket_number,
    title: raw.title,
    category: "",
    priority: normalizePriority(raw.priority),
    status: resolveTicketStatus(raw, statusList),
    assignee: raw.users_tickets_assigned_toTousers?.name || "Unassigned",
    assignedToId: raw.assigned_to ?? null,
    reporter: raw.users_tickets_created_byTousers?.name || "Unknown",
    createdAt: raw.created_at ? new Date(raw.created_at).toLocaleString() : "",
    updatedAt: raw.updated_at ? new Date(raw.updated_at).toLocaleString() : "",
    description: raw.description || "",
    comments: (raw.comments || []).map((c) => ({
      id: c.id,
      author:
        c.user_id === raw.users_tickets_created_byTousers?.id
          ? raw.users_tickets_created_byTousers?.name || "User"
          : c.user_id === raw.users_tickets_assigned_toTousers?.id
          ? raw.users_tickets_assigned_toTousers?.name || "User"
          : "User",
      text: c.comment_text,
      timestamp: new Date(c.created_at).toLocaleString(),
    })),
    attachments: (raw.attachments || []).map((a) => ({
      id: a.id,
      name: a.file_name,
      size: "",
    })),
    workLog: [],
    estimatedTime: "-",
    timeSpent: "-",
    remaining: "-",
  };
}

export interface Comment {
  id: string;
  author: string;
  text: string;
  timestamp: string;
}

export interface Attachment {
  id: string;
  name: string;
  size: string;
  commentId?: string | null;
}

export interface WorkLogEntry {
  date: string;
  duration: string;
  details: string;
}

// ---- Duration helpers ("3h 00m" <-> minutes) ----
export function parseDurationToMinutes(value: string): number {
  if (!value) return 0;
  const hMatch = value.match(/(\d+)\s*h/i);
  const mMatch = value.match(/(\d+)\s*m/i);
  const hours = hMatch ? parseInt(hMatch[1], 10) : 0;
  const minutes = mMatch ? parseInt(mMatch[1], 10) : 0;
  return hours * 60 + minutes;
}

export function formatMinutesToDuration(totalMinutes: number): string {
  const clamped = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

export interface Project {
  id: string;
  name: string;
  category: string;
  ticketCount: number;
  lastUpdated: string;
  status: ProjectStatus;
  tickets: Ticket[];
}

export const MOCK_PROJECTS: Project[] = [
  {
    id: "my_team",
    name: "my_team",
    category: "IT Support",
    ticketCount: 32,
    lastUpdated: "16 May 2024",
    status: "In Progress",
    tickets: [
      {
        id: "TKT1001",
        title: "Can't Login to Portal",
        category: "IT Support",
        priority: "High",
        status: "Backlog",
        assignee: "Unassigned",
        reporter: "Alice",
        createdAt: "10 May 2024, 10:30 AM",
        updatedAt: "16 May 2024, 11:15 AM",
        description: "I am unable to login to the employee portal. It shows an error message saying invalid credentials even though I reset my password.",
        comments: [
          { id: "c1", author: "John Doe", text: "We are looking into this issue.", timestamp: "10 May 2024, 10:45 AM" },
          { id: "c2", author: "Jane Smith", text: "Please try resetting your password and login again.", timestamp: "16 May 2024, 11:00 AM" },
        ],
        attachments: [
          { id: "a1", name: "error_screenshot.png", size: "2.4 MB" },
          { id: "a2", name: "login_error_log.txt", size: "1.2 MB" },
        ],
        workLog: [
          { date: "16 May, 11:15", duration: "30m", details: "Checked login logs" },
          { date: "16 May, 10:45", duration: "45m", details: "Investigating error" },
        ],
        estimatedTime: "2h 00m",
        timeSpent: "1h 15m",
        remaining: "0h 45m",
      },
      { id: "TKT1002", title: "VPN Connection Issue", category: "Network", priority: "Medium", status: "Backlog", assignee: "Unassigned", reporter: "Bob", createdAt: "11 May 2024, 9:00 AM", updatedAt: "12 May 2024, 3:00 PM", description: "VPN keeps disconnecting every 10 minutes.", comments: [], attachments: [], workLog: [], estimatedTime: "1h 00m", timeSpent: "0h 20m", remaining: "0h 40m" },
      { id: "TKT1003", title: "Email Not Working", category: "IT Support", priority: "High", status: "To Do", assignee: "Emily Davis", reporter: "Carol", createdAt: "11 May 2024", updatedAt: "13 May 2024", description: "Outlook not syncing emails.", comments: [], attachments: [], workLog: [], estimatedTime: "1h 30m", timeSpent: "0h 00m", remaining: "1h 30m" },
      { id: "TKT1004", title: "Printer Not Working", category: "Hardware", priority: "Medium", status: "To Do", assignee: "John Doe", reporter: "Dan", createdAt: "12 May 2024", updatedAt: "14 May 2024", description: "Office printer throwing paper jam error.", comments: [], attachments: [], workLog: [], estimatedTime: "0h 30m", timeSpent: "0h 00m", remaining: "0h 30m" },
      { id: "TKT1005", title: "Software Installation", category: "Software", priority: "Low", status: "To Do", assignee: "Jane Smith", reporter: "Eve", createdAt: "12 May 2024", updatedAt: "14 May 2024", description: "Need Adobe Creative Suite installed on workstation.", comments: [], attachments: [], workLog: [], estimatedTime: "1h 00m", timeSpent: "0h 00m", remaining: "1h 00m" },
      { id: "TKT1006", title: "Page Loading Slow", category: "Network", priority: "Medium", status: "In Progress", assignee: "Mike Johnson", reporter: "Frank", createdAt: "13 May 2024", updatedAt: "15 May 2024", description: "Intranet pages loading very slowly.", comments: [], attachments: [], workLog: [], estimatedTime: "2h 00m", timeSpent: "0h 45m", remaining: "1h 15m" },
      { id: "TKT1007", title: "Unable to Upload File", category: "Software", priority: "High", status: "In Progress", assignee: "Emily Davis", reporter: "Grace", createdAt: "13 May 2024", updatedAt: "16 May 2024", description: "File upload to SharePoint failing with 413 error.", comments: [], attachments: [], workLog: [], estimatedTime: "1h 30m", timeSpent: "1h 00m", remaining: "0h 30m" },
      { id: "TKT1008", title: "System Error Message", category: "IT Support", priority: "High", status: "In Progress", assignee: "John Doe", reporter: "Henry", createdAt: "14 May 2024", updatedAt: "16 May 2024", description: "Random BSOD on workstation #24.", comments: [], attachments: [], workLog: [], estimatedTime: "3h 00m", timeSpent: "1h 30m", remaining: "1h 30m" },
      { id: "TKT1009", title: "Network Issue", category: "Network", priority: "Medium", status: "Review", assignee: "Mike Johnson", reporter: "Iris", createdAt: "14 May 2024", updatedAt: "16 May 2024", description: "Intermittent packet loss on floor 3.", comments: [], attachments: [], workLog: [], estimatedTime: "2h 00m", timeSpent: "1h 45m", remaining: "0h 15m" },
      { id: "TKT1010", title: "Password Reset Request", category: "IT Support", priority: "Low", status: "Review", assignee: "Mike Johnson", reporter: "Jack", createdAt: "15 May 2024", updatedAt: "16 May 2024", description: "User locked out, needs password reset.", comments: [], attachments: [], workLog: [], estimatedTime: "0h 15m", timeSpent: "0h 10m", remaining: "0h 05m" },
      { id: "TKT1011", title: "Monitor Display Issue", category: "Hardware", priority: "Medium", status: "Done", assignee: "Emily Davis", reporter: "Karen", createdAt: "10 May 2024", updatedAt: "13 May 2024", description: "Second monitor flickering.", comments: [], attachments: [], workLog: [], estimatedTime: "1h 00m", timeSpent: "0h 45m", remaining: "0h 00m" },
      { id: "TKT1012", title: "Account Locked", category: "IT Support", priority: "Low", status: "Done", assignee: "John Doe", reporter: "Leo", createdAt: "10 May 2024", updatedAt: "12 May 2024", description: "User account locked after failed attempts.", comments: [], attachments: [], workLog: [], estimatedTime: "0h 20m", timeSpent: "0h 15m", remaining: "0h 00m" },
      { id: "TKT1013", title: "Report Generation", category: "Software", priority: "Low", status: "Done", assignee: "Jane Smith", reporter: "Mia", createdAt: "11 May 2024", updatedAt: "14 May 2024", description: "Monthly report export timing out.", comments: [], attachments: [], workLog: [], estimatedTime: "2h 00m", timeSpent: "1h 30m", remaining: "0h 00m" },
    ],
  },
  {
    id: "dev_ops",
    name: "dev_ops",
    category: "Network",
    ticketCount: 21,
    lastUpdated: "15 May 2024",
    status: "Active",
    tickets: [
      { id: "TKT2001", title: "CI Pipeline Failing", category: "DevOps", priority: "High", status: "In Progress", assignee: "Alex Chen", reporter: "Nina", createdAt: "14 May 2024", updatedAt: "15 May 2024", description: "Build pipeline failing on main branch.", comments: [], attachments: [], workLog: [], estimatedTime: "3h 00m", timeSpent: "1h 00m", remaining: "2h 00m" },
      { id: "TKT2002", title: "Server Disk 90% Full", category: "Infrastructure", priority: "High", status: "To Do", assignee: "Unassigned", reporter: "Oscar", createdAt: "15 May 2024", updatedAt: "15 May 2024", description: "Production server disk usage critical.", comments: [], attachments: [], workLog: [], estimatedTime: "1h 00m", timeSpent: "0h 00m", remaining: "1h 00m" },
      { id: "TKT2003", title: "Load Balancer Config", category: "Network", priority: "Medium", status: "Review", assignee: "Sarah Park", reporter: "Paul", createdAt: "13 May 2024", updatedAt: "15 May 2024", description: "Review load balancer rules for new region.", comments: [], attachments: [], workLog: [], estimatedTime: "2h 00m", timeSpent: "1h 45m", remaining: "0h 15m" },
    ],
  },
  {
    id: "design_team",
    name: "design_team",
    category: "Software",
    ticketCount: 18,
    lastUpdated: "14 May 2024",
    status: "Active",
    tickets: [
      { id: "TKT3001", title: "Figma Plugin Error", category: "Software", priority: "Medium", status: "To Do", assignee: "Lisa Wong", reporter: "Quinn", createdAt: "13 May 2024", updatedAt: "14 May 2024", description: "Auto-layout plugin crashing on large frames.", comments: [], attachments: [], workLog: [], estimatedTime: "1h 00m", timeSpent: "0h 00m", remaining: "1h 00m" },
      { id: "TKT3002", title: "Asset Library Access", category: "Software", priority: "Low", status: "Done", assignee: "Tom Ray", reporter: "Rose", createdAt: "12 May 2024", updatedAt: "13 May 2024", description: "Need access to shared brand asset library.", comments: [], attachments: [], workLog: [], estimatedTime: "0h 30m", timeSpent: "0h 15m", remaining: "0h 00m" },
    ],
  },
  {
    id: "qa_team",
    name: "qa_team",
    category: "Hardware",
    ticketCount: 14,
    lastUpdated: "13 May 2024",
    status: "Active",
    tickets: [
      { id: "TKT4001", title: "Test Environment Down", category: "Infrastructure", priority: "High", status: "In Progress", assignee: "James Lee", reporter: "Sam", createdAt: "13 May 2024", updatedAt: "13 May 2024", description: "Staging environment not reachable.", comments: [], attachments: [], workLog: [], estimatedTime: "2h 00m", timeSpent: "0h 30m", remaining: "1h 30m" },
    ],
  },
];

export function getProject(id: string): Project | undefined {
  return MOCK_PROJECTS.find((p) => p.id === id);
}

export function getTicket(projectId: string, ticketId: string): Ticket | undefined {
  const project = getProject(projectId);
  return project?.tickets.find((t) => t.id === ticketId);
}

export const PRIORITY_COLORS: Record<Priority, string> = {
  Critical: "bg-purple-100 text-purple-700 border-purple-200",
  High: "bg-red-100 text-red-700 border-red-200",
  Medium: "bg-amber-100 text-amber-700 border-amber-200",
  Low: "bg-green-100 text-green-700 border-green-200",
};

// Fallback palette used only before /api/statuses has loaded, or if that
// call fails — keeps the board looking right instead of blank/unstyled.
export const STATUS_COLORS: Record<string, string> = {
  Backlog: "bg-slate-100 text-slate-600",
  "To Do": "bg-blue-100 text-blue-700",
  "In Progress": "bg-violet-100 text-violet-700",
  Review: "bg-amber-100 text-amber-700",
  Done: "bg-emerald-100 text-emerald-700",
};

export const KANBAN_COLUMNS: TicketStatus[] = ["Backlog", "To Do", "In Progress", "Review", "Done"];

// Statuses now come from the backend with an arbitrary hex color (e.g.
// "#00FF00"), which Tailwind's static class scanning can't pick up — so
// badges/pills for real (non-fallback) statuses are styled inline instead
// of via STATUS_COLORS. Given a hex color, this returns a soft tinted
// background + the color itself for text, readable on light backgrounds.
export function statusColorStyle(hex: string | undefined): CSSProperties {
  const color = hex && /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#94a3b8";
  return {
    backgroundColor: `${color}22`, // ~13% opacity tint
    color,
    borderColor: `${color}55`,
  };
}

export const TREND_DATA = [
  { day: "10 May", tickets: 4 },
  { day: "11", tickets: 7 },
  { day: "12", tickets: 5 },
  { day: "13", tickets: 9 },
  { day: "14", tickets: 6 },
  { day: "15", tickets: 11 },
  { day: "16", tickets: 8 },
];

export const CATEGORY_DATA = [
  { name: "IT Support", value: 40, color: "#6366f1" },
  { name: "Network", value: 20, color: "#8b5cf6" },
  { name: "Software", value: 20, color: "#a78bfa" },
  { name: "Hardware", value: 10, color: "#c4b5fd" },
  { name: "Others", value: 10, color: "#ddd6fe" },
];