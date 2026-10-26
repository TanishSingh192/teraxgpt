// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { BACKEND_URL, BACKEND_PROJECT_ID, BACKEND_PUBLISHABLE_KEY } from "./src/lib/backend-config";

// Bind browser and server to the same explicitly selected user-owned project.
// These are public values; private provider credentials remain runtime secrets.

export default defineConfig({
  vite: {
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(BACKEND_URL),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(BACKEND_PUBLISHABLE_KEY),
      "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(BACKEND_PROJECT_ID),
      "import.meta.env.VITE_AUTH_ENABLED": JSON.stringify("true"),
      "process.env.SUPABASE_URL": JSON.stringify(BACKEND_URL),
      "process.env.VITE_SUPABASE_URL": JSON.stringify(BACKEND_URL),
      "process.env.SUPABASE_PUBLISHABLE_KEY": JSON.stringify(BACKEND_PUBLISHABLE_KEY),
      "process.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(BACKEND_PUBLISHABLE_KEY),
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
