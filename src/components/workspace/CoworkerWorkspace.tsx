import { useEffect, useState } from "react";
import { Bot, Loader2, Play, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { freshAccessToken } from "@/lib/session-token";

type Agent = { id: "general" | "research" | "writing" | "coding"; name: string; description: string };
type Run = { id: string; status: string; agent_id: string; input: string; output: string | null; error_code: string | null };
type EventRow = { id: number; event_type: string; event_data: Record<string, unknown> };

export function CoworkerWorkspace({ conversationId }: { conversationId: string | null }) {
  const [open, setOpen] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentId, setAgentId] = useState<Agent["id"]>("general");
  const [prompt, setPrompt] = useState("");
  const [runs, setRuns] = useState<Run[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function api(path: string, init?: RequestInit) {
    const token = await freshAccessToken();
    return fetch(path, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init?.headers } });
  }
  async function refreshRuns() {
    const response = await api("/api/coworkers/history");
    if (response.ok) setRuns(((await response.json()) as { runs: Run[] }).runs);
  }
  useEffect(() => {
    let alive = true;
    void api("/api/coworkers").then(async (r) => { if (!r.ok) throw new Error(); return r.json() as Promise<{ agents: Agent[] }>; })
      .then((d) => { if (alive) setAgents(d.agents); }).catch(() => { if (alive) setError("Could not load coworkers. Sign in and try again."); });
    return () => { alive = false; };
  }, []);
  useEffect(() => { if (open) void refreshRuns(); }, [open]);
  useEffect(() => {
    if (!open || !selectedRun) return;
    let alive = true;
    const refresh = async () => {
      try {
        const r = await api(`/api/coworkers/runs/${selectedRun}`);
        if (!r.ok) return;
        const d = await r.json() as { run: Run; events: EventRow[] };
        if (alive) { setRuns((old) => [d.run, ...old.filter((x) => x.id !== d.run.id)]); setEvents(d.events); }
      } catch { /* preserve last known status while offline */ }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 2500);
    return () => { alive = false; window.clearInterval(timer); };
  }, [open, selectedRun]);

  async function startRun() {
    if (!prompt.trim() || loading) return;
    setLoading(true); setError("");
    try {
      const r = await api("/api/coworkers", { method: "POST", body: JSON.stringify({ agentId, input: prompt.trim(), conversationId }) });
      const d = await r.json() as { run?: Run; error?: string };
      if (!r.ok || !d.run) throw new Error(d.error || "Could not enqueue task.");
      setPrompt(""); setSelectedRun(d.run.id); setRuns((old) => [d.run!, ...old.filter((x) => x.id !== d.run!.id)]);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not enqueue task."); }
    finally { setLoading(false); }
  }
  async function cancelRun() {
    if (!selectedRun) return;
    const r = await api(`/api/coworkers/runs/${selectedRun}`, { method: "POST" });
    if (!r.ok) setError("Could not cancel task. It may have already finished.");
    await refreshRuns();
  }
  const selected = runs.find((r) => r.id === selectedRun);
  const active = selected && ["queued", "running"].includes(selected.status);

  return <>
    <Button variant="outline" size="sm" className="fixed bottom-24 right-3 z-30 gap-2 rounded-full border-indigo-400/30 bg-panel/95 shadow-lg sm:bottom-5 sm:right-5" onClick={() => setOpen(true)}><Bot className="size-4" /> AI coworkers</Button>
    {open && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-2 sm:items-center sm:p-5" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="coworker-title" className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-panel shadow-2xl">
        <header className="flex items-center gap-3 border-b border-border p-4"><Bot className="size-5 text-indigo-500" /><div className="flex-1"><h2 id="coworker-title" className="font-display text-lg font-semibold">AI coworkers</h2><p className="text-xs text-subtle">Delegate tasks and revisit persisted runs.</p></div><Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close"><X /></Button></header>
        <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-2">
          <div className="space-y-3 border-b border-border p-4 md:border-b-0 md:border-r">
            <label className="block text-sm font-medium">Specialist<select value={agentId} onChange={(e) => setAgentId(e.target.value as Agent["id"])} className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2">{agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
            <p className="text-xs text-subtle">{agents.find((a) => a.id === agentId)?.description}</p>
            <label className="block text-sm font-medium">Task<textarea rows={4} maxLength={20000} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe the outcome you need…" className="mt-1.5 w-full rounded-lg border border-border bg-background p-3 text-sm" /></label>
            <Button className="w-full" onClick={() => void startRun()} disabled={loading || !prompt.trim()}>{loading ? <Loader2 className="animate-spin" /> : <Play />} Enqueue task</Button>
            {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
            <h3 className="pt-2 text-xs font-semibold uppercase tracking-wider text-subtle">Recent tasks</h3>
            {runs.map((r) => <button key={r.id} onClick={() => setSelectedRun(r.id)} className="block w-full rounded-lg border border-border p-2 text-left text-xs"><span className="font-medium">{r.input}</span><span className="block text-subtle">{r.agent_id} · {r.status}</span></button>)}
          </div>
          <div className="space-y-4 p-4">
            {selected ? <><div className="flex items-center gap-2"><strong className="text-sm">Task status</strong><span className="text-xs text-subtle">{selected.status}</span>{active && <Button size="sm" variant="outline" onClick={() => void cancelRun()}><Square className="size-3" /> Cancel</Button>}</div>
              <p className="whitespace-pre-wrap text-sm">{selected.input}</p>
              {selected.status === "queued" && <p className="text-xs text-subtle">Queued. The configured worker must pick up this task.</p>}
              {selected.status === "running" && <p className="flex items-center gap-2 text-xs text-subtle"><Loader2 className="size-4 animate-spin" /> Working; you can return later.</p>}
              {selected.status === "failed" && <p role="alert" className="text-xs text-destructive">Failed: {selected.error_code || "agent_execution_failed"}</p>}
              {selected.output && <div className="rounded-xl border border-border bg-background p-3"><h3 className="mb-2 text-xs font-semibold">Result</h3><pre className="whitespace-pre-wrap break-words font-sans text-sm">{selected.output}</pre></div>}
              <h3 className="text-xs font-semibold uppercase tracking-wider text-subtle">Activity timeline</h3>{events.map((ev) => <div key={ev.id} className="text-xs"><strong>{ev.event_type.replace(/_/g, " ")}</strong><p className="break-words text-subtle">{JSON.stringify(ev.event_data)}</p></div>)}
            </> : <p className="py-12 text-center text-sm text-subtle">Choose a specialist and delegate your first task.</p>}
          </div>
        </div>
        <footer className="border-t border-border p-3 text-[11px] text-subtle">Background execution requires the scheduled worker endpoint and server secrets.</footer>
      </section>
    </div>}
  </>;
}
