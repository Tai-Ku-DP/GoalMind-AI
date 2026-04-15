"use client";

import { useState } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export type RiskLevel = "HIGH" | "MEDIUM" | "LOW" | "DONE";

export interface MilestoneDetail {
  title: string;
  percentDone: number;
  assignee: string | null;
  overdueDays: number; // positive = overdue, negative = days remaining
  isOverdue?: boolean;
  status: string;
  deadline: string | null;
  fromValue: number | null;
  toValue: number | null;
  currentValue?: number | null;
}

export interface GoalData {
  risk: RiskLevel;
  title: string;
  percentDone: number;
  milestones: string; // e.g. "2/4"
  owner: string;
  overdueDays: number; // positive = overdue, negative = days remaining
  forecastDate: string; // e.g. "13/06/2026"
  revenue?: string | null; // e.g. "540tr" or null
  actions: string[];
  milestoneDetails?: MilestoneDetail[] | null;
}

// GoalListRock — schema for listGoals mode (includes milestones from API)
export interface GoalListRock {
  id: string;
  risk: RiskLevel;
  title: string;
  percentDone: number;
  milestones: string; // "2/4" summary
  milestoneDone: number;
  milestoneTotal: number;
  owner: string;
  overdueDays: number;
  milestoneList?: MilestoneDetail[];
}

// Discriminated union for parser output
export type ParsedGoalResponse =
  | { type: "goal-list"; rocks: GoalListRock[]; summary: string }
  | { type: "goal-detail"; goals: GoalData[]; summary: string };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatOverdue(days: number): string {
  const abs = Math.abs(days);
  if (abs >= 30) return `${Math.round(abs / 30)} tháng`;
  if (abs >= 7) return `${Math.round(abs / 7)} tuần`;
  return `${abs} ngày`;
}

// ─── Config ──────────────────────────────────────────────────────────────────

const RISK_CONFIG: Record<
  RiskLevel,
  {
    badge: string;
    bar: string;
    dot: string;
    label: string;
    dotColor: string;
  }
> = {
  HIGH: {
    badge: "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200",
    bar: "bg-red-500",
    dot: "bg-red-500",
    label: "Rủi ro cao",
    dotColor: "#ef4444",
  },
  MEDIUM: {
    badge: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
    bar: "bg-amber-400",
    dot: "bg-amber-400",
    label: "Rủi ro vừa",
    dotColor: "#f59e0b",
  },
  LOW: {
    badge: "bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
    bar: "bg-blue-500",
    dot: "bg-blue-500",
    label: "Bình thường",
    dotColor: "#3b82f6",
  },
  DONE: {
    badge: "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200",
    bar: "bg-green-500",
    dot: "bg-green-500",
    label: "Hoàn thành",
    dotColor: "#22c55e",
  },
};

// ─── Single GoalCard ──────────────────────────────────────────────────────────

