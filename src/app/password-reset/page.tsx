"use client";

import Link from "next/link";
import { useState } from "react";
import { PiTreePalmDuotone } from "react-icons/pi";
import { PalmprintGuard } from "@palmprint/react";

export default function PasswordResetPage() {
  return (
    <PalmprintGuard
      level="high"
      numTests={3}
      reason="Verify yourself to reset your password"
      description="Password reset is a high-stakes action. Prove you're the account holder with a Palmprint check before continuing."
    >
      <PasswordResetForm />
    </PalmprintGuard>
  );
}

function PasswordResetForm() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="max-w-md mx-auto py-10 px-4 flex flex-col gap-4">
      <Link
        href="/"
        className="text-sm text-foreground/70 hover:text-foreground"
      >
        ← Home
      </Link>
      <header className="flex items-center gap-3 text-emerald-700 dark:text-emerald-400">
        <PiTreePalmDuotone className="text-3xl" />
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Reset your password
        </h1>
      </header>

      <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs text-emerald-700 dark:text-emerald-300">
        ✓ Identity verified — you can now request a reset link.
      </div>

      {!submitted ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(true);
          }}
          className="flex flex-col gap-3"
        >
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Email address</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="px-3 py-2 rounded-lg bg-background border border-foreground/15 text-foreground"
            />
          </label>
          <button
            type="submit"
            className="px-4 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-semibold"
          >
            Send reset link
          </button>
        </form>
      ) : (
        <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-4 text-sm">
          If an account exists for{" "}
          <span className="font-mono">{email || "—"}</span>, a reset link has
          been sent.
        </div>
      )}
    </div>
  );
}
