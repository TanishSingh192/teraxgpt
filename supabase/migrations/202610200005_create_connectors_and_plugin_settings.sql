CREATE TABLE IF NOT EXISTS public.user_mcp_connectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  endpoint TEXT NOT NULL CHECK (char_length(endpoint) BETWEEN 1 AND 2048),
  auth_token_encrypted TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);
CREATE INDEX IF NOT EXISTS user_mcp_connectors_user_idx ON public.user_mcp_connectors(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_mcp_connectors TO authenticated;
GRANT ALL ON public.user_mcp_connectors TO service_role;
ALTER TABLE public.user_mcp_connectors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own MCP connectors" ON public.user_mcp_connectors FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.user_plugin_settings (
  user_id UUID NOT NULL,
  plugin_id TEXT NOT NULL CHECK (plugin_id IN ('web_research','image_generation','memory','mcp_connectors')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, plugin_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_plugin_settings TO authenticated;
GRANT ALL ON public.user_plugin_settings TO service_role;
ALTER TABLE public.user_plugin_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own plugin settings" ON public.user_plugin_settings FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);