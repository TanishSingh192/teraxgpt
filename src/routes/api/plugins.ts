import { PUBLIC_SUPABASE_KEY, PUBLIC_SUPABASE_URL } from "@/lib/public-backend";
import { createClient } from "@supabase/supabase-js";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireUser } from "@/lib/api-auth.server";

const PLUGINS = [
  { id: "web_research", name: "Web research", description: "Search the web, open sources, and cite research findings.", category: "Research" },
  { id: "image_generation", name: "Image generation", description: "Create images from natural-language prompts.", category: "Creation" },
  { id: "memory", name: "Saved memory", description: "Let the assistant save durable facts to your memory.", category: "Personalization" },
  { id: "mcp_connectors", name: "MCP connectors", description: "Allow enabled external MCP servers to provide tools in chat.", category: "Integrations" },
] as const;

const UpdateSchema = z.object({
  pluginId: z.enum(["web_research", "image_generation", "memory", "mcp_connectors"]),
  enabled: z.boolean(),
});

function userClient(request: Request) {
  const url = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"] || PUBLIC_SUPABASE_URL;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] || PUBLIC_SUPABASE_KEY || process.env["SUPABASE_ANON_KEY"];
  if (!url || !key) throw new Error("Database is not configured.");
  return createClient(url, key, {
    global: { headers: { Authorization: request.headers.get("authorization") ?? "" } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const Route = createFileRoute("/api/plugins")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireUser(request);
        if ("response" in auth) return auth.response;
        try {
          const supabase = userClient(request);
          const { data, error } = await supabase.from("user_plugin_settings")
            .select("plugin_id,enabled")
            .eq("user_id", auth.userId);
          if (error) throw error;
          const settings = new Map((data ?? []).map((row) => [row.plugin_id, row.enabled]));
          return Response.json({
            plugins: PLUGINS.map((plugin) => ({ ...plugin, enabled: settings.get(plugin.id) ?? true })),
          }, { headers: { "cache-control": "no-store" } });
        } catch {
          return Response.json({ error: "Could not load plugins. Apply the plugin settings database migration first." }, { status: 500 });
        }
      },
      POST: async ({ request }) => {
        const auth = await requireUser(request);
        if ("response" in auth) return auth.response;
        const raw = await request.json().catch(() => null);
        const parsed = UpdateSchema.safeParse(raw);
        if (!parsed.success) return Response.json({ error: "Invalid plugin setting." }, { status: 400 });
        try {
          const supabase = userClient(request);
          const { error } = await supabase.from("user_plugin_settings").upsert({
            user_id: auth.userId,
            plugin_id: parsed.data.pluginId,
            enabled: parsed.data.enabled,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id,plugin_id" });
          if (error) throw error;
          return Response.json({ ok: true, pluginId: parsed.data.pluginId, enabled: parsed.data.enabled });
        } catch {
          return Response.json({ error: "Could not save plugin setting." }, { status: 500 });
        }
      },
    },
  },
});
