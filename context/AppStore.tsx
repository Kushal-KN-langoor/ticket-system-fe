"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { Project, Ticket, MOCK_PROJECTS, Priority, TicketStatus } from "@/lib/data";

// ---- Auth types ----
export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: string;
}

// ---- Context shape ----
interface AppContextType {
  currentUser: User | null;
  users: User[];
  login: (email: string, password: string) => { ok: boolean; error?: string };
  signup: (name: string, email: string, password: string, role: string) => { ok: boolean; error?: string };
  logout: () => void;
  updateUserName: (newName: string) => void;

  projects: Project[];
  createProject: (name: string, category: string) => Project;
  createTicket: (
    projectId: string,
    data: {
      title: string;
      category: string;
      description: string;
      priority: Priority;
      assignee: string;
    }
  ) => Ticket;
  updateTicketStatus: (projectId: string, ticketId: string, status: TicketStatus) => void;
  addComment: (projectId: string, ticketId: string, text: string) => void;
}

const AppContext = createContext<AppContextType | null>(null);

// ---- Server-backed JSON storage (replaces localStorage) ----
// Data lives in JSON files on the server (see /data/*.json), read and
// written through these tiny API routes instead of the browser's storage.
async function apiGet<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

async function apiPut(path: string, value: unknown): Promise<void> {
  try {
    await fetch(path, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
  } catch {
    // Network/server hiccup — data simply won't persist for this change.
  }
}

const DEMO_USER: User = {
  id: "demo_1",
  name: "Demo User",
  email: "demo@helpdesk.com",
  password: "demo1234",
  role: "Admin",
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<User[]>([DEMO_USER]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>(MOCK_PROJECTS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const storedUsers = await apiGet<User[]>("/api/users", [DEMO_USER]);
      const hasdemo = storedUsers.some((u) => u.email === DEMO_USER.email);
      const allUsers = hasdemo ? storedUsers : [DEMO_USER, ...storedUsers];

      const storedProjects = await apiGet<Project[]>("/api/projects", MOCK_PROJECTS);
      const session = await apiGet<{ currentUser: User | null }>("/api/session", {
        currentUser: null,
      });

      if (cancelled) return;

      setUsers(allUsers);
      setProjects(storedProjects);
      if (session.currentUser) {
        const found = allUsers.find((u) => u.id === session.currentUser!.id);
        setCurrentUser(found || null);
      }
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (hydrated) apiPut("/api/projects", projects);
  }, [projects, hydrated]);

  useEffect(() => {
    if (hydrated) apiPut("/api/users", users);
  }, [users, hydrated]);

  const login = useCallback(
    (email: string, password: string): { ok: boolean; error?: string } => {
      const found = users.find(
        (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
      );
      if (!found) {
        return { ok: false, error: "Invalid email or password." };
      }
      setCurrentUser(found);
      apiPut("/api/session", { currentUser: found });
      return { ok: true };
    },
    [users]
  );

  const signup = useCallback(
    (name: string, email: string, password: string, role: string): { ok: boolean; error?: string } => {
      const exists = users.some((u) => u.email.toLowerCase() === email.toLowerCase());
      if (exists) return { ok: false, error: "An account with this email already exists." };
      const newUser: User = {
        id: `user_${Date.now()}`,
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password,
        role,
      };
      const updated = [...users, newUser];
      setUsers(updated);
      apiPut("/api/users", updated);
      setCurrentUser(newUser);
      apiPut("/api/session", { currentUser: newUser });
      return { ok: true };
    },
    [users]
  );

  const logout = useCallback(() => {
    setCurrentUser(null);
    apiPut("/api/session", { currentUser: null });
  }, []);

  const updateUserName = useCallback(
    (newName: string) => {
      if (!currentUser) return;
      const updated = { ...currentUser, name: newName.trim() };
      setCurrentUser(updated);
      apiPut("/api/session", { currentUser: updated });
      setUsers((prev) =>
        prev.map((u) => (u.id === currentUser.id ? updated : u))
      );
    },
    [currentUser]
  );

  const createProject = useCallback(
    (name: string, category: string): Project => {
      const slug = name.trim().toLowerCase().replace(/\s+/g, "_");
      const newProject: Project = {
        id: `${slug}_${Date.now()}`,
        name: name.trim(),
        category,
        ticketCount: 0,
        lastUpdated: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
        status: "In Progress",
        tickets: [],
      };
      setProjects((prev) => [newProject, ...prev]);
      return newProject;
    },
    []
  );

  const createTicket = useCallback(
    (
      projectId: string,
      data: { title: string; category: string; description: string; priority: Priority; assignee: string }
    ): Ticket => {
      const project = projects.find((p) => p.id === projectId);
      const prefix = project
        ? `TKT${(project.id.charCodeAt(0) % 9) + 1}`
        : "TKT";
      const id = `${prefix}${Date.now().toString().slice(-4)}`;
      const now = new Date().toLocaleString();
      const newTicket: Ticket = {
        id,
        title: data.title,
        category: data.category,
        priority: data.priority,
        status: "Backlog",
        assignee: data.assignee || "Unassigned",
        reporter: currentUser?.name || "Unknown",
        createdAt: now,
        updatedAt: now,
        description: data.description,
        comments: [],
        attachments: [],
        workLog: [],
        estimatedTime: "—",
        timeSpent: "0h 00m",
        remaining: "—",
      };
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? { ...p, ticketCount: p.ticketCount + 1, tickets: [...p.tickets, newTicket] }
            : p
        )
      );
      return newTicket;
    },
    [projects, currentUser]
  );

  const updateTicketStatus = useCallback(
    (projectId: string, ticketId: string, status: TicketStatus) => {
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? {
                ...p,
                tickets: p.tickets.map((t) =>
                  t.id === ticketId ? { ...t, status, updatedAt: new Date().toLocaleString() } : t
                ),
              }
            : p
        )
      );
    },
    []
  );

  const addComment = useCallback(
    (projectId: string, ticketId: string, text: string) => {
      const author = currentUser?.name || "You";
      const newComment = {
        id: `c${Date.now()}`,
        author,
        text,
        timestamp: new Date().toLocaleString(),
      };
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? {
                ...p,
                tickets: p.tickets.map((t) =>
                  t.id === ticketId ? { ...t, comments: [...t.comments, newComment] } : t
                ),
              }
            : p
        )
      );
    },
    [currentUser]
  );

  return (
    <AppContext.Provider
      value={{
        currentUser,
        users,
        login,
        signup,
        logout,
        updateUserName,
        projects,
        createProject,
        createTicket,
        updateTicketStatus,
        addComment,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}