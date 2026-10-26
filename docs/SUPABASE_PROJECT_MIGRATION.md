# Supabase project migration

TeraXGPT is being switched from the previous Supabase project to the personal project
`cpteuvnquolloqfuxkzc`. The project URL and publishable key are public configuration.
Database passwords, service-role keys, access tokens, and backup files must not be committed.

## 1. Configure the application

The supplied URL and publishable key are now in `src/lib/backend-config.ts`.
`vite.config.ts` binds both browser and server to these public values so an old managed
environment cannot override the selected project. Publish again to update the live site.
For independent hosting, the equivalent environment values are:

- `VITE_SUPABASE_URL=https://cpteuvnquolloqfuxkzc.supabase.co`
- `SUPABASE_URL=https://cpteuvnquolloqfuxkzc.supabase.co`
- `VITE_SUPABASE_PROJECT_ID=cpteuvnquolloqfuxkzc`
- `SUPABASE_PROJECT_ID=cpteuvnquolloqfuxkzc`
- `VITE_SUPABASE_PUBLISHABLE_KEY` — set the new project's publishable key.
- `SUPABASE_PUBLISHABLE_KEY` — set the same publishable key for server-side Supabase clients.

Never put a service-role key, database password, or Gemini API key in a `VITE_*`
variable or public configuration. Redeploy after changing build-time values.
Email/password sign-in is enabled; the target requires email confirmation. Google is disabled
on the target and cannot use the managed Cloud broker. Configure an external OAuth flow before
enabling the Google button.

## 2. Apply the schema to the new project

The repository contains versioned Supabase migrations. After reviewing the target project and
confirming it is the intended destination, authenticate with the Supabase CLI and run:

```sh
supabase login
supabase link --project-ref cpteuvnquolloqfuxkzc
supabase migration list
supabase db push
```

Inspect the migration list before pushing. Do not run `supabase db reset --linked` against the
remote project; it is destructive. The baseline migrations create application tables, indexes,
triggers, RLS policies, and the app's connector settings. Confirm the storage bucket
`generated-images` exists and configure its storage policies. Check the target's Auth URL
configuration, redirect URLs, email provider, OAuth providers, and allowed site URLs before
switching traffic.

## 3. Migrate existing data (requires database access)

The old project reference found in the repository was `iotnjxvzwuavsgljnlvn`. A publishable key
cannot export database data or users. Data migration requires authorized database connection
strings (or equivalent owner access) for both projects and a verified backup. Those credentials
are deliberately not stored in this repository.

Before the cutover:
1. Take a backup of the source database and verify it can be read.
2. Decide whether to migrate Auth users/identities and Storage objects as well as rows in
   `public`. Application records reference `auth.users.id`, so user IDs must remain consistent.
3. Use the Supabase backup/restore procedure or `pg_dump`/ `pg_restore` with the source and
   destination database connection strings supplied through your shell environment. Do not
   dump/restore Supabase-managed schemas blindly; follow Supabase's documented handling for
   Auth and Storage objects.
4. Copy Storage bucket objects separately and verify object paths/metadata.
5. Compare row counts and sample records for profiles, conversations, messages, usage records,
   projects, project files/memory/artifacts, agents/runs, user settings/memory, skills,
   scheduled actions, MCP connectors, coworker runs/events, and push subscriptions.
6. Test login, password reset, OAuth redirects, chat persistence, RLS isolation, generated-image
   access, connectors, and push notifications against the new project.
7. Keep the old project intact until the new project has passed smoke tests and the rollback
   window has expired.

Do not run a full restore into a project containing data unless you have a backup and have
explicitly assessed table conflicts. The code/configuration switch does not itself copy database
rows, Auth identities, or Storage files.

## 4. Deployment environment

Update the environment variables in the hosting provider (and any background worker) separately.
Repository commits cannot update hosting secrets automatically. Confirm that no old Supabase
URL/key remains in the active deployment configuration, then redeploy and run smoke tests.

Coworker workers, cancellation and push notifications currently require a server-only privileged
key belonging to the target project. Do not reuse a managed Cloud service key with the external
URL. A publishable key cannot create schema, export old data or authorize privileged operations.
