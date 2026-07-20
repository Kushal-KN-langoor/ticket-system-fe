import { apiClient } from "./apiClient";

// Ticket statuses are PER-PROJECT on the backend (confirmed via Postman):
//   GET    /api/statuses/:projectId          -> list all statuses for a project
//   POST   /api/statuses/:projectId          -> create a status for a project
//                                                (backend generates the status id,
//                                                 assigns `position`, `created_at`)
//   PATCH  /api/statuses/:statusId           -> update a status (name and/or color)
//   DELETE /api/statuses/:statusId           -> delete a status
//
// NOTE: the PATCH/DELETE URL shape (status id only vs /:projectId/:statusId) is
// NOT yet confirmed against Postman — if either of those 404s, that's the first
// thing to check.

export interface Status {
  id: string;
  name: string;
  color: string; // hex, e.g. "#f39c12"
  projectId?: string;
  position?: number;
}

const DEFAULT_COLOR = "#94a3b8"; // slate-400, used when the backend omits color

const DEFAULT_STATUSES: Array<{ name: string; color: string }> = [
  { name: "Backlog", color: "#94a3b8" },
  { name: "To Do", color: "#3b82f6" },
  { name: "In Progress", color: "#8b5cf6" },
  { name: "Review", color: "#f59e0b" },
  { name: "Done", color: "#10b981" },
];

function normalizeStatus(raw: Record<string, unknown>): Status {
  return {
    id: String(raw.id ?? raw._id ?? ""),
    name: String(raw.name ?? raw.title ?? ""),
    color: String(raw.color ?? raw.colour ?? DEFAULT_COLOR),
    projectId: raw.project_id ? String(raw.project_id) : undefined,
    position: typeof raw.position === "number" ? raw.position : undefined,
  };
}

function normalizeStatusList(payload: unknown): Status[] {
  let list: unknown[] = [];
  if (Array.isArray(payload)) {
    list = payload;
  } else if (payload && typeof payload === "object") {
    const obj = payload as { statuses?: unknown; data?: unknown; statusData?: unknown };
    if (Array.isArray(obj.statuses)) list = obj.statuses;
    else if (Array.isArray(obj.data)) list = obj.data;
    else if (Array.isArray(obj.statusData)) list = obj.statusData;
  }
  return (list as Record<string, unknown>[]).filter((s) => s && s.id).map(normalizeStatus);
}

// Creates the 5 default statuses on the backend for a project, the first
// time this runs for a project with none saved yet.
async function seedDefaults(projectId: string): Promise<Status[]> {
  const seeded: Status[] = [];
  for (const d of DEFAULT_STATUSES) {
    try {
      const res = await apiClient.post(`/statuses/${projectId}`, { name: d.name, color: d.color });
      const body = res.data as Record<string, unknown> | undefined;
      const returned = (body?.statusData ?? body?.status ?? body) as Record<string, unknown> | undefined;
      seeded.push(
        returned?.id ? normalizeStatus(returned) : { id: "", name: d.name, color: d.color, projectId }
      );
    } catch (err) {
      console.warn(`Could not create default status "${d.name}" on backend:`, err);
    }
  }
  return seeded.filter((s) => s.id);
}

export async function fetchStatuses(projectId: string): Promise<Status[]> {
  if (!projectId) return [];
  try {
    const res = await apiClient.get(`/statuses/${projectId}`);
    const list = normalizeStatusList(res.data);
    if (list.length > 0) return list;
  } catch (err) {
    console.warn(`Could not fetch statuses for project "${projectId}":`, err);
  }

  // Nothing saved yet for this project — seed the defaults so the board
  // has something to show and "Manage Statuses" isn't empty.
  return seedDefaults(projectId);
}

export async function createStatus(projectId: string, name: string, color: string): Promise<Status> {
  const res = await apiClient.post(`/statuses/${projectId}`, { name, color });
  const body = res.data as Record<string, unknown> | undefined;
  const returned = (body?.statusData ?? body?.status ?? body) as Record<string, unknown> | undefined;
  if (!returned?.id) throw new Error("Backend did not return a created status.");
  return normalizeStatus(returned);
}

// NOT YET CONFIRMED against Postman — check GET STATUS / PATCH STATUS /
// DELETE STATUS requests in the collection if these 404.
export async function updateStatus(
  statusId: string,
  updates: Partial<Pick<Status, "name" | "color">>
): Promise<Status> {
  const res = await apiClient.patch(`/statuses/${statusId}`, updates);
  const body = res.data as Record<string, unknown> | undefined;
  const returned = (body?.statusData ?? body?.status ?? body) as Record<string, unknown> | undefined;
  if (!returned?.id) throw new Error("Backend did not return an updated status.");
  return normalizeStatus(returned);
}

export async function deleteStatus(statusId: string): Promise<void> {
  await apiClient.delete(`/statuses/${statusId}`);
}