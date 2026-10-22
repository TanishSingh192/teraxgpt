import { Link, useNavigate } from "@tanstack/react-router";
import {
  Bot,
  Check,
  FolderOpen,
  LogOut,
  MessageSquare,
  PanelLeftClose,
  Pencil,
  Plus,
  Search,
  Settings,
  Trash2,
  X,
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
  onRename,
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
  onRename: (id: string, title: string) => Promise<void>;
  userName: string;
  userEmail: string;
  mobileOpen: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const filteredConversations = useMemo(
    () => conversations.filter((conversation) => conversation.title.toLowerCase().includes(query.trim().toLowerCase())),
    [conversations, query],
  );

  async function saveRename(id: string) {
    const title = editTitle.trim();
    if (!title) return;
    await onRename(id, title);
    setEditingId(null);
    setEditTitle("");
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const groups = [
    { label: "Today", items: filteredConversations.filter((c) => new Date(c.updated_at) >= today) },
    { label: "Previous 7 days", items: filteredConversations.filter((c) => new Date(c.updated_at) < today && new Date(c.updated_at) >= weekAgo) },
    { label: "Older", items: filteredConversations.filter((c) => new Date(c.updated_at) < weekAgo) },
  ];

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-30 bg-ink/20 md:hidden" onClick={onClose} />}
      <aside className={`${mobileOpen ? "flex" : "hidden"} fixed inset-y-0 left-0 z-40 w-[min(86vw,320px)] shrink-0 flex-col bg-background px-3 py-3 md:static md:flex md:w-[260px]`}>
        <div className="flex h-10 items-center gap-2.5 px-2">
          <img src={logoAsset.url} alt="TeraXGPT logo" className="size-7 rounded-lg" />
          <span className="font-display text-[15px] font-semibold">TeraXGPT</span>
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

        <Link to="/projects" onClick={onClose} className="mt-1.5 flex h-9 items-center gap-2 rounded-lg px-3 text-[13px] text-subtle hover:bg-panel">
          <FolderOpen className="size-3.5" />
          Projects
        </Link>
        <Link to="/agents" onClick={onClose} className="mt-0.5 flex h-9 items-center gap-2 rounded-lg px-3 text-[13px] text-subtle hover:bg-panel">
          <Bot className="size-3.5" />
          Agents
        </Link>
        <Link to="/settings" onClick={onClose} className="mt-0.5 flex h-9 items-center gap-2 rounded-lg px-3 text-[13px] text-subtle hover:bg-panel">
          <Settings className="size-3.5" />
          Settings
        </Link>

        <label className="mt-3 flex h-9 items-center gap-2 rounded-lg px-3 text-subtle focus-within:bg-panel focus-within:ring-1 focus-within:ring-line">
          <Search className="size-4 shrink-0" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search chats"
            aria-label="Search conversations"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-subtle"
          />
          {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="rounded p-1 hover:bg-panel"><X className="size-3.5" /></button>}
        </label>

        <div className="mb-1 mt-5 flex items-center justify-between px-3 text-[11px] font-medium text-subtle">
          <span>{query ? "Search results" : "Chat history"}</span>
          <span>{filteredConversations.length}</span>
        </div>
        <nav aria-label="Conversation history" className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-2">
          {filteredConversations.length === 0 ? (
            <p className="px-3 py-2 text-[12px] text-subtle">{query ? "No chats match your search." : "Your conversations will appear here."}</p>
          ) : groups.map((group) => group.items.length > 0 && (
            <section key={group.label} className="flex flex-col gap-0.5">
              {!query && <h2 className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-subtle/80">{group.label}</h2>}
              {group.items.map((conversation) => (
                <div key={conversation.id} className="group/row relative flex min-w-0 items-center">
                  {editingId === conversation.id ? (
                    <form
                      className="flex min-w-0 flex-1 items-center gap-1 px-1"
                      onSubmit={(event) => { event.preventDefault(); void saveRename(conversation.id); }}
                    >
                      <input
                        autoFocus
                        value={editTitle}
                        onChange={(event) => setEditTitle(event.target.value)}
                        onKeyDown={(event) => { if (event.key === "Escape") { setEditingId(null); setEditTitle(""); } }}
                        maxLength={120}
                        aria-label="New conversation title"
                        className="h-8 min-w-0 flex-1 rounded-md border border-line bg-panel px-2 text-[12px] outline-none focus:ring-1 focus:ring-line"
                      />
                      <Button type="submit" variant="ghost" size="icon" className="size-7 shrink-0" aria-label="Save title" disabled={!editTitle.trim()}><Check className="size-3.5" /></Button>
                      <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0" aria-label="Cancel rename" onClick={() => { setEditingId(null); setEditTitle(""); }}><X className="size-3.5" /></Button>
                    </form>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        onClick={() => { onSelect(conversation.id); onClose(); }}
                        className={`${conversation.id === activeId ? "bg-panel text-ink" : "text-subtle"} h-9 w-full min-w-0 justify-start gap-2 px-3 pr-[4.75rem] text-left text-[13px] font-normal shadow-none`}
                        aria-current={conversation.id === activeId ? "page" : undefined}
                      >
                        <MessageSquare className="size-3.5 shrink-0" />
                        <span className="truncate">{conversation.title}</span>
                      </Button>
                      <div className="absolute right-1 flex items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Rename ${conversation.title}`}
                          title="Rename chat"
                          onClick={() => { setEditingId(conversation.id); setEditTitle(conversation.title); }}
                          className="size-7 text-subtle opacity-100 hover:text-ink md:opacity-0 md:group-hover/row:opacity-100 md:group-focus-within/row:opacity-100 focus-visible:opacity-100"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${conversation.title}`}
                          title="Delete chat"
                          onClick={() => onDelete(conversation.id)}
                          className="size-7 text-subtle opacity-100 hover:text-destructive md:opacity-0 md:group-hover/row:opacity-100 md:group-focus-within/row:opacity-100 focus-visible:opacity-100"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </section>
          ))}
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
