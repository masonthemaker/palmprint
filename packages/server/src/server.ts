// Palmprint server SDK.
//
// HMAC-SHA256 signed challenge + session tokens. The flow:
//
//   1. Server issues a CHALLENGE token (signed) — contains a fresh nonce,
//      the required security level, and an expiration.
//   2. Client hands the challenge nonce to <Palmprint> via the
//      `challengeNonce` prop. Palmprint embeds it in the unsigned client
//      token it produces on success.
//   3. Client returns both tokens to the server. Server REDEEMS them:
//      verifies challenge signature + expiration, parses the unsigned
//      client token, checks level/steps meet the challenge requirements,
//      checks the embedded `challenge_nonce` matches, marks the nonce
//      consumed (single-use), and issues a SESSION token (signed).
//   4. Subsequent requests carry the session token. Server calls
//      verifySession() to authorize.
//
// Honest scope: this prevents anyone without the secret from forging
// session claims, gives you single-use replay protection, and binds each
// verification to a specific server-issued challenge. It does NOT prove
// the user actually performed the gestures — that requires server-side
// liveness checks on captures, which is out of scope for this SDK.

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type {
  ChallengePayload,
  ClientPalmprintPayload,
  SecurityLevel,
  SessionPayload,
} from "@palmprint/core";
export type {
  ChallengePayload,
  ClientPalmprintPayload,
  SecurityLevel,
  SessionPayload,
} from "@palmprint/core";

const LEVEL_RANK: Record<SecurityLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  extra: 3,
};

const PREFIX_CHALLENGE = "ppc";
const PREFIX_SESSION = "pps";
const CLIENT_PREFIX = "palmprint.";

// ---------- base64url ----------

