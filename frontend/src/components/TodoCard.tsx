"use client";

import React, { useState } from "react";
import dayjs from "dayjs";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TodoStatus = "NOT_STARTED" | "IN_PROGRESS" | "DONE";
export type TodoPriority = "HIGH" | "MEDIUM" | "LOW";

export interface TodoItem {
  id: string;
  title: string;
  status: TodoStatus;
  dueDate: string | null;
  priorityType: TodoPriority;
  description?: string;
}

export interface SuggestedAction {
  title: string;
  dueDate: string;
  priorityType: TodoPriority;
  description: string;
  rockId?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<
  TodoPriority,
  { label: string; color: string; dot: string }
> = {
  HIGH: {
    label: "Cao",
    color: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    dot: "bg-red-500",
  },
  MEDIUM: {
    label: "TB",
    color: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    dot: "bg-amber-400",
  },
  LOW: {
    label: "Thấp",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    dot: "bg-blue-400",
  },
};

const STATUS_CONFIG: Record<
  TodoStatus,
  { label: string; icon: string; color: string }
> = {
  NOT_STARTED: {
    label: "Chưa bắt đầu",
    icon: "○",
    color: "text-gray-400",
  },
  IN_PROGRESS: {
    label: "Đang làm",
    icon: "◐",
    color: "text-amber-500",
  },
  DONE: {
    label: "Hoàn thành",
    icon: "●",
    color: "text-green-500",
  },
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

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
// Nhận plain-text action từ AI, tạo Todo ngay với 1 click

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

// ─── Single Todo row ──────────────────────────────────────────────────────────

export function TodoRow({ todo }: { todo: TodoItem }) {
  const priority = PRIORITY_CONFIG[todo.priorityType] ?? PRIORITY_CONFIG.MEDIUM;
  const status = STATUS_CONFIG[todo.status] ?? STATUS_CONFIG.NOT_STARTED;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      {/* Status icon */}
      <span className={`mt-0.5 shrink-0 text-lg leading-none ${status.color}`}>
        {status.icon}
      </span>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-medium leading-snug ${
            todo.status === "DONE"
              ? "line-through text-gray-400 dark:text-gray-500"
              : "text-gray-900 dark:text-white"
          }`}
        >
          {todo.title}
        </p>
        {todo.description && (
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
            {todo.description}
          </p>
        )}
        <div className="mt-1.5 flex items-center gap-2">
          {/* Due date */}
          <span className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3 w-3"
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
            {fmtDate(todo.dueDate)}
          </span>
          {/* Priority badge */}
          <span
            className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${priority.color}`}
          >
            {priority.label}
          </span>
          {/* Status label */}
          <span className="text-[10px] text-gray-400 dark:text-gray-500">
            {status.label}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Suggested Action row (with "Tạo Todo" button) ───────────────────────────

export function SuggestedActionRow({ action }: { action: SuggestedAction }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [errorMsg, setErrorMsg] = useState<string>("");
  const priority =
    PRIORITY_CONFIG[action.priorityType] ?? PRIORITY_CONFIG.MEDIUM;

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
    <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 dark:border-blue-900/50 dark:bg-blue-950/20">
      {/* Bullet */}
      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400 dark:bg-blue-500" />

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
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 text-[11px] text-gray-400">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3 w-3"
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
          <span
            className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${priority.color}`}
          >
            {priority.label}
          </span>
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
        {state === "done"
          ? "✅ Đã tạo"
          : state === "loading"
            ? "..."
            : "➕ Tạo Todo"}
      </button>
    </div>
  );
}

// ─── Todo List view (today / overdue) ─────────────────────────────────────────

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
    <div className="flex flex-col gap-3 py-1">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${cfg.badgeColor}`}
        >
          {cfg.icon} {count} {cfg.label}
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {fmtDate(date)}
        </span>
      </div>

      {/* Items */}
      {todos.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {cfg.emptyMsg}
        </p>
      ) : (
        todos.map((t) => <TodoRow key={t.id} todo={t} />)
      )}
    </div>
  );
}

// ─── Suggested Actions list ───────────────────────────────────────────────────

export function SuggestedActionsView({
  actions,
}: {
  actions: SuggestedAction[];
}) {
  if (!actions.length) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
        Hành động gợi ý
      </p>
      {actions.map((a, i) => (
        <SuggestedActionRow key={i} action={a} />
      ))}
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
