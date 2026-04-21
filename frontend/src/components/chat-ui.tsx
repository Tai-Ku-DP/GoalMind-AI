"use client";

import {
  ThreadPrimitive,
  MessagePrimitive,
  ComposerPrimitive,
  useMessage,
} from "@assistant-ui/react";
import ReactMarkdown from "react-markdown";
import {
  GoalCardList,
  GoalListView,
  GoalListRock,
  GoalData,
  parseGoalsFromText,
} from "./GoalCard";
import {
  MetricView,
  parseMetricFromText,
  ScorecardOverviewView,
  ScorecardOfftrackView,
  ScorecardTrendView,
  ScorecardOverviewPayload,
  ScorecardOfftrackPayload,
  ScorecardTrendPayload,
  MetricItem,
} from "./MetricCard";
import { useToolProgress } from "./goalmind-runtime";
import { useState } from "react";

// ─── Markdown renderer ────────────────────────────────────────────────────────
// Renders AI text with full markdown support: **bold**, *italic*, lists, etc.
function MarkdownContent({ text }: { text: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none
        prose-p:my-1 prose-p:leading-relaxed
        prose-strong:font-semibold
        prose-ul:my-1 prose-ul:pl-4
        prose-ol:my-1 prose-ol:pl-4
        prose-li:my-0.5
        prose-code:rounded prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:text-xs dark:prose-code:bg-gray-800
        prose-hr:my-2
        text-gray-800 dark:text-gray-200">
      <ReactMarkdown>{text}</ReactMarkdown>
    </div>
  );
}

// ─── AI Thinking Steps ────────────────────────────────────────────────────────

type StepStatus = "pending" | "active" | "done";

