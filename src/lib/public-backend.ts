// Server-only defaults for Supabase API routes. These values are read from the runtime
// environment; never hardcode a project URL or key here.
export const PUBLIC_SUPABASE_URL =
  process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"] || "https://cpteuvnquolloqfuxkzc.supabase.co";
export const PUBLIC_SUPABASE_KEY =
  process.env["SUPABASE_PUBLISHABLE_KEY"] ||
  process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
  process.env["SUPABASE_ANON_KEY"] ||
  "";