function b64url(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8");
  return buf
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function b64urlDecode(s: string): Buffer {
  const padded = s.replaceAll("-", "+").replaceAll("_", "/");
  const padding = "=".repeat((4 - (padded.length % 4)) % 4);
  return Buffer.from(padded + padding, "base64");
}

// ---------- sign / verify primitives ----------

function signWithPrefix(
  secret: string,
  payload: object,
  prefix: string,
): string {
  const body = b64url(JSON.stringify(payload));
  const mac = createHmac("sha256", secret)
    .update(`${prefix}.${body}`)
    .digest();
  return `${prefix}.${body}.${b64url(mac)}`;
}

function verifyWithPrefix<T>(
  secret: string,
  token: string,
  prefix: string,
): T {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new PalmprintTokenError("malformed_token", "Token is malformed");
  }
  const [p, body, sig] = parts;
  if (p !== prefix) {
    throw new PalmprintTokenError(
      "wrong_kind",
      `Wrong token kind: expected '${prefix}', got '${p}'`,
    );
  }
  const expected = createHmac("sha256", secret)
    .update(`${prefix}.${body}`)
    .digest();
  let actual: Buffer;
  try {
    actual = b64urlDecode(sig);
  } catch {
    throw new PalmprintTokenError("bad_signature", "Signature decode failed");
  }
  if (
    expected.length !== actual.length ||
    !timingSafeEqual(expected, actual)
  ) {
    throw new PalmprintTokenError("bad_signature", "Invalid signature");
  }
  let payload: T;
  try {
    payload = JSON.parse(b64urlDecode(body).toString("utf8")) as T;
  } catch {
    throw new PalmprintTokenError("bad_payload", "Invalid payload JSON");
  }
  const exp = (payload as { exp?: number }).exp;
  if (typeof exp === "number" && exp < nowSeconds()) {
    throw new PalmprintTokenError("expired", "Token expired");
  }
  return payload;
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

// ---------- Errors ----------

export type PalmprintErrorCode =
  | "malformed_token"
  | "wrong_kind"
  | "bad_signature"
  | "bad_payload"
  | "expired"
  | "insufficient_level"
  | "insufficient_steps"
  | "challenge_nonce_mismatch"
  | "nonce_already_consumed"
  | "client_token_invalid"
  | "secret_too_short";

export class PalmprintTokenError extends Error {
  code: PalmprintErrorCode;
  constructor(code: PalmprintErrorCode, message: string) {
    super(message);
    this.name = "PalmprintTokenError";
    this.code = code;
  }
}

// ---------- Nonce store ----------

export type NonceStore = {
  /** Returns true if the nonce has been used; false otherwise. */
  has(nonce: string): boolean | Promise<boolean>;
  /** Marks the nonce as used. ttlSeconds is a hint for storage backends. */
  consume(nonce: string, ttlSeconds: number): void | Promise<void>;
};

/**
 * In-memory nonce store. Single-process only — replace with Redis or a DB
 * for multi-replica deployments.
 */
export function createMemoryNonceStore(): NonceStore {
  const used = new Map<string, number>();
  function gc() {
    const now = nowSeconds();
    for (const [k, exp] of used) {
      if (exp <= now) used.delete(k);
    }
  }
  return {
    has(nonce) {
      gc();
      return used.has(nonce);
    },
    consume(nonce, ttlSeconds) {
      used.set(nonce, nowSeconds() + ttlSeconds);
    },
  };
}

// ---------- Client token parser ----------

export function parseClientToken(token: string): ClientPalmprintPayload {
  if (!token.startsWith(CLIENT_PREFIX)) {
    throw new PalmprintTokenError(
      "client_token_invalid",
      `Client token must start with '${CLIENT_PREFIX}'`,
    );
  }
  const body = token.slice(CLIENT_PREFIX.length);
  let parsed: ClientPalmprintPayload;
  try {
    parsed = JSON.parse(
      b64urlDecode(body).toString("utf8"),
    ) as ClientPalmprintPayload;
  } catch {
    throw new PalmprintTokenError(
      "client_token_invalid",
      "Could not decode client token",
    );
  }
  if (typeof parsed.exp === "number" && parsed.exp < nowSeconds()) {
    throw new PalmprintTokenError("expired", "Client token expired");
  }
  return parsed;
}

// ---------- SDK constructor ----------

export type CreatePalmprintServerOptions = {
  /** HMAC secret. Must be at least 32 characters. */
  secret: string;
  /** Issuer string written into all signed tokens. Defaults to 'palmprint'. */
  issuer?: string;
  /** Default audience for issued tokens. */
  audience?: string;
  /** Backend for single-use nonce tracking. Defaults to in-memory. */
  nonceStore?: NonceStore;
};

export type IssueChallengeOptions = {
  /** Lifetime of the challenge. Defaults to 300 (5 min). */
  ttlSeconds?: number;
  /** Minimum required Palmprint level. Defaults to 'medium'. */
  requiredLevel?: SecurityLevel;
  /** Minimum required step count. Defaults to 2. */
  requiredSteps?: number;
  /** Subject (typically your user id). */
  subject?: string;
  /** Audience override. */
  audience?: string;
  /** Free-form context object — echoed into the resulting session token. */
  context?: Record<string, unknown>;
};

export type IssueSessionInput = {
  challengeToken: string;
  clientToken: string;
  /** Lifetime of the session token. Defaults to 1800 (30 min). */
  ttlSeconds?: number;
  /** Override / set subject on the session token. */
  subject?: string;
};

export type PalmprintServer = {
  issueChallenge(opts?: IssueChallengeOptions): {
    token: string;
    nonce: string;
    payload: ChallengePayload;
  };
  verifyChallenge(token: string): ChallengePayload;
  /**
   * Atomically: verify challenge, parse client token, check level/steps,
   * check challenge_nonce binding, mark nonce consumed, issue session token.
   *
   * Returns a Promise because the nonce store may be async (Redis, DB, etc).
   */
  issueSession(input: IssueSessionInput): Promise<{
    token: string;
    payload: SessionPayload;
  }>;
  verifySession(token: string): SessionPayload;
};

export function createPalmprintServer(
  options: CreatePalmprintServerOptions,
): PalmprintServer {
  const secret = options.secret;
  if (typeof secret !== "string" || secret.length < 32) {
    throw new PalmprintTokenError(
      "secret_too_short",
      "Palmprint secret must be at least 32 characters",
    );
  }
  const issuer = options.issuer ?? "palmprint";
  const defaultAudience = options.audience;
  const nonces = options.nonceStore ?? createMemoryNonceStore();

  return {
    issueChallenge(opts = {}) {
      const now = nowSeconds();
      const ttl = opts.ttlSeconds ?? 300;
      const nonce = randomBytes(16).toString("hex");
      const payload: ChallengePayload = {
        v: 1,
        kind: "challenge",
        iss: issuer,
        aud: opts.audience ?? defaultAudience,
        sub: opts.subject,
        iat: now,
        exp: now + ttl,
        nonce,
        required_level: opts.requiredLevel ?? "medium",
        required_steps: opts.requiredSteps ?? 2,
        ctx: opts.context,
      };
      return {
        token: signWithPrefix(secret, payload, PREFIX_CHALLENGE),
        nonce,
        payload,
      };
    },

    verifyChallenge(token) {
      const payload = verifyWithPrefix<ChallengePayload>(
        secret,
        token,
        PREFIX_CHALLENGE,
      );
      if (payload.kind !== "challenge") {
        throw new PalmprintTokenError("wrong_kind", "Not a challenge token");
      }
      return payload;
    },

    async issueSession(input) {
      const challenge = verifyWithPrefix<ChallengePayload>(
        secret,
        input.challengeToken,
        PREFIX_CHALLENGE,
      );
      if (challenge.kind !== "challenge") {
        throw new PalmprintTokenError("wrong_kind", "Not a challenge token");
      }

      // Check nonce hasn't been used yet (single-use challenges).
      if (await nonces.has(challenge.nonce)) {
        throw new PalmprintTokenError(
          "nonce_already_consumed",
          "Challenge has already been redeemed",
        );
      }

      const client = parseClientToken(input.clientToken);

      // Bind the verification to this challenge.
      if (client.challenge_nonce !== challenge.nonce) {
        throw new PalmprintTokenError(
          "challenge_nonce_mismatch",
          "Client token does not embed this challenge's nonce",
        );
      }

      // Level requirement.
      const got = LEVEL_RANK[client.level];
      const need = LEVEL_RANK[challenge.required_level];
      if (typeof got !== "number" || got < need) {
        throw new PalmprintTokenError(
          "insufficient_level",
          `Required level '${challenge.required_level}', got '${client.level}'`,
        );
      }

      // Steps requirement.
      if (
        typeof client.steps !== "number" ||
        client.steps < challenge.required_steps
      ) {
        throw new PalmprintTokenError(
          "insufficient_steps",
          `Required ${challenge.required_steps} steps, got ${client.steps}`,
        );
      }

      // Mark consumed BEFORE issuing the session token.
      await nonces.consume(challenge.nonce, challenge.exp - nowSeconds());

      const now = nowSeconds();
      const ttl = input.ttlSeconds ?? 1800;
      const sessionPayload: SessionPayload = {
        v: 1,
        kind: "session",
        iss: issuer,
        aud: challenge.aud ?? defaultAudience,
        sub: input.subject ?? challenge.sub,
        iat: now,
        exp: now + ttl,
        nonce: randomBytes(16).toString("hex"),
        level: client.level,
        steps: client.steps,
        items_per_step: client.items_per_step,
        challenge_nonce: challenge.nonce,
        ctx: challenge.ctx,
      };
      return {
        token: signWithPrefix(secret, sessionPayload, PREFIX_SESSION),
        payload: sessionPayload,
      };
    },

    verifySession(token) {
      const payload = verifyWithPrefix<SessionPayload>(
        secret,
        token,
        PREFIX_SESSION,
      );
      if (payload.kind !== "session") {
        throw new PalmprintTokenError("wrong_kind", "Not a session token");
      }
      return payload;
    },
  };
}
