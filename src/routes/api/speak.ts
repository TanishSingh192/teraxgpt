import { createFileRoute } from "@tanstack/react-router";

import { requireUser } from "@/lib/api-auth.server";

const MODEL = "google/gemini-3.1-flash-tts-preview";
const VOICE = "Kore";
const MAX_CHARS = 4000;

export const Route = createFileRoute("/api/speak")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireUser(request);
        if ("response" in auth) return auth.response;

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) {
          return Response.json({ error: "Voice is not configured." }, { status: 500 });
        }

        const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
        const text = typeof body?.text === "string" ? body.text.trim() : "";
        if (!text) {
          return Response.json({ error: "Nothing to read aloud." }, { status: 400 });
        }
        if (text.length > MAX_CHARS) {
          return Response.json({ error: "That text is too long to read aloud." }, { status: 400 });
        }

        try {
          const upstream = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              "X-Lovable-AIG-SDK": "fetch",
            },
            body: JSON.stringify({
              model: MODEL,
              contents: [{ role: "user", parts: [{ text: text.slice(0, 4000) }] }],
              generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } },
              },
              stream_format: "sse",
            }),
            signal: request.signal,
          });

          if (!upstream.ok) {
            // Do not expose provider error bodies to clients or logs.
            console.error(`Speech provider failed [${upstream.status}]`);
            return Response.json(
              { error: upstream.status === 429 ? "Speech service is busy. Please try again shortly." : "Speech generation failed." },
              { status: upstream.status === 429 ? 429 : 502 },
            );
          }

          return new Response(upstream.body, {
            status: 200,
            headers: {
              "content-type": upstream.headers.get("content-type") ?? "text/event-stream",
              "cache-control": "no-store",
            },
          });
        } catch (error) {
          if ((error as Error)?.name === "AbortError") {
            return new Response(null, { status: 499 });
          }
          throw error;
        }
      },
    },
  },
});
