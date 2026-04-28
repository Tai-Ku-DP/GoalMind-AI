"use client";

import { FormEvent, useEffect, useState } from "react";
import { GoalMindRuntimeProvider } from "@/components/goalmind-runtime";
import { ChatUI } from "@/components/chat-ui";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const OPENAI_KEY_COOKIE_NAME = "goalmind_openai_api_key";

const getCookieValue = (name: string): string => {
  if (typeof document === "undefined") return "";
  const cookies = document.cookie ? document.cookie.split("; ") : [];
  const prefix = `${name}=`;
  const found = cookies.find((cookie) => cookie.startsWith(prefix));
  return found ? decodeURIComponent(found.slice(prefix.length)) : "";
};

export default function ChatPage() {
  const [apiKey, setApiKey] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const stored = getCookieValue(OPENAI_KEY_COOKIE_NAME);
    if (stored) {
      setApiKey(stored);
      setIsAuthorized(true);
    }
  }, []);

  const submitApiKey = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsChecking(true);
    setError("");

    try {
      const res = await fetch(`${API_URL}/api/auth/validate-openai-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });

      if (!res.ok) {
        throw new Error("OPENAI_API_KEY không hợp lệ. Vui lòng kiểm tra lại.");
      }

      document.cookie = `${OPENAI_KEY_COOKIE_NAME}=${encodeURIComponent(apiKey.trim())}; path=/; max-age=2592000; samesite=lax`;
      setIsAuthorized(true);
    } catch (err) {
      setIsAuthorized(false);
      setError(err instanceof Error ? err.message : "Xác thực thất bại.");
    } finally {
      setIsChecking(false);
    }
  };

  if (!isAuthorized) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-900">
        <form
          onSubmit={submitApiKey}
          className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
        >
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            Xác thực OPENAI_API_KEY
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Nhập API key để bắt đầu dùng GoalMind AI.
          </p>

          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            className="mt-4 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none ring-blue-500 focus:ring-2 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            required
          />

          {error ? (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={isChecking}
            className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isChecking ? "Đang xác thực..." : "Vào GoalMind"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <GoalMindRuntimeProvider>
      <main className="flex h-screen flex-col bg-gray-50 dark:bg-gray-900">
        <ChatUI />
      </main>
    </GoalMindRuntimeProvider>
  );
}
