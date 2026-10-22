-- Per-user remote MCP connectors. Secrets are encrypted by the server and never returned to clients.
CREATE TABLE IF NOT EXISTS public.user_mcp_connectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  endpoint TEXT NOT NULL CHECK (char_length(endpoint) BETWEEN 1 AND 2048),
  auth_token_encrypted TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);
CREATE INDEX IF NOT EXISTS user_mcp_connectors_user_idx
  ON public.user_mcp_connectors(user_id, created_at DESC);
ALTER TABLE public.user_mcp_connectors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_mcp_connectors FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_mcp_connectors TO authenticated;
CREATE POLICY "Users manage their own MCP connectors"
  ON public.user_mcp_connectors FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
