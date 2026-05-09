# React integration

Palmprint exposes one provider, one hook, one guard, and two widget components. Mount the provider once at the root and pick whichever consumer fits your use case.

## `<PalmprintProvider>`

Owns the global modal and runs the challenge → verify → redeem → upload pipeline.

```tsx
// app/layout.tsx
import { PalmprintProvider } from "@palmprint/react";

<PalmprintProvider
  apiBase="/api/palmprint"   // default
  uploadCaptures={true}      // default
>
  {children}
</PalmprintProvider>;
```

Props:

| Prop | Default | Meaning |
|---|---|---|
| `apiBase` | `"/api/palmprint"` | Base URL for `/challenge`, `/redeem`, `/captures`. Pass `false` to disable the server flow entirely (useful for client-only sandboxes). |
| `uploadCaptures` | `true` | When the user produced captures, upload them to `${apiBase}/captures` after redeem. |

## `usePalmprint()` — action triggers

```tsx
import { usePalmprint } from "@palmprint/react";

const { verify } = usePalmprint();

async function onChangePassword() {
  const { sessionToken } = await verify({
    level: "high",
    reason: "Confirm password change",
    description: "We need to confirm it's really you.",
  });
  await fetch("/api/account/password", {
    method: "POST",
    headers: { Authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify({ new_password }),
  });
}
```

### Options

| Option | Type | Default |
|---|---|---|
| `level` | `"low" \| "medium" \| "high" \| "extra"` | `"medium"` |
| `numTests` | `number` | derived from level (easy/medium = 2, hard = 3, extra = 4) |
| `mode` | `"hand" \| "face" \| "both"` | `"both"` |
| `captureMode` | `"off" \| "photo" \| "video"` | `"off"` |
| `challengeStyle` | `"standard" \| "handedness" \| "two-hand" \| "temporal" \| "max"` | level preset |
| `reason` | `string` | — |
| `description` | `string` | — |
| `challengeToken` | `string` | auto-fetched from `/challenge` if omitted |
| `challengeNonce` | `string` | auto-fetched from `/challenge` if omitted |

Pass `challengeToken` + `challengeNonce` when you've already minted a challenge server-side (e.g. the consent flow does this). The provider will skip the auto-fetch.

Challenge styles are opt-in:

| Style | What it does |
|---|---|
| `standard` | Current Palmprint behavior. Uses MediaPipe's canned gesture pool, including `ILoveYou` for hand prompts. |
| `handedness` | Adds left/right hand requirements to hand prompts. |
| `two-hand` | Requires two simultaneous hand gestures; in `both` mode, adds one face prompt too. |
| `temporal` | Requires ordered prompts, such as `Thumbs Up` then `Thumbs Down`. |
| `max` | Combines ordered prompts, left/right hands, two-hand prompts, `both` mode face prompts, and allows up to 7 tests. |

Level presets:

| Level | Label | Default style |
|---|---|---|
| `low` | Easy | `standard` |
| `medium` | Medium | `handedness` |
| `high` | Hard | `temporal` |
| `extra` | Extra Hard | `max` |

For the detailed preset behavior and maximum combination math, see [Challenge levels](/docs/challenge-levels).

### Result shape

```ts
{
  sessionToken: string;       // HMAC-signed — what you actually send.
  expiresAt: number;          // Unix seconds.
  level: "low" | "medium" | "high" | "extra";
  challengeNonce: string;     // Server-bound nonce for the captures bucket.
  clientToken: string;        // Unsigned — for inspection only.
  captures: Capture[];        // Raw blobs in browser memory.
  uploadedCaptureIds: string[]; // IDs in /api/palmprint/captures.
}
```

### Rejection reasons

The Promise rejects with these messages:

- `"Verification cancelled"` — user closed the modal (×, ESC, or backdrop click).
- `"Superseded by another verification request"` — a second `verify()` call arrived while the first was still in flight.
- `"Redeem failed: <server error>"` — the SDK rejected the token (bad signature, replay, expired, insufficient level, challenge mismatch).
- `"Redeem network error"` — `/redeem` was unreachable.

## `<PalmprintGuard>` — page-level lock

Wraps a route's content. Children mount only after the user passes verification.

```tsx
// app/admin/page.tsx
"use client";
import { PalmprintGuard } from "@palmprint/react";

export default function AdminPage() {
  return (
    <PalmprintGuard
      level="high"
      numTests={3}
      reason="Admin access"
      description="Verify before viewing the admin panel."
    >
      <AdminPanel />
    </PalmprintGuard>
  );
}
```

Props match `RequireOptions`, plus:

| Prop | Default | Meaning |
|---|---|---|
| `autoOpen` | `true` | Pop the modal as soon as the guard mounts. |
| `fallback` | (built-in card) | Custom UI to render while ungated. |
| `onVerified` | — | Called once with the `VerificationResult` after success. |

The protected children are **not in the DOM** until verification succeeds — there's no "render then hide" leak.

## `<VerifyWidget>` — drop-in button

For sign-up / contact / comment forms.

```tsx
import { VerifyWidget } from "@palmprint/react";

<VerifyWidget
  apiBase="/api/palmprint"
  config={{
    label: "Verify with Palmprint",
    shape: "pill",        // pill | rounded | square
    size: "md",           // sm | md | lg
    theme: "emerald",     // emerald | dark | light
    showIcon: true,
    fullWidth: false,
    level: "medium",
    mode: "both",
    numTests: 2,
    captureMode: "off",
    challengeStyle: "handedness",
  }}
  onVerified={({ sessionToken, captures }) => {
    // Send sessionToken to protected endpoints as Authorization: Bearer <token>.
  }}
/>;
```

`apiBase` defaults to manual mode only when omitted. Set it to your Palmprint
server URL so the widget fetches a challenge, redeems the client token, uploads
captures when enabled, and returns a signed `sessionToken`.

## `<CaptchaCheckbox>` — reCAPTCHA-shaped

A drop-in replacement for `<ReCAPTCHA>`-style widgets. Uses the provider, so its `onVerified` payload is the full `VerificationResult` with a signed `sessionToken`.

```tsx
import { CaptchaCheckbox } from "@palmprint/react";

<CaptchaCheckbox
  config={{
    label: "I'm not a robot",
    verifyingLabel: "Verifying…",
    verifiedLabel: "Verified",
    failedLabel: "Try again",
    theme: "light",     // light | dark
    fullWidth: false,
    level: "medium",
    mode: "both",
    numTests: 2,
    captureMode: "off",
    challengeStyle: "handedness",
  }}
  onVerified={({ sessionToken }) => setHiddenInput(sessionToken)}
/>;
```

Visual layout matches reCAPTCHA v2: bordered card, square checkbox on the left, label in the middle, palm-tree mark on the right.

## Pattern reference

| Use case | Pick |
|---|---|
| Whole route is sensitive (`/admin`, `/billing`, `/password-reset`) | `<PalmprintGuard>` |
| One-off action inside a normal page (delete account, withdraw, change password) | `usePalmprint()` |
| Sign-up form, contact form, comment box | `<VerifyWidget>` or `<CaptchaCheckbox>` |
| Migration off reCAPTCHA | `<CaptchaCheckbox>` |
| Non-React site | The standalone [script-tag bundle](/docs/script-tag) |
