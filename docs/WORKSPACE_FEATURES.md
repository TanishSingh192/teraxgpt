# Workspace feature status

This document distinguishes shipped foundations from future work. TeraXGPT is not yet feature-equivalent to ChatGPT, Claude, or Gemini.

## Available in this branch

- **Temporary Chat:** start a non-persistent conversation from an empty chat. Transcript messages and conversation records are not written to the conversation tables. Usage totals remain recorded without conversation content. Temporary chats do not load saved personalization/memory, project context, selected skills, or configured agents, and the save-memory tool is unavailable.
- **Deep Research:** opt into a research-oriented system prompt and web search/open-source tools. The prompt requires source opening, cross-checking, inline citations, and a sources section. Quality depends on the configured web-search provider and model.
- **Plugin library:** users can enable or disable built-in web research, image generation, saved memory, and MCP connector capabilities from Settings → Plugins.
- **MCP connectors:** configure remote HTTPS MCP servers in Settings → Connectors. Credentials use server-side encryption; discovered tool calls require approval.

## Deployment

1. Apply `drizzle/migrations/0006_create_user_plugin_settings.sql` after the existing MCP connector migration.
2. Configure `CONNECTOR_ENCRYPTION_KEY` as a stable server-only secret before storing connector tokens.
3. Deploy the app and test temporary chat persistence, plugin toggles, deep-research citations, MCP tool approvals, and user-to-user isolation.

## Important limits

- Temporary mode does not store the conversation transcript, but operational usage metadata may still be stored with a null conversation ID. External actions explicitly approved in the session may still change external systems or create provider-side artifacts.
- Deep Research currently uses the app's configured web search and page-reading tools. It is not a separate autonomous research service with background task execution, live progress events, or a durable research report workspace.
- The plugin library is a small first-party capability catalogue, not an unrestricted third-party marketplace. OAuth installation and provider-specific integrations are future work.
- MCP support is remote HTTPS only; local stdio servers and interactive OAuth are not supported.
- This branch still requires a successful build, lint, automated tests, and deployment smoke tests before production use.

## Roadmap toward a broader multimodal workspace

1. OAuth-based connectors for common services and an extensible connector SDK.
2. Research jobs with progress, cancellation, source collections, and exportable reports.
3. Richer multimodal support: audio input/output, image understanding/generation, document parsing, and video-frame workflows where supported by providers.
4. Data-analysis sandbox with isolated execution, file previews, and downloadable artifacts.
5. Agent/workflow builder with explicit permissions, approval gates, schedules, run logs, retries, and cancellation.
6. Projects, shareable artifacts, collaboration, and durable memory controls.
7. Usage budgets, per-provider rate limits, audit logs, telemetry, automated security tests, and operational alerting.

Each capability should be implemented and tested against actual provider support; a UI toggle alone is not feature parity.
