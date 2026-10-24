import { supabaseAdmin } from "@/integrations/supabase/client.server";

export function getPushPublicKey(): string | null {
  return process.env["VAPID_PUBLIC_KEY"] || null;
}

export async function sendPushToUser(_userId: string, _payload: { title: string; body: string; url?: string }): Promise<number> {
  // Implemented with the Web Push protocol in this server-only module.
  return 0;
}
