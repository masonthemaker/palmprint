import Link from "next/link";
import Image from "next/image";
import type { IconType } from "react-icons";
import { FaGithubSquare } from "react-icons/fa";
import {
  PiCheckCircleDuotone,
  PiCodeDuotone,
  PiCubeDuotone,
  PiDiscordLogoDuotone,
  PiFingerprintDuotone,
  PiGitBranchDuotone,
  PiHandPalmDuotone,
  PiLockKeyDuotone,
  PiShieldCheckDuotone,
  PiTreePalmDuotone,
  PiVideoCameraDuotone,
} from "react-icons/pi";

const navLinks = [
  { href: "/docs", label: "Docs" },
  { href: "/docs/challenge-levels", label: "Challenge levels" },
  { href: "/widget", label: "Widget builder" },
  { href: "/protected-action", label: "Signed flow" },
  { href: "/test", label: "Speed test" },
];

const proofPoints = [
  "Browser-first gesture recognition",
  "Signed server-issued challenge flow",
  "React, script tag, Node, and Go SDKs",
  "Apache-2.0 open source core",
];

const features: {
  icon: IconType;
  title: string;
  body: string;
}[] = [
  {
    icon: PiHandPalmDuotone,
    title: "Human motion, not checkbox theater",
    body: "Ask for real-time hand and face prompts: thumbs up, victory, brows up, ordered sequences, and two-hand combinations.",
  },
  {
    icon: PiLockKeyDuotone,
    title: "Signed sessions from your backend",
    body: "The server SDK issues short-lived challenges, binds a nonce to the browser result, prevents replay, then mints a signed session token.",
  },
  {
    icon: PiCubeDuotone,
    title: "Embeds anywhere",
    body: "Use the React provider, hook, guard, button widget, CAPTCHA-shaped checkbox, or a standalone script tag for non-React sites.",
  },
  {
    icon: PiVideoCameraDuotone,
    title: "Optional capture review",
    body: "Capture PNG frames or WebM clips for downstream liveness, fraud review, and model-based analysis when your risk profile needs it.",
  },
];

const levels = [
  {
    label: "Easy",
    style: "standard",
    detail: "Single hand or face prompts for low-friction flows.",
  },
  {
    label: "Medium",
    style: "handedness",
    detail: "Adds left/right hand constraints to reduce replay simplicity.",
  },
  {
    label: "Hard",
    style: "temporal",
    detail: "Requires ordered prompts like Thumbs Up then Thumbs Down.",
  },
  {
    label: "Extra Hard",
    style: "max",
    detail: "Combines temporal, left/right, two-hand, and face prompts.",
  },
];

const sdkPaths = [
  {
    icon: PiCodeDuotone,
    title: "React apps",
    body: "<PalmprintProvider>, usePalmprint(), PalmprintGuard, VerifyWidget, and CaptchaCheckbox.",
  },
  {
    icon: PiGitBranchDuotone,
    title: "Server SDKs",
    body: "Node and Go packages for challenge issuance, token redemption, nonce replay protection, and middleware.",
  },
  {
    icon: PiFingerprintDuotone,
    title: "Script tag",
    body: "A shadow-DOM widget bundle for static sites, WordPress themes, plain HTML, and hosted forms.",
  },
];

