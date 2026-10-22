import { createHash } from "node:crypto";

export type McpTool = {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
};

type JsonRpc = { jsonrpc: "2.0"; id: number; method: string; params?: unknown };

function encryptionKey() {
  const secret = process.env["CONNECTOR_ENCRYPTION_KEY"];
  if (!secret) throw new Error("CONNECTOR_ENCRYPTION_KEY is not configured.");
  return createHash("sha256").update(secret).digest();
}

export async function encryptConnectorToken(token: string): Promise<string> {
  const keyBytes = encryptionKey();
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(token));
  return `v1.${Buffer.from(iv).toString("base64url")}.${Buffer.from(encrypted).toString("base64url")}`;
}

export async function decryptConnectorToken(value: string | null): Promise<string | undefined> {
  if (!value) return undefined;
  const [version, ivPart, dataPart] = value.split(".");
  if (version !== "v1" || !ivPart || !dataPart) throw new Error("Stored connector credential is invalid.");
  const key = await crypto.subtle.importKey("raw", encryptionKey(), "AES-GCM", false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: Buffer.from(ivPart, "base64url") },
    key,
    Buffer.from(dataPart, "base64url"),
  );
  return new TextDecoder().decode(plain);
}

/** Basic SSRF guard. Remote MCP endpoints must be public HTTPS hosts, never internal addresses. */
export function validateMcpEndpoint(raw: string): URL {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("Enter a valid MCP endpoint URL."); }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (url.protocol !== "https:" || url.username || url.password || url.port ||
      host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") ||
      host.endsWith(".internal") || host === "metadata.google.internal" ||
      /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host) || host.includes(":") ||
      /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    throw new Error("MCP endpoints must use a public HTTPS hostname.");
  }
  return url;
}

async function rpc(endpoint: string, token: string | undefined, message: JsonRpc, sessionId?: string) {
  const url = validateMcpEndpoint(endpoint);
  const headers = new Headers({
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
  });
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (sessionId) headers.set("mcp-session-id", sessionId);
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(message),
    signal: AbortSignal.timeout(12_000),
    redirect: "error",
  });
  if (!response.ok) throw new Error(`MCP server returned HTTP ${response.status}.`);
  const contentType = response.headers.get("content-type") ?? "";
  let payload: unknown;
  if (contentType.includes("text/event-stream")) {
    const text = await response.text();
    const data = text.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).filter(Boolean);
    const last = data.at(-1);
    if (!last) throw new Error("MCP server returned an empty event stream.");
    payload = JSON.parse(last);
  } else {
    payload = await response.json();
  }
  const result = payload as { result?: unknown; error?: { message?: string } };
  if (result.error) throw new Error(result.error.message ?? "MCP request failed.");
  return { payload: result.result, sessionId: response.headers.get("mcp-session-id") ?? sessionId };
}

export async function listMcpTools(endpoint: string, token?: string): Promise<McpTool[]> {
  const init = await rpc(endpoint, token, {
    jsonrpc: "2.0", id: 1, method: "initialize",
    params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "TeraXGPT", version: "1.0.0" } },
  });
  const sessionId = init.sessionId;
  const headers = new Headers({ "content-type": "application/json", accept: "application/json, text/event-stream" });
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (sessionId) headers.set("mcp-session-id", sessionId);
  await fetch(validateMcpEndpoint(endpoint), {
    method: "POST", headers,
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    signal: AbortSignal.timeout(12_000), redirect: "error",
  });
  const listed = await rpc(endpoint, token, { jsonrpc: "2.0", id: 2, method: "tools/list" }, sessionId);
  const tools = (listed.payload as { tools?: unknown } | undefined)?.tools;
  if (!Array.isArray(tools)) return [];
  return tools.filter((t): t is McpTool =>
    Boolean(t) && typeof t === "object" &&
    typeof (t as McpTool).name === "string" &&
    /^[a-zA-Z0-9_.-]{1,100}$/.test((t as McpTool).name),
  ).slice(0, 100);
}

export async function callMcpTool(endpoint: string, token: string | undefined, name: string, args: unknown) {
  const init = await rpc(endpoint, token, {
    jsonrpc: "2.0", id: 1, method: "initialize",
    params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "TeraXGPT", version: "1.0.0" } },
  });
  const headers = new Headers({ "content-type": "application/json", accept: "application/json, text/event-stream" });
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (init.sessionId) headers.set("mcp-session-id", init.sessionId);
  await fetch(validateMcpEndpoint(endpoint), {
    method: "POST", headers,
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    signal: AbortSignal.timeout(12_000), redirect: "error",
  });
  const result = await rpc(endpoint, token, {
    jsonrpc: "2.0", id: 2, method: "tools/call", params: { name, arguments: args },
  }, init.sessionId);
  return result.payload;
}
