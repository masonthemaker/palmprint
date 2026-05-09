// packages/server/src/server.ts
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
var LEVEL_RANK = {
  low: 0,
  medium: 1,
  high: 2
};
var PREFIX_CHALLENGE = "ppc";
var PREFIX_SESSION = "pps";
var CLIENT_PREFIX = "palmprint.";
function b64url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8");
  return buf.toString("base64").replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
function b64urlDecode(s) {
  const padded = s.replaceAll("-", "+").replaceAll("_", "/");
  const padding = "=".repeat((4 - padded.length % 4) % 4);
  return Buffer.from(padded + padding, "base64");
}
function signWithPrefix(secret, payload, prefix) {
  const body = b64url(JSON.stringify(payload));
  const mac = createHmac("sha256", secret).update(`${prefix}.${body}`).digest();
  return `${prefix}.${body}.${b64url(mac)}`;
}
function verifyWithPrefix(secret, token, prefix) {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new PalmprintTokenError("malformed_token", "Token is malformed");
  }
  const [p, body, sig] = parts;
  if (p !== prefix) {
    throw new PalmprintTokenError(
      "wrong_kind",
      `Wrong token kind: expected '${prefix}', got '${p}'`
    );
  }
  const expected = createHmac("sha256", secret).update(`${prefix}.${body}`).digest();
  let actual;
  try {
    actual = b64urlDecode(sig);
  } catch {
    throw new PalmprintTokenError("bad_signature", "Signature decode failed");
  }
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new PalmprintTokenError("bad_signature", "Invalid signature");
  }
  let payload;
  try {
    payload = JSON.parse(b64urlDecode(body).toString("utf8"));
  } catch {
    throw new PalmprintTokenError("bad_payload", "Invalid payload JSON");
  }
  const exp = payload.exp;
  if (typeof exp === "number" && exp < nowSeconds()) {
    throw new PalmprintTokenError("expired", "Token expired");
  }
  return payload;
}
function nowSeconds() {
  return Math.floor(Date.now() / 1e3);
}
var PalmprintTokenError = class extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PalmprintTokenError";
    this.code = code;
  }
};
function createMemoryNonceStore() {
  const used = /* @__PURE__ */ new Map();
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
    }
  };
}
function parseClientToken(token) {
  if (!token.startsWith(CLIENT_PREFIX)) {
    throw new PalmprintTokenError(
      "client_token_invalid",
      `Client token must start with '${CLIENT_PREFIX}'`
    );
  }
  const body = token.slice(CLIENT_PREFIX.length);
  let parsed;
  try {
    parsed = JSON.parse(
      b64urlDecode(body).toString("utf8")
    );
  } catch {
    throw new PalmprintTokenError(
      "client_token_invalid",
      "Could not decode client token"
    );
  }
  if (typeof parsed.exp === "number" && parsed.exp < nowSeconds()) {
    throw new PalmprintTokenError("expired", "Client token expired");
  }
  return parsed;
}
function createPalmprintServer(options) {
  const secret = options.secret;
  if (typeof secret !== "string" || secret.length < 32) {
    throw new PalmprintTokenError(
      "secret_too_short",
      "Palmprint secret must be at least 32 characters"
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
      const payload = {
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
        ctx: opts.context
      };
      return {
        token: signWithPrefix(secret, payload, PREFIX_CHALLENGE),
        nonce,
        payload
      };
    },
    verifyChallenge(token) {
      const payload = verifyWithPrefix(
        secret,
        token,
        PREFIX_CHALLENGE
      );
      if (payload.kind !== "challenge") {
        throw new PalmprintTokenError("wrong_kind", "Not a challenge token");
      }
      return payload;
    },
    async issueSession(input) {
      const challenge = verifyWithPrefix(
        secret,
        input.challengeToken,
        PREFIX_CHALLENGE
      );
      if (challenge.kind !== "challenge") {
        throw new PalmprintTokenError("wrong_kind", "Not a challenge token");
      }
      if (await nonces.has(challenge.nonce)) {
        throw new PalmprintTokenError(
          "nonce_already_consumed",
          "Challenge has already been redeemed"
        );
      }
      const client = parseClientToken(input.clientToken);
      if (client.challenge_nonce !== challenge.nonce) {
        throw new PalmprintTokenError(
          "challenge_nonce_mismatch",
          "Client token does not embed this challenge's nonce"
        );
      }
      const got = LEVEL_RANK[client.level];
      const need = LEVEL_RANK[challenge.required_level];
      if (typeof got !== "number" || got < need) {
        throw new PalmprintTokenError(
          "insufficient_level",
          `Required level '${challenge.required_level}', got '${client.level}'`
        );
      }
      if (typeof client.steps !== "number" || client.steps < challenge.required_steps) {
        throw new PalmprintTokenError(
          "insufficient_steps",
          `Required ${challenge.required_steps} steps, got ${client.steps}`
        );
      }
      await nonces.consume(challenge.nonce, challenge.exp - nowSeconds());
      const now = nowSeconds();
      const ttl = input.ttlSeconds ?? 1800;
      const sessionPayload = {
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
        ctx: challenge.ctx
      };
      return {
        token: signWithPrefix(secret, sessionPayload, PREFIX_SESSION),
        payload: sessionPayload
      };
    },
    verifySession(token) {
      const payload = verifyWithPrefix(
        secret,
        token,
        PREFIX_SESSION
      );
      if (payload.kind !== "session") {
        throw new PalmprintTokenError("wrong_kind", "Not a session token");
      }
      return payload;
    }
  };
}
export {
  PalmprintTokenError,
  createMemoryNonceStore,
  createPalmprintServer,
  parseClientToken
};
//# sourceMappingURL=index.js.map
