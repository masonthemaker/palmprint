import Link from "next/link";
import { PiTreePalmDuotone } from "react-icons/pi";
import { DOC_NAV } from "@/lib/docs";
import DocsShell from "./DocsShell";

export const metadata = {
  title: "Palmprint Docs",
  description:
    "Build with Palmprint — gesture and face human verification with HMAC-signed session tokens.",
};

export default function DocsIndex() {
  return (
    <DocsShell sections={DOC_NAV}>
      <div className="flex flex-col gap-10">
        <header className="flex flex-col gap-3">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-foreground/55">
            <PiTreePalmDuotone className="text-base text-emerald-600 dark:text-emerald-400" />
            Documentation
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground">
            Build with Palmprint.
          </h1>
          <p className="text-lg text-foreground/70 max-w-2xl">
            Camera-based human verification you can drop into a sign-up form,
            an action button, a whole sensitive route, or an AI-agent consent
            flow. Signed end-to-end. Local by default.
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Link
              href="/docs/quickstart"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-foreground text-background text-sm font-medium hover:opacity-90"
            >
              Start with Quickstart →
            </Link>
            <Link
              href="/docs/react"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-foreground/15 text-sm font-medium hover:bg-foreground/5"
            >
              Jump to React
            </Link>
            <span className="ml-2 text-xs text-foreground/55">
              Every page has a <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-foreground/10 font-mono">Copy as Markdown</kbd> button — paste into your AI agent.
            </span>
          </div>
        </header>

        <div className="flex flex-col gap-8">
          {DOC_NAV.map((section) => (
            <section key={section.title} className="flex flex-col gap-3">
              <h2 className="text-xs uppercase tracking-wider font-semibold text-foreground/55">
                {section.title}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {section.pages.map((page) => (
                  <Link
                    key={page.slug}
                    href={`/docs/${page.slug}`}
                    className="group rounded-2xl border border-foreground/10 p-5 hover:border-emerald-500/40 hover:bg-emerald-500/5 transition flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-base font-semibold text-foreground">
                        {page.title}
                      </span>
                      <span className="text-foreground/40 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 text-sm">
                        →
                      </span>
                    </div>
                    <p className="text-sm text-foreground/65 leading-snug">
                      {page.description}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>

        <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-5 sm:p-6 flex flex-col gap-2">
          <h3 className="text-sm uppercase tracking-wider font-semibold text-emerald-700 dark:text-emerald-300">
            Designed for AI agents
          </h3>
          <p className="text-sm text-foreground/80 max-w-2xl">
            Every doc page on this site has a one-click{" "}
            <strong>Copy as Markdown</strong> button. The clipboard payload is
            the raw markdown source — drop it into ChatGPT, Claude, or any
            other agent and it gets the full integration context with code
            samples, schemas, and rationale, no scraping or summarization
            needed.
          </p>
        </section>
      </div>
    </DocsShell>
  );
}
