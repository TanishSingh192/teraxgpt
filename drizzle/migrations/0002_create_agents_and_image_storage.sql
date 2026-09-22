CREATE TABLE public.agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  instructions TEXT NOT NULL DEFAULT '',
  model_id TEXT NOT NULL DEFAULT 'auto',
  tools JSONB NOT NULL DEFAULT '[]'::jsonb,
  require_approval BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  goal TEXT NOT NULL DEFAULT '',
  plan JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'running',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX agents_user_idx ON public.agents(user_id, updated_at DESC);
CREATE INDEX agents_project_idx ON public.agents(project_id);
CREATE INDEX agent_runs_agent_idx ON public.agent_runs(agent_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agents TO authenticated;
GRANT ALL ON public.agents TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_runs TO authenticated;
GRANT ALL ON public.agent_runs TO service_role;

ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their agents" ON public.agents
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage their agent runs" ON public.agent_runs
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL;

CREATE POLICY "Users read their generated images" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'generated-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users upload their generated images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'generated-images' AND auth.uid()::text = (storage.foldername(name))[1]);
