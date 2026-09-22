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
    console.error(`Firecrawl ${path} failed [${response.status}]: ${text}`);
    throw new Error(`Web request failed [${response.status}]: ${text.slice(0, 400)}`);
  }
  return JSON.parse(text) as Record<string, unknown>;
}

export type SearchHit = { url: string; title: string; snippet: string };

export async function webSearch(query: string, limit = 5): Promise<SearchHit[]> {
  const result = await call("/search", { query, limit });
  const rows = (result["data"] as unknown) ?? [];
  const list = Array.isArray(rows)
    ? rows
    : Array.isArray((rows as { web?: unknown[] }).web)
      ? ((rows as { web: unknown[] }).web as unknown[])
      : [];
  return list.slice(0, limit).map((raw) => {
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
  const result = await call("/scrape", { url, formats: ["markdown"], onlyMainContent: true });
  const data = (result["data"] as Record<string, unknown> | undefined) ?? result;
  const metadata = (data["metadata"] as Record<string, unknown> | undefined) ?? {};
  const markdown = String(data["markdown"] ?? "");
  return {
    url: String(metadata["sourceURL"] ?? url),
    title: String(metadata["title"] ?? url),
    text: markdown.slice(0, maxChars),
  };
}
