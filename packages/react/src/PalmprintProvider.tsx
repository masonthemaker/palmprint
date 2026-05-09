"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { PiTreePalmDuotone } from "react-icons/pi";
import Palmprint, {
  captureFileName,
  type Capture,
  type CaptureMode,
  type ChallengeStyle,
  type Mode,
  type SecurityLevel,
} from "./Palmprint";

/** What the caller actually gets from `requireVerification`. */
export type VerificationResult = {
  /**
   * HMAC-signed session token issued by the server SDK. Send this in an
   * `Authorization: Bearer …` header to your protected endpoints.
   *
   * Empty string when the provider is configured with `apiBase={false}` —
   * in that mode only the unsigned `clientToken` is available.
   */
  sessionToken: string;
  expiresAt: number;
  level: SecurityLevel;
  /** The challenge nonce the server bound this verification to. */
  challengeNonce: string;
  /**
   * The unsigned palmprint.<base64> token. Mostly useful for inspection /
   * debugging; you should rely on `sessionToken` for auth.
   */
  clientToken: string;
  /** Raw blobs still in browser memory. */
  captures: Capture[];
  /** IDs of captures uploaded to /captures (when uploadCaptures is on). */
  uploadedCaptureIds: string[];
};

export type RequireOptions = {
  level?: SecurityLevel;
  numTests?: number;
  mode?: Mode;
  captureMode?: CaptureMode;
  challengeStyle?: ChallengeStyle;
  /** Headline shown above the verification modal. */
  reason?: string;
  /** Subtitle shown above the verification modal. */
  description?: string;
  /**
   * Pre-issued challenge — when supplied, the provider uses it instead of
   * fetching one from `apiBase/challenge`. Useful when the challenge was
   * minted by another flow (e.g. the agent-consent record).
   */
  challengeToken?: string;
  challengeNonce?: string;
};

type Resolver = {
  resolve: (r: VerificationResult) => void;
  reject: (e: Error) => void;
};

export type PalmprintGateContext = {
  requireVerification: (opts?: RequireOptions) => Promise<VerificationResult>;
  isOpen: boolean;
};

export type PalmprintContextValue = PalmprintGateContext & {
  /** Friendly alias for requireVerification. */
  verify: (opts?: RequireOptions) => Promise<VerificationResult>;
};

const PalmprintCtx = createContext<PalmprintGateContext | null>(null);

export type PalmprintProviderProps = {
  children: ReactNode;
  /**
   * API base for /challenge, /redeem, /captures. Defaults to
   * `/api/palmprint`. Pass `false` to disable the server flow entirely
   * (the Promise will resolve with sessionToken: "" and only the
   * unsigned client token will be available).
   */
  apiBase?: string | false;
  /**
   * If true (default) and captures were produced, the provider uploads
   * them to `${apiBase}/captures` after redeem.
   */
  uploadCaptures?: boolean;
};

