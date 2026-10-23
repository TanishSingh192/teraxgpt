import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { requireUser } from "@/lib/api-auth.server";
import { PUBLIC_SUPABASE_KEY, PUBLIC_SUPABASE_URL } from "@/lib/public-backend";

function userClient(token: string) {
  const url = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"] || PUBLIC_SUPABASE_URL;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] || process.env["SUPABASE_ANON_KEY"] || PUBLIC_SUPABASE_KEY;
  return createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
}

export const Route = createFileRoute("/api/coworkers/runs/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const auth = await requireUser(request);
        if ("response" in auth) return auth.response;
        const token = request.headers.get("authorization")!.slice("Bearer ".length);
        const db = userClient(token);
        const { data: run, error } = await db.from("coworker_runs").select("id,agent_id,conversation_id,status,input,output,error_code,attempt_count,created_at,started_at,finished_at,updated_at").eq("id", params.id).maybeSingle();
        if (error || !run) return Response.json({ error: "Run not found." }, { status: 404 });
        const { data: events } = await db.from("coworker_events").select("id,event_type,event_data,created_at").eq("run_id", params.id).order("created_at", { ascending: true }).limit(500);
        return Response.json({ run, events: events ?? [] }, { headers: { "Cache-Control": "no-store" } });
      },
      POST: async ({ request, params }) => {
        const auth = await requireUser(request);
        if ("response" in auth) return auth.response;
        const token = request.headers.get("authorization")!.slice("Bearer ".length);
        const db = userClient(token);
        const { data: owned } = await db.from("coworker_runs").select("id,status").eq("id", params.id).maybeSingle();
        if (!owned) return Response.json({ error: "Run not found." }, { status: 404 });
        if (!["queued", "running"].includes(owned.status)) return Response.json({ error: "Only queued or running tasks can be cancelled." }, { status: 409 });
        const url = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"] || PUBLIC_SUPABASE_URL;
        const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
        if (!serviceKey) return Response.json({ error: "Cancellation service is not configured." }, { status: 503 });
        const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
        const { data: run, error } = await admin.from("coworker_runs").update({ status: "cancelled", finished_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", params.id).eq("user_id", auth.userId).in("status", ["queued", "running"]).select("id,status").maybeSingle();
        if (error || !run) return Response.json({ error: "Run could not be cancelled; it may have finished already." }, { status: 409 });
        await admin.from("coworker_events").insert({ run_id: params.id, user_id: auth.userId, event_type: "run_cancelled", event_data: { reason: "user_requested" } });
        return Response.json({ run });
      },
    },
  },
});
