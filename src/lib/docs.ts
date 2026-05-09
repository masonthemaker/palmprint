import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type DocSection = {
  title: string;
  pages: DocPage[];
};

export type DocPage = {
  slug: string;
  title: string;
  description: string;
};

export const DOC_NAV: DocSection[] = [
  {
    title: "Overview",
    pages: [
      {
        slug: "introduction",
        title: "Introduction",
        description: "What Palmprint is, when to use it, when not to.",
      },
      {
        slug: "quickstart",
        title: "Quickstart",
        description: "From zero to a signed verification in five steps.",
      },
      {
        slug: "sdk",
        title: "SDK layout",
        description: "The package map and the shortest happy paths.",
      },
    ],
  },
  {
    title: "Client",
    pages: [
      {
        slug: "react",
        title: "React integration",
        description: "Provider, hook, guard, and widget components.",
      },
      {
        slug: "script-tag",
        title: "Script-tag bundle",
        description: "Standalone IIFE for non-React sites.",
      },
    ],
  },
  {
    title: "Server",
    pages: [
      {
        slug: "server-sdk",
        title: "Server SDK",
        description: "HMAC sign / verify / replay-protection.",
      },
      {
        slug: "middleware",
        title: "Middleware",
        description: "requirePalmprint for protecting route handlers.",
      },
      {
        slug: "go",
        title: "Go SDK",
        description: "Use Palmprint from a Go backend.",
      },
    ],
  },
  {
    title: "Features",
    pages: [
      {
        slug: "captures",
        title: "Captures bucket",
        description: "Raw PNG / WebM uploads tied to verified sessions.",
      },
      {
        slug: "agent-consent",
        title: "Agent consent",
        description: "Agent → human approval flow with optional payment.",
      },
    ],
  },
  {
    title: "Reference",
    pages: [
      {
        slug: "tokens",
        title: "Token formats",
        description: "Client, challenge, session — what's in each.",
      },
    ],
  },
];

export type AdjacentPages = {
  prev: { slug: string; title: string } | null;
  next: { slug: string; title: string } | null;
};

const FLAT_PAGES: DocPage[] = DOC_NAV.flatMap((section) => section.pages);

export function getDocPage(slug: string): DocPage | null {
  return FLAT_PAGES.find((p) => p.slug === slug) ?? null;
}

export function getAdjacentPages(slug: string): AdjacentPages {
  const idx = FLAT_PAGES.findIndex((p) => p.slug === slug);
  if (idx === -1) return { prev: null, next: null };
  return {
    prev:
      idx > 0
        ? { slug: FLAT_PAGES[idx - 1].slug, title: FLAT_PAGES[idx - 1].title }
        : null,
    next:
      idx < FLAT_PAGES.length - 1
        ? { slug: FLAT_PAGES[idx + 1].slug, title: FLAT_PAGES[idx + 1].title }
        : null,
  };
}

export function getDocMarkdown(slug: string): string | null {
  const path = join(process.cwd(), "content", "docs", `${slug}.md`);
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf8");
}

export function listDocSlugs(): string[] {
  return FLAT_PAGES.map((p) => p.slug);
}
