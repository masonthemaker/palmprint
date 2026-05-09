import { type PalmprintServer } from "./server";
export type PalmprintRoutesOptions = {
    secret: string;
    issuer?: string;
    audience?: string;
    palmprint?: PalmprintServer;
};
export declare function createPalmprintRoutes(options: PalmprintRoutesOptions): {
    palmprint: PalmprintServer;
    challenge: (req: Request) => Promise<Response>;
    redeem: (req: Request) => Promise<Response>;
};
//# sourceMappingURL=next-route-handlers.d.ts.map