"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { FaGithubSquare } from "react-icons/fa";
import { PiDiscordLogoDuotone, PiTreePalmDuotone } from "react-icons/pi";
import type { DocSection } from "@/lib/docs";

export default function DocsShell({
  sections,
  children,
}: {
  sections: DocSection[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (slug: string) =>
    pathname === `/docs/${slug}` || (pathname === "/docs" && slug === "");

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-foreground/10 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold"
          >
            <PiTreePalmDuotone className="text-2xl" />
            <span className="text-sm tracking-tight">Palmprint</span>
          </Link>
          <nav className="hidden sm:flex items-center gap-4 text-sm text-foreground/70">
            <Link href="/docs" className="hover:text-foreground">
              Docs
            </Link>
            <Link href="/widget" className="hover:text-foreground">
              Widget builder
            </Link>
            <Link href="/protected-action" className="hover:text-foreground">
              Demo
            </Link>
            <Link href="/captures" className="hover:text-foreground">
              Captures
            </Link>
          </nav>
          <div className="flex-1" />
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="lg:hidden text-sm px-3 py-1.5 rounded-full border border-foreground/15 text-foreground/80 hover:bg-foreground/5"
            aria-label="Toggle navigation"
          >
            {mobileOpen ? "Close" : "Menu"}
          </button>
        </div>
      </header>

      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-[16rem_1fr] gap-8 py-8">
        <aside
          className={`${
            mobileOpen ? "block" : "hidden"
          } lg:block lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto`}
        >
          <nav className="flex flex-col gap-6 text-sm">
            {sections.map((section) => (
              <div key={section.title} className="flex flex-col gap-1.5">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-foreground/55 px-3">
                  {section.title}
                </span>
                <ul className="flex flex-col gap-0.5">
                  {section.pages.map((page) => {
                    const active = isActive(page.slug);
                    return (
                      <li key={page.slug}>
                        <Link
                          href={`/docs/${page.slug}`}
                          onClick={() => setMobileOpen(false)}
                          className={`block px-3 py-1.5 rounded-md text-sm transition ${
                            active
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-medium"
                              : "text-foreground/75 hover:bg-foreground/5 hover:text-foreground"
                          }`}
                        >
                          {page.title}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            <div className="px-3 pt-4 mt-2 border-t border-foreground/10 flex flex-col gap-2 text-xs text-foreground/55">
              <Link
                href="https://github.com/masonthemaker/palmprint"
                className="inline-flex items-center gap-1.5 hover:text-foreground"
              >
                <FaGithubSquare className="text-base text-emerald-600 dark:text-emerald-400" />
                GitHub →
              </Link>
              <Link
                href="https://discord.gg/Av22T2TY9D"
                className="inline-flex items-center gap-1.5 hover:text-foreground"
              >
                <PiDiscordLogoDuotone className="text-base text-emerald-600 dark:text-emerald-400" />
                Discord →
              </Link>
              <Link href="/" className="hover:text-foreground">
                Back to demo →
              </Link>
            </div>
          </nav>
        </aside>

        <main className="min-w-0">{children}</main>
      </div>

      <footer className="border-t border-foreground/10 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 text-xs text-foreground/55 flex items-center justify-between gap-4">
          <span>🌴 Palmprint — built locally, signed server-side.</span>
          <span>
            <Link href="/docs/quickstart" className="hover:text-foreground">
              Quickstart
            </Link>
            {" · "}
            <Link href="/docs/server-sdk" className="hover:text-foreground">
              Server SDK
            </Link>
            {" · "}
            <Link
              href="https://github.com/masonthemaker/palmprint"
              className="inline-flex items-center gap-1.5 hover:text-foreground"
            >
              <FaGithubSquare className="text-base text-emerald-600 dark:text-emerald-400" />
              GitHub
            </Link>
            {" · "}
            <Link
              href="https://discord.gg/Av22T2TY9D"
              className="inline-flex items-center gap-1.5 hover:text-foreground"
            >
              <PiDiscordLogoDuotone className="text-base text-emerald-600 dark:text-emerald-400" />
              Discord
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
