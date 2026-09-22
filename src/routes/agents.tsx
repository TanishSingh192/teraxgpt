import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Bot, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_AGENT_TOOLS, TOOL_CATALOG, type ToolId } from "@/lib/agent-tools";
import { AUTO, MODELS } from "@/lib/models";

export const Route = createFileRoute("/agents")({
  head: () => ({
    meta: [
      { title: "Agents · TeraX CPT" },
      {
        name: "description",
        content:
          "Build reusable agents with their own instructions, model, tool permissions and approval rules.",
      },
      { property: "og:title", content: "Agents · TeraX CPT" },
      {
        property: "og:description",
        content: "Reusable AI agents that plan, use tools and ask permission before acting.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AgentsPage,
});

type AgentRow = {
  id: string;
  name: string;
  description: string;
  instructions: string;
  model_id: string;
  tools: ToolId[];
  require_approval: boolean;
  project_id: string | null;
};

type ProjectRow = { id: string; name: string };

function AgentsPage() {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [selected, setSelected] = useState<AgentRow | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  const refresh = useCallback(async () => {
    const [agentRes, projectRes] = await Promise.all([
      supabase
        .from("agents")
        .select("id,name,description,instructions,model_id,tools,require_approval,project_id")
        .order("created_at", { ascending: false }),
      supabase.from("projects").select("id,name").order("updated_at", { ascending: false }),
    ]);
    setAgents(((agentRes.data ?? []) as unknown as AgentRow[]).map((a) => ({
      ...a,
      tools: Array.isArray(a.tools) ? a.tools : [],
    })));
    setProjects((projectRes.data ?? []) as ProjectRow[]);
  }, []);

  useEffect(() => {
    if (session) void refresh();
  }, [session, refresh]);

  async function createAgent() {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return;
    const { data, error } = await supabase
      .from("agents")
      .insert({
        user_id: userId,
        name: "New agent",
        description: "",
        instructions: "",
        model_id: AUTO,
        tools: DEFAULT_AGENT_TOOLS,
        require_approval: true,
      })
      .select("id,name,description,instructions,model_id,tools,require_approval,project_id")
      .single();
    if (error || !data) {
      toast.error("Could not create that agent.");
      return;
    }
    await refresh();
    setSelected({ ...(data as unknown as AgentRow), tools: DEFAULT_AGENT_TOOLS });
  }

  async function saveAgent() {
    if (!selected) return;
    setSaving(true);
    const { error } = await supabase
      .from("agents")
      .update({
        name: selected.name.trim() || "Untitled agent",
        description: selected.description,
        instructions: selected.instructions,
        model_id: selected.model_id,
        tools: selected.tools,
        require_approval: selected.require_approval,
        project_id: selected.project_id,
      })
      .eq("id", selected.id);
    setSaving(false);
    if (error) {
      toast.error("Could not save that agent.");
      return;
    }
    toast.success("Agent saved.");
    void refresh();
  }

  async function removeAgent(id: string) {
    await supabase.from("agents").delete().eq("id", id);
    if (selected?.id === id) setSelected(null);
    void refresh();
  }

  function toggleTool(id: ToolId) {
    if (!selected) return;
    const has = selected.tools.includes(id);
    setSelected({
      ...selected,
      tools: has ? selected.tools.filter((t) => t !== id) : [...selected.tools, id],
    });
  }

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-panel">
        <span className="text-[13px] text-subtle">Loading your agents…</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-panel text-ink">
      <div className="mx-auto max-w-[980px] px-5 py-10">
        <Link to="/" className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-subtle">
          <ArrowLeft className="size-3.5" /> Back to chat
        </Link>
        <h1 className="font-display text-[28px] font-semibold">Agents</h1>
        <p className="mt-1 text-[14px] text-subtle">
          Reusable assistants that plan their work, use only the tools you allow, and ask before
          anything is saved.
        </p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside>
            <Button
              onClick={() => void createAgent()}
              className="w-full rounded-xl bg-ink text-primary-foreground shadow-none hover:bg-ink/90"
            >
              <Plus /> New agent
            </Button>
            <div className="mt-3 grid gap-1.5">
              {agents.length === 0 ? (
                <p className="text-[13px] text-subtle">No agents yet.</p>
              ) : (
                agents.map((agent) => (
                  <div
                    key={agent.id}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 ${
                      selected?.id === agent.id
                        ? "border-signal bg-signal-soft"
                        : "border-line bg-background"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelected(agent)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <Bot className="size-4 shrink-0 text-subtle" />
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium">{agent.name}</span>
                        <span className="block truncate text-[11px] text-subtle">
                          {agent.tools.length} tool{agent.tools.length === 1 ? "" : "s"}
                          {agent.require_approval ? " · asks first" : ""}
                        </span>
                      </span>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-subtle"
                      aria-label={`Delete ${agent.name}`}
                      onClick={() => void removeAgent(agent.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </aside>

          <section>
            {!selected ? (
              <p className="text-[13px] text-subtle">
                Select an agent to edit it, or create a new one.
              </p>
            ) : (
              <div className="rounded-2xl border border-line bg-background p-5">
                <input
                  value={selected.name}
                  onChange={(event) => setSelected({ ...selected, name: event.target.value })}
                  placeholder="Agent name"
                  className="w-full bg-transparent font-display text-[20px] font-semibold outline-none placeholder:text-subtle"
                />
                <input
                  value={selected.description}
                  onChange={(event) =>
                    setSelected({ ...selected, description: event.target.value })
                  }
                  placeholder="What is this agent for?"
                  className="mt-1 w-full bg-transparent text-[13px] outline-none placeholder:text-subtle"
                />

                <label className="mt-5 block text-[12px] font-medium text-subtle">
                  Instructions
                </label>
                <textarea
                  value={selected.instructions}
                  onChange={(event) =>
                    setSelected({ ...selected, instructions: event.target.value })
                  }
                  rows={6}
                  placeholder="How should this agent work? What should it always do or never do?"
                  className="mt-1.5 w-full resize-y rounded-xl bg-panel px-3 py-2.5 text-[13px] outline-none placeholder:text-subtle"
                />

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-[12px] font-medium text-subtle">Model</span>
                    <select
                      value={selected.model_id}
                      onChange={(event) =>
                        setSelected({ ...selected, model_id: event.target.value })
                      }
                      className="mt-1.5 w-full rounded-xl bg-panel px-3 py-2.5 text-[13px] outline-none"
                    >
                      <option value={AUTO}>TeraX CPT Auto</option>
                      {MODELS.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-[12px] font-medium text-subtle">Project</span>
                    <select
                      value={selected.project_id ?? ""}
                      onChange={(event) =>
                        setSelected({ ...selected, project_id: event.target.value || null })
                      }
                      className="mt-1.5 w-full rounded-xl bg-panel px-3 py-2.5 text-[13px] outline-none"
                    >
                      <option value="">Available everywhere</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="mt-5">
                  <span className="text-[12px] font-medium text-subtle">Permissions</span>
                  <div className="mt-2 grid gap-1.5">
                    {TOOL_CATALOG.map((spec) => (
                      <label
                        key={spec.id}
                        className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-panel px-3 py-2.5"
                      >
                        <input
                          type="checkbox"
                          checked={selected.tools.includes(spec.id)}
                          onChange={() => toggleTool(spec.id)}
                          className="mt-0.5 size-4 accent-[oklch(0.55_0.19_260)]"
                        />
                        <span className="min-w-0">
                          <span className="block text-[13px] font-medium">
                            {spec.label}
                            {spec.write && (
                              <span className="ml-2 rounded bg-signal-soft px-1.5 py-0.5 text-[10px] font-normal text-ink">
                                writes data
                              </span>
                            )}
                          </span>
                          <span className="block text-[12px] text-subtle">{spec.description}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <label className="mt-4 flex cursor-pointer items-center gap-2.5 text-[13px]">
                  <input
                    type="checkbox"
                    checked={selected.require_approval}
                    onChange={(event) =>
                      setSelected({ ...selected, require_approval: event.target.checked })
                    }
                    className="size-4 accent-[oklch(0.55_0.19_260)]"
                  />
                  Ask me before the agent saves or changes anything
                </label>

                <Button
                  onClick={() => void saveAgent()}
                  disabled={saving}
                  className="mt-5 rounded-xl bg-ink text-primary-foreground shadow-none hover:bg-ink/90"
                >
                  {saving ? "Saving…" : "Save agent"}
                </Button>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
