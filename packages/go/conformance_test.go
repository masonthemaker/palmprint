package palmprint

import (
	"context"
	"encoding/json"
	"os"
	"testing"
	"time"
)

type tokenFixture[T any] struct {
	Payload T      `json:"payload"`
	Token   string `json:"token"`
}

type conformanceFixture struct {
	Secret                string                         `json:"secret"`
	Challenge             tokenFixture[ChallengePayload] `json:"challenge"`
	HighChallenge         tokenFixture[ChallengePayload] `json:"highChallenge"`
	ExpiredChallenge      tokenFixture[ChallengePayload] `json:"expiredChallenge"`
	Session               tokenFixture[SessionPayload]   `json:"session"`
	ExpiredSession        tokenFixture[SessionPayload]   `json:"expiredSession"`
	Client                tokenFixture[ClientPayload]    `json:"client"`
	LowClient             tokenFixture[ClientPayload]    `json:"lowClient"`
	MismatchClient        tokenFixture[ClientPayload]    `json:"mismatchClient"`
	ExpiredClient         tokenFixture[ClientPayload]    `json:"expiredClient"`
	MalformedToken        string                         `json:"malformedToken"`
	BadSignatureChallenge string                         `json:"badSignatureChallenge"`
	ExpectedErrors        struct {
		WrongKind              ErrorCode `json:"wrongKind"`
		BadSignature           ErrorCode `json:"badSignature"`
		Expired                ErrorCode `json:"expired"`
		MalformedToken         ErrorCode `json:"malformedToken"`
		NonceAlreadyConsumed   ErrorCode `json:"nonceAlreadyConsumed"`
		InsufficientLevel      ErrorCode `json:"insufficientLevel"`
		ChallengeNonceMismatch ErrorCode `json:"challengeNonceMismatch"`
		ClientTokenInvalid     ErrorCode `json:"clientTokenInvalid"`
	} `json:"expectedErrors"`
}

func TestConformanceFixtures(t *testing.T) {
	fixture := loadConformanceFixture(t)
	sdk := newConformanceServer(t, fixture)

	challenge, err := sdk.VerifyChallenge(fixture.Challenge.Token)
	if err != nil {
		t.Fatalf("VerifyChallenge fixture: %v", err)
	}
	assertChallengePayload(t, challenge, fixture.Challenge.Payload)

	session, err := sdk.VerifySession(fixture.Session.Token)
	if err != nil {
		t.Fatalf("VerifySession fixture: %v", err)
	}
	assertSessionPayload(t, session, fixture.Session.Payload)

	client, err := ParseClientToken(fixture.Client.Token, time.Now)
	if err != nil {
		t.Fatalf("ParseClientToken fixture: %v", err)
	}
	assertClientPayload(t, client, fixture.Client.Payload)

	expectTokenError(t, func() error {
		_, err := sdk.VerifySession(fixture.Challenge.Token)
		return err
	}, fixture.ExpectedErrors.WrongKind)

	expectTokenError(t, func() error {
		_, err := sdk.VerifyChallenge(fixture.BadSignatureChallenge)
		return err
	}, fixture.ExpectedErrors.BadSignature)

	expectTokenError(t, func() error {
		_, err := sdk.VerifyChallenge(fixture.ExpiredChallenge.Token)
		return err
	}, fixture.ExpectedErrors.Expired)

	expectTokenError(t, func() error {
		_, err := sdk.VerifySession(fixture.ExpiredSession.Token)
		return err
	}, fixture.ExpectedErrors.Expired)

	expectTokenError(t, func() error {
		_, err := sdk.VerifyChallenge(fixture.MalformedToken)
		return err
	}, fixture.ExpectedErrors.MalformedToken)

	expectTokenError(t, func() error {
		_, err := ParseClientToken("palmprint.not-json", time.Now)
		return err
	}, fixture.ExpectedErrors.ClientTokenInvalid)

	expectTokenError(t, func() error {
		_, err := ParseClientToken(fixture.ExpiredClient.Token, time.Now)
		return err
	}, fixture.ExpectedErrors.Expired)

	redeemSDK := newConformanceServer(t, fixture)
	issued, err := redeemSDK.IssueSession(context.Background(), SessionInput{
		ChallengeToken: fixture.Challenge.Token,
		ClientToken:    fixture.Client.Token,
	})
	if err != nil {
		t.Fatalf("IssueSession fixture: %v", err)
	}
	issuedPayload, err := redeemSDK.VerifySession(issued.Token)
	if err != nil {
		t.Fatalf("VerifySession issued fixture: %v", err)
	}
	if issuedPayload.ChallengeNonce != fixture.Challenge.Payload.Nonce {
		t.Fatalf("issued ChallengeNonce = %q, want %q", issuedPayload.ChallengeNonce, fixture.Challenge.Payload.Nonce)
	}
	if issuedPayload.Level != fixture.Client.Payload.Level {
		t.Fatalf("issued Level = %q, want %q", issuedPayload.Level, fixture.Client.Payload.Level)
	}
	if issuedPayload.Steps != fixture.Client.Payload.Steps {
		t.Fatalf("issued Steps = %d, want %d", issuedPayload.Steps, fixture.Client.Payload.Steps)
	}

	expectTokenError(t, func() error {
		_, err := redeemSDK.IssueSession(context.Background(), SessionInput{
			ChallengeToken: fixture.Challenge.Token,
			ClientToken:    fixture.Client.Token,
		})
		return err
	}, fixture.ExpectedErrors.NonceAlreadyConsumed)

	expectTokenError(t, func() error {
		_, err := sdk.IssueSession(context.Background(), SessionInput{
			ChallengeToken: fixture.HighChallenge.Token,
			ClientToken:    fixture.LowClient.Token,
		})
		return err
	}, fixture.ExpectedErrors.InsufficientLevel)

	expectTokenError(t, func() error {
		_, err := sdk.IssueSession(context.Background(), SessionInput{
			ChallengeToken: fixture.Challenge.Token,
			ClientToken:    fixture.MismatchClient.Token,
		})
		return err
	}, fixture.ExpectedErrors.ChallengeNonceMismatch)
}

