"use client";

import Link from "next/link";
import { useState } from "react";
import { PiTreePalmDuotone } from "react-icons/pi";
import { usePalmprint } from "@palmprint/react";

type Phase =
  | { kind: "idle" }
  | { kind: "verifying" }
  | {
      kind: "session";
      sessionToken: string;
      meta: {
        level: string;
        challengeNonce: string;
        expiresAt: number;
        captureCount: number;
        uploadedCount: number;
      };
    }
  | { kind: "error"; message: string };

export default function ProtectedActionDemo() {
  const { verify } = usePalmprint();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  const run = async () => {
    setPhase({ kind: "verifying" });
    try {
      // The provider does the whole dance now: fetches a challenge,
      // opens the modal, runs the verification, redeems with the server,
      // uploads any captures.
      const result = await verify({
        level: "high",
        numTests: 2,
        captureMode: "photo",
        reason: "Authorize protected action",
        description: "Server signs the session token before this resolves.",
      });
      setPhase({
        kind: "session",
        sessionToken: result.sessionToken,
        meta: {
          level: result.level,
          challengeNonce: result.challengeNonce,
          expiresAt: result.expiresAt,
          captureCount: result.captures.length,
          uploadedCount: result.uploadedCaptureIds.length,
        },
      });
    } catch (e) {
      setPhase({
        kind: "error",
        message: e instanceof Error ? e.message : "Cancelled",
      });
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 flex flex-col gap-6">
      <Link
        href="/"
        className="text-sm text-foreground/70 hover:text-foreground"
      >
        ← Home
      </Link>

      <header className="flex items-center gap-3 text-emerald-700 dark:text-emerald-400">
        <PiTreePalmDuotone className="text-4xl" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Signed end-to-end flow
          </h1>
          <p className="text-sm opacity-70">
            One <code className="font-mono">verify</code> call —
            the provider fetches a challenge, runs the modal, redeems with the
            server SDK, and uploads captures. You get a signed session token.
          </p>
        </div>
      </header>

      <ol className="grid gap-3">
        <Step
          num={1}
          label="Fetch challenge (auto)"
          done={phase.kind === "session"}
          active={phase.kind === "verifying" || phase.kind === "session"}
        />
        <Step
          num={2}
          label="Palmprint verification"
          done={phase.kind === "session"}
          active={phase.kind === "verifying" || phase.kind === "session"}
        />
        <Step
          num={3}
          label="Redeem (auto) — HMAC sign + nonce consume"
          done={phase.kind === "session"}
          active={phase.kind === "session"}
        />
        <Step
          num={4}
          label="Upload captures to bucket (auto)"
          done={phase.kind === "session"}
          active={phase.kind === "session"}
        />
      </ol>

      {phase.kind === "idle" && (
        <button
          onClick={run}
          className="self-start px-5 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-semibold"
        >
          Run secure flow
        </button>
      )}

      {phase.kind === "verifying" && (
        <p className="text-sm text-foreground/70">Working…</p>
      )}

      {phase.kind === "error" && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 flex flex-col gap-2">
          <p className="text-sm text-rose-700">{phase.message}</p>
          <button
            onClick={() => setPhase({ kind: "idle" })}
            className="self-start px-3 py-1.5 rounded-full bg-foreground/5 text-sm hover:bg-foreground/10"
          >
            Reset
          </button>
        </div>
      )}

      {phase.kind === "session" && (
        <section className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-5 flex flex-col gap-3 text-sm">
          <span className="text-emerald-700 dark:text-emerald-300 font-bold text-lg">
            ✓ Signed session token
          </span>
          <div className="grid grid-cols-2 gap-2 text-xs text-foreground/80">
            <span className="text-foreground/55">Level</span>
            <span className="font-mono">{phase.meta.level}</span>
            <span className="text-foreground/55">Challenge nonce</span>
            <span className="font-mono break-all">
              {phase.meta.challengeNonce}
            </span>
            <span className="text-foreground/55">Expires</span>
            <span className="font-mono">
              {new Date(phase.meta.expiresAt * 1000).toLocaleTimeString()}
            </span>
            <span className="text-foreground/55">Captures uploaded</span>
            <span className="font-mono">
              {phase.meta.uploadedCount} / {phase.meta.captureCount}
            </span>
          </div>
          <textarea
            readOnly
            value={phase.sessionToken}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full h-24 text-[11px] font-mono p-2 rounded-md bg-zinc-900 text-emerald-300 resize-none"
          />
          {phase.meta.uploadedCount > 0 && (
            <Link
              href="/captures"
              className="self-start text-xs px-3 py-1.5 rounded-full bg-foreground/10 hover:bg-foreground/20"
            >
              View captures bucket →
            </Link>
          )}
          <button
            onClick={() => setPhase({ kind: "idle" })}
            className="self-start px-3 py-1.5 rounded-full bg-emerald-500 text-black font-medium text-xs"
          >
            Run again
          </button>
        </section>
      )}

      <section className="rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-5 text-sm text-foreground/75 flex flex-col gap-2">
        <h2 className="font-semibold text-foreground">What this proves</h2>
        <p>
          The session token is HMAC-SHA256 signed with{" "}
          <code className="font-mono">PALMPRINT_SECRET</code>, has a strict
          30-minute lifetime, is bound to a single-use challenge nonce, and the
          server enforces the required security level before issuing it. The
          captures (when enabled) are stored against the challenge nonce so
          you can correlate them with the same session.
        </p>
        <p>
          Verify on the server with{" "}
          <code className="font-mono">requirePalmprint({"{ level: 'high' }"})</code>
          {" "}— it returns 401 on bad signature, 403 on insufficient level.
        </p>
      </section>
    </div>
  );
}

function Step({
  num,
  label,
  active,
  done,
}: {
  num: number;
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <li
      className={`flex items-center gap-3 px-3 py-2 rounded-xl border text-sm ${
        done
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : active
            ? "border-foreground/20 bg-foreground/5 text-foreground"
            : "border-foreground/10 text-foreground/55"
      }`}
    >
      <span className="w-6 h-6 rounded-full bg-foreground/10 grid place-items-center text-xs font-mono">
        {done ? "✓" : num}
      </span>
      <span>{label}</span>
    </li>
  );
}
