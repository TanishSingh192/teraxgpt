# Deploy TeraXGPT on Cloudflare Workers (Free plan)

This project can be hosted on Cloudflare Workers while continuing to use the existing Supabase project for authentication, PostgreSQL data, and file storage. This removes Lovable hosting/AI Gateway as a required runtime dependency; it does **not** automatically copy or migrate any existing data.

## Before you start

1. Create a Cloudflare account and open Workers & Pages.
2. In the repository, run `bun install --frozen-lockfile`, then `bun run build`.
3. Confirm the build creates `.output/server/index.mjs` and `.output/public/`.
4. Install Wrangler locally with `bun add -d wrangler` if it is not already available, then authenticate with `bunx wrangler login`.
5. Deploy using `bunx wrangler deploy`.

The root `wrangler.toml` targets the Nitro Cloudflare Workers output. If the build output paths change in a future framework upgrade, update the configuration to match the generated output.

## Configure runtime secrets

Add secrets in the Cloudflare dashboard under **Workers & Pages → teraxgpt → Settings → Variables and Secrets**. Use encrypted secrets for private values.

Required for core functionality:
- `GEMINI_API_KEY` — Google AI Studio key used server-side for Gemini chat, image generation, and presentation generation.
- `SUPABASE_URL` — URL of the existing Supabase project.
- `SUPABASE_PUBLISHABLE_KEY` — that project's publishable/anon key.

Required for enabled optional features:
- `CONNECTOR_ENCRYPTION_KEY` — stable server-only key for encrypting MCP credentials; generate with `openssl rand -hex 32`.
- `FIRECRAWL_API_KEY` — if the configured web-search/page-reader implementation uses Firecrawl.
- Any keys for optional integrations you explicitly enable.

Do not put secrets in `wrangler.toml`, source control, or `VITE_*` variables. The public Supabase URL and publishable key are intended for browser use; database access must still be protected by correct Row Level Security policies.

## Keep Supabase

The app already points at an external Supabase project. Keep that project configured initially so sign-in, conversation history, database tables, and generated-image storage continue to use the same backend. Do not delete or pause the old backend until you have tested the new deployment and confirmed the existing data is accessible.

If your Supabase project itself is paused or out of quota, hosting the frontend on Cloudflare will not fix that; resume/upgrade the project or migrate the database and storage separately.

## AI provider and free-tier limits

Text chat and PowerPoint generation use Gemini directly. Image generation now uses Gemini's image API directly instead of the Lovable AI Gateway. Set the same server-only `GEMINI_API_KEY` secret. Free-tier eligibility and rate limits vary by model and Google AI Studio project; a provider quota error can still occur. Cloudflare's hosting allowance is separate from Gemini API quotas.

## Smoke test before switching your domain

- Sign in and sign out.
- Start a chat and verify streaming responses.
- Generate an image and confirm it is stored and previewable.
- Generate a PowerPoint, preview slides in chat, and download the `.pptx`.
- Open conversation history and upload a file.
- Test MCP connectors and the coworker/task routes only after applying their required database migrations.
- Review Cloudflare Worker logs and browser console for errors.

Only switch your production domain after these checks pass. Cloudflare hosting setup and deployment require your own Cloudflare account authorization; a source-code commit alone does not publish the app.
