import { createFileRoute } from "@tanstack/react-router";

const MODEL = "google/gemini-3.1-flash-tts-preview";
const VOICE = "Kore";

export const Route = createFileRoute("/api/speak")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) {
          return Response.json({ error: "Voice is not configured." }, { status: 500 });
        }

        const body = (await request.json()) as { text?: string };
        const text = (body.text ?? "").trim();
        if (!text) {
          return Response.json({ error: "Nothing to read aloud." }, { status: 400 });
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
            const detail = await upstream.text();
            console.error(`Speech failed [${upstream.status}]: ${detail}`);
            return new Response(detail, {
              status: upstream.status,
              headers: { "content-type": "application/json" },
            });
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
