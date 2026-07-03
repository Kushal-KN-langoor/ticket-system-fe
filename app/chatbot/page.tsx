"use client";

import { useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";

const SUGGESTIONS = [
  "Can't Login",
  "Can't Sign In",
  "Password Reset Issue",
  "Account Locked",
  "Login Page Not Loading",
  "VPN Connection Problem",
  "Email Not Working",
  "Printer Issue",
];

const SOLUTIONS: Record<string, string[]> = {
  "Can't Login": [
    "Clear your browser cache and cookies.",
    "Ensure you are using the correct portal URL.",
    "Try resetting your password using 'Forgot Password'.",
    "Disable browser extensions and try again.",
    "If the issue persists, contact support.",
  ],
  "Password Reset Issue": [
    "Check your spam/junk folder for the reset email.",
    "Ensure the email address is correct.",
    "The reset link expires in 15 minutes — request a new one.",
    "If you still can't reset, contact IT support.",
  ],
  "Account Locked": [
    "Wait 15 minutes for the lock to automatically lift.",
    "Use the self-service unlock option in the portal.",
    "Contact your IT admin for immediate unlock.",
  ],
  "VPN Connection Problem": [
    "Restart the VPN client application.",
    "Check your internet connection.",
    "Try a different VPN server.",
    "Reinstall the VPN client if the issue persists.",
  ],
};

interface Message {
  id: string;
  from: "bot" | "user";
  text: string;
}

export default function ChatbotPage() {
  const [query, setQuery] = useState("");
  const [activeSuggestion, setActiveSuggestion] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    { id: "0", from: "bot", text: "Hi! How can I help you today? Type your issue below or choose from the quick suggestions." },
  ]);
  const [solved, setSolved] = useState<boolean | null>(null);

  const getSolution = (topic: string) =>
    SOLUTIONS[topic] || [
      "Check if the issue is related to your network connection.",
      "Try restarting the affected service or application.",
      "Clear browser cache and try again.",
      "If the issue persists, please create a support ticket.",
    ];

  const handleSuggestion = (s: string) => {
    setActiveSuggestion(s);
    setSolved(null);
    const solutions = getSolution(s);
    setMessages([
      { id: "0", from: "bot", text: "Hi! How can I help you today? Type your issue below or choose from the quick suggestions." },
      { id: "u1", from: "user", text: s },
      {
        id: "b1",
        from: "bot",
        text: `I found a solution for "${s}": ${solutions.map((sol, i) => `\n${i + 1}. ${sol}`).join("")}`,
      },
    ]);
  };

  const handleSearch = () => {
    if (!query.trim()) return;
    const matched = Object.keys(SOLUTIONS).find((k) =>
      query.toLowerCase().includes(k.toLowerCase().split(" ")[0])
    ) || query;

    setActiveSuggestion(matched);
    setSolved(null);

    const solutions = getSolution(matched);
    setMessages((prev) => [
      ...prev,
      { id: `u${Date.now()}`, from: "user", text: query },
      {
        id: `b${Date.now() + 1}`,
        from: "bot",
        text: `Here's what I found for your issue:\n${solutions.map((s, i) => `${i + 1}. ${s}`).join("\n")}`,
      },
    ]);
    setQuery("");
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar showDashboardBtn showSearch={false} />

      <main className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
          <i className="fi fi-rr-robot text-2xl text-violet-600"></i> Chatbot / Self-Service
        </h1>

        <div className="grid grid-cols-1 gap-5">
          {/* Chat Window */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            {/* Messages */}
            <div className="p-5 space-y-3 min-h-48 max-h-72 overflow-y-auto">
              {messages.map((m) => (
                <div key={m.id} className={`flex gap-2.5 ${m.from === "user" ? "flex-row-reverse" : ""}`}>
                  <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${m.from === "bot" ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-600"}`}>
                    {m.from === "bot" ? <i className="fi fi-rr-robot text-base"></i> : <i className="fi fi-rr-user text-base"></i>}
                  </div>
                  <div className={`max-w-xs px-3.5 py-2.5 rounded-xl text-sm leading-relaxed whitespace-pre-line ${m.from === "bot" ? "bg-violet-50 text-slate-700 border border-violet-100" : "bg-slate-800 text-white"}`}>
                    {m.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Input */}
            <div className="border-t border-slate-100 p-3 flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Type your issue here..."
                className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300"
              />
              <button
                onClick={handleSearch}
                className="bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-4 py-2 transition-colors"
              >
                <i className="fi fi-rr-send text-sm"></i>
              </button>
            </div>
          </div>

          {/* Quick Suggestions */}
          <div>
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Quick Suggestions</h2>
            <div className="grid grid-cols-2 gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSuggestion(s)}
                  className={`text-left text-sm px-3 py-2.5 border rounded-xl transition-all flex items-center gap-2 ${activeSuggestion === s ? "border-violet-400 bg-violet-50 text-violet-700" : "border-slate-200 bg-white hover:border-violet-200 hover:bg-violet-50 text-slate-700"}`}
                >
                  <i className="fi fi-rr-arrow-right text-slate-400 flex-shrink-0" /> {s}
                </button>
              ))}
            </div>
          </div>

          {/* Solved / Not Solved */}
          {activeSuggestion && solved === null && (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-sm font-semibold text-slate-700 mb-3">Did this solve your problem?</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setSolved(true)}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
                >
                  ✓ Yes, It Solved
                </button>
                <Link
                  href="/create-ticket"
                  className="flex-1 text-center border border-slate-300 hover:border-violet-300 text-slate-600 hover:text-violet-700 text-sm font-medium py-2.5 rounded-lg transition-colors"
                >
                  ✗ No, Create Ticket
                </Link>
              </div>
            </div>
          )}

          {solved === true && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center">
              <p className="text-emerald-700 font-semibold">Great! Glad we could help 🎉</p>
              <p className="text-emerald-600 text-sm mt-1">Feel free to reach out if you have any other issues.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
