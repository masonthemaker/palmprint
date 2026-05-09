"use client";

import Link from "next/link";
import { useState } from "react";
import { PiTreePalmDuotone } from "react-icons/pi";
import { usePalmprint } from "@palmprint/react";

type Phase =
  | { kind: "idle" }
  | { kind: "verifying" }
  | { kind: "changing"; sessionToken: string }
  | { kind: "saving"; sessionToken: string }
  | { kind: "done" }
  | { kind: "error"; message: string };

export default function AccountPage() {
  const { verify } = usePalmprint();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });

  const onClickChangePassword = async () => {
    setPhase({ kind: "verifying" });
    try {
      const result = await verify({
        level: "high",
        numTests: 2,
        reason: "Confirm password change",
        description:
          "We need to confirm it's really you before you can update your password.",
      });
      setPhase({ kind: "changing", sessionToken: result.sessionToken });
    } catch (e) {
      setPhase({
        kind: "error",
        message: e instanceof Error ? e.message : "Verification cancelled.",
      });
    }
  };

  const onSubmitNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phase.kind !== "changing") return;
    if (pw.next.length < 8) {
      setPhase({
        kind: "error",
        message: "New password must be at least 8 characters.",
      });
      return;
    }
    if (pw.next !== pw.confirm) {
      setPhase({ kind: "error", message: "Passwords do not match." });
      return;
    }
    setPhase({ kind: "saving", sessionToken: phase.sessionToken });
    // In a real app: POST to /api/account/password with the session token in
    // an Authorization: Bearer header. The endpoint would be wrapped with
    // requirePalmprint({ level: "high" }, …) to enforce the auth.
    await new Promise((r) => setTimeout(r, 600));
    setPhase({ kind: "done" });
    setPw({ current: "", next: "", confirm: "" });
  };

  return (
    <div className="max-w-md mx-auto py-10 px-4 flex flex-col gap-5">
      <Link
        href="/"
        className="text-sm text-foreground/70 hover:text-foreground"
      >
        ← Home
      </Link>
      <header className="flex items-center gap-3 text-emerald-700 dark:text-emerald-400">
        <PiTreePalmDuotone className="text-3xl" />
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Account settings
        </h1>
      </header>

      <section className="rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-5 flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold">Password</h2>
          <span className="text-xs text-foreground/55">
            Last changed 14 days ago
          </span>
        </div>

        {phase.kind === "idle" && (
          <button
            onClick={onClickChangePassword}
            className="self-start px-4 py-2 rounded-full bg-foreground text-background font-semibold text-sm hover:opacity-90"
          >
            Change password
          </button>
        )}

        {phase.kind === "verifying" && (
          <p className="text-sm text-foreground/70">
            Waiting for Palmprint verification…
          </p>
        )}

        {(phase.kind === "changing" || phase.kind === "saving") && (
          <>
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs text-emerald-700 dark:text-emerald-300">
              ✓ Identity verified — set your new password.
            </div>
            <form
              onSubmit={onSubmitNewPassword}
              className="flex flex-col gap-3"
            >
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Current password</span>
                <input
                  type="password"
                  required
                  value={pw.current}
                  onChange={(e) => setPw({ ...pw, current: e.target.value })}
                  className="px-3 py-2 rounded-lg bg-background border border-foreground/15 text-foreground"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">New password</span>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={pw.next}
                  onChange={(e) => setPw({ ...pw, next: e.target.value })}
                  className="px-3 py-2 rounded-lg bg-background border border-foreground/15 text-foreground"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Confirm new password</span>
                <input
                  type="password"
                  required
                  value={pw.confirm}
                  onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
                  className="px-3 py-2 rounded-lg bg-background border border-foreground/15 text-foreground"
                />
              </label>
              <button
                type="submit"
                disabled={phase.kind === "saving"}
                className="px-4 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-semibold disabled:opacity-60"
              >
                {phase.kind === "saving" ? "Saving…" : "Update password"}
              </button>
            </form>
          </>
        )}

        {phase.kind === "done" && (
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-sm text-emerald-700 dark:text-emerald-300 flex items-center justify-between gap-3">
            <span>✓ Password updated.</span>
            <button
              onClick={() => setPhase({ kind: "idle" })}
              className="text-xs underline"
            >
              Change again
            </button>
          </div>
        )}

        {phase.kind === "error" && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-rose-600">{phase.message}</p>
            <button
              onClick={() => setPhase({ kind: "idle" })}
              className="self-start px-3 py-1.5 rounded-full bg-foreground/5 text-sm hover:bg-foreground/10"
            >
              Try again
            </button>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-5 text-sm text-foreground/70">
        <h2 className="font-semibold text-foreground mb-1">
          How this is wired
        </h2>
        <p>
          The <code>Change password</code> button calls{" "}
          <code className="font-mono">verify()</code> from the
          Palmprint hook. The form is hidden until the promise resolves, then
          the returned token would be sent to your backend (re-signed
          server-side) to authorize the actual update.
        </p>
      </section>
    </div>
  );
}
