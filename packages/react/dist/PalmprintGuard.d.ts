import { type ReactNode } from "react";
import { type RequireOptions, type VerificationResult } from "./PalmprintProvider";
export type PalmprintGuardProps = RequireOptions & {
    children: ReactNode;
    /** Called once after a successful verification. */
    onVerified?: (result: VerificationResult) => void;
    /** Custom UI to render while ungated. Defaults to a card with a verify button. */
    fallback?: ReactNode;
    /** If true (default), pop the modal automatically when the guard mounts. */
    autoOpen?: boolean;
};
/**
 * Page-level Palmprint gate. Renders {children} only after the user has
 * passed verification. Use for sensitive routes like password reset.
 */
export declare function PalmprintGuard({ children, level, numTests, mode, captureMode, reason, description, onVerified, fallback, autoOpen, }: PalmprintGuardProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=PalmprintGuard.d.ts.map