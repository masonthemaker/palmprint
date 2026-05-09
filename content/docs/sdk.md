# SDK layout

Palmprint is split into small SDK surfaces. The demo app in this repo uses the
same imports you would use in an app.

## Packages

| Package | Use it for |
|---|---|
| `@palmprint/react` | Browser verification UI: provider, hook, guard, button, CAPTCHA checkbox. |
| `@palmprint/server` | Challenge/session tokens, replay protection, and route middleware. |
| `@palmprint/core` | Shared types and tiny token helpers. Most apps do not import it directly. |
| `@palmprint/widget` | Standalone script-tag bundle for non-React sites. |
| `github.com/masonthemaker/palmprint/packages/go` | Go server SDK with `net/http` routes and middleware. |

## The easiest React setup

Server route:

```ts
// app/api/palmprint/challenge/route.ts
import { palmprint } from "@/lib/palmprintInstance";

export async function POST() {
  const challenge = palmprint().issueChallenge();
  return Response.json({
    challenge_token: challenge.token,
    challenge_nonce: challenge.nonce,
  });
}
```

Provider:

```tsx
import { PalmprintProvider } from "@palmprint/react";

export default function Layout({ children }) {
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

Action:

```tsx
import { usePalmprint } from "@palmprint/react";

const { verify } = usePalmprint();

const { sessionToken } = await verify({ level: "high" });
await fetch("/api/withdraw", {
  method: "POST",
  headers: { Authorization: `Bearer ${sessionToken}` },
});
```

Protected API route:

```ts
import { requirePalmprint } from "@/lib/palmprintMiddleware";

export const POST = requirePalmprint({ level: "high" }, async () => {
  return Response.json({ ok: true });
});
```

That is the whole normal flow: verify in the browser, receive `sessionToken`,
send it as a bearer token, and verify it on the server.

## Go backend

Use `github.com/masonthemaker/palmprint/packages/go` when your API is written in Go:

```go
sdk, err := palmprint.New(palmprint.Options{
	Secret: os.Getenv("PALMPRINT_SECRET"),
})

handlers := palmprint.NewHTTPHandlers(sdk)
http.HandleFunc("/api/palmprint/challenge", handlers.Challenge)
http.HandleFunc("/api/palmprint/redeem", handlers.Redeem)
```

See [Go SDK](/docs/go) for the full flow.

## The easiest script-tag setup

```html
<script
  src="https://cdn.example.com/palmprint-widget.js"
  data-widget="checkbox"
  data-api-base="https://your-app.example/api/palmprint"
  data-label="I'm not a robot"
  defer
></script>

<script>
  window.addEventListener("palmprint:verified", (event) => {
    const { sessionToken } = event.detail;
    // Send sessionToken to your backend as Authorization: Bearer <token>.
  });
</script>
```

Use `data-widget="button"` or omit `data-widget` for the button design. Use
`data-widget="checkbox"` for the reCAPTCHA-style design.

## What is intentionally not in OSS

The open-source repo gives you the protocol, UI, signed tokens, examples, and
interfaces. Production infrastructure is deliberately pluggable:

- durable nonce storage,
- rate limiting,
- origin allowlists,
- audit logs,
- capture review,
- hosted liveness analysis,
- webhooks and team workflows.

Those are natural hosted or enterprise layers around the same SDK primitives.
