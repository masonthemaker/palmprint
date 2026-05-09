"use client";

import { useState } from "react";
import { PiTreePalmDuotone } from "react-icons/pi";
import {
  type RequireOptions,
  type VerificationResult,
  usePalmprintGate,
} from "./PalmprintProvider";

export type CaptchaTheme = "light" | "dark";

export type CaptchaCheckboxConfig = {
  /** Idle label. */
  label?: string;
  /** Label while the modal is open. */
  verifyingLabel?: string;
  /** Label after a successful verification. */
  verifiedLabel?: string;
  /** Label if verification was cancelled or failed. */
  failedLabel?: string;
  theme?: CaptchaTheme;
  fullWidth?: boolean;
} & Pick<
  RequireOptions,
  "level" | "mode" | "numTests" | "captureMode" | "challengeNonce"
>;

export const DEFAULT_CAPTCHA_CONFIG: Required<
  Pick<
    CaptchaCheckboxConfig,
    "label" | "verifyingLabel" | "verifiedLabel" | "failedLabel" | "theme" | "fullWidth"
  >
> &
  Pick<CaptchaCheckboxConfig, "level" | "mode" | "numTests" | "captureMode"> = {
  label: "I'm not a robot",
  verifyingLabel: "Verifying…",
  verifiedLabel: "Verified",
  failedLabel: "Try again",
  theme: "light",
  fullWidth: false,
  level: "medium",
  mode: "both",
  numTests: 2,
};

type Phase = "idle" | "loading" | "verified" | "error";

export type CaptchaCheckboxProps = {
  config?: CaptchaCheckboxConfig;
  onVerified?: (result: VerificationResult) => void;
};

export default function CaptchaCheckbox({
  config = {},
  onVerified,
}: CaptchaCheckboxProps) {
  const cfg = { ...DEFAULT_CAPTCHA_CONFIG, ...config };
  const { requireVerification } = usePalmprintGate();
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleClick = async () => {
    if (phase === "verified" || phase === "loading") return;
    setPhase("loading");
    setErrorMsg(null);
    try {
      const result = await requireVerification({
        level: cfg.level,
        mode: cfg.mode,
        numTests: cfg.numTests,
        captureMode: cfg.captureMode,
        challengeNonce: cfg.challengeNonce,
        reason: "Verify you're human",
        description: "Complete the Palmprint challenge to continue.",
      });
      setPhase("verified");
      onVerified?.(result);
    } catch (e) {
      setPhase("error");
      setErrorMsg(e instanceof Error ? e.message : "Cancelled");
    }
  };

  const isDark = cfg.theme === "dark";

  const containerClass = [
    "flex items-stretch gap-3 px-3 py-3 rounded-md border select-none transition",
    isDark
      ? "bg-zinc-900 border-zinc-700 text-zinc-100 hover:bg-zinc-800"
      : "bg-white border-zinc-300 text-zinc-900 hover:shadow-sm",
    cfg.fullWidth ? "w-full" : "w-72",
    phase === "verified" || phase === "loading"
      ? "cursor-default"
      : "cursor-pointer",
  ]
    .filter(Boolean)
    .join(" ");

  const text =
    phase === "idle"
      ? cfg.label
      : phase === "loading"
        ? cfg.verifyingLabel
        : phase === "verified"
          ? cfg.verifiedLabel
          : (errorMsg ?? cfg.failedLabel);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={phase === "verified" || phase === "loading"}
      aria-checked={phase === "verified"}
      role="checkbox"
      className={containerClass}
    >
      <CheckboxIndicator phase={phase} dark={isDark} />
      <span
        className={`flex-1 text-left text-sm font-medium self-center ${
          phase === "error" ? "text-rose-600" : ""
        }`}
      >
        {text}
      </span>
      <div className="flex flex-col items-center justify-center gap-0.5 self-center opacity-80">
        <PiTreePalmDuotone className="text-2xl text-emerald-600 dark:text-emerald-400" />
        <span
          className={`text-[8px] uppercase tracking-wider font-semibold ${
            isDark ? "text-zinc-300" : "text-zinc-600"
          }`}
        >
          Palmprint
        </span>
      </div>
    </button>
  );
}

function CheckboxIndicator({
  phase,
  dark,
}: {
  phase: Phase;
  dark: boolean;
}) {
  const base = "w-7 h-7 self-center rounded-sm border-2 grid place-items-center text-base font-bold transition";

  if (phase === "loading") {
    return (
      <div className={`${base} ${dark ? "border-zinc-600" : "border-zinc-300"}`}>
        <Spinner />
      </div>
    );
  }
  if (phase === "verified") {
    return (
      <div
        className={`${base} bg-emerald-500 border-emerald-500 text-white`}
        aria-hidden
      >
        ✓
      </div>
    );
  }
  if (phase === "error") {
    return (
      <div
        className={`${base} bg-rose-500 border-rose-500 text-white`}
        aria-hidden
      >
        ✕
      </div>
    );
  }
  return (
    <div
      className={`${base} ${dark ? "border-zinc-500 bg-zinc-800" : "border-zinc-400 bg-white"}`}
      aria-hidden
    />
  );
}

function Spinner() {
  return (
    <span
      aria-label="loading"
      className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"
    />
  );
}
