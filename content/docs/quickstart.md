# Quickstart

This guide gets you to a working signed verification in five steps.

## 1. Install

```bash
npm install @palmprint/react @palmprint/server @mediapipe/tasks-vision react-icons
```

Inside this repo those packages live under `packages/`. The demo app imports
them through workspace aliases, so the examples match the SDK shape.

## 2. Set the secret

```bash
# .env.local
PALMPRINT_SECRET=replace-with-a-random-string-of-32-or-more-characters
```

In production this is required at startup. In development you can omit it and the SDK will use a stable insecure default with a banner warning.

## 3. Mount the provider

```tsx
// app/layout.tsx
import { PalmprintProvider } from "@palmprint/react";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <PalmprintProvider apiBase="/api/palmprint">
          {children}
        </PalmprintProvider>
      </body>
    </html>
  );
}
```

`apiBase` defaults to `/api/palmprint`. The four routes (`/challenge`, `/redeem`, `/captures`, `/captures/:id`) are already wired in this repo — copy them into your project.

## 4. Trigger a verification

```tsx
"use client";

import { usePalmprint } from "@palmprint/react";

export function WithdrawButton() {
  const { verify } = usePalmprint();

  const onClick = async () => {
    try {
      const { sessionToken } = await verify({
        level: "high",
        reason: "Confirm withdrawal",
      });
      await fetch("/api/withdraw", {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
    } catch (e) {
      // User cancelled, or the server rejected the redeem.
    }
  };

  return <button onClick={onClick}>Withdraw</button>;
}
```

The provider does the whole flow: fetches a challenge, opens the modal, runs the verification, redeems with the server, and uploads any captures. You only ever see the **signed session token**.

## 5. Protect the endpoint

```ts
// app/api/withdraw/route.ts
import { requirePalmprint } from "@/lib/palmprintMiddleware";

export const POST = requirePalmprint(
  { level: "high" },
  async (req, session) => {
    // session is the verified payload — sub, level, challenge_nonce, etc.
    return Response.json({ ok: true });
  },
);
```

That's it. 401 on bad signature, 403 on insufficient level, your handler runs otherwise.

## What just happened

```
Browser                 Provider                  Server
  |                         |                         |
  |  click Withdraw         |                         |
  |------------------------>|                         |
  |                         |  POST /challenge        |
  |                         |------------------------>|
  |                         |     challenge_token,    |
  |                         |     challenge_nonce     |
  |                         |<------------------------|
  |    open modal           |                         |
  |<------------------------|                         |
  |   gestures completed    |                         |
  |------------------------>|                         |
  |                         |  POST /redeem           |
  |                         |  { challenge, client }  |
  |                         |------------------------>|
  |                         |       session_token     |
  |                         |<------------------------|
  |                         |  POST /captures         |
  |                         |------------------------>|
  |    sessionToken         |                         |
  |<------------------------|                         |
  |  POST /withdraw         |                         |
  |  Authorization: Bearer  |                         |
  |--------------------------------------------------->|
  |                         |   requirePalmprint OK   |
  |          200            |                         |
  |<---------------------------------------------------|
```

Every signature, every nonce check, every level enforcement happens in the SDK. You wrote nine lines of code.

## Next steps

- **[React integration](/docs/react)** — full coverage of provider, hooks, guards, and widgets.
- **[Server SDK](/docs/server-sdk)** — the HMAC layer if you want to issue challenges from your own routes.
- **[Captures](/docs/captures)** — turn on PNG / video upload for downstream liveness analysis.
