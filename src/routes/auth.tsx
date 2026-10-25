import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import logoAsset from "@/assets/terax-logo.png.asset.json";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { AUTH_ENABLED } from "@/lib/auth-config";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in · TeraX CPT AI workspace" },
      {
        name: "description",
        content:
          "Sign in to TeraX CPT, the unified AI workspace with multiple models, files and automatic routing.",
      },
      { property: "og:title", content: "Sign in · TeraX CPT AI workspace" },
      {
        property: "og:description",
        content: "One workspace for every AI model, your files and your conversations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!AUTH_ENABLED || (!loading && session)) void navigate({ to: "/" });
  }, [loading, session, navigate]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) {
          // Fall back to an immediate sign-in when email confirmation is disabled.
          const { data: signedIn, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (signInError) throw signInError;
          if (!signedIn.session) {
            toast.success("Account created. Check your email to confirm your address, then sign in.");
            return;
          }
        }
        toast.success("Welcome to TeraX CPT.");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (!data.session) throw new Error("Sign-in succeeded but no session was returned. Check your email confirmation and Supabase Auth settings.");
      }

      // Do not rely only on the auth listener to navigate: explicitly confirm
      // that the persisted session is readable before entering the protected app.
      const { data: restored, error: restoreError } = await supabase.auth.getSession();
      if (restoreError) throw restoreError;
      if (!restored.session) throw new Error("Your session was not saved. Check the site's storage/cookie settings and try again.");
      await navigate({ to: "/" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google sign-in failed. Try again.");
      return;
    }
    if (result.redirected) return;
    void navigate({ to: "/" });
  }

  if (!AUTH_ENABLED) {
    return <div className="mesh-canvas flex min-h-screen items-center justify-center px-4 py-10 text-sm text-subtle">Opening TeraXGPT…</div>;
  }

  return (
    <div className="mesh-canvas flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-[380px]">
        <div className="mb-6 flex items-center gap-2.5">
          <img src={logoAsset.url} alt="TeraX CPT logo" className="size-8 rounded-lg" />
          <span className="font-display text-[15px] font-semibold tracking-tight">TeraX CPT</span>
        </div>

        <div className="rounded-2xl bg-panel p-6 ring-1 ring-black/5">
          <h1 className="font-display text-[18px] font-semibold tracking-tight">
            {mode === "signin" ? "Sign in to your workspace" : "Create your workspace"}
          </h1>
          <p className="mt-1 text-[13px] text-subtle">
            One place for every model, your files and your conversations.
          </p>

          <form onSubmit={submit} className="mt-5 space-y-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-[0.14em] text-subtle">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-line bg-background px-3 py-2 text-[14px] outline-none focus:border-signal"
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-[0.14em] text-subtle">
                Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-line bg-background px-3 py-2 text-[14px] outline-none focus:border-signal"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-signal px-3 py-2 text-sm font-medium text-white ring-1 ring-signal disabled:opacity-60"
            >
              {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          <div className="my-4 flex items-center gap-3 text-[11px] text-subtle">
            <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
          </div>

          <button
            type="button"
            onClick={() => void google()}
            className="w-full rounded-lg bg-panel px-3 py-2 text-sm font-medium text-ink ring-1 ring-black/10 hover:bg-black/[0.03]"
          >
            Continue with Google
          </button>

          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="mt-4 w-full text-center text-[12px] text-subtle hover:text-ink"
          >
            {mode === "signin"
              ? "No account yet? Create one"
              : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