export function GoalCard({ goal }: { goal: GoalData }) {
  const cfg = RISK_CONFIG[goal.risk] ?? RISK_CONFIG.LOW;
  const isOverdue = goal.overdueDays > 0;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      {/* Risk badge */}
      <span
        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${cfg.badge}`}
      >
        <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
        {cfg.label}
      </span>

      {/* Title */}
      <h3 className="mt-3 text-sm font-semibold leading-snug text-gray-900 dark:text-white">
        {goal.title}
      </h3>

      <hr className="my-3 border-gray-100 dark:border-gray-800" />

      {/* Meta row */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
        <span>
          Tiến độ:{" "}
          <span className="font-medium text-gray-800 dark:text-gray-200">
            {goal.percentDone}%
          </span>
        </span>
        <span>{goal.milestones} milestones</span>
        <span>
          Người phụ trách:{" "}
          <span className="font-medium text-gray-800 dark:text-gray-200">
            {goal.owner}
          </span>
        </span>
      </div>

      {/* Progress bar */}
      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <div
          className={`h-full rounded-full transition-all ${cfg.bar}`}
          style={{ width: `${Math.min(goal.percentDone, 100)}%` }}
        />
      </div>

      {/* Warning + forecast */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        {isOverdue ? (
          <span className="rounded-lg bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
            ⚠ Trễ {goal.overdueDays} ngày
          </span>
        ) : (
          <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            Còn {Math.abs(goal.overdueDays)} ngày
          </span>
        )}
        <span className="text-xs text-gray-400 dark:text-gray-500">
          Hoàn thành dự kiến:{" "}
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {goal.forecastDate}
          </span>
        </span>
      </div>

      {/* Revenue (optional) */}
      {goal.revenue && (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Doanh thu dự kiến:{" "}
          <span className="font-medium text-gray-800 dark:text-gray-200">
            {goal.revenue}
          </span>
        </p>
      )}

      {/* Milestone details (only shown in deep-analysis mode) */}
      {goal.milestoneDetails && goal.milestoneDetails.length > 0 && (
        <>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Milestones
          </p>
          <ul className="mt-2 divide-y divide-gray-50 dark:divide-gray-800">
            {goal.milestoneDetails.map((m, i) => {
              const isDone = m.status === "DONE";
              const isOverdue = m.overdueDays > 0;
              const hasRange = m.fromValue != null && m.toValue != null && m.toValue !== m.fromValue;
              const range = m.toValue! - m.fromValue!;
              const currentValue = hasRange
                ? Math.round(m.fromValue! + (range * m.percentDone) / 100)
                : null;

              return (
                <li key={i} className="py-3">
                  {/* Row 1: icon + title + percent badge */}
                  <div className="flex items-start gap-2.5">
                    {/* Status icon */}
                    <div className="mt-0.5 shrink-0">
                      {isDone ? (
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-white text-[9px]">✓</span>
                      ) : isOverdue ? (
                        <span className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-red-400 text-red-400 text-[9px]">!</span>
                      ) : (
                        <span className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-gray-300 dark:border-gray-600" />
                      )}
                    </div>

                    {/* Title + meta */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium leading-snug ${isDone ? "line-through text-gray-400 dark:text-gray-500" : "text-gray-800 dark:text-gray-200"}`}>
                        {m.title}
                      </p>
                      {/* Due date row */}
                      {(m.deadline || m.assignee) && (
                        <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-gray-400 dark:text-gray-500">
                          {isOverdue && !isDone && (
                            <span className="flex items-center gap-0.5 text-red-500 dark:text-red-400">
                              ⏰ Trễ hạn {formatOverdue(m.overdueDays)}
                            </span>
                          )}
                          {!isOverdue && m.deadline && (
                            <span className="flex items-center gap-0.5">
                              📅 {m.deadline}
                            </span>
                          )}
                          {m.assignee && (
                            <span>{m.assignee}</span>
                          )}
                        </div>
                      )}

                      {/* Progress bar */}
                      {!isDone && (
                        <div className="mt-2">
                          {hasRange && (
                            <div className="flex items-center justify-between text-[11px] text-gray-400 dark:text-gray-500 mb-1">
                              <span>{m.fromValue!.toLocaleString()}</span>
                              <span className="font-medium text-gray-600 dark:text-gray-400">
                                {currentValue!.toLocaleString()}
                              </span>
                              <span>{m.toValue! >= 1000 ? `${(m.toValue! / 1000).toFixed(0)}K` : m.toValue}</span>
                            </div>
                          )}
                          <div className="relative h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${isOverdue ? "bg-red-400" : "bg-blue-500"}`}
                              style={{ width: `${Math.min(m.percentDone, 100)}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Percent badge */}
                    <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                      isDone
                        ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                        : isOverdue
                          ? "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300"
                          : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                    }`}>
                      {m.percentDone}%
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {/* Actions */}
      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
        Đề xuất hành động
      </p>
      <ul className="mt-1.5 space-y-0">
        {goal.actions.map((action, i) => (
          <li
            key={i}
            className="flex items-start gap-2 border-b border-gray-50 py-2 text-xs text-gray-700 last:border-none dark:border-gray-800 dark:text-gray-300"
          >
            <span
              className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${cfg.dot}`}
            />
            {action}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── GoalCardList ─────────────────────────────────────────────────────────────

export function GoalCardList({ goals }: { goals: GoalData[] }) {
  return (
    <div className="flex flex-col gap-3 py-1">
      {goals.map((goal, i) => (
        <GoalCard key={i} goal={goal} />
      ))}
    </div>
  );
}

// ─── GoalListItem (collapsible row for list mode) ─────────────────────────────

function GoalListItem({ rock, index }: { rock: GoalListRock; index: number }) {
  const [open, setOpen] = useState(false);
  const cfg = RISK_CONFIG[rock.risk] ?? RISK_CONFIG.LOW;
  const isOverdue = rock.overdueDays > 0;

  return (
    <div className="rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
      {/* Collapsed row — always visible */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
      >
        {/* Index */}
        <span className="text-xs text-gray-400 dark:text-gray-500 w-5 shrink-0 text-right">
          {index + 1}.
        </span>

        {/* Risk dot */}
        <span className={`h-2 w-2 shrink-0 rounded-full ${cfg.dot}`} />

        {/* Title */}
        <span className="flex-1 text-sm font-medium text-gray-900 dark:text-white truncate">
          {rock.title}
        </span>

        {/* Right meta */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Progress bar pill */}
          <div className="hidden sm:flex items-center gap-1.5">
            <div className="w-16 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
              <div
                className={`h-full rounded-full ${cfg.bar}`}
                style={{ width: `${Math.min(rock.percentDone, 100)}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400 w-8">
              {rock.percentDone}%
            </span>
          </div>

          {/* Overdue badge */}
          {isOverdue ? (
            <span className="text-xs text-red-600 dark:text-red-400 font-medium">
              ⚠ {rock.overdueDays}n
            </span>
          ) : (
            <span className="text-xs text-blue-600 dark:text-blue-400">
              +{Math.abs(rock.overdueDays)}n
            </span>
          )}

          {/* Risk badge */}
          <span className={`hidden sm:inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${cfg.badge}`}>
            {cfg.label}
          </span>

          {/* Chevron */}
          <svg
            className={`h-4 w-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-gray-50 dark:border-gray-800">
          {/* Rock meta */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 pt-3 pb-2 text-xs text-gray-500 dark:text-gray-400">
            <span>
              Phụ trách:{" "}
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {rock.owner}
              </span>
            </span>
            <span>
              Tiến độ:{" "}
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {rock.percentDone}%
              </span>
            </span>
          </div>

          {/* Overall progress bar */}
          <div className="mx-4 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div
              className={`h-full rounded-full ${cfg.bar}`}
              style={{ width: `${Math.min(rock.percentDone, 100)}%` }}
            />
          </div>

          {/* Milestone list */}
          {rock.milestoneList && rock.milestoneList.length > 0 && (
            <ul className="mt-2 divide-y divide-gray-50 dark:divide-gray-800 px-4 pb-3">
              {rock.milestoneList.map((m, i) => {
                const isDone = m.status === "DONE";
                const mOverdue = (m.isOverdue ?? m.overdueDays > 0);
                const hasRange =
                  m.fromValue != null &&
                  m.toValue != null &&
                  m.toValue !== m.fromValue;

                return (
                  <li key={i} className="py-2.5">
                    <div className="flex items-start gap-2.5">
                      {/* Status icon */}
                      <div className="mt-0.5 shrink-0">
                        {isDone ? (
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-white text-[9px]">✓</span>
                        ) : mOverdue ? (
                          <span className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-red-400 text-red-400 text-[9px]">!</span>
                        ) : (
                          <span className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-gray-300 dark:border-gray-600" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium leading-snug ${isDone ? "line-through text-gray-400 dark:text-gray-500" : "text-gray-800 dark:text-gray-200"}`}>
                          {m.title}
                        </p>
                        {/* Meta */}
                        <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-gray-400 dark:text-gray-500">
                          {mOverdue && !isDone && (
                            <span className="text-red-500 dark:text-red-400">
                              ⏰ Trễ {formatOverdue(m.overdueDays)}
                            </span>
                          )}
                          {!mOverdue && m.deadline && !isDone && (
                            <span>📅 {m.deadline}</span>
                          )}
                          {m.assignee && <span>{m.assignee}</span>}
                        </div>

                        {/* Progress bar */}
                        {!isDone && (
                          <div className="mt-1.5">
                            {hasRange && (
                              <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-500 mb-0.5">
                                <span>{m.fromValue!.toLocaleString()}</span>
                                {m.currentValue != null && (
                                  <span className="font-medium text-gray-600 dark:text-gray-400">
                                    {m.currentValue.toLocaleString()}
                                  </span>
                                )}
                                <span>
                                  {m.toValue! >= 1000
                                    ? `${(m.toValue! / 1000).toFixed(0)}K`
                                    : m.toValue}
                                </span>
                              </div>
                            )}
                            <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${mOverdue ? "bg-red-400" : "bg-blue-500"}`}
                                style={{ width: `${Math.min(m.percentDone, 100)}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Percent badge */}
                      <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                        isDone
                          ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                          : mOverdue
                            ? "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                      }`}>
                        {m.percentDone}%
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ─── GoalListView ─────────────────────────────────────────────────────────────

export function GoalListView({ rocks }: { rocks: GoalListRock[] }) {
  return (
    <div className="flex flex-col gap-1.5 py-1">
      {rocks.map((rock, i) => (
        <GoalListItem key={i} rock={rock} index={i} />
      ))}
    </div>
  );
}

// ─── Parser ───────────────────────────────────────────────────────────────────
// Extracts the first JSON object/array in a ```json block.
// Returns a typed ParsedGoalResponse or null.

export function parseGoalsFromText(text: string): ParsedGoalResponse | null {
  try {
    const fenced = text.match(/```json\s*([\s\S]*?)```/);
    if (!fenced) return null;

    const raw = JSON.parse(fenced[1]);
    const summary = text.replace(/```json[\s\S]*?```/, "").trim();

    // Discriminated by "type" field on object, or by array shape
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      if (raw.type === "goal-list" && Array.isArray(raw.rocks) && raw.rocks.length > 0) {
        return { type: "goal-list", rocks: raw.rocks as GoalListRock[], summary };
      }
      if (raw.type === "goal-detail" && Array.isArray(raw.goals) && raw.goals.length > 0) {
        return { type: "goal-detail", goals: raw.goals as GoalData[], summary };
      }
    }

    // Legacy: bare array with GoalData (backward compat)
    if (Array.isArray(raw) && raw.length > 0 && raw[0].title && raw[0].risk) {
      // Detect list vs detail by presence of milestoneDetails or actions array
      const isDetail = raw.some((r: GoalData) => r.milestoneDetails && r.milestoneDetails.length > 0);
      if (isDetail) {
        return { type: "goal-detail", goals: raw as GoalData[], summary };
      }
      // Treat as goal-list if items have single "action" string
      if ("action" in raw[0]) {
        return { type: "goal-list", rocks: raw as GoalListRock[], summary };
      }
      return { type: "goal-detail", goals: raw as GoalData[], summary };
    }

    return null;
  } catch {
    return null;
  }
}
