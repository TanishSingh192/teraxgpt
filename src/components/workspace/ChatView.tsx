import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Bot, ChevronDown, Menu, Paperclip, RotateCcw, Square, X } from "lucide-react";
import { toast } from "sonner";

import { Markdown } from "@/components/workspace/Markdown";
import { Button } from "@/components/ui/button";
import type { TurnInfo } from "@/components/workspace/ContextPanel";
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
  onOpenSidebar,
}: {
  conversationId: string | null;
  initialMessages: AppMessage[];
  initialTitle: string;
  monthlyCost: number;
  onConversationCreated: (id: string, title: string) => void;
  onTitleChange: (id: string, title: string) => void;
  onUsage: (cost: number) => void;
  onOpenSidebar: () => void;
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
      <main className="relative flex min-w-0 flex-1 flex-col bg-panel">
        <header className="flex h-14 shrink-0 items-center gap-2 px-3 md:px-5">
          <Button variant="ghost" size="icon" onClick={onOpenSidebar} className="md:hidden" aria-label="Open sidebar"><Menu /></Button>
          <label className="relative flex items-center">
            <select value={modelId} onChange={(event) => setModelId(event.target.value)} className="appearance-none rounded-lg bg-transparent py-2 pl-2 pr-7 font-display text-[15px] font-semibold outline-none hover:bg-background">
              <option value={AUTO}>Multiform Auto</option>
              {MODELS.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 size-3.5 text-subtle" />
          </label>
          <div className="ml-auto flex items-center gap-2">
            {busy ? (
              <Button variant="ghost" size="sm" onClick={() => stop()}><Square /> Stop</Button>
            ) : (
              messages.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => void regenerate()}><RotateCcw /> Regenerate</Button>
              )
            )}
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-44 pt-8 md:px-8">
          <div className="mx-auto max-w-[760px]">
            {messages.length === 0 && (
              <div className="flex min-h-[52vh] flex-col items-center justify-center text-center">
                <div className="mb-5 grid size-11 place-items-center rounded-xl bg-ink text-primary-foreground"><Bot className="size-5" /></div>
                <h1 className="font-display text-[28px] font-semibold">
                  How can I help you today?
                </h1>
                <p className="mt-2 max-w-md text-[14px] text-subtle">
                  Ask a question, create something, or attach a file to get started.
                </p>
                <div className="mt-8 grid w-full max-w-[620px] grid-cols-1 gap-2 sm:grid-cols-2">
                  {CAPABILITY_PROMPTS.map((item) => (
                    <Button key={item.label} variant="outline" onClick={() => setInput(item.prompt)} className="h-auto justify-start rounded-xl border-line px-4 py-3 text-left shadow-none">
                      <span><span className="block text-[13px] font-medium text-ink">{item.label}</span><span className="block text-[12px] font-normal text-subtle">Start with a guided prompt</span></span>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) =>
              message.role === "user" ? (
                <div key={message.id} className="mt-9 flex justify-end first:mt-0">
                  <div className="max-w-[78%] rounded-2xl bg-background px-4 py-3 text-[14px] leading-relaxed text-ink">
                      {message.parts
                        .filter((p) => p.type === "file")
                        .map((part, index) => (
                          <span
                            key={index}
                            className="mb-2 flex w-fit items-center gap-2 rounded-lg bg-panel px-2.5 py-1.5 text-[12px]"
                          >
                            <span className="grid size-4 place-items-center rounded bg-signal-soft text-[9px] font-semibold">
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
              ) : (
                <div key={message.id} className="mt-9 flex gap-4 first:mt-0">
                  <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-ink text-primary-foreground">
                    <Bot className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-center gap-2 text-[12px] font-medium text-ink">
                      Multiform
                    </div>
                    <Markdown>{textOf(message)}</Markdown>
                    {message.metadata?.modelLabel && <div className="mt-3 text-[11px] text-subtle">{message.metadata.modelLabel} · {message.metadata.reason}</div>}
                  </div>
                </div>
              ),
            )}

            {busy && (
              <div className="mt-8 flex items-center gap-3 text-[12px] text-subtle">
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
                <span>{status === "submitted" ? "Thinking…" : `${activeModelLabel} is responding…`}</span>
              </div>
            )}

            {error && (
              <p className="mt-4 rounded-lg bg-panel px-3 py-2.5 text-[12px] text-subtle ring-1 ring-black/5">
                {error.message}
              </p>
            )}
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-panel via-panel to-transparent px-4 pb-3 pt-8 md:px-8">
          <div className="pointer-events-auto mx-auto max-w-[760px]">
            <div className="composer-shell rounded-2xl border border-line bg-panel p-2">
              {files.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5 px-1">
                  {files.map((file, index) => (
                    <span
                      key={`${file.name}-${index}`}
                      className="flex items-center gap-1.5 rounded-lg bg-signal-soft px-2.5 py-1 text-[11px] text-ink"
                    >
                      {file.name}
                      <Button
                        variant="ghost" size="icon"
                        className="size-5"
                        onClick={() => setFiles(files.filter((_, i) => i !== index))}
                        aria-label={`Remove ${file.name}`}
                      >
                        <X className="size-3" />
                      </Button>
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
                  <Button
                    variant="ghost" size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-subtle"
                    aria-label="Attach a file"
                  >
                    <Paperclip />
                  </Button>
                </div>
                <textarea
                  rows={1}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void handleSend();
                    }
                  }}
                  placeholder="Message Multiform"
                  className="max-h-40 min-h-9 flex-1 resize-none bg-transparent py-2 text-[14px] outline-none placeholder:text-subtle"
                />
                <Button
                  onClick={() => void handleSend()}
                  disabled={busy || (!input.trim() && files.length === 0)}
                  size="icon"
                  className="rounded-xl bg-ink text-primary-foreground shadow-none hover:bg-ink/90"
                  aria-label="Send"
                >
                  <ArrowUp />
                </Button>
              </div>
            </div>
            <p className="mt-2 text-center text-[10px] text-subtle">Multiform can make mistakes. Check important information.</p>
          </div>
        </div>
      </main>
  );
}
