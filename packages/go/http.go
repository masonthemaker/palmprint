package palmprint

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"
)

type contextKey string

const sessionContextKey contextKey = "palmprint.session"

type HTTPHandlers struct {
	Server *Server
}

func NewHTTPHandlers(server *Server) HTTPHandlers {
	return HTTPHandlers{Server: server}
}

func (h HTTPHandlers) Challenge(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method_not_allowed"})
		return
	}

	var body struct {
		RequiredLevel string                 `json:"required_level"`
		RequiredSteps int                    `json:"required_steps"`
		TTLSeconds    int                    `json:"ttl_seconds"`
		Subject       string                 `json:"subject"`
		Audience      string                 `json:"audience"`
		Context       map[string]interface{} `json:"context"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)

	opts := ChallengeOptions{
		RequiredLevel: SecurityLevel(body.RequiredLevel),
		RequiredSteps: body.RequiredSteps,
		Subject:       body.Subject,
		Audience:      body.Audience,
		Context:       body.Context,
	}
	if body.TTLSeconds > 0 {
		opts.TTL = time.Duration(body.TTLSeconds) * time.Second
	}

	result, err := h.Server.IssueChallenge(opts)
	if err != nil {
		writeError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"challenge_token": result.Token,
		"challenge_nonce": result.Nonce,
		"expires_at":      result.Payload.ExpiresAt,
		"required_level":  result.Payload.RequiredLevel,
		"required_steps":  result.Payload.RequiredSteps,
	})
}

func (h HTTPHandlers) Redeem(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method_not_allowed"})
		return
	}

	var body struct {
		ChallengeToken string `json:"challenge_token"`
		ClientToken    string `json:"client_token"`
		TTLSeconds     int    `json:"ttl_seconds"`
		Subject        string `json:"subject"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_json"})
		return
	}
	if body.ChallengeToken == "" || body.ClientToken == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "challenge_token and client_token are required"})
		return
	}

	input := SessionInput{
		ChallengeToken: body.ChallengeToken,
		ClientToken:    body.ClientToken,
		Subject:        body.Subject,
	}
	if body.TTLSeconds > 0 {
		input.TTL = time.Duration(body.TTLSeconds) * time.Second
	}

	result, err := h.Server.IssueSession(r.Context(), input)
	if err != nil {
		writeError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"session_token":   result.Token,
		"expires_at":      result.Payload.ExpiresAt,
		"level":           result.Payload.Level,
		"challenge_nonce": result.Payload.ChallengeNonce,
	})
}

func (h HTTPHandlers) RequirePalmprint(level SecurityLevel, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := bearerToken(r.Header.Get("Authorization"))
		if token == "" {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing_palmprint_token"})
			return
		}

		session, err := h.Server.VerifySession(token)
		if err != nil {
			writeError(w, err)
			return
		}

		if level != "" {
			got, gotOK := levelRank[session.Level]
			need, needOK := levelRank[level]
			if !gotOK || !needOK || got < need {
				writeJSON(w, http.StatusForbidden, map[string]string{"error": "insufficient_level"})
				return
			}
		}

		ctx := context.WithValue(r.Context(), sessionContextKey, session)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func SessionFromContext(ctx context.Context) (SessionPayload, bool) {
	session, ok := ctx.Value(sessionContextKey).(SessionPayload)
	return session, ok
}

func bearerToken(header string) string {
	if header == "" {
		return ""
	}
	parts := strings.SplitN(header, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		return ""
	}
	return strings.TrimSpace(parts[1])
}

func writeError(w http.ResponseWriter, err error) {
	var tokenErr *TokenError
	if ok := AsTokenError(err, &tokenErr); ok {
		status := http.StatusUnauthorized
		if tokenErr.Code == ErrNonceAlreadyConsumed || tokenErr.Code == ErrExpired {
			status = http.StatusConflict
		}
		writeJSON(w, status, map[string]string{"error": string(tokenErr.Code)})
		return
	}
	writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
}

func AsTokenError(err error, target **TokenError) bool {
	return errors.As(err, target)
}

func writeJSON(w http.ResponseWriter, status int, value interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
