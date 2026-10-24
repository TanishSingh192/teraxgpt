import { useState } from "react";
import { BrainCircuit, FileText, Gauge, Layers3 } from "lucide-react";
import { getModel } from "@/lib/models";

export type TurnInfo = {
  modelId?: string;
  modelLabel?: string;
  task?: string;
  reason?: string;
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
};

type PanelTab = "context" | "artifacts" | "tokens";

export function ContextPanel({
  attachments,
  turn,
  monthlyCost,
  messageCount,
}: {
  attachments: { name: string; size: number; type: string }[];
  turn: TurnInfo | null;
  monthlyCost: number;
  messageCount: number;
}) {
  const model = turn?.modelId ? getModel(turn.modelId) : null;
  const [tab, setTab] = useState<PanelTab>("context");
  const totalTokens = (turn?.inputTokens ?? 0) + (turn?.outputTokens ?? 0);
  const tokenRatio = Math.min(100, Math.round(totalTokens / 1000000 * 100));
  const tabs = [
    { id: "context" as const, label: "Context", Icon: BrainCircuit },
    { id: "artifacts" as const, label: "Artifacts", Icon: FileText },
    { id: "tokens" as const, label: "Tokens", Icon: Gauge },
  ];

  return (
    <aside className="hidden w-[300px] shrink-0 flex-col border-l border-line bg-panel/80 px-4 py-4 xl:flex">
      <div className="mb-4 flex items-center justify-between">
        <span className="font-display text-[13px] font-semibold tracking-tight">Workspace</span>
        <span className="text-[10px] text-subtle">{messageCount} messages</span>
      </div>
      <div className="mb-5 grid grid-cols-3 gap-1 rounded-xl bg-background p-1">
        {tabs.map(({ id, label, Icon }) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={"flex min-w-0 flex-col items-center gap-1 rounded-lg px-1 py-2 text-[10px] transition-colors " + (tab === id ? "bg-panel text-ink shadow-sm ring-1 ring-line/60" : "text-subtle hover:text-ink")}>
            <Icon className="size-4" />{label}
          </button>
        ))}
      </div>

      {tab === "context" && <>
        <div className="mb-2 flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.14em] text-subtle">
          <span>Active context window</span><span className="font-mono text-signal">{tokenRatio}%</span>
        </div>
        <div className="mb-5 rounded-xl bg-background p-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-signal transition-all" style={{ width: tokenRatio + "%" }} /></div>
          <div className="mt-2 flex justify-between gap-2 font-mono text-[10px] text-subtle"><span>{totalTokens.toLocaleString()} tokens</span><span>1,000,000 max*</span></div>
        </div>
        <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-subtle">Model & routing</div>
        <div className="mb-4 rounded-xl bg-background p-3">
          {turn ? <>
            <div className="flex items-center justify-between gap-2 text-[12px]"><span className="font-medium">{turn.task ?? "General"}</span><span className="truncate text-subtle">{model?.label ?? turn.modelLabel}</span></div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full w-3/4 rounded-full bg-signal" /></div>
            <div className="mt-2 text-[11px] text-subtle">{turn.reason}</div>
            <div className="mt-2 font-mono text-[10px] text-subtle">{totalTokens.toLocaleString()} tokens · est. ${(turn.cost ?? 0).toFixed(4)}</div>
          </> : <p className="text-[12px] text-subtle">Send a message to see model and token details.</p>}
        </div>
        <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-subtle">Usage</div>
        <div className="rounded-xl bg-background p-3">
          <div className="flex items-center justify-between text-[12px]"><span className="font-medium">This month</span><span className="font-mono text-signal">${monthlyCost.toFixed(4)}</span></div>
          <p className="mt-1 text-[11px] text-subtle">Estimated from provider-reported token usage.</p>
        </div>
        <div className="mt-4 rounded-xl border border-dashed border-line p-3"><div className="text-[11px] font-medium">Context notes</div><p className="mt-1 text-[11px] text-subtle">Token counts reflect reported usage, not a live model context-window measurement.</p></div>
      </>}

      {tab === "artifacts" && <>
        <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-subtle">Conversation files</div>
        {attachments.length ? <div className="flex flex-col gap-2">{attachments.map((file, index) => (
          <div key={file.name + index} className="flex min-w-0 items-center gap-2 rounded-xl bg-background p-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-signal-soft text-[9px] font-semibold text-signal">{file.type.startsWith("image/") ? "IMG" : (file.name.split(".").pop() ?? "FILE").slice(0, 4).toUpperCase()}</span>
            <div className="min-w-0"><div className="truncate text-xs font-medium">{file.name}</div><div className="text-[10px] text-subtle">{file.size > 0 ? (file.size / 1024 / 1024).toFixed(2) + " MB" : "attached"}</div></div>
          </div>
        ))}</div> : <div className="rounded-xl bg-background p-4 text-xs text-subtle">Attachments from this conversation will appear here.</div>}
        <div className="mt-4 rounded-xl border border-dashed border-line p-4"><Layers3 className="mb-2 size-5 text-signal" /><div className="text-xs font-medium">Generated project</div><p className="mt-1 text-[11px] text-subtle">Use Open in IDE on a code response to collect generated files into one workspace.</p></div>
      </>}

      {tab === "tokens" && <>
        <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-subtle">Token usage</div>
        <div className="rounded-xl bg-background p-3"><div className="text-[11px] text-subtle">Reported total</div><div className="mt-1 font-mono text-2xl text-signal">{totalTokens.toLocaleString()}</div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full bg-signal" style={{ width: tokenRatio + "%" }} /></div><div className="mt-2 flex justify-between gap-2 text-[10px] text-subtle"><span>Input {(turn?.inputTokens ?? 0).toLocaleString()}</span><span>Output {(turn?.outputTokens ?? 0).toLocaleString()}</span></div></div>
        <div className="mt-3 rounded-xl bg-background p-3"><div className="text-xs font-medium">Estimated cost</div><div className="mt-1 font-mono text-lg">${(turn?.cost ?? 0).toFixed(4)}</div><div className="mt-1 text-[10px] text-subtle">Reported usage can vary by provider.</div></div>
      </>}

      <div className="mt-auto pt-5 text-[10px] leading-relaxed text-subtle">TeraXGPT can make mistakes. Verify critical technical details before deployment.</div>
    </aside>
  );
}
