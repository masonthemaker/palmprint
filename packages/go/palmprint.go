// Package palmprint provides the Go server SDK for Palmprint verification.
//
// It mirrors the TypeScript server SDK: issue a signed challenge token, redeem
// the browser-issued client token into a signed session token, and verify that
// session token on protected routes.
package palmprint

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"
)

const (
	LevelLow    SecurityLevel = "low"
	LevelMedium SecurityLevel = "medium"
	LevelHigh   SecurityLevel = "high"

	prefixChallenge = "ppc"
	prefixSession   = "pps"
	clientPrefix    = "palmprint."
)

// SecurityLevel is the minimum assurance level required by a challenge or
// reported by a client token.
type SecurityLevel string

var levelRank = map[SecurityLevel]int{
	LevelLow:    0,
	LevelMedium: 1,
	LevelHigh:   2,
}

// ErrorCode is a stable machine-readable Palmprint error code.
type ErrorCode string

const (
	ErrMalformedToken         ErrorCode = "malformed_token"
	ErrWrongKind              ErrorCode = "wrong_kind"
	ErrBadSignature           ErrorCode = "bad_signature"
	ErrBadPayload             ErrorCode = "bad_payload"
	ErrExpired                ErrorCode = "expired"
	ErrInsufficientLevel      ErrorCode = "insufficient_level"
	ErrInsufficientSteps      ErrorCode = "insufficient_steps"
	ErrChallengeNonceMismatch ErrorCode = "challenge_nonce_mismatch"
	ErrNonceAlreadyConsumed   ErrorCode = "nonce_already_consumed"
	ErrClientTokenInvalid     ErrorCode = "client_token_invalid"
	ErrSecretTooShort         ErrorCode = "secret_too_short"
)

// TokenError is returned for all expected token and verification failures.
type TokenError struct {
	Code    ErrorCode
	Message string
}

func (e *TokenError) Error() string {
	return e.Message
}

func tokenError(code ErrorCode, msg string) *TokenError {
	return &TokenError{Code: code, Message: msg}
}

// ChallengePayload is the signed server-issued challenge token payload.
type ChallengePayload struct {
	Version       int                    `json:"v"`
	Kind          string                 `json:"kind"`
	Issuer        string                 `json:"iss"`
	Audience      string                 `json:"aud,omitempty"`
	Subject       string                 `json:"sub,omitempty"`
	IssuedAt      int64                  `json:"iat"`
	ExpiresAt     int64                  `json:"exp"`
	Nonce         string                 `json:"nonce"`
	RequiredLevel SecurityLevel          `json:"required_level"`
	RequiredSteps int                    `json:"required_steps"`
	Context       map[string]interface{} `json:"ctx,omitempty"`
}

// SessionPayload is the signed session token payload.
type SessionPayload struct {
	Version        int                    `json:"v"`
	Kind           string                 `json:"kind"`
	Issuer         string                 `json:"iss"`
	Audience       string                 `json:"aud,omitempty"`
	Subject        string                 `json:"sub,omitempty"`
	IssuedAt       int64                  `json:"iat"`
	ExpiresAt      int64                  `json:"exp"`
	Nonce          string                 `json:"nonce"`
	Level          SecurityLevel          `json:"level"`
	Steps          int                    `json:"steps"`
	ItemsPerStep   int                    `json:"items_per_step"`
	ChallengeNonce string                 `json:"challenge_nonce"`
	Context        map[string]interface{} `json:"ctx,omitempty"`
}

// ClientPayload is the unsigned browser-issued token payload.
type ClientPayload struct {
	Version        int           `json:"v"`
	Issuer         string        `json:"iss"`
	IssuedAt       int64         `json:"iat"`
	ExpiresAt      int64         `json:"exp"`
	Nonce          string        `json:"nonce"`
	Level          SecurityLevel `json:"level"`
	Steps          int           `json:"steps"`
	ItemsPerStep   int           `json:"items_per_step"`
	ChallengeNonce string        `json:"challenge_nonce,omitempty"`
}

// NonceStore tracks consumed challenge nonces. Use a durable implementation
// such as Redis or Postgres for multi-replica production deployments.
type NonceStore interface {
	Has(ctx context.Context, nonce string) (bool, error)
	Consume(ctx context.Context, nonce string, ttl time.Duration) error
}

// MemoryNonceStore is a single-process nonce store, suitable for development
// and tests.
type MemoryNonceStore struct {
	mu   sync.Mutex
	used map[string]time.Time
	now  func() time.Time
}

func NewMemoryNonceStore() *MemoryNonceStore {
	return &MemoryNonceStore{
		used: make(map[string]time.Time),
		now:  time.Now,
	}
}

func (s *MemoryNonceStore) Has(_ context.Context, nonce string) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.gc()
	_, ok := s.used[nonce]
	return ok, nil
}

