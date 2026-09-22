import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import { ChatView, type AppMessage } from "@/components/workspace/ChatView";
import { Sidebar, type ConversationRow } from "@/components/workspace/Sidebar";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Multiform · Unified AI workspace" },
      {
        name: "description",
        content:
          "One workspace for every AI model: streaming chat, file and image understanding, automatic model routing and usage tracking.",
      },
      { property: "og:title", content: "Multiform · Unified AI workspace" },
      {
        property: "og:description",
        content:
          "Chat with multiple AI models, analyze files and images, and let Auto route each task to the right model.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Workspace,
});

type DbMessage = {
  id: string;
  role: string;
  content: unknown;
  model: string | null;
  routed_reason: string | null;
};

function toUiMessages(rows: DbMessage[]): AppMessage[] {
  return rows.map((row) => {
    const content = Array.isArray(row.content) ? (row.content as Record<string, unknown>[]) : [];
    const text = content
      .filter((part) => part["type"] === "text")
      .map((part) => String(part["text"] ?? ""))
      .join("\n");
    return {
      id: row.id,
      role: row.role === "user" ? "user" : "assistant",
      parts: [{ type: "text" as const, text }],
      metadata: {
        ...(row.model ? { modelId: row.model } : {}),
        ...(row.routed_reason ? { reason: row.routed_reason } : {}),
      },
    } satisfies AppMessage;
  });
}

function Workspace() {
  const navigate = useNavigate();
  const { session, user, loading } = useSession();

  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<AppMessage[]>([]);
  const [chatKey, setChatKey] = useState("new");
  const [monthlyCost, setMonthlyCost] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  const refreshConversations = useCallback(async () => {
    const { data } = await supabase
      .from("conversations")
      .select("id,title,updated_at")
      .order("updated_at", { ascending: false })
      .limit(50);
    setConversations((data as ConversationRow[]) ?? []);
  }, []);

  const refreshUsage = useCallback(async () => {
    const since = new Date();
    since.setDate(1);
    const { data } = await supabase
      .from("usage_records")
      .select("estimated_cost")
      .gte("created_at", since.toISOString());
    const total = (data ?? []).reduce((sum, row) => sum + Number(row.estimated_cost ?? 0), 0);
    setMonthlyCost(total);
  }, []);

  useEffect(() => {
    if (!user) return;
    void refreshConversations();
    void refreshUsage();
  }, [user, refreshConversations, refreshUsage]);

  async function openConversation(id: string) {
    const { data } = await supabase
      .from("messages")
      .select("id,role,content,model,routed_reason")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });
    setInitialMessages(toUiMessages((data as DbMessage[]) ?? []));
    setActiveId(id);
    setChatKey(id);
  }

  async function deleteConversation(id: string) {
    if (!window.confirm("Delete this chat? This cannot be undone.")) return;
    await supabase.from("messages").delete().eq("conversation_id", id);
    await supabase.from("conversations").delete().eq("id", id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) newChat();
  }

  function newChat() {
    setInitialMessages([]);
    setActiveId(null);
    setChatKey(`new-${Date.now()}`);
  }

  if (loading || !session) {
    return (
      <div className="mesh-canvas flex min-h-screen items-center justify-center">
        <span className="text-[13px] text-subtle">Loading your workspace…</span>
      </div>
    );
  }

  const activeTitle = conversations.find((c) => c.id === activeId)?.title ?? "New chat";
  const displayName =
    (user?.user_metadata?.["full_name"] as string | undefined) ??
    user?.email?.split("@")[0] ??
    "You";

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-panel text-ink">
      <div className="relative flex h-screen overflow-hidden">
        <Sidebar
          conversations={conversations}
          activeId={activeId}
          onSelect={(id) => void openConversation(id)}
          onNew={newChat}
          onDelete={(id) => void deleteConversation(id)}
          userName={displayName}
          userEmail={user?.email ?? ""}
          mobileOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <ChatView
          key={chatKey}
          conversationId={activeId}
          initialMessages={initialMessages}
          initialTitle={activeTitle}
          monthlyCost={monthlyCost}
          onConversationCreated={(id, title) => {
            setActiveId(id);
            setConversations((prev) => [
              { id, title, updated_at: new Date().toISOString() },
              ...prev,
            ]);
          }}
          onTitleChange={(id, title) =>
            setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)))
          }
          onUsage={(cost) => setMonthlyCost((prev) => prev + cost)}
          onOpenSidebar={() => setSidebarOpen(true)}
        />
      </div>
    </div>
  );
}
