# Introduction

Palmprint is a browser-based human verification system that uses your webcam, hand gestures, and facial expressions instead of a CAPTCHA. Think of it as **2FA for "are you a person"**: the user is asked to perform a sequence of randomized poses on camera, and only when each one is held for ~0.8 seconds does the verification pass.

Everything runs locally via [MediaPipe Tasks for Web](https://ai.google.dev/edge/mediapipe/solutions/guide). Camera frames never leave the device unless you explicitly opt into the captures bucket.

## What you get

- **Hand gesture and face expression challenges** with combined-prompt support (e.g. *fist + raised brows simultaneously*).
- **Anti-spoof prompt rotation** that defeats AI-pre-rendered video attacks.
- **HMAC-signed session tokens** issued by the server SDK, ready to drop into your auth flow.
- **Captures bucket** for raw PNG / WebM uploads tied to each verification, available for downstream liveness analysis.
- **React, hook, guard, and widget** integration patterns plus a standalone `<script>`-tag bundle for non-React sites.
- **Agent → human consent flow** where AI agents request approval from real humans before performing sensitive actions.

## When to use Palmprint

| Pattern | Component |
|---|---|
| Whole sensitive route is locked (`/admin`, `/billing`) | `<PalmprintGuard>` |
| One-off action inside a normal page (delete, withdraw, change password) | `usePalmprint()` |
| Sign-up form, comment box, contact form | `<VerifyWidget>` or `<CaptchaCheckbox>` |
| Migration off reCAPTCHA | `<CaptchaCheckbox>` (drop-in shape) |
| AI agent needs human approval before acting | `/api/human-consent` |

## When NOT to use Palmprint

- **As a sole identity check.** Palmprint proves *something with hands and a face is reacting in real time*. It does not prove *who* it is. Combine with a real auth flow.
- **As a payment gate without server-side liveness.** The captures bucket gives you the raw frames for offline AI/deepfake analysis, but the analyzer is not included.
- **In environments without `getUserMedia`.** No camera permission means no Palmprint.

## What's next

Start with the [Quickstart](/docs/quickstart) to get a working signed verification in your app in under 5 minutes. Then read [React integration](/docs/react) for the pattern that fits your use case.
