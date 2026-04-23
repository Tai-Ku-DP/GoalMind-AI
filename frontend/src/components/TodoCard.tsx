"use client";

import React, { useState } from "react";
import dayjs from "dayjs";
import { ChevronUp, ChevronDown, Equal } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Đồng bộ với Simplamo: NOT_STARTED | PLAN | ON_TRACK | DONE */
export type TodoStatus = "NOT_STARTED" | "PLAN" | "ON_TRACK" | "DONE";
export type TodoPriority = "HIGH" | "MEDIUM" | "LOW" | "NONE";

export interface TodoOwner {
  fullName?: string;
  avatar?: string;
}

export interface TodoItem {
  id: string;
  title: string;
  status: TodoStatus;
  dueDate: string | null;
  priorityType: TodoPriority;
  description?: string;
  owner?: TodoOwner;
  isPrivated?: boolean;
}

export interface SuggestedAction {
  title: string;
  dueDate: string;
  priorityType: TodoPriority;
  description: string;
  rockId?: string;
}

// ─── Status Icons (mirror Simplamo's IconStatusPlan / IconStatusOnTrack / CheckTick) ─────

/** NOT_STARTED → vòng tròn rỗng (giống CheckTick isActive=false type="circle") */
function IconNotStarted() {
  return (
    <span
      title="Chưa bắt đầu"
      style={{ display: "inline-flex", alignItems: "center" }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="9" cy="9" r="8" stroke="#D1D5DB" strokeWidth="1.5" />
      </svg>
    </span>
  );
}

/** PLAN → hình vuông với chấm ở giữa (giống IconStatusPlan) */
function IconPlan() {
  return (
    <span
      title="Kế hoạch"
      style={{ display: "inline-flex", alignItems: "center" }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect
          x="1.5"
          y="1.5"
          width="15"
          height="15"
          rx="3.5"
          stroke="#9CA3AF"
          strokeWidth="1.5"
        />
        <rect x="6" y="6" width="6" height="6" rx="1.5" fill="#9CA3AF" />
      </svg>
    </span>
  );
}

/** ON_TRACK → vòng tròn với phần tư fill + hiệu ứng xoay (giống IconStatusOnTrack) */
function IconOnTrack() {
  return (
    <span
      title="Đang thực hiện"
      style={{ display: "inline-flex", alignItems: "center" }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          animation: "spin-slow 3s linear infinite",
        }}
      >
        <circle cx="9" cy="9" r="8" stroke="#F59E0B" strokeWidth="1.5" />
        {/* 3/4 arc filled */}
        <path
          d="M9 9 L9 1 A8 8 0 1 1 1 9 Z"
          fill="#F59E0B"
          fillOpacity="0.25"
        />
        <circle cx="9" cy="1" r="2" fill="#F59E0B" />
      </svg>
      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </span>
  );
}

/** DONE → vòng tròn có dấu tick (giống CheckTick isActive=true type="circle") */
function IconDone() {
  return (
    <span
      title="Hoàn thành"
      style={{ display: "inline-flex", alignItems: "center" }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="9" cy="9" r="9" fill="#22C55E" />
        <path
          d="M5.5 9.5L7.5 11.5L12.5 6.5"
          stroke="white"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

// ─── Priority Badge (giống Simplamo's PriorityType) ───────────────────────────

const PRIORITY_CONFIG: Record<
  TodoPriority,
  {
    label: string;
    badgeColor: string;
    icon: React.ReactNode;
  }
> = {
  HIGH: {
    label: "Cao",
    icon: <ChevronUp size={12} className="shrink-0 text-red-500" />,
    badgeColor:
      "bg-red-50 text-red-600 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800",
  },
  MEDIUM: {
    label: "TB",
    icon: <Equal size={12} className="shrink-0 text-yellow-500" />,
    badgeColor:
      "bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
  },
  LOW: {
    label: "Thấp",
    icon: <ChevronDown size={12} className="shrink-0 text-blue-500" />,
    badgeColor:
      "bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800",
  },
  NONE: {
    label: "",
    icon: null,
    badgeColor: "",
  },
};

/** Map status → icon component */
function StatusIcon({ status }: { status: TodoStatus }) {
  switch (status) {
    case "DONE":
      return <IconDone />;
    case "ON_TRACK":
      return <IconOnTrack />;
    case "PLAN":
      return <IconPlan />;
    case "NOT_STARTED":
    default:
      return <IconNotStarted />;
  }
}

function StatusLabel({ status }: { status: TodoStatus }) {
  const map: Record<TodoStatus, { label: string; color: string }> = {
    NOT_STARTED: { label: "Chưa bắt đầu", color: "text-gray-400" },
    PLAN: { label: "Kế hoạch", color: "text-gray-500" },
    ON_TRACK: { label: "Đang thực hiện", color: "text-amber-500" },
    DONE: { label: "Hoàn thành", color: "text-green-500" },
  };
  const cfg = map[status] ?? map.NOT_STARTED;
  return (
    <span className={`text-[10px] font-medium ${cfg.color}`}>{cfg.label}</span>
  );
}

// ─── Date helper ──────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function isOverdue(iso: string | null, status: TodoStatus): boolean {
  if (!iso || status === "DONE") return false;
  return dayjs(iso).isBefore(dayjs(), "day");
}

// ─── Owner Avatar (mini, giống Simplamo AvatarOwner) ─────────────────────────

function OwnerAvatar({
  owner,
}: {
  owner?: { fullName?: string; avatar?: string };
}) {
  if (!owner) return null;
  const initials = (owner.fullName ?? "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <span
      title={owner.fullName}
      className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-[9px] font-bold text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-300 shrink-0 overflow-hidden border border-white dark:border-gray-700 shadow-sm"
    >
      {owner.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={owner.avatar}
          alt={owner.fullName}
          className="h-full w-full object-cover"
        />
      ) : (
        initials
      )}
    </span>
  );
}

// ─── API helper ───────────────────────────────────────────────────────────────

async function apiCreateTodo(
  action: SuggestedAction,
  ownerId?: string,
): Promise<{ id: string }> {
  const res = await fetch("/api/todos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: action.title,
      dueDate: action.dueDate,
      priorityType: action.priorityType || "MEDIUM",
      description: action.description,
      ...(action.rockId ? { rockId: action.rockId } : {}),
      ...(ownerId ? { ownerId } : {}),
    }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(err.message ?? `HTTP ${res.status}`);
  }
  const data = (await res.json()) as { todo: { _id: string } };
  return { id: data.todo?._id ?? "" };
}

// ─── Quick Create Action Button ───────────────────────────────────────────────

export function QuickCreateActionButton({
  rockId,
  actionText,
  ownerId,
}: {
  actionText: string;
  ownerId?: string;
  rockId?: string;
}) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );

  const handleCreate = async () => {
    setState("loading");
    try {
      await apiCreateTodo(
        {
          title: actionText,
          dueDate: dayjs().add(3, "day").toISOString(),
          priorityType: "HIGH",
          description: "",
          ...(rockId ? { rockId } : {}),
        },
        ownerId,
      );
      setState("done");
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 3000);
    }
  };

  if (state === "done") {
    return (
      <span className="shrink-0 rounded-lg bg-green-100 px-2.5 py-1 text-[10px] font-semibold text-green-700 dark:bg-green-950 dark:text-green-300">
        ✅ Đã tạo
      </span>
    );
  }

  if (state === "error") {
    return (
      <span className="shrink-0 rounded-lg bg-red-100 px-2.5 py-1 text-[10px] font-semibold text-red-600 dark:bg-red-950 dark:text-red-300">
        Lỗi
      </span>
    );
  }

  return (
    <button
      onClick={handleCreate}
      disabled={state === "loading"}
      className={[
        "shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-semibold transition-all active:scale-95",
        state === "loading"
          ? "cursor-wait bg-gray-100 text-gray-400 dark:bg-gray-800"
          : "bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-400 dark:hover:bg-blue-900/60",
      ].join(" ")}
    >
      {state === "loading" ? "..." : "➕ Tạo nhanh"}
    </button>
  );
}

