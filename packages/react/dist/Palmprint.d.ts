import type { CaptureMode, Mode, SecurityLevel } from "@palmprint/core";
export type { CaptureMode, Mode, SecurityLevel } from "@palmprint/core";
export type Capture = {
    id: string;
    stepIndex: number;
    prompt: string;
    type: "photo" | "video";
    mimeType: string;
    blob: Blob;
    url: string;
    ts: number;
};
export declare function captureFileName(c: Capture): string;
export type PalmprintProps = {
    initialLevel?: SecurityLevel;
    initialMode?: Mode;
    initialNumTests?: number;
    initialCaptureMode?: CaptureMode;
    /** Hides the settings gear button (settings still take effect from initial* props). */
    lockSettings?: boolean;
    /** Auto-start the verification once models load. */
    autoStart?: boolean;
    /** Compact header for embedding (modal/widget). */
    compact?: boolean;
    /** Show a close (×) button — only rendered when this is provided. */
    onCancel?: () => void;
    /** Fired once when verification succeeds. */
    onVerified?: (result: {
        token: string;
        captures: Capture[];
    }) => void;
    /**
     * Server-issued nonce from the challenge endpoint. When provided, it's
     * embedded in the client token so the server can bind the verification
     * to the original challenge.
     */
    challengeNonce?: string;
};
export default function Palmprint({ initialLevel, initialMode, initialNumTests, initialCaptureMode, lockSettings, autoStart, compact, onCancel, onVerified, challengeNonce, }?: PalmprintProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=Palmprint.d.ts.map