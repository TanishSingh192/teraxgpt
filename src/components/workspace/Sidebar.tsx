import { useNavigate } from "@tanstack/react-router";

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
  userName,
  userEmail,
}: {
  conversations: ConversationRow[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  userName: string;
  userEmail: string;
}) {
  const navigate = useNavigate();

  return (
    <aside className="hidden w-[232px] shrink-0 flex-col border-r border-line bg-panel/70 px-3 py-4 md:flex">
      <div className="flex items-center gap-2.5 px-2 pb-5">
        <div className="flex size-7 items-center justify-center rounded-lg bg-ink text-white">
          <span className="font-display text-[13px] font-semibold">M</span>
        </div>
        <span className="font-display text-[15px] font-semibold tracking-tight">Multiform</span>
      </div>

      <button
        type="button"
        onClick={onNew}
        className="flex w-full items-center gap-2.5 rounded-lg bg-signal px-3 py-2 text-sm font-medium text-white ring-1 ring-signal"
      >
        <span className="grid size-4 place-items-center leading-none text-white">+</span>
        New chat
      </button>

      <div className="mt-5 mb-1 px-2 text-[10px] font-medium uppercase tracking-[0.14em] text-subtle">
        Chats
      </div>
      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto text-sm">
        {conversations.length === 0 ? (
          <p className="px-3 py-2 text-[12px] text-subtle">Nothing here yet.</p>
        ) : (
          conversations.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              onClick={() => onSelect(conversation.id)}
              className={
                conversation.id === activeId
                  ? "truncate rounded-lg bg-signal-soft px-3 py-2 text-left font-medium text-ink"
                  : "truncate rounded-lg px-3 py-2 text-left text-subtle hover:bg-black/[0.03]"
              }
            >
              {conversation.title}
            </button>
          ))
        )}
      </nav>

      <div className="mt-2 border-t border-line px-2 pt-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink/90 text-[11px] font-medium text-white">
            {userName.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[13px] font-medium">{userName}</div>
            <div className="truncate text-[11px] text-subtle">{userEmail}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={async () => {
            await supabase.auth.signOut();
            void navigate({ to: "/auth" });
          }}
          className="mt-2 w-full rounded-lg px-3 py-2 text-left text-[13px] text-subtle hover:bg-black/[0.03]"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
