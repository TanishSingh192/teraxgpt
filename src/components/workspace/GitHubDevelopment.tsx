import { useState } from "react";
import { ExternalLink, FileCode2, FolderGit2, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type RepoFile = { path: string; type: string; size?: number };
type RepoInfo = { full_name: string; description: string | null; default_branch: string; html_url: string; private: boolean };

export function GitHubDevelopment({ onClose }: { onClose: () => void }) {
  const [repoInput, setRepoInput] = useState("");
  const [repo, setRepo] = useState<RepoInfo | null>(null);
  const [files, setFiles] = useState<RepoFile[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function parseRepo(value: string) {
    const clean = value.trim().replace(/\.git$/, "").replace(/\/$/, "");
    const match = clean.match(/(?:github\.com\/)?([\w.-]+)\/([\w.-]+)/i);
    return match ? { owner: match[1]!, name: match[2]! } : null;
  }
  async function connect() {
    const parsed = parseRepo(repoInput);
    if (!parsed) { setError("Enter a GitHub repository URL or owner/repository."); return; }
    setBusy(true); setError(""); setRepo(null); setFiles([]); setSelected(null); setSource("");
    try {
      const headers = { Accept: "application/vnd.github+json" };
      const infoResponse = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.name}`, { headers });
      if (!infoResponse.ok) throw new Error(infoResponse.status === 404 ? "Repository not found, or it is private. Private repositories need GitHub sign-in." : `GitHub returned HTTP ${infoResponse.status}.`);
      const info = await infoResponse.json() as RepoInfo;
      const treeResponse = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.name}/git/trees/${info.default_branch}?recursive=1`, { headers });
      if (!treeResponse.ok) throw new Error(`Could not load repository files (HTTP ${treeResponse.status}).`);
      const tree = await treeResponse.json() as { tree?: RepoFile[]; truncated?: boolean };
      setRepo(info);
      setFiles((tree.tree ?? []).filter((file) => file.type === "blob").slice(0, 500));
      if (tree.truncated) setError("GitHub truncated this large repository tree; only the first available files are shown.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not connect to GitHub."); }
    finally { setBusy(false); }
  }
  async function openFile(path: string) {
    if (!repo) return;
    setSelected(path); setSource(""); setBusy(true); setError("");
    try {
      const [owner, name] = repo.full_name.split("/");
      const response = await fetch(`https://api.github.com/repos/${owner}/${name}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(repo.default_branch)}`, { headers: { Accept: "application/vnd.github+json" } });
      if (!response.ok) throw new Error(`Could not read file (HTTP ${response.status}).`);
      const data = await response.json() as { content?: string; encoding?: string; size?: number };
      if (data.encoding !== "base64" || !data.content) throw new Error("This file format cannot be previewed as text.");
      const bytes = Uint8Array.from(atob(data.content.replace(/\s/g, "")), (c) => c.charCodeAt(0));
      setSource(new TextDecoder().decode(bytes));
    } catch (e) { setError(e instanceof Error ? e.message : "Could not open this file."); }
    finally { setBusy(false); }
  }
  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 p-2 sm:p-6" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="github-dev-title" className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-5"><div className="grid size-10 place-items-center rounded-xl bg-background"><FolderGit2 /></div><div className="min-w-0 flex-1"><h2 id="github-dev-title" className="font-display text-lg font-semibold">GitHub Development</h2><p className="text-xs text-subtle">Connect a repository, browse its files, and inspect source code.</p></div>{repo && <a href={repo.html_url} target="_blank" rel="noreferrer" className="hidden items-center gap-1 text-xs text-subtle hover:text-ink sm:inline-flex">Open on GitHub <ExternalLink className="size-3.5" /></a>}<Button variant="ghost" size="icon" onClick={onClose} aria-label="Close GitHub development"><X /></Button></header>
      <form className="flex gap-2 border-b border-line p-3 sm:p-4" onSubmit={(e) => { e.preventDefault(); void connect(); }}><input value={repoInput} onChange={(e) => setRepoInput(e.target.value)} placeholder="https://github.com/owner/repository" aria-label="GitHub repository" className="min-w-0 flex-1 rounded-lg border border-line bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" /><Button type="submit" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <FolderGit2 />} Connect</Button></form>
      {repo && <div className="border-b border-line px-4 py-3"><div className="font-medium text-sm">{repo.full_name} <span className="ml-2 rounded-full bg-background px-2 py-0.5 text-[10px] text-subtle">{repo.default_branch}</span></div><p className="mt-1 text-xs text-subtle">{repo.description || "No repository description."} · {repo.private ? "Private" : "Public"}</p></div>}
      {error && <p role="alert" className="mx-4 mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-subtle">{error}</p>}
      <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(220px,0.7fr)_minmax(0,1.3fr)]">
        <aside className="max-h-48 overflow-y-auto border-b border-line p-2 md:max-h-none md:border-b-0 md:border-r">{files.map((file) => <button type="button" key={file.path} onClick={() => void openFile(file.path)} className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs hover:bg-background ${selected === file.path ? "bg-background text-ink" : "text-subtle"}`}><FileCode2 className="size-3.5 shrink-0" /><span className="truncate">{file.path}</span></button>)}{!repo && <p className="px-3 py-5 text-xs leading-5 text-subtle">Enter a public repository to load its file tree. Private repository access and write operations require a GitHub OAuth/App integration.</p>}</aside>
        <div className="min-h-0 overflow-auto bg-background/40 p-3 sm:p-4">{selected ? <><div className="mb-2 flex items-center justify-between gap-2"><div className="truncate text-xs font-medium">{selected}</div>{repo && <a href={`${repo.html_url}/blob/${repo.default_branch}/${selected.split("/").map(encodeURIComponent).join("/")}`} target="_blank" rel="noreferrer" className="text-xs text-subtle hover:text-ink">View on GitHub</a>}</div>{busy ? <div className="flex items-center gap-2 py-6 text-sm text-subtle"><Loader2 className="animate-spin" />Loading source…</div> : <pre className="overflow-x-auto rounded-xl border border-line bg-panel p-3 text-[11px] leading-5 text-ink sm:text-xs"><code>{source}</code></pre>}</> : <div className="grid h-full min-h-40 place-items-center text-center text-sm text-subtle"><p>Choose a file to inspect its source.<br />Read-only browsing works with public repositories.</p></div>}</div>
      </div>
      <footer className="border-t border-line px-4 py-2.5 text-[10px] text-subtle">This first version browses public repositories. Commits, pull requests, and private repositories require a securely configured GitHub authorization flow.</footer>
    </section>
  </div>;
}
