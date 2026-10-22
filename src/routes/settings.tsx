import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import { AUTO, MODELS } from "@/lib/models";
import { useTheme, type Theme } from "@/lib/theme";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings · TeraX CPT" },
      {
        name: "description",
        content:
          "Personalize TeraX CPT: how the assistant addresses you, what it remembers, your theme, your skills and your scheduled actions.",
      },
      { property: "og:title", content: "Settings · TeraX CPT" },
      {
        property: "og:description",
        content: "Personalization, memory, appearance, skills and scheduled actions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

type Settings = {
  display_name: string;
  occupation: string;
  traits: string;
  custom_instructions: string;
  memory_enabled: boolean;
};

type MemoryRow = { id: string; content: string; created_at: string };
type SkillRow = { id: string; name: string; description: string; instructions: string };
type ConnectorRow = {
  id: string;
  name: string;
  endpoint: string;
  enabled: boolean;
  last_connected_at: string | null;
  created_at: string;
};
type ConnectorTool = { name: string; description?: string };
type ScheduleRow = {
  id: string;
  title: string;
  prompt: string;
  frequency: string;
  run_at_minute: number;
  enabled: boolean;
  model_id: string;
  last_run_at: string | null;
  last_result: string | null;
};

const TABS = ["Personalization", "Memory", "Appearance", "Skills", "Scheduled actions", "Connectors"] as const;
type Tab = (typeof TABS)[number];

const input =
  "w-full rounded-lg border border-line bg-panel px-3 py-2 text-[13px] text-ink outline-none placeholder:text-subtle focus:border-signal";
const label = "mb-1.5 block text-[12px] font-medium text-subtle";
const card = "rounded-2xl border border-line bg-panel p-5";

function minuteToTime(minute: number) {
  const h = String(Math.floor(minute / 60)).padStart(2, "0");
  const m = String(minute % 60).padStart(2, "0");
  return `${h}:${m}`;
}

function SettingsPage() {
  const navigate = useNavigate();
  const { session, user, loading } = useSession();
  const { theme, setTheme } = useTheme();
  const [tab, setTab] = useState<Tab>("Personalization");

  const [settings, setSettings] = useState<Settings>({
    display_name: "",
    occupation: "",
    traits: "",
    custom_instructions: "",
    memory_enabled: true,
  });
  const [memories, setMemories] = useState<MemoryRow[]>([]);
  const [memoryDraft, setMemoryDraft] = useState("");
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [connectors, setConnectors] = useState<ConnectorRow[]>([]);
  const [connectorDraft, setConnectorDraft] = useState({ name: "", endpoint: "", token: "" });
  const [connectorTools, setConnectorTools] = useState<Record<string, ConnectorTool[]>>({});
  const [connectorBusy, setConnectorBusy] = useState(false);
  const [scheduleDraft, setScheduleDraft] = useState({
    title: "",
    prompt: "",
    frequency: "daily",
    time: "08:00",
    model_id: AUTO,
  });

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  const refresh = useCallback(async () => {
    const [s, m, sk, sc] = await Promise.all([
      supabase
        .from("user_settings")
        .select("display_name,occupation,traits,custom_instructions,memory_enabled")
        .maybeSingle(),
      supabase.from("user_memory").select("id,content,created_at").order("created_at", { ascending: false }),
      supabase.from("skills").select("id,name,description,instructions").order("created_at", { ascending: false }),
      supabase
        .from("scheduled_actions")
        .select("id,title,prompt,frequency,run_at_minute,enabled,model_id,last_run_at,last_result")
        .order("created_at", { ascending: false }),
    ]);
    if (s.data) setSettings(s.data as Settings);
    setMemories((m.data ?? []) as MemoryRow[]);
    setSkills((sk.data ?? []) as SkillRow[]);
    setSchedules((sc.data ?? []) as ScheduleRow[]);
  }, []);

  useEffect(() => {
    if (user) { void refresh(); void loadConnectors(); }
  }, [user, refresh, loadConnectors]);

  const connectorRequest = useCallback(async (method: "GET" | "POST", body?: Record<string, unknown>) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Sign in again to manage connectors.");
    const response = await fetch("/api/connectors", {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { "content-type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json().catch(() => ({})) as {
      error?: string;
      connectors?: ConnectorRow[];
      tools?: ConnectorTool[];
      connector?: ConnectorRow;
    };
    if (!response.ok) throw new Error(result.error ?? "Connector request failed.");
    return result;
  }, []);

  const loadConnectors = useCallback(async () => {
    try {
      const result = await connectorRequest("GET");
      setConnectors(result.connectors ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load connectors.");
    }
  }, [connectorRequest]);

  async function addConnector() {
    if (!connectorDraft.name.trim() || !connectorDraft.endpoint.trim()) {
      toast.error("Enter a name and an HTTPS MCP endpoint.");
      return;
    }
    setConnectorBusy(true);
    try {
      await connectorRequest("POST", {
        action: "create",
        name: connectorDraft.name.trim(),
        endpoint: connectorDraft.endpoint.trim(),
        ...(connectorDraft.token.trim() ? { token: connectorDraft.token.trim() } : {}),
      });
      setConnectorDraft({ name: "", endpoint: "", token: "" });
      await loadConnectors();
      toast.success("MCP connector added.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add connector.");
    } finally {
      setConnectorBusy(false);
    }
  }

  async function inspectConnector(connector: ConnectorRow) {
    setConnectorBusy(true);
    try {
      const result = await connectorRequest("POST", { action: "tools", id: connector.id });
      setConnectorTools((current) => ({ ...current, [connector.id]: result.tools ?? [] }));
      toast.success(`Connected to ${connector.name}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not reach MCP server.");
    } finally {
      setConnectorBusy(false);
    }
  }

  async function saveSettings(next: Settings) {
    setSettings(next);
    if (!user) return;
    const { error } = await supabase
      .from("user_settings")
      .upsert({ user_id: user.id, ...next, updated_at: new Date().toISOString() });
    if (error) toast.error("Could not save that.");
  }

  async function addMemory() {
    const content = memoryDraft.trim();
    if (!content || !user) return;
    const { data, error } = await supabase
      .from("user_memory")
      .insert({ user_id: user.id, content, source: "user" })
      .select("id,content,created_at")
      .single();
    if (error || !data) {
      toast.error("Could not save that memory.");
      return;
    }
    setMemories([data as MemoryRow, ...memories]);
    setMemoryDraft("");
  }

  async function addSkill() {
    if (!user) return;
    const { data, error } = await supabase
      .from("skills")
      .insert({ user_id: user.id, name: "New skill", description: "", instructions: "" })
      .select("id,name,description,instructions")
      .single();
    if (error || !data) {
      toast.error("Could not create that skill.");
      return;
    }
    setSkills([data as SkillRow, ...skills]);
  }

  async function saveSkill(skill: SkillRow) {
    const { error } = await supabase
      .from("skills")
      .update({
        name: skill.name,
        description: skill.description,
        instructions: skill.instructions,
        updated_at: new Date().toISOString(),
      })
      .eq("id", skill.id);
    toast[error ? "error" : "success"](error ? "Could not save the skill." : "Skill saved.");
  }

  async function addSchedule() {
    if (!user) return;
    const title = scheduleDraft.title.trim() || "Scheduled action";
    const prompt = scheduleDraft.prompt.trim();
    if (!prompt) {
      toast.error("Write what the assistant should do.");
      return;
    }
    const [h, m] = scheduleDraft.time.split(":");
    const { data, error } = await supabase
      .from("scheduled_actions")
      .insert({
        user_id: user.id,
        title,
        prompt,
        frequency: scheduleDraft.frequency,
        run_at_minute: Number(h) * 60 + Number(m),
        model_id: scheduleDraft.model_id,
      })
      .select("id,title,prompt,frequency,run_at_minute,enabled,model_id,last_run_at,last_result")
      .single();
    if (error || !data) {
      toast.error("Could not schedule that.");
      return;
    }
    setSchedules([data as ScheduleRow, ...schedules]);
    setScheduleDraft({ title: "", prompt: "", frequency: "daily", time: "08:00", model_id: AUTO });
    toast.success("Scheduled.");
  }

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-[13px] text-subtle">
        Loading your settings…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-ink">
      <div className="mx-auto max-w-[860px] px-4 py-8 md:px-8">
        <Link to="/" className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-subtle hover:text-ink">
          <ArrowLeft className="size-3.5" /> Back to chat
        </Link>
        <h1 className="font-display text-[26px] font-semibold">Settings</h1>

        <div className="mt-5 flex flex-wrap gap-1.5">
          {TABS.map((item) => (
            <Button
              key={item}
              variant="ghost"
              size="sm"
              onClick={() => setTab(item)}
              className={`rounded-lg text-[13px] ${tab === item ? "bg-signal-soft text-ink" : "text-subtle"}`}
            >
              {item}
            </Button>
          ))}
        </div>

        <div className="mt-5 space-y-4">
          {tab === "Personalization" && (
            <div className={card}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <span className={label}>What should we call you?</span>
                  <input
                    className={input}
                    value={settings.display_name}
                    onChange={(e) => setSettings({ ...settings, display_name: e.target.value })}
                    placeholder="Alex"
                  />
                </div>
                <div>
                  <span className={label}>What do you do?</span>
                  <input
                    className={input}
                    value={settings.occupation}
                    onChange={(e) => setSettings({ ...settings, occupation: e.target.value })}
                    placeholder="Product designer"
                  />
                </div>
              </div>
              <div className="mt-4">
                <span className={label}>How should replies feel?</span>
                <input
                  className={input}
                  value={settings.traits}
                  onChange={(e) => setSettings({ ...settings, traits: e.target.value })}
                  placeholder="Direct, practical, no filler"
                />
              </div>
              <div className="mt-4">
                <span className={label}>Anything else the assistant should always know</span>
                <textarea
                  rows={5}
                  className={input}
                  value={settings.custom_instructions}
                  onChange={(e) => setSettings({ ...settings, custom_instructions: e.target.value })}
                  placeholder="I work in UTC+5:30. Prefer metric units and short summaries first."
                />
              </div>
              <Button className="mt-4" onClick={() => void saveSettings(settings)}>
                Save
              </Button>
            </div>
          )}

          {tab === "Memory" && (
            <div className={card}>
              <label className="flex items-center gap-2 text-[13px]">
                <input
                  type="checkbox"
                  checked={settings.memory_enabled}
                  onChange={(e) => void saveSettings({ ...settings, memory_enabled: e.target.checked })}
                />
                Let the assistant remember things about me between chats
              </label>
              <div className="mt-4 flex gap-2">
                <input
                  className={input}
                  value={memoryDraft}
                  onChange={(e) => setMemoryDraft(e.target.value)}
                  placeholder="Add something to remember"
                />
                <Button onClick={() => void addMemory()}>Add</Button>
              </div>
              <div className="mt-4 space-y-1.5">
                {memories.length === 0 && <p className="text-[13px] text-subtle">Nothing saved yet.</p>}
                {memories.map((memory) => (
                  <div
                    key={memory.id}
                    className="flex items-start gap-2 rounded-lg bg-background px-3 py-2 text-[13px]"
                  >
                    <span className="flex-1">{memory.content}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Forget this"
                      onClick={async () => {
                        await supabase.from("user_memory").delete().eq("id", memory.id);
                        setMemories(memories.filter((m) => m.id !== memory.id));
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "Appearance" && (
            <div className={card}>
              <span className={label}>Theme</span>
              <div className="flex gap-2">
                {(["light", "dark", "system"] as Theme[]).map((option) => (
                  <Button
                    key={option}
                    variant="outline"
                    onClick={() => setTheme(option)}
                    className={`capitalize ${theme === option ? "border-signal text-ink" : "text-subtle"}`}
                  >
                    {option}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {tab === "Skills" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[13px] text-subtle">
                  Skills are reusable instructions you can switch on for a single chat.
                </p>
                <Button onClick={() => void addSkill()}>
                  <Plus /> New skill
                </Button>
              </div>
              {skills.map((skill, index) => (
                <div key={skill.id} className={card}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      className={input}
                      value={skill.name}
                      onChange={(e) => {
                        const next = [...skills];
                        next[index] = { ...skill, name: e.target.value };
                        setSkills(next);
                      }}
                      placeholder="Skill name"
                    />
                    <input
                      className={input}
                      value={skill.description}
                      onChange={(e) => {
                        const next = [...skills];
                        next[index] = { ...skill, description: e.target.value };
                        setSkills(next);
                      }}
                      placeholder="What it is for"
                    />
                  </div>
                  <textarea
                    rows={5}
                    className={`${input} mt-3`}
                    value={skill.instructions}
                    onChange={(e) => {
                      const next = [...skills];
                      next[index] = { ...skill, instructions: e.target.value };
                      setSkills(next);
                    }}
                    placeholder="Step-by-step instructions the assistant should follow when this skill is on."
                  />
                  <div className="mt-3 flex gap-2">
                    <Button onClick={() => void saveSkill(skills[index] as SkillRow)}>Save</Button>
                    <Button
                      variant="ghost"
                      className="text-subtle"
                      onClick={async () => {
                        await supabase.from("skills").delete().eq("id", skill.id);
                        setSkills(skills.filter((s) => s.id !== skill.id));
                      }}
                    >
                      <Trash2 /> Delete
                    </Button>
                  </div>
                </div>
              ))}
              {skills.length === 0 && <p className="text-[13px] text-subtle">No skills yet.</p>}
            </div>
          )}

          {tab === "Connectors" && (
            <div className="space-y-3">
              <div className={card}>
                <h2 className="text-[15px] font-medium">Model Context Protocol (MCP)</h2>
                <p className="mt-1 text-[12px] leading-5 text-subtle">
                  Connect remote MCP servers to expose their tools to your workspace. Use a public HTTPS endpoint.
                  Credentials are encrypted server-side and are never shown again after saving.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <span className={label}>Connector name</span>
                    <input className={input} value={connectorDraft.name}
                      onChange={(e) => setConnectorDraft({ ...connectorDraft, name: e.target.value })}
                      placeholder="GitHub, Linear, internal tools…" />
                  </div>
                  <div>
                    <span className={label}>MCP server URL (HTTPS)</span>
                    <input className={input} value={connectorDraft.endpoint}
                      onChange={(e) => setConnectorDraft({ ...connectorDraft, endpoint: e.target.value })}
                      placeholder="https://mcp.example.com/mcp" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className={label}>Bearer token (optional)</span>
                  <input type="password" autoComplete="new-password" className={input}
                    value={connectorDraft.token}
                    onChange={(e) => setConnectorDraft({ ...connectorDraft, token: e.target.value })}
                    placeholder="Paste token; leave blank for unauthenticated servers" />
                </div>
                <Button className="mt-3" disabled={connectorBusy} onClick={() => void addConnector()}>
                  <Plus /> Add MCP server
                </Button>
                <p className="mt-2 text-[11px] text-subtle">
                  Requires the database migration and CONNECTOR_ENCRYPTION_KEY server secret. Only connect servers you trust.
                </p>
              </div>
              {connectors.map((connector) => (
                <div key={connector.id} className={card}>
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-medium">{connector.name}</div>
                      <div className="mt-1 break-all text-[11px] text-subtle">{connector.endpoint}</div>
                      <div className="mt-1 text-[11px] text-subtle">
                        {connector.enabled ? "Enabled" : "Disabled"}
                        {connector.last_connected_at ? ` · last connected ${new Date(connector.last_connected_at).toLocaleString()}` : ""}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" disabled={connectorBusy}
                        onClick={() => void inspectConnector(connector)}>Test & list tools</Button>
                      <Button variant="ghost" size="sm" onClick={async () => {
                        try {
                          await connectorRequest("POST", { action: "toggle", id: connector.id, enabled: !connector.enabled });
                          await loadConnectors();
                        } catch (error) { toast.error(error instanceof Error ? error.message : "Could not update connector."); }
                      }}>{connector.enabled ? "Disable" : "Enable"}</Button>
                      <Button variant="ghost" size="sm" className="text-subtle" onClick={async () => {
                        try {
                          await connectorRequest("POST", { action: "delete", id: connector.id });
                          setConnectors(connectors.filter((item) => item.id !== connector.id));
                          setConnectorTools((tools) => { const next = { ...tools }; delete next[connector.id]; return next; });
                        } catch (error) { toast.error(error instanceof Error ? error.message : "Could not remove connector."); }
                      }}><Trash2 className="size-3.5" /> Remove</Button>
                    </div>
                  </div>
                  {connectorTools[connector.id] && (
                    <div className="mt-4 border-t border-line pt-3">
                      <p className="mb-2 text-[12px] font-medium">Available tools ({connectorTools[connector.id]?.length ?? 0})</p>
                      {(connectorTools[connector.id] ?? []).length === 0
                        ? <p className="text-[12px] text-subtle">The server did not advertise any tools.</p>
                        : <div className="space-y-2">{(connectorTools[connector.id] ?? []).map((tool) => (
                          <div key={tool.name} className="rounded-lg bg-background px-3 py-2">
                            <div className="text-[12px] font-medium">{tool.name}</div>
                            {tool.description && <div className="mt-0.5 text-[11px] text-subtle">{tool.description}</div>}
                          </div>
                        ))}</div>}
                    </div>
                  )}
                </div>
              ))}
              {connectors.length === 0 && <p className="text-[13px] text-subtle">No MCP servers connected yet.</p>}
            </div>
          )}

          {tab === "Scheduled actions" && (
            <div className="space-y-3">
              <div className={card}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    className={input}
                    value={scheduleDraft.title}
                    onChange={(e) => setScheduleDraft({ ...scheduleDraft, title: e.target.value })}
                    placeholder="Morning briefing"
                  />
                  <div className="flex gap-2">
                    <select
                      className={input}
                      value={scheduleDraft.frequency}
                      onChange={(e) => setScheduleDraft({ ...scheduleDraft, frequency: e.target.value })}
                    >
                      <option value="hourly">Every hour</option>
                      <option value="daily">Every day</option>
                      <option value="weekly">Every week</option>
                    </select>
                    <input
                      type="time"
                      className={input}
                      value={scheduleDraft.time}
                      onChange={(e) => setScheduleDraft({ ...scheduleDraft, time: e.target.value })}
                    />
                  </div>
                </div>
                <textarea
                  rows={4}
                  className={`${input} mt-3`}
                  value={scheduleDraft.prompt}
                  onChange={(e) => setScheduleDraft({ ...scheduleDraft, prompt: e.target.value })}
                  placeholder="Summarize my top priorities and suggest a plan for the day."
                />
                <div className="mt-3 flex items-center gap-2">
                  <select
                    className={`${input} max-w-[200px]`}
                    value={scheduleDraft.model_id}
                    onChange={(e) => setScheduleDraft({ ...scheduleDraft, model_id: e.target.value })}
                  >
                    <option value={AUTO}>TeraX CPT Auto</option>
                    {MODELS.filter((m) => m.endpoint !== "image").map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <Button onClick={() => void addSchedule()}>
                    <Plus /> Schedule
                  </Button>
                </div>
                <p className="mt-2 text-[11px] text-subtle">
                  Times are in UTC. Each run appears as a new chat in your history.
                </p>
              </div>

              {schedules.map((schedule) => (
                <div key={schedule.id} className={card}>
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-medium">{schedule.title}</div>
                      <div className="text-[12px] text-subtle">
                        {schedule.frequency === "hourly"
                          ? "Every hour"
                          : `${schedule.frequency === "weekly" ? "Weekly" : "Daily"} at ${minuteToTime(schedule.run_at_minute)} UTC`}
                        {schedule.last_run_at
                          ? ` · last run ${new Date(schedule.last_run_at).toLocaleString()}`
                          : " · not run yet"}
                      </div>
                      <p className="mt-2 text-[13px] text-subtle">{schedule.prompt}</p>
                    </div>
                    <label className="flex items-center gap-1.5 text-[12px] text-subtle">
                      <input
                        type="checkbox"
                        checked={schedule.enabled}
                        onChange={async (e) => {
                          const enabled = e.target.checked;
                          await supabase
                            .from("scheduled_actions")
                            .update({ enabled })
                            .eq("id", schedule.id);
                          setSchedules(
                            schedules.map((s) => (s.id === schedule.id ? { ...s, enabled } : s)),
                          );
                        }}
                      />
                      On
                    </label>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Delete schedule"
                      onClick={async () => {
                        await supabase.from("scheduled_actions").delete().eq("id", schedule.id);
                        setSchedules(schedules.filter((s) => s.id !== schedule.id));
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
              {schedules.length === 0 && (
                <p className="text-[13px] text-subtle">No scheduled actions yet.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