func (s *MemoryNonceStore) Consume(_ context.Context, nonce string, ttl time.Duration) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.gc()
	if ttl < 0 {
		ttl = 0
	}
	s.used[nonce] = s.now().Add(ttl)
	return nil
}

func (s *MemoryNonceStore) gc() {
	now := s.now()
	for nonce, exp := range s.used {
		if !exp.After(now) {
			delete(s.used, nonce)
		}
	}
}

// Options configures a Palmprint server SDK instance.
type Options struct {
	Secret     string
	Issuer     string
	Audience   string
	NonceStore NonceStore
	Now        func() time.Time
}

// Server issues and verifies Palmprint tokens.
type Server struct {
	secret     string
	issuer     string
	audience   string
	nonceStore NonceStore
	now        func() time.Time
}

func New(options Options) (*Server, error) {
	if len(options.Secret) < 32 {
		return nil, tokenError(ErrSecretTooShort, "Palmprint secret must be at least 32 characters")
	}

	issuer := options.Issuer
	if issuer == "" {
		issuer = "palmprint"
	}

	store := options.NonceStore
	if store == nil {
		store = NewMemoryNonceStore()
	}

	now := options.Now
	if now == nil {
		now = time.Now
	}

	return &Server{
		secret:     options.Secret,
		issuer:     issuer,
		audience:   options.Audience,
		nonceStore: store,
		now:        now,
	}, nil
}

type ChallengeOptions struct {
	TTL           time.Duration
	RequiredLevel SecurityLevel
	RequiredSteps int
	Subject       string
	Audience      string
	Context       map[string]interface{}
}

type ChallengeResult struct {
	Token   string
	Nonce   string
	Payload ChallengePayload
}

func (s *Server) IssueChallenge(options ChallengeOptions) (ChallengeResult, error) {
	now := s.now().Unix()
	ttl := options.TTL
	if ttl == 0 {
		ttl = 5 * time.Minute
	}

	level := options.RequiredLevel
	if level == "" {
		level = LevelMedium
	}

	steps := options.RequiredSteps
	if steps == 0 {
		steps = 2
	}

	audience := options.Audience
	if audience == "" {
		audience = s.audience
	}

	nonce, err := randomHex(16)
	if err != nil {
		return ChallengeResult{}, err
	}

	payload := ChallengePayload{
		Version:       1,
		Kind:          "challenge",
		Issuer:        s.issuer,
		Audience:      audience,
		Subject:       options.Subject,
		IssuedAt:      now,
		ExpiresAt:     now + int64(ttl.Seconds()),
		Nonce:         nonce,
		RequiredLevel: level,
		RequiredSteps: steps,
		Context:       options.Context,
	}

	token, err := s.sign(prefixChallenge, payload)
	if err != nil {
		return ChallengeResult{}, err
	}

	return ChallengeResult{Token: token, Nonce: nonce, Payload: payload}, nil
}

func (s *Server) VerifyChallenge(token string) (ChallengePayload, error) {
	var payload ChallengePayload
	if err := s.verify(prefixChallenge, token, &payload); err != nil {
		return ChallengePayload{}, err
	}
	if payload.Kind != "challenge" {
		return ChallengePayload{}, tokenError(ErrWrongKind, "Not a challenge token")
	}
	return payload, nil
}

type SessionInput struct {
	ChallengeToken string
	ClientToken    string
	TTL            time.Duration
	Subject        string
}

type SessionResult struct {
	Token   string
	Payload SessionPayload
}

func (s *Server) IssueSession(ctx context.Context, input SessionInput) (SessionResult, error) {
	challenge, err := s.VerifyChallenge(input.ChallengeToken)
	if err != nil {
		return SessionResult{}, err
	}

	used, err := s.nonceStore.Has(ctx, challenge.Nonce)
	if err != nil {
		return SessionResult{}, err
	}
	if used {
		return SessionResult{}, tokenError(ErrNonceAlreadyConsumed, "Challenge has already been redeemed")
	}

	client, err := ParseClientToken(input.ClientToken, s.now)
	if err != nil {
		return SessionResult{}, err
	}

	if client.ChallengeNonce != challenge.Nonce {
		return SessionResult{}, tokenError(ErrChallengeNonceMismatch, "Client token does not embed this challenge's nonce")
	}

	got, gotOK := levelRank[client.Level]
	need, needOK := levelRank[challenge.RequiredLevel]
	if !gotOK || !needOK || got < need {
		return SessionResult{}, tokenError(
			ErrInsufficientLevel,
			fmt.Sprintf("Required level %q, got %q", challenge.RequiredLevel, client.Level),
		)
	}

	if client.Steps < challenge.RequiredSteps {
		return SessionResult{}, tokenError(
			ErrInsufficientSteps,
			fmt.Sprintf("Required %d steps, got %d", challenge.RequiredSteps, client.Steps),
		)
	}

	ttlUntilChallengeExpiry := time.Duration(challenge.ExpiresAt-s.now().Unix()) * time.Second
	if err := s.nonceStore.Consume(ctx, challenge.Nonce, ttlUntilChallengeExpiry); err != nil {
		return SessionResult{}, err
	}

	now := s.now().Unix()
	ttl := input.TTL
	if ttl == 0 {
		ttl = 30 * time.Minute
	}

	subject := input.Subject
	if subject == "" {
		subject = challenge.Subject
	}

	nonce, err := randomHex(16)
	if err != nil {
		return SessionResult{}, err
	}

	payload := SessionPayload{
		Version:        1,
		Kind:           "session",
		Issuer:         s.issuer,
		Audience:       challenge.Audience,
		Subject:        subject,
		IssuedAt:       now,
		ExpiresAt:      now + int64(ttl.Seconds()),
		Nonce:          nonce,
		Level:          client.Level,
		Steps:          client.Steps,
		ItemsPerStep:   client.ItemsPerStep,
		ChallengeNonce: challenge.Nonce,
		Context:        challenge.Context,
	}
	if payload.Audience == "" {
		payload.Audience = s.audience
	}

	token, err := s.sign(prefixSession, payload)
	if err != nil {
		return SessionResult{}, err
	}

	return SessionResult{Token: token, Payload: payload}, nil
}

