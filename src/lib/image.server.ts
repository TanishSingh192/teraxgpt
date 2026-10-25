// Image generation through Google's Gemini API (server-only).
// Uses the same GEMINI_API_KEY / GOOGLE_API_KEY configuration as chat and PPT generation.
export const IMAGE_MODEL = "gemini-3.1-flash-image";

type GeminiImageResponse = {
  output_image?: { data?: string; mime_type?: string };
  output?: Array<{ type?: string; data?: string; mime_type?: string }>;
  error?: { message?: string; status?: string };
};

/** Generate one image using Gemini's Interactions API and return raw image bytes. */
export async function generateImageBytes(
  apiKey: string,
  prompt: string,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      input: prompt,
      response_format: {
        type: "image",
        mime_type: "image/png",
        aspect_ratio: "1:1",
        image_size: "1K",
      },
    }),
    signal: signal ?? null,
  });

  const body = (await response.json().catch(() => null)) as GeminiImageResponse | null;
  if (!response.ok) {
    const message = body?.error?.message ?? `Gemini image generation failed (${response.status}).`;
    if (response.status === 401 || response.status === 403) {
      throw new Error("Gemini rejected the API key or this project is not eligible for the selected image model. Check GEMINI_API_KEY and Google AI Studio model access.");
    }
    if (response.status === 429) {
      throw new Error("Gemini image-generation quota is exhausted or rate-limited. Check Google AI Studio usage and retry after the quota resets.");
    }
    throw new Error(message);
  }

  const image = body?.output_image ?? body?.output?.filter((part) => part.type === "image").at(-1);
  if (!image?.data) throw new Error("Gemini returned no image. Try a more specific prompt or verify image-model access.");
  const binary = atob(image.data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
