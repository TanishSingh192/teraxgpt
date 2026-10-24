import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine, ArrowLeft, Bot, Check, ChevronDown, CirclePlay, Code2,
  GitBranch, GripVertical, Plus, Save, Sparkles, Trash2, Workflow, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/useSession";

export const Route = createFileRoute("/workflows")({
  head: () => ({
    meta: [
      { title: "Workflow Studio · TeraXGPT" },
      { name: "description", content: "Design multi-agent AI workflows with a visual drag-and-drop canvas." },
    ],
  }),
  component: WorkflowStudio,
});

type NodeKind = "trigger" | "agent" | "condition" | "tool" | "output";
type FlowNode = {
  id: string;
  kind: NodeKind;
  title: string;
  description: string;
  x: number;
  y: number;
  config: string;
};
type Edge = { id: string; from: string; to: string };

const NODE_META: Record<NodeKind, { label: string; description: string; icon: typeof Zap; tint: string }> = {
  trigger: { label: "Trigger", description: "Start a workflow from a prompt or event.", icon: Zap, tint: "text-amber-300 bg-amber-400/10 border-amber-300/20" },
  agent: { label: "AI agent", description: "Delegate a task to a specialized agent.", icon: Bot, tint: "text-violet-300 bg-violet-400/10 border-violet-300/20" },
  condition: { label: "Condition", description: "Branch based on a rule or model result.", icon: GitBranch, tint: "text-cyan-300 bg-cyan-400/10 border-cyan-300/20" },
  tool: { label: "Tool", description: "Run a tool or external integration.", icon: Code2, tint: "text-emerald-300 bg-emerald-400/10 border-emerald-300/20" },
  output: { label: "Output", description: "Collect and format the final result.", icon: Sparkles, tint: "text-pink-300 bg-pink-400/10 border-pink-300/20" },
};

const START_NODES: FlowNode[] = [
  { id: "trigger-1", kind: "trigger", title: "New task", description: "Workflow input", x: 70, y: 220, config: "Accept the user's task and pass the full request to the next node." },
  { id: "agent-1", kind: "agent", title: "Research agent", description: "Gather evidence and sources", x: 365, y: 120, config: "Research the task, collect reliable sources, and return concise findings with citations." },
  { id: "agent-2", kind: "agent", title: "Analysis agent", description: "Synthesize findings", x: 365, y: 355, config: "Analyze the previous agent's output, identify gaps, and produce a reasoned synthesis." },
  { id: "output-1", kind: "output", title: "Final response", description: "Format the deliverable", x: 700, y: 245, config: "Combine upstream results into a clear, structured final response." },
];
const START_EDGES: Edge[] = [
  { id: "e1", from: "trigger-1", to: "agent-1" },
  { id: "e2", from: "agent-1", to: "agent-2" },
  { id: "e3", from: "agent-2", to: "output-1" },
];

function makeId(prefix: string) {
  return prefix + "-" + Math.random().toString(36).slice(2, 9);
}

