import { useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="my-4 overflow-hidden rounded-xl bg-code-bg ring-1 ring-black/40">
      <div className="flex items-center justify-between px-4 py-2 text-[11px] text-white/50">
        <span className="font-mono">{language || "code"}</span>
        <button
          type="button"
          className="font-mono transition-colors hover:text-white/80"
          onClick={() => {
            void navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          }}
        >
          {copied ? "copied" : "copy"}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 pb-4 font-mono text-[12.5px] leading-relaxed text-[#d7dce6]">
        {code}
      </pre>
    </div>
  );
}

export function Markdown({ children }: { children: string }) {
  return (
    <div className="text-[14px] leading-relaxed text-ink text-pretty">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
          h1: ({ children }) => (
            <p className="mb-2 font-display text-[16px] font-semibold">{children}</p>
          ),
          h2: ({ children }) => (
            <p className="mb-2 font-display text-[15px] font-semibold">{children}</p>
          ),
          h3: ({ children }) => <p className="mb-2 font-medium text-ink">{children}</p>,
          strong: ({ children }) => <span className="font-semibold">{children}</span>,
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-signal underline decoration-signal/40 underline-offset-2"
            >
              {children}
            </a>
          ),
          ul: ({ children }) => <ul className="mb-4 space-y-1.5 text-ink/90">{children}</ul>,
          ol: ({ children }) => (
            <ol className="mb-4 list-decimal space-y-1.5 pl-5 text-ink/90">{children}</ol>
          ),
          li: ({ children, ...props }) =>
            "ordered" in props && props.ordered ? (
              <li>{children}</li>
            ) : (
              <li className="flex gap-2">
                <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-signal" />
                <span className="min-w-0">{children}</span>
              </li>
            ),
          blockquote: ({ children }) => (
            <blockquote className="mb-3 border-l-2 border-signal/40 pl-3 text-subtle">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto rounded-xl ring-1 ring-black/5">
              <table className="w-full text-left text-[13px]">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-signal-soft text-ink">{children}</thead>,
          th: ({ children }) => <th className="px-3 py-2 font-medium">{children}</th>,
          td: ({ children }) => <td className="border-t border-line px-3 py-2">{children}</td>,
          hr: () => <hr className="my-4 border-line" />,
          code: ({ className, children }) => {
            const raw = String(children ?? "").replace(/\n$/, "");
            const match = /language-(\w+)/.exec(className ?? "");
            if (!match && !raw.includes("\n")) {
              return (
                <code className="rounded bg-signal-soft px-1.5 py-0.5 font-mono text-[12.5px] text-ink">
                  {children as ReactNode}
                </code>
              );
            }
            return <CodeBlock language={match?.[1] ?? ""} code={raw} />;
          },
          pre: ({ children }) => <>{children}</>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
