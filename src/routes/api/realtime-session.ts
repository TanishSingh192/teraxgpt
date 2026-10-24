import { createFileRoute } from "@tanstack/react-router";
import { requireUser } from "@/lib/api-auth.server";

const LIVE_MODEL = "models/gemini-3.8-live";
const LIVE_INSTRUCTIONS =
  "You are TeraXGPT, a helpful voice assistant. Speak naturally and concisely. Let the user interrupt you. " +
  "The user may turn on their camera; when you receive video frames, treat them as what the user is showing you right now " +
  "and describe or help with what you see. If no camera frames arrive, do not pretend to see anything. " +
  "Do not claim to perform actions outside this voice session.";

export const Route = createFileRoute("/api/realtime-session")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireUser(request);
        if ("response" in auth) return auth.response;

        const apiKey = process.env["GEMINI_API_KEY"];
        if (!apiKey) {
          return Response.json(
            { error: "Gemini Live is not configured. Set GEMINI_API_KEY on the server." },
            { status: 503 },
          );
        }

        try {
          const now = Date.now();
          const upstream = await fetch("https://generativelanguage.googleapis.com/v1beta/auth_tokens", {
            method: "POST",
            headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
            body: JSON.stringify({
              uses: 1,
              expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
              newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),
              bidiGenerateContentSetup: {
                model: LIVE_MODEL,
                generationConfig: { responseModalities: ["AUDIO"] },
                systemInstruction: { parts: [{ text: LIVE_INSTRUCTIONS }] },
                inputAudioTranscription: {},
                outputAudioTranscription: {},
              },
            }),
            signal: request.signal,
          });

          if (!upstream.ok) {
            console.error(`Gemini Live token creation failed [${upstream.status}]`, (await upstream.text()).slice(0, 300));
            return Response.json(
              { error: upstream.status === 429 ? "Gemini Live is busy. Try again shortly." : "Could not start Gemini Live. Check the server Gemini API configuration." },
              { status: upstream.status === 429 ? 429 : 502 },
            );
          }
          const data = (await upstream.json()) as { name?: unknown; expireTime?: unknown };
          if (typeof data.name !== "string" || !data.name) {
            return Response.json({ error: "Gemini returned an invalid Live session token." }, { status: 502 });
          }
          return Response.json(
            { clientToken: data.name, model: LIVE_MODEL, instructions: LIVE_INSTRUCTIONS, expiresAt: data.expireTime ?? null },
            { headers: { "Cache-Control": "no-store" } },
          );
        } catch (error) {
          if ((error as Error)?.name === "AbortError") return new Response(null, { status: 499 });
          console.error("Gemini Live token request failed.");
          return Response.json({ error: "Gemini Live is temporarily unavailable." }, { status: 502 });
        }
      },
    },
  },
});
