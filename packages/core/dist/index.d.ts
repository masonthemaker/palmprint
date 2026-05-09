export type SecurityLevel = "low" | "medium" | "high";
export type Mode = "hand" | "face" | "both";
export type CaptureMode = "off" | "photo" | "video";
export type ChallengePayload = {
    v: 1;
    kind: "challenge";
    iss: string;
    aud?: string;
    sub?: string;
    iat: number;
    exp: number;
    nonce: string;
    required_level: SecurityLevel;
    required_steps: number;
    ctx?: Record<string, unknown>;
};
export type SessionPayload = {
    v: 1;
    kind: "session";
    iss: string;
    aud?: string;
    sub?: string;
    iat: number;
    exp: number;
    nonce: string;
    level: SecurityLevel;
    steps: number;
    items_per_step: number;
    challenge_nonce: string;
    ctx?: Record<string, unknown>;
};
export type ClientPalmprintPayload = {
    v: number;
    iss: string;
    iat: number;
    exp: number;
    nonce: string;
    level: SecurityLevel;
    steps: number;
    items_per_step: number;
    challenge_nonce?: string;
};
export type VerificationResultBase = {
    sessionToken: string;
    expiresAt: number;
    level: SecurityLevel;
    challengeNonce: string;
    clientToken: string;
    uploadedCaptureIds: string[];
};
export declare function base64UrlEncode(input: string): string;
export declare function base64UrlDecodeToString(input: string): string;
//# sourceMappingURL=index.d.ts.map