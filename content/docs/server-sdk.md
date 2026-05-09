# Server SDK

The HMAC sign / verify / replay-protection layer. Import it from
`@palmprint/server`. The React provider talks to it through the
`/api/palmprint/*` endpoints, but you can call it directly when you need to
mint challenges from your own routes.

Using Go on the backend? See [Go SDK](/docs/go). It exposes the same signed
challenge/redeem/session flow through `github.com/palmprint/palmprint-go`.

## Setup

```ts
// src/lib/palmprintInstance.ts
import { createPalmprintServer } from "@palmprint/server";

export const palmprint = () => createPalmprintServer({
  secret: process.env.PALMPRINT_SECRET!,   // ≥ 32 chars
  issuer: process.env.PALMPRINT_ISSUER ?? "palmprint",
});
```

The repo wraps this in a lazy `globalThis` singleton so HMR doesn't recreate the SDK on every reload. Use the same pattern in your app.

## Issue a challenge

Usually done via the auto-flow, but you can call it manually if you want to bind it to your own record:

```ts
import { palmprint } from "@/lib/palmprintInstance";

const { token, nonce } = palmprint().issueChallenge({
  requiredLevel: "high",
  requiredSteps: 3,
  ttlSeconds: 300,
  subject: `user:${userId}`,
  context: { intent: "delete_account" },
});

// Send `nonce` to the client and call verify({ challengeToken: token, challengeNonce: nonce })
// — the provider will use this challenge instead of fetching a fresh one.
```

## Issue a session

The redeem step. Called by `/api/palmprint/redeem` on your behalf in the React flow. Usually you don't need to invoke this directly.

```ts
const { token: sessionToken, payload } = await palmprint().issueSession({
  challengeToken,
  clientToken,
  ttlSeconds: 1800,
  subject: `user:${userId}`,
});
```

What it does:

1. Verifies the challenge token's signature and expiry.
2. Parses the unsigned client token.
3. Checks the client's embedded `challenge_nonce` matches the challenge being redeemed.
4. Enforces the `requiredLevel` and `requiredSteps` from the challenge.
5. Marks the challenge nonce consumed (single-use replay protection).
6. Mints and signs a new session token.

## Verify a session

```ts
import { PalmprintTokenError } from "@palmprint/server";
import { palmprint } from "@/lib/palmprintInstance";

try {
  const session = palmprint().verifySession(token);
  // → { v, kind: "session", iss, sub, iat, exp, nonce, level, steps,
  //     items_per_step, challenge_nonce, ctx }
} catch (e) {
  if (e instanceof PalmprintTokenError) {
    // e.code: see "Errors" below
  }
}
```

For most route protection use the [middleware helper](/docs/middleware) instead — it wraps this and handles the `Authorization` header parsing.

## Token formats

Both tokens use HMAC-SHA256 over `prefix.payload`, base64url-encoded, compared with `timingSafeEqual`. They're JWT-shaped but with explicit `kind` so a session token can't be passed off as a challenge or vice-versa.

- **Challenge:** `ppc.<b64payload>.<b64sig>`
- **Session:** `pps.<b64payload>.<b64sig>`
- **Client (unsigned, browser-issued):** `palmprint.<b64payload>`

See [Token formats](/docs/tokens) for the full payload schemas.

## Replay protection

`issueSession` calls `nonceStore.consume(challenge.nonce, ttl)` before returning. The default store is in-memory; pass your own to support multi-replica deployments:

```ts
import { createPalmprintServer, type NonceStore } from "@palmprint/server";

const redisStore: NonceStore = {
  async has(nonce) {
    return Boolean(await redis.get(`pp:n:${nonce}`));
  },
  async consume(nonce, ttlSeconds) {
    await redis.set(`pp:n:${nonce}`, "1", "EX", ttlSeconds);
  },
};

const palmprint = createPalmprintServer({ secret, nonceStore: redisStore });
```

## Challenge binding

The browser's unsigned client token embeds `challenge_nonce` (the React provider always passes this). `issueSession` rejects with `challenge_nonce_mismatch` if the embedded nonce doesn't match the challenge being redeemed — so a token earned for request A can't be replayed to authorize request B.

## Errors

Throws `PalmprintTokenError` with one of these `code`s:

| Code | Meaning |
|---|---|
| `malformed_token` | Token doesn't have three dot-separated parts. |
| `wrong_kind` | `ppc` token where `pps` was expected, or vice-versa. |
| `bad_signature` | HMAC didn't match. |
| `bad_payload` | Payload isn't valid JSON. |
| `expired` | `exp` claim is in the past. |
| `insufficient_level` | Client token's level is below the challenge's `required_level`. |
| `insufficient_steps` | Client token's step count is below the challenge's `required_steps`. |
| `challenge_nonce_mismatch` | Client token doesn't embed this challenge's nonce. |
| `nonce_already_consumed` | Challenge nonce was already redeemed. |
| `client_token_invalid` | Client token doesn't have the `palmprint.` prefix. |
| `secret_too_short` | SDK was constructed with a secret < 32 chars. |

The redeem endpoint maps these to `401` (auth) and `409` (replay/expired).

## Configuration

| Env var | Required | Meaning |
|---|---|---|
| `PALMPRINT_SECRET` | yes (in prod) | HMAC secret, ≥ 32 chars. |
| `PALMPRINT_ISSUER` | no | `iss` claim on issued tokens. Defaults to `"palmprint"`. |

In development the SDK uses a stable insecure default if `PALMPRINT_SECRET` is unset, with a one-time warning. Production throws at startup.

## Honest scope

This SDK prevents anyone without the secret from forging session claims, gives you single-use replay protection, and binds each verification to a specific server-issued challenge. It does **not** prove the human actually performed the gestures — that needs server-side liveness checks on captures (the bucket is shipped; the analyzer is not).
