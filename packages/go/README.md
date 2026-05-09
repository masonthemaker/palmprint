# Palmprint Go SDK

Go server SDK for Palmprint challenge/session tokens.

```go
sdk, err := palmprint.New(palmprint.Options{
	Secret: os.Getenv("PALMPRINT_SECRET"),
})
if err != nil {
	log.Fatal(err)
}

challenge, _ := sdk.IssueChallenge(palmprint.ChallengeOptions{
	RequiredLevel: palmprint.LevelHigh,
})

session, err := sdk.IssueSession(ctx, palmprint.SessionInput{
	ChallengeToken: challenge.Token,
	ClientToken:    clientTokenFromBrowser,
})

payload, err := sdk.VerifySession(session.Token)
```

## HTTP helpers

```go
handlers := palmprint.NewHTTPHandlers(sdk)

http.HandleFunc("/api/palmprint/challenge", handlers.Challenge)
http.HandleFunc("/api/palmprint/redeem", handlers.Redeem)

http.Handle("/api/withdraw",
	handlers.RequirePalmprint(palmprint.LevelHigh, http.HandlerFunc(withdraw)),
)
```

Run the package tests with:

```bash
go test ./...
```
