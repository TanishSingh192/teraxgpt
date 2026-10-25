// Central model registry + routing engine.
// The app talks in capabilities; this layer decides which model serves them.

export type Capability = "text" | "vision" | "reasoning" | "tools" | "files" | "image";
export type Endpoint = "responses" | "chat" | "image";

export type ModelEntry = {
  id: string;
  label: string;
  provider: "google";
  endpoint: Endpoint;
  blurb: string;
  capabilities: Capability[];
  contextWindow: number;
  /** rough USD per 1M tokens, used for the estimated-cost readout */
  pricing: { input: number; output: number };
};

export const MODELS: ModelEntry[] = [
  {
    id: "gemini-3.8-flash",
    label: "Gemini Flash",
    provider: "google",
    endpoint: "chat",
    blurb: "general chat, coding, vision, and long context",
    capabilities: ["text", "vision", "reasoning", "tools", "files"],
    contextWindow: 1_000_000,
    pricing: { input: 0, output: 0 },
  },
  {
    id: "gemini-3.1-flash-lite",
    label: "Gemini Flash-Lite",
    provider: "google",
    endpoint: "chat",
    blurb: "fast everyday answers on the free tier",
    capabilities: ["text", "vision", "tools", "files"],
    contextWindow: 1_000_000,
    pricing: { input: 0, output: 0 },
  },
];

export const AUTO = "auto";

/** The image model is invoked as a tool, driven by this chat model. */
export const IMAGE_DRIVER_ID = "gemini-3.8-flash";

/** Hidden routing entry for image requests; image generation itself may be separately billed. */
const IMAGE_MODEL: ModelEntry = {
  id: "image-generation", label: "Image generation", provider: "google", endpoint: "image",
  blurb: "image creation", capabilities: ["image", "text"], contextWindow: 32_000,
  pricing: { input: 0, output: 0 },
};

export function getModel(id: string): ModelEntry {
  return MODELS.find((m) => m.id === id) ?? (MODELS[0] as ModelEntry);
}

export type RoutingDecision = {
  model: ModelEntry;
  task: string;
  reason: string;
};

type RoutingInput = {
  text: string;
  hasImage: boolean;
  hasFile: boolean;
  charCount: number;
};

const CODE_HINTS =
  /\b(code|bug|debug|typescript|python|react|sql|function|api|stack trace|refactor|compile|error)\b/i;
const RESEARCH_HINTS = /\b(research|search|latest|news|compare sources|cite|who is|what happened)\b/i;
const REASONING_HINTS =
  /\b(analy[sz]e|strategy|plan|prove|derive|architecture|trade-?offs?|explain why|step by step)\b/i;

const IMAGE_HINTS =
  /\b(draw|illustrat\w*|generate an image|create an image|make an image|picture of|image of|poster|logo|artwork|render)\b/i;

/** Deterministic, auditable routing. It never claims a model it does not use. */
export function routeRequest(input: RoutingInput): RoutingDecision {
  const { text, hasImage, hasFile, charCount } = input;

  if (!hasImage && !hasFile && IMAGE_HINTS.test(text)) {
    return {
      model: IMAGE_MODEL,
      task: "Image",
      reason: "image request — routed to the image model",
    };
  }
  if (hasImage) {
    return {
      model: getModel("gemini-3.8-flash"),
      task: "Vision",
      reason: "image attached — routed to a vision + reasoning model",
    };
  }
  if (charCount > 24_000 || hasFile) {
    return {
      model: getModel("gemini-3.8-flash"),
      task: "Large context",
      reason: hasFile ? "document attached — routed for long context" : "long input — routed for long context",
    };
  }
  if (CODE_HINTS.test(text)) {
    return {
      model: getModel("openai/gpt-6-astra"),
      task: "Coding",
      reason: "code-shaped request — routed to the strongest coding model",
    };
  }
  if (REASONING_HINTS.test(text)) {
    return {
      model: getModel("openai/gpt-6-astra"),
      task: "Reasoning",
      reason: "analysis request — routed to extended reasoning",
    };
  }
  if (RESEARCH_HINTS.test(text) || text.length < 160) {
    return {
      model: getModel("gemini-3.1-flash-lite"),
      task: "Quick answer",
      reason: "short or factual request — routed for low latency",
    };
  }
  return {
    model: getModel("gemini-3.1-flash-lite"),
    task: "General",
    reason: "general writing task — routed to the balanced model",
  };
}

export function estimateCost(model: ModelEntry, inputTokens: number, outputTokens: number) {
  return (inputTokens * model.pricing.input + outputTokens * model.pricing.output) / 1_000_000;
}
