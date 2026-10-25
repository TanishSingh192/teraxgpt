// Cost-conscious model registry. Text chat uses Google's Gemini API directly,
// so eligible requests use the Google AI Studio free tier rather than a paid gateway.
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
  /** USD per 1M tokens. Zero means eligible free-tier usage, subject to Google's quotas. */
  pricing: { input: number; output: number };
};

export const MODELS: ModelEntry[] = [
  {
    id: "gemini-2.5-flash",
    label: "Gemini Flash",
    provider: "google",
    endpoint: "chat",
    blurb: "fast everyday chat",
    capabilities: ["text", "vision", "tools", "files"],
    contextWindow: 1_000_000,
    pricing: { input: 0, output: 0 },
  },
  {
    id: "gemini-2.5-flash-lite",
    label: "Gemini Flash Lite",
    provider: "google",
    endpoint: "chat",
    blurb: "lightweight and quota-friendly",
    capabilities: ["text", "vision", "tools", "files"],
    contextWindow: 1_000_000,
    pricing: { input: 0, output: 0 },
  },
  {
    // Image generation remains a separate provider/capability and may incur cost.
    // It is filtered out of the text model picker and only used for image requests.
    id: "openai/gpt-image-2.5-sunburst",
    label: "Image generation",
    provider: "openai",
    endpoint: "image",
    blurb: "image creation (separate provider)",
    capabilities: ["image", "text"],
    contextWindow: 32_000,
    pricing: { input: 0.5, output: 4 },
  },
];

export const AUTO = "auto";
export const IMAGE_DRIVER_ID = "gemini-2.5-flash-lite";

export function getModel(id: string): ModelEntry {
  return MODELS.find((model) => model.id === id) ?? MODELS[0]!;
}

export type RoutingDecision = { model: ModelEntry; task: string; reason: string };
type RoutingInput = { text: string; hasImage: boolean; hasFile: boolean; charCount: number };

const CODE_HINTS = /\b(code|bug|debug|typescript|python|react|sql|function|api|stack trace|refactor|compile|error)\b/i;
const RESEARCH_HINTS = /\b(research|search|latest|news|compare sources|cite|who is|what happened)\b/i;
const REASONING_HINTS = /\b(analy[sz]e|strategy|plan|prove|derive|architecture|trade-?offs?|explain why|step by step)\b/i;
const IMAGE_HINTS = /\b(draw|illustrat\w*|generate an image|create an image|make an image|picture of|image of|poster|logo|artwork|render)\b/i;

export function routeRequest(input: RoutingInput): RoutingDecision {
  const { text, hasImage, hasFile, charCount } = input;
  if (!hasImage && !hasFile && IMAGE_HINTS.test(text)) {
    return { model: getModel("openai/gpt-image-2.5-sunburst"), task: "Image", reason: "image request — routed to image generation" };
  }
  if (hasImage) {
    return { model: getModel("gemini-2.5-flash"), task: "Vision", reason: "image attached — routed to Gemini Flash vision" };
  }
  if (charCount > 24_000 || hasFile) {
    return { model: getModel("gemini-2.5-flash"), task: "Files", reason: hasFile ? "document attached — routed to Gemini Flash" : "long input — routed to Gemini Flash" };
  }
  if (CODE_HINTS.test(text)) {
    return { model: getModel("gemini-2.5-flash"), task: "Coding", reason: "code request — routed to Gemini Flash" };
  }
  if (REASONING_HINTS.test(text)) {
    return { model: getModel("gemini-2.5-flash"), task: "Reasoning", reason: "analysis request — routed to Gemini Flash" };
  }
  if (RESEARCH_HINTS.test(text) || text.length < 160) {
    return { model: getModel("gemini-2.5-flash-lite"), task: "Quick answer", reason: "short or factual request — routed to Gemini Flash Lite" };
  }
  return { model: getModel("gemini-2.5-flash"), task: "General", reason: "general request — routed to Gemini Flash" };
}

export function estimateCost(model: ModelEntry, inputTokens: number, outputTokens: number) {
  return (inputTokens * model.pricing.input + outputTokens * model.pricing.output) / 1_000_000;
}
