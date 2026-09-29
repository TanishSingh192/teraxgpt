import { createClient } from "@supabase/supabase-js";

/**
 * Verifies the caller's app session for a raw API route.
 * Returns the signed-in user's id, or a Response to return straight to the caller.
 */
export async function requireUser(
  request: Request,
): Promise<{ userId: string } | { response: Response }> {
  const unauthorized = {
    response: Response.json({ error: "Sign in to use this." }, { status: 401 }),
  };

  const authHeader = request.headers.get("authorization") ?? "";
  if (!/^Bearer [^\s,]+$/.test(authHeader)) return unauthorized;
  const accessToken = authHeader.slice("Bearer ".length);

  const supabaseUrl = process.env["VITE_SUPABASE_URL"] ?? process.env["SUPABASE_URL"];
  const anonKey =
    process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"];
  if (!supabaseUrl || !anonKey) {
    return { response: Response.json({ error: "Sign-in is not configured." }, { status: 500 }) };
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // Server-created clients have no persisted session. Pass the caller's JWT
  // explicitly; getUser() without it only checks the client's empty session.
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) return unauthorized;

  return { userId: data.user.id };
}
