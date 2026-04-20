"use client";

import {
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
  TooltipContent,
} from "./ui/tooltip";

// ─── Types ────────────────────────────────────────────────────────────────────

export type OffTrackSeverity = "CRITICAL" | "WARNING" | "ON_TRACK";

export interface MetricItem {
  id: string;
  title: string;
  unit: string;
  owner: string;
  goal: number;
  goalOrientation: "gte" | "lte";
  latestValue: number | null;
  achievementPct: number | null;
  offTrackSeverity: OffTrackSeverity;
  consecutiveOffTrackWeeks: number;
  trend: string; // trendLabel from tool e.g. "↑ tăng 2 tuần liên tiếp"
  weeklyChangePct?: number | null;
  actions?: string[];
  // for trend view
  trendLabel?: string;
  avgWeeklyChangePct?: number | null;
  history?: {
    weekStart: string;
    weekEnd: string;
    value: number | null;
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
    badgeText: "tuần lệch",
    bar: "bg-red-500",
    valueColor: "text-red-600",
    pctColor: "text-red-500",
  },
  WARNING: {
    badge: "bg-amber-100 text-amber-700",
    badgeText: "tuần lệch",
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
            const heightPct = max > 0 ? (val / max) * 100 : 0;
            const isAboveGoal = isGte ? val >= goal : val <= goal;
            const tooltipContent = (
              <div className="flex flex-col gap-1 min-w-[90px]">
                <span className="text-[10px] text-gray-400 font-medium">
                  {fmt(h.weekStart)} &ndash; {fmt(h.weekEnd)}
                </span>
                <span className="text-[13px] font-bold">
                  {val.toLocaleString()} {unit}
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
  const goal = metric.goal;
  const pct = metric.achievementPct ?? 0;
  const isOnTrack = metric.offTrackSeverity === "ON_TRACK";
  const weeks = metric.consecutiveOffTrackWeeks;

  // Progress bar fill (cap to 100%)
  const barPct = Math.min(pct, 100);

  // "còn thiếu X" or "dư X"
  const diff = Math.abs(goal - latest);
  const isGte = metric.goalOrientation === "gte";
  const diffLabel = isGte
    ? latest < goal
      ? `còn thiếu ${diff.toLocaleString()}`
      : `vượt ${diff.toLocaleString()}`
    : latest > goal
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
          <p className="text-[11px] text-gray-500 dark:text-gray-400">Thực tế</p>
          <p className={`mt-1 text-2xl font-bold tabular-nums ${metric.latestValue === null ? "text-gray-300" : sev.valueColor}`}>
            {metric.latestValue === null ? "—" : latest.toLocaleString()}
          </p>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
            {metric.unit}/tuần
          </p>
        </div>

        {/* Goal */}
        <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800">
          <p className="text-[11px] text-gray-500 dark:text-gray-400">Mục tiêu</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-gray-800 dark:text-gray-200">
            {goal.toLocaleString()}
          </p>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
            {metric.unit}/tuần
          </p>
        </div>

        {/* Achievement % */}
        <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800">
          <p className="text-[11px] text-gray-500 dark:text-gray-400">Đạt được</p>
          <p className={`mt-1 text-2xl font-bold tabular-nums ${metric.achievementPct === null ? "text-gray-300" : sev.pctColor}`}>
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
            {latest.toLocaleString()} / {goal.toLocaleString()}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
          <div
            className={`h-full rounded-full transition-all duration-500 ${sev.bar}`}
            style={{ width: `${barPct}%` }}
          />
        </div>
      </div>

      {/* Actions */}
      {metric.actions && metric.actions.length > 0 && (
        <div className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Hành động đề xuất
          </p>
          <ol className="mt-2 space-y-2">
            {metric.actions.map((action, i) => (
              <li key={i} className="flex items-start gap-2.5 text-xs text-gray-700 dark:text-gray-300">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-500 dark:bg-gray-800">
                  {i + 1}
                </span>
                <span className="leading-relaxed">{action}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Mini trend history (for trend view) */}
      {metric.history && metric.history.length > 0 && (
        <div className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">
            Lịch sử {metric.history.length} tuần
          </p>
          <HistoryBars
            history={metric.history}
            goal={goal}
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
          { label: "Tổng", value: summary.total, color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
          { label: "On track", value: summary.onTrack, color: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300" },
          { label: "Cảnh báo", value: summary.warning, color: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
          { label: "Nghiêm trọng", value: summary.critical, color: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" },
          ...(summary.noData > 0
            ? [{ label: "Chưa có dữ liệu", value: summary.noData, color: "bg-gray-50 text-gray-500 dark:bg-gray-900 dark:text-gray-400" }]
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

    if (
      raw.type === "scorecard-overview" &&
      Array.isArray(raw.metrics)
    ) {
      return raw as ScorecardOverviewPayload;
    }

    if (
      raw.type === "scorecard-offtrack" &&
      Array.isArray(raw.items)
    ) {
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
