"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PiTreePalmDuotone } from "react-icons/pi";
import { usePalmprint } from "@palmprint/react";
import type { ConsentRequest } from "@/lib/consentStore";

function fmtAmount(cents?: number, currency = "USD"): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export default function VerifyPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { verify } = usePalmprint();

  const [req, setReq] = useState<ConsentRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [card, setCard] = useState({
    cardholder_name: "",
    card_number: "",
    expiry: "",
    cvc: "",
    zip: "",
  });
  const [paymentError, setPaymentError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/human-consent/${id}`, {
          cache: "no-store",
        });
        if (cancelled) return;
        if (res.status === 404) {
          setError("This consent request was not found or has expired.");
          return;
        }
        const data = (await res.json()) as ConsentRequest;
        if (!cancelled) setReq(data);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load request.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const startVerification = useCallback(async () => {
    if (!req?.challengeToken || !req?.challengeNonce) {
      setError("Consent record is missing its bound challenge.");
      return;
    }
    setSubmitting(true);
    try {
      // The provider takes our pre-issued challenge, runs the modal,
      // redeems with the server, and resolves with a signed session token.
      const result = await verify({
        level: req.level,
        numTests: req.level === "extra" ? 4 : req.level === "high" ? 3 : 2,
        mode: "both",
        captureMode: "off",
        challengeToken: req.challengeToken,
        challengeNonce: req.challengeNonce,
        reason: `Approve request from ${req.agentName}`,
        description: req.action,
      });

      const res = await fetch(`/api/human-consent/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify",
          session_token: result.sessionToken,
          captures_count: result.captures.length,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Verification submission failed.");
        return;
      }
      setReq(data);
    } catch (e) {
      // verify rejects on cancel — stay on this page.
      const msg = e instanceof Error ? e.message : "Cancelled";
      if (msg !== "Verification cancelled") setError(msg);
    } finally {
      setSubmitting(false);
    }
  }, [id, req, verify]);

  const onDeny = useCallback(async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/human-consent/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "deny",
          reason: "Denied by human via verify page.",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not deny request.");
        return;
      }
      setReq(data);
    } finally {
      setSubmitting(false);
    }
  }, [id]);

  const onPay = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setPaymentError(null);
      const cardNumber = card.card_number.replaceAll(/\s+/g, "");
      if (!/^\d{13,19}$/.test(cardNumber)) {
        setPaymentError("Card number must be 13–19 digits.");
        return;
      }
      if (!card.cardholder_name.trim()) {
        setPaymentError("Cardholder name is required.");
        return;
      }
      setSubmitting(true);
      try {
        const res = await fetch(`/api/human-consent/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "pay",
            cardholder_name: card.cardholder_name,
            card_number: cardNumber,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setPaymentError(data.error ?? "Payment submission failed.");
          return;
        }
        setReq(data);
      } finally {
        setSubmitting(false);
      }
    },
    [card, id],
  );

  if (error) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 flex flex-col gap-3 items-center text-center">
        <PiTreePalmDuotone className="text-5xl text-emerald-700 dark:text-emerald-400" />
        <h1 className="text-xl font-semibold">Couldn&apos;t open this request</h1>
        <p className="text-sm text-foreground/70">{error}</p>
        <Link
          href="/human-consent"
          className="text-sm text-emerald-700 dark:text-emerald-400 hover:underline"
        >
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  if (!req) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center text-sm text-foreground/70">
        Loading…
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-10 flex flex-col gap-6">
      <header className="flex items-center gap-3 text-emerald-700 dark:text-emerald-400">
        <PiTreePalmDuotone className="text-4xl" />
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Approval requested
          </h1>
          <p className="text-xs opacity-70">
            request id <span className="font-mono">{req.id}</span>
          </p>
        </div>
      </header>

      <section className="rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs uppercase tracking-wider text-foreground/55">
            From
          </span>
          <span className="text-xs uppercase tracking-wider text-foreground/55">
            Auth level: <span className="text-foreground">{req.level}</span>
          </span>
        </div>
        <p className="text-base">
          <strong>{req.agentName}</strong> is requesting your approval to:
        </p>
        <blockquote className="rounded-lg border-l-4 border-emerald-500 bg-foreground/5 p-3 text-foreground/90 text-sm leading-relaxed">
          {req.action}
        </blockquote>
        {req.paymentRequired && (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-sm text-amber-800 dark:text-amber-300">
            <span className="font-semibold">Payment requested:</span>{" "}
            {fmtAmount(req.paymentAmountCents, req.paymentCurrency)}
          </div>
        )}
      </section>

      {req.status === "pending" && (
        <section className="flex flex-col gap-3">
          <p className="text-sm text-foreground/70">
            Click below to start the camera challenge.{" "}
            {req.paymentRequired &&
              "A payment form will appear after you verify."}
          </p>
          <button
            onClick={() => void startVerification()}
            disabled={submitting}
            className="w-full px-5 py-3 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-base inline-flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <PiTreePalmDuotone className="text-2xl" />
            <span>Verify to approve {req.agentName}</span>
          </button>
          <button
            onClick={onDeny}
            disabled={submitting}
            className="px-4 py-2 rounded-full bg-rose-500/10 text-rose-700 hover:bg-rose-500/20 border border-rose-500/30 text-sm font-medium disabled:opacity-60"
          >
            Deny request
          </button>
          {submitting && (
            <p className="text-xs text-foreground/55 text-center">
              Recording approval…
            </p>
          )}
        </section>
      )}

      {req.status === "verified" && (
        <>
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-sm text-emerald-700 dark:text-emerald-300">
            ✓ Identity verified
            {req.paymentRequired && " — confirm payment to authorize."}
          </div>

          {req.paymentRequired ? (
            <section className="rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-5 flex flex-col gap-3">
              <h2 className="text-sm font-semibold">
                Confirm payment of{" "}
                <span className="text-emerald-700 dark:text-emerald-400">
                  {fmtAmount(req.paymentAmountCents, req.paymentCurrency)}
                </span>
              </h2>
              <form onSubmit={onPay} className="grid grid-cols-2 gap-3 text-sm">
                <label className="flex flex-col gap-1 col-span-2">
                  <span className="font-medium">Cardholder name</span>
                  <input
                    value={card.cardholder_name}
                    onChange={(e) =>
                      setCard({ ...card, cardholder_name: e.target.value })
                    }
                    placeholder="Jane Doe"
                    className="px-3 py-2 rounded-lg bg-background border border-foreground/15 text-foreground"
                  />
                </label>
                <label className="flex flex-col gap-1 col-span-2">
                  <span className="font-medium">Card number</span>
                  <input
                    inputMode="numeric"
                    value={card.card_number}
                    onChange={(e) =>
                      setCard({ ...card, card_number: e.target.value })
                    }
                    placeholder="4242 4242 4242 4242"
                    className="px-3 py-2 rounded-lg bg-background border border-foreground/15 text-foreground font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-medium">Expiry</span>
                  <input
                    value={card.expiry}
                    onChange={(e) =>
                      setCard({ ...card, expiry: e.target.value })
                    }
                    placeholder="MM/YY"
                    className="px-3 py-2 rounded-lg bg-background border border-foreground/15 text-foreground font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-medium">CVC</span>
                  <input
                    value={card.cvc}
                    onChange={(e) =>
                      setCard({ ...card, cvc: e.target.value })
                    }
                    placeholder="123"
                    className="px-3 py-2 rounded-lg bg-background border border-foreground/15 text-foreground font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1 col-span-2">
                  <span className="font-medium">Billing ZIP / postal</span>
                  <input
                    value={card.zip}
                    onChange={(e) => setCard({ ...card, zip: e.target.value })}
                    placeholder="94110"
                    className="px-3 py-2 rounded-lg bg-background border border-foreground/15 text-foreground"
                  />
                </label>
                {paymentError && (
                  <p className="col-span-2 text-xs text-rose-600">
                    {paymentError}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="col-span-2 px-4 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-semibold disabled:opacity-60"
                >
                  {submitting ? "Processing…" : "Confirm & pay"}
                </button>
              </form>
              <p className="text-[11px] text-foreground/50">
                Demo only — card data is not transmitted to a real processor.
                The server stores the last 4 digits and cardholder name.
              </p>
            </section>
          ) : (
            <ApprovedCard req={req} />
          )}
        </>
      )}

      {req.status === "paid" && <ApprovedCard req={req} />}

      {req.status === "denied" && (
        <section className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-5 text-sm">
          <span className="text-rose-700 dark:text-rose-300 font-semibold text-lg">
            ✗ Denied
          </span>
          <p className="mt-1">
            You denied this request. {req.agentName} has not been authorized.
          </p>
        </section>
      )}
    </div>
  );
}

function ApprovedCard({ req }: { req: ConsentRequest }) {
  return (
    <section className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-5 flex flex-col gap-2 text-sm">
      <span className="text-emerald-700 dark:text-emerald-300 font-semibold text-lg">
        ✓ Approved
      </span>
      <p>
        <strong>{req.agentName}</strong> is now authorized to:
      </p>
      <blockquote className="rounded-md bg-background/60 p-2 text-foreground/85">
        {req.action}
      </blockquote>
      {req.status === "paid" && (
        <p className="text-foreground/80">
          Paid {fmtAmount(req.paymentAmountCents, req.paymentCurrency)} with
          card ending in{" "}
          <span className="font-mono">•••• {req.paymentLast4}</span>.
        </p>
      )}
    </section>
  );
}
