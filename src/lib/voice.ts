// Browser-side voice capture and streaming playback.
import { createParser } from "eventsource-parser";

import { freshAccessToken } from "@/lib/session-token";

/** Voice runs on the user's own account, so every call carries their session. */
async function authHeaders(): Promise<Record<string, string>> {
  return { Authorization: `Bearer ${await freshAccessToken()}` };
}

function encodeWav(chunks: readonly Float32Array[], sampleRate: number): Blob {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const bytes = new ArrayBuffer(44 + length * 2);
  const view = new DataView(bytes);
  const tag = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  tag(0, "RIFF");
  view.setUint32(4, 36 + length * 2, true);
  tag(8, "WAVE");
  tag(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  tag(36, "data");
  view.setUint32(40, length * 2, true);
  let offset = 44;
  for (const chunk of chunks)
    for (const value of chunk) {
      const sample = Math.max(-1, Math.min(1, value));
      view.setInt16(offset, sample * (sample < 0 ? 32768 : 32767), true);
      offset += 2;
    }
  return new Blob([bytes], { type: "audio/wav" });
}

export async function startRecording(): Promise<{ stop: () => Promise<File>; cancel: () => void }> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  let context: AudioContext | undefined;
  try {
    context = new AudioContext();
    await context.resume();
    const audioContext = context;
    const source = audioContext.createMediaStreamSource(stream);
    const node = audioContext.createScriptProcessor(4096, 1, 1);
    const chunks: Float32Array[] = [];
    node.onaudioprocess = (event) =>
      chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
    source.connect(node);
    node.connect(audioContext.destination);
    let stopped = false;
    const teardown = () => {
      stopped = true;
      stream.getTracks().forEach((track) => track.stop());
      node.disconnect();
      source.disconnect();
      node.onaudioprocess = null;
    };
    return {
      async stop() {
        if (stopped) throw new Error("Recording already stopped");
        teardown();
        const blob = encodeWav(chunks, audioContext.sampleRate);
        await audioContext.close();
        if (blob.size < 2048) throw new Error("That recording was empty. Please try again.");
        return new File([blob], "recording.wav", { type: "audio/wav" });
      },
      cancel() {
        if (stopped) return;
        teardown();
        void audioContext.close();
      },
    };
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop());
    await context?.close();
    throw error;
  }
}

export async function transcribeAudio(file: File, signal?: AbortSignal): Promise<string> {
  const form = new FormData();
  form.append("file", file, file.name);
  const response = await fetch("/api/transcribe", {
    method: "POST",
    headers: await authHeaders(),
    body: form,
    ...(signal ? { signal } : {}),
  });
  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => "");
    throw new Error(detail || "Could not transcribe that recording.");
  }

  let transcript = "";
  let done = false;
  const parser = createParser({
    onEvent(event) {
      if (event.data === "[DONE]") return;
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(event.data) as Record<string, unknown>;
      } catch {
        return;
      }
      if (payload["type"] === "transcript.text.delta") {
        transcript += String(payload["delta"] ?? "");
      }
      if (payload["type"] === "transcript.text.done") {
        transcript = String(payload["text"] ?? transcript);
        done = true;
      }
      if (typeof payload["text"] === "string" && !payload["type"]) {
        transcript = String(payload["text"]);
        done = true;
      }
    },
  });

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let raw = "";
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      raw += next.value;
      parser.feed(next.value);
    }
    parser.reset({ consume: true });
  } finally {
    reader.releaseLock();
  }

  if (!done && !transcript) {
    try {
      transcript = String((JSON.parse(raw) as { text?: string }).text ?? "");
    } catch {
      /* fall through */
    }
  }
  if (!transcript.trim()) throw new Error("No speech was detected in that recording.");
  return transcript.trim();
}

function decodePCM(pending: Uint8Array, incoming: Uint8Array) {
  const bytes = new Uint8Array(pending.length + incoming.length);
  bytes.set(pending);
  bytes.set(incoming, pending.length);
  const usable = bytes.length - (bytes.length % 2);
  const view = new DataView(bytes.buffer);
  const samples = new Float32Array(usable / 2);
  for (let i = 0; i < samples.length; i++) samples[i] = view.getInt16(i * 2, true) / 32768;
  return { samples, pending: bytes.slice(usable) };
}

/** Streams spoken audio and plays it. Aborting the signal interrupts playback immediately. */
export async function speak(text: string, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  const context = new AudioContext({ sampleRate: 24000 });
  const sources = new Set<AudioBufferSourceNode>();
  let playhead = 0;
  let pending = new Uint8Array(0);
  let completed = false;
  const controller = new AbortController();
  const abort = () => {
    controller.abort();
    for (const source of sources) {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
    }
  };
  signal.addEventListener("abort", abort, { once: true });
  const playbacks: Promise<void>[] = [];

  try {
    if (context.state === "suspended") await context.resume();
    const response = await fetch("/api/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ text: text.slice(0, 4000) }),
      signal: controller.signal,
    });
    if (!response.ok || !response.body) {
      const detail = await response.text().catch(() => "");
      throw new Error(detail || "Could not generate speech.");
    }

    const parser = createParser({
      onEvent(event) {
        let payload: { type?: string; audio?: string };
        try { payload = JSON.parse(event.data) as { type?: string; audio?: string }; }
        catch { return; }
        if (payload.type === "speech.audio.done") {
          completed = true;
          return;
        }
        if (payload.type !== "speech.audio.delta" || !payload.audio) return;
        let audioBytes: Uint8Array;
        try { audioBytes = Uint8Array.from(atob(payload.audio), (c) => c.charCodeAt(0)); }
        catch { return; }
        const decoded = decodePCM(pending, audioBytes);
        pending = new Uint8Array(decoded.pending);
        if (!decoded.samples.length) return;
        const buffer = context.createBuffer(1, decoded.samples.length, 24000);
        buffer.copyToChannel(decoded.samples, 0);
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(context.destination);
        sources.add(source);
        const playback = new Promise<void>((resolve) => {
          source.onended = () => {
            sources.delete(source);
            resolve();
          };
        });
        playbacks.push(playback);
        playhead = Math.max(playhead, context.currentTime + 0.05);
        source.start(playhead);
        playhead += buffer.duration;
      },
    });

    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    try {
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        parser.feed(next.value);
      }
      parser.reset({ consume: true });
    } finally {
      reader.releaseLock();
    }

    if (!completed) throw new Error("The spoken reply was cut short.");
    await Promise.all(playbacks);
  } finally {
    signal.removeEventListener("abort", abort);
    controller.abort();
    for (const source of sources) {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
    }
    await context.close();
  }
}
