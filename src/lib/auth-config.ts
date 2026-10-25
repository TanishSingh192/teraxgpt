/**
 * Authentication rollout switch.
 * Set VITE_AUTH_ENABLED=true to restore the existing sign-in/sign-up page.
 * When false, the app uses Supabase anonymous sign-in so protected API routes
 * still receive a real Supabase session rather than bypassing server auth.
 */
export const AUTH_ENABLED = import.meta.env["VITE_AUTH_ENABLED"] === "true";
