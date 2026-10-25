# Roadmap — Move from Lovable Cloud to own Firebase

## Blocked on you
- [ ] Resume the backend: workspace ran out of Cloud credits, database is paused. Add Cloud credits in workspace billing so it wakes up.
- [ ] Export backup (after resume): More → Database → Manage → Settings → Export data. Do this BEFORE removing anything — removal is irreversible. Storage files are not included; download them from More → Storage.
- [ ] Provide Firebase project config (web apiKey, projectId, appId, etc.) and a service-account JSON for the server side.
- [ ] Remove Lovable Cloud (last step, admin only): More → Database → Manage → Settings → Remove Database.

## In progress (me)
- [ ] Scaffold Firebase client + admin modules
- [ ] Migrate auth (email/password + Google) to Firebase Auth
- [ ] Migrate database layer (29 files use Supabase: chat, projects, agents, settings, coworkers, connectors, plugins)
- [ ] Migrate storage (generated images bucket) to Firebase Storage
- [ ] Verify sign-in, chat, projects end-to-end on Firebase
