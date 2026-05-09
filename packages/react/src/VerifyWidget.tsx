"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PiTreePalmDuotone } from "react-icons/pi";
import Palmprint, {
  captureFileName,
  type Capture,
  type CaptureMode,
  type ChallengeStyle,
  type Mode,
  type SecurityLevel,
} from "./Palmprint";

export type WidgetShape = "pill" | "rounded" | "square";
export type WidgetSize = "sm" | "md" | "lg";
export type WidgetTheme = "emerald" | "dark" | "light";

export type WidgetConfig = {
  label: string;
  verifiedLabel: string;
  shape: WidgetShape;
  size: WidgetSize;
  theme: WidgetTheme;
  showIcon: boolean;
  fullWidth: boolean;
  level: SecurityLevel;
  mode: Mode;
  numTests: number;
  captureMode: CaptureMode;
  challengeStyle: ChallengeStyle;
};

export const DEFAULT_WIDGET_CONFIG: WidgetConfig = {
  label: "Verify with Palmprint",
  verifiedLabel: "Verified ✓",
  shape: "pill",
  size: "md",
  theme: "emerald",
  showIcon: true,
  fullWidth: false,
  level: "medium",
  mode: "both",
  numTests: 2,
  captureMode: "off",
  challengeStyle: "handedness",
};

const SHAPE_CLASS: Record<WidgetShape, string> = {
  pill: "rounded-full",
  rounded: "rounded-xl",
  square: "rounded-none",
};

const SIZE_CLASS: Record<WidgetSize, string> = {
  sm: "px-3 py-1.5 text-sm gap-1.5",
  md: "px-5 py-2.5 text-base gap-2",
  lg: "px-7 py-3.5 text-lg gap-2.5",
};

const ICON_SIZE: Record<WidgetSize, string> = {
  sm: "text-base",
  md: "text-xl",
  lg: "text-2xl",
};

const THEME_CLASS: Record<WidgetTheme, string> = {
  emerald:
    "bg-emerald-500 hover:bg-emerald-400 text-black border border-emerald-600",
  dark: "bg-zinc-900 hover:bg-zinc-800 text-emerald-300 border border-zinc-700",
  light:
    "bg-white hover:bg-zinc-50 text-emerald-700 border border-emerald-200 shadow-sm",
};

export type VerifyWidgetProps = {
  config: WidgetConfig;
  /**
   * API base for /challenge, /redeem, /captures. Pass a URL such as
   * "/api/palmprint" or "https://verify.example.com/api/palmprint" to emit a
   * signed session token. Pass false for manual/client-only mode.
   */
  apiBase?: string | false;
  uploadCaptures?: boolean;
  onVerified?: (result: {
    /** Back-compat alias: signed session token when available, otherwise client token. */
    token: string;
    sessionToken: string;
    clientToken: string;
    expiresAt: number;
    challengeNonce: string;
    captures: Capture[];
    uploadedCaptureIds: string[];
  }) => void;
  /**
   * If true, the modal opens immediately on mount (used by the configurator's
   * "Try it" button). The button itself still renders.
   */
  openSignal?: number;
};

