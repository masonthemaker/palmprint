import { NextRequest, NextResponse } from "next/server";
import {
  createConsent,
  isKnownApiKey,
  listConsents,
  updateConsent,
} from "@/lib/consentStore";
import { palmprint } from "@/lib/palmprintInstance";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body must be an object" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const action = typeof b.action === "string" ? b.action.trim() : "";
  const contact = typeof b.contact === "string" ? b.contact.trim() : "";
  const agentName =
    typeof b.agent_name === "string" ? b.agent_name.trim() : "";
  const apiKey = typeof b.api_key === "string" ? b.api_key.trim() : "";
  const paymentRequired = b.payment_required === true;
  const paymentAmountCents =
    typeof b.payment_amount_cents === "number" &&
    Number.isFinite(b.payment_amount_cents)
      ? Math.max(0, Math.round(b.payment_amount_cents))
      : undefined;
  const paymentCurrency =
    typeof b.payment_currency === "string"
      ? b.payment_currency.toUpperCase()
      : "USD";

  const missing: string[] = [];
  if (!action) missing.push("action");
  if (!contact) missing.push("contact");
  if (!agentName) missing.push("agent_name");
  if (!apiKey) missing.push("api_key");
  if (paymentRequired && (paymentAmountCents == null || paymentAmountCents <= 0)) {
    missing.push("payment_amount_cents (required when payment_required=true)");
  }
  if (missing.length > 0) {
    return NextResponse.json(
      { error: "Missing or invalid fields", fields: missing },
      { status: 400 },
    );
  }

  if (!isKnownApiKey(apiKey)) {
    return NextResponse.json(
      { error: "Unknown api_key" },
      { status: 401 },
    );
  }

  const consent = createConsent({
    agentName,
    apiKey,
    action,
    contact,
    paymentRequired,
    paymentAmountCents,
    paymentCurrency,
  });

  // Mint a Palmprint challenge bound to this consent record. The verify
  // page hands these to <PalmprintProvider> so the issued session token
  // is bound to this specific request.
  const challenge = palmprint().issueChallenge({
    requiredLevel: consent.level,
    requiredSteps: consent.level === "high" ? 3 : 2,
    ttlSeconds: 600,
    subject: `consent:${consent.id}`,
    context: {
      consent_id: consent.id,
      agent: consent.agentName,
      payment_required: consent.paymentRequired,
    },
  });
  updateConsent(consent.id, {
    challengeToken: challenge.token,
    challengeNonce: challenge.nonce,
  });

  const origin = req.nextUrl.origin;
  const verifyUrl = `${origin}/human-consent/verify/${consent.id}`;
  const sms = `${consent.agentName} is requesting your approval for: "${consent.action}". Verify here: ${verifyUrl}`;

  return NextResponse.json(
    {
      request_id: consent.id,
      verify_url: verifyUrl,
      derived_level: consent.level,
      status: consent.status,
      contact: consent.contact,
      message_to_human: sms,
      expires_in_seconds: 600,
    },
    { status: 201 },
  );
}

export async function GET() {
  return NextResponse.json({ requests: listConsents() });
}
