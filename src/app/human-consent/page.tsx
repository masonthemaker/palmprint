"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PiTreePalmDuotone } from "react-icons/pi";
import type { ConsentRequest, SecurityLevel } from "@/lib/consentStore";

type ApiKeyOption = { key: string; tier: SecurityLevel; label: string };

const DEMO_KEYS: ApiKeyOption[] = [
  { key: "pk_demo_low", tier: "low", label: "Low-tier demo key" },
  { key: "pk_demo_med", tier: "medium", label: "Mid-tier demo key" },
  { key: "pk_demo_high", tier: "high", label: "High-tier demo key" },
];

const TOOL_DEFINITION = `{
  "name": "request_human_consent",
  "description": "Request a real-time consent from a human via Palmprint biometric verification before performing a sensitive or irreversible action.",
  "input_schema": {
    "type": "object",
    "properties": {
      "action":               { "type": "string", "description": "What you, the agent, want approval to do." },
      "contact":              { "type": "string", "description": "Email or phone number of the human to notify." },
      "agent_name":           { "type": "string", "description": "Display name of the agent making the request." },
      "api_key":              { "type": "string", "description": "Your Palmprint API key — determines auth-level floor." },
      "payment_required":     { "type": "boolean", "default": false },
      "payment_amount_cents": { "type": "number",  "description": "Required if payment_required=true." },
      "payment_currency":     { "type": "string",  "default": "USD" }
    },
    "required": ["action", "contact", "agent_name", "api_key"]
  }
}`;

function curlExample(origin: string): string {
  return `curl -X POST ${origin}/api/human-consent \\
  -H "Content-Type: application/json" \\
  -d '{
    "action": "Send $50 to alice@example.com via PayPal",
    "contact": "+15551234567",
    "agent_name": "BookingBot",
    "api_key": "pk_demo_high",
    "payment_required": true,
    "payment_amount_cents": 5000,
    "payment_currency": "USD"
  }'`;
}

const STATUS_STYLE: Record<ConsentRequest["status"], string> = {
  pending: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  verified: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  paid: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  denied: "bg-rose-500/15 text-rose-700 border-rose-500/30",
  expired: "bg-zinc-500/15 text-zinc-700 border-zinc-500/30",
};

