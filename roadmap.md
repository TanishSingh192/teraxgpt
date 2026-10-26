# Roadmap — Move to your own Supabase

## Connection
- [x] Configure browser and server to use your supplied Supabase project and publishable key.
- [x] Enable account sign-in instead of anonymous sessions (disabled on your project).
- [x] Verify the sign-in screen and target connection; automatic build checks pass.

## Blocked on external access
- [ ] Apply the existing schema migrations to your project: chat and project tables are missing; a publishable key cannot create tables.
- [ ] Verify signed-in chat and project creation after schema setup and an account in your own project.
- [ ] Copy old accounts, chats and storage only after a verified backup; the old Lovable Cloud backend is paused.
- [ ] Configure Google sign-in in your project if wanted; it is currently disabled.
- [ ] Configure a matching server-side privileged key before enabling coworker workers or push notifications; no privileged credential for the external project was provided.
