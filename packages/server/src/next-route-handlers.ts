import { createPalmprintServer, type PalmprintServer } from "./server";

export type PalmprintRoutesOptions = {
  secret: string;
  issuer?: string;
  audience?: string;
  palmprint?: PalmprintServer;
};

export function createPalmprintRoutes(options: PalmprintRoutesOptions) {
  const sdk =
    options.palmprint ??
    createPalmprintServer({
      secret: options.secret,
      issuer: options.issuer,
      audience: options.audience,
    });

  async function challenge(req: Request): Promise<Response> {
    let body: Record<string, unknown> = {};
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      // Empty body is fine.
    }
    const result = sdk.issueChallenge({
      requiredLevel:
        typeof body.required_level === "string"
          ? (body.required_level as never)
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
    return Response.json({
      challenge_token: result.token,
      challenge_nonce: result.nonce,
      required_level: result.payload.required_level,
      required_steps: result.payload.required_steps,
      expires_at: result.payload.exp,
    });
  }

  async function redeem(req: Request): Promise<Response> {
    let body: Record<string, unknown> = {};
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const challengeToken =
      typeof body.challenge_token === "string" ? body.challenge_token : "";
    const clientToken =
      typeof body.client_token === "string" ? body.client_token : "";
    if (!challengeToken || !clientToken) {
      return Response.json(
        { error: "challenge_token and client_token are required" },
        { status: 400 },
      );
    }
    const result = await sdk.issueSession({
      challengeToken,
      clientToken,
      ttlSeconds:
        typeof body.session_ttl_seconds === "number"
          ? body.session_ttl_seconds
          : undefined,
      subject: typeof body.subject === "string" ? body.subject : undefined,
    });
    return Response.json({
      session_token: result.token,
      expires_at: result.payload.exp,
      level: result.payload.level,
      steps: result.payload.steps,
      challenge_nonce: result.payload.challenge_nonce,
    });
  }

  return { palmprint: sdk, challenge, redeem };
}

