import {
  createPalmprintServer,
  type PalmprintServer,
} from "../../packages/server/src/server";

// Lazy singleton so the SDK is constructed once per process.
declare global {
  var __palmprintServer: PalmprintServer | undefined;
}

function getSecret(): string {
  const fromEnv = process.env.PALMPRINT_SECRET;
  if (fromEnv && fromEnv.length >= 32) return fromEnv;
  if (process.env.NODE_ENV === "production" && !fromEnv) {
    throw new Error(
      "PALMPRINT_SECRET env var is required in production (≥32 chars).",
    );
  }
  // Dev fallback — stable so tokens issued in one Next dev page survive HMR.
  console.warn(
    "[palmprint] PALMPRINT_SECRET not set; using insecure dev default.",
  );
  return "dev-only-insecure-secret-do-not-use-in-prod-please-32+chars";
}

export function palmprint(): PalmprintServer {
  if (!globalThis.__palmprintServer) {
    globalThis.__palmprintServer = createPalmprintServer({
      secret: getSecret(),
      issuer: process.env.PALMPRINT_ISSUER ?? "palmprint",
    });
  }
  return globalThis.__palmprintServer;
}