// ─── Single Todo Row (giống Simplamo todo-item layout) ───────────────────────
// Hiển thị thông tin, không có action (chỉ xem)

export function TodoRow({ todo }: { todo: TodoItem }) {
  const priority =
    todo.priorityType !== "NONE"
      ? PRIORITY_CONFIG[todo.priorityType] ?? PRIORITY_CONFIG.MEDIUM
      : null;

  const overdue = isOverdue(todo.dueDate, todo.status);
  const isDone = todo.status === "DONE";

  return (
    <div
      className={[
        "group flex items-center gap-3 border-b px-4 py-3 transition-colors",
        "bg-white dark:bg-gray-900",
        "border-gray-100 dark:border-gray-800",
        "hover:bg-gray-50/60 dark:hover:bg-gray-800/40",
      ].join(" ")}
    >
      {/* ── Left: Status icon (giống PopoverStatuses > StatusItem) */}
      <span className="shrink-0">
        <StatusIcon status={todo.status} />
      </span>

      {/* ── Center: Title + meta */}
      <div className="min-w-0 flex-1">
        {/* Title */}
        <p
          className={[
            "text-sm font-medium leading-snug truncate",
            isDone
              ? "line-through text-gray-400 dark:text-gray-500"
              : "text-gray-900 dark:text-white",
          ].join(" ")}
        >
          {todo.title}
        </p>

        {/* Description (1 line, muted) */}
        {todo.description && (
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
            {todo.description}
          </p>
        )}

        {/* Meta row: status label · due date · priority */}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          {/* Status label */}
          <StatusLabel status={todo.status} />

          {/* Due date (giống DueDate component) */}
          <span
            className={[
              "flex items-center gap-1 text-[11px]",
              overdue
                ? "text-red-500 font-medium"
                : "text-gray-400 dark:text-gray-500",
            ].join(" ")}
          >
            {/* Calendar icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3 w-3 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            {overdue && <span className="mr-0.5">⚠</span>}
            {fmtDate(todo.dueDate)}
          </span>

          {/* Priority badge (giống PriorityType component) */}
          {priority && priority.label && (
            <span
              className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${priority.badgeColor}`}
            >
              {priority.icon}
              {priority.label}
            </span>
          )}

          {/* Private badge */}
          {todo.isPrivated && (
            <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500 dark:bg-gray-800 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
              🔒 Riêng tư
            </span>
          )}
        </div>
      </div>

      {/* ── Right: Owner avatar (giống AvatarOwner) */}
      <OwnerAvatar owner={todo.owner} />
    </div>
  );
}

// ─── Suggested Action Row (with "Tạo Todo" button) ───────────────────────────

export function SuggestedActionRow({ action }: { action: SuggestedAction }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [errorMsg, setErrorMsg] = useState<string>("");
  const priority =
    action.priorityType !== "NONE"
      ? PRIORITY_CONFIG[action.priorityType] ?? PRIORITY_CONFIG.MEDIUM
      : null;

  const handleCreate = async () => {
    setState("loading");
    setErrorMsg("");
    try {
      await apiCreateTodo(action);
      setState("done");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi không xác định";
      setErrorMsg(msg);
      setState("error");
    }
  };

  return (
    <div className="flex items-start gap-3 border-b border-blue-100/60 bg-blue-50/40 px-4 py-3 dark:border-blue-900/30 dark:bg-blue-950/10">
      {/* Status icon: NOT_STARTED để gợi ý chưa tạo */}
      <span className="shrink-0 mt-0.5">
        <IconNotStarted />
      </span>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug text-gray-900 dark:text-white">
          {action.title}
        </p>
        {action.description && (
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {action.description}
          </p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-1 text-[11px] text-gray-400">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3 w-3 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            {fmtDate(action.dueDate)}
          </span>
          {priority && priority.label && (
            <span
              className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${priority.badgeColor}`}
            >
              {priority.icon}
              {priority.label}
            </span>
          )}
        </div>
        {state === "error" && (
          <p className="mt-1 text-[11px] text-red-500">{errorMsg}</p>
        )}
      </div>

      {/* Create button */}
      <button
        onClick={handleCreate}
        disabled={state === "loading" || state === "done"}
        className={[
          "ml-2 shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
          state === "done"
            ? "cursor-default bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
            : state === "loading"
              ? "cursor-wait bg-gray-100 text-gray-400 dark:bg-gray-800"
              : "bg-blue-600 text-white hover:bg-blue-700 active:scale-95",
        ].join(" ")}
      >
        {state === "done" ? "✅ Đã tạo" : state === "loading" ? "..." : "➕ Tạo Todo"}
      </button>
    </div>
  );
}

