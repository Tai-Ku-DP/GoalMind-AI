"use client";

import { useState, type ReactNode, useCallback } from "react";
import {
  useExternalStoreRuntime,
  AssistantRuntimeProvider,
} from "@assistant-ui/react";
import type { ThreadMessageLike, AppendMessage } from "@assistant-ui/react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const convertMessage = (message: ChatMessage): ThreadMessageLike => ({
  role: message.role,
  content: [{ type: "text", text: message.content }],
});

export function GoalMindRuntimeProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [isRunning, setIsRunning] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const onNew = useCallback(async (message: AppendMessage) => {
    const textPart = message.content.find((c) => c.type === "text");
    if (!textPart || textPart.type !== "text") return;

    const input = textPart.text;
    setMessages((prev) => [...prev, { role: "user", content: input }]);
    setIsRunning(true);

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
            const parsed = JSON.parse(payload) as { content: string };
            assistantContent += parsed.content;
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                role: "assistant",
                content: assistantContent,
              };
              return updated;
            });
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
    }
  }, []);

  const runtime = useExternalStoreRuntime({
    isRunning,
    messages,
    convertMessage,
    onNew,
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}