function fmtAmount(cents?: number, currency = "USD"): string {
  if (cents == null) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export default function HumanConsentDashboard() {
  const [requests, setRequests] = useState<ConsentRequest[]>([]);
  const [origin, setOrigin] = useState("");

  const [form, setForm] = useState({
    action: "Send $50 to alice@example.com via PayPal",
    contact: "alice@example.com",
    agent_name: "BookingBot",
    api_key: "pk_demo_med",
    payment_required: true,
    payment_amount_cents: 5000,
    payment_currency: "USD",
  });

  type CreateResponse = {
    request_id: string;
    verify_url: string;
    derived_level: SecurityLevel;
    status: ConsentRequest["status"];
    contact: string;
    message_to_human: string;
    expires_in_seconds: number;
  };
  const [lastResponse, setLastResponse] = useState<
    CreateResponse | { error: string; fields?: string[] } | null
  >(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setOrigin(window.location.origin), 0);
    return () => clearTimeout(t);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/human-consent", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { requests: ConsentRequest[] };
      setRequests(data.requests);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const initial = setTimeout(() => void refresh(), 0);
    const interval = setInterval(refresh, 3000);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [refresh]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/human-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: form.action,
          contact: form.contact,
          agent_name: form.agent_name,
          api_key: form.api_key,
          payment_required: form.payment_required,
          payment_amount_cents: form.payment_required
            ? form.payment_amount_cents
            : undefined,
          payment_currency: form.payment_currency,
        }),
      });
      const data = await res.json();
      setLastResponse(data);
      void refresh();
    } catch (err) {
      setLastResponse({ error: err instanceof Error ? err.message : "Failed" });
    } finally {
      setSubmitting(false);
    }
  };

  const curl = useMemo(() => curlExample(origin || "http://localhost:3000"), [origin]);

  const isError =
    lastResponse !== null &&
    typeof (lastResponse as { error?: unknown }).error === "string";
  const success = !isError && lastResponse !== null
    ? (lastResponse as CreateResponse)
    : null;

  return (
    <div className="w-full max-w-6xl mx-auto px-5 py-8 flex flex-col gap-8">
      <header className="flex items-center justify-between gap-3">
        <Link
          href="/"
          className="flex items-center gap-3 text-emerald-700 dark:text-emerald-400 hover:opacity-80"
        >
          <PiTreePalmDuotone className="text-4xl" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Agent → Human Consent
            </h1>
            <p className="text-sm opacity-70">
              An AI agent posts to the Palmprint API; the human is notified;
              they prove they&apos;re human; the action is authorized.
            </p>
          </div>
        </Link>
        <Link href="/" className="text-sm text-foreground/70 hover:text-foreground">
          ← Home
        </Link>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-5 flex flex-col gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground/70">
            Tool definition (Anthropic / OpenAI tool-use format)
          </h2>
          <pre className="text-xs font-mono whitespace-pre overflow-x-auto bg-background border border-foreground/10 rounded-lg p-3 text-foreground/90">
            {TOOL_DEFINITION}
          </pre>
          <p className="text-xs text-foreground/60">
            The agent calls this tool; your tool implementation POSTs the
            arguments to <code>/api/human-consent</code> and returns the
            <code> message_to_human</code> + <code>verify_url</code> to the
            agent so it knows the human has been pinged.
          </p>
        </div>

        <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-5 flex flex-col gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground/70">
            HTTP example
          </h2>
          <pre className="text-xs font-mono whitespace-pre overflow-x-auto bg-background border border-foreground/10 rounded-lg p-3 text-foreground/90">
            {curl}
          </pre>
          <div className="text-xs text-foreground/60 flex flex-col gap-1">
            <span>API key tiers (key → derived auth level):</span>
            <ul className="list-disc list-inside font-mono">
              {DEMO_KEYS.map((k) => (
                <li key={k.key}>
                  {k.key} → {k.tier}
                  {k.tier !== "high" && (
                    <span className="opacity-60">
                      {" "}
                      (auto-bumped if payment_required=true)
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-[1fr_22rem] gap-6">
        <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-5 flex flex-col gap-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground/70">
            Simulate an agent calling the tool
          </h2>
          <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 sm:col-span-2 text-sm">
              <span className="font-medium">Action</span>
              <input
                value={form.action}
                onChange={(e) => setForm({ ...form, action: e.target.value })}
                className="px-3 py-2 rounded-lg bg-background border border-foreground/15 text-foreground"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Human contact (email or phone)</span>
              <input
                value={form.contact}
                onChange={(e) => setForm({ ...form, contact: e.target.value })}
                className="px-3 py-2 rounded-lg bg-background border border-foreground/15 text-foreground"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Agent name</span>
              <input
                value={form.agent_name}
                onChange={(e) => setForm({ ...form, agent_name: e.target.value })}
                className="px-3 py-2 rounded-lg bg-background border border-foreground/15 text-foreground"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">API key</span>
              <select
                value={form.api_key}
                onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                className="px-3 py-2 rounded-lg bg-background border border-foreground/15 text-foreground"
              >
                {DEMO_KEYS.map((k) => (
                  <option key={k.key} value={k.key}>
                    {k.key} ({k.tier})
                  </option>
                ))}
                <option value="pk_invalid">pk_invalid (returns 401)</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.payment_required}
                onChange={(e) =>
                  setForm({ ...form, payment_required: e.target.checked })
                }
                className="accent-emerald-500 size-4"
              />
              <span>Payment required</span>
            </label>
            {form.payment_required && (
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Amount (cents)</span>
                <input
                  type="number"
                  value={form.payment_amount_cents}
                  min={1}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      payment_amount_cents: Number(e.target.value),
                    })
                  }
                  className="px-3 py-2 rounded-lg bg-background border border-foreground/15 text-foreground"
                />
              </label>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="sm:col-span-2 px-4 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-semibold disabled:opacity-60"
            >
              {submitting ? "Sending…" : "POST to /api/human-consent"}
            </button>
          </form>

          {success && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                  Created · level={success.derived_level}
                </span>
                <a
                  href={success.verify_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs px-2.5 py-1 rounded-full bg-emerald-500 text-black font-medium"
                >
                  Open verify link →
                </a>
              </div>
              <pre className="text-xs font-mono whitespace-pre-wrap break-all bg-background/60 rounded-md p-2">
                {JSON.stringify(success, null, 2)}
              </pre>
            </div>
          )}
          {isError && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm">
              <pre className="text-xs font-mono whitespace-pre-wrap text-rose-700">
                {JSON.stringify(lastResponse, null, 2)}
              </pre>
            </div>
          )}
        </div>

        <aside className="rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-5 flex flex-col gap-3 h-fit lg:sticky lg:top-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground/70">
              Mock SMS / email log
            </h2>
            <span className="text-[10px] text-foreground/50">
              auto-refresh 3s
            </span>
          </div>
          {requests.length === 0 ? (
            <p className="text-xs text-foreground/55">
              No requests yet — fire one with the form.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {requests.map((r) => (
                <li
                  key={r.id}
                  className="rounded-xl bg-zinc-200/60 dark:bg-zinc-800/60 p-3 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono text-foreground/60 truncate">
                      to: {r.contact}
                    </span>
                    <span
                      className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${STATUS_STYLE[r.status]}`}
                    >
                      {r.status}
                    </span>
                  </div>
                  <p className="text-sm text-foreground leading-snug">
                    <strong>{r.agentName}</strong> is requesting your approval
                    for: &ldquo;{r.action}&rdquo;
                    {r.paymentRequired && (
                      <>
                        {" "}
                        ({fmtAmount(r.paymentAmountCents, r.paymentCurrency)})
                      </>
                    )}
                  </p>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-foreground/55">
                      {timeAgo(r.createdAt)} · level={r.level}
                    </span>
                    <Link
                      href={`/human-consent/verify/${r.id}`}
                      target="_blank"
                      className="text-emerald-700 dark:text-emerald-400 hover:underline"
                    >
                      Verify →
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </section>
    </div>
  );
}
