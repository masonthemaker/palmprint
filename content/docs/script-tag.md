# Script-tag bundle

For non-React sites, `widget-bundle/` builds a self-contained IIFE. It ships its own React + ReactDOM + the Palmprint components + the MediaPipe wrapper, plus a Tailwind v4 CSS bundle inlined as a string and injected into a shadow DOM at mount time.

## Build

```bash
npm install
npm run build:widget
# → public/dist/palmprint-widget.js
```

Sizes (current):
- raw: ~396 KB
- gzipped: ~118 KB
- inlined CSS portion: ~37 KB (already counted)

The MediaPipe WASM and ML models still load lazily from Google's CDN at first verify, so 118 KB gz is the actual upfront budget on the integrator's site.

## Use it on any page

Set `data-api-base` to the server that exposes the Palmprint routes:
`/challenge`, `/redeem`, and `/captures`. Use a relative path when the widget
is on the same app, or a full URL when embedding on another domain.

### Button

```html
<script
  src="https://your-cdn.example/palmprint-widget.js"
  data-api-base="https://your-app.example/api/palmprint"
  data-position="bottom-right"
  data-theme="emerald"
  data-shape="pill"
  data-size="md"
  data-level="medium"
  data-mode="both"
  data-num-tests="2"
  data-capture-mode="off"
  data-label="Verify with Palmprint"
  defer
></script>

<script>
  window.addEventListener("palmprint:verified", (e) => {
    const { sessionToken, captures } = e.detail;
    // Send sessionToken to protected endpoints as Authorization: Bearer <token>.
  });
</script>
```

### CAPTCHA checkbox

Use `data-widget="checkbox"` for the reCAPTCHA-style design. It uses the same
signed challenge/redeem flow and dispatches the same `palmprint:verified` event.

```html
<script
  src="https://your-cdn.example/palmprint-widget.js"
  data-widget="checkbox"
  data-api-base="https://your-app.example/api/palmprint"
  data-target="#palmprint-slot"
  data-theme="light"
  data-label="I'm not a robot"
  data-verifying-label="Verifying..."
  data-verified-label="Verified"
  data-failed-label="Try again"
  data-level="medium"
  data-mode="both"
  data-num-tests="2"
  data-capture-mode="off"
  defer
></script>
```

Event detail:

```ts
{
  token: string;        // sessionToken when signed, otherwise clientToken
  sessionToken: string; // HMAC-signed token from /redeem
  clientToken: string;  // unsigned browser token, for debugging/manual mode
  expiresAt: number;
  challengeNonce: string;
  captures: Capture[];
  uploadedCaptureIds: string[];
}
```

If `data-api-base="false"`, the bundle runs in manual mode and dispatches only
the unsigned `clientToken`. That is useful for demos and custom integrations,
but the signed flow above is the safe default.

## Position options

`data-position` accepts:

- `bottom-right` (default)
- `bottom-left`
- `top-right`
- `top-left`

Or use `data-target="#some-element"` to mount inline into an existing node — the position is then ignored.

## Programmatic API

The bundle exposes a small global for programmatic mounting:

```js
const host = document.getElementById("my-spot");
window.Palmprint.mount(host, {
  apiBase: "https://your-app.example/api/palmprint",
  level: "high",
  theme: "dark",
  // ...partial WidgetConfig
});

window.Palmprint.mount(host, {
  widget: "checkbox",
  apiBase: "https://your-app.example/api/palmprint",
  captchaConfig: {
    label: "I'm not a robot",
    theme: "light",
    level: "medium",
  },
});
```

## Demo

A working example lives at [`public/widget-demo.html`](https://github.com/masonthemaker/palmprint/blob/main/public/widget-demo.html). Open `http://localhost:3000/widget-demo.html` after `npm run dev` to try it.

## Deploying the bundle

You don't need to operate a CDN. Two easy options:

- **`npm publish`** as `@palmprint/widget`. jsDelivr automatically mirrors it under `https://cdn.jsdelivr.net/npm/@palmprint/widget@1/dist/palmprint-widget.js` — global edge-cached for free.
- **Static host** the file on Vercel / Cloudflare Pages / S3+CloudFront under your own domain for branding and cache control.

## Cross-origin embeds

When the bundle runs on a different domain than `data-api-base`, your Palmprint
server must allow those origins for `POST /challenge`, `POST /redeem`, and
`POST /captures`. The open-source routes are intentionally minimal; production
deployments usually add origin allowlists, rate limits, durable nonce storage,
and audit logging around these same SDK calls.

The shadow-DOM mount means host-page CSS won't bleed in or out. You can drop the script tag into a WordPress theme or a plain HTML page without worrying about specificity wars.