func (s *Server) VerifySession(token string) (SessionPayload, error) {
	var payload SessionPayload
	if err := s.verify(prefixSession, token, &payload); err != nil {
		return SessionPayload{}, err
	}
	if payload.Kind != "session" {
		return SessionPayload{}, tokenError(ErrWrongKind, "Not a session token")
	}
	return payload, nil
}

func ParseClientToken(token string, now func() time.Time) (ClientPayload, error) {
	if !strings.HasPrefix(token, clientPrefix) {
		return ClientPayload{}, tokenError(ErrClientTokenInvalid, "Client token must start with 'palmprint.'")
	}

	if now == nil {
		now = time.Now
	}

	body := strings.TrimPrefix(token, clientPrefix)
	raw, err := base64.RawURLEncoding.DecodeString(body)
	if err != nil {
		return ClientPayload{}, tokenError(ErrClientTokenInvalid, "Could not decode client token")
	}

	var payload ClientPayload
	if err := json.Unmarshal(raw, &payload); err != nil {
		return ClientPayload{}, tokenError(ErrClientTokenInvalid, "Could not decode client token")
	}

	if payload.ExpiresAt < now().Unix() {
		return ClientPayload{}, tokenError(ErrExpired, "Client token expired")
	}

	return payload, nil
}

func EncodeClientToken(payload ClientPayload) (string, error) {
	raw, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	return clientPrefix + base64.RawURLEncoding.EncodeToString(raw), nil
}

func IsTokenError(err error, code ErrorCode) bool {
	var tokenErr *TokenError
	return errors.As(err, &tokenErr) && tokenErr.Code == code
}

func (s *Server) sign(prefix string, payload interface{}) (string, error) {
	raw, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	body := base64.RawURLEncoding.EncodeToString(raw)
	mac := hmac.New(sha256.New, []byte(s.secret))
	mac.Write([]byte(prefix + "." + body))
	sig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return prefix + "." + body + "." + sig, nil
}

func (s *Server) verify(prefix string, token string, payload interface{}) error {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return tokenError(ErrMalformedToken, "Token is malformed")
	}

	if parts[0] != prefix {
		return tokenError(ErrWrongKind, fmt.Sprintf("Wrong token kind: expected %q, got %q", prefix, parts[0]))
	}

	mac := hmac.New(sha256.New, []byte(s.secret))
	mac.Write([]byte(prefix + "." + parts[1]))
	expected := mac.Sum(nil)

	actual, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return tokenError(ErrBadSignature, "Signature decode failed")
	}

	if len(expected) != len(actual) || subtle.ConstantTimeCompare(expected, actual) != 1 {
		return tokenError(ErrBadSignature, "Invalid signature")
	}

	raw, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return tokenError(ErrBadPayload, "Invalid payload encoding")
	}

	if err := json.Unmarshal(raw, payload); err != nil {
		return tokenError(ErrBadPayload, "Invalid payload JSON")
	}

	exp, err := payloadExpiry(payload)
	if err != nil {
		return err
	}
	if exp != 0 && exp < s.now().Unix() {
		return tokenError(ErrExpired, "Token expired")
	}

	return nil
}

func payloadExpiry(payload interface{}) (int64, error) {
	raw, err := json.Marshal(payload)
	if err != nil {
		return 0, err
	}
	var claims struct {
		ExpiresAt int64 `json:"exp"`
	}
	if err := json.Unmarshal(raw, &claims); err != nil {
		return 0, tokenError(ErrBadPayload, "Invalid payload JSON")
	}
	return claims.ExpiresAt, nil
}

func randomHex(bytes int) (string, error) {
	buf := make([]byte, bytes)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}
