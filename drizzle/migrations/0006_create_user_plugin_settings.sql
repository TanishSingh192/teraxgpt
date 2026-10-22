-- Per-user plugin preferences. Missing rows default to enabled in the chat runtime.
create table if not exists public.user_plugin_settings (
  user_id uuid not null references auth.users(id) on delete cascade,
  plugin_id text not null check (plugin_id in ('web_research', 'image_generation', 'memory', 'mcp_connectors')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, plugin_id)
);

alter table public.user_plugin_settings enable row level security;

create policy "Users can read their plugin settings"
  on public.user_plugin_settings for select
  using (auth.uid() = user_id);

create policy "Users can insert their plugin settings"
  on public.user_plugin_settings for insert
  with check (auth.uid() = user_id);

create policy "Users can update their plugin settings"
  on public.user_plugin_settings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their plugin settings"
  on public.user_plugin_settings for delete
  using (auth.uid() = user_id);

create index if not exists user_plugin_settings_user_idx
  on public.user_plugin_settings (user_id);
