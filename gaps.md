# Gaps Analysis

Current audit after the SDK split, Go SDK, GitHub README polish, docs updates,
and Apache-2.0 licensing.

Palmprint is now best understood as the open-source reference implementation:
protocol, browser verification UI, signed session flow, SDK surfaces, docs,
demos, and pluggable interfaces. Production durability, abuse controls, audit
trails, and hosted liveness workflows remain natural hosted or enterprise
layers around the open core.

---

## What Is Solid

### Open-Source Posture

The repo is licensed under Apache-2.0 and the README now describes Palmprint as
a fully open foundation. That matches the intended split:

- OSS: protocol, local UI, token flow, SDKs, examples, and docs.
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
data-widget="button"
data-widget="checkbox"
```

It supports signed flow via `data-api-base`, defaults to `/api/palmprint`, and
dispatches `palmprint:verified` with the same signed result shape. Manual mode
is explicit: `data-api-base="false"`.

This covers the non-React frontend SDK story for now. A later dedicated
vanilla JS package could wrap `window.Palmprint.mount(...)`, but the core
embed path exists.

### Go Server SDK

`packages/go` now mirrors the server SDK:

- challenge issue/verify
- client token parse
- session issue/verify
- in-memory nonce store
- `net/http` challenge and redeem handlers
- `RequirePalmprint` middleware
- tests for redeem, verify, replay rejection, level rejection, and HTTP flow
- a small `examples/testpage` server

This means the backend SDK story is no longer Node-only.

### Docs

The docs now include:

- SDK layout
- React integration
- script-tag bundle
- Node/Next server SDK
- Go SDK
- middleware
- token formats

Docs code blocks are copyable, and the README is shaped for GitHub discovery.

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

### Package Build Outputs

The repo has package boundaries and workspace package manifests, but the
TypeScript packages currently point at source files. Before publishing, add a
proper package build that emits:

- ESM JavaScript
- `.d.ts` declarations
- package-local CSS/assets where needed
- tested `exports` entries for each subpath
- package tarballs that work outside this monorepo

The widget package already emits `packages/widget/dist/palmprint-widget.js`.
The Go package is source-native and already testable with `go test ./...`.

### Cross-SDK Conformance

Node and Go now implement the same protocol, but there is no shared conformance
fixture suite yet. Add golden fixtures that prove both SDKs agree on:

- challenge token shape
- session token shape
- signature validation
- expired token behavior
- wrong-kind behavior
- replay behavior
- level/steps enforcement
- malformed client token behavior

This matters more now that Palmprint is multi-language.

### Shared Types

`@palmprint/core` exists, but the server and React packages still duplicate a
few core types (`SecurityLevel`, token payloads). The end-state is to import
those types from `@palmprint/core` everywhere.

For Go, the equivalent is keeping JSON field names and error codes aligned with
the TypeScript source through conformance tests.

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

### Publish Readiness

The repo is open and licensed, but the packages are still marked `private`.
Before publishing SDKs:

- remove `private` from publishable package manifests
- add package-level READMEs where needed
- add provenance/release automation
- add versioning/changelog policy
- decide final npm scope and Go module path
- verify CDN paths for `@palmprint/widget`

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

---

## Best Next Steps

1. Add a real package build for `@palmprint/core`, `@palmprint/server`, and
   `@palmprint/react`.
2. Add cross-SDK conformance fixtures for Node and Go token behavior.
3. Move duplicated token/types into `@palmprint/core`.
4. Refactor `VerifyWidget` to use the same internal verification primitive as
   `PalmprintProvider`.
5. Add one Redis nonce adapter and one S3/R2 capture adapter as reference
   production adapters.
6. Add end-to-end browser tests for React button, checkbox, script button, and
   script checkbox flows.
7. Decide final package publishing names and release automation.
