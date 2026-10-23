import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { requireUser } from "@/lib/api-auth.server";
import { PUBLIC_SUPABASE_KEY, PUBLIC_SUPABASE_URL } from "@/lib/public-backend";

export const Route = createFileRoute("/api/coworkers/history")({
  server: { handlers: { GET: async ({ request }) => {
    const auth = await requireUser(request);
    if ("response" in auth) return auth.response;
    const token = request.headers.get("authorization")!.slice("Bearer ".length);
    const url = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"] || PUBLIC_SUPABASE_URL;
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] || process.env["SUPABASE_ANON_KEY"] || PUBLIC_SUPABASE_KEY;
    const db = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await db.from("coworker_runs").select("id,agent_id,status,input,output,error_code,created_at,started_at,finished_at").order("created_at", { ascending: false }).limit(50);
    if (error) return Response.json({ error: "Could not load coworker history." }, { status: 503 });
    return Response.json({ runs: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
  } } },
});
