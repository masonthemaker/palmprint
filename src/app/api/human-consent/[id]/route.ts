import { NextRequest, NextResponse } from "next/server";
import { getConsent, updateConsent } from "@/lib/consentStore";
import { palmprint } from "@/lib/palmprintInstance";
import { PalmprintTokenError } from "@/lib/palmprintServer";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const c = getConsent(id);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Don't leak the challengeToken via list endpoints, but return it on the
  // single-record fetch so the verify page can use it.
  return NextResponse.json(c);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const c = getConsent(id);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const action = typeof body.action === "string" ? body.action : "";

  if (action === "verify") {
    if (c.status !== "pending") {
      return NextResponse.json(
        { error: `Cannot verify in state '${c.status}'` },
        { status: 400 },
      );
    }
    const sessionToken =
      typeof body.session_token === "string" ? body.session_token : "";
    if (!sessionToken) {
      return NextResponse.json(
        {
          error:
            "session_token required (HMAC-signed token from /api/palmprint/redeem)",
        },
        { status: 400 },
      );
    }

    let session;
    try {
      session = palmprint().verifySession(sessionToken);
    } catch (e) {
      const code = e instanceof PalmprintTokenError ? e.code : "invalid";
      return NextResponse.json(
        { error: "Invalid session token", code },
        { status: 401 },
      );
    }

    // Bind: the session must reference the challenge we issued for this
    // consent record. Otherwise an attacker could replay a session token
    // earned for some other action.
    if (!c.challengeNonce) {
      return NextResponse.json(
        { error: "Consent record has no bound challenge" },
        { status: 500 },
      );
    }
    if (session.challenge_nonce !== c.challengeNonce) {
      return NextResponse.json(
        {
          error: "Session token is not bound to this consent's challenge",
          code: "challenge_nonce_mismatch",
        },
        { status: 401 },
      );
    }

    // Level enforcement (also enforced at redeem time, but defense in depth).
    const need = c.level;
    const got = session.level;
    if (
      (need === "high" && got !== "high") ||
      (need === "medium" && got === "low")
    ) {
      return NextResponse.json(
        {
          error: `Insufficient verification level: required ${need}, got ${got}`,
          code: "insufficient_level",
        },
        { status: 401 },
      );
    }

    const capturesCount =
      typeof body.captures_count === "number" ? body.captures_count : 0;
    const updated = updateConsent(id, {
      status: "verified",
      palmprintToken: sessionToken,
      capturesCount,
    });
    return NextResponse.json(updated);
  }

  if (action === "pay") {
    if (c.status !== "verified") {
      return NextResponse.json(
        { error: "Verification required before payment" },
        { status: 400 },
      );
    }
    if (!c.paymentRequired) {
      return NextResponse.json(
        { error: "This request does not require payment" },
        { status: 400 },
      );
    }
    const card = String(body.card_number ?? "").replaceAll(/\s+/g, "");
    if (!/^\d{13,19}$/.test(card)) {
      return NextResponse.json(
        { error: "Card number must be 13–19 digits" },
        { status: 400 },
      );
    }
    const name =
      typeof body.cardholder_name === "string" ? body.cardholder_name : "";
    if (!name) {
      return NextResponse.json(
        { error: "cardholder_name required" },
        { status: 400 },
      );
    }
    const updated = updateConsent(id, {
      status: "paid",
      paymentLast4: card.slice(-4),
      paymentName: name,
    });
    return NextResponse.json(updated);
  }

  if (action === "deny") {
    if (c.status === "paid") {
      return NextResponse.json(
        { error: "Cannot deny a paid request" },
        { status: 400 },
      );
    }
    const reason = typeof body.reason === "string" ? body.reason : undefined;
    const updated = updateConsent(id, {
      status: "denied",
      deniedReason: reason,
    });
    return NextResponse.json(updated);
  }

  return NextResponse.json(
    { error: `Unknown action '${action}'` },
    { status: 400 },
  );
}
