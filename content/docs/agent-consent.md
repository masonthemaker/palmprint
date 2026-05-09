# Agent → human consent

A complete flow for the case where an **AI agent** wants to perform an action and needs **a real human's** approval — optionally with payment.

## Components

- **`POST /api/human-consent`** — the endpoint an agent's tool implementation calls.
- **`/human-consent`** — operator dashboard: documents the tool, fires test requests, shows a live SMS-bubble feed of pending requests with status badges (auto-refreshes every 3s).
- **`/human-consent/verify/[id]`** — the link the human visits. Renders the action description, an optional payment line item, and a "Verify" button that triggers the bound Palmprint challenge.

## Tool definition (Anthropic / OpenAI tool-use format)

```json
{
  "name": "request_human_consent",
  "description": "Request a real-time consent from a human via Palmprint biometric verification before performing a sensitive or irreversible action.",
  "input_schema": {
    "type": "object",
    "properties": {
      "action":               { "type": "string" },
      "contact":              { "type": "string", "description": "Email or phone of the human." },
      "agent_name":           { "type": "string" },
      "api_key":              { "type": "string" },
      "payment_required":     { "type": "boolean" },
      "payment_amount_cents": { "type": "number" },
      "payment_currency":     { "type": "string", "default": "USD" }
    },
    "required": ["action", "contact", "agent_name", "api_key"]
  }
}
```

## Curl example

```bash
curl -X POST https://your-host/api/human-consent \
  -H "Content-Type: application/json" \
  -d '{
    "action": "Send $50 to alice@example.com via PayPal",
    "contact": "+15551234567",
    "agent_name": "BookingBot",
    "api_key": "pk_demo_high",
    "payment_required": true,
    "payment_amount_cents": 5000
  }'
```

Response:

```json
{
  "request_id": "9b8af2c7e1d3",
  "verify_url": "https://your-host/human-consent/verify/9b8af2c7e1d3",
  "derived_level": "high",
  "status": "pending",
  "contact": "+15551234567",
  "message_to_human": "BookingBot is requesting your approval for: \"Send $50 to alice@example.com via PayPal\". Verify here: https://your-host/human-consent/verify/9b8af2c7e1d3",
  "expires_in_seconds": 600
}
```

In production you would dispatch `message_to_human` over SMS / email / push. In the demo, the dashboard renders it as a chat bubble.

## API-key tiers → derived auth level

| Key | Tier | With `payment_required=true` |
|---|---|---|
| `pk_demo_low` | low | medium |
| `pk_demo_med` | medium | high |
| `pk_demo_high` | high | high |
| anything else | — | `401 Unknown api_key` |

Payment requirement bumps the level up by one notch unless already at high. The verify page uses the *derived* level to configure its Palmprint challenge, so high-stakes flows automatically demand more challenges and rotate prompts faster.

## Flow

1. Agent calls the tool. The tool `POST`s to `/api/human-consent`. Server validates, rejects unknown keys, derives a level, creates a record, **mints a Palmprint challenge bound to that record** (`subject: "consent:<id>"`, `context: { consent_id, agent, payment_required }`), stores `challengeToken` + `challengeNonce` on the record, and returns the verify URL + SMS message.
2. Human opens the verify link. Page fetches `/api/human-consent/[id]` (which now returns the bound `challengeToken` + `challengeNonce`).
3. Verify button calls `verify({ challengeToken, challengeNonce, level })` — the React provider uses the **pre-issued** challenge instead of fetching a fresh one, so the resulting session is bound to *this* consent.
4. Page `POST`s `{ action: "verify", session_token }` back. Server runs `palmprint().verifySession()`, enforces `session.challenge_nonce === record.challengeNonce`, enforces the level, and marks the record `verified`.
5. If `payment_required`, a card form mounts. Submitting `POST`s `{ action: "pay", cardholder_name, card_number }`. Server stores only the **last 4** + cardholder name; nothing goes to a real processor.
6. **Deny** posts `{ action: "deny", reason }` and the page swaps to a denied state.

**Forging consent approval requires the server's HMAC secret** — the previous string-prefix check on `palmprint.…` has been replaced with a full `verifySession()` call plus the bound-nonce check.

## Per-id endpoints

- `GET /api/human-consent/[id]` — fetch full record (includes `challengeToken` + `challengeNonce` for the verify page).
- `POST /api/human-consent/[id]` with `{ action: "verify" | "pay" | "deny", … }`.

State machine: `pending → verified → paid` (when payment required), or `pending → verified` (when not), or `pending → denied`. `deny` is rejected once the request is `paid`.

## What's not yet wired

- **No webhook on completion.** The agent has to poll `/api/human-consent` (which currently returns *all* requests, no auth — also a leak).
- **No real SMS / email delivery.** The dashboard renders the message; a production wire would call Twilio / Resend / etc.
- **Storage is in-memory.** Replace `consentStore.ts` with a real DB before shipping.
- **Mock payments.** No Stripe, no PCI compliance. Replace before going live.

See [`gaps.md`](https://github.com/your-org/palmprint/blob/main/gaps.md) for the full list.
