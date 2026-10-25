import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    // Auth events are authoritative. Do not let a slower getSession() call
    // overwrite a newer SIGNED_IN event with a stale null session.
    let receivedAuthEvent = false;
    // Never leave the entire app on the loading screen if browser storage or
    // the auth client's session restoration stalls. The normal auth result or
    // auth event wins; this is only a last-resort escape hatch.
    const loadingFallback = window.setTimeout(() => {
      if (!active || receivedAuthEvent) return;
      console.error("[auth] Session restoration timed out; continuing to the sign-in flow.");
      setSession(null);
      setLoading(false);
    }, 10000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      receivedAuthEvent = true;
      window.clearTimeout(loadingFallback);
      if (!active) return;
      setSession(nextSession);
      setLoading(false);
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active || receivedAuthEvent) return;
      window.clearTimeout(loadingFallback);
      if (error) {
        console.error("[auth] Could not restore the saved session:", error.message);
      }
      setSession(data.session);
      setLoading(false);
    }).catch((error: unknown) => {
      if (!active || receivedAuthEvent) return;
      window.clearTimeout(loadingFallback);
      console.error("[auth] Session restoration failed:", error);
      setSession(null);
      setLoading(false);
    });

    return () => {
      active = false;
      window.clearTimeout(loadingFallback);
      subscription.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? null, loading };
}
