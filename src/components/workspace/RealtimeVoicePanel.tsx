import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, MicOff, PhoneOff, Volume2, X, MessageSquare, Video, VideoOff, SwitchCamera } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { freshAccessToken } from "@/lib/session-token";

type TranscriptLine = { id: string; role: "You" | "TeraXGPT"; text: string };

const FRAME_INTERVAL_MS = 1000;
const FRAME_MAX_WIDTH = 768;

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Gemini Live sends JSON as binary WebSocket frames in browsers; decode any frame type to text. */
async function frameToText(data: unknown): Promise<string | null> {
  if (typeof data === "string") return data;
  if (data instanceof ArrayBuffer) return new TextDecoder().decode(data);
  if (data instanceof Blob) return await data.text();
  return null;
}

export function RealtimeVoicePanel({ onClose }: { onClose: () => void }) {
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [statusText, setStatusText] = useState("Ready when you are");
  const [cameraOn, setCameraOn] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const socketRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameTimerRef = useRef<number | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextAudioTimeRef = useRef(0);
  const aliveRef = useRef(true);
  const setupCompleteRef = useRef(false);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  function stopCamera() {
    if (frameTimerRef.current !== null) window.clearInterval(frameTimerRef.current);
    frameTimerRef.current = null;
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }

  function cleanup() {
    setupCompleteRef.current = false;
    mutedRef.current = false;
    stopCamera();
    for (const source of audioSourcesRef.current) { try { source.stop(); } catch { /* already stopped */ } }
    audioSourcesRef.current.clear();
    const socket = socketRef.current;
    socketRef.current = null;
    if (socket && socket.readyState < WebSocket.CLOSING) socket.close();
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    processorRef.current = null;
    sourceRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    const inputContext = inputContextRef.current;
    const outputContext = outputContextRef.current;
    inputContextRef.current = null;
    outputContextRef.current = null;
    if (inputContext && inputContext.state !== "closed") void inputContext.close();
    if (outputContext && outputContext.state !== "closed") void outputContext.close();
    setConnected(false);
    setConnecting(false);
    setMuted(false);
  }

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      if (frameTimerRef.current !== null) window.clearInterval(frameTimerRef.current);
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      socketRef.current?.close();
      processorRef.current?.disconnect();
      sourceRef.current?.disconnect();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (inputContextRef.current && inputContextRef.current.state !== "closed") void inputContextRef.current.close();
      if (outputContextRef.current && outputContextRef.current.state !== "closed") void outputContextRef.current.close();
    };
  }, []);

  function addTranscript(role: TranscriptLine["role"], text: string) {
    const clean = text.trim();
    if (!clean) return;
    setTranscript((items) => {
      const last = items[items.length - 1];
      // Transcriptions arrive in small chunks; merge consecutive chunks from the same speaker.
      if (last && last.role === role) return [...items.slice(0, -1), { ...last, text: `${last.text} ${clean}` }];
      return [...items, { id: crypto.randomUUID(), role, text: clean }];
    });
  }

  function handleMessage(message: Record<string, unknown>) {
    if ("setupComplete" in message) return;
    const serverContent = message["serverContent"] as Record<string, unknown> | undefined;
    const inputTranscription = (serverContent?.["inputTranscription"] ?? message["inputTranscription"]) as { text?: string } | undefined;
    const outputTranscription = (serverContent?.["outputTranscription"] ?? message["outputTranscription"]) as { text?: string } | undefined;
    if (inputTranscription?.text) addTranscript("You", inputTranscription.text);
    if (outputTranscription?.text) addTranscript("TeraXGPT", outputTranscription.text);
    if (serverContent) {
      if (serverContent["interrupted"]) {
        for (const source of audioSourcesRef.current) { try { source.stop(); } catch { /* already stopped */ } }
        audioSourcesRef.current.clear();
        nextAudioTimeRef.current = outputContextRef.current?.currentTime ?? 0;
        setStatusText("Listening");
      }
      if (serverContent["turnComplete"]) setStatusText("Listening");
      const modelTurn = serverContent["modelTurn"] as { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> } | undefined;
      for (const part of modelTurn?.parts ?? []) {
        const encoded = part.inlineData?.data;
        if (!encoded) continue;
        const context = outputContextRef.current;
        if (!context) continue;
        const bytes = base64ToBytes(encoded);
        const samples = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
        const audioBuffer = context.createBuffer(1, samples.length, 24000);
        const channel = audioBuffer.getChannelData(0);
        for (let i = 0; i < samples.length; i++) channel[i] = samples[i]! / 32768;
        const source = context.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(context.destination);
        audioSourcesRef.current.add(source);
        source.onended = () => audioSourcesRef.current.delete(source);
        const startAt = Math.max(context.currentTime + 0.02, nextAudioTimeRef.current);
        source.start(startAt);
        nextAudioTimeRef.current = startAt + audioBuffer.duration;
        setStatusText("Gemini is speaking");
      }
    }
    if (message["goAway"]) setStatusText("Session ending soon");
    if (message["error"]) {
      const error = message["error"] as { message?: string };
      toast.error(error.message ?? "Gemini Live encountered an error.");
      setStatusText("Something went wrong");
    }
  }

  function sendFrame() {
    const socket = socketRef.current;
    const video = videoRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN || !setupCompleteRef.current) return;
    if (!video || video.readyState < 2 || !video.videoWidth) return;
    const canvas = canvasRef.current ?? document.createElement("canvas");
    canvasRef.current = canvas;
    const scale = Math.min(1, FRAME_MAX_WIDTH / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
    const data = dataUrl.slice(dataUrl.indexOf(",") + 1);
    socket.send(JSON.stringify({ realtimeInput: { video: { mimeType: "image/jpeg", data } } }));
  }

  async function startCamera(mode: "user" | "environment") {
    try {
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      if (!aliveRef.current) { stream.getTracks().forEach((t) => t.stop()); return; }
      cameraStreamRef.current = stream;
      setCameraOn(true);
      // The <video> element renders once cameraOn is true; attach on next frame.
      requestAnimationFrame(() => {
        const video = videoRef.current;
        if (video) { video.srcObject = stream; void video.play().catch(() => undefined); }
      });
      if (frameTimerRef.current === null) frameTimerRef.current = window.setInterval(sendFrame, FRAME_INTERVAL_MS);
      setStatusText("Camera on — Gemini can see you");
    } catch {
      toast.error("Could not open the camera. Allow camera access in your browser and try again.");
      stopCamera();
    }
  }

  function toggleCamera() {
    if (cameraOn) { stopCamera(); setStatusText("Camera off"); return; }
    void startCamera(facingMode);
  }

  function flipCamera() {
    const next = facingMode === "user" ? "environment" : "user";
    setFacingMode(next);
    if (cameraOn) void startCamera(next);
  }

  async function connect() {
    if (connecting || connected) return;
    setConnecting(true);
    setupCompleteRef.current = false;
    setStatusText("Connecting to Gemini Live…");
    try {
      const token = await freshAccessToken();
      const sessionResponse = await fetch("/api/realtime-session", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const sessionData = (await sessionResponse.json().catch(() => ({}))) as { clientToken?: string; model?: string; instructions?: string; error?: string };
      if (!sessionResponse.ok || !sessionData.clientToken) {
        throw new Error(sessionData.error ?? "Could not create a Gemini Live session.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      const inputContext = new AudioContext({ sampleRate: 16000 });
      const outputContext = new AudioContext({ sampleRate: 24000 });
      inputContextRef.current = inputContext;
      outputContextRef.current = outputContext;
      await Promise.all([inputContext.resume(), outputContext.resume()]);

      const socket = new WebSocket(
        `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(sessionData.clientToken)}`,
      );
      socket.binaryType = "arraybuffer";
      socketRef.current = socket;

      let resolveSetup: () => void = () => undefined;
      let rejectSetup: (error: Error) => void = () => undefined;
      const setupDone = new Promise<void>((resolve, reject) => { resolveSetup = resolve; rejectSetup = reject; });

      socket.onmessage = async (event) => {
        const text = await frameToText(event.data);
        if (!text) return;
        let message: Record<string, unknown>;
        try { message = JSON.parse(text) as Record<string, unknown>; } catch { return; }
        if ("setupComplete" in message) { setupCompleteRef.current = true; resolveSetup(); return; }
        if (!setupCompleteRef.current && message["error"]) {
          const err = message["error"] as { message?: string };
          rejectSetup(new Error(err.message ?? "Gemini Live rejected the session setup."));
          return;
        }
        handleMessage(message);
      };
      socket.onerror = () => {
        if (aliveRef.current) setStatusText("Gemini connection failed");
      };
      socket.onclose = (event) => {
        if (!setupCompleteRef.current) rejectSetup(new Error(event.reason ? `Gemini Live closed: ${event.reason}` : "Gemini Live closed the connection."));
        if (aliveRef.current && socketRef.current === socket) {
          // A remote close must release the microphone, camera and audio graph too.
          cleanup();
          setStatusText(event.reason ? `Connection closed: ${event.reason}` : "Connection closed");
        }
      };
      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error("Timed out connecting to Gemini Live.")), 15000);
        socket.addEventListener("open", () => { window.clearTimeout(timeout); resolve(); }, { once: true });
        socket.addEventListener("error", () => { window.clearTimeout(timeout); reject(new Error("Gemini Live could not connect. Check your network.")); }, { once: true });
      });

      socket.send(JSON.stringify({
        setup: {
          model: sessionData.model ?? "models/gemini-3.8-live",
          generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } } } },
          systemInstruction: { parts: [{ text: sessionData.instructions ?? "You are TeraXGPT, a helpful voice assistant." }] },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
      }));

      await Promise.race([
        setupDone,
        new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("Gemini Live did not finish setting up. Try reconnecting.")), 15000)),
      ]);

      const source = inputContext.createMediaStreamSource(stream);
      const processor = inputContext.createScriptProcessor(4096, 1, 1);
      sourceRef.current = source;
      processorRef.current = processor;
      processor.onaudioprocess = (event) => {
        if (socket.readyState !== WebSocket.OPEN || !setupCompleteRef.current || mutedRef.current) return;
        const input = event.inputBuffer.getChannelData(0);
        const pcm = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          const sample = Math.max(-1, Math.min(1, input[i]!));
          pcm[i] = sample < 0 ? sample * 32768 : sample * 32767;
        }
        socket.send(JSON.stringify({
          realtimeInput: {
            audio: { mimeType: "audio/pcm;rate=16000", data: bytesToBase64(new Uint8Array(pcm.buffer)) },
          },
        }));
      };
      source.connect(processor);
      const silentOutput = inputContext.createGain();
      silentOutput.gain.value = 0;
      processor.connect(silentOutput);
      silentOutput.connect(inputContext.destination);
      setConnected(true);
      setConnecting(false);
      setStatusText(cameraStreamRef.current ? "Listening — camera on" : "Listening");
    } catch (error) {
      cleanup();
      const message = error instanceof Error ? error.message : "Could not start Gemini Live.";
      setStatusText(message);
      toast.error(message);
    } finally {
      if (aliveRef.current) setConnecting(false);
    }
  }

  function toggleMute() {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    setStatusText(next ? "Microphone muted" : "Listening");
  }

  return (
    <section className="absolute inset-0 z-30 flex min-h-0 flex-col overflow-hidden bg-[#030407] text-white" aria-label="Gemini Live voice conversation">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[58%] bg-[radial-gradient(ellipse_at_50%_100%,rgba(35,91,255,0.38),rgba(12,26,76,0.24)_38%,transparent_72%)]" />
      <header className="relative z-10 flex items-center justify-between px-5 py-4 sm:px-7">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="rounded-full text-white hover:bg-white/10" onClick={onClose} aria-label="Back to chat"><X /></Button>
          <div><p className="text-sm font-medium">Gemini Live</p><p className="text-xs text-white/50">{connected ? (cameraOn ? "Connected · camera on" : "Connected to Gemini") : connecting ? "Connecting securely" : "Voice and camera conversation"}</p></div>
        </div>
        <Button variant="ghost" size="icon" className="rounded-full text-white hover:bg-white/10" onClick={() => setTranscriptOpen((value) => !value)} aria-label="Toggle transcript"><MessageSquare /></Button>
      </header>
      <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center px-6 pb-28 text-center">
        {cameraOn ? (
          <div className="relative mb-6 w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-black shadow-2xl">
            <video ref={videoRef} autoPlay playsInline muted className={`aspect-[3/4] w-full object-cover sm:aspect-video ${facingMode === "user" ? "-scale-x-100" : ""}`} />
            <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium backdrop-blur"><span className="size-1.5 rounded-full bg-red-500 animate-pulse" />{connected ? "Gemini can see this" : "Camera preview"}</span>
            <Button variant="ghost" size="icon" className="absolute right-3 top-3 size-9 rounded-full bg-black/55 text-white hover:bg-black/70" onClick={flipCamera} aria-label="Switch camera"><SwitchCamera className="size-4" /></Button>
          </div>
        ) : (
          <div className="relative mb-8 grid size-28 place-items-center sm:size-36">
            {(connected || connecting) && <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-2xl animate-pulse" />}
            <div className={`voice-orb relative grid size-24 place-items-center rounded-full sm:size-32 ${connected ? "voice-orb-active" : ""} ${connecting ? "animate-pulse" : ""}`}>
              {connecting ? <Loader2 className="size-8 animate-spin text-white" /> : <span className="block size-10 rounded-full bg-white/10 blur-md sm:size-14" />}
            </div>
          </div>
        )}
        <h1 className={`max-w-xl font-medium tracking-tight text-white/95 ${cameraOn ? "text-2xl sm:text-3xl" : "text-3xl sm:text-5xl"}`}>{connected ? (cameraOn ? "Show me anything." : "I'm here.") : connecting ? "Getting ready…" : "What’s on your mind?"}</h1>
        <p className="mt-3 max-w-md text-sm text-white/55 sm:text-base">{connected ? statusText : "Talk naturally, turn on the camera to show Gemini things, and interrupt any time."}</p>
        {!connected && !connecting && <Button onClick={() => void connect()} className="mt-7 rounded-full bg-white px-6 text-black hover:bg-white/90"><Mic className="mr-2 size-4" /> Start talking</Button>}
        {transcriptOpen && <div className="mt-6 max-h-48 w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-black/35 p-4 text-left backdrop-blur-xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/45">Live transcript</p>
          {transcript.length ? transcript.map((line) => <p key={line.id} className="mb-2 text-sm leading-relaxed"><span className="mr-2 text-white/45">{line.role}:</span>{line.text}</p>) : <p className="text-sm text-white/45">Your conversation transcript will appear here.</p>}
        </div>}
      </div>
      <div className="relative z-10 flex items-center justify-center gap-3 px-4 pb-7 sm:gap-5 sm:pb-9">
        <Button variant="ghost" size="icon" className={`size-12 rounded-full border border-white/10 text-white hover:bg-white/15 sm:size-14 ${cameraOn ? "bg-blue-500/30" : "bg-white/[0.08]"}`} onClick={toggleCamera} aria-label={cameraOn ? "Turn camera off" : "Turn camera on"} title={cameraOn ? "Turn camera off" : "Turn camera on"}>{cameraOn ? <Video /> : <VideoOff />}</Button>
        <Button variant="ghost" size="icon" className="size-12 rounded-full border border-white/10 bg-white/[0.08] text-white hover:bg-white/15 sm:size-14" onClick={() => setTranscriptOpen((value) => !value)} aria-label="Show transcript"><MessageSquare /></Button>
        <div className="mx-1 grid size-20 place-items-center rounded-full border border-blue-300/20 bg-[radial-gradient(ellipse_at_50%_70%,rgba(84,173,255,0.95),rgba(33,83,190,0.7)_32%,rgba(7,11,25,0.98)_72%)] shadow-[0_0_42px_rgba(46,110,255,0.25)] sm:mx-3 sm:size-24">{connecting ? <Loader2 className="size-7 animate-spin" /> : <Volume2 className="size-7 text-white/90" />}</div>
        <Button variant="ghost" size="icon" className={`size-12 rounded-full border border-white/10 text-white hover:bg-white/15 sm:size-14 ${muted ? "bg-red-500/25" : "bg-white/[0.08]"}`} onClick={toggleMute} disabled={!connected} aria-label={muted ? "Unmute microphone" : "Mute microphone"}>{muted ? <MicOff /> : <Mic />}</Button>
        <Button variant="ghost" size="icon" className="size-12 rounded-full border border-white/10 bg-white/[0.08] text-white hover:bg-red-500/20 sm:size-14" onClick={() => { cleanup(); setStatusText("Session ended. Start talking to reconnect."); }} disabled={!connected} aria-label="End conversation"><PhoneOff /></Button>
      </div>
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
