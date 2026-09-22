// Image generation through the Lovable AI Gateway (server-only).
export const IMAGE_MODEL = "openai/gpt-image-2.5-sunburst";

const BASE_URL = "https://ai.gateway.lovable.dev";

type ImageResponse = {
  data?: { b64_json?: string }[];
  error?: { message?: string };
};

/** Generates one image and returns raw PNG bytes. Throws with the gateway's message on failure. */
export async function generateImageBytes(
  apiKey: string,
  prompt: string,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const response = await fetch(`${BASE_URL}/v1/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({ model: IMAGE_MODEL, prompt }),
    signal: signal ?? null,
  });

  const body = (await response.json().catch(() => null)) as ImageResponse | null;
  if (!response.ok) {
    throw new Error(body?.error?.message ?? `Image generation failed (${response.status}).`);
  }

  const b64 = body?.data?.[0]?.b64_json;
  if (!b64) throw new Error("The image model returned no image.");

  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