// ─── Todo List View ───────────────────────────────────────────────────────────

export interface TodoListPayload {
  type: "today" | "overdue" | "all";
  count: number;
  date: string;
  todos: TodoItem[];
}

export function TodoListView({ payload }: { payload: TodoListPayload }) {
  const { type, count, date, todos } = payload;

  const headerConfig: Record<
    string,
    { icon: string; label: string; emptyMsg: string; badgeColor: string }
  > = {
    today: {
      icon: "🟡",
      label: "Todo hôm nay",
      emptyMsg: "Không có todo nào hôm nay.",
      badgeColor:
        "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    },
    overdue: {
      icon: "🔴",
      label: "Trễ hạn",
      emptyMsg: "Không có todo nào trễ hạn. Tốt lắm!",
      badgeColor: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
    },
    all: {
      icon: "📋",
      label: "Tất cả Todo",
      emptyMsg: "Chưa có todo nào trong team.",
      badgeColor:
        "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    },
  };

  const cfg = headerConfig[type] ?? headerConfig.all;

  return (
    <div className="flex flex-col py-1">
      {/* Header */}
      <div className="mb-2 flex items-center gap-2 px-4">
        <span
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${cfg.badgeColor}`}
        >
          {cfg.icon} {count} {cfg.label}
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {fmtDate(date)}
        </span>
      </div>

      {/* Items — dạng table-item giống Simplamo */}
      <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
        {todos.length === 0 ? (
          <p className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
            {cfg.emptyMsg}
          </p>
        ) : (
          todos.map((t) => <TodoRow key={t.id} todo={t} />)
        )}
      </div>
    </div>
  );
}

// ─── Suggested Actions List ───────────────────────────────────────────────────

export function SuggestedActionsView({
  actions,
}: {
  actions: SuggestedAction[];
}) {
  if (!actions.length) return null;
  return (
    <div className="flex flex-col gap-1 py-1">
      <p className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
        Hành động gợi ý
      </p>
      <div className="overflow-hidden rounded-xl border border-blue-100 dark:border-blue-900/40 shadow-sm">
        {actions.map((a, i) => (
          <SuggestedActionRow key={i} action={a} />
        ))}
      </div>
    </div>
  );
}

// ─── Parser helpers ───────────────────────────────────────────────────────────

export function parseSuggestedActionsFromText(
  text: string,
): SuggestedAction[] | null {
  try {
    const fenced = text.match(/```json\s*([\s\S]*?)```/);
    if (!fenced) return null;
    const raw = JSON.parse(fenced[1]);
    if (Array.isArray(raw) && raw.length > 0 && "title" in raw[0]) {
      return raw as SuggestedAction[];
    }
    return null;
  } catch {
    return null;
  }
}