export function PalmprintProvider({
  children,
  apiBase = "/api/palmprint",
  uploadCaptures = true,
}: PalmprintProviderProps) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<RequireOptions>({});
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const resolverRef = useRef<Resolver | null>(null);
  // Captured during requireVerification → consumed in handleModalVerified.
  const flowRef = useRef<{
    challengeToken?: string;
    challengeNonce?: string;
    level: SecurityLevel;
  } | null>(null);

  const requireVerification = useCallback(
    async (o?: RequireOptions): Promise<VerificationResult> => {
      // Reject any in-flight request — most-recent caller wins.
      resolverRef.current?.reject(
        new Error("Superseded by another verification request"),
      );

      const level = o?.level ?? "medium";

      // 1. Get a challenge — either provided or freshly fetched.
      let challengeToken = o?.challengeToken;
      let challengeNonce = o?.challengeNonce;

      if (!challengeToken && apiBase !== false) {
        try {
          setStatusMsg("Asking server for a challenge…");
          const res = await fetch(`${apiBase}/challenge`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              required_level: level,
              required_steps: o?.numTests,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            challengeToken = data.challenge_token;
            challengeNonce = data.challenge_nonce;
          } else {
            // Don't hard-fail — fall through to client-only mode and warn.
            console.warn(
              `[palmprint] /challenge returned ${res.status}; falling back to unsigned mode`,
            );
          }
        } catch (e) {
          console.warn(
            "[palmprint] could not reach /challenge; falling back to unsigned mode",
            e,
          );
        }
      }

      flowRef.current = { challengeToken, challengeNonce, level };
      setStatusMsg(null);

      return new Promise<VerificationResult>((resolve, reject) => {
        resolverRef.current = { resolve, reject };
        setOpts({ ...o, challengeNonce });
        setOpen(true);
      });
    },
    [apiBase],
  );

  // Modal completion → redeem with the server, then upload captures.
  const handleModalVerified = useCallback(
    async (modalResult: { token: string; captures: Capture[] }) => {
      const resolver = resolverRef.current;
      const flow = flowRef.current;
      resolverRef.current = null;
      flowRef.current = null;
      setOpen(false);

      if (!resolver) return;

      let sessionToken = "";
      let expiresAt = 0;
      const uploadedCaptureIds: string[] = [];

      // 2. Redeem with the server SDK if we have a challenge + apiBase.
      if (flow?.challengeToken && apiBase !== false) {
        try {
          const res = await fetch(`${apiBase}/redeem`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              challenge_token: flow.challengeToken,
              client_token: modalResult.token,
            }),
          });
          const data = await res.json();
          if (!res.ok) {
            resolver.reject(
              new Error(
                data.error
                  ? `Redeem failed: ${data.error}`
                  : `Redeem failed (${res.status})`,
              ),
            );
            return;
          }
          sessionToken = data.session_token;
          expiresAt = data.expires_at;
        } catch (e) {
          resolver.reject(
            e instanceof Error ? e : new Error("Redeem network error"),
          );
          return;
        }
      }

      // 3. Upload captures (best-effort).
      if (
        uploadCaptures &&
        sessionToken &&
        apiBase !== false &&
        modalResult.captures.length > 0
      ) {
        for (const cap of modalResult.captures) {
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
            } else {
              console.warn(
                `[palmprint] capture upload returned ${res.status}`,
              );
            }
          } catch (e) {
            console.warn("[palmprint] capture upload failed", e);
          }
        }
      }

      resolver.resolve({
        sessionToken,
        expiresAt,
        level: flow?.level ?? "medium",
        challengeNonce: flow?.challengeNonce ?? "",
        clientToken: modalResult.token,
        captures: modalResult.captures,
        uploadedCaptureIds,
      });
    },
    [apiBase, uploadCaptures],
  );

  const handleCancel = useCallback(() => {
    const resolver = resolverRef.current;
    resolverRef.current = null;
    flowRef.current = null;
    setOpen(false);
    setStatusMsg(null);
    resolver?.reject(new Error("Verification cancelled"));
  }, []);

  // ESC closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, handleCancel]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <PalmprintCtx.Provider value={{ requireVerification, isOpen: open }}>
      {children}
      {statusMsg && !open && (
        <div className="fixed bottom-4 right-4 z-[1001] px-3 py-2 rounded-full bg-zinc-900 text-zinc-100 text-xs shadow-lg">
          {statusMsg}
        </div>
      )}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCancel();
          }}
        >
          <div className="w-full max-w-xl rounded-2xl bg-zinc-50 dark:bg-zinc-950 p-5 shadow-2xl border border-foreground/10 max-h-[95vh] overflow-y-auto">
            {(opts.reason || opts.description) && (
              <div className="mb-4 flex items-start gap-3">
                <PiTreePalmDuotone className="text-3xl text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                <div className="flex flex-col gap-1">
                  {opts.reason && (
                    <h2 className="text-lg font-bold text-foreground leading-tight">
                      {opts.reason}
                    </h2>
                  )}
                  {opts.description && (
                    <p className="text-sm text-foreground/70 leading-snug">
                      {opts.description}
                    </p>
                  )}
                </div>
              </div>
            )}
            <Palmprint
              initialLevel={opts.level ?? "medium"}
              initialMode={opts.mode ?? "both"}
              initialNumTests={opts.numTests}
              initialCaptureMode={opts.captureMode ?? "off"}
              initialChallengeStyle={opts.challengeStyle}
              challengeNonce={opts.challengeNonce}
              lockSettings
              compact
              autoStart
              onCancel={handleCancel}
              onVerified={handleModalVerified}
            />
          </div>
        </div>
      )}
    </PalmprintCtx.Provider>
  );
}

export function usePalmprintGate(): PalmprintGateContext {
  const ctx = useContext(PalmprintCtx);
  if (!ctx) {
    throw new Error(
      "usePalmprintGate must be used inside <PalmprintProvider>",
    );
  }
  return ctx;
}

export function usePalmprint(): PalmprintContextValue {
  const ctx = usePalmprintGate();
  return {
    ...ctx,
    verify: ctx.requireVerification,
  };
}
