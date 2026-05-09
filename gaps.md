# Gaps Analysis

Current audit after the SDK split. The main product path is now wired:

- React apps import `@palmprint/react`.
- Servers import `@palmprint/server`.
- Non-React sites use the script-tag bundle.
- The browser flow ends in a signed `sessionToken` by default.
- Captures upload behind verified sessions.
- Agent consent verifies signed, challenge-bound sessions.

This repo is now best understood as the open-source reference implementation:
protocol, UI, signed sessions, demos, and pluggable interfaces. Production
durability, abuse controls, audit trails, and hosted liveness workflows remain
natural enterprise/hosted layers.

---

## What Is Solid

### Signed Verification

`@palmprint/server` issues signed challenge tokens, redeems browser client
tokens, consumes challenge nonces, and returns signed session tokens.

`@palmprint/react` hides that ceremony behind:

```ts
const { verify } = usePalmprint();
const { sessionToken } = await verify({ level: "high" });
```

The old unsigned browser token still exists as `clientToken` for debugging and
manual integrations, but all normal docs and snippets point at `sessionToken`.

### React SDK Shape

The React SDK exports:

- `PalmprintProvider`
- `usePalmprint`
- `usePalmprintGate` as a compatibility/low-level name
- `PalmprintGuard`
- `VerifyWidget`
- `CaptchaCheckbox`
- `Palmprint`
- shared component types and defaults

The demo app now dogfoods `@palmprint/react` instead of only importing local
`src/app` components.

### Script-Tag Bundle

The standalone bundle supports both designs:

```html
data-widget="button"
data-widget="checkbox"
```

It supports signed flow via `data-api-base`, defaults to `/api/palmprint`, and
dispatches `palmprint:verified` with the same signed result shape. Manual mode
is explicit: `data-api-base="false"`.

### Captures

The provider/widget can upload captures after redeem. The upload endpoint is
protected with `requirePalmprint`, and captures are tied to the session's
challenge nonce.

### Agent Consent

Consent creation mints a bound Palmprint challenge. Consent verification now
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

The widget package does emit `packages/widget/dist/palmprint-widget.js`.

### Shared Types

`@palmprint/core` exists, but the server and React packages still duplicate a
few core types (`SecurityLevel`, token payloads). The end-state is to import
those types from `@palmprint/core` everywhere.

### Duplicated Frontend Flow

`VerifyWidget` owns its own modal and repeats some challenge/redeem/upload
logic that `PalmprintProvider` also owns. It works, but the cleaner SDK design
is one internal `verify()` primitive used by:

- hook
- guard
- button widget
- CAPTCHA checkbox
- script bundle

### Production Storage

Default stores are intentionally local/demo-friendly:

- in-memory nonce store
- in-memory consent store
- capture records in memory, with optional filesystem blobs

Production users should swap in Redis/Postgres/S3/R2/GCS equivalents. The OSS
interfaces are small; the adapters are not yet included.

### Runtime Portability

`@palmprint/server` uses `node:crypto`, so it is Node-first. Edge runtime,
Cloudflare Workers, Deno, and Bun support should use Web Crypto in a future
server package version.

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
2. Move duplicated token/types into `@palmprint/core`.
3. Refactor `VerifyWidget` to use the same internal verification primitive as
   `PalmprintProvider`.
4. Add one Redis nonce adapter and one S3/R2 capture adapter as reference
   production adapters.
5. Add end-to-end browser tests for React button, checkbox, script button, and
   script checkbox flows.

