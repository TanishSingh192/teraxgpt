-- Persistent task history for the AI coworker workspace.
-- Safe additive migration: does not modify existing chat or agent tables.
create table if not exists public.coworker_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid null references public.conversations(id) on delete set null,
  agent_id text not null check (agent_id in ('general','research','writing','coding')),
  status text not null default 'queued' check (status in ('queued','running','waiting_approval','completed','failed','cancelled')),
  input text not null check (char_length(input) between 1 and 20000),
  output text,
  error_code text,
  attempt_count integer not null default 0 check (attempt_count between 0 and 3),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists coworker_runs_user_created_idx on public.coworker_runs(user_id, created_at desc);
create index if not exists coworker_runs_queue_idx on public.coworker_runs(status, created_at) where status = 'queued';
create index if not exists coworker_runs_conversation_idx on public.coworker_runs(user_id, conversation_id, created_at desc);

create table if not exists public.coworker_events (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.coworker_runs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('run_started','status_changed','tool_started','tool_completed','text_generated','approval_required','run_completed','run_failed','run_cancelled')),
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists coworker_events_run_created_idx on public.coworker_events(run_id, created_at, id);

alter table public.coworker_runs enable row level security;
alter table public.coworker_events enable row level security;

drop policy if exists "Users read their coworker runs" on public.coworker_runs;
create policy "Users read their coworker runs" on public.coworker_runs for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users enqueue their coworker runs" on public.coworker_runs;
create policy "Users enqueue their coworker runs" on public.coworker_runs for insert to authenticated with check (auth.uid() = user_id and status = 'queued' and output is null and error_code is null and attempt_count = 0);
drop policy if exists "Users read their coworker events" on public.coworker_events;
create policy "Users read their coworker events" on public.coworker_events for select to authenticated using (auth.uid() = user_id);

-- No browser-side update/delete policy: lifecycle transitions are server-owned.
revoke update, delete on public.coworker_runs from anon, authenticated;
revoke insert, update, delete on public.coworker_events from anon, authenticated;
grant select, insert on public.coworker_runs to authenticated;
grant select on public.coworker_events to authenticated;
