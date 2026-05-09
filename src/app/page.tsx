import Link from "next/link";
import { Palmprint } from "@palmprint/react";

export default function Home() {
  return (
    <div className="relative flex flex-col flex-1 items-center justify-center bg-gradient-to-b from-emerald-50 via-zinc-50 to-zinc-100 dark:from-zinc-950 dark:via-black dark:to-black font-sans px-4 py-10">
      <div className="absolute top-4 right-4 flex gap-2 flex-wrap justify-end max-w-[calc(100%-2rem)]">
        <Link
          href="/docs"
          className="px-3 py-1.5 rounded-full text-sm font-medium bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
        >
          Docs →
        </Link>
        <Link
          href="/protected-action"
          className="px-3 py-1.5 rounded-full text-sm font-medium bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 text-foreground"
        >
          Signed flow →
        </Link>
        <Link
          href="/captures"
          className="px-3 py-1.5 rounded-full text-sm font-medium bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 text-foreground"
        >
          Captures →
        </Link>
        <Link
          href="/account"
          className="px-3 py-1.5 rounded-full text-sm font-medium bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 text-foreground"
        >
          Account →
        </Link>
        <Link
          href="/password-reset"
          className="px-3 py-1.5 rounded-full text-sm font-medium bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 text-foreground"
        >
          Password reset →
        </Link>
        <Link
          href="/human-consent"
          className="px-3 py-1.5 rounded-full text-sm font-medium bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 text-foreground"
        >
          Agent consent →
        </Link>
        <Link
          href="/widget"
          className="px-3 py-1.5 rounded-full text-sm font-medium bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 text-foreground"
        >
          Widget builder →
        </Link>
      </div>
      <main className="w-full">
        <Palmprint />
      </main>
    </div>
  );
}
