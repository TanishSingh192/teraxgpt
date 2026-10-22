// Server-only web research helpers backed by the Firecrawl connector (gateway mode).

const GATEWAY = "https://connector-gateway.lovable.dev/firecrawl/v2";

function keys() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["FIRECRAWL_API_KEY"];
  if (!lovableKey || !connectionKey) {
    throw new Error("Web research is not configured.");
  }
  return { lovableKey, connectionKey };
}

async function call(path: string, body: unknown) {
  const { lovableKey, connectionKey } = keys();
  const response = await fetch(`${GATEWAY}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connectionKey,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    // Avoid logging or exposing upstream response bodies, which may contain user data.
    console.error(`Firecrawl ${path} failed [${response.status}]`);
    throw new Error(`Web request failed [${response.status}]`);
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("Web research provider returned an invalid response.");
  }
}

function validatePublicWebUrl(input: string): string {
  let url: URL;
  try { url = new URL(input); } catch { throw new Error("Enter a valid public webpage URL."); }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Only HTTP and HTTPS webpages can be opened.");
  if (url.username || url.password || (url.port && url.port !== "80" && url.port !== "443")) throw new Error("That webpage URL is not allowed.");
  const host = url.hostname.toLowerCase().replace(/^\\[|\\]$/g, "");
  const blocked = !host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") ||
    host === "metadata.google.internal" || host === "metadata.google" || host === "169.254.169.254" || host === "0.0.0.0" || host === "::" || host === "::1" ||
    /^127\\./.test(host) || /^10\\./.test(host) || /^192\\.168\\./.test(host) || /^169\\.254\\./.test(host) ||
    /^172\\.(1[6-9]|2\\d|3[01])\\./.test(host) || /^\\d{1,3}(\\.\\d{1,3}){3}$/.test(host) || host.includes(":");
  if (blocked) throw new Error("Private, local, and IP-literal URLs cannot be opened.");
  url.hash = "";
  return url.toString();
}
export type SearchHit = { url: string; title: string; snippet: string };

export async function webSearch(query: string, limit = 5): Promise<SearchHit[]> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery || normalizedQuery.length > 500) throw new Error("Search queries must contain 1–500 characters.");
  const safeLimit = Math.max(1, Math.min(10, Math.floor(limit)));
  const result = await call("/search", { query: normalizedQuery, limit: safeLimit });
  const rows = (result["data"] as unknown) ?? [];
  const list = Array.isArray(rows)
    ? rows
    : Array.isArray((rows as { web?: unknown[] }).web)
      ? ((rows as { web: unknown[] }).web as unknown[])
      : [];
  return list.slice(0, safeLimit).map((raw) => {
    const row = raw as Record<string, unknown>;
    return {
      url: String(row["url"] ?? ""),
      title: String(row["title"] ?? row["url"] ?? "Untitled"),
      snippet: String(row["description"] ?? row["snippet"] ?? "").slice(0, 400),
    };
  });
}

export type PageContent = { url: string; title: string; text: string };

export async function openPage(url: string, maxChars = 12_000): Promise<PageContent> {
  const safeUrl = validatePublicWebUrl(url);
  const result = await call("/scrape", { url: safeUrl, formats: ["markdown"], onlyMainContent: true });
  const data = (result["data"] as Record<string, unknown> | undefined) ?? result;
  const metadata = (data["metadata"] as Record<string, unknown> | undefined) ?? {};
  const markdown = String(data["markdown"] ?? "");
  return {
    url: String(metadata["sourceURL"] ?? safeUrl),
    title: String(metadata["title"] ?? safeUrl),
    text: markdown.slice(0, Math.max(1, Math.min(20_000, maxChars))),
  };
}
