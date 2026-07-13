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

export interface CategorySlice {
  name: string;
  value: number;
  color?: string;
}

interface SummaryTabProps {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  trend?: TrendPoint[];
  categories?: CategorySlice[];
  loading?: boolean;
  error?: string;
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

  // Backend already returns day labels (e.g. "Mon", "Tue") directly, so
  // no client-side translation is needed — just use trend as-is.
  const hasTrendData = !!trend && trend.length > 0;
  const trendData = trend ?? [];

  const maxTickets = trendData.length > 0
    ? Math.max(...trendData.map((d) => d.tickets))
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
            {hasTrendData && (
              <div className="text-right">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Peak</span>
                <div className="text-lg font-bold text-violet-600 leading-tight">{maxTickets}</div>
              </div>
            )}
          </div>

          {loading ? (
            <div className="h-[220px] flex items-center justify-center text-sm text-slate-400">
              Loading trend data...
            </div>
          ) : hasTrendData ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={trendData}
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
                  dataKey="day"
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
          ) : (
            <div className="h-[220px] flex flex-col items-center justify-center text-center px-6">
              <p className="text-sm font-medium text-slate-400">No trend data yet</p>
              <p className="text-xs text-slate-400 mt-1">
                Once tickets are created over a few days, activity will show up here.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}