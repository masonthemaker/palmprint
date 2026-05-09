# SDK Guide — what "great" looks like

Companion to [`gaps.md`](./gaps.md). This is the target shape for Palmprint once everything is wired together. Read it as a north star, not a roadmap — concrete migration steps live elsewhere.

The single guiding principle: **every entry point in the SDK returns a signed session token by default.** The unsigned client token exists, but no integrator should ever need to think about it.

---

## Package layout

Five packages, narrow scopes, semver-able independently.

```
@palmprint/core         Shared types + token format. Zero deps.
@palmprint/react        Provider, hooks, components (button, checkbox, guard).
@palmprint/server       Challenge / redeem / verify. Node-first today.
                        Current sub-path: /next. Target adapters: /redis,
                        /postgres, /express, /hono.
@palmprint/widget       The standalone <script> bundle.
@palmprint/agent        TypeScript client for the human-consent flow + the
                        verify endpoint. Drop-in into any agent framework.
```

Everything else (storage adapters, framework middleware, CLI, dashboard) ships as sub-paths or peer packages so the install size stays predictable.

---

## The 30-second integration

A first-time user should hit working signed verification in under five minutes. Here's the whole tutorial:

### Server (Node today)

```ts
// lib/palmprint.ts
import { createPalmprintServer } from "@palmprint/server";

export const palmprint = createPalmprintServer({
  secret: process.env.PALMPRINT_SECRET!,
});
```

Then expose `/api/palmprint/challenge` and `/api/palmprint/redeem` routes that
call `palmprint.issueChallenge()` and `palmprint.issueSession()`. The demo app
ships those routes. A single mounted route helper is a good future nicety, but
the current OSS package keeps the route files explicit.

### Client

```tsx
// app/layout.tsx
import { PalmprintProvider } from "@palmprint/react";

export default function Layout({ children }) {
  return (
    <PalmprintProvider apiBase="/api/palmprint">
      {children}
    </PalmprintProvider>
  );
}
```

That's it. Every component below now produces signed session tokens.

```tsx
// Anywhere in your app:
import { usePalmprint } from "@palmprint/react";

const { verify } = usePalmprint();

async function onWithdraw() {
  const { sessionToken } = await verify({ level: "high" });
  // sessionToken is HMAC-signed, server-redeemed, ready to send.
  await fetch("/api/withdraw", {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
}
```

The hook fetched a challenge, ran the modal, and redeemed automatically. The integrator never touched the unsigned token.

### Protecting an API route

```ts
// app/api/withdraw/route.ts
import { createPalmprintNext } from "@palmprint/server/next";
import { palmprint } from "@/lib/palmprint";

const { requirePalmprint } = createPalmprintNext(() => palmprint);

export const POST = requirePalmprint({ level: "high" }, async (req, session) => {
  // session.sub, session.level, session.challenge_nonce all available.
  // ... do the thing
  return Response.json({ ok: true });
});
```

`requirePalmprint` returns a 401 if the bearer token is missing/expired/wrong-level, otherwise calls your handler with the verified payload.

That's the whole API for 90% of users.

---

## The component story

Every component in `@palmprint/react` is a thin wrapper around the same `verify()` primitive. Picking one is purely a UX choice.

| Component | When to use |
|---|---|
| `<VerifyButton>` | Sign-up forms, contact forms, "prove you're human" before submit. |
| `<VerifyCheckbox>` | reCAPTCHA replacement, inline form gates. |
| `<VerifyGuard>` | Whole-page lockdown for sensitive routes. |
| `usePalmprint()` | Action triggers (delete account, withdraw, change password). |

All four return the **same shape**:

```ts
{
  sessionToken: string;     // signed, send to your server
  expiresAt: number;
  level: "low" | "medium" | "high";
  challengeNonce: string;
}
```

Captures (raw PNGs / WebMs) live on a separate `onCapture` callback, off the primary path, because most integrators don't need them.

```tsx
<VerifyButton
  level="medium"
  onVerified={({ sessionToken }) => fetch(...)}
  onCapture={(blob, meta) => uploadToS3(blob, meta)}  // optional
/>;
```

---

## Defaults that disappear

The biggest DX win is *not making the user think about things they don't care about.*

- **Secret discovery** — current OSS code supports explicit secrets plus the demo app's local env path. A future package-level default could read `PALMPRINT_SECRET`, fail loudly in production, and generate a stable development secret.
- **Storage** — current OSS code defaults to in-memory nonce tracking. Future adapters should make Redis/Postgres/KV a two-line configuration.
- **Levels** — `medium` is the default for anything money-shaped or destructive. `low` for "is this a bot." `high` for password change / withdraw / impersonation. The README documents the map; the code defaults are calibrated.
- **Capture mode** — `off` by default. Always.
- **Token TTLs** — challenge 5 minutes, session 30 minutes, refresh available via a `/refresh` endpoint that takes a session token and re-issues if not too old.

---

## Server SDK shape

```ts
import { createPalmprint, redisStore } from "@palmprint/server";

const palmprint = createPalmprint({
  secret: process.env.PALMPRINT_SECRET!,
  issuer: "myapp",
  audience: "myapp.com",
  store: redisStore({ url: process.env.REDIS_URL! }),
  rateLimit: { challenge: "10/min/ip", redeem: "20/min/ip" },
  hooks: {
    onSessionIssued: (session, ctx) => analytics.track("verified", session),
  },
});

// ---------- core API ----------
palmprint.issueChallenge(opts);
palmprint.issueSession({ challengeToken, clientToken });
palmprint.verifySession(token);
palmprint.refreshSession(token);   // new

// ---------- framework adapters ----------
palmprint.next.routes();           // mountable handler
palmprint.next.middleware(opts);   // middleware.ts protector
palmprint.express.middleware();
palmprint.hono.middleware();
palmprint.fetch.handler();         // raw fetch-style for any runtime

// ---------- introspection ----------
palmprint.parseSession(token);     // returns payload, throws on bad sig
palmprint.list({ subject });       // session history, audit log
```

