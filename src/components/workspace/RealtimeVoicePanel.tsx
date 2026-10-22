import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, MicOff, PhoneOff, Volume2, X, MessageSquare, Video, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { freshAccessToken } from "@/lib/session-token";

type TranscriptLine = { id: string; role: "You" | "TeraXGPT"; text: string };

export function RealtimeVoicePanel({ onClose }: { onClose: () => void }) {
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [statusText, setStatusText] = useState("Ready when you are");
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
    setConnected(false); setConnecting(false); setMuted(false);
  }

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      channelRef.current?.close(); peerRef.current?.close();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function handleEvent(raw: string) {
    let event: Record<string, unknown>;
    try { event = JSON.parse(raw) as Record<string, unknown>; } catch { return; }
    const type = String(event.type ?? "");
    if (type === "session.created" || type === "session.updated" || type === "response.done") setStatusText("Listening");
    else if (type === "input_audio_buffer.speech_started") setStatusText("I'm listening…");
    else if (type === "response.created") setStatusText("TeraXGPT is speaking");
    else if (type === "conversation.item.input_audio_transcription.completed") {
      const text = String(event.transcript ?? "").trim();
      if (text) setTranscript((items) => [...items, { id: crypto.randomUUID(), role: "You", text }]);
    } else if (type === "response.output_audio_transcript.done") {
      const text = String(event.transcript ?? "").trim();
      if (text) setTranscript((items) => [...items, { id: crypto.randomUUID(), role: "TeraXGPT", text }]);
    } else if (type === "error") {
      const error = event.error as { message?: string } | undefined;
      toast.error(error?.message ?? "Realtime voice encountered an error.");
      setStatusText("Something went wrong");
    }
  }

  async function connect() {
    if (connecting || connected) return;
    setConnecting(true); setStatusText("Connecting…");
    try {
      const token = await freshAccessToken();
      const sessionResponse = await fetch("/api/realtime-session", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const sessionData = (await sessionResponse.json().catch(() => ({}))) as { clientSecret?: string; error?: string };
      if (!sessionResponse.ok || !sessionData.clientSecret) throw new Error(sessionData.error ?? "Could not create a realtime voice session.");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      streamRef.current = stream;
      const peer = new RTCPeerConnection(); peerRef.current = peer;
      const audio = audioRef.current;
      if (!audio) throw new Error("Audio output is not available.");
      peer.ontrack = (event) => { audio.srcObject = event.streams[0] ?? null; void audio.play().catch(() => setStatusText("Tap to enable audio playback")); };
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
      const channel = peer.createDataChannel("oai-events"); channelRef.current = channel;
      channel.onmessage = (event) => handleEvent(String(event.data));
      channel.onopen = () => { if (!aliveRef.current) return; setConnected(true); setConnecting(false); setStatusText("Listening"); };
      channel.onclose = () => { if (aliveRef.current) setStatusText("Connection closed"); };
      const offer = await peer.createOffer(); await peer.setLocalDescription(offer);
      const sdpResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST", body: offer.sdp,
        headers: { Authorization: `Bearer ${sessionData.clientSecret}`, "Content-Type": "application/sdp" },
      });
      if (!sdpResponse.ok) throw new Error("Could not establish realtime audio. Check network access and OpenAI project settings.");
      await peer.setRemoteDescription({ type: "answer", sdp: await sdpResponse.text() });
    } catch (error) {
      cleanup();
      const message = error instanceof Error ? error.message : "Could not start realtime voice.";
      setStatusText(message); toast.error(message);
    } finally { if (aliveRef.current) setConnecting(false); }
  }

  function toggleMute() {
    const next = !muted;
    streamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !next; });
    setMuted(next); setStatusText(next ? "Microphone muted" : "Listening");
  }

  return (
    <section className="absolute inset-0 z-30 flex min-h-0 flex-col overflow-hidden bg-[#030407] text-white" aria-label="Realtime voice conversation">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[58%] bg-[radial-gradient(ellipse_at_50%_100%,rgba(35,91,255,0.38),rgba(12,26,76,0.24)_38%,transparent_72%)]" />
      <header className="relative z-10 flex items-center justify-between px-5 py-4 sm:px-7">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="rounded-full text-white hover:bg-white/10" onClick={onClose} aria-label="Back to chat"><X /></Button>
          <div><p className="text-sm font-medium">Live interaction</p><p className="text-xs text-white/50">{connected ? "Realtime connection" : connecting ? "Connecting securely" : "Voice conversation"}</p></div>
        </div>
        <Button variant="ghost" size="icon" className="rounded-full text-white hover:bg-white/10" onClick={() => setTranscriptOpen((value) => !value)} aria-label="Toggle transcript"><MessageSquare /></Button>
      </header>
      <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center px-6 pb-28 text-center">
        <div className="relative mb-8 grid size-28 place-items-center sm:size-36">
          {(connected || connecting) && <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-2xl animate-pulse" />}
          <div className={`voice-orb relative grid size-24 place-items-center rounded-full sm:size-32 ${connected ? "voice-orb-active" : ""} ${connecting ? "animate-pulse" : ""}`}>
            {connecting ? <Loader2 className="size-8 animate-spin text-white" /> : <span className="block size-10 rounded-full bg-white/10 blur-md sm:size-14" />}
          </div>
        </div>
        <h1 className="max-w-xl text-3xl font-medium tracking-tight text-white/95 sm:text-5xl">{connected ? "I'm here." : connecting ? "Getting ready…" : "What’s on your mind?"}</h1>
        <p className="mt-3 max-w-md text-sm text-white/55 sm:text-base">{connected ? statusText : "Talk naturally. You can interrupt TeraXGPT at any time."}</p>
        {!connected && !connecting && <Button onClick={() => void connect()} className="mt-7 rounded-full bg-white px-6 text-black hover:bg-white/90"><Mic className="mr-2 size-4" /> Start talking</Button>}
        {transcriptOpen && <div className="mt-6 max-h-48 w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-black/35 p-4 text-left backdrop-blur-xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/45">Live transcript</p>
          {transcript.length ? transcript.map((line) => <p key={line.id} className="mb-2 text-sm leading-relaxed"><span className="mr-2 text-white/45">{line.role}:</span>{line.text}</p>) : <p className="text-sm text-white/45">Your conversation transcript will appear here.</p>}
        </div>}
      </div>
      <div className="relative z-10 flex items-center justify-center gap-3 px-4 pb-7 sm:gap-5 sm:pb-9">
        <Button variant="ghost" size="icon" className="size-12 rounded-full border border-white/10 bg-white/[0.08] text-white hover:bg-white/15 sm:size-14" onClick={() => toast.info("Video is not part of this audio-only session yet.")} aria-label="Video (not enabled)" title="Audio-only session"><Video /></Button>
        <Button variant="ghost" size="icon" className="size-12 rounded-full border border-white/10 bg-white/[0.08] text-white hover:bg-white/15 sm:size-14" onClick={() => setTranscriptOpen((value) => !value)} aria-label="Show transcript"><Share2 /></Button>
        <div className="mx-1 grid size-20 place-items-center rounded-full border border-blue-300/20 bg-[radial-gradient(ellipse_at_50%_70%,rgba(84,173,255,0.95),rgba(33,83,190,0.7)_32%,rgba(7,11,25,0.98)_72%)] shadow-[0_0_42px_rgba(46,110,255,0.25)] sm:mx-3 sm:size-24">{connecting ? <Loader2 className="size-7 animate-spin" /> : <Volume2 className="size-7 text-white/90" />}</div>
        <Button variant="ghost" size="icon" className={`size-12 rounded-full border border-white/10 text-white hover:bg-white/15 sm:size-14 ${muted ? "bg-red-500/25" : "bg-white/[0.08]"}`} onClick={toggleMute} disabled={!connected} aria-label={muted ? "Unmute microphone" : "Mute microphone"}>{muted ? <MicOff /> : <Mic />}</Button>
        <Button variant="ghost" size="icon" className="size-12 rounded-full border border-white/10 bg-white/[0.08] text-white hover:bg-red-500/20 sm:size-14" onClick={() => { cleanup(); setStatusText("Session ended. Start talking to reconnect."); }} disabled={!connected} aria-label="End conversation"><PhoneOff /></Button>
      </div>
      <audio ref={audioRef} autoPlay className="hidden" />
      <style>{`
        .voice-orb { background: conic-gradient(from 215deg, #23d5ab, #3988ff 26%, #8d5bff 47%, #ff4d8d 66%, #ffcf56 82%, #23d5ab); filter: saturate(1.12); box-shadow: inset 0 0 24px rgba(255,255,255,.2), 0 0 48px rgba(61,105,255,.18); animation: orb-breathe 4s ease-in-out infinite; }
        .voice-orb::after { content: ""; position: absolute; inset: 3px; border-radius: 9999px; background: radial-gradient(circle at 35% 28%, rgba(255,255,255,.7), rgba(255,255,255,.08) 18%, rgba(3,5,15,.5) 58%, rgba(2,3,8,.9)); mix-blend-mode: soft-light; }
        .voice-orb-active { animation-duration: 1.8s; box-shadow: inset 0 0 24px rgba(255,255,255,.25), 0 0 58px rgba(61,105,255,.42); }
        @keyframes orb-breathe { 0%,100% { transform: scale(.96) rotate(-8deg); } 50% { transform: scale(1.04) rotate(8deg); } }
        @media (prefers-reduced-motion: reduce) { .voice-orb, .voice-orb-active { animation: none; } }
      `}</style>
    </section>
  );
}
