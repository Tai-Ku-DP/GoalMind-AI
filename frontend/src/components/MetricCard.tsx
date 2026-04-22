"use client";

import React from "react";
import {
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
  TooltipContent,
} from "./ui/tooltip";
import { SuggestedActionsView, QuickCreateActionButton, type SuggestedAction } from "./TodoCard";

// ─── Types ────────────────────────────────────────────────────────────────────

export type OffTrackSeverity = "CRITICAL" | "WARNING" | "ON_TRACK";

export interface MetricItem {
  id: string;
  title: string;
  unit: string;
  owner: string;
  ownerId?: string;
  goal: number;
  goalOrientation: "gte" | "lte" | "gt" | "lt" | "equal";
  /** Goal thực tế cho tuần mới nhất (có thể là goalAdvanced) */
  latestEffectiveGoalValue?: number;
  latestIsAdvancedGoal?: boolean;
  // Danh sách goalAdvanced raw (dùng cho history bar)
  advancedGoals?: {
    periodInterval: string;
    from: string;
    to: string;
    value: number;
    orientation: string;
  }[];
  // Thống kê tổng hợp (overall) cho từng goalAdvanced — hiển thị dạng tab
  goalAdvancedStats?: {
    periodInterval: string;
    from: string;
    to: string;
    target: number;
    orientation: string;
    metricCalculation?: string;
    actual: number | null;
    remaining: number | null;
    rate: number | null;
  }[];
  latestValue: number | null;
  achievementPct: number | null;
  offTrackSeverity: OffTrackSeverity;
  consecutiveOffTrackWeeks: number;
  trend: string;
  weeklyChangePct?: number | null;
  actions?: string[];
  suggestedActions?: SuggestedAction[];
  trendLabel?: string;
  avgWeeklyChangePct?: number | null;
  history?: {
    weekStart: string;
    weekEnd: string;
    value: number | null;
    goalValue?: number;
    isAdvancedGoal?: boolean;
    achievementPct?: number | null;
  }[];
  rollup?: { monthly?: number; quarterly?: number; annual?: number } | null;
}

export interface ScorecardOverviewPayload {
  type: "scorecard-overview";
  summary: {
    total: number;
    onTrack: number;
    warning: number;
    critical: number;
    noData: number;
  };
  metrics: MetricItem[];
}

export interface ScorecardOfftrackPayload {
  type: "scorecard-offtrack";
  criticalCount: number;
  warningCount: number;
  items: MetricItem[];
}

export interface ScorecardTrendPayload {
  type: "scorecard-trend";
  metric: MetricItem;
}

export type MetricPayload =
  | ScorecardOverviewPayload
  | ScorecardOfftrackPayload
  | ScorecardTrendPayload;

// ─── Severity config ──────────────────────────────────────────────────────────

const SEV_CONFIG: Record<
  OffTrackSeverity,
  {
    badge: string;
    badgeText: string;
    bar: string;
    valueColor: string;
    pctColor: string;
  }
> = {
  CRITICAL: {
    badge: "bg-red-100 text-red-700",
    badgeText: "tuần không đạt",
    bar: "bg-red-500",
    valueColor: "text-red-600",
    pctColor: "text-red-500",
  },
  WARNING: {
    badge: "bg-amber-100 text-amber-700",
    badgeText: "tuần không đạt",
    bar: "bg-amber-400",
    valueColor: "text-amber-600",
    pctColor: "text-amber-500",
  },
  ON_TRACK: {
    badge: "bg-green-100 text-green-700",
    badgeText: "on track",
    bar: "bg-green-500",
    valueColor: "text-gray-800",
    pctColor: "text-green-600",
  },
};

// ─── Goal Advanced Stats Section (tab-based) ──────────────────────────────────

const ORIENTATION_LABEL: Record<string, string> = {
  gte: "≥",
  lte: "≤",
  gt: ">",
  lt: "<",
  equal: "=",
};

