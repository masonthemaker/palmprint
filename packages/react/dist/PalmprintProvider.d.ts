import { type ReactNode } from "react";
import { type Capture, type CaptureMode, type Mode, type SecurityLevel } from "./Palmprint";
/** What the caller actually gets from `requireVerification`. */
export type VerificationResult = {
    /**
     * HMAC-signed session token issued by the server SDK. Send this in an
     * `Authorization: Bearer …` header to your protected endpoints.
     *
     * Empty string when the provider is configured with `apiBase={false}` —
     * in that mode only the unsigned `clientToken` is available.
     */
    sessionToken: string;
    expiresAt: number;
    level: SecurityLevel;
    /** The challenge nonce the server bound this verification to. */
    challengeNonce: string;
    /**
     * The unsigned palmprint.<base64> token. Mostly useful for inspection /
     * debugging; you should rely on `sessionToken` for auth.
     */
    clientToken: string;
    /** Raw blobs still in browser memory. */
    captures: Capture[];
    /** IDs of captures uploaded to /captures (when uploadCaptures is on). */
    uploadedCaptureIds: string[];
};
export type RequireOptions = {
    level?: SecurityLevel;
    numTests?: number;
    mode?: Mode;
    captureMode?: CaptureMode;
    /** Headline shown above the verification modal. */
    reason?: string;
    /** Subtitle shown above the verification modal. */
    description?: string;
    /**
     * Pre-issued challenge — when supplied, the provider uses it instead of
     * fetching one from `apiBase/challenge`. Useful when the challenge was
     * minted by another flow (e.g. the agent-consent record).
     */
    challengeToken?: string;
    challengeNonce?: string;
};
export type PalmprintGateContext = {
    requireVerification: (opts?: RequireOptions) => Promise<VerificationResult>;
    isOpen: boolean;
};
export type PalmprintContextValue = PalmprintGateContext & {
    /** Friendly alias for requireVerification. */
    verify: (opts?: RequireOptions) => Promise<VerificationResult>;
};
export type PalmprintProviderProps = {
    children: ReactNode;
    /**
     * API base for /challenge, /redeem, /captures. Defaults to
     * `/api/palmprint`. Pass `false` to disable the server flow entirely
     * (the Promise will resolve with sessionToken: "" and only the
     * unsigned client token will be available).
     */
    apiBase?: string | false;
    /**
     * If true (default) and captures were produced, the provider uploads
     * them to `${apiBase}/captures` after redeem.
     */
    uploadCaptures?: boolean;
};
export declare function PalmprintProvider({ children, apiBase, uploadCaptures, }: PalmprintProviderProps): import("react/jsx-runtime").JSX.Element;
export declare function usePalmprintGate(): PalmprintGateContext;
export declare function usePalmprint(): PalmprintContextValue;
//# sourceMappingURL=PalmprintProvider.d.ts.map