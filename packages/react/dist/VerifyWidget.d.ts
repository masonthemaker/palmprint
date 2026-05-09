import { type Capture, type CaptureMode, type ChallengeStyle, type Mode, type SecurityLevel } from "./Palmprint";
export type WidgetShape = "pill" | "rounded" | "square";
export type WidgetSize = "sm" | "md" | "lg";
export type WidgetTheme = "emerald" | "dark" | "light";
export type WidgetConfig = {
    label: string;
    verifiedLabel: string;
    shape: WidgetShape;
    size: WidgetSize;
    theme: WidgetTheme;
    showIcon: boolean;
    fullWidth: boolean;
    level: SecurityLevel;
    mode: Mode;
    numTests: number;
    captureMode: CaptureMode;
    challengeStyle: ChallengeStyle;
};
export declare const DEFAULT_WIDGET_CONFIG: WidgetConfig;
export type VerifyWidgetProps = {
    config: WidgetConfig;
    /**
     * API base for /challenge, /redeem, /captures. Pass a URL such as
     * "/api/palmprint" or "https://verify.example.com/api/palmprint" to emit a
     * signed session token. Pass false for manual/client-only mode.
     */
    apiBase?: string | false;
    uploadCaptures?: boolean;
    onVerified?: (result: {
        /** Back-compat alias: signed session token when available, otherwise client token. */
        token: string;
        sessionToken: string;
        clientToken: string;
        expiresAt: number;
        challengeNonce: string;
        captures: Capture[];
        uploadedCaptureIds: string[];
    }) => void;
    /**
     * If true, the modal opens immediately on mount (used by the configurator's
     * "Try it" button). The button itself still renders.
     */
    openSignal?: number;
};
export default function VerifyWidget({ config, apiBase, uploadCaptures, onVerified, openSignal, }: VerifyWidgetProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=VerifyWidget.d.ts.map