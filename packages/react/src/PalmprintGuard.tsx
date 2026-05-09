"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { PiTreePalmDuotone } from "react-icons/pi";
import {
  type RequireOptions,
  type VerificationResult,
  usePalmprintGate,
} from "./PalmprintProvider";

export type PalmprintGuardProps = RequireOptions & {
  children: ReactNode;
  /** Called once after a successful verification. */
  onVerified?: (result: VerificationResult) => void;
  /** Custom UI to render while ungated. Defaults to a card with a verify button. */
  fallback?: ReactNode;
  /** If true (default), pop the modal automatically when the guard mounts. */
  autoOpen?: boolean;
};

/**
 * Page-level Palmprint gate. Renders {children} only after the user has
 * passed verification. Use for sensitive routes like password reset.
 */
export function PalmprintGuard({
  children,
  level = "medium",
  numTests,
  mode,
  captureMode,
  challengeStyle,
  reason = "Verification required",
  description,
  onVerified,
  fallback,
  autoOpen = true,
}: PalmprintGuardProps) {
  const { requireVerification } = usePalmprintGate();
  const [verified, setVerified] = useState<VerificationResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const triggered = useRef(false);

  const trigger = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      const result = await requireVerification({
        level,
        numTests,
        mode,
        captureMode,
        challengeStyle,
        reason,
        description,
      });
      setVerified(result);
      onVerified?.(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cancelled");
    } finally {
      setPending(false);
    }
  }, [
    requireVerification,
    level,
    numTests,
    mode,
    captureMode,
    challengeStyle,
    reason,
    description,
    onVerified,
  ]);

  useEffect(() => {
    if (!autoOpen || triggered.current) return;
    triggered.current = true;
    const t = setTimeout(() => void trigger(), 0);
    return () => clearTimeout(t);
  }, [autoOpen, trigger]);

  if (verified) return <>{children}</>;
  if (fallback !== undefined) return <>{fallback}</>;

  return (
    <div className="flex flex-1 items-center justify-center min-h-[60vh] px-4">
      <div className="max-w-md w-full rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-6 flex flex-col items-center gap-3 text-center">
        <PiTreePalmDuotone className="text-5xl text-emerald-700 dark:text-emerald-400" />
        <h1 className="text-xl font-bold text-foreground">{reason}</h1>
        {description && (
          <p className="text-sm text-foreground/70">{description}</p>
        )}
        <p className="text-[11px] uppercase tracking-wider text-foreground/55">
          Auth level: {level}
        </p>
        {error && <p className="text-xs text-rose-600">{error}</p>}
        <button
          onClick={() => void trigger()}
          disabled={pending}
          className="mt-1 px-5 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-semibold disabled:opacity-60"
        >
          {pending ? "Waiting…" : "Verify with Palmprint"}
        </button>
      </div>
    </div>
  );
}
