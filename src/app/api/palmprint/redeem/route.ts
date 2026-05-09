import { NextRequest, NextResponse } from "next/server";
import { palmprint } from "@/lib/palmprintInstance";
import { PalmprintTokenError } from "@/lib/palmprintServer";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const challengeToken =
    typeof body.challenge_token === "string" ? body.challenge_token : "";
  const clientToken =
    typeof body.client_token === "string" ? body.client_token : "";

  if (!challengeToken || !clientToken) {
    return NextResponse.json(
      { error: "challenge_token and client_token are required" },
      { status: 400 },
    );
  }

  try {
    const result = await palmprint().issueSession({
      challengeToken,
      clientToken,
      ttlSeconds:
        typeof body.session_ttl_seconds === "number"
          ? body.session_ttl_seconds
          : undefined,
      subject: typeof body.subject === "string" ? body.subject : undefined,
    });
    return NextResponse.json({
      session_token: result.token,
      expires_at: result.payload.exp,
      level: result.payload.level,
      steps: result.payload.steps,
      challenge_nonce: result.payload.challenge_nonce,
    });
  } catch (e) {
    if (e instanceof PalmprintTokenError) {
      const status =
        e.code === "nonce_already_consumed" || e.code === "expired"
          ? 409
          : 401;
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status },
      );
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Redemption failed" },
      { status: 500 },
    );
  }
}
