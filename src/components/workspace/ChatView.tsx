import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  Bot,
  AudioLines,
  BrainCircuit,
  ChevronDown,
  Code2,
  FileText,
  Printer,
  Download,
  Globe,
  EyeOff,
  ImagePlus,
  Loader2,
  Menu,
  MoreHorizontal,
  Mic,
  Paperclip,
  Plus,
  Sparkles,
  Puzzle,
  Search,
  RotateCcw,
  Square,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Markdown } from "@/components/workspace/Markdown";
import { CodeWorkspace, type WorkspaceFile } from "@/components/workspace/CodeWorkspace";
import { RealtimeVoicePanel } from "@/components/workspace/RealtimeVoicePanel";
import { CoworkerWorkspace } from "@/components/workspace/CoworkerWorkspace";
import { Button } from "@/components/ui/button";
import type { TurnInfo } from "@/components/workspace/ContextPanel";
import { supabase } from "@/integrations/supabase/client";
import { AUTO, MODELS, estimateCost, getModel } from "@/lib/models";
import { freshAccessToken } from "@/lib/session-token";
import { speak, startRecording, transcribeAudio } from "@/lib/voice";

export type ChatMetadata = {
  modelId?: string;
  modelLabel?: string;
  provider?: string;
  task?: string;
  reason?: string;
  agentName?: string;
  inputTokens?: number;
  outputTokens?: number;
};

type AgentOption = { id: string; name: string };

type PlanStep = { title: string; status: "pending" | "active" | "done" | "skipped" };

function GeneratedImage({ path, prompt }: { path: string; prompt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void supabase.storage
      .from("generated-images")
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (alive) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      alive = false;
    };
  }, [path]);
  if (!url) {
    return (
      <div className="mb-3 grid h-52 w-full max-w-[420px] place-items-center rounded-xl bg-background text-[12px] text-subtle">
        Preparing image…
      </div>
    );
  }
  return (
    <figure className="mb-3">
      <img src={url} alt={prompt} className="w-full max-w-[420px] rounded-xl" />
      <figcaption className="mt-1.5 text-[11px] text-subtle">{prompt}</figcaption>
    </figure>
  );
}

export type AppMessage = UIMessage<ChatMetadata>;

const CAPABILITY_PROMPTS = [
  { label: "Research", prompt: "Research " },
  { label: "Code", prompt: "Write code that " },
  { label: "Analyze file", prompt: "Analyze the attached file and " },
  { label: "Data analysis", prompt: "Analyze this data and " },
];

function downloadPromptMarkdown(text: string) {
  const blob = new Blob([text.endsWith("\\n") ? text : text + "\\n"], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "prompt.md";
  link.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function markdownToDocumentHtml(markdown: string) {
  const lines = markdown.replace(/\r/g, "").split("\n");
  const output: string[] = [];
  let list: "ul" | "ol" | null = null;
  const closeList = () => { if (list) output.push(`</${list}>`); list = null; };
  const inline = (value: string) => escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');
  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    const bullet = /^\s*[-*+]\s+(.+)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.+)$/.exec(line);
    if (heading) {
      closeList();
      const level = heading[1]!.length;
      output.push(`<h${level}>${inline(heading[2]!)}</h${level}>`);
    } else if (bullet || numbered) {
      const nextList = bullet ? "ul" : "ol";
      if (list !== nextList) { closeList(); list = nextList; output.push(`<${list}>`); }
      output.push(`<li>${inline((bullet ?? numbered)![1]!)}</li>`);
    } else if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      closeList(); output.push("<hr>");
    } else if (line.trim()) {
      closeList(); output.push(`<p>${inline(line)}</p>`);
    } else closeList();
  }
  closeList();
  return output.join("\n");
}

