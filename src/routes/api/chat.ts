import { createFileRoute } from "@tanstack/react-router";
import { createOpenAI } from "@ai-sdk/openai";
import { createClient } from "@supabase/supabase-js";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

import {
  createLovableAiGatewayProvider,
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
} from "@/lib/ai-gateway.server";
import { AUTO, getModel, routeRequest, type ModelEntry } from "@/lib/models";

const SYSTEM_PROMPT = `You are Multiform, a unified AI workspace assistant.
Be direct and useful. Use markdown: headings, bullet lists, tables and fenced code blocks with a language tag.
When you are uncertain, say so plainly instead of inventing facts, sources or numbers.
Never claim to have used a tool, browsed the web, or read a file that was not provided to you.`;

function describe(messages: UIMessage[]) {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const parts = lastUser?.parts ?? [];
  const text = parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("\n");
  const files = parts.filter((p) => p.type === "file") as Array<{ mediaType?: string }>;
  return {
    text,
    hasImage: files.some((f) => (f.mediaType ?? "").startsWith("image/")),
    hasFile: files.some((f) => !(f.mediaType ?? "").startsWith("image/")),
    charCount: JSON.stringify(messages).length,
  };
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) {
          return new Response(JSON.stringify({ error: "AI is not configured." }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }

        // Authenticate the caller with their app session.
        const authHeader = request.headers.get("authorization") ?? "";
        const supabaseUrl = process.env["VITE_SUPABASE_URL"] ?? process.env["SUPABASE_URL"];
        const anonKey =
          process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"];
        if (!authHeader || !supabaseUrl || !anonKey) {
          return new Response(JSON.stringify({ error: "Sign in to chat." }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }
        const supabase = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: authHeader } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData.user) {
          return new Response(JSON.stringify({ error: "Sign in to chat." }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }

        const body = (await request.json()) as { messages: UIMessage[]; modelId?: string };
        const messages = body.messages ?? [];
        const requested = body.modelId ?? AUTO;

        const signals = describe(messages);
        const decision =
          requested === AUTO
            ? routeRequest(signals)
            : {
                model: getModel(requested),
                task: "Manual",
                reason: "model chosen by you",
              };
        const model: ModelEntry = decision.model;

        const initialRunId = getLovableAiGatewayRunId(request);
        const modelMessages = await convertToModelMessages(messages);

        const result =
          model.endpoint === "responses"
            ? (() => {
                const runIdFetch = createLovableAiGatewayRunIdFetch(initialRunId);
                const lovable = createOpenAI({
                  baseURL: "https://ai.gateway.lovable.dev/v1",
                  apiKey,
                  headers: {
                    "Lovable-API-Key": apiKey,
                    "X-Lovable-AIG-SDK": "vercel-ai-sdk",
                  },
                  fetch: runIdFetch.fetch,
                });
                return streamText({
                  model: lovable.responses(model.id),
                  system: SYSTEM_PROMPT,
                  messages: modelMessages,
                  abortSignal: request.signal,
                  providerOptions: {
                    openai: {
                      forceReasoning: true,
                      reasoningEffort: "low",
                      reasoningSummary: "auto",
                      store: false,
                      include: ["reasoning.encrypted_content"],
                    },
                  },
                });
              })()
            : streamText({
                model: createLovableAiGatewayProvider(apiKey, initialRunId)(model.id),
                system: SYSTEM_PROMPT,
                messages: modelMessages,
                abortSignal: request.signal,
              });

        return result.toUIMessageStreamResponse({
          sendReasoning: true,
          messageMetadata: ({ part }) => {
            if (part.type === "start") {
              return {
                modelId: model.id,
                modelLabel: model.label,
                provider: model.provider,
                task: decision.task,
                reason: decision.reason,
              };
            }
            if (part.type === "finish") {
              return {
                inputTokens: part.totalUsage?.inputTokens ?? 0,
                outputTokens: part.totalUsage?.outputTokens ?? 0,
              };
            }
            return undefined;
          },
        });
      },
    },
  },
});
