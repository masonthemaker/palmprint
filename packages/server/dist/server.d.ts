import type { ChallengePayload, ClientPalmprintPayload, SecurityLevel, SessionPayload } from "@palmprint/core";
export type { ChallengePayload, ClientPalmprintPayload, SecurityLevel, SessionPayload, } from "@palmprint/core";
export type PalmprintErrorCode = "malformed_token" | "wrong_kind" | "bad_signature" | "bad_payload" | "expired" | "insufficient_level" | "insufficient_steps" | "challenge_nonce_mismatch" | "nonce_already_consumed" | "client_token_invalid" | "secret_too_short";
export declare class PalmprintTokenError extends Error {
    code: PalmprintErrorCode;
    constructor(code: PalmprintErrorCode, message: string);
}
export type NonceStore = {
    /** Returns true if the nonce has been used; false otherwise. */
    has(nonce: string): boolean | Promise<boolean>;
    /** Marks the nonce as used. ttlSeconds is a hint for storage backends. */
    consume(nonce: string, ttlSeconds: number): void | Promise<void>;
};
/**
 * In-memory nonce store. Single-process only — replace with Redis or a DB
 * for multi-replica deployments.
 */
export declare function createMemoryNonceStore(): NonceStore;
export declare function parseClientToken(token: string): ClientPalmprintPayload;
export type CreatePalmprintServerOptions = {
    /** HMAC secret. Must be at least 32 characters. */
    secret: string;
    /** Issuer string written into all signed tokens. Defaults to 'palmprint'. */
    issuer?: string;
    /** Default audience for issued tokens. */
    audience?: string;
    /** Backend for single-use nonce tracking. Defaults to in-memory. */
    nonceStore?: NonceStore;
};
export type IssueChallengeOptions = {
    /** Lifetime of the challenge. Defaults to 300 (5 min). */
    ttlSeconds?: number;
    /** Minimum required Palmprint level. Defaults to 'medium'. */
    requiredLevel?: SecurityLevel;
    /** Minimum required step count. Defaults to 2. */
    requiredSteps?: number;
    /** Subject (typically your user id). */
    subject?: string;
    /** Audience override. */
    audience?: string;
    /** Free-form context object — echoed into the resulting session token. */
    context?: Record<string, unknown>;
};
export type IssueSessionInput = {
    challengeToken: string;
    clientToken: string;
    /** Lifetime of the session token. Defaults to 1800 (30 min). */
    ttlSeconds?: number;
    /** Override / set subject on the session token. */
    subject?: string;
};
export type PalmprintServer = {
    issueChallenge(opts?: IssueChallengeOptions): {
        token: string;
        nonce: string;
        payload: ChallengePayload;
    };
    verifyChallenge(token: string): ChallengePayload;
    /**
     * Atomically: verify challenge, parse client token, check level/steps,
     * check challenge_nonce binding, mark nonce consumed, issue session token.
     *
     * Returns a Promise because the nonce store may be async (Redis, DB, etc).
     */
    issueSession(input: IssueSessionInput): Promise<{
        token: string;
        payload: SessionPayload;
    }>;
    verifySession(token: string): SessionPayload;
};
export declare function createPalmprintServer(options: CreatePalmprintServerOptions): PalmprintServer;
//# sourceMappingURL=server.d.ts.map