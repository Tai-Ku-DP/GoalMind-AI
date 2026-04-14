import { GoalMindRuntimeProvider } from "@/components/goalmind-runtime";
import { ChatUI } from "@/components/chat-ui";

export default function ChatPage() {
  return (
    <GoalMindRuntimeProvider>
      <main className="flex h-screen flex-col bg-gray-50 dark:bg-gray-900">
        <ChatUI />
      </main>
    </GoalMindRuntimeProvider>
  );
}
