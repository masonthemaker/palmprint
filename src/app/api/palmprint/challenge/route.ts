import { NextRequest, NextResponse } from "next/server";
import { palmprint } from "@/lib/palmprintInstance";
import {
  PalmprintTokenError,
  type SecurityLevel,
} from "@/lib/palmprintServer";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    // Empty body is fine — all options are optional.
  }

  try {
    const result = palmprint().issueChallenge({
      requiredLevel:
        typeof body.required_level === "string"
          ? (body.required_level as SecurityLevel)
          : undefined,
      requiredSteps:
        typeof body.required_steps === "number"
          ? body.required_steps
          : undefined,
      ttlSeconds:
        typeof body.ttl_seconds === "number" ? body.ttl_seconds : undefined,
      subject: typeof body.subject === "string" ? body.subject : undefined,
      audience: typeof body.audience === "string" ? body.audience : undefined,
      context:
        body.context && typeof body.context === "object"
          ? (body.context as Record<string, unknown>)
          : undefined,
    });
    return NextResponse.json({
      challenge_token: result.token,
      challenge_nonce: result.nonce,
      required_level: result.payload.required_level,
      required_steps: result.payload.required_steps,
      expires_at: result.payload.exp,
    });
  } catch (e) {
    if (e instanceof PalmprintTokenError) {
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to issue challenge" },
      { status: 500 },
    );
  }
}
