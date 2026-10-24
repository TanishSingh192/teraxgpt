import { useRef, useState } from "react";
import { Download, Eraser, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CanvasStudio({ onClose, onUsePrompt }: { onClose: () => void; onUsePrompt: (prompt: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [color, setColor] = useState("#6d5dfc");
  const [brushSize, setBrushSize] = useState(4);

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * (canvas.width / rect.width), y: (event.clientY - rect.top) * (canvas.height / rect.height) };
  }
  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const p = point(event);
    if (!canvas || !p) return;
    drawing.current = true;
    canvas.setPointerCapture(event.pointerId);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = color; ctx.lineWidth = brushSize;
  }
  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const p = point(event); const ctx = canvasRef.current?.getContext("2d");
    if (!p || !ctx) return;
    ctx.lineTo(p.x, p.y); ctx.stroke();
  }
  function clear() {
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  }
  function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a"); link.download = "teraxgpt-canvas.png"; link.href = canvas.toDataURL("image/png"); link.click();
  }
  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 p-2 sm:p-6" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="canvas-studio-title" className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-5"><div className="min-w-0 flex-1"><h2 id="canvas-studio-title" className="font-display text-lg font-semibold">Canvas</h2><p className="text-xs text-subtle">Sketch ideas, diagrams, or rough layouts. Export your canvas or ask TeraXGPT to develop it.</p></div><Button variant="ghost" size="icon" onClick={onClose} aria-label="Close canvas"><X /></Button></header>
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <label className="flex items-center gap-2 text-xs text-subtle">Ink <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="size-7 cursor-pointer rounded border-0 bg-transparent" /></label>
        <label className="flex items-center gap-2 text-xs text-subtle">Brush <input type="range" min="1" max="18" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} /></label>
        <Button variant="outline" size="sm" onClick={clear}><Eraser /> Clear</Button>
        <Button variant="outline" size="sm" onClick={download}><Download /> Export PNG</Button>
        <div className="flex-1" />
        <Button size="sm" onClick={() => { onUsePrompt("Use this sketch as the visual reference for my next task. Help me interpret and develop it."); onClose(); }}>Use in chat</Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-[#f7f8fc] p-3 sm:p-5"><canvas ref={canvasRef} width={1600} height={900} onPointerDown={start} onPointerMove={move} onPointerUp={() => { drawing.current = false; }} onPointerCancel={() => { drawing.current = false; }} onPointerLeave={() => { drawing.current = false; }} aria-label="Drawing canvas" className="mx-auto block h-auto w-full max-w-5xl touch-none rounded-xl border border-slate-200 bg-white shadow-sm" /></div>
    </section>
  </div>;
}