function ShellLink({
  href,
  children,
  primary = false,
}: {
  href: string;
  children: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition ${
        primary
          ? "bg-emerald-500 text-black hover:bg-emerald-400"
          : "border border-foreground/15 bg-background/80 text-foreground hover:bg-foreground/5"
      }`}
    >
      {children}
    </Link>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  body,
}: {
  icon: IconType;
  title: string;
  body: string;
}) {
  return (
    <article className="rounded-lg border border-foreground/10 bg-background p-5 shadow-sm">
      <Icon className="mb-4 text-3xl text-emerald-600 dark:text-emerald-400" />
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-foreground/65">{body}</p>
    </article>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-foreground/10 bg-background/90 backdrop-blur">
        <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3">
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold"
          >
            <PiTreePalmDuotone className="text-3xl text-emerald-600 dark:text-emerald-400" />
            <span>Palmprint</span>
          </Link>
          <div className="hidden items-center gap-1 lg:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full px-3 py-2 text-sm text-foreground/70 hover:bg-foreground/5 hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <a
              href="https://github.com/masonthemaker/palmprint"
              className="inline-flex min-h-10 items-center gap-2 rounded-full border border-foreground/10 px-3 text-sm font-medium hover:bg-foreground/5"
            >
              <FaGithubSquare className="text-lg text-emerald-600 dark:text-emerald-400" />
              <span className="hidden sm:inline">GitHub</span>
            </a>
          </div>
        </nav>
      </header>

      <section className="relative isolate overflow-hidden border-b border-foreground/10 bg-zinc-950 text-white">
        <Image
          src="/img.png"
          alt="Palmprint gesture and face challenge running in the browser"
          fill
          priority
          sizes="100vw"
          className="scale-[1.16] object-cover object-center opacity-55"
        />
        <div className="absolute inset-0 bg-black/72" />

        <div className="relative mx-auto flex min-h-[84vh] max-w-6xl flex-col justify-end px-5 pb-16 pt-28 sm:pb-20">
          <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-black/45 px-4 py-2 text-sm text-white/80 backdrop-blur">
            <PiShieldCheckDuotone className="text-xl text-emerald-300" />
            Open-source human verification for modern apps
          </div>
          <h1 className="max-w-4xl text-5xl font-semibold text-white sm:text-6xl lg:text-7xl">
            Human verification you can own, inspect, and ship.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-white/78 sm:text-xl">
            Replace brittle CAPTCHA flows with live gesture challenges, signed
            backend sessions, and SDKs that are small enough to understand in an
            afternoon.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <ShellLink href="/docs" primary>
              Read the docs
            </ShellLink>
            <ShellLink href="/widget">Build a widget</ShellLink>
            <a
              href="https://github.com/masonthemaker/palmprint"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 text-sm font-semibold text-white hover:bg-white/15"
            >
              <FaGithubSquare className="text-lg text-emerald-300" />
              Star the repo
            </a>
          </div>
          <div className="mt-10 grid w-full max-w-5xl grid-cols-1 gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
            {proofPoints.map((point) => (
              <div
                key={point}
                className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-white/80 backdrop-blur"
              >
                <PiCheckCircleDuotone className="text-lg text-emerald-300" />
                <span>{point}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-foreground/10 bg-background">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              What it is
            </p>
            <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">
              A verification primitive you can actually own.
            </h2>
            <p className="mt-4 text-base leading-7 text-foreground/68">
              Palmprint runs gesture recognition locally in the browser, then
              lets your server decide what a passed challenge unlocks. The open
              core covers the full happy path: browser challenge, signed
              challenge token, redemption, replay protection, widgets, docs, and
              Go support.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ShellLink href="/protected-action" primary>
                Try signed flow
              </ShellLink>
              <ShellLink href="/docs/challenge-levels">
                See challenge math
              </ShellLink>
            </div>
          </div>

          <div className="rounded-lg border border-foreground/10 bg-zinc-950 p-4 text-white shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <PiTreePalmDuotone className="text-2xl text-emerald-300" />
                Live challenge
              </div>
              <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-semibold text-emerald-200">
                Extra Hard
              </span>
            </div>
            <div className="grid gap-3 py-4 sm:grid-cols-3">
              {["Left hand: Victory", "Then", "Right hand: Thumbs Down"].map(
                (item) => (
                  <div
                    key={item}
                    className="rounded-md border border-white/10 bg-white/[0.04] p-3"
                  >
                    <span className="text-xs uppercase tracking-wider text-white/45">
                      Prompt
                    </span>
                    <p className="mt-2 min-h-12 text-sm font-semibold leading-6">
                      {item}
                    </p>
                  </div>
                ),
              )}
            </div>
            <div className="rounded-md bg-black p-4 font-mono text-xs leading-6 text-zinc-300">
              <div>
                <span className="text-emerald-300">challenge</span>.
                required_level = <span className="text-cyan-200">&quot;extra&quot;</span>
              </div>
              <div>
                <span className="text-emerald-300">session</span>.
                challenge_nonce = verified
              </div>
              <div>
                <span className="text-emerald-300">middleware</span>
                {" -> "}allow protected action
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-foreground/10 bg-zinc-50 dark:bg-zinc-950">
        <div className="mx-auto max-w-7xl px-5 py-16">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Why teams try it
            </p>
            <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">
              CAPTCHA shape, liveness direction.
            </h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-foreground/10 bg-background">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Drop-in shape
            </p>
            <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">
              Familiar to users, owned by your app.
            </h2>
            <p className="mt-4 text-base leading-7 text-foreground/68">
              The CAPTCHA checkbox design is there for teams who want a
              familiar form pattern without outsourcing the whole verification
              surface. It opens the same signed Palmprint challenge flow behind
              the scenes.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ShellLink href="/widget" primary>
                Configure the checkbox
              </ShellLink>
              <ShellLink href="/docs/script-tag">Script-tag docs</ShellLink>
            </div>
          </div>
          <div className="overflow-hidden rounded-lg border border-foreground/10 bg-zinc-950 shadow-xl">
            <Image
              src="/Screenshot 2026-05-09 at 12.33.15 AM.png"
              alt="Palmprint CAPTCHA-style checkbox widget"
              width={804}
              height={398}
              sizes="(min-width: 1024px) 42vw, 100vw"
              className="h-auto w-full"
            />
          </div>
        </div>
      </section>

      <section className="border-b border-foreground/10 bg-background">
        <div className="mx-auto max-w-7xl px-5 py-16">
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Security levels
              </p>
              <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">
                Dial friction up only when risk goes up.
              </h2>
              <p className="mt-4 text-base leading-7 text-foreground/68">
                Easy keeps onboarding gentle. Medium adds handedness. Hard adds
                temporal prompts. Extra Hard combines the full challenge pool
                for sensitive actions.
              </p>
              <div className="mt-6 rounded-lg border border-emerald-500/25 bg-emerald-500/8 p-4 text-sm leading-6 text-foreground/75">
                Max configuration supports about{" "}
                <strong className="text-foreground">1.185e55</strong> possible
                full-run prompt sequences. That is prompt diversity, not a
                substitute for signed tokens and replay protection.
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {levels.map((level) => (
                <article
                  key={level.label}
                  className="rounded-lg border border-foreground/10 bg-background p-5 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold">{level.label}</h3>
                    <span className="rounded-full bg-foreground/5 px-2.5 py-1 font-mono text-xs text-foreground/65">
                      {level.style}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-foreground/65">
                    {level.detail}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-foreground/10 bg-zinc-50 dark:bg-zinc-950">
        <div className="mx-auto max-w-7xl px-5 py-16">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Build paths
            </p>
            <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">
              Start with the integration you already have.
            </h2>
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {sdkPaths.map((path) => (
              <FeatureCard key={path.title} {...path} />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-background">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-16 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Open source first
            </p>
            <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">
              Fork it, inspect it, ship it.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-foreground/68">
              The core project is Apache-2.0. Enterprise concerns like managed
              storage, rate limits, dashboards, and capture review can sit
              around the same open protocol.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href="https://github.com/masonthemaker/palmprint"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-emerald-500 px-5 text-sm font-semibold text-black hover:bg-emerald-400"
            >
              <FaGithubSquare className="text-lg" />
              View GitHub
            </a>
            <a
              href="https://discord.gg/Av22T2TY9D"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-foreground/15 px-5 text-sm font-semibold hover:bg-foreground/5"
            >
              <PiDiscordLogoDuotone className="text-lg text-emerald-600 dark:text-emerald-400" />
              Join Discord
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-foreground/10 bg-zinc-950 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-6 text-sm text-white/65 sm:flex-row sm:items-center sm:justify-between">
          <span>Palmprint - open-source human verification.</span>
          <div className="flex flex-wrap gap-4">
            <Link href="/docs" className="hover:text-white">
              Docs
            </Link>
            <Link href="/widget" className="hover:text-white">
              Widget builder
            </Link>
            <Link href="/human-consent" className="hover:text-white">
              Agent consent
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
