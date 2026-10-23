import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth.server";
import { PUBLIC_SUPABASE_KEY, PUBLIC_SUPABASE_URL } from "@/lib/public-backend";

const agents = [
  { id: "general", name: "General Assistant", description: "Everyday questions and straightforward tasks.", modelProfile: "balanced", capabilities: ["conversation"] },
  { id: "research", name: "Research Agent", description: "Research and evidence-based synthesis using configured web search and page-reading tools.", modelProfile: "reasoning", capabilities: ["web_search", "open_source"] },
  { id: "writing", name: "Writing Agent", description: "Draft, edit, summarize, and improve written material.", modelProfile: "balanced", capabilities: ["writing"] },
  { id: "coding", name: "Coding Agent", description: "Explain, write, debug, and review code. No shell or arbitrary code execution.", modelProfile: "reasoning", capabilities: ["coding"] },
] as const;

const RunInput = z.object({
  agentId: z.enum(["general", "research", "writing", "coding"]).default("general"),
  input: z.string().trim().min(1).max(20_000),
  conversationId: z.string().uuid().nullable().optional(),
});

function userClient(token: string) {
  const url = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"] || PUBLIC_SUPABASE_URL;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] || process.env["SUPABASE_ANON_KEY"] || PUBLIC_SUPABASE_KEY;
  return createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
}

export const Route = createFileRoute("/api/coworkers")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireUser(request);
        if ("response" in auth) return auth.response;
        return Response.json({ agents });
      },
      POST: async ({ request }) => {
        const auth = await requireUser(request);
        if ("response" in auth) return auth.response;
        let raw: unknown;
        try { raw = await request.json(); } catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
        const parsed = RunInput.safeParse(raw);
        if (!parsed.success) return Response.json({ error: "Provide a valid agent, prompt, and optional conversation ID." }, { status: 400 });
        const token = request.headers.get("authorization")!.slice("Bearer ".length);
        const db = userClient(token);
        if (parsed.data.conversationId) {
          const { data, error } = await db.from("conversations").select("id").eq("id", parsed.data.conversationId).maybeSingle();
          if (error || !data) return Response.json({ error: "Conversation not found or not accessible." }, { status: 404 });
        }
        const { data, error } = await db.from("coworker_runs").insert({
          user_id: auth.userId,
          conversation_id: parsed.data.conversationId ?? null,
          agent_id: parsed.data.agentId,
          input: parsed.data.input,
          status: "queued",
        }).select("id,status,agent_id,conversation_id,created_at").single();
        if (error || !data) {
          console.error("Coworker run enqueue failed.");
          return Response.json({ error: "Could not enqueue the task. Verify the coworker database migration is applied." }, { status: 503 });
        }
        return Response.json({ run: data }, { status: 202, headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
