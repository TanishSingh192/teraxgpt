import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { AUTH_ENABLED } from "@/lib/auth-config";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    // Auth events are authoritative. Do not let a slower getSession() call
    // overwrite a newer SIGNED_IN event with a stale null session.
    let receivedAuthEvent = false;
    let anonymousSessionReady = AUTH_ENABLED;
    // Never leave the entire app on the loading screen if browser storage or
    // the auth client's session restoration stalls. The normal auth result or
    // auth event wins; this is only a last-resort escape hatch.
    const loadingFallback = window.setTimeout(() => {
      if (!active || receivedAuthEvent) return;
      if (!AUTH_ENABLED && !anonymousSessionReady) return;
      console.error("[auth] Session restoration timed out; continuing to the sign-in flow.");
      setSession(null);
      setLoading(false);
    }, 10000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!AUTH_ENABLED && !nextSession && !anonymousSessionReady) return;
      receivedAuthEvent = true;
      window.clearTimeout(loadingFallback);
      if (!active) return;
      setSession(nextSession);
      setLoading(false);
    });

    void supabase.auth.getSession().then(async ({ data, error }) => {
      if (!active || receivedAuthEvent) return;
      window.clearTimeout(loadingFallback);
      if (error) {
        console.error("[auth] Could not restore the saved session:", error.message);
      }
      if (data.session) {
        setSession(data.session);
        setLoading(false);
        return;
      }
      if (AUTH_ENABLED) {
        setSession(null);
        setLoading(false);
        return;
      }
      // Keep the workspace gated until Supabase issues an anonymous session.
      try {
        const { data: anonymous, error: anonymousError } = await supabase.auth.signInAnonymously();
        if (anonymousError) throw anonymousError;
        anonymousSessionReady = true;
        if (!active) return;
        setSession(anonymous.session);
        setLoading(false);
      } catch (anonymousError) {
        anonymousSessionReady = true;
        if (!active) return;
        console.error("[auth] Anonymous sign-in failed. Enable Anonymous Sign-Ins in Supabase Auth to use the workspace without a login page.", anonymousError);
        setSession(null);
        setLoading(false);
      }
    }).catch((error: unknown) => {
      if (!active || receivedAuthEvent) return;
      window.clearTimeout(loadingFallback);
      console.error("[auth] Session restoration failed:", error);
      if (!AUTH_ENABLED) {
        void supabase.auth.signInAnonymously().then(({ data, error }) => {
          anonymousSessionReady = true;
          if (!active) return;
          if (error) console.error("[auth] Anonymous sign-in failed:", error.message);
          setSession(data.session);
          setLoading(false);
        }).catch((anonymousError: unknown) => {
          anonymousSessionReady = true;
          if (!active) return;
          console.error("[auth] Anonymous sign-in failed:", anonymousError);
          setSession(null);
          setLoading(false);
        });
        return;
      }
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
