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

  return (
    <aside className="hidden w-[300px] shrink-0 flex-col border-l border-line bg-panel/60 px-4 py-5 xl:flex">
      <div className="mb-4 flex items-center justify-between">
        <span className="font-display text-[13px] font-semibold tracking-tight">Context</span>
        <span className="text-[11px] text-subtle">{messageCount} messages</span>
      </div>

      <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-subtle">
        Attached
      </div>
      {attachments.length === 0 ? (
        <p className="mb-4 rounded-lg bg-panel px-3 py-2.5 text-[12px] text-subtle ring-1 ring-black/5">
          No files in this conversation.
        </p>
      ) : (
        <div className="mb-4 flex flex-col gap-1.5">
          {attachments.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center gap-2.5 rounded-lg bg-panel px-3 py-2.5 ring-1 ring-black/5"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-md bg-ink text-[9px] font-semibold text-white">
                {file.type.startsWith("image/")
                  ? "IMG"
                  : (file.name.split(".").pop() ?? "FILE").slice(0, 4).toUpperCase()}
              </span>
              <div className="min-w-0 leading-tight">
                <div className="truncate text-[12px] font-medium">{file.name}</div>
                <div className="text-[11px] text-subtle">
                  {file.size > 0 ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "attached"}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-subtle">
        Routing
      </div>
      <div className="mb-4 rounded-lg bg-panel p-3 ring-1 ring-black/5">
        {turn ? (
          <>
            <div className="flex items-center justify-between text-[12px]">
              <span className="font-medium">{turn.task ?? "General"}</span>
              <span className="text-subtle">{model?.label ?? turn.modelLabel}</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line">
              <div className="h-full w-3/4 rounded-full bg-signal" />
            </div>
            <div className="mt-1.5 text-[11px] text-subtle">{turn.reason}</div>
            <div className="mt-1.5 font-mono text-[10px] text-subtle">
              {(turn.inputTokens ?? 0) + (turn.outputTokens ?? 0)} tokens · est. $
              {(turn.cost ?? 0).toFixed(4)}
            </div>
          </>
        ) : (
          <p className="text-[12px] text-subtle">Send a message to see which model answered.</p>
        )}
      </div>

      <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-subtle">
        Usage
      </div>
      <div className="rounded-lg bg-panel p-3 ring-1 ring-black/5">
        <div className="flex items-center justify-between text-[12px]">
          <span className="font-medium">This month</span>
          <span className="font-mono text-[12px] text-signal">${monthlyCost.toFixed(4)}</span>
        </div>
        <p className="mt-1 text-[11px] text-subtle">
          Estimated from tokens reported by each provider.
        </p>
      </div>

      <div className="mt-auto rounded-lg bg-signal-soft p-3">
        <div className="text-[12px] font-medium text-ink">Model abstraction</div>
        <div className="mt-0.5 text-[11px] text-subtle">
          Auto picks a model per task. Pick one manually any time from the composer.
        </div>
      </div>
    </aside>
  );
}