func loadConformanceFixture(t *testing.T) conformanceFixture {
	t.Helper()
	raw, err := os.ReadFile("../../conformance/fixtures.json")
	if err != nil {
		t.Fatalf("read conformance fixture: %v", err)
	}
	var fixture conformanceFixture
	if err := json.Unmarshal(raw, &fixture); err != nil {
		t.Fatalf("decode conformance fixture: %v", err)
	}
	return fixture
}

func newConformanceServer(t *testing.T, fixture conformanceFixture) *Server {
	t.Helper()
	sdk, err := New(Options{
		Secret:   fixture.Secret,
		Issuer:   "conformance",
		Audience: "demo",
	})
	if err != nil {
		t.Fatalf("New conformance server: %v", err)
	}
	return sdk
}

func expectTokenError(t *testing.T, fn func() error, code ErrorCode) {
	t.Helper()
	err := fn()
	if !IsTokenError(err, code) {
		t.Fatalf("error = %v, want %s", err, code)
	}
}

func assertChallengePayload(t *testing.T, got ChallengePayload, want ChallengePayload) {
	t.Helper()
	if got.Version != want.Version ||
		got.Kind != want.Kind ||
		got.Issuer != want.Issuer ||
		got.Audience != want.Audience ||
		got.Subject != want.Subject ||
		got.IssuedAt != want.IssuedAt ||
		got.ExpiresAt != want.ExpiresAt ||
		got.Nonce != want.Nonce ||
		got.RequiredLevel != want.RequiredLevel ||
		got.RequiredSteps != want.RequiredSteps {
		t.Fatalf("challenge payload = %+v, want %+v", got, want)
	}
	assertContextIntent(t, got.Context, want.Context)
}

func assertSessionPayload(t *testing.T, got SessionPayload, want SessionPayload) {
	t.Helper()
	if got.Version != want.Version ||
		got.Kind != want.Kind ||
		got.Issuer != want.Issuer ||
		got.Audience != want.Audience ||
		got.Subject != want.Subject ||
		got.IssuedAt != want.IssuedAt ||
		got.ExpiresAt != want.ExpiresAt ||
		got.Nonce != want.Nonce ||
		got.Level != want.Level ||
		got.Steps != want.Steps ||
		got.ItemsPerStep != want.ItemsPerStep ||
		got.ChallengeNonce != want.ChallengeNonce {
		t.Fatalf("session payload = %+v, want %+v", got, want)
	}
	assertContextIntent(t, got.Context, want.Context)
}

func assertClientPayload(t *testing.T, got ClientPayload, want ClientPayload) {
	t.Helper()
	if got != want {
		t.Fatalf("client payload = %+v, want %+v", got, want)
	}
}

func assertContextIntent(t *testing.T, got map[string]interface{}, want map[string]interface{}) {
	t.Helper()
	if got["intent"] != want["intent"] {
		t.Fatalf("context intent = %v, want %v", got["intent"], want["intent"])
	}
}
