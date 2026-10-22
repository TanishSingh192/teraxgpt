# Remote MCP connectors

TeraXGPT supports remote Model Context Protocol (MCP) servers over HTTPS.

## Setup

1. Apply `drizzle/migrations/0005_create_mcp_connectors.sql` to the Supabase project.
2. Set a stable server-side `CONNECTOR_ENCRYPTION_KEY` secret. Generate one with `openssl rand -hex 32`. Never expose it as a `VITE_*` variable and do not rotate it without migrating stored connector credentials.
3. Open **Settings → Connectors**.
4. Enter a display name, public HTTPS MCP endpoint, and optional bearer token. Tokens are encrypted before being stored and are never returned by the connector API.
5. Use **Test & list tools** to check connectivity and inspect the tool catalogue.
6. In a normal chat, enabled connector tools are offered to the model. Every remote MCP tool call requires explicit approval in the chat UI.

## Current limits

- Remote Streamable HTTP-style MCP endpoints only; local stdio servers and OAuth authorization flows are not implemented.
- Bearer-token authentication is supported. Servers that require custom headers or interactive OAuth need a future connector-auth extension.
- Up to five enabled connectors are discovered for a chat request, with tool schemas and results size-limited.
- Remote MCP tools are not automatically granted to configured agents; agent-specific connector permissions need their own UI and policy.
- Endpoint validation blocks common private, loopback, link-local, and IP-literal destinations and redirects are disabled. This is a defense-in-depth guard, not a substitute for network-level egress controls or DNS-rebinding protection in production.
- Treat all tool descriptions and results as untrusted external input. Approval is required because connected tools may modify external systems.

## Troubleshooting

- If Settings reports that the database migration is missing, apply the SQL migration first.
- If a token is supplied but cannot be saved, confirm `CONNECTOR_ENCRYPTION_KEY` is set in the server environment.
- If a connector fails its test, verify the URL, bearer token, MCP HTTP transport, and server logs.
