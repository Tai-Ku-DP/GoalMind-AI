"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
  createContext,
  useContext,
} from "react";
import {
  useExternalStoreRuntime,
  AssistantRuntimeProvider,
} from "@assistant-ui/react";
import type { ThreadMessageLike, AppendMessage } from "@assistant-ui/react";
import {
  type ChatMessage,
  loadSession,
  saveSession,
  clearSession,
} from "@/lib/chat-db";

// ─── Constants ────────────────────────────────────────────────────────────────

const SESSION_ID = "default";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// ─── Tool Progress Context ────────────────────────────────────────────────────

interface ToolProgressContextValue {
  activeTool: string | null;
  /** At least one tool_end has been received in the current request. */
  toolEverEnded: boolean;
  /** First content chunk has arrived in the current request. */
  contentStarted: boolean;
  /** True while IndexedDB history is still being loaded on first mount. */
  historyLoading: boolean;
  /** Clear all chat messages and IndexedDB history. */
  clearHistory: () => Promise<void>;
}

const ToolProgressContext = createContext<ToolProgressContextValue>({
  activeTool: null,
  toolEverEnded: false,
  contentStarted: false,
  historyLoading: true,
  clearHistory: async () => {},
});

export function useToolProgress() {
  return useContext(ToolProgressContext);
}

// ─── Message converter ────────────────────────────────────────────────────────

const convertMessage = (message: ChatMessage): ThreadMessageLike => ({
  role: message.role,
  content: [{ type: "text", text: message.content }],
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function GoalMindRuntimeProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [isRunning, setIsRunning] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [toolEverEnded, setToolEverEnded] = useState(false);
  const [contentStarted, setContentStarted] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Ref always points to the latest messages — used in async callbacks
  // without capturing stale state in closures.
  const messagesRef = useRef<ChatMessage[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // ── Load history from IndexedDB on first mount ─────────────────────────────
  useEffect(() => {
    loadSession(SESSION_ID)
      .then((stored) => {
        if (stored && stored.length > 0) setMessages(stored);
      })
      .catch(() => {
        // IndexedDB unavailable (SSR, private mode) — silently ignore
      })
      .finally(() => setHistoryLoading(false));
  }, []);

  // ── Clear history ──────────────────────────────────────────────────────────
  const clearHistory = useCallback(async () => {
    setMessages([]);
    await clearSession(SESSION_ID).catch(() => {});
  }, []);

  // ── Send a new message ─────────────────────────────────────────────────────
  const onNew = useCallback(async (message: AppendMessage) => {
    const textPart = message.content.find((c) => c.type === "text");
    if (!textPart || textPart.type !== "text") return;

    const input = textPart.text;
    setMessages((prev) => [...prev, { role: "user", content: input }]);
    setIsRunning(true);
    setToolEverEnded(false);
    setContentStarted(false);

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input }),
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let assistantContent = "";

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") continue;

          try {
            const parsed = JSON.parse(payload) as {
              type?: string;
              tool?: string;
              content?: string;
            };
            if (parsed.type === "tool_start" && parsed.tool) {
              setActiveTool(parsed.tool);
            } else if (parsed.type === "tool_end") {
              setActiveTool(null);
              setToolEverEnded(true);
            } else if (parsed.content) {
              setContentStarted(true);
              assistantContent += parsed.content;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: assistantContent,
                };
                return updated;
              });
            }
          } catch {
            // skip malformed SSE chunks
          }
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      setMessages((prev) => [
        ...prev.filter((m) => m.role !== "assistant" || m.content !== ""),
        {
          role: "assistant",
          content: `Xin lỗi, đã có lỗi xảy ra: ${errorMessage}`,
        },
      ]);
    } finally {
      setIsRunning(false);
      setActiveTool(null);
      // Persist the completed conversation to IndexedDB
      saveSession(SESSION_ID, messagesRef.current).catch(() => {});
    }
  }, []);

  const runtime = useExternalStoreRuntime({
    isRunning,
    messages,
    convertMessage,
    onNew,
  });

  return (
    <ToolProgressContext.Provider
      value={{
        activeTool,
        toolEverEnded,
        contentStarted,
        historyLoading,
        clearHistory,
      }}
    >
      <AssistantRuntimeProvider runtime={runtime}>
        {children}
      </AssistantRuntimeProvider>
    </ToolProgressContext.Provider>
  );
}
