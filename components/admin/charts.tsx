"use client";

import { useId } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTheme } from "@/app/providers/ThemeContext";
import { adminStyles } from "./styles";

// Admin charts. Series colours are the first two slots of a categorical palette validated for
// colour-vision deficiency in both themes (blue, then orange; dark mode uses its own steps).
// Every chart has a tooltip, a legend when it has more than one series, and a table view.

const SERIES = {
  light: ["#2a78d6", "#eb6834"],
  dark: ["#3987e5", "#d95926"],
};

function useChartTheme() {
  const isDark = useTheme().theme === "dark";
  return {
    isDark,
    series: isDark ? SERIES.dark : SERIES.light,
    grid: isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb",
    axis: isDark ? "#9ca3af" : "#6b7280",
    tooltip: {
      backgroundColor: isDark ? "#111" : "#fff",
      border: `1px solid ${isDark ? "rgba(255,255,255,0.15)" : "#e5e7eb"}`,
      borderRadius: "8px",
      color: isDark ? "#f3f4f6" : "#111827",
      fontSize: 12,
    },
    styles: adminStyles(isDark),
  };
}

const shortDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** The chart's numbers as a table, collapsed by default (also what screen readers get). */
function TableView({ caption, columns, rows }: { caption: string; columns: string[]; rows: (string | number)[][] }) {
  const { styles } = useChartTheme();
  return (
    <details className="mt-3">
      <summary className={`cursor-pointer text-xs font-medium ${styles.muted}`}>View as table</summary>
      <div className="mt-2 max-h-64 overflow-auto">
        <table className="w-full text-xs">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>{columns.map((c) => <th key={c} scope="col" className={`py-1 pr-4 text-left font-semibold ${styles.muted}`}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className={`border-t ${styles.divider}`}>
                {row.map((cell, j) => <td key={j} className={`py-1 pr-4 tabular-nums ${styles.body}`}>{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export interface LineSeries {
  key: string;
  label: string;
}

/** Daily counts over time: one y-axis, up to two series of the same unit. */
export function DailyChart<T extends { date: string }>({ title, data, series }: { title: string; data: T[]; series: LineSeries[] }) {
  const theme = useChartTheme();
  const captionId = useId();
  return (
    <figure aria-labelledby={captionId} className={`${theme.styles.card} p-5`}>
      <figcaption id={captionId} className={`mb-4 text-sm font-semibold ${theme.styles.heading}`}>{title}</figcaption>
      <div className="h-64" role="img" aria-label={`${title} chart`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid stroke={theme.grid} vertical={false} />
            <XAxis dataKey="date" tickFormatter={shortDate} stroke={theme.axis} fontSize={11} tickLine={false} minTickGap={24} />
            <YAxis allowDecimals={false} stroke={theme.axis} fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={theme.tooltip} labelFormatter={(label) => shortDate(String(label))} />
            {series.length > 1 && <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, color: theme.axis }} />}
            {series.map((s, i) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={theme.series[i]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: theme.isDark ? "#000" : "#fff" }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <TableView
        caption={title}
        columns={["Date", ...series.map((s) => s.label)]}
        rows={data.map((d) => [d.date, ...series.map((s) => Number((d as Record<string, unknown>)[s.key] ?? 0))])}
      />
    </figure>
  );
}

/** Magnitude by category as horizontal bars, largest first. */
export function BarBreakdown({ title, data, emptyText = "No data yet." }: { title: string; data: { name: string; value: number }[]; emptyText?: string }) {
  const theme = useChartTheme();
  const captionId = useId();
  const sorted = [...data].sort((a, b) => b.value - a.value);
  return (
    <figure aria-labelledby={captionId} className={`${theme.styles.card} p-5`}>
      <figcaption id={captionId} className={`mb-4 text-sm font-semibold ${theme.styles.heading}`}>{title}</figcaption>
      {sorted.length === 0 ? (
        <p className={`py-8 text-center text-sm ${theme.styles.muted}`}>{emptyText}</p>
      ) : (
        <>
          <div style={{ height: Math.max(120, sorted.length * 32) }} role="img" aria-label={`${title} chart`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sorted} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }} barCategoryGap={6}>
                <CartesianGrid stroke={theme.grid} horizontal={false} />
                <XAxis type="number" allowDecimals={false} stroke={theme.axis} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" width={110} stroke={theme.axis} fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={theme.tooltip} cursor={{ fill: theme.grid }} />
                <Bar dataKey="value" name="Count" fill={theme.series[0]} radius={[0, 4, 4, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <TableView caption={title} columns={["Name", "Count"]} rows={sorted.map((d) => [d.name, d.value])} />
        </>
      )}
    </figure>
  );
}
