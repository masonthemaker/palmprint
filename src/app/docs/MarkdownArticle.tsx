"use client";

import Link from "next/link";
import { Children, isValidElement, useCallback, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { ComponentProps, ReactNode } from "react";
import { PiCopySimpleDuotone } from "react-icons/pi";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeHighlight from "rehype-highlight";
import type { AdjacentPages } from "@/lib/docs";

type MarkdownArticleProps = {
  title: string;
  description?: string;
  markdown: string;
  slug: string;
  adjacent: AdjacentPages;
};

function textFromNode(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(textFromNode).join("");
  }

  if (isValidElement<{ children?: ReactNode }>(node)) {
    return textFromNode(node.props.children);
  }

  return "";
}

function CopyableCodeBlock(props: ComponentProps<"pre">) {
  const [copiedCode, setCopiedCode] = useState(false);
  const code = textFromNode(props.children).replace(/\n$/, "");

  const handleCopyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1600);
    } catch {
      // Clipboard access can fail in older browsers or non-secure contexts.
    }
  }, [code]);

  return (
    <div className="docs-code-block">
      <button
        type="button"
        onClick={handleCopyCode}
        className="docs-code-copy"
        aria-label={copiedCode ? "Code copied" : "Copy code"}
        title={copiedCode ? "Copied" : "Copy code"}
      >
        <PiCopySimpleDuotone aria-hidden="true" />
        <span>{copiedCode ? "Copied" : "Copy"}</span>
      </button>
      <pre {...props} />
    </div>
  );
}

export default function MarkdownArticle({
  title,
  description,
  markdown,
  slug,
  adjacent,
}: MarkdownArticleProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore — older browsers
    }
  }, [markdown]);

  const downloadHref = `data:text/markdown;charset=utf-8,${encodeURIComponent(markdown)}`;

  return (
    <article className="flex flex-col">
      <div className="flex items-center justify-between gap-3 pb-3 mb-6 border-b border-foreground/10">
        <nav className="text-xs text-foreground/55 flex items-center gap-2">
          <Link href="/docs" className="hover:text-foreground">
            Docs
          </Link>
          <span>/</span>
          <span className="text-foreground/85">{title}</span>
        </nav>
        <div className="flex items-center gap-2">
          <a
            href={downloadHref}
            download={`${slug}.md`}
            className="hidden sm:inline-flex text-xs px-2.5 py-1.5 rounded-full border border-foreground/15 text-foreground/70 hover:bg-foreground/5 hover:text-foreground"
            title="Download as .md"
          >
            ↓ .md
          </a>
          <button
            onClick={handleCopy}
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition ${
              copied
                ? "bg-emerald-500 text-black border-emerald-500"
                : "bg-foreground text-background border-foreground hover:opacity-90"
            }`}
            title="Copy raw markdown — paste it into your AI agent"
          >
            {copied ? "✓ Copied" : "Copy as Markdown"}
          </button>
        </div>
      </div>

      <header className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        {description && (
          <p className="mt-2 text-base text-foreground/70">{description}</p>
        )}
      </header>

      <div className="prose-palmprint">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            pre({ children, ...props }) {
              delete (props as ComponentProps<"pre"> & { node?: unknown }).node;
              const normalizedChildren = Children.toArray(children);

              return (
                <CopyableCodeBlock {...props}>
                  {normalizedChildren}
                </CopyableCodeBlock>
              );
            },
          }}
          rehypePlugins={[
            rehypeSlug,
            [
              rehypeAutolinkHeadings,
              {
                behavior: "append",
                properties: {
                  className: ["heading-anchor"],
                  ariaLabel: "Link to section",
                },
                content: { type: "text", value: "#" },
              },
            ],
            [rehypeHighlight, { detect: true, ignoreMissing: true }],
          ]}
        >
          {markdown}
        </ReactMarkdown>
      </div>

      <nav className="mt-16 pt-8 border-t border-foreground/10 grid grid-cols-2 gap-3">
        <div>
          {adjacent.prev && (
            <Link
              href={`/docs/${adjacent.prev.slug}`}
              className="block rounded-xl border border-foreground/10 p-4 hover:bg-foreground/5"
            >
              <div className="text-[11px] uppercase tracking-wider text-foreground/55">
                ← Previous
              </div>
              <div className="text-sm font-medium text-foreground mt-0.5">
                {adjacent.prev.title}
              </div>
            </Link>
          )}
        </div>
        <div>
          {adjacent.next && (
            <Link
              href={`/docs/${adjacent.next.slug}`}
              className="block rounded-xl border border-foreground/10 p-4 hover:bg-foreground/5 text-right"
            >
              <div className="text-[11px] uppercase tracking-wider text-foreground/55">
                Next →
              </div>
              <div className="text-sm font-medium text-foreground mt-0.5">
                {adjacent.next.title}
              </div>
            </Link>
          )}
        </div>
      </nav>
    </article>
  );
}
