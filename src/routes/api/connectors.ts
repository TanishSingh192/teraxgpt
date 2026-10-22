import { createClient } from "@supabase/supabase-js";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireUser } from "@/lib/api-auth.server";
import { decryptConnectorToken, encryptConnectorToken, listMcpTools, validateMcpEndpoint } from "@/lib/mcp.server";

const Input = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    name: z.string().trim().min(1).max(80),
    endpoint: z.string().trim().url().max(2048),
    token: z.string().max(4000).optional(),
  }),
  z.object({ action: z.literal("delete"), id: z.string().uuid() }),
  z.object({ action: z.literal("toggle"), id: z.string().uuid(), enabled: z.boolean() }),
  z.object({ action: z.literal("tools"), id: z.string().uuid() }),
  z.object({ action: z.literal("test"), id: z.string().uuid() }),
]);

async function readJsonLimited(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > 16_000) throw new Error("too_large");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("empty");
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > 16_000) {
        await reader.cancel();
        throw new Error("too_large");
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

function userClient(request: Request) {
  const url = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"] || import.meta.env.VITE_SUPABASE_URL;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env["SUPABASE_ANON_KEY"];
  if (!url || !key) throw new Error("Database is not configured.");
  return createClient(url, key, {
    global: { headers: { Authorization: request.headers.get("authorization") ?? "" } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const Route = createFileRoute("/api/connectors")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireUser(request);
        if ("response" in auth) return auth.response;
        try {
          const supabase = userClient(request);
          const { data, error } = await supabase
            .from("user_mcp_connectors")
            .select("id,name,endpoint,enabled,last_connected_at,created_at")
            .eq("user_id", auth.userId)
            .order("created_at", { ascending: false });
          if (error) throw error;
          return Response.json({ connectors: data ?? [] }, { headers: { "cache-control": "no-store" } });
        } catch {
          return Response.json({ error: "Could not load connectors. Apply the MCP connector database migration first." }, { status: 500 });
        }
      },
      POST: async ({ request }) => {
        const auth = await requireUser(request);
        if ("response" in auth) return auth.response;
        let raw: unknown;
        try {
          raw = await readJsonLimited(request);
        } catch (error) {
          return Response.json(
            { error: error instanceof Error && error.message === "too_large" ? "Connector request is too large." : "Invalid connector request body." },
            { status: error instanceof Error && error.message === "too_large" ? 413 : 400 },
          );
        }
        const parsed = Input.safeParse(raw);
        if (!parsed.success) return Response.json({ error: "Invalid connector request." }, { status: 400 });
        try {
          const supabase = userClient(request);
          const input = parsed.data;
          if (input.action === "create") {
            let endpoint: URL;
            try { endpoint = validateMcpEndpoint(input.endpoint); }
            catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Invalid endpoint." }, { status: 400 }); }
            let encrypted: string | null = null;
            if (input.token?.trim()) {
              try { encrypted = await encryptConnectorToken(input.token.trim()); }
              catch { return Response.json({ error: "Server credential encryption is not configured. Set CONNECTOR_ENCRYPTION_KEY." }, { status: 503 }); }
            }
            const { data, error } = await supabase
              .from("user_mcp_connectors")
              .insert({ user_id: auth.userId, name: input.name, endpoint: endpoint.toString(), auth_token_encrypted: encrypted })
              .select("id,name,endpoint,enabled,last_connected_at,created_at")
              .single();
            if (error) {
              if (error.code === "23505") return Response.json({ error: "That MCP endpoint is already connected." }, { status: 409 });
              throw error;
            }
            return Response.json({ connector: data }, { status: 201 });
          }
          if (input.action === "delete") {
            const { error } = await supabase.from("user_mcp_connectors").delete().eq("id", input.id).eq("user_id", auth.userId);
            if (error) throw error;
            return Response.json({ ok: true });
          }
          if (input.action === "toggle") {
            const { error } = await supabase.from("user_mcp_connectors").update({ enabled: input.enabled, updated_at: new Date().toISOString() }).eq("id", input.id).eq("user_id", auth.userId);
            if (error) throw error;
            return Response.json({ ok: true });
          }

          const { data, error } = await supabase
            .from("user_mcp_connectors")
            .select("id,name,endpoint,auth_token_encrypted,enabled")
            .eq("id", input.id)
            .eq("user_id", auth.userId)
            .maybeSingle();
          if (error) throw error;
          if (!data) return Response.json({ error: "Connector not found." }, { status: 404 });
          if (!data.enabled) return Response.json({ error: "Enable this connector first." }, { status: 409 });
          const token = await decryptConnectorToken(data.auth_token_encrypted);
          const tools = await listMcpTools(data.endpoint, token);
          await supabase.from("user_mcp_connectors").update({ last_connected_at: new Date().toISOString() }).eq("id", input.id).eq("user_id", auth.userId);
          return Response.json({ connector: { id: data.id, name: data.name }, tools });
        } catch (error) {
          const message = error instanceof Error ? error.message : "";
          console.error("MCP connector operation failed.");
          return Response.json({ error: message.includes("timed out") ? "MCP server timed out." : "Could not communicate with the MCP server. Check its endpoint and credentials." }, { status: 502 });
        }
      },
    },
  },
});