function documentHtml(title: string, markdown: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>body{font-family:Arial,Helvetica,sans-serif;color:#202124;line-height:1.6;max-width:800px;margin:40px auto;padding:0 28px}h1,h2,h3,h4{line-height:1.25;margin-top:1.5em}h1{font-size:28px}h2{font-size:22px}h3{font-size:18px}p{margin:.65em 0}li{margin:.25em 0}code{font-family:Consolas,monospace;background:#f3f4f6;padding:2px 4px}a{color:#1458a6}hr{border:0;border-top:1px solid #ddd;margin:1.5em 0}@media print{body{margin:0 auto;padding:0;max-width:none}}</style>
</head><body>${markdownToDocumentHtml(markdown)}</body></html>`;
}

function extractProjectFiles(source: string, fallbackCode: string, fallbackLanguage: string): WorkspaceFile[] {
  const blocks: WorkspaceFile[] = [];
  const fence = /```([^\n`]*)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = fence.exec(source)) !== null) {
    const info = (match[1] ?? "").trim();
    let content = (match[2] ?? "").replace(/\n$/, "");
    const language = (info.match(/^[\w+#.-]+/)?.[0] ?? fallbackLanguage ?? "text").toLowerCase();
    let name = info.match(/(?:file(?:name)?|path)\s*=\s*["\u0027]?([^\s"\u0027]+)/i)?.[1] ?? info.match(/(?:^|\s)([\w./-]+\.(?:tsx?|jsx?|html?|css|json|md|ya?ml|sh|py|rs|go|java|sql))\s*$/i)?.[1];
    if (!name) { const first = content.match(/^\s*(?:\/\/|#|<!--)\s*(?:file:\s*)?([\w./-]+\.(?:tsx?|jsx?|html?|css|json|md|ya?ml|sh|py|rs|go|java|sql))\s*(?:-->)?\s*\n/i); if (first) { name = first[1]; content = content.slice(first[0].length); } }
    if (!name) { const before = source.slice(Math.max(0, match.index - 180), match.index); name = before.match(/(?:^|\n)\s{0,3}#{1,4}\s+(?:file:\s*)?[`*]*([\w./-]+\.(?:tsx?|jsx?|html?|css|json|md|ya?ml|sh|py|rs|go|java|sql))[`*]*\s*\n?\s*$/i)?.[1]; }
    if (!name) { const ext = language === "javascript" ? "js" : language === "typescript" ? "ts" : language === "html" ? "html" : language === "css" ? "css" : language || "txt"; name = index === 0 ? (language === "html" ? "index.html" : language === "css" ? "styles.css" : language === "javascript" || language === "js" ? "app.js" : "main." + ext) : "file-" + (index + 1) + "." + ext; }
    if (blocks.some((file) => file.name === name)) name = name.replace(/(\.[^./]+)?$/, (_all, ext) => "-" + (index + 1) + (ext ?? ""));
    blocks.push({ name, language, content }); index++;
  }
  return blocks.length ? blocks : [{ name: fallbackLanguage === "html" ? "index.html" : fallbackLanguage === "css" ? "styles.css" : fallbackLanguage === "javascript" || fallbackLanguage === "js" ? "app.js" : "main." + (fallbackLanguage || "txt"), language: fallbackLanguage || "text", content: fallbackCode }];
}
function textOf(message: AppMessage) {
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("\n");
}

type ResearchStep = { kind: "search" | "read"; label: string; pending: boolean };

function researchSteps(message: AppMessage): ResearchStep[] {
  const steps: ResearchStep[] = [];
  for (const raw of message.parts) {
    const part = raw as { type: string; state?: string; input?: Record<string, unknown> };
    if (part.type !== "tool-web_search" && part.type !== "tool-open_source") continue;
    const pending = part.state !== "output-available" && part.state !== "output-error";
    if (part.type === "tool-web_search") {
      steps.push({ kind: "search", label: String(part.input?.["query"] ?? "…"), pending });
    } else {
      steps.push({ kind: "read", label: String(part.input?.["url"] ?? "…"), pending });
    }
  }
  return steps;
}

type ToolPart = {
  type: string;
  state?: string;
  toolCallId?: string;
  approval?: { id: string; approved?: boolean; reason?: string };
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
};

function toolParts(message: AppMessage): ToolPart[] {
  return (message.parts as ToolPart[]).filter((p) => p.type.startsWith("tool-"));
}

function generatedImages(message: AppMessage) {
  return toolParts(message)
    .filter((p) => p.type === "tool-generate_image" && p.state === "output-available")
    .map((p) => ({
      path: String(p.output?.["path"] ?? ""),
      prompt: String(p.output?.["prompt"] ?? "Generated image"),
    }))
    .filter((image) => image.path.length > 0);
}

function planOf(message: AppMessage): { goal: string; steps: PlanStep[] } | null {
  const plans = toolParts(message).filter((p) => p.type === "tool-update_plan" && p.input);
  const latest = plans[plans.length - 1];
  if (!latest) return null;
  const steps = (latest.input?.["steps"] ?? []) as PlanStep[];
  if (!Array.isArray(steps) || steps.length === 0) return null;
  return { goal: String(latest.input?.["goal"] ?? "Plan"), steps };
}

function pendingApprovals(message: AppMessage) {
  return toolParts(message)
    .filter((p) => p.state === "approval-requested" && p.approval?.id)
    .map((p) => ({
      id: p.approval!.id,
      tool: p.type.replace("tool-", ""),
      input: p.input ?? {},
    }));
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
  projectId = null,
  projectName,
}: {
  conversationId: string | null;
  initialMessages: AppMessage[];
  initialTitle: string;
  monthlyCost: number;
  onConversationCreated: (id: string, title: string) => void;
  onTitleChange: (id: string, title: string) => void;
  onUsage: (cost: number) => void;
  onOpenSidebar: () => void;
  projectId?: string | null;
  projectName?: string;
}) {
  const [modelId, setModelId] = useState<string>(AUTO);
  const [engine, setEngine] = useState<"standard" | "agno">("standard");
  const [input, setInput] = useState("");
  const [codeWorkspace, setCodeWorkspace] = useState<{ code: string; language: string; files: WorkspaceFile[]; messageId: string } | null>(null);
  const [documentStudioOpen, setDocumentStudioOpen] = useState(false);
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentType, setDocumentType] = useState("report");
  const [selectedDocumentMessages, setSelectedDocumentMessages] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const [toolbarMenuOpen, setToolbarMenuOpen] = useState(false);
  const toolbarMenuRef = useRef<HTMLDivElement>(null);
  const [turn, setTurn] = useState<TurnInfo | null>(null);
  const [research, setResearch] = useState(false);
  const [temporaryChat, setTemporaryChat] = useState(false);
  const temporaryChatRef = useRef(false);
  temporaryChatRef.current = temporaryChat;
  const [voiceReplies, setVoiceReplies] = useState(false);
  const [liveVoiceMode, setLiveVoiceMode] = useState(false);
  const [realtimeVoiceOpen, setRealtimeVoiceOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [agentId, setAgentId] = useState<string>("");
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [skillId, setSkillId] = useState<string>("");
  const [skills, setSkills] = useState<AgentOption[]>([]);


  const modelRef = useRef(modelId);
  modelRef.current = modelId;
  const engineRef = useRef(engine);
  engineRef.current = engine;
  const researchRef = useRef(research);
  researchRef.current = research;
  const projectRef = useRef(projectId);
  projectRef.current = projectId;
  const voiceRef = useRef(voiceReplies);
  voiceRef.current = voiceReplies;
  const agentRef = useRef(agentId);
  agentRef.current = agentId;
  const skillRef = useRef(skillId);
  skillRef.current = skillId;
  const conversationRef = useRef<string | null>(conversationId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const recorderRef = useRef<{ stop: () => Promise<File>; cancel: () => void } | null>(null);
  const speechRef = useRef<AbortController | null>(null);

  function interruptSpeech() {
    speechRef.current?.abort();
    speechRef.current = null;
    setSpeaking(false);
  }

  useEffect(() => {
    if (!addMenuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!addMenuRef.current?.contains(event.target as Node)) setAddMenuOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAddMenuOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [addMenuOpen]);

  useEffect(() => {
    if (!toolbarMenuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!toolbarMenuRef.current?.contains(event.target as Node)) setToolbarMenuOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setToolbarMenuOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [toolbarMenuOpen]);

  useEffect(() => {
    conversationRef.current = conversationId;
  }, [conversationId]);

  useEffect(() => () => speechRef.current?.abort(), []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const query = supabase.from("agents").select("id,name").order("created_at", { ascending: false });
      const { data } = projectId ? await query.eq("project_id", projectId) : await query;
      if (alive) setAgents((data ?? []) as AgentOption[]);
    })();
    return () => {
      alive = false;
    };
  }, [projectId]);

  useEffect(() => {
    let alive = true;
    void supabase
      .from("skills")
      .select("id,name")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (alive) setSkills((data ?? []) as AgentOption[]);
      });
    return () => {
      alive = false;
    };
  }, []);


  const transport = useMemo(
    () =>
      new DefaultChatTransport<AppMessage>({
        api: "/api/chat",
        prepareSendMessagesRequest: async ({ messages }) => {
          const token = await freshAccessToken();
          return {
            headers: { Authorization: `Bearer ${token}` },
            body: {
              messages,
              modelId: modelRef.current,
              engine: engineRef.current,
              research: researchRef.current,
              temporaryChat: temporaryChatRef.current,
              projectId: projectRef.current,
              agentId: agentRef.current || null,
              skillId: skillRef.current || null,
              conversationId: conversationRef.current,
            },
          };
        },
      }),
    [],
  );

  const {
    messages,
    sendMessage,
    status,
    error,
    stop,
    regenerate,
    addToolApprovalResponse,
  } = useChat<AppMessage>({
    transport,
    messages: initialMessages,
    onFinish: async ({ message }) => {
      const meta = message.metadata ?? {};
      const spokenText = textOf(message).slice(0, 4000);
      if (voiceRef.current && spokenText.trim()) {
        interruptSpeech();
        const controller = new AbortController();
        speechRef.current = controller;
        setSpeaking(true);
        void speak(spokenText, controller.signal)
          .catch((speechError: unknown) => {
            if (controller.signal.aborted) return;
            toast.error(
              speechError instanceof Error ? speechError.message : "Could not read that aloud.",
            );
          })
          .finally(() => {
            if (speechRef.current === controller) {
              speechRef.current = null;
              setSpeaking(false);
            }
          });
      }
      const isAgno = meta.provider === "agno";
      const model = getModel(meta.modelId ?? MODELS[0]!.id);
      // AgentOS usage is provider-managed; avoid estimating it with a different model's pricing.
      const cost = isAgno ? 0 : estimateCost(model, meta.inputTokens ?? 0, meta.outputTokens ?? 0);
      setTurn({ ...meta, cost });

      const convId = conversationRef.current;
      if (temporaryChatRef.current) {
        const { data: auth } = await supabase.auth.getUser();
        const userId = auth.user?.id;
        if (userId) {
          await supabase.from("usage_records").insert({
            user_id: userId,
            conversation_id: null,
            provider: isAgno ? "agno" : model.provider,
            model: isAgno ? "agno-agent" : model.id,
            input_tokens: meta.inputTokens ?? 0,
            output_tokens: meta.outputTokens ?? 0,
            estimated_cost: cost,
          });
          onUsage(cost);
        }
        return;
      }
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
        provider: isAgno ? "agno" : model.provider,
        model: isAgno ? "agno-agent" : model.id,
        input_tokens: meta.inputTokens ?? 0,
        output_tokens: meta.outputTokens ?? 0,
        estimated_cost: cost,
      });
      onUsage(cost);
    },
    onError: (err) => toast.error(err.message || "The model could not answer. Try again."),
  });

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !shouldAutoScrollRef.current) return;
    // Avoid repeated smooth-scroll animations while a response streams.
    container.scrollTop = container.scrollHeight;
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

  async function toggleRecording() {
    interruptSpeech();
    if (recording) {
      const recorder = recorderRef.current;
      recorderRef.current = null;
      setRecording(false);
      if (!recorder) return;
      setTranscribing(true);
      try {
        const audio = await recorder.stop();
        const transcript = await transcribeAudio(audio);
        if (liveVoiceMode) {
          await handleSend(transcript);
        } else {
          setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      } catch (recordError) {
        toast.error(
          recordError instanceof Error ? recordError.message : "Could not use that recording.",
        );
      } finally {
        setTranscribing(false);
      }
      return;
    }
    try {
      recorderRef.current = await startRecording();
      setRecording(true);
    } catch {
      toast.error("Microphone access was blocked. Allow it in your browser to speak.");
    }
  }

  async function handleSend(overrideText?: string) {
    const text = (overrideText ?? input).trim();
    if ((!text && files.length === 0) || busy) return;
    // Attach long pasted prompts as Markdown to preserve their structure.
    const longPrompt = engineRef.current !== "agno" && text.length >= 1400;
    const promptFile = longPrompt ? new File([text + (text.endsWith(String.fromCharCode(10)) ? "" : String.fromCharCode(10))], "prompt.md", { type: "text/markdown" }) : null;
    const outgoingFiles = promptFile ? [...files, promptFile] : files;
    const outgoingText = promptFile ? "Use the attached prompt.md as the complete task specification. Preserve its headings, constraints, and acceptance criteria." : text;
    if (engineRef.current === "agno" && temporaryChatRef.current) {
      toast.error("Agno AgentOS mode requires a saved conversation. Turn off Temporary Chat or switch to TeraXGPT.");
      return;
    }
    if (engineRef.current === "agno" && outgoingFiles.length > 0) {
      toast.error("Agno AgentOS mode currently supports text-only prompts. Switch to TeraXGPT to use attachments.");
      return;
    }
    interruptSpeech();

    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return;

    if (temporaryChat) {
      conversationRef.current = null;
      const dataTransfer = new DataTransfer();
      outgoingFiles.forEach((file) => dataTransfer.items.add(file));
      void sendMessage(outgoingFiles.length ? { text: outgoingText, files: dataTransfer.files } : { text: outgoingText });
      setInput("");
      setFiles([]);
      return;
    }

    let convId = conversationRef.current;
    const title = text.slice(0, 60) || "File analysis";
    if (!convId) {
      const { data, error: createError } = await supabase
        .from("conversations")
        .insert({ user_id: userId, title, model_preference: modelId, project_id: projectId })
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
        ...outgoingFiles.map((f) => ({ type: "file", name: f.name, mediaType: f.type })),
      ],
    });

    const dataTransfer = new DataTransfer();
    outgoingFiles.forEach((file) => dataTransfer.items.add(file));
    void sendMessage(outgoingFiles.length ? { text: outgoingText, files: dataTransfer.files } : { text: outgoingText });
    setInput("");
    setFiles([]);
    if (promptFile) toast.info("Long prompt attached as prompt.md");
  }

  const activeModelLabel = modelId === AUTO ? "Auto" : getModel(modelId).label;

  const assistantMessages = messages.filter((message) => message.role === "assistant" && textOf(message).trim());
  const documentBody = assistantMessages.filter((message) => selectedDocumentMessages.includes(message.id)).map((message) => textOf(message).trim()).join("\n\n---\n\n");
  const documentHeading = documentTitle.trim() || "TeraXGPT document";

  function openDocumentStudio() {
    setDocumentTitle(initialTitle.trim() || "");
    setDocumentType("report");
    setSelectedDocumentMessages(assistantMessages.map((message) => message.id));
    setDocumentStudioOpen(true);
  }

  function studioMarkdown() {
    const labels: Record<string, string> = { report: "Report", proposal: "Proposal", letter: "Letter", summary: "Summary", notes: "Study notes", custom: "Document" };
    return `# ${documentHeading}\n\n**Document type:** ${labels[documentType] ?? "Document"}\n\n${documentBody}`;
  }

  function downloadStudioDocument() {
    if (!documentBody.trim()) { toast.error("Select at least one assistant response to include."); return; }
    const blob = new Blob(["\\ufeff", documentHtml(documentHeading, studioMarkdown())], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeName = documentHeading.replace(/[^a-z0-9-_ ]/gi, "").trim().replace(/\\s+/g, "-").slice(0, 80);
    link.href = url; link.download = `${safeName || "teraxgpt-document"}.doc`;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    toast.success("Word-compatible document downloaded.");
  }

  function printStudioDocument() {
    if (!documentBody.trim()) { toast.error("Select at least one assistant response to include."); return; }
    const printWindow = window.open("", "_blank");
    if (!printWindow) { toast.error("Allow pop-ups to create a PDF, then try again."); return; }
    printWindow.document.open(); printWindow.document.write(documentHtml(documentHeading, studioMarkdown())); printWindow.document.close();
    printWindow.document.title = documentHeading; printWindow.focus(); printWindow.setTimeout(() => printWindow.print(), 250);
  }

  function exportConversation() {
    const title = initialTitle.trim() || "TeraXGPT conversation";
    const sections = messages.map((message) => {
      const role = message.role === "user" ? "You" : "TeraXGPT";
      const text = textOf(message).trim();
      const attachments = message.parts
        .filter((part) => part.type === "file")
        .map((part) => {
          const file = part as { filename?: string; mediaType?: string };
          return `- Attachment: ${file.filename ?? "attachment"}${file.mediaType ? ` (${file.mediaType})` : ""}`;
        });
      const trail =
        message.role === "assistant"
          ? researchSteps(message).map((step) => `- ${step.kind === "search" ? "Search" : "Source"}: ${step.label}`)
          : [];
      return [
        `## ${role}`,
        text,
        attachments.length ? `**Attachments**\n${attachments.join("\n")}` : "",
        trail.length ? `**Research trail**\n${trail.join("\n")}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
    });
    const markdown = [
      `# ${title}`,
      `Exported: ${new Date().toLocaleString()}`,
      `Engine: ${engine === "agno" ? "Agno AgentOS" : "TeraXGPT"}`,
      "",
      ...sections,
    ].join("\n\n---\n\n");
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeName = title.replace(/[^a-z0-9-_ ]/gi, "").trim().replace(/\s+/g, "-").slice(0, 80);
    link.href = url;
    link.download = `${safeName || "teraxgpt-conversation"}.md`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
      <main className="relative flex min-w-0 flex-1 flex-col bg-panel">
        <header className="relative z-20 flex min-h-14 shrink-0 items-center gap-2 border-b border-line/60 px-2.5 sm:px-4 md:px-5">
          <Button variant="ghost" size="icon" onClick={onOpenSidebar} className="shrink-0 md:hidden" aria-label="Open sidebar"><Menu /></Button>
          <div className="flex min-w-0 items-center gap-1 sm:gap-2">
            <label className="relative flex min-w-0 items-center">
              <select
                value={engine}
                onChange={(event) => {
                  const next = event.target.value as "standard" | "agno";
                  setEngine(next);
                  if (next === "agno") setModelId(AUTO);
                }}
                disabled={messages.length > 0 || conversationRef.current !== null}
                aria-label="AI engine"
                className="max-w-[116px] appearance-none rounded-lg bg-transparent py-2 pl-2 pr-6 text-[12px] font-medium outline-none hover:bg-background disabled:opacity-60 sm:max-w-none sm:pr-7"
              >
                <option value="standard">TeraXGPT</option>
                <option value="agno">Agno AgentOS</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-1.5 size-3.5 text-subtle sm:right-2" />
            </label>
            <label className="relative hidden items-center sm:flex">
              <select value={modelId} disabled={engine === "agno"} onChange={(event) => setModelId(event.target.value)} aria-label="AI model" className="max-w-[130px] appearance-none rounded-lg bg-transparent py-2 pl-2 pr-6 font-display text-[13px] font-semibold outline-none hover:bg-background disabled:opacity-50 sm:max-w-none sm:pr-7 sm:text-[15px]">
                <option value={AUTO}>Auto</option>
                {MODELS.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-1.5 size-3.5 text-subtle sm:right-2" />
            </label>
          </div>
          {temporaryChat && <span className="hidden rounded-lg bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-700 sm:inline-flex">Temporary · not saved</span>}
          {projectName && !temporaryChat && <span className="hidden max-w-36 truncate rounded-lg bg-background px-2.5 py-1 text-[12px] text-subtle lg:inline-flex">{projectName}</span>}
          {agents.length > 0 && !temporaryChat && (
            <label className="relative hidden items-center lg:flex">
              <select value={agentId} disabled={temporaryChat} onChange={(event) => setAgentId(event.target.value)} aria-label="Agent" className={`max-w-36 appearance-none rounded-lg py-1.5 pl-2.5 pr-7 text-[12px] outline-none hover:bg-background ${agentId ? "bg-signal-soft text-ink" : "bg-transparent text-subtle"}`}>
                <option value="">No agent</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 size-3.5 text-subtle" />
            </label>
          )}
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <Button variant="secondary" size="sm" onClick={openDocumentStudio} disabled={assistantMessages.length === 0 || busy} aria-label="Open Document Studio" className="hidden md:inline-flex"><FileText /><span className="hidden lg:inline">Document Studio</span></Button>
            <Button variant="ghost" size="sm" onClick={exportConversation} disabled={messages.length === 0 || busy} aria-label="Export conversation as Markdown" title="Export conversation as Markdown" className="hidden sm:inline-flex"><Download /><span className="hidden lg:inline">Export</span></Button>
            <div className="relative" ref={toolbarMenuRef}>
              <Button variant={toolbarMenuOpen ? "secondary" : "ghost"} size="icon" onClick={() => setToolbarMenuOpen((open) => !open)} aria-label="More workspace actions" aria-expanded={toolbarMenuOpen} aria-haspopup="menu" title="Workspace actions">
                <MoreHorizontal />
              </Button>
              {toolbarMenuOpen && (
                <div role="menu" aria-label="Workspace actions" className="absolute right-0 top-11 z-50 max-h-[min(75vh,520px)] w-[min(88vw,280px)] overflow-y-auto rounded-xl border border-line bg-panel p-1.5 shadow-xl">
                  <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-subtle">Workspace</div>
                  <label className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-[13px] sm:hidden"><span>Model</span><select value={modelId} disabled={engine === "agno"} onChange={(event) => { setModelId(event.target.value); setToolbarMenuOpen(false); }} aria-label="AI model" className="max-w-36 rounded-md border border-line bg-background px-2 py-1.5 text-[12px] outline-none disabled:opacity-50"><option value={AUTO}>Auto</option>{MODELS.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}</select></label>
                  <button role="menuitem" type="button" onClick={() => { setToolbarMenuOpen(false); void openDocumentStudio(); }} disabled={assistantMessages.length === 0 || busy} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] hover:bg-background disabled:opacity-40 md:hidden"><FileText className="size-4 text-subtle" />Document Studio</button>
                  <button role="menuitem" type="button" onClick={() => { setToolbarMenuOpen(false); exportConversation(); }} disabled={messages.length === 0 || busy} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] hover:bg-background disabled:opacity-40 sm:hidden"><Download className="size-4 text-subtle" />Export conversation</button>
                  <button role="menuitem" type="button" onClick={() => {
                    setToolbarMenuOpen(false);
                    if (messages.length > 0 || conversationRef.current !== null) { toast.error("Start a new chat before changing Temporary Chat mode."); return; }
                    setTemporaryChat((current) => !current); setAgentId(""); setSkillId(""); if (!temporaryChat) setResearch(false);
                  }} className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-[13px] hover:bg-background"><span>Temporary chat</span><span className="text-[11px] text-subtle">{temporaryChat ? "On" : "Off"}</span></button>
                  <div className="my-1 border-t border-line" />
                  <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-subtle">Voice</div>
                  <button role="menuitemcheckbox" aria-checked={liveVoiceMode} type="button" onClick={() => { const next = !liveVoiceMode; setLiveVoiceMode(next); setVoiceReplies(next); if (!next) interruptSpeech(); setToolbarMenuOpen(false); }} className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-[13px] hover:bg-background"><span>Voice replies</span><span className="text-[11px] text-subtle">{liveVoiceMode ? "On" : "Off"}</span></button>
                  <button role="menuitem" type="button" onClick={() => { setToolbarMenuOpen(false); interruptSpeech(); setRealtimeVoiceOpen(true); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] hover:bg-background"><Mic className="size-4 text-subtle" />Start Gemini Live</button>
                  <button role="menuitemcheckbox" aria-checked={voiceReplies} type="button" onClick={() => { if (voiceReplies) interruptSpeech(); setVoiceReplies(!voiceReplies); setToolbarMenuOpen(false); }} className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-[13px] hover:bg-background"><span>Spoken answers</span><span className="text-[11px] text-subtle">{voiceReplies ? "On" : "Off"}</span></button>
                  {speaking && <button role="menuitem" type="button" onClick={() => { interruptSpeech(); setToolbarMenuOpen(false); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] hover:bg-background"><Square className="size-4 text-subtle" />Interrupt speech</button>}
                  <div className="my-1 border-t border-line" />
                  {busy ? <button role="menuitem" type="button" onClick={() => { stop(); setToolbarMenuOpen(false); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] hover:bg-background"><Square className="size-4 text-subtle" />Stop response</button> : messages.length > 0 && <button role="menuitem" type="button" onClick={() => { setToolbarMenuOpen(false); void regenerate(); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] hover:bg-background"><RotateCcw className="size-4 text-subtle" />Regenerate response</button>}
                </div>
              )}
            </div>
          </div>
        </header>

        <div ref={scrollRef} onScroll={(event) => { const el = event.currentTarget; shouldAutoScrollRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120; }} className="flex-1 overflow-y-auto px-4 pb-44 pt-8 md:px-8">
          <div className={messages.length === 0 ? "mx-auto w-full max-w-[1160px]" : "mx-auto max-w-[760px]"}>
            {messages.length === 0 && (
              <section className="terax-launch relative isolate flex min-h-[min(700px,76vh)] flex-col justify-center overflow-hidden rounded-[28px] px-4 py-8 sm:px-8 sm:py-10 lg:px-12">
                <div className="terax-launch-grid pointer-events-none absolute inset-0 -z-20" />
                <div className="terax-launch-glow pointer-events-none absolute -right-20 -top-24 -z-10 size-80 rounded-full blur-3xl sm:size-[26rem]" />
                <div className="pointer-events-none absolute -left-20 bottom-0 -z-10 size-64 rounded-full bg-violet-500/[0.08] blur-3xl" />
                <div className="mb-9 flex items-center gap-2 self-start rounded-full border border-line/70 bg-panel/70 px-3 py-1.5 backdrop-blur-xl">
                  <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-50" /><span className="relative inline-flex size-2 rounded-full bg-emerald-400" /></span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-subtle">TeraX Intelligence System</span>
                  <span className="mx-1 h-3 w-px bg-line" />
                  <span className="text-[10px] text-subtle">{engine === "agno" ? "AgentOS" : activeModelLabel}</span>
                </div>
                <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_240px] lg:gap-5">
                  <div className="min-w-0">
                    <div className="terax-signal mb-5 grid size-[68px] place-items-center rounded-[22px] border border-white/10 text-white shadow-[0_12px_60px_rgba(72,91,255,0.2)] sm:size-[82px]">
                      <div className="terax-signal-core grid size-12 place-items-center rounded-2xl border border-white/20 bg-white/10 sm:size-14"><BrainCircuit className="size-7 sm:size-8" /></div>
                    </div>
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-subtle">One interface. Many kinds of intelligence.</p>
                    <h1 className="max-w-2xl font-display text-[clamp(2.5rem,7vw,5.5rem)] font-semibold leading-[0.92] tracking-[-0.065em] text-ink">
                      Think beyond
                      <span className="terax-gradient-text block pb-2">the chat box.</span>
                    </h1>
                    <p className="mt-5 max-w-lg text-[14px] leading-7 text-subtle sm:text-[15px]">
                      Research the unknown. Build the impossible. Turn rough ideas into something real — with the right intelligence for the job.
                    </p>
                    <div className="mt-7 flex flex-wrap items-center gap-3">
                      <button type="button" onClick={() => { setInput("Help me explore an ambitious idea: "); document.getElementById("terax-composer")?.scrollIntoView({ behavior: "smooth", block: "center" }); }} className="group inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-[13px] font-medium text-primary-foreground transition-transform hover:-translate-y-0.5">
                        Start exploring <ArrowUp className="size-4 rotate-45 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </button>
                      <button type="button" onClick={() => { interruptSpeech(); setRealtimeVoiceOpen(true); }} className="inline-flex items-center gap-2 rounded-full border border-line bg-panel/65 px-4 py-3 text-[13px] font-medium text-ink backdrop-blur transition-colors hover:bg-background">
                        <AudioLines className="size-4 text-violet-500" /> Enter Gemini Live
                      </button>
                    </div>
                  </div>
                  <div className="relative mx-auto hidden w-full max-w-[220px] items-center justify-center lg:flex">
                    <div className="terax-orbit terax-orbit-one absolute size-52 rounded-full border border-blue-500/20" />
                    <div className="terax-orbit terax-orbit-two absolute size-44 rounded-full border border-violet-500/20" />
                    <div className="terax-orbit terax-orbit-three absolute size-36 rounded-full border border-cyan-500/20" />
                    <div className="terax-launch-core relative grid size-28 place-items-center rounded-[34px] border border-white/20 shadow-[0_0_80px_rgba(80,95,255,0.24)]"><BrainCircuit className="size-12 text-white" /></div>
                    <span className="absolute right-0 top-7 rounded-full border border-line/70 bg-panel/80 px-2.5 py-1 text-[10px] text-subtle backdrop-blur">Reason</span>
                    <span className="absolute -left-1 top-20 rounded-full border border-line/70 bg-panel/80 px-2.5 py-1 text-[10px] text-subtle backdrop-blur">Create</span>
                    <span className="absolute bottom-7 right-1 rounded-full border border-line/70 bg-panel/80 px-2.5 py-1 text-[10px] text-subtle backdrop-blur">Discover</span>
                  </div>
                </div>
                <div className="mt-11 border-t border-line/70 pt-5 sm:mt-14">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-subtle">Choose your direction</p><p className="mt-1 text-[12px] text-subtle/80">A few ways to get momentum.</p></div>
                    <span className="hidden text-[10px] uppercase tracking-[0.16em] text-subtle sm:inline">01 — 04</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    <button type="button" onClick={() => setInput("Research this topic deeply, compare credible sources, and give me a concise evidence-based brief: ")} className="terax-capability group text-left">
                      <span className="terax-capability-icon bg-blue-500/10 text-blue-500"><Search className="size-5" /></span>
                      <span className="mt-4 block text-[13px] font-semibold text-ink">Investigate</span>
                      <span className="mt-1 block text-[11px] leading-5 text-subtle">Go deeper than a quick answer.</span>
                      <span className="terax-capability-arrow mt-3 inline-flex text-[11px] font-medium">Start research <ArrowUp className="ml-1 size-3.5 rotate-45" /></span>
                    </button>
                    <button type="button" onClick={() => setInput("Help me design and implement this software idea. Start with architecture, then produce a working first version: ")} className="terax-capability group text-left">
                      <span className="terax-capability-icon bg-violet-500/10 text-violet-500"><Code2 className="size-5" /></span>
                      <span className="mt-4 block text-[13px] font-semibold text-ink">Build something</span>
                      <span className="mt-1 block text-[11px] leading-5 text-subtle">Turn a concept into a system.</span>
                      <span className="terax-capability-arrow mt-3 inline-flex text-[11px] font-medium">Enter build mode <ArrowUp className="ml-1 size-3.5 rotate-45" /></span>
                    </button>
                    <button type="button" onClick={() => { setInput("Generate an image of "); document.getElementById("terax-composer")?.scrollIntoView({ behavior: "smooth", block: "center" }); }} className="terax-capability group text-left">
                      <span className="terax-capability-icon bg-pink-500/10 text-pink-500"><ImagePlus className="size-5" /></span>
                      <span className="mt-4 block text-[13px] font-semibold text-ink">Create visuals</span>
                      <span className="mt-1 block text-[11px] leading-5 text-subtle">Make an idea visible.</span>
                      <span className="terax-capability-arrow mt-3 inline-flex text-[11px] font-medium">Create an image <ArrowUp className="ml-1 size-3.5 rotate-45" /></span>
                    </button>
                    <button type="button" onClick={() => { setInput("Explain this step by step, using an intuitive example first: "); document.getElementById("terax-composer")?.scrollIntoView({ behavior: "smooth", block: "center" }); }} className="terax-capability group text-left">
                      <span className="terax-capability-icon bg-emerald-500/10 text-emerald-500"><Bot className="size-5" /></span>
                      <span className="mt-4 block text-[13px] font-semibold text-ink">Understand anything</span>
                      <span className="mt-1 block text-[11px] leading-5 text-subtle">Make complex ideas click.</span>
                      <span className="terax-capability-arrow mt-3 inline-flex text-[11px] font-medium">Start learning <ArrowUp className="ml-1 size-3.5 rotate-45" /></span>
                    </button>
                  </div>
                </div>
                <style>{`
                  .terax-launch-grid { background-image: linear-gradient(to right, hsl(var(--line) / .42) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--line) / .42) 1px, transparent 1px); background-size: 42px 42px; mask-image: linear-gradient(to bottom, black, transparent 85%); opacity: .26; }
                  .terax-launch-glow { background: radial-gradient(circle, rgba(90,103,255,.2), rgba(112,72,255,.08) 42%, transparent 72%); animation: terax-glow-drift 9s ease-in-out infinite alternate; }
                  .terax-signal { background: linear-gradient(135deg, #141827, #4d42b8 52%, #188fbc); }
                  .terax-signal-core { box-shadow: inset 0 0 24px rgba(255,255,255,.1), 0 0 34px rgba(125,104,255,.25); }
                  .terax-gradient-text { background: linear-gradient(100deg, #7c78ff 0%, #b47dff 36%, #49bde7 76%, #5c91ff 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
                  .terax-launch-core { background: radial-gradient(circle at 35% 20%, #8c8aff, #4e4ab7 42%, #111827 78%); animation: terax-core-float 5s ease-in-out infinite; }
                  .terax-orbit { animation: terax-orbit-spin 22s linear infinite; }
                  .terax-orbit-two { animation-duration: 17s; animation-direction: reverse; }
                  .terax-orbit-three { animation-duration: 12s; border-style: dashed; }
                  .terax-capability { position: relative; min-height: 166px; padding: 16px; border: 1px solid hsl(var(--line) / .8); border-radius: 18px; background: hsl(var(--panel) / .72); transition: transform .22s ease, border-color .22s ease, background .22s ease; backdrop-filter: blur(12px); }
                  .terax-capability:hover { transform: translateY(-4px); border-color: rgba(112,106,255,.55); background: hsl(var(--panel) / .95); }
                  .terax-capability-icon { display: grid; width: 38px; height: 38px; place-items: center; border-radius: 12px; }
                  .terax-capability-arrow { color: hsl(var(--muted-foreground)); transition: color .2s ease, transform .2s ease; }
                  .terax-capability:hover .terax-capability-arrow { color: hsl(var(--foreground)); transform: translateX(2px); }
                  @keyframes terax-glow-drift { from { transform: translate3d(0,0,0) scale(.94); } to { transform: translate3d(-24px,20px,0) scale(1.08); } }
                  @keyframes terax-core-float { 0%,100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(-8px) rotate(2deg); } }
                  @keyframes terax-orbit-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                  @media (prefers-reduced-motion: reduce) { .terax-launch-glow, .terax-launch-core, .terax-orbit { animation: none; } .terax-capability { transition: none; } }
                `}</style>
              </section>
            )}

            <style>{`
              .terax-response { animation: terax-response-in .32s cubic-bezier(.2,.75,.25,1) both; }
              .terax-thinking-dots i { display:block; width:5px; height:5px; border-radius:999px; background:currentColor; opacity:.35; animation:terax-dot-pulse 1.1s ease-in-out infinite; }
              .terax-thinking-dots i:nth-child(2) { animation-delay:.15s; }
              .terax-thinking-dots i:nth-child(3) { animation-delay:.3s; }
              @keyframes terax-response-in { from { opacity:0; transform:translateY(7px); } to { opacity:1; transform:translateY(0); } }
              @keyframes terax-dot-pulse { 0%,60%,100% { opacity:.25; transform:translateY(0); } 30% { opacity:.95; transform:translateY(-3px); } }
              @media (prefers-reduced-motion: reduce) { .terax-response { animation:none; } .terax-thinking-dots i { animation:none; opacity:.65; } }
            `}</style>
            {messages.map((message) =>
              message.role === "user" ? (
                <div key={message.id} className="mt-8 flex justify-end first:mt-0 sm:mt-10">
                  <div className="max-w-[92%] rounded-[22px] border border-line/70 bg-background/90 px-4 py-3.5 text-[14px] leading-relaxed text-ink shadow-[0_8px_28px_rgba(0,0,0,0.035)] sm:max-w-[82%] sm:px-5">
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
                <article key={message.id} className="terax-response mt-8 flex gap-3.5 first:mt-0 sm:mt-10 sm:gap-4">
                  <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-xl border border-indigo-400/20 bg-gradient-to-br from-indigo-500/15 via-violet-500/10 to-cyan-400/10 text-indigo-500 shadow-[0_0_24px_rgba(99,102,241,0.08)]">
                    <BrainCircuit className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1 rounded-2xl border border-line/50 bg-panel/35 px-3.5 py-4 sm:px-5 sm:py-5">
                    <div className="mb-3 flex flex-wrap items-center gap-2 text-[12px] font-semibold tracking-wide text-ink">
                      <span>TeraXGPT</span>
                      <span className="rounded-full border border-line/70 bg-background/70 px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.16em] text-subtle">Intelligence output</span>
                    </div>
                    {researchSteps(message).length > 0 && (
                      <div className="mb-3 space-y-1 rounded-xl bg-background px-3 py-2.5">
                        <div className="text-[11px] font-medium text-subtle">Research trail</div>
                        {researchSteps(message).map((step, index) => (
                          <div key={index} className="flex items-center gap-2 text-[12px] text-ink">
                            <Globe className="size-3.5 shrink-0 text-subtle" />
                            <span className="truncate">
                              {step.kind === "search" ? `Searched: ${step.label}` : `Read: ${step.label}`}
                            </span>
                            {step.pending && <span className="text-[11px] text-subtle">…</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    {(() => {
                      const plan = planOf(message);
                      if (!plan) return null;
                      return (
                        <div className="mb-3 rounded-xl bg-background px-3 py-2.5">
                          <div className="mb-1.5 text-[11px] font-medium text-subtle">
                            Plan · {plan.goal}
                          </div>
                          <ol className="space-y-1">
                            {plan.steps.map((step, index) => (
                              <li key={index} className="flex items-start gap-2 text-[12px] text-ink">
                                <span
                                  className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
                                    step.status === "done"
                                      ? "bg-signal"
                                      : step.status === "active"
                                        ? "bg-ink"
                                        : "bg-line"
                                  }`}
                                />
                                <span className={step.status === "skipped" ? "text-subtle line-through" : ""}>
                                  {step.title}
                                </span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      );
                    })()}
                    {generatedImages(message).map((image) => (
                      <GeneratedImage key={image.path} path={image.path} prompt={image.prompt} />
                    ))}
                    {pendingApprovals(message).map((approval) => (
                      <div
                        key={approval.id}
                        className="mb-3 rounded-xl border border-line bg-background px-3 py-2.5"
                      >
                        <div className="text-[12px] text-ink">
                          Allow <strong>{approval.tool.replace(/_/g, " ")}</strong> to run?
                        </div>
                        <pre className="mt-1.5 max-h-28 overflow-auto whitespace-pre-wrap rounded-lg bg-panel px-2 py-1.5 text-[11px] text-subtle">
                          {JSON.stringify(approval.input, null, 2)}
                        </pre>
                        <div className="mt-2 flex gap-2">
                          <Button
                            size="sm"
                            className="rounded-lg bg-ink text-primary-foreground shadow-none hover:bg-ink/90"
                            onClick={() =>
                              void addToolApprovalResponse({ id: approval.id, approved: true })
                            }
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-lg border-line shadow-none"
                            onClick={() =>
                              void addToolApprovalResponse({ id: approval.id, approved: false })
                            }
                          >
                            Deny
                          </Button>
                        </div>
                      </div>
                    ))}
                    {textOf(message).trim() ? (
                      <Markdown onOpenInIDE={(code, language) => setCodeWorkspace({ code, language, files: extractProjectFiles(textOf(message), code, language), messageId: message.id })}>{textOf(message)}</Markdown>
                    ) : busy && message.id === messages[messages.length - 1]?.id ? (
                      <div className="flex items-center gap-2 py-2 text-sm text-subtle" role="status" aria-live="polite">
                        <span className="terax-thinking-dots flex items-center gap-1" aria-hidden="true"><i /><i /><i /></span>
                        <span>Thinking through your request</span>
                      </div>
                    ) : null}
                    {codeWorkspace?.messageId === message.id && message.role === "assistant" && (
                      <CodeWorkspace
                        initialCode={codeWorkspace.code}
                        language={codeWorkspace.language}
                        initialFiles={codeWorkspace.files}
                        onClose={() => setCodeWorkspace(null)}
                      />
                    )}
                    {textOf(message).trim() && (
                      <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-line/50 pt-3">
                        <Button variant="ghost" size="sm" onClick={() => {
                          const title = initialTitle.trim() || "TeraXGPT document";
                          const blob = new Blob(["\ufeff", documentHtml(title, textOf(message))], { type: "application/msword;charset=utf-8" });
                          const url = URL.createObjectURL(blob);
                          const link = document.createElement("a");
                          link.href = url;
                          link.download = `${title.replace(/[^a-z0-9-_ ]/gi, "").trim().replace(/\s+/g, "-").slice(0, 80) || "teraxgpt-document"}.doc`;
                          document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
                          toast.success("Document downloaded. Open it in Word or a compatible editor.");
                        }} aria-label="Download this response as a Word document">
                          <FileText /> Word document
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => {
                          const title = initialTitle.trim() || "TeraXGPT document";
                          const printWindow = window.open("", "_blank");
                          if (!printWindow) { toast.error("Allow pop-ups to create a PDF, then try again."); return; }
                          printWindow.document.open();
                          printWindow.document.write(documentHtml(title, textOf(message)));
                          printWindow.document.close();
                          printWindow.document.title = title;
                          printWindow.focus();
                          printWindow.setTimeout(() => printWindow.print(), 250);
                        }} aria-label="Print or save this response as PDF">
                          <Printer /> Save as PDF
                        </Button>
                      </div>
                    )}
                    {message.metadata?.modelLabel && (
                      <div className="mt-3 text-[11px] text-subtle">
                        {message.metadata.agentName ? `${message.metadata.agentName} · ` : ""}
                        {message.metadata.modelLabel} · {message.metadata.reason}
                      </div>
                    )}
                  </div>
                </article>
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

        <div id="terax-composer" className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-panel via-panel to-transparent px-4 pb-3 pt-8 md:px-8">
          <div className="pointer-events-auto mx-auto max-w-[760px]">
            <div className="composer-shell rounded-[24px] border border-line bg-panel/95 p-2.5 shadow-[0_16px_60px_rgba(0,0,0,0.08)] transition-[border-color,box-shadow] duration-200 focus-within:border-indigo-400/50 focus-within:shadow-[0_16px_60px_rgba(99,102,241,0.12)]">
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

              {input.length >= 1400 && (
                <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-signal/25 bg-signal-soft/60 px-3 py-2.5">
                  <span className="grid size-7 place-items-center rounded-lg bg-signal/15 text-signal"><FileText className="size-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-medium text-ink">Markdown file ready · prompt.md</p>
                    <p className="text-[11px] text-subtle">{input.length.toLocaleString()} characters will be attached automatically when you send.</p>
                  </div>
                  <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 text-[11px]" onClick={() => downloadPromptMarkdown(input)}><Download className="size-3.5" /> Download .md</Button>
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
                  <div className="relative" ref={addMenuRef}>
                    <Button
                      variant="ghost" size="icon"
                      onClick={() => setAddMenuOpen((open) => !open)}
                      className={`rounded-full text-subtle hover:bg-background ${addMenuOpen ? "bg-background text-ink" : ""}`}
                      aria-label="Open add menu"
                      aria-expanded={addMenuOpen}
                      title="Add files, image generation, or plugins"
                    >
                      <Plus className="size-5" />
                    </Button>
                    {addMenuOpen && (
                      <div className="absolute bottom-12 left-0 z-50 w-60 rounded-xl border border-line bg-panel p-1.5 shadow-xl">
                        <button type="button" onClick={() => { setAddMenuOpen(false); fileInputRef.current?.click(); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] hover:bg-background">
                          <Paperclip className="size-4 text-subtle" />
                          <span><span className="block font-medium text-ink">Upload files</span><span className="block text-[11px] text-subtle">Images, PDFs, and documents</span></span>
                        </button>
                        <button type="button" onClick={() => { setInput((current) => current.trim() ? current : "Generate an image of "); setAddMenuOpen(false); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] hover:bg-background">
                          <Sparkles className="size-4 text-subtle" />
                          <span><span className="block font-medium text-ink">Image generation</span><span className="block text-[11px] text-subtle">Describe the image you want</span></span>
                        </button>
                        <div className="my-1 border-t border-line" />
                        <div className="px-3 py-2">
                          <div className="mb-2 flex items-center gap-2 text-[12px] font-medium text-ink"><Puzzle className="size-4 text-subtle" /> Plugins & tools</div>
                          <button type="button" onClick={() => { setResearch((current) => !current); setAddMenuOpen(false); }} disabled={temporaryChat} className="flex w-full items-center justify-between rounded-lg px-1 py-2 text-left text-[12px] text-subtle hover:text-ink disabled:opacity-40">
                            <span>Deep research</span><span>{research ? "On" : "Off"}</span>
                          </button>
                          {skills.length > 0 ? (
                            <label className="mt-1 block text-[12px] text-subtle">
                              Select a skill
                              <select value={skillId} onChange={(event) => { setSkillId(event.target.value); setAddMenuOpen(false); }} aria-label="Plugin or skill" className="mt-1.5 w-full rounded-lg border border-line bg-background px-2.5 py-2 text-[12px] text-ink outline-none">
                                <option value="">No skill selected</option>
                                {skills.map((skill) => <option key={skill.id} value={skill.id}>{skill.name}</option>)}
                              </select>
                            </label>
                          ) : (
                            <p className="text-[11px] leading-relaxed text-subtle">No additional skills are configured. Available tools can still be used automatically by TeraXGPT.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => void toggleRecording()}
                    disabled={transcribing}
                    aria-pressed={recording}
                    aria-label={recording ? "Stop recording and send" : liveVoiceMode ? "Start speaking to TeraXGPT" : "Speak your message"}
                    title={liveVoiceMode ? (recording ? "Stop and send your voice message" : "Tap to speak, tap again to send") : undefined}
                    className={recording ? "text-signal" : liveVoiceMode ? "text-ink" : "text-subtle"}
                  >
                    {transcribing ? (
                      <Loader2 className="animate-spin" />
                    ) : recording ? (
                      <Square />
                    ) : (
                      <Mic />
                    )}
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
                  placeholder="Ask, build, investigate, create…"
                  aria-label="Message TeraXGPT"
                  className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-1 py-2.5 text-[14px] leading-relaxed outline-none placeholder:text-subtle"
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
            <p className="mt-2 text-center text-[10px] text-subtle">TeraX CPT can make mistakes. Check important information.</p>
          </div>
        </div>
        {documentStudioOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDocumentStudioOpen(false); }}>
            <section role="dialog" aria-modal="true" aria-labelledby="document-studio-title" className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-panel shadow-2xl">
              <header className="flex items-center gap-3 border-b border-border px-5 py-4">
                <div className="grid size-10 place-items-center rounded-xl bg-signal-soft text-ink"><FileText /></div>
                <div className="min-w-0 flex-1"><h2 id="document-studio-title" className="font-display text-lg font-semibold">Document Studio</h2><p className="text-xs text-subtle">Assemble selected answers into a formatted document.</p></div>
                <Button variant="ghost" size="icon" onClick={() => setDocumentStudioOpen(false)} aria-label="Close Document Studio"><X /></Button>
              </header>
              <div className="grid min-h-0 flex-1 gap-0 overflow-y-auto md:grid-cols-[minmax(240px,0.8fr)_minmax(0,1.2fr)]">
                <div className="space-y-4 border-b border-border p-5 md:border-b-0 md:border-r">
                  <label className="block space-y-1.5"><span className="text-sm font-medium">Document title</span><input value={documentTitle} onChange={(event) => setDocumentTitle(event.target.value)} placeholder="e.g. Market Research Report" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" /></label>
                  <label className="block space-y-1.5"><span className="text-sm font-medium">Document type</span><select value={documentType} onChange={(event) => setDocumentType(event.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"><option value="report">Report</option><option value="proposal">Proposal</option><option value="letter">Letter</option><option value="summary">Summary</option><option value="notes">Study notes</option><option value="custom">Other document</option></select></label>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium">Include responses</span><button type="button" className="text-xs text-subtle underline" onClick={() => setSelectedDocumentMessages(selectedDocumentMessages.length === assistantMessages.length ? [] : assistantMessages.map((message) => message.id))}>{selectedDocumentMessages.length === assistantMessages.length ? "Select none" : "Select all"}</button></div>
                    <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-border p-3">
                      {assistantMessages.map((message, index) => <label key={message.id} className="flex cursor-pointer items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={selectedDocumentMessages.includes(message.id)} onChange={(event) => setSelectedDocumentMessages((current) => event.target.checked ? [...current, message.id] : current.filter((id) => id !== message.id))} /><span className="min-w-0"><span className="block font-medium">Response {index + 1}</span><span className="block text-xs text-subtle">{textOf(message).replace(/\\s+/g, " ").slice(0, 110)}{textOf(message).length > 110 ? "…" : ""}</span></span></label>)}
                      {assistantMessages.length === 0 && <p className="text-sm text-subtle">No assistant responses to include yet.</p>}
                    </div>
                  </div>
                </div>
                <div className="min-h-64 overflow-y-auto bg-background/50 p-5"><div className="mx-auto min-h-full max-w-2xl rounded-lg border border-border bg-panel p-6 shadow-sm sm:p-8"><p className="mb-5 text-[10px] uppercase tracking-[0.18em] text-subtle">{documentType === "custom" ? "Document" : documentType}</p><h1 className="mb-5 font-display text-2xl font-bold">{documentHeading}</h1>{documentBody ? <Markdown>{documentBody}</Markdown> : <p className="text-sm text-subtle">Select one or more assistant responses to preview the document.</p>}</div></div>
              </div>
              <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4"><p className="text-xs text-subtle">Word export is compatible .doc; PDF uses your browser’s print dialog.</p><div className="flex flex-wrap gap-2"><Button variant="ghost" onClick={() => setDocumentStudioOpen(false)}>Cancel</Button><Button variant="outline" onClick={printStudioDocument} disabled={!documentBody.trim()}><Printer /> Save as PDF</Button><Button onClick={downloadStudioDocument} disabled={!documentBody.trim()}><Download /> Download Word file</Button></div></footer>
            </section>
          </div>
        )}
        <CoworkerWorkspace conversationId={conversationId} />
        {realtimeVoiceOpen && <RealtimeVoicePanel onClose={() => setRealtimeVoiceOpen(false)} />}
      </main>
  );
}
