import { useState } from "react";
import { Download, FileText, ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export type PresentationDeck = {
  title: string;
  subtitle: string;
  theme: { background: string; foreground: string; accent: string; muted: string };
  slides: Array<{ title: string; subtitle?: string; bullets: string[]; layout?: "title" | "content" | "closing"; speakerNotes?: string }>;
};
export type PresentationResult = { deck: PresentationDeck; pptxBase64: string; fileName: string; provider: string };

export function PresentationPreview({ result, onRefine, busy = false }: { result: PresentationResult; onRefine: (instruction: string) => void; busy?: boolean }) {
  const [active, setActive] = useState(0);
  const [refinement, setRefinement] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const slide = result.deck.slides[active];
  const bg = result.deck.theme.background || "#10182B";
  const fg = result.deck.theme.foreground || "#F5F7FB";
  const accent = result.deck.theme.accent || "#7C75FF";
  const muted = result.deck.theme.muted || "#AAB4C8";
  function download() {
    const binary = atob(result.pptxBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" }));
    const link = document.createElement("a");
    link.href = url; link.download = result.fileName; document.body.appendChild(link); link.click(); link.remove();
    URL.revokeObjectURL(url);
  }
  if (!slide) return null;
  return <section className="mt-5 overflow-hidden rounded-2xl border border-line bg-panel shadow-sm" aria-label="Generated PowerPoint">
    <header className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-500/10 text-indigo-500"><FileText /></div>
      <div className="min-w-0 flex-1"><h3 className="truncate text-sm font-semibold">{result.deck.title}</h3><p className="mt-0.5 text-[11px] text-subtle">{result.deck.slides.length} slides · Generated with {result.provider}</p></div>
      <Button size="sm" onClick={download}><Download className="size-4" /> Download .pptx</Button>
    </header>
    <div className="p-3 sm:p-5">
      <button type="button" onClick={() => setExpanded(true)} className="group relative block w-full overflow-hidden rounded-xl border border-white/10 text-left shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Enlarge slide preview">
        <div className="aspect-video p-[6%] sm:p-[7%]" style={{ background: bg, color: fg }}>
          <div className="mb-[3%] h-1 w-12 rounded-full" style={{ background: accent }} />
          {active === 0 && <p className="mb-2 text-[clamp(9px,1.3vw,14px)] uppercase tracking-[0.2em]" style={{ color: muted }}>TERAXGPT · PRESENTATION</p>}
          <h4 className={`max-w-[90%] font-semibold leading-tight ${active === 0 ? "text-[clamp(20px,4vw,42px)]" : "text-[clamp(16px,2.7vw,30px)]"}`}>{slide.title}</h4>
          {slide.subtitle && <p className="mt-2 max-w-[85%] text-[clamp(9px,1.3vw,14px)]" style={{ color: muted }}>{slide.subtitle}</p>}
          {slide.bullets.length > 0 && <ul className="mt-[3%] grid gap-[1.5%] text-[clamp(9px,1.35vw,15px)] leading-snug">{slide.bullets.slice(0,5).map((bullet,i)=><li key={i} className="flex items-start gap-2"><span className="mt-[0.45em] size-1.5 shrink-0 rounded-full" style={{ background: accent }} /><span>{bullet}</span></li>)}</ul>}
          <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-lg bg-black/30 px-2 py-1 text-[10px] text-white opacity-0 transition group-hover:opacity-100"><Maximize2 className="size-3" /> Preview</div>
        </div>
      </button>
      {slide.speakerNotes && <div className="mt-3 rounded-lg border border-line">
        <button type="button" className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-subtle hover:text-ink" onClick={() => setShowNotes((value) => !value)} aria-expanded={showNotes}>Speaker notes <span>{showNotes ? "Hide −" : "Show +"}</span></button>
        {showNotes && <p className="whitespace-pre-wrap px-3 pb-3 text-sm leading-relaxed">{slide.speakerNotes}</p>}
      </div>}
      <form className="mt-4 flex flex-col gap-2 rounded-xl border border-line bg-background/50 p-3 sm:flex-row" onSubmit={(event) => { event.preventDefault(); if (!refinement.trim() || busy) return; onRefine(refinement.trim()); setRefinement(""); }}>
        <input value={refinement} onChange={(event) => setRefinement(event.target.value)} placeholder="Refine this deck: make it more visual, add examples, change the tone…" aria-label="Presentation refinement instruction" className="min-w-0 flex-1 rounded-lg border border-line bg-panel px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
        <Button type="submit" disabled={busy || !refinement.trim()}>{busy ? "Updating…" : "Refine deck"}</Button>
      </form>
      <p className="mt-2 text-[10px] text-subtle">Describe changes in natural language. The deck is regenerated and the downloadable PowerPoint is replaced with the revised version.</p>
      <div className="mt-3 flex items-center gap-3">
        <Button variant="outline" size="icon" disabled={active===0} onClick={() => setActive((v)=>Math.max(0,v-1))} aria-label="Previous slide"><ChevronLeft className="size-4" /></Button>
        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto py-1">{result.deck.slides.map((item,index)=><button type="button" key={index} onClick={()=>setActive(index)} aria-label={`View slide ${index+1}: ${item.title}`} className={`w-24 shrink-0 rounded-lg border p-2 text-left transition sm:w-32 ${active===index?"border-indigo-500 bg-indigo-500/10":"border-line hover:bg-background"}`}><span className="block text-[9px] text-subtle">SLIDE {String(index+1).padStart(2,"0")}</span><span className="mt-1 block truncate text-[11px] font-medium">{item.title}</span></button>)}</div>
        <Button variant="outline" size="icon" disabled={active===result.deck.slides.length-1} onClick={() => setActive((v)=>Math.min(result.deck.slides.length-1,v+1))} aria-label="Next slide"><ChevronRight className="size-4" /></Button>
      </div>
    </div>
    {expanded && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/85 p-3 sm:p-8" role="presentation" onMouseDown={(e)=>{if(e.target===e.currentTarget)setExpanded(false);}} onKeyDown={(e)=>{if(e.key==="Escape")setExpanded(false);}}>
      <div role="dialog" aria-modal="true" aria-label="Slide preview" className="w-full max-w-6xl">
        <div className="mb-3 flex items-center justify-between gap-3 text-white"><p className="truncate text-sm">{active+1} / {result.deck.slides.length} · {slide.title}</p><Button variant="outline" onClick={()=>setExpanded(false)}>Close preview</Button></div>
        <div className="aspect-video overflow-hidden rounded-xl p-[7%] shadow-2xl" style={{background:bg,color:fg}}>
          <div className="mb-[3%] h-1.5 w-20 rounded-full" style={{background:accent}} />
          <h4 className={`max-w-[90%] font-semibold leading-tight ${active===0?"text-[clamp(28px,5vw,64px)]":"text-[clamp(24px,4vw,48px)]"}`}>{slide.title}</h4>
          {slide.subtitle && <p className="mt-3 text-[clamp(14px,1.8vw,24px)]" style={{color:muted}}>{slide.subtitle}</p>}
          <ul className="mt-[3%] grid gap-[1.5%] text-[clamp(14px,1.8vw,24px)] leading-snug">{slide.bullets.slice(0,6).map((bullet,i)=><li key={i} className="flex items-start gap-3"><span className="mt-[0.5em] size-2.5 shrink-0 rounded-full" style={{background:accent}}/><span>{bullet}</span></li>)}</ul>
        </div>
        <div className="mt-3 flex justify-between"><Button variant="outline" disabled={active===0} onClick={()=>setActive((v)=>Math.max(0,v-1))}><ChevronLeft/> Previous</Button><Button variant="outline" disabled={active===result.deck.slides.length-1} onClick={()=>setActive((v)=>Math.min(result.deck.slides.length-1,v+1))}>Next <ChevronRight/></Button></div>
      </div>
    </div>}
  </section>;
}
