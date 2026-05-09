# Go SDK

The Go SDK mirrors the TypeScript server SDK. Use it when your backend is Go but
your frontend still runs the Palmprint React provider or script-tag widget.

## Install

```bash
go get github.com/palmprint/palmprint-go
```

Inside this repo the module lives at `packages/go`.

## Create the server SDK

```go
package main

import (
	"log"
	"os"

	palmprint "github.com/palmprint/palmprint-go"
)

func newPalmprint() *palmprint.Server {
	sdk, err := palmprint.New(palmprint.Options{
		Secret: os.Getenv("PALMPRINT_SECRET"), // 32+ chars
		Issuer: "myapp",
	})
	if err != nil {
		log.Fatal(err)
	}
	return sdk
}
```

## Mount the HTTP routes

```go
sdk := newPalmprint()
handlers := palmprint.NewHTTPHandlers(sdk)

http.HandleFunc("/api/palmprint/challenge", handlers.Challenge)
http.HandleFunc("/api/palmprint/redeem", handlers.Redeem)
```

These routes speak the same JSON shape as the React provider and script-tag
widget:

- `POST /api/palmprint/challenge`
- `POST /api/palmprint/redeem`

## Protect a route

```go
http.Handle("/api/withdraw",
	handlers.RequirePalmprint(
		palmprint.LevelHigh,
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			session, _ := palmprint.SessionFromContext(r.Context())
			_ = session
			w.WriteHeader(http.StatusNoContent)
		}),
	),
)
```

Send the browser's `sessionToken` as:

```http
Authorization: Bearer pps....
```

## Manual token flow

```go
challenge, err := sdk.IssueChallenge(palmprint.ChallengeOptions{
	RequiredLevel: palmprint.LevelHigh,
	RequiredSteps: 3,
	Subject: "user:123",
	Context: map[string]interface{}{"intent": "delete_account"},
})

session, err := sdk.IssueSession(ctx, palmprint.SessionInput{
	ChallengeToken: challenge.Token,
	ClientToken: clientTokenFromBrowser,
	Subject: "user:123",
})

payload, err := sdk.VerifySession(session.Token)
```

`IssueSession` verifies the challenge signature, parses the unsigned client
token, checks `challenge_nonce`, enforces level and step requirements, consumes
the challenge nonce, and mints the signed session token.

## Tests and local page

```bash
cd packages/go
go test ./...
go run ./examples/testpage
```

The test page starts a small `net/http` server on `http://localhost:8080` with
the Go challenge and redeem routes mounted.
