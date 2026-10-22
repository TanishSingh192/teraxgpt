// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Publishable backend values (safe to ship). Baked in because .env is git-ignored,
// so published builds would otherwise be built without them and crash on load.
const SUPABASE_URL = process.env["VITE_SUPABASE_URL"] || "https://iotnjxvzwuavsgljnlvn.supabase.co";
const SUPABASE_KEY =
  process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] || "sb_publishable_422gESUiVkmhomMbMYgfGg_CGIMhBn9";
const SUPABASE_PROJECT = process.env["VITE_SUPABASE_PROJECT_ID"] || "iotnjxvzwuavsgljnlvn";

export default defineConfig({
  vite: {
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(SUPABASE_URL),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(SUPABASE_KEY),
      "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(SUPABASE_PROJECT),
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
