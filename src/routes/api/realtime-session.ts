import { createFileRoute } from "@tanstack/react-router";

import { requireUser } from "@/lib/api-auth.server";

export const Route = createFileRoute("/api/realtime-session")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireUser(request);
        if ("response" in auth) return auth.response;

        const apiKey = process.env["OPENAI_API_KEY"];
        if (!apiKey) {
          return Response.json(
            { error: "Realtime voice is not configured. Set OPENAI_API_KEY on the server." },
            { status: 503 },
          );
        }

        try {
          const upstream = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              session: {
                type: "realtime",
                model: "gpt-realtime",
                instructions:
                  "You are TeraXGPT, a helpful voice assistant. Speak naturally and concisely. Let the user interrupt you. Do not claim to perform actions outside this voice session.",
                audio: {
                  input: {
                    transcription: { model: "gpt-4o-mini-transcribe" },
                    turn_detection: { type: "semantic_vad", create_response: true, interrupt_response: true },
                  },
                  output: { voice: "marin" },
                },
              },
            }),
            signal: request.signal,
          });

          if (!upstream.ok) {
            console.error(`OpenAI realtime session creation failed [${upstream.status}]`);
            return Response.json(
              { error: upstream.status === 429
                  ? "Realtime voice is busy. Try again shortly."
                  : "Could not start realtime voice. Check the server OpenAI configuration." },
              { status: upstream.status === 429 ? 429 : 502 },
            );
          }

          const data = (await upstream.json()) as {
            value?: unknown;
            expires_at?: unknown;
          };
          if (typeof data.value !== "string" || !data.value) {
            return Response.json({ error: "Realtime provider returned an invalid session token." }, { status: 502 });
          }
          return Response.json(
            { clientSecret: data.value, expiresAt: data.expires_at ?? null },
            { headers: { "Cache-Control": "no-store" } },
          );
        } catch (error) {
          if ((error as Error)?.name === "AbortError") return new Response(null, { status: 499 });
          console.error("OpenAI realtime session request failed.");
          return Response.json({ error: "Realtime voice is temporarily unavailable." }, { status: 502 });
        }
      },
    },
  },
});
