import { type RequireOptions, type VerificationResult } from "./PalmprintProvider";
export type CaptchaTheme = "light" | "dark";
export type CaptchaCheckboxConfig = {
    /** Idle label. */
    label?: string;
    /** Label while the modal is open. */
    verifyingLabel?: string;
    /** Label after a successful verification. */
    verifiedLabel?: string;
    /** Label if verification was cancelled or failed. */
    failedLabel?: string;
    theme?: CaptchaTheme;
    fullWidth?: boolean;
} & Pick<RequireOptions, "level" | "mode" | "numTests" | "captureMode" | "challengeStyle" | "challengeNonce">;
export declare const DEFAULT_CAPTCHA_CONFIG: Required<Pick<CaptchaCheckboxConfig, "label" | "verifyingLabel" | "verifiedLabel" | "failedLabel" | "theme" | "fullWidth">> & Pick<CaptchaCheckboxConfig, "level" | "mode" | "numTests" | "captureMode" | "challengeStyle">;
export type CaptchaCheckboxProps = {
    config?: CaptchaCheckboxConfig;
    onVerified?: (result: VerificationResult) => void;
};
export default function CaptchaCheckbox({ config, onVerified, }: CaptchaCheckboxProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=CaptchaCheckbox.d.ts.map