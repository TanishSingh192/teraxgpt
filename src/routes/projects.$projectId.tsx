import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, FileText, MessageSquare, Plus, Save, Sparkle, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ChatView, type AppMessage } from "@/components/workspace/ChatView";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/projects/$projectId")({
  head: () => ({
    meta: [
      { title: "Project workspace · TeraX CPT" },
      {
        name: "description",
        content:
          "Work inside a project: standing instructions, reference files, saved memory, its conversations and saved artifacts.",
      },
      { property: "og:title", content: "Project workspace · TeraX CPT" },
      {
        property: "og:description",
        content: "Instructions, files, memory, conversations and artifacts in one project workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProjectWorkspace,
});

type Project = { id: string; name: string; description: string; instructions: string };
type FileRow = { id: string; name: string; content: string };
type MemoryRow = { id: string; content: string };
type ArtifactRow = { id: string; title: string; content: string };
type ConversationRow = { id: string; title: string };

function ProjectWorkspace() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();
  const { session, loading } = useSession();

  const [project, setProject] = useState<Project | null>(null);
  const [instructions, setInstructions] = useState("");
  const [files, setFiles] = useState<FileRow[]>([]);
  const [memory, setMemory] = useState<MemoryRow[]>([]);
  const [artifacts, setArtifacts] = useState<ArtifactRow[]>([]);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [memoryDraft, setMemoryDraft] = useState("");
  const [artifactTitle, setArtifactTitle] = useState("");
  const [artifactBody, setArtifactBody] = useState("");
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<AppMessage[]>([]);
  const [chatKey, setChatKey] = useState("new");

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  const refresh = useCallback(async () => {
    const [projectRes, filesRes, memoryRes, artifactRes, conversationRes] = await Promise.all([
      supabase.from("projects").select("id,name,description,instructions").eq("id", projectId).maybeSingle(),
      supabase.from("project_files").select("id,name,content").eq("project_id", projectId).order("created_at"),
      supabase.from("project_memory").select("id,content").eq("project_id", projectId).order("created_at", { ascending: false }),
      supabase.from("project_artifacts").select("id,title,content").eq("project_id", projectId).order("created_at", { ascending: false }),
      supabase.from("conversations").select("id,title").eq("project_id", projectId).order("updated_at", { ascending: false }),
    ]);
    const row = projectRes.data as Project | null;
    setProject(row);
    setInstructions(row?.instructions ?? "");
    setFiles((filesRes.data as FileRow[]) ?? []);
    setMemory((memoryRes.data as MemoryRow[]) ?? []);
    setArtifacts((artifactRes.data as ArtifactRow[]) ?? []);
    setConversations((conversationRes.data as ConversationRow[]) ?? []);
  }, [projectId]);

  useEffect(() => {
    if (session) void refresh();
  }, [session, refresh]);

  async function saveInstructions() {
    const { error } = await supabase
      .from("projects")
      .update({ instructions, updated_at: new Date().toISOString() })
      .eq("id", projectId);
    if (error) toast.error("Could not save the instructions.");
    else toast.success("Instructions saved.");
  }

  async function addFiles(list: FileList | null) {
    if (!list?.length) return;
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return;
    for (const file of Array.from(list)) {
      const content = await file.text();
      const { error } = await supabase.from("project_files").insert({
        project_id: projectId,
        user_id: userId,
        name: file.name,
        media_type: file.type || "text/plain",
        size_bytes: file.size,
        content: content.slice(0, 200_000),
      });
      if (error) toast.error(`Could not add ${file.name}.`);
    }
    void refresh();
  }

  async function addMemory() {
    const content = memoryDraft.trim();
    if (!content) return;
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return;
    const { error } = await supabase
      .from("project_memory")
      .insert({ project_id: projectId, user_id: userId, content });
    if (error) toast.error("Could not save that memory.");
    setMemoryDraft("");
    void refresh();
  }

  async function addArtifact() {
    const title = artifactTitle.trim();
    if (!title) return;
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return;
    const { error } = await supabase.from("project_artifacts").insert({
      project_id: projectId,
      user_id: userId,
      title,
      content: artifactBody,
      conversation_id: activeChat,
    });
    if (error) toast.error("Could not save that artifact.");
    setArtifactTitle("");
    setArtifactBody("");
    void refresh();
  }

  async function removeRow(table: "project_files" | "project_memory" | "project_artifacts", id: string) {
    await supabase.from(table).delete().eq("id", id);
    void refresh();
  }

  async function openConversation(id: string) {
    const { data } = await supabase
      .from("messages")
      .select("id,role,content,model,routed_reason")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });
    const rows = (data ?? []) as { id: string; role: string; content: unknown }[];
    setInitialMessages(
      rows.map((row) => {
        const parts = Array.isArray(row.content) ? (row.content as Record<string, unknown>[]) : [];
        const text = parts
          .filter((part) => part["type"] === "text")
          .map((part) => String(part["text"] ?? ""))
          .join("\n");
        return {
          id: row.id,
          role: row.role === "user" ? "user" : "assistant",
          parts: [{ type: "text" as const, text }],
        } satisfies AppMessage;
      }),
    );
    setActiveChat(id);
    setChatKey(id);
  }

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-panel">
        <span className="text-[13px] text-subtle">Loading this project…</span>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-panel text-ink">
      <aside className="hidden w-[340px] shrink-0 flex-col overflow-y-auto border-r border-line bg-background px-4 py-4 lg:flex">
        <Link to="/projects" className="inline-flex items-center gap-1.5 text-[13px] text-subtle">
          <ArrowLeft className="size-3.5" /> All projects
        </Link>
        <h1 className="mt-4 font-display text-[19px] font-semibold">{project?.name ?? "Project"}</h1>
        {project?.description && <p className="mt-1 text-[12px] text-subtle">{project.description}</p>}

        <h2 className="mt-6 text-[11px] font-medium text-subtle">Instructions</h2>
        <textarea
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
          rows={5}
          placeholder="How should the assistant behave in this project?"
          className="mt-2 w-full resize-none rounded-xl border border-line bg-panel p-3 text-[13px] outline-none placeholder:text-subtle"
        />
        <Button variant="outline" onClick={() => void saveInstructions()} className="mt-2 h-8 shadow-none">
          <Save className="size-3.5" /> Save instructions
        </Button>

        <h2 className="mt-6 text-[11px] font-medium text-subtle">Files</h2>
        <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-line px-3 py-2 text-[12px] text-subtle">
          <Plus className="size-3.5" /> Add text, markdown, CSV or JSON
          <input
            type="file"
            multiple
            hidden
            accept=".txt,.md,.csv,.json,.ts,.tsx,.js,.py,.sql"
            onChange={(event) => {
              void addFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </label>
        {files.map((file) => (
          <div key={file.id} className="mt-1 flex items-center gap-2 px-1 text-[12px]">
            <FileText className="size-3.5 shrink-0 text-subtle" />
            <span className="min-w-0 flex-1 truncate">{file.name}</span>
            <Button variant="ghost" size="icon" className="size-6" onClick={() => void removeRow("project_files", file.id)} aria-label={`Remove ${file.name}`}>
              <Trash2 className="size-3" />
            </Button>
          </div>
        ))}

        <h2 className="mt-6 text-[11px] font-medium text-subtle">Memory</h2>
        <div className="mt-2 flex gap-1.5">
          <input
            value={memoryDraft}
            onChange={(event) => setMemoryDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void addMemory();
            }}
            placeholder="A fact to remember"
            className="min-w-0 flex-1 rounded-lg border border-line bg-panel px-2.5 py-1.5 text-[12px] outline-none placeholder:text-subtle"
          />
          <Button variant="outline" size="icon" className="size-8 shadow-none" onClick={() => void addMemory()} aria-label="Save memory">
            <Plus className="size-3.5" />
          </Button>
        </div>
        {memory.map((item) => (
          <div key={item.id} className="mt-1 flex items-start gap-2 px-1 text-[12px]">
            <Sparkle className="mt-0.5 size-3.5 shrink-0 text-subtle" />
            <span className="min-w-0 flex-1">{item.content}</span>
            <Button variant="ghost" size="icon" className="size-6" onClick={() => void removeRow("project_memory", item.id)} aria-label="Remove memory">
              <Trash2 className="size-3" />
            </Button>
          </div>
        ))}

        <h2 className="mt-6 text-[11px] font-medium text-subtle">Artifacts</h2>
        <input
          value={artifactTitle}
          onChange={(event) => setArtifactTitle(event.target.value)}
          placeholder="Artifact title"
          className="mt-2 w-full rounded-lg border border-line bg-panel px-2.5 py-1.5 text-[12px] outline-none placeholder:text-subtle"
        />
        <textarea
          value={artifactBody}
          onChange={(event) => setArtifactBody(event.target.value)}
          rows={3}
          placeholder="Paste the output you want to keep"
          className="mt-1.5 w-full resize-none rounded-lg border border-line bg-panel px-2.5 py-1.5 text-[12px] outline-none placeholder:text-subtle"
        />
        <Button variant="outline" onClick={() => void addArtifact()} className="mt-1.5 h-8 shadow-none">
          <Plus className="size-3.5" /> Save artifact
        </Button>
        {artifacts.map((artifact) => (
          <div key={artifact.id} className="mt-1 flex items-start gap-2 px-1 text-[12px]">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{artifact.title}</span>
              <span className="block truncate text-subtle">{artifact.content}</span>
            </span>
            <Button variant="ghost" size="icon" className="size-6" onClick={() => void removeRow("project_artifacts", artifact.id)} aria-label="Remove artifact">
              <Trash2 className="size-3" />
            </Button>
          </div>
        ))}

        <h2 className="mt-6 text-[11px] font-medium text-subtle">Conversations</h2>
        <Button
          variant="outline"
          className="mt-2 h-8 shadow-none"
          onClick={() => {
            setActiveChat(null);
            setInitialMessages([]);
            setChatKey(`new-${Date.now()}`);
          }}
        >
          <Plus className="size-3.5" /> New project chat
        </Button>
        {conversations.map((conversation) => (
          <Button
            key={conversation.id}
            variant="ghost"
            onClick={() => void openConversation(conversation.id)}
            className={`${conversation.id === activeChat ? "bg-panel text-ink" : "text-subtle"} mt-1 h-8 w-full justify-start gap-2 px-2 text-[12px] font-normal shadow-none`}
          >
            <MessageSquare className="size-3.5" />
            <span className="truncate">{conversation.title}</span>
          </Button>
        ))}
      </aside>

      <ChatView
        key={chatKey}
        conversationId={activeChat}
        initialMessages={initialMessages}
        initialTitle={project?.name ?? "Project"}
        monthlyCost={0}
        projectId={projectId}
        {...(project?.name ? { projectName: project.name } : {})}
        onConversationCreated={(id, title) => {
          setActiveChat(id);
          setConversations((prev) => [{ id, title }, ...prev]);
        }}
        onTitleChange={(id, title) =>
          setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)))
        }
        onUsage={() => undefined}
        onOpenSidebar={() => void navigate({ to: "/projects" })}
      />
    </div>
  );
}
