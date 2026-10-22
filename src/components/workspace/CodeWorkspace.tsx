import { useMemo, useState } from "react";
import { Code2, Maximize2, Play, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type CodeWorkspaceProps = {
  initialCode: string;
  language: string;
  onClose: () => void;
};

const WEB_LANGUAGES = new Set(["html", "htm", "css", "javascript", "js", "typescript", "ts"]);

function buildPreview(code: string, language: string) {
  const lang = language.toLowerCase();
  if (lang === "html" || lang === "htm" || !lang) {
    if (/<html[\s>]/i.test(code) || /<!doctype/i.test(code)) return code;
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font-family:system-ui,sans-serif;padding:24px;color:#111}img{max-width:100%}button,input{font:inherit}</style></head><body>${code}</body></html>`;
  }
  if (lang === "css") {
    return `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:system-ui,sans-serif;padding:24px} .demo{padding:20px;border:1px solid #ddd;border-radius:12px} ${code}</style></head><body><div class="demo"><h2>CSS preview</h2><p class="preview-target">This sample element previews your styles.</p><button class="preview-target">Example button</button></div></body></html>`;
  }
  if (lang === "js" || lang === "javascript") {
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="font:14px system-ui;padding:16px"><h3>JavaScript preview</h3><pre id="output" style="white-space:pre-wrap;background:#f4f4f5;padding:12px;border-radius:8px">Running…</pre><script>const output=document.getElementById('output');const log=console.log;console.log=(...args)=>{output.textContent+=args.map(x=>typeof x==='object'?JSON.stringify(x,null,2):String(x)).join(' ')+'\\n'};try{\n${code}\n}catch(e){output.textContent='Runtime error: '+e.message}</script></body></html>`;
  }
  return null;
}

export function CodeWorkspace({ initialCode, language, onClose }: CodeWorkspaceProps) {
  const [code, setCode] = useState(initialCode);
  const [previewKey, setPreviewKey] = useState(0);
  const preview = useMemo(() => buildPreview(code, language), [code, language, previewKey]);
  const supported = WEB_LANGUAGES.has(language.toLowerCase()) || !language;
  return (
    <section className="my-4 overflow-hidden rounded-xl border border-border bg-panel" aria-label="In-chat code editor">
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2.5">
        <Code2 className="size-4 text-signal" />
        <span className="text-sm font-semibold">Code workspace</span>
        <span className="rounded-md bg-background px-2 py-1 font-mono text-[11px] text-subtle">{language || "html"}</span>
        <div className="ml-auto flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => { setCode(initialCode); setPreviewKey((n) => n + 1); }} aria-label="Reset code"><RotateCcw className="size-4" /> Reset</Button>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close code workspace"><X className="size-4" /></Button>
        </div>
      </header>
      <div className="grid min-h-[420px] lg:grid-cols-2">
        <div className="flex min-h-[320px] min-w-0 flex-col border-b border-border lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs text-subtle"><span>Editor</span><span>Editable</span></div>
          <textarea spellCheck={false} aria-label="Edit code" value={code} onChange={(event) => setCode(event.target.value)} className="min-h-[320px] w-full flex-1 resize-y bg-[#101319] p-4 font-mono text-[12px] leading-5 text-[#e2e8f0] outline-none focus:ring-2 focus:ring-inset focus:ring-signal lg:resize-none" />
          <div className="flex items-center justify-between gap-2 border-t border-border p-2.5"><span className="text-[11px] text-subtle">{code.split("\n").length} lines</span><Button size="sm" onClick={() => setPreviewKey((n) => n + 1)} disabled={!supported}><Play className="size-4" /> Run preview</Button></div>
        </div>
        <div className="flex min-h-[320px] min-w-0 flex-col">
          <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs text-subtle"><span>Live preview</span><Maximize2 className="size-3.5" /></div>
          {supported && preview !== null ? <iframe key={previewKey} title="Code preview sandbox" sandbox="allow-scripts" srcDoc={preview} className="min-h-[320px] w-full flex-1 bg-white" /> : <div className="m-4 rounded-lg border border-border p-4 text-sm text-subtle">This language can be edited here, but live browser preview currently supports HTML, CSS, and JavaScript. React/TypeScript projects need a dependency-aware build sandbox.</div>}
        </div>
      </div>
      <p className="border-t border-border px-3 py-2 text-[11px] text-subtle">Preview runs in a sandboxed browser frame. It does not have access to your account, cookies, or server environment.</p>
    </section>
  );
}
