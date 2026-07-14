"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts";
export interface TrendPoint {
  day: string;
  tickets: number;
}

interface SummaryTabProps {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  trend?: TrendPoint[];
  loading?: boolean;
  error?: string;
}

// Derives a short weekday label ("Mon", "Tue"...) from whatever date format
// the backend sends for a trend point. Handles full ISO dates
// ("2026-07-10"), "10 May" style strings (assumes the current year), and
// falls back to the raw value untouched if it isn't a parseable date at all
// (e.g. the backend already sends "Sun" or a plain day-of-month number with
// no way to resolve which weekday that actually was).
function getDayLabel(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  let date = new Date(trimmed);
  if (isNaN(date.getTime())) {
    date = new Date(`${trimmed} ${new Date().getFullYear()}`);
  }

  return !isNaN(date.getTime())
    ? date.toLocaleDateString("en-US", { weekday: "short" })
    : trimmed;
}

type CustomTooltipProps = {
  active?: boolean;
  label?: string | number;
  payload?: Array<{ value?: number | string }>;
};

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-lg">
        <p className="text-xs font-semibold text-slate-500 mb-1">{label}</p>
        <p className="text-lg font-bold text-violet-600">
          {payload[0].value}
          <span className="text-xs font-medium text-slate-400 ml-1">tickets</span>
        </p>
      </div>
    );
  }
  return null;
};

export default function SummaryTab({
  total,
  open,
  inProgress,
  resolved,
  trend,
  loading,
  error,
}: SummaryTabProps) {
  const stats = [
    { label: "Total Tickets", value: total,      color: "text-slate-900",   bg: "bg-slate-50 border-slate-200" },
    { label: "Open",          value: open,        color: "text-blue-700",    bg: "bg-blue-50 border-blue-200" },
    { label: "In Progress",   value: inProgress,  color: "text-violet-700",  bg: "bg-violet-50 border-violet-200" },
    { label: "Resolved",      value: resolved,    color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
  ];

  // trend is always real data by the time it gets here — either from the
  // backend's /summary endpoint, or computed client-side from the user's
  // actual tickets as a fallback (see ProjectPage). No mock data.
  const trendSource = trend ?? [];

  // Safely resolve a weekday label from whatever format the backend sends:
  // ISO date, "10 May", plain "10", "Sun", etc.
  const trendWithDayNames = trendSource.map((d) => ({
    ...d,
    dayLabel: getDayLabel(String(d.day ?? "")),
  }));

  const maxTickets = trendWithDayNames.length > 0
    ? Math.max(...trendWithDayNames.map((d) => d.tickets))
    : 0;

  return (
    <div>
      {error && (
        <div className="mb-4 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {error} — showing the most recent data available.
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {stats.map((s) => (
          <div key={s.label} className={`border rounded-xl p-3 sm:p-4 text-center ${s.bg}`}>
            <div className={`text-2xl sm:text-3xl font-bold ${s.color}`}>
              {loading ? "—" : s.value}
            </div>
            <div className="text-xs text-slate-500 mt-1 font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4">

        {/* Bar Chart */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Ticket Trend</h3>
              <p className="text-xs text-slate-400 mt-0.5">Last 7 days · tickets created per day</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Peak</span>
              <div className="text-lg font-bold text-violet-600 leading-tight">{maxTickets}</div>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={trendWithDayNames}
              margin={{ top: 20, right: 8, left: 8, bottom: 0 }}
              barCategoryGap="30%"
            >
              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7c3aed" stopOpacity={1} />
                  <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.7} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="dayLabel"
                tick={{ fontSize: 12, fill: "#94a3b8", fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f5f3ff", radius: 6 }} />
              <Bar
                dataKey="tickets"
                fill="url(#barGradient)"
                radius={[6, 6, 0, 0]}
                name="Tickets"
                maxBarSize={48}
              >
                <LabelList
                  dataKey="tickets"
                  position="top"
                  style={{ fontSize: 11, fill: "#7c3aed", fontWeight: 700 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

      </div>
    </div>
  );
}