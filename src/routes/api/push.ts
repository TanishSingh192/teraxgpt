import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { PUBLIC_SUPABASE_KEY, PUBLIC_SUPABASE_URL } from "@/lib/public-backend";
import { getPushPublicKey, sendPushToUser } from "@/lib/web-push.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

const SubscriptionSchema = z.object({
  endpoint: z.string().url().max(3000),
  keys: z.object({ p256dh: z.string().min(40).max(200), auth: z.string().min(16).max(100) }),
}).strict();

async function authenticatedUser(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return null;
  const client = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser(token);
  return error ? null : data.user;
}

export const Route = createFileRoute("/api/push")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!getPushPublicKey()) return Response.json({ error: "Push notifications are not configured on the server." }, { status: 503 });
        const user = await authenticatedUser(request);
        if (!user) return Response.json({ error: "Sign in to manage push notifications." }, { status: 401 });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = supabaseAdmin as unknown as { from: (table: string) => any };
        const { data, error } = await db.from("push_subscriptions").select("endpoint").eq("user_id", user.id);
        if (error) return Response.json({ error: "Could not read notification settings. Apply the push subscriptions migration first." }, { status: 503 });
        return Response.json({ publicKey: getPushPublicKey(), enabled: Boolean(data?.length) });
      },
      POST: async ({ request }) => {
        const user = await authenticatedUser(request);
        if (!user) return Response.json({ error: "Sign in to manage push notifications." }, { status: 401 });
        const publicKey = getPushPublicKey();
        if (!publicKey || !process.env["VAPID_PRIVATE_KEY"]) return Response.json({ error: "Push notifications are not configured on the server." }, { status: 503 });
        let body: unknown;
        try { body = await request.json(); } catch { return Response.json({ error: "Invalid request body." }, { status: 400 }); }
        const parsed = z.object({ action: z.enum(["subscribe", "unsubscribe", "test"]).optional(), subscription: SubscriptionSchema.optional() }).safeParse(body);
        if (!parsed.success) return Response.json({ error: "Invalid push request." }, { status: 400 });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = supabaseAdmin as unknown as { from: (table: string) => any };
        if (parsed.data.action === "test") {
          const sent = await sendPushToUser(user.id, { title: "TeraXGPT notifications enabled", body: "Push notifications are working. Scheduled actions will notify you here.", url: "/settings" });
          return sent ? Response.json({ ok: true, sent }) : Response.json({ error: "No active subscription was found. Enable notifications first." }, { status: 409 });
        }
        if (parsed.data.action === "unsubscribe") {
          if (parsed.data.subscription?.endpoint) await db.from("push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", parsed.data.subscription.endpoint);
          else await db.from("push_subscriptions").delete().eq("user_id", user.id);
          return Response.json({ ok: true });
        }
        if (!parsed.data.subscription) return Response.json({ error: "A browser push subscription is required." }, { status: 400 });
        const { error } = await db.from("push_subscriptions").upsert({
          user_id: user.id,
          endpoint: parsed.data.subscription.endpoint,
          subscription: parsed.data.subscription,
          updated_at: new Date().toISOString(),
        }, { onConflict: "endpoint" });
        if (error) return Response.json({ error: "Could not save your subscription. Apply the push subscriptions migration." }, { status: 503 });
        return Response.json({ ok: true });
      },
    },
  },
});
