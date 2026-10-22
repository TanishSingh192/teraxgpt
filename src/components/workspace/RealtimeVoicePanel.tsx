import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, MicOff, PhoneOff, Volume2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { freshAccessToken } from "@/lib/session-token";

type TranscriptLine = { id: string; role: "You" | "TeraXGPT"; text: string };

export function RealtimeVoicePanel({ onClose }: { onClose: () => void }) {
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [statusText, setStatusText] = useState("Start a private realtime voice session.");
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const aliveRef = useRef(true);

  function cleanup() {
    channelRef.current?.close();
    channelRef.current = null;
    peerRef.current?.close();
    peerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (audioRef.current) audioRef.current.srcObject = null;
    setConnected(false);
    setConnecting(false);
    setMuted(false);
  }

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      channelRef.current?.close();
      peerRef.current?.close();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function handleEvent(raw: string) {
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return;
    }
    const type = String(event.type ?? "");
    if (type === "session.created" || type === "session.updated") {
      setStatusText("Listening. Speak naturally; the assistant can be interrupted.");
    } else if (type === "input_audio_buffer.speech_started") {
      setStatusText("Listening to you…");
    } else if (type === "response.created") {
      setStatusText("TeraXGPT is responding…");
    } else if (type === "response.done") {
      setStatusText("Listening. You can keep talking.");
    } else if (type === "conversation.item.input_audio_transcription.completed") {
      const text = String(event.transcript ?? "").trim();
      if (text) setTranscript((items) => [...items, { id: crypto.randomUUID(), role: "You", text }]);
    } else if (type === "response.output_audio_transcript.done") {
      const text = String(event.transcript ?? "").trim();
      if (text) setTranscript((items) => [...items, { id: crypto.randomUUID(), role: "TeraXGPT", text }]);
    } else if (type === "error") {
      const error = event.error as { message?: string } | undefined;
      toast.error(error?.message ?? "Realtime voice encountered an error.");
      setStatusText("Something went wrong. You can reconnect.");
    }
  }

  async function connect() {
    if (connecting || connected) return;
    setConnecting(true);
    setStatusText("Connecting microphone and realtime audio…");
    try {
      const token = await freshAccessToken();
      const sessionResponse = await fetch("/api/realtime-session", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const sessionData = (await sessionResponse.json().catch(() => ({}))) as {
        clientSecret?: string;
        error?: string;
      };
      if (!sessionResponse.ok || !sessionData.clientSecret) {
        throw new Error(sessionData.error ?? "Could not create a realtime voice session.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      const peer = new RTCPeerConnection();
      peerRef.current = peer;
      const audio = audioRef.current;
      if (!audio) throw new Error("Audio output is not available.");
      peer.ontrack = (event) => {
        audio.srcObject = event.streams[0] ?? null;
        void audio.play().catch(() => setStatusText("Tap the page once to allow audio playback."));
      };
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));

      const channel = peer.createDataChannel("oai-events");
      channelRef.current = channel;
      channel.onmessage = (event) => handleEvent(String(event.data));
      channel.onopen = () => {
        if (!aliveRef.current) return;
        setConnected(true);
        setConnecting(false);
        setStatusText("Listening. Speak naturally; the assistant can be interrupted.");
      };
      channel.onclose = () => {
        if (aliveRef.current) setStatusText("Voice connection closed.");
      };

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      const sdpResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${sessionData.clientSecret}`,
          "Content-Type": "application/sdp",
        },
      });
      if (!sdpResponse.ok) {
        throw new Error("Could not establish realtime audio. Check network access and OpenAI project settings.");
      }
      await peer.setRemoteDescription({ type: "answer", sdp: await sdpResponse.text() });
    } catch (error) {
      cleanup();
      const message = error instanceof Error ? error.message : "Could not start realtime voice.";
      setStatusText(message);
      toast.error(message);
    } finally {
      if (aliveRef.current) setConnecting(false);
    }
  }

  function toggleMute() {
    const next = !muted;
    streamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !next; });
    setMuted(next);
    setStatusText(next ? "Microphone muted." : "Microphone live. Speak naturally.");
  }

  return (
    <section className="absolute inset-0 z-30 flex flex-col bg-panel" aria-label="Realtime voice conversation">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <div className="grid size-9 place-items-center rounded-xl bg-ink text-primary-foreground"><Volume2 className="size-4" /></div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">Live voice</h2>
          <p className="text-xs text-subtle">{connected ? "Realtime audio connected" : connecting ? "Connecting…" : "Not connected"}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => { cleanup(); onClose(); }} aria-label="Close live voice"><X /></Button>
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
        <div className="mx-auto flex max-w-2xl flex-col gap-5">
          <div className="rounded-2xl border border-line bg-background p-5 text-center">
            <div className={`mx-auto mb-3 grid size-16 place-items-center rounded-full ${connected ? "bg-signal-soft text-ink" : "bg-panel text-subtle"}`}>
              {connecting ? <Loader2 className="size-7 animate-spin" /> : connected ? <Volume2 className="size-7" /> : <Mic className="size-7" />}
            </div>
            <p className="text-sm font-medium">{statusText}</p>
            <p className="mt-2 text-xs text-subtle">Audio is streamed directly between your browser and the realtime provider. The server issues a short-lived session secret.</p>
            <div className="mt-4 flex justify-center gap-2">
              {!connected ? (
                <Button onClick={() => void connect()} disabled={connecting}><Mic /> {connecting ? "Connecting…" : "Start conversation"}</Button>
              ) : (
                <>
                  <Button variant="secondary" onClick={toggleMute}><MicOff /> {muted ? "Unmute" : "Mute"}</Button>
                  <Button variant="destructive" onClick={() => { cleanup(); setStatusText("Session ended. Start again to reconnect."); }}><PhoneOff /> End session</Button>
                </>
              )}
            </div>
          </div>
          {transcript.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-subtle">Transcript · this session</h3>
              {transcript.map((line) => (
                <div key={line.id} className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${line.role === "You" ? "ml-auto bg-background" : "mr-auto border border-line"}`}>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-subtle">{line.role}</p>
                  <p className="whitespace-pre-wrap">{line.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <audio ref={audioRef} autoPlay className="hidden" />
    </section>
  );
}
