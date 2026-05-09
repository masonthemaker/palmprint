package palmprint

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

const testSecret = "0123456789abcdef0123456789abcdef"

func TestIssueRedeemVerifySession(t *testing.T) {
	sdk := newTestServer(t)

	challenge, err := sdk.IssueChallenge(ChallengeOptions{
		RequiredLevel: LevelMedium,
		RequiredSteps: 2,
		Subject:       "user:123",
		Context:       map[string]interface{}{"intent": "withdraw"},
	})
	if err != nil {
		t.Fatalf("IssueChallenge: %v", err)
	}

	clientToken := makeClientToken(t, challenge.Nonce, LevelHigh, 2)
	session, err := sdk.IssueSession(context.Background(), SessionInput{
		ChallengeToken: challenge.Token,
		ClientToken:    clientToken,
		TTL:            time.Hour,
	})
	if err != nil {
		t.Fatalf("IssueSession: %v", err)
	}

	payload, err := sdk.VerifySession(session.Token)
	if err != nil {
		t.Fatalf("VerifySession: %v", err)
	}
	if payload.Kind != "session" {
		t.Fatalf("Kind = %q, want session", payload.Kind)
	}
	if payload.Subject != "user:123" {
		t.Fatalf("Subject = %q, want user:123", payload.Subject)
	}
	if payload.ChallengeNonce != challenge.Nonce {
		t.Fatalf("ChallengeNonce = %q, want %q", payload.ChallengeNonce, challenge.Nonce)
	}
}

func TestRedeemRejectsReplay(t *testing.T) {
	sdk := newTestServer(t)
	challenge, err := sdk.IssueChallenge(ChallengeOptions{})
	if err != nil {
		t.Fatalf("IssueChallenge: %v", err)
	}
	clientToken := makeClientToken(t, challenge.Nonce, LevelMedium, 2)

	if _, err := sdk.IssueSession(context.Background(), SessionInput{
		ChallengeToken: challenge.Token,
		ClientToken:    clientToken,
	}); err != nil {
		t.Fatalf("first IssueSession: %v", err)
	}

	_, err = sdk.IssueSession(context.Background(), SessionInput{
		ChallengeToken: challenge.Token,
		ClientToken:    clientToken,
	})
	if !IsTokenError(err, ErrNonceAlreadyConsumed) {
		t.Fatalf("second IssueSession error = %v, want %s", err, ErrNonceAlreadyConsumed)
	}
}

func TestRedeemRejectsWeakLevel(t *testing.T) {
	sdk := newTestServer(t)
	challenge, err := sdk.IssueChallenge(ChallengeOptions{RequiredLevel: LevelHigh})
	if err != nil {
		t.Fatalf("IssueChallenge: %v", err)
	}

	_, err = sdk.IssueSession(context.Background(), SessionInput{
		ChallengeToken: challenge.Token,
		ClientToken:    makeClientToken(t, challenge.Nonce, LevelLow, 2),
	})
	if !IsTokenError(err, ErrInsufficientLevel) {
		t.Fatalf("IssueSession error = %v, want %s", err, ErrInsufficientLevel)
	}
}

func TestHTTPChallengeRedeemAndMiddleware(t *testing.T) {
	sdk := newTestServer(t)
	handlers := NewHTTPHandlers(sdk)

	req := httptest.NewRequest(http.MethodPost, "/challenge", bytes.NewReader([]byte(`{"required_level":"medium"}`)))
	res := httptest.NewRecorder()
	handlers.Challenge(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("Challenge status = %d, body = %s", res.Code, res.Body.String())
	}

	var challengeBody struct {
		ChallengeToken string `json:"challenge_token"`
		ChallengeNonce string `json:"challenge_nonce"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &challengeBody); err != nil {
		t.Fatalf("challenge JSON: %v", err)
	}

	redeemPayload := map[string]string{
		"challenge_token": challengeBody.ChallengeToken,
		"client_token":    makeClientToken(t, challengeBody.ChallengeNonce, LevelMedium, 2),
	}
	redeemJSON, _ := json.Marshal(redeemPayload)
	req = httptest.NewRequest(http.MethodPost, "/redeem", bytes.NewReader(redeemJSON))
	res = httptest.NewRecorder()
	handlers.Redeem(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("Redeem status = %d, body = %s", res.Code, res.Body.String())
	}

	var redeemBody struct {
		SessionToken string `json:"session_token"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &redeemBody); err != nil {
		t.Fatalf("redeem JSON: %v", err)
	}

	protected := handlers.RequirePalmprint(LevelMedium, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		session, ok := SessionFromContext(r.Context())
		if !ok || session.Kind != "session" {
			t.Fatalf("missing session in context")
		}
		w.WriteHeader(http.StatusNoContent)
	}))

	req = httptest.NewRequest(http.MethodPost, "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+redeemBody.SessionToken)
	res = httptest.NewRecorder()
	protected.ServeHTTP(res, req)
	if res.Code != http.StatusNoContent {
		t.Fatalf("protected status = %d, body = %s", res.Code, res.Body.String())
	}
}

func newTestServer(t *testing.T) *Server {
	t.Helper()
	sdk, err := New(Options{Secret: testSecret, Issuer: "test"})
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	return sdk
}

func makeClientToken(t *testing.T, challengeNonce string, level SecurityLevel, steps int) string {
	t.Helper()
	token, err := EncodeClientToken(ClientPayload{
		Version:        1,
		Issuer:         "palmprint-web",
		IssuedAt:       time.Now().Unix(),
		ExpiresAt:      time.Now().Add(5 * time.Minute).Unix(),
		Nonce:          "client-nonce",
		Level:          level,
		Steps:          steps,
		ItemsPerStep:   2,
		ChallengeNonce: challengeNonce,
	})
	if err != nil {
		t.Fatalf("EncodeClientToken: %v", err)
	}
	return token
}
