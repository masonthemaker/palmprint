# Middleware

Wrap any Next.js route handler so it requires a verified Palmprint session.

## Usage

```ts
// app/api/account/password/route.ts
import { requirePalmprint } from "@/lib/palmprintMiddleware";

export const POST = requirePalmprint(
  { level: "high" },
  async (req, session) => {
    // session is the verified SessionPayload — sub, level, challenge_nonce, ctx, etc.
    const body = await req.json();
    // ... do the password change
    return Response.json({ ok: true });
  },
);
```

In the demo app, `@/lib/palmprintMiddleware` is a tiny convenience wrapper
around `createPalmprintNext`:

```ts
import { createPalmprintNext } from "@palmprint/server/next";
import { palmprint } from "./palmprintInstance";

export const { requirePalmprint, tryVerifyRequest } =
  createPalmprintNext(palmprint);
```

## Where the token comes from

The middleware looks for the session token in two places, in order:

1. **`Authorization: Bearer <token>`** header (preferred).
2. **`X-Palmprint-Token`** header (convenience fallback).

You decide which one to send from the client. The React provider sends `Authorization: Bearer …` by default when uploading captures.

## Responses

- **401** — missing token, bad signature, expired, wrong kind. Body: `{ error, code: "palmprint_unauthorized" }`.
- **403** — token is valid but `level` is below the configured minimum. Body: `{ error, code: "palmprint_forbidden" }`.

## Options

```ts
export const POST = requirePalmprint(
  {
    level: "high",
    onUnauthorized: (req, error, code) =>
      Response.json({ ok: false, reason: error }, { status: code }),
  },
  handler,
);
```

| Option | Default | Meaning |
|---|---|---|
| `level` | undefined | Minimum required `SessionPayload.level`. Omit for "any verified session". |
| `onUnauthorized` | built-in JSON | Custom error responder. Receives `(req, error, code)`. |

## Without the wrapper

If you need branching logic — say, an endpoint that's free for unverified users but enriches behavior for verified ones — call `tryVerifyRequest` directly:

```ts
import { tryVerifyRequest } from "@/lib/palmprintMiddleware";

export async function GET(req: NextRequest) {
  const session = tryVerifyRequest(req); // SessionPayload | null
  if (session?.level === "high") {
    // serve premium data
  }
  // serve standard response
}
```

## A working example

The captures upload endpoint uses `requirePalmprint` as its only auth check:

```ts
// app/api/palmprint/captures/route.ts
import { requirePalmprint } from "@/lib/palmprintMiddleware";

export const POST = requirePalmprint({}, async (req, session) => {
  // session.challenge_nonce is the bucket key.
  const formData = await req.formData();
  const file = formData.get("file");
  // ...store the blob, bound to session.challenge_nonce
});
```

That endpoint is the canonical example of an SDK-protected route in the repo. Browse the bucket at [/captures](/captures).
