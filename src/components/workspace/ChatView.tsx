import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Markdown } from "@/components/workspace/Markdown";
import { ContextPanel, type TurnInfo } from "@/components/workspace/ContextPanel";
import { supabase } from "@/integrations/supabase/client";
import { AUTO, MODELS, estimateCost, getModel } from "@/lib/models";

export type ChatMetadata = {
  modelId?: string;
  modelLabel?: string;
  provider?: string;
  task?: string;
  reason?: string;
  inputTokens?: number;
  outputTokens?: number;
};

export type AppMessage = UIMessage<ChatMetadata>;

const CAPABILITY_PROMPTS = [
  { label: "Research", prompt: "Research " },
  { label: "Code", prompt: "Write code that " },
  { label: "Analyze file", prompt: "Analyze the attached file and " },
  { label: "Data analysis", prompt: "Analyze this data and " },
];

function textOf(message: AppMessage) {
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("\n");
}

export function ChatView({
  conversationId,
  initialMessages,
  initialTitle,
  monthlyCost,
  onConversationCreated,
  onTitleChange,
  onUsage,
}: {
  conversationId: string | null;
  initialMessages: AppMessage[];
  initialTitle: string;
  monthlyCost: number;
  onConversationCreated: (id: string, title: string) => void;
  onTitleChange: (id: string, title: string) => void;
  onUsage: (cost: number) => void;
}) {
  const [modelId, setModelId] = useState<string>(AUTO);
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [turn, setTurn] = useState<TurnInfo | null>(null);

  const modelRef = useRef(modelId);
  modelRef.current = modelId;
  const conversationRef = useRef<string | null>(conversationId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    conversationRef.current = conversationId;
  }, [conversationId]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<AppMessage>({
        api: "/api/chat",
        prepareSendMessagesRequest: async ({ messages }) => {
          const { data } = await supabase.auth.getSession();
          return {
            headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` },
            body: { messages, modelId: modelRef.current },
          };
        },
      }),
    [],
  );

  const { messages, sendMessage, status, error, stop, regenerate } = useChat<AppMessage>({
    transport,
    messages: initialMessages,
    onFinish: async ({ message }) => {
      const meta = message.metadata ?? {};
      const model = getModel(meta.modelId ?? MODELS[0]!.id);
      const cost = estimateCost(model, meta.inputTokens ?? 0, meta.outputTokens ?? 0);
      setTurn({ ...meta, cost });

      const convId = conversationRef.current;
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!convId || !userId) return;

      await supabase.from("messages").insert({
        conversation_id: convId,
        user_id: userId,
        role: "assistant",
        content: [{ type: "text", text: textOf(message) }],
        model: meta.modelId ?? null,
        routed_reason: meta.reason ?? null,
      });
      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", convId);
      await supabase.from("usage_records").insert({
        user_id: userId,
        conversation_id: convId,
        provider: model.provider,
        model: model.id,
        input_tokens: meta.inputTokens ?? 0,
        output_tokens: meta.outputTokens ?? 0,
        estimated_cost: cost,
      });
      onUsage(cost);
    },
    onError: (err) => toast.error(err.message || "The model could not answer. Try again."),
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const busy = status === "submitted" || status === "streaming";

  const attachments = useMemo(() => {
    const out: { name: string; size: number; type: string }[] = [];
    for (const message of messages) {
      for (const part of message.parts) {
        if (part.type === "file") {
          out.push({
            name: (part as { filename?: string }).filename ?? "attachment",
            size: 0,
            type: (part as { mediaType?: string }).mediaType ?? "",
          });
        }
      }
    }
    return out;
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if ((!text && files.length === 0) || busy) return;

    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return;

    let convId = conversationRef.current;
    const title = text.slice(0, 60) || "File analysis";
    if (!convId) {
      const { data, error: createError } = await supabase
        .from("conversations")
        .insert({ user_id: userId, title, model_preference: modelId })
        .select("id")
        .single();
      if (createError || !data) {
        toast.error("Could not start the conversation.");
        return;
      }
      convId = data.id;
      conversationRef.current = convId;
      onConversationCreated(convId, title);
    } else if (messages.length === 0) {
      await supabase.from("conversations").update({ title }).eq("id", convId);
      onTitleChange(convId, title);
    }

    await supabase.from("messages").insert({
      conversation_id: convId,
      user_id: userId,
      role: "user",
      content: [
        { type: "text", text },
        ...files.map((f) => ({ type: "file", name: f.name, mediaType: f.type })),
      ],
    });

    const dataTransfer = new DataTransfer();
    files.forEach((file) => dataTransfer.items.add(file));
    void sendMessage(files.length ? { text, files: dataTransfer.files } : { text });
    setInput("");
    setFiles([]);
  }

  const activeModelLabel = modelId === AUTO ? "Auto" : getModel(modelId).label;

  return (
    <>
      <main className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-panel/60 px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-[13px] font-medium text-ink">
                {initialTitle || "New chat"}
              </span>
              <span className="rounded-full bg-signal-soft px-2 py-0.5 text-[10px] font-medium text-signal">
                {activeModelLabel}
              </span>
            </div>
            <div className="text-[11px] text-subtle">
              {turn?.reason ?? "Auto routes each message to a suitable model"}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {busy ? (
              <button
                type="button"
                onClick={() => stop()}
                className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-subtle ring-1 ring-black/5 hover:bg-black/[0.03]"
              >
                Stop
              </button>
            ) : (
              messages.length > 0 && (
                <button
                  type="button"
                  onClick={() => void regenerate()}
                  className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-subtle ring-1 ring-black/5 hover:bg-black/[0.03]"
                >
                  Regenerate
                </button>
              )
            )}
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-8">
          <div className="mx-auto max-w-[760px]">
            {messages.length === 0 && (
              <div className="pt-10 text-center">
                <h1 className="font-display text-[22px] font-semibold tracking-tight">
                  What do you want to get done?
                </h1>
                <p className="mt-2 text-[13px] text-subtle">
                  Ask anything, drop a PDF or an image. Auto picks the model for the task.
                </p>
              </div>
            )}

            {messages.map((message) =>
              message.role === "user" ? (
                <div key={message.id} className="mt-7 flex justify-end first:mt-0">
                  <div className="max-w-[440px]">
                    <div className="mb-1.5 text-right text-[11px] text-subtle">You</div>
                    <div className="rounded-2xl rounded-tr-md bg-ink px-4 py-3 text-[14px] leading-relaxed text-white">
                      {message.parts
                        .filter((p) => p.type === "file")
                        .map((part, index) => (
                          <span
                            key={index}
                            className="mb-2 flex w-fit items-center gap-2 rounded-lg bg-white/10 px-2.5 py-1.5 text-[12px]"
                          >
                            <span className="grid size-4 place-items-center rounded bg-white/15 text-[9px] font-semibold">
                              {(part as { mediaType?: string }).mediaType?.startsWith("image/")
                                ? "IMG"
                                : "DOC"}
                            </span>
                            {(part as { filename?: string }).filename ?? "attachment"}
                          </span>
                        ))}
                      <span className="whitespace-pre-wrap">{textOf(message)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div key={message.id} className="mt-7 flex gap-3 first:mt-0">
                  <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-signal text-[12px] font-semibold text-white">
                    A
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-center gap-2 text-[11px] text-subtle">
                      Assistant <span className="text-subtle/60">·</span> routed{" "}
                      <span className="font-medium text-ink">
                        {message.metadata?.task ?? "Auto"}
                      </span>
                      {message.metadata?.modelLabel && (
                        <span className="rounded-full bg-signal-soft px-2 py-0.5 text-[10px] font-medium text-signal">
                          {message.metadata.modelLabel}
                        </span>
                      )}
                    </div>
                    <Markdown>{textOf(message)}</Markdown>
                  </div>
                </div>
              ),
            )}

            {busy && (
              <div className="mt-4 flex items-center gap-2.5 rounded-lg bg-panel px-3 py-2.5 text-[12px] ring-1 ring-black/5">
                <span className="flex items-center gap-1">
                  <span className="stream-dot size-1.5 rounded-full bg-signal" />
                  <span
                    className="stream-dot size-1.5 rounded-full bg-signal"
                    style={{ animationDelay: "0.18s" }}
                  />
                  <span
                    className="stream-dot size-1.5 rounded-full bg-signal"
                    style={{ animationDelay: "0.36s" }}
                  />
                </span>
                <span className="font-medium text-ink">
                  {status === "submitted" ? "Routing your request" : "Streaming response"}
                </span>
                <span className="text-subtle">{activeModelLabel}</span>
              </div>
            )}

            {error && (
              <p className="mt-4 rounded-lg bg-panel px-3 py-2.5 text-[12px] text-subtle ring-1 ring-black/5">
                {error.message}
              </p>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-line bg-panel/60 px-6 pb-5 pt-3">
          <div className="mx-auto max-w-[760px]">
            <div className="mb-2.5 flex flex-wrap gap-1.5">
              {CAPABILITY_PROMPTS.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setInput(item.prompt)}
                  className="rounded-full bg-panel px-2.5 py-1 text-[11px] font-medium text-subtle ring-1 ring-black/5 hover:text-ink"
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="rounded-2xl bg-panel p-2.5 ring-1 ring-black/5">
              {files.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5 px-1">
                  {files.map((file, index) => (
                    <span
                      key={`${file.name}-${index}`}
                      className="flex items-center gap-1.5 rounded-lg bg-signal-soft px-2.5 py-1 text-[11px] text-ink"
                    >
                      {file.name}
                      <button
                        type="button"
                        className="text-subtle hover:text-ink"
                        onClick={() => setFiles(files.filter((_, i) => i !== index))}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-end gap-2">
                <div className="flex items-center gap-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    hidden
                    accept="image/*,.pdf,.txt,.md,.csv,.json"
                    onChange={(event) => {
                      setFiles([...files, ...Array.from(event.target.files ?? [])]);
                      event.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="grid size-8 place-items-center rounded-lg text-subtle hover:bg-black/[0.04]"
                    aria-label="Attach a file"
                  >
                    <span className="text-[13px] leading-none">📎</span>
                  </button>
                </div>
                <textarea
                  rows={1}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                      event.preventDefault();
                      void handleSend();
                    }
                  }}
                  placeholder="Ask anything, or drop a file…"
                  className="max-h-40 flex-1 resize-none bg-transparent py-1.5 text-[14px] outline-none placeholder:text-subtle"
                />
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={busy}
                  className="flex size-8 items-center justify-center rounded-lg bg-signal text-white ring-1 ring-signal disabled:opacity-50"
                  aria-label="Send"
                >
                  <span className="text-[13px] leading-none">↑</span>
                </button>
              </div>

              <div className="mt-2 flex items-center gap-2 border-t border-line px-1 pt-2">
                <select
                  value={modelId}
                  onChange={(event) => setModelId(event.target.value)}
                  className="rounded-full bg-signal-soft px-2 py-0.5 text-[11px] font-medium text-signal outline-none"
                >
                  <option value={AUTO}>Auto</option>
                  {MODELS.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.label}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-subtle">
                  {modelId === AUTO
                    ? "Routes to the best model for this task"
                    : getModel(modelId).blurb}
                </span>
                <span className="ml-auto font-mono text-[11px] text-subtle">⌘↵ to send</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <ContextPanel
        attachments={attachments}
        turn={turn}
        monthlyCost={monthlyCost}
        messageCount={messages.length}
      />
    </>
  );
}
