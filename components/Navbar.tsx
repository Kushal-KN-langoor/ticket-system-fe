"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppStore";
import { useAppSelector, useAppDispatch } from "@/lib/redux/hooks";
import { logout as logoutAction } from "@/lib/redux/slices/authSlice";
import { Ticket } from "@/lib/data";

interface NavbarProps {
  showDashboardBtn?: boolean;
  breadcrumb?: string;
  showSearch?: boolean;
  searchPlaceholder?: string;
  projectTickets?: Ticket[];
  projectId?: string;
}

export default function Navbar({
  showDashboardBtn = false,
  breadcrumb,
  showSearch = true,
  searchPlaceholder = "Search...",
  projectTickets = [],
  projectId = "",
}: NavbarProps) {
  const { projects, updateUserName } = useApp(); // still old context (unchanged for now)
  const user = useAppSelector((state) => state.auth.user); // new Redux
  const dispatch = useAppDispatch();
  const router = useRouter();
  const [userOpen, setUserOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; title: string; projectId: string }[]>([]);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  const handleLogout = () => {
    dispatch(logoutAction());
    router.push("/");
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchResults([]);
        setSearchQuery("");
        setMobileSearchOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (editingName) {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }
  }, [editingName]);

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }

    const lower = q.toLowerCase();
    const results: { id: string; title: string; projectId: string }[] = [];

    if (projectTickets.length > 0) {
      projectTickets.forEach((t) => {
        if (t.id.toLowerCase().includes(lower) || t.title.toLowerCase().includes(lower)) {
          results.push({ id: t.id, title: t.title, projectId });
        }
      });
    } else {
      projects.forEach((proj) => {
        proj.tickets.forEach((t) => {
          if (t.id.toLowerCase().includes(lower) || t.title.toLowerCase().includes(lower)) {
            results.push({ id: t.id, title: t.title, projectId: proj.id });
          }
        });
      });
    }

    setSearchResults(results.slice(0, 6));
  };

  // Short, readable token for display instead of the full UUID —
  // e.g. "7b50d435" from "7b50d435-ecc4-42f8-bdf4-21d50c588fdd".
  const shortToken = (id: string) => id.split("-")[0].toUpperCase();

  const startEditName = () => {
    setNameInput(user?.name || "");
    setEditingName(true);
  };

  const cancelEditName = () => {
    setEditingName(false);
    setNameInput("");
  };

  const saveEditName = () => {
    if (nameInput.trim() && nameInput.trim() !== user?.name) {
      updateUserName(nameInput.trim());
    }
    setEditingName(false);
    setNameInput("");
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") saveEditName();
    if (e.key === "Escape") cancelEditName();
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-6 h-14 relative">

        <Link href="/dashboard" className="flex items-center gap-2 font-bold text-violet-700 text-lg shrink-0">
          <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center text-white text-sm font-bold">H</div>
          <span className="hidden sm:inline">HelpDesk Pro</span>
        </Link>

        {showDashboardBtn && (
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 border border-slate-300 rounded-lg px-2 sm:px-3 py-1.5 hover:bg-slate-50 transition-colors shrink-0"
          >
            <i className="fi fi-rr-apps text-sm"></i>
            <span className="hidden sm:inline">Dashboard</span>
          </Link>
        )}

        {breadcrumb && (
          <span className="text-sm text-slate-400 font-medium truncate max-w-[80px] sm:max-w-none">
            {breadcrumb}
          </span>
        )}

        <div className="flex-1" />

        {showSearch && (
          <>
            {/* Mobile: icon button that toggles the search bar */}
            <button
              onClick={() => setMobileSearchOpen((v) => !v)}
              className="sm:hidden flex items-center justify-center p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
            >
              <i className={`fi ${mobileSearchOpen ? "fi-rr-cross" : "fi-rr-search"} text-sm`}></i>
            </button>

            {/* Search box: inline on sm+, dropdown panel on mobile when toggled open */}
            <div
              ref={searchRef}
              className={`
                items-center
                sm:relative sm:flex sm:w-auto sm:top-auto sm:left-auto sm:right-auto sm:px-0 sm:border-0 sm:shadow-none sm:bg-transparent
                ${mobileSearchOpen
                  ? "flex absolute left-0 right-0 top-14 px-3 py-2 z-50 bg-white border-b border-slate-200 shadow-lg"
                  : "hidden"}
              `}
            >
              <div className="relative w-full sm:w-52">
                <i className="fi fi-rr-search text-sm absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10"></i>
                <input
                  type="text"
                  name="ticket-search"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder={searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  autoFocus={mobileSearchOpen}
                  className="pl-8 pr-4 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400"
                />

                {searchResults.length > 0 && (
                  <div className="absolute top-10 left-0 right-0 sm:left-auto sm:right-0 sm:w-80 bg-white border border-slate-200 rounded-xl shadow-xl shadow-slate-200 z-50 py-1 overflow-hidden">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-4 py-2">
                      Tickets
                    </p>
                    {searchResults.map((r) => (
                      <Link
                        key={r.id}
                        href={`/project/${r.projectId}/ticket/${r.id}`}
                        onClick={() => {
                          setSearchQuery("");
                          setSearchResults([]);
                          setMobileSearchOpen(false);
                        }}
                        className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-violet-50 transition-colors"
                      >
                        <span className="text-sm text-slate-700 font-medium truncate">{r.title}</span>
                        <span className="font-mono text-violet-600 font-bold text-[10px] shrink-0">
                          #{shortToken(r.id)}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}

                {searchQuery.trim() && searchResults.length === 0 && (
                  <div className="absolute top-10 left-0 right-0 sm:left-auto sm:right-0 sm:w-80 bg-white border border-slate-200 rounded-xl shadow-xl shadow-slate-200 z-50 py-4 text-center">
                    <p className="text-sm text-slate-400">No tickets found for &quot;{searchQuery}&quot;</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        <div className="relative shrink-0" ref={userMenuRef}>
          <button
            onClick={() => setUserOpen(!userOpen)}
            className="flex items-center gap-2 p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <div className="w-7 h-7 bg-violet-100 rounded-full flex items-center justify-center text-xs font-bold text-violet-700">
              {user ? user.name[0].toUpperCase() : <i className="fi fi-rr-user text-sm"></i>}
            </div>
          </button>

          {userOpen && (
            <div className="absolute right-0 top-11 bg-white border border-slate-200 rounded-xl shadow-xl shadow-slate-200 py-2 z-50 w-56">
              {user && (
                <div className="px-4 py-2 border-b border-slate-100 mb-1">

                  {editingName ? (
                    <div className="flex items-center gap-1 mb-0.5">
                      <input
                        ref={nameInputRef}
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        onKeyDown={handleNameKeyDown}
                        className="text-sm font-semibold text-slate-800 border border-violet-300 rounded px-1.5 py-0.5 w-full focus:outline-none focus:ring-1 focus:ring-violet-400"
                        maxLength={40}
                      />
                      <button
                        onClick={saveEditName}
                        className="text-violet-600 hover:text-violet-800 shrink-0"
                        title="Save (Enter)"
                      >
                        <i className="fi fi-rr-check text-sm"></i>
                      </button>
                      <button
                        onClick={cancelEditName}
                        className="text-slate-400 hover:text-slate-600 shrink-0"
                        title="Cancel (Esc)"
                      >
                        <i className="fi fi-rr-cross text-sm"></i>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 mb-0.5 group">
                      <p className="text-sm font-semibold text-slate-800 truncate">{user.name}</p>
                      <button
                        onClick={startEditName}
                        className="text-slate-300 hover:text-violet-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        title="Edit name"
                      >
                        <i className="fi fi-rr-pencil text-xs"></i>
                      </button>
                    </div>
                  )}

                  <p className="text-xs text-slate-400">{user.email}</p>
                  <p className="text-xs text-violet-600 font-medium mt-0.5">{user.role}</p>
                </div>
              )}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 text-left text-sm text-red-600 hover:bg-red-50 px-4 py-2 transition-colors"
              >
                <i className="fi fi-rr-sign-out-alt text-sm"></i> Sign Out
              </button>
            </div>
          )}
        </div>

      </div>
    </header>
  );
}