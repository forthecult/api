import type { Metadata } from "next";

import { ChatPageClient } from "./chat-page-client";

export const metadata: Metadata = {
  description: "Chat with your AI agent",
  robots: { follow: false, index: false },
  title: "AI Chat",
};

export default function ChatPage() {
  return <ChatPageClient />;
}