function WorkflowStudio() {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const [nodes, setNodes] = useState<FlowNode[]>(START_NODES);
  const [edges, setEdges] = useState<Edge[]>(START_EDGES);
  const [selectedId, setSelectedId] = useState<string | null>("agent-1");
  const [connectMode, setConnectMode] = useState(false);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [workflowName, setWorkflowName] = useState("Research & synthesis pipeline");
  const [saved, setSaved] = useState(false);
  const selected = nodes.find((node) => node.id === selectedId) ?? null;

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("teraxgpt-workflow-studio-v1");
      if (!raw) return;
      const parsed = JSON.parse(raw) as { nodes?: FlowNode[]; edges?: Edge[]; name?: string };
      if (Array.isArray(parsed.nodes) && parsed.nodes.length) setNodes(parsed.nodes);
      if (Array.isArray(parsed.edges)) setEdges(parsed.edges);
      if (parsed.name) setWorkflowName(parsed.name);
    } catch { /* keep the starter workflow when saved data is invalid */ }
  }, []);

  const edgePaths = useMemo(() => edges.flatMap((edge) => {
    const from = nodes.find((node) => node.id === edge.from);
    const to = nodes.find((node) => node.id === edge.to);
    if (!from || !to) return [];
    const x1 = from.x + 214;
    const y1 = from.y + 66;
    const x2 = to.x;
    const y2 = to.y + 66;
    const bend = Math.max(55, Math.abs(x2 - x1) * 0.45);
    return [{ ...edge, d: `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}` }];
  }), [edges, nodes]);

  function addNode(kind: NodeKind, x = 420, y = 250) {
    const id = makeId(kind);
    const meta = NODE_META[kind];
    const node: FlowNode = { id, kind, title: kind === "agent" ? "New AI agent" : meta.label, description: meta.description, x: Math.max(16, Math.min(850, x)), y: Math.max(20, Math.min(540, y)), config: kind === "agent" ? "Describe the agent's role, instructions, and expected output." : meta.description };
    setNodes((current) => [...current, node]);
    setSelectedId(id);
    setSaved(false);
  }

  function onCanvasDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const canvas = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - canvas.left + event.currentTarget.scrollLeft;
    const y = event.clientY - canvas.top + event.currentTarget.scrollTop;
    const moveId = event.dataTransfer.getData("application/x-terax-node-id");
    if (moveId) {
      setNodes((current) => current.map((node) => node.id === moveId ? { ...node, x: Math.max(10, Math.min(850, x - 105)), y: Math.max(10, Math.min(540, y - 35)) } : node));
      setSaved(false);
      return;
    }
    const kind = event.dataTransfer.getData("application/x-terax-node-kind") as NodeKind;
    if (kind in NODE_META) addNode(kind, x - 105, y - 35);
  }

  function clickNode(id: string) {
    setSelectedId(id);
    if (!connectMode) return;
    if (!connectFrom) {
      setConnectFrom(id);
      return;
    }
    if (connectFrom === id) {
      setConnectFrom(null);
      return;
    }
    if (edges.some((edge) => edge.from === connectFrom && edge.to === id)) {
      toast.info("Those nodes are already connected.");
    } else {
      setEdges((current) => [...current, { id: makeId("edge"), from: connectFrom, to: id }]);
      setSaved(false);
      toast.success("Connection added.");
    }
    setConnectFrom(null);
    setConnectMode(false);
  }

  function saveWorkflow() {
    try {
      window.localStorage.setItem("teraxgpt-workflow-studio-v1", JSON.stringify({ name: workflowName, nodes, edges, updatedAt: new Date().toISOString() }));
      setSaved(true);
      toast.success("Workflow saved in this browser.");
    } catch {
      toast.error("Could not save workflow in this browser.");
    }
  }

  function exportWorkflow() {
    const blob = new Blob([JSON.stringify({ name: workflowName, nodes, edges }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = (workflowName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || "terax-workflow") + ".json";
    link.click();
    URL.revokeObjectURL(url);
  }

  function deleteSelected() {
    if (!selected) return;
    setNodes((current) => current.filter((node) => node.id !== selected.id));
    setEdges((current) => current.filter((edge) => edge.from !== selected.id && edge.to !== selected.id));
    setSelectedId(null);
    setSaved(false);
  }

  if (loading || !session) return <div className="grid min-h-screen place-items-center bg-background text-sm text-subtle">Loading workflow studio…</div>;

  return (
    <main className="min-h-screen bg-[#0c0e14] text-[#edf0fb]">
      <header className="flex flex-wrap items-center gap-3 border-b border-white/[0.08] px-4 py-3 md:px-6">
        <Button variant="ghost" size="icon" onClick={() => void navigate({ to: "/" })} aria-label="Back to chat" className="text-white/70 hover:bg-white/5 hover:text-white"><ArrowLeft /></Button>
        <div className="grid size-9 place-items-center rounded-xl border border-violet-300/20 bg-violet-400/10 text-violet-200"><Workflow className="size-5" /></div>
        <div className="min-w-0 flex-1">
          <input aria-label="Workflow name" value={workflowName} onChange={(event) => { setWorkflowName(event.target.value); setSaved(false); }} className="w-full max-w-md bg-transparent font-semibold outline-none placeholder:text-white/30" />
          <p className="mt-0.5 text-[11px] text-white/45">Visual automation studio <span className="mx-1.5">·</span> {nodes.length} nodes <span className="mx-1.5">·</span> {edges.length} connections</p>
        </div>
        <span className="hidden rounded-full border border-amber-200/20 bg-amber-200/[0.06] px-3 py-1.5 text-[10px] text-amber-100/80 sm:inline-flex">Editor preview · execution not connected</span>
        <Button variant="outline" onClick={exportWorkflow} className="gap-2 border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.08]"><ArrowDownToLine className="size-4" /><span className="hidden sm:inline">Export JSON</span></Button>
        <Button onClick={saveWorkflow} className="gap-2 bg-violet-300 text-[#15131f] hover:bg-violet-200"><Save className="size-4" />{saved ? "Saved" : "Save workflow"}</Button>
      </header>

      <div className="grid min-h-[calc(100vh-66px)] grid-cols-1 xl:grid-cols-[236px_minmax(0,1fr)_290px]">
        <aside className="border-b border-white/[0.08] bg-[#10131b] p-4 xl:border-b-0 xl:border-r">
          <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">Node library</div>
          <p className="mb-4 text-xs leading-relaxed text-white/50">Drag a node onto the canvas or click Add to build your agent workflow.</p>
          <div className="grid grid-cols-2 gap-2 xl:grid-cols-1">
            {(Object.keys(NODE_META) as NodeKind[]).map((kind) => {
              const meta = NODE_META[kind];
              const Icon = meta.icon;
              return <div key={kind} draggable onDragStart={(event) => event.dataTransfer.setData("application/x-terax-node-kind", kind)} className="group flex cursor-grab items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] p-2.5 transition hover:border-violet-300/30 hover:bg-white/[0.05] active:cursor-grabbing">
                <span className={`grid size-9 shrink-0 place-items-center rounded-lg border ${meta.tint}`}><Icon className="size-4" /></span>
                <span className="min-w-0 flex-1"><span className="block text-xs font-medium">{meta.label}</span><span className="mt-0.5 block text-[10px] leading-snug text-white/40">{meta.description}</span></span>
                <button type="button" aria-label={`Add ${meta.label}`} onClick={() => addNode(kind)} className="rounded-md p-1 text-white/40 hover:bg-white/10 hover:text-white"><Plus className="size-4" /></button>
              </div>;
            })}
          </div>
          <div className="mt-6 rounded-xl border border-violet-300/15 bg-violet-300/[0.05] p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-violet-100"><Sparkles className="size-4" /> Multi-agent pattern</div>
            <p className="mt-2 text-[11px] leading-relaxed text-white/50">Chain specialized agents: research → analysis → review → final output. Add condition nodes for branching.</p>
            <button type="button" onClick={() => { setNodes(START_NODES); setEdges(START_EDGES); setSelectedId("agent-1"); setSaved(false); }} className="mt-3 text-[11px] font-medium text-violet-200 hover:text-white">Reset starter workflow ↗</button>
          </div>
        </aside>

        <section className="min-w-0 overflow-hidden bg-[#0c0e14]">
          <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.07] px-4 py-3">
            <span className="flex items-center gap-2 text-xs text-white/70"><span className="size-1.5 rounded-full bg-emerald-300" /> Canvas</span>
            <span className="text-[10px] text-white/35">Drag nodes to arrange · connect mode to link steps</span>
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant={connectMode ? "default" : "outline"} onClick={() => { setConnectMode((value) => !value); setConnectFrom(null); }} className={connectMode ? "h-8 bg-cyan-300 text-slate-950 hover:bg-cyan-200" : "h-8 border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.08]"}><GitBranch className="mr-1 size-3.5" />{connectMode ? "Select first node…" : "Connect nodes"}</Button>
              <Button size="sm" variant="ghost" onClick={() => { setEdges((current) => current.filter((edge) => edge.id !== current[current.length - 1]?.id)); setSaved(false); }} className="h-8 text-white/60 hover:bg-white/5 hover:text-white">Undo link</Button>
            </div>
          </div>
          {connectMode && <div className="border-b border-cyan-300/20 bg-cyan-300/[0.06] px-4 py-2 text-[11px] text-cyan-100">{connectFrom ? "Now select the destination node." : "Select a source node, then select the destination node."}</div>}
          <div className="h-[640px] overflow-auto">
            <div onDragOver={(event) => event.preventDefault()} onDrop={onCanvasDrop} className="relative min-h-[640px] min-w-[1100px] overflow-hidden" style={{ backgroundImage: "radial-gradient(circle, rgba(160,170,205,.16) 1px, transparent 1px)", backgroundSize: "22px 22px" }}>
              <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
                <defs><marker id="terax-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="#7773d8" /></marker></defs>
                {edgePaths.map((edge) => <path key={edge.id} d={edge.d} fill="none" stroke="#7773d8" strokeOpacity=".8" strokeWidth="1.8" markerEnd="url(#terax-arrow)" />)}
              </svg>
              {nodes.map((node) => {
                const meta = NODE_META[node.kind];
                const Icon = meta.icon;
                const active = selectedId === node.id;
                const waiting = connectFrom === node.id;
                return <article key={node.id} draggable onDragStart={(event) => { event.dataTransfer.setData("application/x-terax-node-id", node.id); event.dataTransfer.effectAllowed = "move"; }} onClick={() => clickNode(node.id)} style={{ left: node.x, top: node.y }} className={`absolute z-10 w-[214px] cursor-grab rounded-xl border bg-[#151923] shadow-xl transition-colors active:cursor-grabbing ${active ? "border-violet-300/70 shadow-violet-950/30 ring-1 ring-violet-300/20" : waiting ? "border-cyan-300 ring-2 ring-cyan-300/20" : "border-white/[0.11] hover:border-white/25"}`}>
                  <div className="flex items-center gap-2 border-b border-white/[0.07] px-3 py-2.5">
                    <span className={`grid size-8 place-items-center rounded-lg border ${meta.tint}`}><Icon className="size-4" /></span>
                    <span className="min-w-0 flex-1"><span className="block text-[10px] uppercase tracking-[0.14em] text-white/40">{meta.label}</span><span className="block truncate text-xs font-semibold">{node.title}</span></span>
                    <GripVertical className="size-4 text-white/25" />
                  </div>
                  <p className="min-h-[44px] px-3 py-2.5 text-[11px] leading-relaxed text-white/55">{node.description}</p>
                  <div className="flex items-center justify-between border-t border-white/[0.07] px-3 py-2 text-[10px] text-white/35"><span>{edges.filter((edge) => edge.to === node.id).length} incoming</span><span>{edges.filter((edge) => edge.from === node.id).length} outgoing</span></div>
                </article>;
              })}
              {nodes.length === 0 && <div className="absolute inset-0 grid place-items-center text-sm text-white/40">Drag a node here to start your workflow.</div>}
            </div>
          </div>
          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.07] px-4 py-3 text-[10px] text-white/35"><span>Local canvas · saved in this browser</span><span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-amber-300" />Execution runtime not connected yet</span></footer>
        </section>

        <aside className="border-t border-white/[0.08] bg-[#10131b] p-4 xl:border-l xl:border-t-0">
          <div className="mb-4 flex items-center gap-2"><div className="grid size-8 place-items-center rounded-lg bg-white/[0.06]"><SlidersIcon /></div><div><h2 className="text-sm font-semibold">Node settings</h2><p className="text-[10px] text-white/40">Configure selected step</p></div></div>
          {selected ? <div className="space-y-4">
            <div><label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.14em] text-white/40">Node name</label><input value={selected.title} onChange={(event) => { setNodes((current) => current.map((node) => node.id === selected.id ? { ...node, title: event.target.value } : node)); setSaved(false); }} className="w-full rounded-lg border border-white/10 bg-[#0c0e14] px-3 py-2.5 text-xs outline-none focus:border-violet-300/50" /></div>
            <div><label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.14em] text-white/40">Node type</label><div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0c0e14] p-3"><span className={`grid size-8 place-items-center rounded-lg border ${NODE_META[selected.kind].tint}`}>{(() => { const Icon = NODE_META[selected.kind].icon; return <Icon className="size-4" />; })()}</span><div><p className="text-xs font-medium">{NODE_META[selected.kind].label}</p><p className="text-[10px] text-white/40">{selected.kind}</p></div></div></div>
            <div><label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.14em] text-white/40">Instructions / configuration</label><textarea rows={8} value={selected.config} onChange={(event) => { setNodes((current) => current.map((node) => node.id === selected.id ? { ...node, config: event.target.value } : node)); setSaved(false); }} className="w-full resize-y rounded-lg border border-white/10 bg-[#0c0e14] px-3 py-2.5 text-xs leading-relaxed outline-none focus:border-violet-300/50" /></div>
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">Connections</p><p className="mt-2 text-xs text-white/70">Upstream: {edges.filter((edge) => edge.to === selected.id).map((edge) => nodes.find((node) => node.id === edge.from)?.title).filter(Boolean).join(", ") || "None"}</p><p className="mt-1 text-xs text-white/70">Downstream: {edges.filter((edge) => edge.from === selected.id).map((edge) => nodes.find((node) => node.id === edge.to)?.title).filter(Boolean).join(", ") || "None"}</p></div>
            <Button variant="outline" onClick={deleteSelected} className="w-full border-rose-300/20 bg-rose-300/[0.04] text-rose-200 hover:bg-rose-300/10"><Trash2 className="mr-2 size-4" />Delete node</Button>
          </div> : <div className="rounded-xl border border-dashed border-white/10 p-5 text-center"><Bot className="mx-auto size-6 text-white/30" /><p className="mt-3 text-xs text-white/55">Select a node on the canvas to configure its instructions and connections.</p></div>}
          <div className="mt-6 rounded-xl border border-amber-200/15 bg-amber-200/[0.04] p-3"><div className="flex items-center gap-2 text-xs font-medium text-amber-100/90"><CirclePlay className="size-4" />Run status</div><p className="mt-2 text-[11px] leading-relaxed text-white/50">This release provides visual editing, connections, local save, and JSON export. Executing chained agents requires a workflow runtime and is not simulated here.</p></div>
        </aside>
      </div>
    </main>
  );
}

function SlidersIcon() {
  return <ChevronDown className="size-4 -rotate-90 text-white/70" />;
}
