// In-memory store for agent consent requests. Survives Next dev hot reloads
// via globalThis pinning. Not suitable for production — replace with a DB.

export type SecurityLevel = "low" | "medium" | "high" | "extra";

export type ConsentStatus =
  | "pending"
  | "verified"
  | "paid"
  | "denied"
  | "expired";

export type ConsentRequest = {
  id: string;
  agentName: string;
  apiKey: string;
  action: string;
  contact: string;
  paymentRequired: boolean;
  paymentAmountCents?: number;
  paymentCurrency: string;
  level: SecurityLevel;
  status: ConsentStatus;
  createdAt: number;
  updatedAt: number;
  palmprintToken?: string;
  capturesCount?: number;
  paymentLast4?: string;
  paymentName?: string;
  deniedReason?: string;
  /** HMAC-signed challenge issued when this record was created. */
  challengeToken?: string;
  /** Bound nonce — the verify session token must reference this. */
  challengeNonce?: string;
};

declare global {
  var __palmprintConsentStore: Map<string, ConsentRequest> | undefined;
}

const store: Map<string, ConsentRequest> =
  globalThis.__palmprintConsentStore ?? new Map<string, ConsentRequest>();
globalThis.__palmprintConsentStore = store;

const KNOWN_KEYS: Record<string, { tier: SecurityLevel; label: string }> = {
  pk_demo_low: { tier: "low", label: "Low-tier demo key" },
  pk_demo_med: { tier: "medium", label: "Mid-tier demo key" },
  pk_demo_high: { tier: "high", label: "High-tier demo key" },
  pk_demo_extra: { tier: "extra", label: "Extra-tier demo key" },
};

export function isKnownApiKey(apiKey: string): boolean {
  return Object.prototype.hasOwnProperty.call(KNOWN_KEYS, apiKey);
}

export function listDemoKeys(): { key: string; tier: SecurityLevel; label: string }[] {
  return Object.entries(KNOWN_KEYS).map(([key, v]) => ({ key, ...v }));
}

// API-key tier sets a floor; payment requirement bumps the level up.
export function deriveLevel(
  apiKey: string,
  paymentRequired: boolean,
): SecurityLevel {
  const tier = KNOWN_KEYS[apiKey]?.tier ?? "low";
  if (!paymentRequired) return tier;
  if (tier === "low") return "medium";
  if (tier === "medium") return "high";
  return "extra";
}

function shortId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replaceAll("-", "").slice(0, 12);
  }
  return Math.random().toString(36).slice(2, 14);
}

export function createConsent(input: {
  agentName: string;
  apiKey: string;
  action: string;
  contact: string;
  paymentRequired: boolean;
  paymentAmountCents?: number;
  paymentCurrency?: string;
}): ConsentRequest {
  const now = Date.now();
  const req: ConsentRequest = {
    id: shortId(),
    agentName: input.agentName,
    apiKey: input.apiKey,
    action: input.action,
    contact: input.contact,
    paymentRequired: input.paymentRequired,
    paymentAmountCents: input.paymentRequired
      ? input.paymentAmountCents
      : undefined,
    paymentCurrency: input.paymentCurrency ?? "USD",
    level: deriveLevel(input.apiKey, input.paymentRequired),
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };
  store.set(req.id, req);
  return req;
}

export function getConsent(id: string): ConsentRequest | undefined {
  return store.get(id);
}

export function listConsents(): ConsentRequest[] {
  return Array.from(store.values()).sort((a, b) => b.createdAt - a.createdAt);
}

export function updateConsent(
  id: string,
  patch: Partial<ConsentRequest>,
): ConsentRequest | undefined {
  const existing = store.get(id);
  if (!existing) return undefined;
  const next = { ...existing, ...patch, updatedAt: Date.now() };
  store.set(id, next);
  return next;
}

export function clearConsents(): void {
  store.clear();
}
