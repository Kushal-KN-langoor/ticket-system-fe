"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LabelList,
} from "recharts";
import { TREND_DATA, CATEGORY_DATA } from "@/lib/data";

interface SummaryTabProps {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
}

const DAY_NAMES: Record<string | number, string> = {
  1:  "Mon", 2:  "Tue", 3:  "Wed", 4:  "Thu", 5:  "Fri", 6:  "Sat", 7:  "Sun",
  8:  "Mon", 9:  "Tue", 10: "Sun", 11: "Mon", 12: "Tue", 13: "Wed",
  14: "Thu", 15: "Fri", 16: "Sat", 17: "Sun",
};

const CustomTooltip = ({ active, payload, label }: any) => {
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

export default function SummaryTab({ total, open, inProgress, resolved }: SummaryTabProps) {
  const stats = [
    { label: "Total Tickets", value: total,      color: "text-slate-900",   bg: "bg-slate-50 border-slate-200" },
    { label: "Open",          value: open,        color: "text-blue-700",    bg: "bg-blue-50 border-blue-200" },
    { label: "In Progress",   value: inProgress,  color: "text-violet-700",  bg: "bg-violet-50 border-violet-200" },
    { label: "Resolved",      value: resolved,    color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
  ];

  // Safely extract numeric day from any format: 10, "10", "10 May", "Sun" etc.
  const trendWithDayNames = TREND_DATA.map((d) => {
    const raw = String(d.day).trim();
    const numeric = parseInt(raw.split(" ")[0], 10);
    return {
      ...d,
      dayLabel: !isNaN(numeric) ? (DAY_NAMES[numeric] ?? raw) : raw,
    };
  });

  const maxTickets = Math.max(...trendWithDayNames.map((d) => d.tickets));

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {stats.map((s) => (
          <div key={s.label} className={`border rounded-xl p-3 sm:p-4 text-center ${s.bg}`}>
            <div className={`text-2xl sm:text-3xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-slate-500 mt-1 font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Bar Chart */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
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

        {/* Pie Chart */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-0.5">By Category</h3>
          <p className="text-xs text-slate-400 mb-3">Distribution across support types</p>
          <ResponsiveContainer width="100%" height={210}>
            <PieChart>
              <Pie
                data={CATEGORY_DATA}
                cx="50%"
                cy="42%"
                innerRadius={48}
                outerRadius={72}
                paddingAngle={3}
                dataKey="value"
              >
                {CATEGORY_DATA.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
                formatter={(value, name) => [value, name]}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                formatter={(value) => <span style={{ color: "#64748b" }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

      </div>
    </div>
  );
}