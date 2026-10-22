# Agno AgentOS service

This is the self-hosted agent runtime used by TeraXGPT's optional **Agno AgentOS** chat engine. It runs a general-purpose Agno agent with DuckDuckGo search, persistent sessions, tracing, scheduling, and an MCP endpoint.

## Run locally

Requirements: Python 3.12+ and an API key for an OpenAI-compatible chat model.

```bash
cd services/agno-agent
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

export AGNO_AGENTOS_API_KEY="$(python -c 'import secrets; print(secrets.token_urlsafe(48))')"
export AGNO_MODEL_API_KEY="your-model-provider-key"
export AGNO_MODEL_ID="gpt-4o-mini"
uvicorn main:app --host 127.0.0.1 --port 7777
```

If you use an OpenAI-compatible provider, set `AGNO_MODEL_BASE_URL` to its `/v1` base URL and `AGNO_MODEL_ID` to the exact model identifier. `AGNO_MODEL_API_KEY` can be used for that provider; `OPENAI_API_KEY` is accepted as a fallback.

The API is available at `http://127.0.0.1:7777`. Execution endpoints require `Authorization: Bearer <AGNO_AGENTOS_API_KEY>`. `/healthz` and `/info` are public health/discovery endpoints. Do not expose this service directly to the public internet; put it on a private network behind TeraXGPT.

## Connect TeraXGPT

Set these server-side variables in the TeraXGPT deployment:

- `AGNO_BASE_URL`: AgentOS origin, for example `http://agno-agent:7777` inside a private container network.
- `AGNO_API_KEY`: exactly the same secret as `AGNO_AGENTOS_API_KEY` in this service.
- `AGNO_AGENT_ID`: defaults to `teraxgpt-assistant`, the ID declared in `main.py`.

Restart/redeploy TeraXGPT and start a new saved conversation. Choose **Agno AgentOS** from the chat engine selector.

## Current integration boundaries

- The TeraXGPT backend authenticates the app user and sends their ID and conversation ID to AgentOS.
- The runtime persists its own session history in SQLite (`AGNO_DB_PATH`, default `./data/agentos.db`). Use a persistent volume for production.
- The initial TeraXGPT adapter returns a completed agent answer as a chat stream after the run finishes. Intermediate tool events are not yet surfaced in the chat UI.
- The initial adapter is text-only and does not support Temporary Chat. Use the standard TeraXGPT engine for file/image attachments or unsaved temporary sessions.
- This starter includes DuckDuckGo web search, not shell or arbitrary filesystem access. Add additional tools only with explicit security review.
- Configure a durable queue and shared database before relying on scheduled or long-running work in a multi-replica production deployment.
