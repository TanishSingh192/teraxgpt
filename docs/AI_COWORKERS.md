# AI Coworkers MVP

TeraXGPT's coworker feature is additive. It keeps the existing chat route, model registry, and conversation history unchanged.

## What is included

- Server-owned General, Research, Writing, and Coding profiles.
- Authenticated task enqueue, persisted run history, status/event retrieval, and cancellation.
- Existing Lovable AI gateway and existing model IDs.
- Research-only access to the configured web search and page-reading handlers. Other specialists receive no tools.
- Bounded retries, compare-and-set queue claiming, and a 90-second execution timeout.
- User-scoped RLS for run and event reads; lifecycle writes are server-side only.

## Migration

Apply `supabase/migrations/202610220001_coworker_runs.sql` before enabling the feature. It adds tables and indexes without changing existing chat data.

## Server configuration

Use the existing `LOVABLE_API_KEY`, `SUPABASE_URL`, and configure server-only `SUPABASE_SERVICE_ROLE_KEY` plus a strong `AGENT_WORKER_SECRET`. Never expose service credentials with a `VITE_` prefix. Research also requires the existing search/page-reader provider.

## Durable execution

POST `/api/coworkers` persists a queued run and returns its ID. Configure a trusted scheduler to POST `/api/coworkers/worker` over HTTPS with `Authorization: Bearer <AGENT_WORKER_SECRET>`. Each worker invocation processes at most one task. The worker remains necessary for queued tasks to progress; no in-memory timer or browser-dependent worker is used. If the hosting platform cannot schedule HTTP requests, deploy a separate worker implementing the same queue-claim protocol.

The UI polls persisted status, so users can close and reopen the panel without losing task history.

## Boundaries

This is an MVP, not full OpenDots parity. Agent profiles are server-owned constants, not user-editable database records. Tools are limited to read-only web search and page reading. Shell execution, computer control, document ingestion, external writes, and sensitive-action approvals are not enabled. Usage accounting is not yet integrated into coworker runs. Normal chat remains available independently.

## Verification

1. Apply the migration in staging.
2. Configure the server secrets and scheduler.
3. Call `GET /api/coworkers` with a valid user token.
4. Submit a task and verify HTTP 202 plus a persisted run ID.
5. Trigger the worker and verify completion/failure events and output.
6. Reopen the panel and verify persisted status.
7. Verify users cannot retrieve or cancel another user's run.
8. Test queued/running cancellation and missing search-provider behavior.
