"use client";

import { useEffect, useState, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import SummaryTab from "@/components/SummaryTab";
import KanbanBoard from "@/components/KanbanBoard";
import { useApp } from "@/context/AppStore";
import { useAppSelector } from "@/lib/redux/hooks";

type Tab = "Summary" | "Board";

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { projects } = useApp();
  const user = useAppSelector((state) => state.auth.user); // new Redux
  const router = useRouter();
  const searchParams = useSearchParams();

  const tabParam = searchParams.get("tab") as Tab | null;
  const [activeTab, setActiveTab] = useState<Tab>(tabParam === "Board" ? "Board" : "Summary");

  useEffect(() => {
    if (!user) {
      router.replace("/");
    }
  }, [user, router]);

  if (!user) {
    return null;
  }

  const project = projects.find((p) => p.id === id);
  if (!project) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 mb-4">Project not found.</p>
          <Link href="/dashboard" className="text-violet-600 hover:underline text-sm">← Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const open = project.tickets.filter((t) => t.status === "Backlog" || t.status === "To Do").length;
  const inProgress = project.tickets.filter((t) => t.status === "In Progress").length;
  const resolved = project.tickets.filter((t) => t.status === "Done").length;

  const tabs: Tab[] = ["Summary", "Board"];

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar
        showDashboardBtn
        breadcrumb={`/ ${project.name}`}
        searchPlaceholder="Search tickets..."
        projectTickets={project.tickets}
        projectId={project.id}
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="bg-white border border-slate-200 rounded-xl px-4 sm:px-5 py-4 mb-5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-900 truncate">{project.name}</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {project.ticketCount} tickets
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/create-ticket?project=${project.id}`}
              className="flex items-center gap-1.5 text-sm font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-3 py-1.5 transition-colors shadow-sm shadow-violet-200"
            >
              <i className="fi fi-rr-plus text-sm"></i>
              <span className="hidden sm:inline">Create Ticket</span>
            </Link>
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
            total={project.ticketCount}
            open={open}
            inProgress={inProgress}
            resolved={resolved}
          />
        )}
        {activeTab === "Board" && <KanbanBoard tickets={project.tickets} projectId={project.id} />}
      </main>
    </div>
  );
}