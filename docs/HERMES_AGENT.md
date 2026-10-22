# Hermes Agent integration

TeraXGPT can route a fresh chat to a separately hosted [Hermes Agent](https://github.com/NousResearch/hermes-agent) service through Hermes' OpenAI-compatible Chat Completions API. The existing TeraXGPT engine remains the default and is unchanged when Hermes is not selected.

## Architecture

- The chat UI offers an engine selector: **TeraXGPT** or **Hermes Agent**.
- The server authenticates the user through the existing Supabase session before routing the request.
- The server forwards the conversation and TeraXGPT's applicable user/project/agent instructions to the configured Hermes API.
- Hermes executes its own configured agent loop and tools; TeraXGPT does not expose its local AI SDK tools to the Hermes backend.
- Hermes credentials remain server-side. The browser never receives `HERMES_API_KEY`.

This is an API integration, not a vendored copy of Hermes. Run Hermes as a separate service and secure it independently.

## Configure

1. Install and configure Hermes Agent using its official [programmatic integration guide](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/developer-guide/programmatic-integration.md).
2. Start its OpenAI-compatible API server and verify that the service is reachable from the TeraXGPT server. The configured base URL should be the service origin, without a trailing slash or `/v1`; for example, `http://127.0.0.1:8642` when running locally.
3. Set these server-side environment variables:

   | Variable | Purpose |
   | --- | --- |
   | `HERMES_BASE_URL` | Required service origin, without `/v1` |
   | `HERMES_API_KEY` | Optional bearer token if API authentication is enabled |
   | `HERMES_MODEL` | Model identifier accepted by that Hermes API server; defaults to `hermes-agent` |

4. Restart/redeploy TeraXGPT. Start a **new chat**, select **Hermes Agent**, and send a text prompt.
5. To return to the regular model router, select **TeraXGPT** in a new chat.

## Important limitations

- Hermes must be deployed separately; this repository does not install, supervise, or host the Hermes process.
- The first integration uses the OpenAI-compatible chat-completions endpoint. It does not yet integrate Hermes' run lifecycle API, event stream, approval endpoints, pause/resume, durable task history, or scheduled jobs.
- The initial UI path is intended for text prompts. File attachments, TeraXGPT's local web/image tools, and local MCP connector approval flow are not passed through as Hermes tools.
- Hermes uses the toolsets and permissions configured on the Hermes service. Secure that service with network restrictions and authentication; do not expose an unauthenticated agent endpoint to the public internet.
- The engine can only be changed before a conversation starts, to avoid mixing two runtimes in one transcript.
- Cost and token usage reporting from Hermes may be incomplete depending on the API server's response format.

## Troubleshooting

- If the UI returns a configuration error, set `HERMES_BASE_URL` on the TeraXGPT server and redeploy.
- If the service returns a 401/403, check `HERMES_API_KEY` and the Hermes API server's authentication configuration.
- If it returns a model error, set `HERMES_MODEL` to a model name exposed by your Hermes server.
- Make sure the base URL is reachable **from the TeraXGPT server**, not only from your browser.
