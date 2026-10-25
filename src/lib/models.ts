// Free-tier-first model registry. All chat tasks route to Gemini Flash.
// Google may change free-tier quotas and eligibility; usage beyond the free quota can be billed by Google.
export type Capability = "text" | "vision" | "reasoning" | "tools" | "files" | "image";
export type Endpoint = "responses" | "chat" | "image";

export type ModelEntry = {
  id: string;
  label: string;
  provider: "openai" | "google";
  endpoint: Endpoint;
  blurb: string;
  capabilities: Capability[];
  contextWindow: number;
  /** Approximate USD per 1M tokens; Gemini free-tier requests may be $0 within quota. */
  pricing: { input: number; output: number };
};

export const FREE_MODEL_ID = "gemini-2.5-flash";
export const MODELS: ModelEntry[] = [
  {
    id: FREE_MODEL_ID,
    label: "Gemini Flash (Free tier)",
    provider: "google",
    endpoint: "chat",
    blurb: "fast general-purpose chat, coding, vision and long context",
    capabilities: ["text", "vision", "reasoning", "tools", "files"],
    contextWindow: 1_000_000,
    pricing: { input: 0, output: 0 },
  },
];

export const AUTO = "auto";
/** Image creation is a separate provider operation and is not included in Gemini's free text quota. */
export const IMAGE_DRIVER_ID = FREE_MODEL_ID;

export function getModel(id: string): ModelEntry {
  return MODELS.find((model) => model.id === id) ?? MODELS[0]!;
}

export type RoutingDecision = { model: ModelEntry; task: string; reason: string };
type RoutingInput = { text: string; hasImage: boolean; hasFile: boolean; charCount: number };

const IMAGE_HINTS = /\b(draw|illustrat\w*|generate an image|create an image|make an image|picture of|image of|poster|logo|artwork|render)\b/i;
const RESEARCH_HINTS = /\b(research|search|latest|news|compare sources|cite|who is|what happened)\b/i;
const CODE_HINTS = /\b(code|bug|debug|typescript|python|react|sql|function|api|stack trace|refactor|compile|error)\b/i;
const REASONING_HINTS = /\b(analy[sz]e|strategy|plan|prove|derive|architecture|trade-?offs?|explain why|step by step)\b/i;

export function routeRequest(input: RoutingInput): RoutingDecision {
  const { text, hasImage, hasFile, charCount } = input;
  if (!hasImage && !hasFile && IMAGE_HINTS.test(text)) {
    return { model: getModel(FREE_MODEL_ID), task: "Image request", reason: "Gemini Flash handles the prompt; image generation may use a separately configured image provider." };
  }
  if (hasImage) return { model: getModel(FREE_MODEL_ID), task: "Vision", reason: "routed to Gemini Flash vision" };
  if (hasFile || charCount > 24_000) return { model: getModel(FREE_MODEL_ID), task: "Long context", reason: "routed to Gemini Flash long context" };
  if (CODE_HINTS.test(text)) return { model: getModel(FREE_MODEL_ID), task: "Coding", reason: "routed to Gemini Flash" };
  if (REASONING_HINTS.test(text)) return { model: getModel(FREE_MODEL_ID), task: "Reasoning", reason: "routed to Gemini Flash" };
  if (RESEARCH_HINTS.test(text) || text.length < 160) return { model: getModel(FREE_MODEL_ID), task: "Quick answer", reason: "routed to Gemini Flash free tier" };
  return { model: getModel(FREE_MODEL_ID), task: "General", reason: "routed to Gemini Flash free tier" };
}

export function estimateCost(_model: ModelEntry, _inputTokens: number, _outputTokens: number) {
  // Display estimate is zero only because this registry is configured for the free tier.
  // Google-side quota overages are not reflected here.
  return 0;
}