function getPeriodLabel(
  periodInterval: string,
  from: string,
  to: string,
): string {
  const d = new Date(from);
  switch (periodInterval) {
    case "monthly":
      return `Tháng ${d.getMonth() + 1}/${d.getFullYear()}`;
    case "quarterly": {
      const q = Math.floor(d.getMonth() / 3) + 1;
      return `Q${q}/${d.getFullYear()}`;
    }
    case "annual":
      return `${d.getFullYear()}`;
    case "weekly": {
      // ISO week rough estimate
      const jan1 = new Date(d.getFullYear(), 0, 1);
      const week = Math.ceil(
        ((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7,
      );
      return `Tuần ${week}/${d.getFullYear()}`;
    }
    default:
      return `${from} – ${to}`;
  }
}

function fmtNum(v: number | null, unit: string): string {
  if (v === null) return "—";
  // Hiển tối đa 4 chữ số thập phân, cắt 0 thừa
  const rounded = parseFloat(v.toFixed(4));
  return unit === "percentage"
    ? `${rounded.toLocaleString("vi-VN", { maximumFractionDigits: 4 })}%`
    : rounded.toLocaleString("vi-VN", { maximumFractionDigits: 4 });
}

type GoalAdvancedStat = NonNullable<MetricItem["goalAdvancedStats"]>[number];

function GoalStatBlock({
  stat,
  unit,
  label,
}: {
  stat: GoalAdvancedStat;
  unit: string;
  label: string;
}) {
  const isOnTrack =
    stat.actual === null
      ? null
      : ["gte", "gt", "equal"].includes(stat.orientation)
        ? stat.actual >= stat.target
        : stat.actual <= stat.target;

  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
      {/* Mục tiêu */}
      <dt className="text-gray-400 dark:text-gray-500 whitespace-nowrap">
        Mục tiêu ({label})
      </dt>
      <dd className="font-semibold text-gray-800 dark:text-gray-200">
        {ORIENTATION_LABEL[stat.orientation] ?? stat.orientation}{" "}
        {fmtNum(stat.target, unit)}
        {stat.metricCalculation && (
          <span className="ml-1.5 text-[10px] font-normal text-gray-400">
            ({stat.metricCalculation === "AVERAGE" ? "TB" : "Σ"})
          </span>
        )}
      </dd>

      {/* Thực đạt */}
      <dt className="text-gray-400 dark:text-gray-500">Đạt được</dt>
      <dd
        className={`font-semibold tabular-nums ${
          isOnTrack === null
            ? "text-gray-400"
            : isOnTrack
              ? "text-green-600 dark:text-green-400"
              : "text-red-500 dark:text-red-400"
        }`}
      >
        {stat.actual === null ? "—" : fmtNum(stat.actual, unit)}
      </dd>

      {/* Còn thiếu */}
      {stat.remaining !== null && stat.remaining > 0 && (
        <>
          <dt className="text-gray-400 dark:text-gray-500">Còn thiếu</dt>
          <dd className="font-semibold tabular-nums text-amber-600 dark:text-amber-400">
            {fmtNum(stat.remaining, unit)}
          </dd>
        </>
      )}

      {/* Tỉ lệ */}
      <dt className="text-gray-400 dark:text-gray-500">Tỉ lệ</dt>
      <dd
        className={`font-semibold tabular-nums ${
          (stat.rate ?? 0) >= 100
            ? "text-green-600 dark:text-green-400"
            : (stat.rate ?? 0) >= 80
              ? "text-amber-600 dark:text-amber-400"
              : "text-red-500 dark:text-red-400"
        }`}
      >
        {stat.rate === null ? "—" : `${parseFloat(stat.rate.toFixed(4))}%`}
      </dd>
    </dl>
  );
}

function GoalAdvancedStatsSection({
  stats,
  unit,
}: {
  stats: NonNullable<MetricItem["goalAdvancedStats"]>;
  unit: string;
}) {
  const [activeIdx, setActiveIdx] = React.useState(0);
  if (!stats.length) return null;

  const current = stats[activeIdx] ?? stats[0];
  const label = getPeriodLabel(
    current.periodInterval,
    current.from,
    current.to,
  );

  return (
    <div className="mt-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">
        Thống kê mục tiêu nâng cao
      </p>

      {/* Tabs — chỉ hiển khi có nhiều goalAdvanced */}
      {stats.length > 1 && (
        <div className="flex gap-1 mb-3 flex-wrap">
          {stats.map((s, i) => {
            const lbl = getPeriodLabel(s.periodInterval, s.from, s.to);
            return (
              <button
                key={i}
                onClick={() => setActiveIdx(i)}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                  i === activeIdx
                    ? "bg-purple-600 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                }`}
              >
                {lbl}
              </button>
            );
          })}
        </div>
      )}

      {/* Stats block */}
      <div className="rounded-xl border border-purple-100 bg-purple-50/60 p-3 dark:border-purple-900 dark:bg-purple-950/30">
        <GoalStatBlock stat={current} unit={unit} label={label} />
      </div>
    </div>
  );
}

// ─── History bar chart with hover info ───────────────────────────────────────

function HistoryBars({
  history,
  goal,
  isGte,
  unit,
  avgWeeklyChangePct,
}: {
  history: NonNullable<MetricItem["history"]>;
  goal: number;
  isGte: boolean;
  unit: string;
  avgWeeklyChangePct?: number | null;
}) {
  const ordered = history.slice().reverse();
  const max = Math.max(...ordered.map((x) => x.value ?? 0));

  const fmt = (iso: string) => {
    const [, m, d] = iso.split("-");
    return `${d}/${m}`;
  };

  return (
    <TooltipProvider delayDuration={100}>
      <div>
        {/* Bars */}
        <div className="flex items-end gap-0.5 h-14">
          {ordered.map((h, i) => {
            const val = h.value ?? 0;
            // Dùng goalValue riêng của từng tuần nếu có, fallback về goal chung
            const effectiveGoal = h.goalValue ?? goal;
            const heightPct = max > 0 ? (val / max) * 100 : 0;
            const isAboveGoal = isGte
              ? val >= effectiveGoal
              : val <= effectiveGoal;
            const tooltipContent = (
              <div className="flex flex-col gap-1 min-w-[100px]">
                <span className="text-[10px] text-gray-400 font-medium">
                  {fmt(h.weekStart)} &ndash; {fmt(h.weekEnd)}
                </span>
                <span className="text-[13px] font-bold">
                  {val.toLocaleString()} {unit}
                </span>
                <span className="text-[10px] text-gray-400">
                  Mục tiêu:{" "}
                  <span
                    className={
                      h.isAdvancedGoal ? "text-purple-400 font-semibold" : ""
                    }
                  >
                    {effectiveGoal.toLocaleString()} {unit}
                    {h.isAdvancedGoal && " ★"}
                  </span>
                </span>
                {h.achievementPct != null && (
                  <span
                    className={`text-[11px] font-semibold ${
                      isAboveGoal ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {h.achievementPct}% mục tiêu
                  </span>
                )}
              </div>
            );

            return (
              <TooltipRoot key={i}>
                <TooltipTrigger asChild>
                  <div
                    className="flex-1 rounded-sm cursor-pointer transition-transform hover:scale-105 hover:brightness-110"
                    style={{
                      height: `${Math.max(heightPct, 8)}%`,
                      backgroundColor: isAboveGoal ? "#22c55e" : "#ef4444",
                      opacity: 0.55 + (i / ordered.length) * 0.45,
                    }}
                  />
                </TooltipTrigger>
                <TooltipContent side="top">{tooltipContent}</TooltipContent>
              </TooltipRoot>
            );
          })}
        </div>

        {/* Date range labels */}
        <div className="flex justify-between px-0.5 mt-1">
          <span className="text-[10px] text-gray-400 dark:text-gray-500">
            {fmt(ordered[0].weekStart)}
          </span>
          <span className="text-[10px] text-gray-400 dark:text-gray-500">
            {fmt(ordered[ordered.length - 1].weekEnd)}
          </span>
        </div>

        {avgWeeklyChangePct != null && (
          <p className="mt-1 text-[11px] text-gray-400">
            Trung bình {avgWeeklyChangePct > 0 ? "+" : ""}
            {avgWeeklyChangePct}%/tuần
          </p>
        )}
      </div>
    </TooltipProvider>
  );
}

// ─── Single MetricCard ────────────────────────────────────────────────────────

export function MetricCard({ metric }: { metric: MetricItem }) {
  const sev = SEV_CONFIG[metric.offTrackSeverity] ?? SEV_CONFIG.ON_TRACK;
  const latest = metric.latestValue ?? 0;
  // Dùng effective goal (goalAdvanced của tuần mới nhất) nếu có
  const effectiveGoal =
    metric.latestIsAdvancedGoal && metric.latestEffectiveGoalValue != null
      ? metric.latestEffectiveGoalValue
      : metric.goal;
  const pct = metric.achievementPct ?? 0;
  const isOnTrack = metric.offTrackSeverity === "ON_TRACK";
  const weeks = metric.consecutiveOffTrackWeeks;

  // Progress bar fill (cap to 100%)
  const barPct = Math.min(pct, 100);

  // "còn thiếu X" or "dư X"
  const diff = Math.abs(effectiveGoal - latest);
  const isGte = metric.goalOrientation === "gte";
  const diffLabel = isGte
    ? latest < effectiveGoal
      ? `còn thiếu ${diff.toLocaleString()}`
      : `vượt ${diff.toLocaleString()}`
    : latest > effectiveGoal
      ? `vượt ${diff.toLocaleString()}`
      : `còn thiếu ${diff.toLocaleString()}`;

  // Trend
  const trendLabel = metric.trend ?? metric.trendLabel ?? "";
  const isTrendUp = trendLabel.startsWith("↑");

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold leading-snug text-gray-900 dark:text-white">
            {metric.title}
          </h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <span>{metric.owner}</span>
            {trendLabel && (
              <>
                <span className="text-gray-300 dark:text-gray-600">·</span>
                <span
                  className={
                    isTrendUp
                      ? "text-green-600 dark:text-green-400"
                      : trendLabel.startsWith("↓")
                        ? "text-red-500 dark:text-red-400"
                        : "text-gray-400"
                  }
                >
                  {trendLabel}
                </span>
              </>
            )}
          </p>
        </div>

        {/* Severity badge */}
        {!isOnTrack && weeks > 0 && (
          <span
            className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold ${sev.badge}`}
          >
            {weeks} {sev.badgeText}
          </span>
        )}
        {isOnTrack && (
          <span className="shrink-0 rounded-lg bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700 dark:bg-green-950 dark:text-green-300">
            ✓ Đạt mục tiêu
          </span>
        )}
      </div>

      {/* Stats grid */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        {/* Actual */}
        <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800">
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            Thực tế
          </p>

          <p
            className={`mt-1 text-2xl font-bold tabular-nums ${metric.latestValue === null ? "text-gray-300" : sev.valueColor}`}
          >
            {metric.latestValue === null ? "—" : latest.toLocaleString()}
          </p>

          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
            {metric.unit}/tuần
          </p>
        </div>

        {/* Goal */}
        <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800">
          <p className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
            Mục tiêu
            {metric.latestIsAdvancedGoal && (
              <span className="text-purple-500 dark:text-purple-400">★</span>
            )}
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-gray-800 dark:text-gray-200">
            {effectiveGoal.toLocaleString()}
          </p>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
            {metric.unit}/tuần
          </p>
        </div>

        {/* Achievement % */}
        <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800">
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            Đạt được
          </p>
          <p
            className={`mt-1 text-2xl font-bold tabular-nums ${metric.achievementPct === null ? "text-gray-300" : sev.pctColor}`}
          >
            {metric.achievementPct === null ? "—" : `${pct}%`}
          </p>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
            {metric.latestValue !== null ? diffLabel : "chưa có dữ liệu"}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3">
        <div className="flex justify-between text-[11px] text-gray-400 dark:text-gray-500 mb-1">
          <span>0</span>
          <span className="tabular-nums">
            {latest.toLocaleString()} / {effectiveGoal.toLocaleString()}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
          <div
            className={`h-full rounded-full transition-all duration-500 ${sev.bar}`}
            style={{ width: `${barPct}%` }}
          />
        </div>
      </div>

      {/* Plain text actions */}
      {metric.actions && metric.actions.length > 0 && (
        <div className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Hành động đề xuất
          </p>
          <ol className="mt-2 space-y-2">
            {metric.actions.map((action, i) => (
              <li
                key={i}
                className="flex items-start gap-2.5"
              >
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-500 dark:bg-gray-800">
                  {i + 1}
                </span>
                <span className="flex-1 text-xs leading-relaxed text-gray-700 dark:text-gray-300">
                  {action}
                </span>
                <QuickCreateActionButton actionText={action} ownerId={metric.ownerId} />
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Suggested actions with "Tạo Todo" button */}
      {metric.suggestedActions && metric.suggestedActions.length > 0 && (
        <div className="mt-4">
          <SuggestedActionsView actions={metric.suggestedActions} />
        </div>
      )}

      {/* Goal Advanced Stats (tab-based) */}
      {metric.goalAdvancedStats && metric.goalAdvancedStats.length > 0 && (
        <GoalAdvancedStatsSection
          stats={metric.goalAdvancedStats}
          unit={metric.unit}
        />
      )}

      {/* Mini trend history (for trend view) */}
      {metric.history && metric.history.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Lịch sử {metric.history.length} tuần
            </p>

            {metric.history.some((h) => h.isAdvancedGoal) && (
              <span className="text-[10px] text-purple-500 dark:text-purple-400 flex items-center gap-0.5">
                <span>★</span> Tuần có mục tiêu nâng cao
              </span>
            )}
          </div>

          <HistoryBars
            history={metric.history}
            goal={effectiveGoal}
            isGte={isGte}
            unit={metric.unit}
            avgWeeklyChangePct={metric.avgWeeklyChangePct}
          />
        </div>
      )}
    </div>
  );
}

// ─── Scorecard Overview (summary header + list of all metrics) ────────────────

export function ScorecardOverviewView({
  payload,
}: {
  payload: ScorecardOverviewPayload;
}) {
  const { summary, metrics } = payload;
  return (
    <div className="flex flex-col gap-3 py-1">
      {/* Summary row */}
      <div className="flex flex-wrap gap-2">
        {[
          {
            label: "Tổng",
            value: summary.total,
            color:
              "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
          },
          {
            label: "On track",
            value: summary.onTrack,
            color:
              "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
          },
          {
            label: "Cảnh báo",
            value: summary.warning,
            color:
              "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
          },
          {
            label: "Nghiêm trọng",
            value: summary.critical,
            color: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
          },
          ...(summary.noData > 0
            ? [
                {
                  label: "Chưa có dữ liệu",
                  value: summary.noData,
                  color:
                    "bg-gray-50 text-gray-500 dark:bg-gray-900 dark:text-gray-400",
                },
              ]
            : []),
        ].map((stat) => (
          <span
            key={stat.label}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${stat.color}`}
          >
            <span className="text-base font-bold">{stat.value}</span>
            {stat.label}
          </span>
        ))}
      </div>

      {metrics.map((m, i) => (
        <MetricCard key={i} metric={m} />
      ))}
    </div>
  );
}

// ─── Scorecard Off-track view ─────────────────────────────────────────────────

export function ScorecardOfftrackView({
  payload,
}: {
  payload: ScorecardOfftrackPayload;
}) {
  const { criticalCount, warningCount, items } = payload;
  return (
    <div className="flex flex-col gap-3 py-1">
      {/* Summary badges */}
      <div className="flex gap-2">
        {criticalCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 dark:bg-red-950 dark:text-red-300">
            🔴 {criticalCount} nghiêm trọng
          </span>
        )}
        {warningCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            🟡 {warningCount} cảnh báo
          </span>
        )}
      </div>

      {items.map((m, i) => (
        <MetricCard key={i} metric={m} />
      ))}
    </div>
  );
}

// ─── Scorecard Trend (single metric deep dive) ───────────────────────────────

export function ScorecardTrendView({
  payload,
}: {
  payload: ScorecardTrendPayload;
}) {
  return (
    <div className="py-1">
      <MetricCard metric={payload.metric} />
    </div>
  );
}

// ─── Parser ───────────────────────────────────────────────────────────────────

export function parseMetricFromText(text: string): MetricPayload | null {
  try {
    const fenced = text.match(/```json\s*([\s\S]*?)```/);
    if (!fenced) return null;

    const raw = JSON.parse(fenced[1]);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

    if (raw.type === "scorecard-overview" && Array.isArray(raw.metrics)) {
      return raw as ScorecardOverviewPayload;
    }

    if (raw.type === "scorecard-offtrack" && Array.isArray(raw.items)) {
      return raw as ScorecardOfftrackPayload;
    }

    if (raw.type === "scorecard-trend" && raw.metric) {
      return raw as ScorecardTrendPayload;
    }

    return null;
  } catch {
    return null;
  }
}

// ─── Dispatcher ──────────────────────────────────────────────────────────────

export function MetricView({ payload }: { payload: MetricPayload }) {
  if (payload.type === "scorecard-overview") {
    return <ScorecardOverviewView payload={payload} />;
  }
  if (payload.type === "scorecard-offtrack") {
    return <ScorecardOfftrackView payload={payload} />;
  }
  if (payload.type === "scorecard-trend") {
    return <ScorecardTrendView payload={payload} />;
  }
  return null;
}
