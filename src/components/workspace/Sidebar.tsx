import { Link, useNavigate } from "@tanstack/react-router";
import {
  Bot,
  FolderOpen,
  LogOut,
  MessageSquare,
  PanelLeftClose,
  Plus,
  Search,
  Settings,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";

import logoAsset from "@/assets/terax-logo.png.asset.json";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export type ConversationRow = {
  id: string;
  title: string;
  updated_at: string;
};

export function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  userName,
  userEmail,
  mobileOpen,
  onClose,
}: {
  conversations: ConversationRow[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  userName: string;
  userEmail: string;
  mobileOpen: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const filteredConversations = useMemo(
    () => conversations.filter((conversation) => conversation.title.toLowerCase().includes(query.toLowerCase())),
    [conversations, query],
  );

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-30 bg-ink/20 md:hidden" onClick={onClose} />}
      <aside className={`${mobileOpen ? "flex" : "hidden"} fixed inset-y-0 left-0 z-40 w-[280px] shrink-0 flex-col bg-background px-3 py-3 md:static md:flex md:w-[260px]`}>
      <div className="flex h-10 items-center gap-2.5 px-2">
        <img src={logoAsset.url} alt="TeraX CPT logo" className="size-7 rounded-lg" />
        <span className="font-display text-[15px] font-semibold">TeraX CPT</span>
        <Button variant="ghost" size="icon" onClick={onClose} className="ml-auto md:hidden" aria-label="Close sidebar">
          <PanelLeftClose />
        </Button>
      </div>

      <Button
        variant="outline"
        onClick={() => { onNew(); onClose(); }}
        className="mt-4 h-10 w-full justify-start border-line bg-panel px-3 shadow-none"
      >
        <Plus />
        New chat
      </Button>

      <Link
        to="/projects"
        onClick={onClose}
        className="mt-1.5 flex h-9 items-center gap-2 rounded-lg px-3 text-[13px] text-subtle hover:bg-panel"
      >
        <FolderOpen className="size-3.5" />
        Projects
      </Link>

      <Link
        to="/agents"
        onClick={onClose}
        className="mt-0.5 flex h-9 items-center gap-2 rounded-lg px-3 text-[13px] text-subtle hover:bg-panel"
      >
        <Bot className="size-3.5" />
        Agents
      </Link>

      <Link
        to="/settings"
        onClick={onClose}
        className="mt-0.5 flex h-9 items-center gap-2 rounded-lg px-3 text-[13px] text-subtle hover:bg-panel"
      >
        <Settings className="size-3.5" />
        Settings
      </Link>


      <label className="mt-3 flex h-9 items-center gap-2 rounded-lg px-3 text-subtle focus-within:bg-panel">
        <Search className="size-4" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search chats" className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-subtle" />
      </label>

      <div className="mb-1 mt-5 px-3 text-[11px] font-medium text-subtle">
        Recent
      </div>
      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <p className="px-3 py-2 text-[12px] text-subtle">No conversations yet</p>
        ) : (
          filteredConversations.map((conversation) => (
            <div key={conversation.id} className="group/row relative flex items-center">
              <Button
                variant="ghost"
                onClick={() => { onSelect(conversation.id); onClose(); }}
                className={`${conversation.id === activeId ? "bg-panel text-ink" : "text-subtle"} h-9 w-full justify-start gap-2 px-3 pr-9 text-[13px] font-normal shadow-none`}
              >
                <MessageSquare className="size-3.5" />
                <span className="truncate">{conversation.title}</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${conversation.title}`}
                onClick={() => onDelete(conversation.id)}
                className="absolute right-1 size-7 text-subtle opacity-100 hover:text-destructive md:opacity-0 md:group-hover/row:opacity-100 focus-visible:opacity-100"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))
        )}
      </nav>

      <div className="mt-2 border-t border-line pt-3">
        <div className="flex items-center gap-2.5 px-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-medium text-primary-foreground">
            {userName.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[13px] font-medium">{userName}</div>
            <div className="truncate text-[11px] text-subtle">{userEmail}</div>
          </div>
        </div>
        <Button
          variant="ghost"
          onClick={async () => {
            await supabase.auth.signOut();
            void navigate({ to: "/auth" });
          }}
          className="mt-2 h-9 w-full justify-start px-3 text-[13px] font-normal text-subtle"
        >
          <LogOut />
          Sign out
        </Button>
      </div>
      </aside>
    </>
  );
}