interface ThinkingStep {
  label: string;
  status: StepStatus;
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 shrink-0 animate-spin text-blue-500"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function Checkmark() {
  return (
    <svg
      className="h-4 w-4 shrink-0 text-emerald-500"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function PendingDot() {
  return (
    <span className="flex h-4 w-4 shrink-0 items-center justify-center">
      <span className="h-1.5 w-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
    </span>
  );
}

function StepRow({ step }: { step: ThinkingStep }) {
  return (
    <div
      className={[
        "flex items-center gap-2.5 text-sm transition-opacity duration-300",
        step.status === "pending"
          ? "opacity-40"
          : "opacity-100",
      ].join(" ")}
    >
      {step.status === "active" && <Spinner />}
      {step.status === "done" && <Checkmark />}
      {step.status === "pending" && <PendingDot />}
      <span
        className={
          step.status === "done"
            ? "text-gray-500 line-through dark:text-gray-500"
            : step.status === "active"
            ? "font-medium text-blue-700 dark:text-blue-300"
            : "text-gray-400 dark:text-gray-600"
        }
      >
        {step.label}
      </span>
    </div>
  );
}

function AIThinkingSteps() {
  const { activeTool, toolEverEnded, contentStarted } = useToolProgress();

  // ── Derive per-step status from SSE event flags ──────────────────────────
  //
  // Step 1 "Đang lấy dữ liệu"
  //   active  → a tool is currently running, OR request just started (no tool ended yet)
  //   done    → at least one tool has completed AND no tool is running right now
  //
  // Step 2 "Đang phân tích với AI"
  //   shown   → step 1 is done
  //   active  → step 1 done & no content has arrived yet
  //   done    → first content chunk received
  //
  // Step 3 "Đang tạo kết quả"
  //   shown   → step 2 is done
  //   active  → content started arriving (this flashes briefly before the
  //             parent hides the whole component and shows streamed text)

  const step1Finished = toolEverEnded && activeTool === null;

  const step1: StepStatus = step1Finished ? "done" : "active";
  const step2: StepStatus = !step1Finished
    ? "pending"
    : contentStarted
    ? "done"
    : "active";
  const step3: StepStatus = contentStarted ? "active" : "pending";

  const steps: ThinkingStep[] = [
    { label: "Đang lấy dữ liệu...", status: step1 },
    { label: "Đang phân tích với AI...", status: step2 },
    { label: "Đang tạo kết quả...", status: step3 },
  ];

  // Sequential reveal: step N becomes visible only after step N-1 is done
  const visibleUpTo =
    step1 === "done" && step2 === "done"
      ? 3
      : step1 === "done"
      ? 2
      : 1;

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 dark:border-blue-900/50 dark:bg-blue-950/30">
      {steps.slice(0, visibleUpTo).map((step, i) => (
        <StepRow key={i} step={step} />
      ))}
    </div>
  );
}

// ─── Tool label map ───────────────────────────────────────────────────────────

const TOOL_LABELS: Record<string, { label: string; icon: string }> = {
  listGoals:                  { label: "Đang lấy danh sách mục tiêu",       icon: "🎯" },
  getGoalDetail:              { label: "Đang phân tích chi tiết goal",       icon: "🔍" },
  updateGoalStatus:           { label: "Đang cập nhật trạng thái goal",      icon: "✏️" },
  getScorecardMetrics:        { label: "Đang tải toàn bộ chỉ số Scorecard",  icon: "📊" },
  getOffTrackScorecardMetrics:{ label: "Đang tìm chỉ số lệch mục tiêu",     icon: "⚠️" },
  getScorecardTrend:          { label: "Đang phân tích xu hướng chỉ số",     icon: "📈" },
  listMetrics:                { label: "Đang lấy danh sách chỉ số",          icon: "📊" },
  getMetricValues:            { label: "Đang đọc số liệu chỉ số",            icon: "📈" },
  getTeamScorecard:           { label: "Đang tải scorecard nhóm",            icon: "🏆" },
  listActions:                { label: "Đang lấy danh sách công việc",       icon: "✅" },
  createAction:               { label: "Đang tạo công việc mới",             icon: "➕" },
  updateActionStatus:         { label: "Đang cập nhật công việc",            icon: "🔄" },
  parseNaturalDate:           { label: "Đang xử lý ngày tháng",              icon: "📅" },
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

// ─── NDJSON progressive renderer ─────────────────────────────────────────────
// The backend emits a ```ndjson block where:
//   Line 1  → header object containing { _ndjson: "schema-name", ...summary }
//   Line 2+ → one JSON object per line (one card per line)
//
// Because the model streams token-by-token, we parse every complete line
// and render each card the moment its line ends — no waiting for the full block.

interface NdjsonBlock {
  schema: string | null;
  header: Record<string, unknown> | null;
  items: unknown[];
  preText: string;
  postText: string;
  isClosed: boolean;
}

function parseNdjsonBlock(rawText: string): NdjsonBlock | null {
  const FENCE = "```ndjson";
  const startIdx = rawText.indexOf(FENCE);
  if (startIdx === -1) return null;

  const afterFence = rawText.slice(startIdx + FENCE.length);
  const closeIdx = afterFence.indexOf("```");
  const isClosed = closeIdx >= 0;
  const blockContent = isClosed ? afterFence.slice(0, closeIdx) : afterFence;

  const preText = rawText.slice(0, startIdx).trim();
  const postText = isClosed ? afterFence.slice(closeIdx + 3).trim() : "";

  // While streaming, the last line might be incomplete → skip it.
  const rawLines = blockContent.split("\n");
  const candidateLines = (isClosed ? rawLines : rawLines.slice(0, -1))
    .map((l) => l.trim())
    .filter(Boolean);

  let header: Record<string, unknown> | null = null;
  const items: unknown[] = [];

  for (const line of candidateLines) {
    try {
      const obj = JSON.parse(line) as Record<string, unknown>;
      if ("_ndjson" in obj) {
        header = obj;
      } else {
        items.push(obj);
      }
    } catch {
      // partial or malformed line — skip
    }
  }

  return {
    schema: header ? (header._ndjson as string) : null,
    header,
    items,
    preText,
    postText,
    isClosed,
  };
}

// Single skeleton for the "next card loading" slot
function ItemSkeleton() {
  return (
    <div className="h-12 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
  );
}

// goal-list: shows summary badges immediately (from header), then items appear one-by-one
function NdjsonGoalListView({
  rocks,
  header,
  isStreaming,
}: {
  rocks: GoalListRock[];
  header: Record<string, unknown> | null;
  isStreaming: boolean;
}) {
  const highCount = (header?.highCount as number | undefined) ?? 0;
  const mediumCount = (header?.mediumCount as number | undefined) ?? 0;
  const lowCount = (header?.lowCount as number | undefined) ?? 0;
  const doneCount = (header?.doneCount as number | undefined) ?? 0;

  return (
    <div className="flex flex-col gap-2">
      {header && (
        <div className="flex flex-wrap gap-1.5">
          {highCount > 0 && (
            <span className="rounded-lg bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 dark:bg-red-950 dark:text-red-300">
              HIGH 🔴 {highCount}
            </span>
          )}
          {mediumCount > 0 && (
            <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              MEDIUM 🟡 {mediumCount}
            </span>
          )}
          {lowCount > 0 && (
            <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              LOW 🟢 {lowCount}
            </span>
          )}
          {doneCount > 0 && (
            <span className="rounded-lg bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700 dark:bg-green-950 dark:text-green-300">
              DONE ✅ {doneCount}
            </span>
          )}
        </div>
      )}
      {rocks.length > 0 && <GoalListView rocks={rocks} />}
      {isStreaming && <ItemSkeleton />}
    </div>
  );
}

// goal-detail: rich cards stream in one-by-one
function NdjsonGoalDetailView({
  goals,
  isStreaming,
}: {
  goals: GoalData[];
  isStreaming: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      {goals.length > 0 && <GoalCardList goals={goals} />}
      {isStreaming && <ItemSkeleton />}
    </div>
  );
}

// scorecard-overview: summary row shown immediately, metric cards stream in
function NdjsonMetricOverviewView({
  metrics,
  header,
  isStreaming,
}: {
  metrics: MetricItem[];
  header: Record<string, unknown> | null;
  isStreaming: boolean;
}) {
  if (!header) return isStreaming ? <ItemSkeleton /> : null;

  const payload: ScorecardOverviewPayload = {
    type: "scorecard-overview",
    summary: {
      total: (header.total as number) ?? 0,
      onTrack: (header.onTrack as number) ?? 0,
      warning: (header.warning as number) ?? 0,
      critical: (header.critical as number) ?? 0,
      noData: (header.noData as number) ?? 0,
    },
    metrics,
  };

  return (
    <div className="flex flex-col gap-3">
      <ScorecardOverviewView payload={payload} />
      {isStreaming && <ItemSkeleton />}
    </div>
  );
}

// scorecard-offtrack: critical/warning badges shown immediately, items stream in
function NdjsonMetricOfftrackView({
  metrics,
  header,
  isStreaming,
}: {
  metrics: MetricItem[];
  header: Record<string, unknown> | null;
  isStreaming: boolean;
}) {
  if (!header) return isStreaming ? <ItemSkeleton /> : null;

  const payload: ScorecardOfftrackPayload = {
    type: "scorecard-offtrack",
    criticalCount: (header.criticalCount as number) ?? 0,
    warningCount: (header.warningCount as number) ?? 0,
    items: metrics,
  };

  return (
    <div className="flex flex-col gap-3">
      <ScorecardOfftrackView payload={payload} />
      {isStreaming && <ItemSkeleton />}
    </div>
  );
}

// scorecard-trend: single metric deep-dive — shows the card as soon as its
// one data line completes; skeleton shown while the line is still streaming.
function NdjsonMetricTrendView({
  metrics,
  isStreaming,
}: {
  metrics: MetricItem[];
  isStreaming: boolean;
}) {
  if (metrics.length === 0) return isStreaming ? <ItemSkeleton /> : null;

  const payload: ScorecardTrendPayload = {
    type: "scorecard-trend",
    metric: metrics[0],
  };

  return <ScorecardTrendView payload={payload} />;
}

// ─── Smart AssistantMessage ───────────────────────────────────────────────────
// Rendering priority:
//  ① No text yet              → AIThinkingSteps
//  ② ```ndjson block detected → progressive item-by-item rendering (new)
//  ③ ```json partial           → pre-text + skeleton (legacy format)
//  ④ ```json complete          → full parse + render (legacy format)
//  ⑤ Plain text               → Markdown

function AssistantMessageContent() {
  const message = useMessage();
  const { activeTool, toolEverEnded } = useToolProgress();

  const rawText = message.content
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("");

  const isStreaming = message.status?.type === "running";

  // ① Nothing received yet
  if (isStreaming && !rawText) {
    // Only show fake steps when tools are actually being called
    if (activeTool !== null || toolEverEnded) {
      return <AIThinkingSteps />;
    }
    // Normal conversational question — just show a minimal typing indicator
    return (
      <span className="flex gap-1 py-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-2 w-2 rounded-full bg-gray-400 dark:bg-gray-500"
            style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
          />
        ))}
      </span>
    );
  }

  // ② NDJSON block — renders each card the moment its line arrives
  const ndjsonBlock = parseNdjsonBlock(rawText);
  if (ndjsonBlock) {
    const { schema, header, items, preText, postText, isClosed } = ndjsonBlock;
    const streaming = !isClosed;
    return (
      <div className="flex flex-col gap-3">
        {preText && <MarkdownContent text={preText} />}
        {schema === "goal-list" && (
          <NdjsonGoalListView
            rocks={items as GoalListRock[]}
            header={header}
            isStreaming={streaming}
          />
        )}
        {schema === "goal-detail" && (
          <NdjsonGoalDetailView
            goals={items as GoalData[]}
            isStreaming={streaming}
          />
        )}
        {schema === "scorecard-overview" && (
          <NdjsonMetricOverviewView
            metrics={items as MetricItem[]}
            header={header}
            isStreaming={streaming}
          />
        )}
        {schema === "scorecard-offtrack" && (
          <NdjsonMetricOfftrackView
            metrics={items as MetricItem[]}
            header={header}
            isStreaming={streaming}
          />
        )}
        {schema === "scorecard-trend" && (
          <NdjsonMetricTrendView
            metrics={items as MetricItem[]}
            isStreaming={streaming}
          />
        )}
        {postText && <MarkdownContent text={postText} />}
      </div>
    );
  }

  // ③ / ④  Legacy ```json format — kept for backward compatibility
  const jsonStartIndex = rawText.indexOf("```json");
  const jsonStarted = jsonStartIndex !== -1;
  const jsonComplete = /```json[\s\S]*?```/.test(rawText);
  const preText = jsonStarted ? rawText.slice(0, jsonStartIndex).trim() : "";

  if (isStreaming && jsonStarted && !jsonComplete) {
    return (
      <div className="flex flex-col gap-3">
        {preText && <MarkdownContent text={preText} />}
        <GoalSkeleton />
      </div>
    );
  }

  if (jsonComplete) {
    const jsonBlockMatch = rawText.match(/```json[\s\S]*?```/);
    const postText = jsonBlockMatch
      ? rawText.slice(jsonStartIndex + jsonBlockMatch[0].length).trim()
      : "";

    const metricParsed = parseMetricFromText(rawText);
    if (metricParsed) {
      return (
        <div className="flex flex-col gap-3">
          {preText && <MarkdownContent text={preText} />}
          <MetricView payload={metricParsed} />
          {postText && <MarkdownContent text={postText} />}
        </div>
      );
    }

    const goalParsed = parseGoalsFromText(rawText);
    if (goalParsed) {
      return (
        <div className="flex flex-col gap-3">
          {preText && <MarkdownContent text={preText} />}
          {goalParsed.type === "goal-list" ? (
            <GoalListView rocks={goalParsed.rocks} />
          ) : (
            <GoalCardList goals={goalParsed.goals} />
          )}
          {postText && <MarkdownContent text={postText} />}
        </div>
      );
    }
  }

  // ⑤ Pure text → markdown
  return <MarkdownContent text={rawText} />;
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

