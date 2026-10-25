/**
 * Verifies Firebase ID tokens on the server without firebase-admin
 * (firebase-admin needs a full Node runtime; this app runs on a Worker
 * runtime). Tokens are verified against Google's public certs using
 * Web Crypto, which is available in both dev and production.
 */

const GOOGLE_CERTS_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@google.com";

let certCache: { keys: Record<string, CryptoKey>; expiresAt: number } | null = null;

async function getGoogleCerts(): Promise<Record<string, CryptoKey>> {
  if (certCache && certCache.expiresAt > Date.now()) return certCache.keys;
  const res = await fetch(GOOGLE_CERTS_URL);
  if (!res.ok) throw new Error(`Could not load Google signing certs (${res.status})`);
  const cacheControl = res.headers.get("cache-control") ?? "";
  const maxAge = /max-age=(\d+)/.exec(cacheControl)?.[1];
  const certs = (await res.json()) as Record<string, string>;
  const keys: Record<string, CryptoKey> = {};
  for (const [kid, pem] of Object.entries(certs)) {
    const der = pem
      .replace(/-----BEGIN CERTIFICATE-----/, "")
      .replace(/-----END CERTIFICATE-----/, "")
      .replace(/\s/g, "");
    const binary = Uint8Array.from(atob(der), (c) => c.charCodeAt(0));
    keys[kid] = await crypto.subtle.importKey(
      "spki",
      binary.buffer,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    ).catch(async () => {
      // Some environments can't import x509 directly as spki; fall through.
      throw new Error("Unsupported certificate format");
    });
  }
  certCache = {
    keys,
    expiresAt: Date.now() + (maxAge ? Number(maxAge) * 1000 : 60 * 60 * 1000) - 60_000,
  };
  return keys;
}

function base64UrlDecode(input: string): Uint8Array {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

export interface FirebaseUser {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
}

export async function verifyFirebaseIdToken(
  idToken: string,
  projectId: string,
): Promise<FirebaseUser> {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("Malformed token");
  const [headerB64, payloadB64, signatureB64] = parts;

  const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(headerB64)));
  if (header.alg !== "RS256" || typeof header.kid !== "string") {
    throw new Error("Unsupported token header");
  }

  const certs = await getGoogleCerts();
  const key = certs[header.kid];
  if (!key) throw new Error("Unknown signing key");

  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = base64UrlDecode(signatureB64);
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    signature.buffer as ArrayBuffer,
    data.buffer as ArrayBuffer,
  );
  if (!valid) throw new Error("Invalid token signature");

  const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64)));
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) throw new Error("Token expired");
  if (payload.iat > now + 300) throw new Error("Token issued in the future");
  if (payload.aud !== projectId) throw new Error("Wrong audience");
  if (
    payload.iss !== `https://securetoken.google.com/${projectId}`
  ) {
    throw new Error("Wrong issuer");
  }
  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    throw new Error("Missing subject");
  }

  return {
    uid: payload.sub,
    email: typeof payload.email === "string" ? payload.email : undefined,
    name: typeof payload.name === "string" ? payload.name : undefined,
    picture: typeof payload.picture === "string" ? payload.picture : undefined,
  };
}

/** Extracts and verifies a Firebase ID token from an Authorization header. */
export async function requireFirebaseUser(request: Request): Promise<FirebaseUser> {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) throw new Error("Sign in to continue.");
  const projectId = process.env["VITE_FIREBASE_PROJECT_ID"] ?? "";
  if (!projectId) throw new Error("Firebase is not configured on the server.");
  return verifyFirebaseIdToken(token, projectId);
}
