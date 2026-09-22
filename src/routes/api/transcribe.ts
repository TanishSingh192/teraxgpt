import { createFileRoute } from "@tanstack/react-router";

import { requireUser } from "@/lib/api-auth.server";

const MAX_BYTES = 12 * 1024 * 1024;
const MODEL = "google/gemini-3.5-transcribe";

export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireUser(request);
        if ("response" in auth) return auth.response;

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) {
          return Response.json({ error: "Voice is not configured." }, { status: 500 });
        }

        const declared = Number(request.headers.get("content-length") ?? 0);
        if (declared > MAX_BYTES) {
          return Response.json({ error: "Recording is too long." }, { status: 413 });
        }

        const incoming = await request.formData();
        const file = incoming.get("file");
        if (!(file instanceof File) || !file.size || file.size > MAX_BYTES) {
          return Response.json({ error: "No usable audio was recorded." }, { status: 400 });
        }
        if (!file.type.startsWith("audio/")) {
          return Response.json({ error: "Unsupported audio format." }, { status: 400 });
        }

        const form = new FormData();
        form.append("model", MODEL);
        form.append("file", file, file.name || "recording.wav");
        form.append("response_format", "json");

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "X-Lovable-AIG-SDK": "fetch" },
          body: form,
          signal: request.signal,
        });

        return new Response(upstream.body, {
          status: upstream.status,
          headers: {
            "content-type": upstream.headers.get("content-type") ?? "application/json",
          },
        });
      },
    },
  },
});
