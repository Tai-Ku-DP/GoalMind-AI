"use client";

import {
  ThreadPrimitive,
  MessagePrimitive,
  ComposerPrimitive,
  useMessage,
} from "@assistant-ui/react";
import {
  GoalCardList,
  GoalListView,
  parseGoalsFromText,
} from "./GoalCard";
import { useToolProgress } from "./goalmind-runtime";

// ─── Tool label map ───────────────────────────────────────────────────────────

const TOOL_LABELS: Record<string, { label: string; icon: string }> = {
  listGoals:        { label: "Đang lấy danh sách mục tiêu",   icon: "🎯" },
  getGoalDetail:    { label: "Đang phân tích chi tiết goal",   icon: "🔍" },
  updateGoalStatus: { label: "Đang cập nhật trạng thái goal",  icon: "✏️" },
  listMetrics:      { label: "Đang lấy danh sách chỉ số",      icon: "📊" },
  getMetricValues:  { label: "Đang đọc số liệu chỉ số",        icon: "📈" },
  getOffTrackMetrics: { label: "Đang tìm chỉ số lệch mục tiêu", icon: "⚠️" },
  getTeamScorecard: { label: "Đang tải scorecard nhóm",        icon: "🏆" },
  listActions:      { label: "Đang lấy danh sách công việc",   icon: "✅" },
  createAction:     { label: "Đang tạo công việc mới",         icon: "➕" },
  updateActionStatus: { label: "Đang cập nhật công việc",      icon: "🔄" },
  parseNaturalDate: { label: "Đang xử lý ngày tháng",          icon: "📅" },
};

// ─── Tool progress indicator (like Claude's "Searching...") ──────────────────

function ToolProgressIndicator({ tool }: { tool: string | null }) {
  const info = tool ? TOOL_LABELS[tool] : null;
  const icon = info?.icon ?? "⚙️";
  const label = info?.label ?? (tool ? `Đang dùng ${tool}` : "Đang xử lý");

  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-blue-100 bg-blue-50 px-3.5 py-2.5 dark:border-blue-900 dark:bg-blue-950/40">
      <span className="text-base">{icon}</span>
      <span className="text-sm text-blue-700 dark:text-blue-300">{label}...</span>
      <span className="ml-auto flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-blue-400 dark:bg-blue-500"
            style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
          />
        ))}
      </span>
    </div>
  );
}

// ─── Skeleton shown while JSON is streaming ───────────────────────────────────
function GoalSkeleton() {
  return (
    <div className="flex flex-col gap-2 py-1 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-12 rounded-xl bg-gray-100 dark:bg-gray-800" />
      ))}
    </div>
  );
}

// ─── Smart AssistantMessage ───────────────────────────────────────────────────
// Checks if message content is a goal JSON block.
// If yes → renders GoalCardList. Otherwise → renders normal text.

function AssistantMessageContent() {
  const message = useMessage();
  const { activeTool } = useToolProgress();

  const rawText = message.content
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("");

  const isStreaming = message.status?.type === "running";
  const jsonStarted = rawText.includes("```json");
  const jsonComplete = /```json[\s\S]*?```/.test(rawText);

  // No text yet + streaming → show which tool is running (like Claude)
  if (isStreaming && !rawText) {
    return <ToolProgressIndicator tool={activeTool} />;
  }

  // JSON block detected but not yet closed → show skeleton instead of raw text
  if (isStreaming && jsonStarted && !jsonComplete) {
    return <GoalSkeleton />;
  }

  // JSON block complete → parse and render cards
  if (jsonComplete) {
    const parsed = parseGoalsFromText(rawText);
    if (parsed) {
      return (
        <div className="flex flex-col gap-3">
          {parsed.type === "goal-list" ? (
            <GoalListView rocks={parsed.rocks} />
          ) : (
            <GoalCardList goals={parsed.goals} />
          )}
          {parsed.summary && (
            <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
              {parsed.summary}
            </p>
          )}
        </div>
      );
    }
  }

  // Normal text (no JSON) → render as-is
  return <MessagePrimitive.Content />;
}

// ─── Messages ─────────────────────────────────────────────────────────────────

function UserMessage() {
  return (
    <MessagePrimitive.Root className="flex justify-end px-4 py-2">
      <div className="max-w-[80%] rounded-2xl rounded-br-md bg-blue-600 px-4 py-2.5 text-white">
        <MessagePrimitive.Content />
      </div>
    </MessagePrimitive.Root>
  );
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="flex justify-start px-4 py-2">
      <div className="flex w-full max-w-[80%] gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-sm text-white">
          AI
        </div>
        <div className="min-w-0 flex-1 rounded-2xl rounded-bl-md bg-white px-4 py-2.5 text-gray-900 shadow-sm dark:bg-gray-800 dark:text-gray-100">
          <AssistantMessageContent />
        </div>
      </div>
    </MessagePrimitive.Root>
  );
}

function ChatMessage() {
  return (
    <>
      <MessagePrimitive.If user>
        <UserMessage />
      </MessagePrimitive.If>
      <MessagePrimitive.If assistant>
        <AssistantMessage />
      </MessagePrimitive.If>
    </>
  );
}

// ─── Composer ─────────────────────────────────────────────────────────────────

function Composer() {
  return (
    <ComposerPrimitive.Root className="flex items-end gap-2 border-t border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
      <ComposerPrimitive.Input
        placeholder="Hỏi về mục tiêu, chỉ số, hoặc công việc..."
        className="flex-1 resize-none rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        autoFocus
      />
      <ComposerPrimitive.Send className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700 disabled:opacity-40">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-5 w-5"
        >
          <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
        </svg>
      </ComposerPrimitive.Send>
    </ComposerPrimitive.Root>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <ThreadPrimitive.Empty>
      <div className="flex h-full flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 text-3xl text-white shadow-lg">
          🎯
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Xin chào! Tôi là GoalMind AI
          </h2>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            Hỏi tôi về mục tiêu, chỉ số hay công việc trên Simplamo
          </p>
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {[
            "Danh sách mục tiêu hiện tại?",
            "Chỉ số nào đang off-track?",
            "Tôi cần làm gì tuần này?",
          ].map((suggestion) => (
            <ThreadPrimitive.Suggestion
              key={suggestion}
              prompt={suggestion}
              autoSend
              className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-blue-600"
            >
              {suggestion}
            </ThreadPrimitive.Suggestion>
          ))}
        </div>
      </div>
    </ThreadPrimitive.Empty>
  );
}

// ─── ChatUI ───────────────────────────────────────────────────────────────────

export function ChatUI() {
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-950">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 text-lg text-white">
          🎯
        </div>
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            GoalMind AI
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Trợ lý quản trị doanh nghiệp — Simplamo
          </p>
        </div>
      </header>

      <ThreadPrimitive.Root className="flex flex-1 flex-col overflow-hidden">
        <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto bg-gray-50 py-4 dark:bg-gray-900">
          <EmptyState />
          <ThreadPrimitive.Messages
            components={{
              Message: ChatMessage,
            }}
          />
        </ThreadPrimitive.Viewport>
        <Composer />
      </ThreadPrimitive.Root>
    </div>
  );
}
