import { useMemo, useState } from "react";
import { Code2, Maximize2, Play, RotateCcw, X, FileCode2, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

export type WorkspaceFile = { name: string; language: string; content: string };

type CodeWorkspaceProps = {
  initialCode: string;
  language: string;
  initialFiles?: WorkspaceFile[];
  onClose: () => void;
};

const WEB_LANGUAGES = new Set(["html", "htm", "css", "javascript", "js"]);

function escapeInlineScript(code: string) {
  return code.replace(/<\/script/gi, "<\\/script");
}

function buildProjectPreview(files: WorkspaceFile[]) {
  const byName = new Map(files.map((file) => [file.name.replace(/^\.\//, ""), file.content]));
  const htmlName = [...byName.keys()].find((name) => /(^|\/)index\.html?$/i.test(name)) ??
    [...byName.keys()].find((name) => /\.html?$/i.test(name));
  const css = [...byName.entries()].filter(([name]) => /\.css$/i.test(name)).map(([, value]) => value).join("\n");
  const js = [...byName.entries()].filter(([name]) => /\.(m?js)$/i.test(name) && !/(?:^|\/)vite\.config\./i.test(name)).map(([, value]) => value).join("\n;\n");
  if (htmlName) {
    let html = byName.get(htmlName) ?? "";
    if (!/<html[\s>]/i.test(html) && !/<!doctype/i.test(html)) {
      html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${html}</body></html>`;
    }
    if (css && !/<link[^>]+\.css/i.test(html) && !/<style[\s>]/i.test(html)) {
      html = html.replace("</head>", `<style>\n${css}\n</style></head>`);
    }
    if (js && !/<script[^>]+src=/i.test(html)) {
      html = html.replace("</body>", `<script>\n${escapeInlineScript(js)}\n</script></body>`);
    }
    return html;
  }
  if (files.length === 1 && /\.css$/i.test(files[0]!.name)) {
    return `<!doctype html><html><head><meta charset="utf-8"><style>${files[0]!.content}</style></head><body style="font:16px system-ui;padding:24px"><h2>CSS project preview</h2><p class="preview-target">Example content</p><button class="preview-target">Example button</button></body></html>`;
  }
  if (js) {
    return `<!doctype html><html><head><meta charset="utf-8"></head><body style="font:14px system-ui;padding:16px"><h3>JavaScript output</h3><pre id="output" style="white-space:pre-wrap;background:#f4f4f5;padding:12px;border-radius:8px"></pre><script>const output=document.getElementById('output');console.log=(...args)=>output.textContent+=args.map(x=>typeof x==='object'?JSON.stringify(x,null,2):String(x)).join(' ')+'\\n';try{\n${escapeInlineScript(js)}\n}catch(e){output.textContent='Runtime error: '+e.message}</script></body></html>`;
  }
  return null;
}

export function CodeWorkspace({ initialCode, language, initialFiles, onClose }: CodeWorkspaceProps) {
  const seedFiles = useMemo<WorkspaceFile[]>(() => {
    if (initialFiles?.length) return initialFiles;
    const ext = language === "html" ? "html" : language === "css" ? "css" : language === "javascript" || language === "js" ? "js" : language || "txt";
    return [{ name: `main.${ext}`, language: language || "text", content: initialCode }];
  }, [initialCode, language, initialFiles]);
  const [files, setFiles] = useState<WorkspaceFile[]>(seedFiles);
  const [activeFile, setActiveFile] = useState(seedFiles[0]?.name ?? "");
  const [previewKey, setPreviewKey] = useState(0);
  const [showPreview, setShowPreview] = useState(true);
  const preview = useMemo(() => buildProjectPreview(files), [files, previewKey]);
  const active = files.find((file) => file.name === activeFile) ?? files[0];
  const supported = files.some((file) => WEB_LANGUAGES.has(file.language.toLowerCase()) || /\.(html?|css|m?js)$/i.test(file.name));
  const updateActive = (content: string) => setFiles((current) => current.map((file) => file.name === activeFile ? { ...file, content } : file));

  return (
    <section className="my-4 overflow-hidden rounded-2xl border border-border bg-panel shadow-xl" aria-label="Multi-file project IDE">
      <header className="flex flex-wrap items-center gap-2 border-b border-border bg-[#11141d] px-3 py-3">
        <div className="grid size-8 place-items-center rounded-lg bg-violet-500/15 text-violet-300"><Code2 className="size-4" /></div>
        <div className="min-w-0"><div className="text-sm font-semibold text-ink">Project IDE</div><div className="text-[10px] text-subtle">{files.length} files · shared project preview</div></div>
        <div className="ml-auto flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => { setFiles(seedFiles); setActiveFile(seedFiles[0]?.name ?? ""); setPreviewKey((n) => n + 1); }} aria-label="Reset project"><RotateCcw className="size-4" /> Reset</Button>
          <Button variant="ghost" size="sm" onClick={() => setShowPreview((value) => !value)}><Maximize2 className="size-4" /> {showPreview ? "Hide preview" : "Show preview"}</Button>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close project IDE"><X className="size-4" /></Button>
        </div>
      </header>
      <div className={`grid min-h-[500px] ${showPreview ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : "grid-cols-1"}`}>
        <div className="flex min-h-[420px] min-w-0 flex-col border-b border-border lg:border-b-0 lg:border-r">
          <div className="flex min-w-0 items-center gap-1 overflow-x-auto border-b border-border bg-background px-2 py-2">
            <FolderOpen className="mx-2 size-4 shrink-0 text-subtle" />
            {files.map((file) => (
              <button key={file.name} type="button" onClick={() => setActiveFile(file.name)} className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs transition-colors ${activeFile === file.name ? "bg-panel text-ink shadow-sm ring-1 ring-border" : "text-subtle hover:bg-panel/70 hover:text-ink"}`}>
                <FileCode2 className="size-3.5" />{file.name}
              </button>
            ))}
          </div>
          {active ? <>
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2 text-[11px] text-subtle"><span className="font-mono">{active.name}</span><span>{active.language}</span></div>
            <textarea spellCheck={false} aria-label={`Edit ${active.name}`} value={active.content} onChange={(event) => updateActive(event.target.value)} className="min-h-[350px] w-full flex-1 resize-y bg-[#0d111b] p-4 font-mono text-[12px] leading-5 text-[#dbe4f0] outline-none focus:ring-2 focus:ring-inset focus:ring-violet-500 lg:resize-none" />
            <div className="flex items-center justify-between gap-2 border-t border-border p-3"><span className="text-[11px] text-subtle">{active.content.split("\n").length} lines · {files.length} project files</span><Button size="sm" onClick={() => setPreviewKey((n) => n + 1)} disabled={!supported}><Play className="size-4" /> Run project</Button></div>
          </> : <div className="p-6 text-sm text-subtle">No files were detected.</div>}
        </div>
        {showPreview && <div className="flex min-h-[420px] min-w-0 flex-col">
          <div className="flex items-center justify-between border-b border-border bg-background px-4 py-3 text-xs"><span className="font-medium text-ink">Project preview</span><span className="text-subtle">Sandboxed · manual run</span></div>
          {preview ? <iframe key={previewKey} title="Unified project preview" sandbox="allow-scripts" srcDoc={preview} className="min-h-[420px] w-full flex-1 bg-white" /> : <div className="m-4 rounded-xl border border-border p-4 text-sm text-subtle"><p className="font-medium text-ink">Preview unavailable for this project type</p><p className="mt-2">All generated files are available together in the editor. The built-in preview runs static HTML, CSS, and JavaScript projects; React, TypeScript, and npm-based projects require a dependency-aware build sandbox, which is not connected here.</p></div>}
        </div>}
      </div>
      <p className="border-t border-border px-3 py-2 text-[10px] text-subtle">All generated files are editable in one workspace. The preview runs in an isolated browser frame and has no access to your account or server environment.</p>
    </section>
  );
}
