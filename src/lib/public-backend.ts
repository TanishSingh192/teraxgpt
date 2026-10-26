// Shared public defaults; no runtime secrets are evaluated at module scope.
export {
  BACKEND_URL as PUBLIC_SUPABASE_URL,
  BACKEND_PUBLISHABLE_KEY as PUBLIC_SUPABASE_KEY,
} from "./backend-config";