// ─── Clear History Button ─────────────────────────────────────────────────────

function ClearHistoryButton() {
  const { clearHistory, historyLoading } = useToolProgress();
  const [confirming, setConfirming] = useState(false);

  if (historyLoading) return null;

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Xoá lịch sử?
        </span>
        <button
          onClick={async () => {
            await clearHistory();
            setConfirming(false);
          }}
          className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-200 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900"
        >
          Xác nhận
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          Huỷ
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      title="Xoá lịch sử trò chuyện"
      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-300"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
        <path d="M10 11v6M14 11v6" />
        <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
      </svg>
      Xoá lịch sử
    </button>
  );
}

// ─── ChatUI ───────────────────────────────────────────────────────────────────

export function ChatUI() {
  const { historyLoading } = useToolProgress();

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-950">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 text-lg text-white">
          🎯
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            GoalMind AI
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Trợ lý quản trị doanh nghiệp — Simplamo
          </p>
        </div>
        <ClearHistoryButton />
      </header>

      <ThreadPrimitive.Root className="flex flex-1 flex-col overflow-hidden">
        <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto bg-gray-50 py-4 dark:bg-gray-900">
          {historyLoading ? (
            <div className="flex h-full items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-gray-400">
                <svg
                  className="h-6 w-6 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                <span className="text-sm">Đang tải lịch sử...</span>
              </div>
            </div>
          ) : (
            <>
              <EmptyState />
              <ThreadPrimitive.Messages
                components={{
                  Message: ChatMessage,
                }}
              />
            </>
          )}
        </ThreadPrimitive.Viewport>
        <Composer />
      </ThreadPrimitive.Root>
    </div>
  );
}
