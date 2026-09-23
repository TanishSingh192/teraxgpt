// A single place to get a *valid* access token for calls to our own API routes.
// getSession() can hand back a token that is already expired (or about to be),
// which the server then rejects with 401. So we proactively refresh.
import { supabase } from "@/integrations/supabase/client";

const SKEW_SECONDS = 120;

export async function freshAccessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  let session = data.session;

  const expiresAt = session?.expires_at ?? 0;
  const stale = !session?.access_token || expiresAt * 1000 <= Date.now() + SKEW_SECONDS * 1000;

  if (stale) {
    const refreshed = await supabase.auth.refreshSession();
    if (refreshed.data.session?.access_token) session = refreshed.data.session;
  }

  const token = session?.access_token;
  if (!token) {
    throw new Error("Your session expired. Please sign in again to keep chatting.");
  }
  return token;
}