export default function VerifyWidget({
  config,
  apiBase = false,
  uploadCaptures = true,
  onVerified,
  openSignal,
}: VerifyWidgetProps) {
  const [open, setOpen] = useState(false);
  const [verifiedToken, setVerifiedToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flow, setFlow] = useState<{
    challengeToken?: string;
    challengeNonce?: string;
  } | null>(null);
  const seenOpenSignalRef = useRef(0);

  // Lock scroll while modal open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const startFlow = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);

    let challengeToken: string | undefined;
    let challengeNonce: string | undefined;

    if (apiBase !== false) {
      try {
        const res = await fetch(`${apiBase}/challenge`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            required_level: config.level,
            required_steps: config.numTests,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error ?? `Challenge failed (${res.status})`);
        }
        challengeToken = data.challenge_token;
        challengeNonce = data.challenge_nonce;
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "Could not start verification";
        setError(msg);
        setBusy(false);
        return;
      }
    }

    setFlow({ challengeToken, challengeNonce });
    setBusy(false);
    setOpen(true);
  }, [apiBase, busy, config.level, config.numTests]);

  useEffect(() => {
    if (openSignal === undefined || openSignal <= 0) return;
    if (seenOpenSignalRef.current === openSignal) return;
    seenOpenSignalRef.current = openSignal;
    const t = setTimeout(() => void startFlow(), 0);
    return () => clearTimeout(t);
  }, [openSignal, startFlow]);

  const handleVerified = useCallback(
    async (result: { token: string; captures: Capture[] }) => {
      let sessionToken = "";
      let expiresAt = 0;
      const uploadedCaptureIds: string[] = [];

      if (apiBase !== false && flow?.challengeToken) {
        try {
          const res = await fetch(`${apiBase}/redeem`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              challenge_token: flow.challengeToken,
              client_token: result.token,
            }),
          });
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data?.error ?? `Redeem failed (${res.status})`);
          }
          sessionToken = data.session_token;
          expiresAt = data.expires_at;
        } catch (e) {
          setError(e instanceof Error ? e.message : "Redeem failed");
          setOpen(false);
          return;
        }
      }

      if (
        uploadCaptures &&
        apiBase !== false &&
        sessionToken &&
        result.captures.length > 0
      ) {
        for (const cap of result.captures) {
          try {
            const fd = new FormData();
            fd.append("file", cap.blob, captureFileName(cap));
            fd.append(
              "meta",
              JSON.stringify({
                type: cap.type,
                prompt: cap.prompt,
                stepIndex: cap.stepIndex,
                ts: cap.ts,
              }),
            );
            const res = await fetch(`${apiBase}/captures`, {
              method: "POST",
              headers: { Authorization: `Bearer ${sessionToken}` },
              body: fd,
            });
            if (res.ok) {
              const data = await res.json();
              if (data?.id) uploadedCaptureIds.push(data.id);
            }
          } catch (e) {
            console.warn("[palmprint] capture upload failed", e);
          }
        }
      }

      const token = sessionToken || result.token;
      setVerifiedToken(token);
      onVerified?.({
        token,
        sessionToken,
        clientToken: result.token,
        expiresAt,
        challengeNonce: flow?.challengeNonce ?? "",
        captures: result.captures,
        uploadedCaptureIds,
      });
      // Close quickly so the parent flow (e.g. payment form) becomes visible.
      setTimeout(() => setOpen(false), 600);
    },
    [apiBase, flow, onVerified, uploadCaptures],
  );

  const buttonClass = [
    "inline-flex items-center justify-center font-semibold transition select-none",
    SHAPE_CLASS[config.shape],
    SIZE_CLASS[config.size],
    THEME_CLASS[config.theme],
    config.fullWidth ? "w-full" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <button
        type="button"
        onClick={() => void startFlow()}
        disabled={busy}
        className={buttonClass}
        aria-label={config.label}
      >
        {config.showIcon && (
          <PiTreePalmDuotone className={ICON_SIZE[config.size]} />
        )}
        <span>
          {busy
            ? "Starting..."
            : verifiedToken
              ? config.verifiedLabel
              : config.label}
        </span>
      </button>
      {error && (
        <p className="mt-2 text-xs text-rose-600 max-w-xs" role="alert">
          {error}
        </p>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-xl rounded-2xl bg-zinc-50 dark:bg-zinc-950 p-5 shadow-2xl border border-foreground/10 max-h-[95vh] overflow-y-auto">
            <Palmprint
              initialLevel={config.level}
              initialMode={config.mode}
              initialNumTests={config.numTests}
              initialCaptureMode={config.captureMode}
              initialChallengeStyle={config.challengeStyle}
              challengeNonce={flow?.challengeNonce}
              lockSettings
              compact
              onCancel={() => setOpen(false)}
              onVerified={handleVerified}
            />
          </div>
        </div>
      )}
    </>
  );
}
