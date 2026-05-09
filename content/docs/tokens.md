# Token formats

Palmprint deals with **two** tokens. You almost always work with the second one; the first is only handled internally by the React provider.

## Client token (unsigned)

The browser produces this when the user passes the challenge.

```
palmprint.<base64url-payload>
```

Payload:

```json
{
  "v": 1,
  "iss": "palmprint",
  "iat": 1730000000,
  "exp": 1730000300,
  "nonce": "9b8a...",
  "level": "medium",
  "steps": 2,
  "items_per_step": 2,
  "challenge_nonce": "abc123…"
}
```

Fields:

| Field | Type | Meaning |
|---|---|---|
| `v` | number | Format version. Currently `1`. |
| `iss` | string | Hardcoded `"palmprint"`. |
| `iat` | number | Issued-at, Unix seconds. |
| `exp` | number | Expiry. The browser sets this to `iat + 300` (5 min). |
| `nonce` | string | Random per-token nonce (browser-generated). |
| `level` | string | `"low" \| "medium" \| "high"` — the level the user actually completed. |
| `steps` | number | How many distinct challenges they passed. |
| `items_per_step` | number | 1 (low) or 2 (medium / high). |
| `challenge_nonce` | string | The server-issued challenge nonce. **Critical** — this is what binds the verification to a specific request. |

This token is **not signed**. Anyone could forge one. It exists as input to `palmprint().issueSession({ challengeToken, clientToken })` — the SDK validates the embedded `challenge_nonce` matches the challenge being redeemed before issuing a real session.

You'll only see this token directly if you're writing a non-React integration, or you read `result.clientToken` from `verify()`.

## Session token (HMAC-signed)

The server SDK produces this after the redeem step.

```
pps.<base64url-payload>.<base64url-hmac-sha256>
```

Payload:

```json
{
  "v": 1,
  "kind": "session",
  "iss": "palmprint",
  "aud": "your-audience",
  "sub": "user:123",
  "iat": 1730000000,
  "exp": 1730001800,
  "nonce": "...",
  "level": "medium",
  "steps": 2,
  "items_per_step": 2,
  "challenge_nonce": "abc123…",
  "ctx": { "intent": "delete_account" }
}
```

Fields beyond the client-token set:

| Field | Type | Meaning |
|---|---|---|
| `kind` | string | Always `"session"`. Used to distinguish from challenge tokens at verify time. |
| `aud` | string? | Audience. Set on the SDK constructor or per-call. |
| `sub` | string? | Subject. Pass via `issueSession({ subject })` — typically your user id. |
| `ctx` | object? | Free-form context echoed from the original challenge's `context`. |

The signature is HMAC-SHA256 over `pps.<b64payload>` using `PALMPRINT_SECRET`, base64url-encoded, no padding. Compared with `timingSafeEqual` to defeat timing attacks.

This is the token you put in `Authorization: Bearer …` on every protected request. Verify with `palmprint().verifySession(token)` or — better — wrap your route with the [`requirePalmprint` middleware](/docs/middleware).

## Challenge token

You usually don't see this directly — the React provider fetches it, hands the nonce to the browser, and sends it to the redeem endpoint. The format:

```
ppc.<base64url-payload>.<base64url-hmac-sha256>
```

Payload:

```json
{
  "v": 1,
  "kind": "challenge",
  "iss": "palmprint",
  "aud": "your-audience",
  "sub": "consent:abc",
  "iat": 1730000000,
  "exp": 1730000300,
  "nonce": "abc123…",
  "required_level": "high",
  "required_steps": 3,
  "ctx": { "consent_id": "abc" }
}
```

The `nonce` is what the browser embeds in the unsigned client token, and what the server marks consumed (single-use) at redeem time.

## Why three formats

- **Client tokens** are unsigned because there's no shared secret in the browser.
- **Challenge** and **session** tokens both need signatures, but they have different lifetimes and different verification semantics (a challenge can only be consumed once; a session is reusable until expiry). The `kind` field plus distinct prefixes (`ppc`, `pps`) prevent one being passed off as the other.
- All three use base64url so they're URL-safe — any of them can be put in a query string, a header, or a cookie without escaping.

## Inspecting a token

The unsigned client token is just base64url JSON — decode it however you like. The signed tokens have the same shape on the body, but you'd want to call `palmprint().verifyChallenge(token)` or `palmprint().verifySession(token)` so you also get the signature check + expiry enforcement.
