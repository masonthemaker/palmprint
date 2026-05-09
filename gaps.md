# Gaps Analysis

Current audit after the SDK split, Go SDK, package builds, shared conformance
fixtures, GitHub README polish, docs updates, and Apache-2.0 licensing.

Palmprint is now best understood as the open-source reference implementation:
protocol, browser verification UI, signed session flow, SDK surfaces, docs,
demos, and pluggable interfaces. Production durability, abuse controls, audit
trails, hosted review workflows, and managed liveness analysis remain natural
hosted or enterprise layers around the open core.

---

## What Is Solid

### Open-Source Posture

The repo is licensed under Apache-2.0 and the README describes Palmprint as a
fully open foundation. That matches the intended split:

- OSS: protocol, local UI, token flow, SDKs, examples, package builds, and docs.
- Hosted/enterprise: durable infra, rate limits, storage workflows, audit logs,
  review queues, team controls, and hosted liveness analysis.

### Signed Verification

`@palmprint/server` issues signed challenge tokens, redeems browser client
tokens, consumes challenge nonces, and returns signed session tokens.

`@palmprint/react` hides that ceremony behind:

```ts
const { verify } = usePalmprint();
const { sessionToken } = await verify({ level: "high" });
```

The old unsigned browser token still exists as `clientToken` for debugging and
manual integrations, but normal docs and snippets point at `sessionToken`.

### React Frontend SDK

The React SDK exports:

- `PalmprintProvider`
- `usePalmprint`
- `usePalmprintGate` as a compatibility/low-level name
- `PalmprintGuard`
- `VerifyWidget`
- `CaptchaCheckbox`
- `Palmprint`
- shared component types and defaults

The demo app dogfoods `@palmprint/react` instead of only importing local
`src/app` components.

### Script-Tag Frontend SDK

The standalone bundle supports both designs:

```html
<script src="/dist/palmprint-widget.js" data-widget="button"></script>
<script src="/dist/palmprint-widget.js" data-widget="checkbox"></script>
```

It supports signed flow via `data-api-base`, defaults to `/api/palmprint`, and
dispatches `palmprint:verified` with the same signed result shape. Manual mode
is explicit: `data-api-base="false"`.

This covers the non-React frontend SDK story for now. A later dedicated
vanilla JS package could wrap `window.Palmprint.mount(...)`, but the core embed
path exists and is documented.

### Node Server SDK

`@palmprint/server` is now package-buildable and keeps the root export focused
on the plain server SDK. Next helpers live on explicit subpaths:

```ts
import { createPalmprintServer } from "@palmprint/server";
import { createPalmprintNext } from "@palmprint/server/next";
import { createPalmprintRoutes } from "@palmprint/server/routes";
```

That matters because plain Node users can import the server SDK without pulling
in `next/server`.

### Go Server SDK

`packages/go` mirrors the server SDK:

- challenge issue/verify
- client token parse
- session issue/verify
- in-memory nonce store
- `net/http` challenge and redeem handlers
- `RequirePalmprint` middleware
- tests for redeem, verify, replay rejection, level rejection, and HTTP flow
- a small `examples/testpage` server

This means the backend SDK story is no longer Node-only.

### Cross-SDK Conformance

Node and Go now share `conformance/fixtures.json`. The fixtures cover:

- challenge token shape
- session token shape
- client token shape
- signature validation
- expired token behavior
- wrong-kind behavior
- replay behavior
- level enforcement
- challenge nonce mismatch behavior
- malformed client token behavior

Run the checks with:

```bash
npm run build:packages
npm run test:conformance
npm run test:go
```

### Shared Types

`@palmprint/core` owns the shared TypeScript protocol types:

- `SecurityLevel`
- `Mode`
- `CaptureMode`
- `ChallengePayload`
- `SessionPayload`
- `ClientPalmprintPayload`
- `VerificationResultBase`

The React and server packages import/re-export from `@palmprint/core` instead
of duplicating those definitions. Go stays aligned through JSON tags, stable
error codes, and the shared conformance fixtures.

### Package Build Outputs

The TypeScript SDK packages now emit package-local `dist` outputs:

- ESM JavaScript
- `.d.ts` declarations
- source maps
- tested package `exports`
- package-level READMEs

The widget package continues to emit `packages/widget/dist/palmprint-widget.js`.
The Go package is source-native and testable with `go test ./...`.

### Docs

The docs now include:

- SDK layout
- React integration
- script-tag bundle
- Node/Next server SDK
- Go SDK
- middleware
- token formats

Docs code blocks are copyable in the app UI, and the README is shaped for
GitHub discovery.

### Captures

The provider/widget can upload captures after redeem. The upload endpoint is
protected with `requirePalmprint`, and captures are tied to the session's
challenge nonce.

### Agent Consent

Consent creation mints a bound Palmprint challenge. Consent verification
expects a signed `session_token`, verifies it, checks `challenge_nonce`, and
enforces the derived level.

---

## Remaining OSS Gaps

### One Frontend Verification Primitive

`VerifyWidget` owns its own modal and repeats some challenge/redeem/upload
logic that `PalmprintProvider` also owns. It works, but the cleaner SDK design
is one internal `verify()` primitive used by:

- hook
- guard
- button widget
- CAPTCHA checkbox
- script bundle

That would make future frontend SDKs easier to keep consistent.

### Production Storage Adapters

Default stores are intentionally local/demo-friendly:

- in-memory nonce store
- in-memory consent store
- capture records in memory, with optional filesystem blobs
- Go in-memory nonce store

Production users should swap in Redis/Postgres/S3/R2/GCS equivalents. The OSS
interfaces are small; reference adapters are not yet included.

### Runtime Portability

`@palmprint/server` uses `node:crypto`, so it is Node-first. Edge runtime,
Cloudflare Workers, Deno, and Bun support should use Web Crypto in a future
server package version.

The Go SDK is portable across Go server environments, but does not replace a
Web Crypto-compatible JavaScript server package.

### Publish Automation

The package manifests are no longer private and the publishable package outputs
exist. The remaining publish work is operational:

- provenance/release automation
- versioning/changelog policy
- final npm scope confirmation
- final Go module path confirmation
- CDN publishing path for `@palmprint/widget`

### Abuse Controls

The OSS routes are intentionally minimal. Production deployments should add:

- origin allowlists / CORS policy
- CSRF protection where applicable
- rate limits for `/challenge`, `/redeem`, and uploads
- API-key management for consent flows
- audit logs and verification metrics

### Liveness Analysis

Palmprint proves the user reacted to randomized prompts in real time. It does
not prove identity, and it does not include a server-side deepfake/liveness
classifier. Captures are the raw material for that pipeline.

### End-to-End Browser Tests

Unit and conformance coverage are now much stronger, but there is still no
browser E2E suite that walks through:

- React button flow
- React CAPTCHA checkbox flow
- script-tag button flow
- script-tag CAPTCHA checkbox flow
- capture upload flow

This is the next high-value test gap because it verifies the demos, SDK wiring,
and docs snippets as real user flows.

---

## Best Next Steps

1. Refactor `VerifyWidget` to use the same internal verification primitive as
   `PalmprintProvider`.
2. Add end-to-end browser tests for React button, React checkbox, script button,
   and script checkbox flows.
3. Add one Redis nonce adapter and one S3/R2 capture adapter as reference
   production adapters.
4. Add Web Crypto support for edge-style JavaScript runtimes.
5. Add release automation, provenance, and changelog policy.
