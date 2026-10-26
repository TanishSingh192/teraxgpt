import { expect, test } from "bun:test";
import { BACKEND_URL, BACKEND_PROJECT_ID } from "./backend-config";
import { AUTH_ENABLED } from "./auth-config";

test("the backend points to the user's supplied project", () => {
  expect(BACKEND_URL).toBe("https://cpteuvnquolloqfuxkzc.supabase.co");
  expect(BACKEND_PROJECT_ID).toBe("cpteuvnquolloqfuxkzc");
});

test("the external backend requires account sign-in", () => {
  expect(AUTH_ENABLED).toBe(true);
});