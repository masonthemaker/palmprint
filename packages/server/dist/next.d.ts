import { NextRequest } from "next/server.js";
import { type PalmprintServer, type SecurityLevel, type SessionPayload } from "./server";
export type RequirePalmprintOptions = {
    /** Minimum required session level. Defaults to no minimum. */
    level?: SecurityLevel;
    /** Custom error responder. Receives the request and an error message. */
    onUnauthorized?: (req: NextRequest, error: string, code: number) => Response | Promise<Response>;
};
export type PalmprintHandler<P = unknown> = (req: NextRequest, session: SessionPayload, ctx: {
    params: P;
}) => Response | Promise<Response>;
export declare function createPalmprintNext(getPalmprint: () => PalmprintServer): {
    requirePalmprint: <P = unknown>(options: RequirePalmprintOptions | undefined, handler: PalmprintHandler<P>) => (req: NextRequest, ctx: {
        params: P;
    }) => Promise<Response>;
    tryVerifyRequest: (req: NextRequest) => SessionPayload | null;
};
//# sourceMappingURL=next.d.ts.map