The current package is Node-first. A later runtime-portable version should move
shared crypto into `@palmprint/core` and add Edge/Workers/Deno/Bun coverage.

---

## The CAPTCHA-as-default story

The new `<VerifyCheckbox>` matters because most integrators are migrating off reCAPTCHA. It should be a *literal* drop-in:

```diff
- <ReCAPTCHA siteKey={KEY} onChange={setToken} />
+ <VerifyCheckbox onVerified={({ sessionToken }) => setToken(sessionToken)} />
```

For that to actually work:

1. The widget must look unmistakably like reCAPTCHA at a glance — same shape, same checkbox affordance, same brand-strip on the right. ✓ already shipped.
2. The token shape must be a string the server can verify in one call. Today: yes, but only via `palmprint.verifySession`, which integrators won't know about unless they read docs. Fix: ship a `<VerifyForm>` component that is a `<form>` element with a hidden `palmprint_token` input — same migration ergonomics as reCAPTCHA's hidden form field.

---

## Distribution

- Once `@palmprint/widget` is published to npm, jsDelivr can mirror:
  ```html
  <script src="https://cdn.jsdelivr.net/npm/@palmprint/widget@1" defer
          data-api-base="https://api.myapp.com/palmprint"
          data-level="medium"
          data-position="bottom-right"></script>
  ```
- The current bundle defaults `data-api-base` to `/api/palmprint`; set a full URL when embedding on another domain. `data-api-base="false"` is the explicit manual/client-only escape hatch.
- The bundle internally fetches a challenge from `${apiBase}/challenge`, runs the verification, redeems at `${apiBase}/redeem`, and dispatches `palmprint:verified` with `{ sessionToken, expiresAt, level, clientToken }`. Docs should keep `sessionToken` as the happy path.
- Optional `data-widget="checkbox"` swaps to the CAPTCHA-style checkbox from the script-tag side.

---

## Agent SDK

For the human-consent flow:

```ts
import { PalmprintAgent } from "@palmprint/agent";

const agent = new PalmprintAgent({
  apiKey: process.env.PALMPRINT_API_KEY!,
  webhook: "https://myagent.com/palmprint-webhook",
});

const { requestId, verifyUrl } = await agent.requestConsent({
  action: "Send $50 to alice@example.com",
  contact: "alice@example.com",
  paymentAmountCents: 5000,
});

// Two options:
// 1) Block until the user responds (or expiry).
const result = await agent.waitForConsent(requestId);

// 2) Or fire-and-forget; webhook fires when result lands.
```

Webhook signature uses the same HMAC scheme so the agent can verify origin without re-implementing crypto:

```ts
import { verifyWebhook } from "@palmprint/agent";
const event = verifyWebhook(req.headers, await req.text(), { secret });
// event.kind === "consent.verified" | "consent.paid" | "consent.denied"
```

---

## Configurator → published artifact

The `/widget` configurator already emits good snippets. The next step is making the snippet truly drop-in:

- **React/JSX snippet** points at `@palmprint/react`, not at the in-tree path.
- **Script-tag snippet** points at `https://cdn.jsdelivr.net/npm/@palmprint/widget@1`.
- A new **Server** tab emits the matching `app/api/palmprint/[...route]/route.ts` snippet so the user can paste both halves and have a working pipeline.
- A new **Try in CodeSandbox** button forks a runnable project with both snippets pre-wired against a hosted demo backend.

---

## Defaults reference card

To make the README sing, ship a single page of defaults:

| Knob | Default | When to change |
|---|---|---|
| Level | `medium` | `high` for money / auth changes; `low` for spam gates |
| Tests | derived from level | Increase if your fraud rate is high |
| Mode | `both` | `face` only if your users won't show hands; `hand` only for accessibility cases |
| Capture | `off` | `photo` if you have a downstream liveness pipeline |
| Challenge TTL | 300s | Don't change — too long re-opens replay risk |
| Session TTL | 1800s | Match your normal session lifetime |
| Storage | in-memory | **Always change** in prod |
| Rate limit | 10/min challenge, 20/min redeem | Tighten under attack |

---

## What we'd cut

DX comes as much from **what isn't there** as from what is. We should resist:

- Plugin systems for the challenge UI. The challenge is the product.
- Custom gestures. Bigger pool ≠ better security; the rotation already does the work.
- Configurable hold times. Calibrated to a specific FRR/FAR tradeoff.
- A "preview" page in production builds. Demo pages are demo-only.
- Server-side captures storage at v1. Ship the upload hook, let integrators choose where blobs land.

---

## The shape of "done"

The SDK is done when:

1. A new user can `npm install @palmprint/react @palmprint/server`, paste two snippets, and have a working signed verification in under 5 minutes.
2. There is exactly one "verified user" type across the system, and it's `SessionPayload`.
3. No demo, doc, or snippet ever shows the unsigned client token.
4. Every component path passes the same end-to-end test: button click → challenge fetched → modal → redeem → signed token → server middleware accepts.
5. The standalone `<script>` bundle signs by default when `data-api-base` is present or defaults to `/api/palmprint`; manual unsigned mode requires `data-api-base="false"`.
6. The agent SDK can be plugged into a tool-using LLM in three lines.
7. The dashboard at `/human-consent` is replaced with a real operator console that shows token signatures, auth levels, and audit logs — not a debug page.

Everything else is icing.
