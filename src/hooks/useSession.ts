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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      receivedAuthEvent = true;
      if (!active) return;
      setSession(nextSession);
      setLoading(false);
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active || receivedAuthEvent) return;
      if (error) {
        console.error("[auth] Could not restore the saved session:", error.message);
      }
      setSession(data.session);
      setLoading(false);
    }).catch((error: unknown) => {
      if (!active || receivedAuthEvent) return;
      console.error("[auth] Session restoration failed:", error);
      setSession(null);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? null, loading };
}
