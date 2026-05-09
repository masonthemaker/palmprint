// Helpers for protecting Next.js route handlers behind a verified session.
//
//   import { createPalmprintNext } from "@palmprint/server/next";
//
//   const { requirePalmprint } = createPalmprintNext(() => palmprint);
//
//   export const POST = requirePalmprint(
//     { level: "high" },
//     async (req, session) => {
//       // session is the verified SessionPayload.
//       return Response.json({ ok: true });
//     },
//   );
//
// 401 on missing/invalid token. 403 on insufficient level.

import { NextRequest, NextResponse } from "next/server";
import {
  PalmprintTokenError,
  type PalmprintServer,
  type SecurityLevel,
  type SessionPayload,
} from "./server";

const LEVEL_RANK: Record<SecurityLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

export type RequirePalmprintOptions = {
  /** Minimum required session level. Defaults to no minimum. */
  level?: SecurityLevel;
  /** Custom error responder. Receives the request and an error message. */
  onUnauthorized?: (
    req: NextRequest,
    error: string,
    code: number,
  ) => Response | Promise<Response>;
};

export type PalmprintHandler<P = unknown> = (
  req: NextRequest,
  session: SessionPayload,
  ctx: { params: P },
) => Response | Promise<Response>;

function extractToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (auth) {
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (m) return m[1].trim();
  }
  // Allow X-Palmprint-Token header as a convenience.
  const x = req.headers.get("x-palmprint-token");
  if (x) return x.trim();
  return null;
}

export function createPalmprintNext(getPalmprint: () => PalmprintServer) {
  function requirePalmprint<P = unknown>(
    options: RequirePalmprintOptions | undefined,
    handler: PalmprintHandler<P>,
  ): (req: NextRequest, ctx: { params: P }) => Promise<Response> {
    const opts = options ?? {};
    const respond = async (
      req: NextRequest,
      error: string,
      code: number,
    ): Promise<Response> => {
      if (opts.onUnauthorized) return opts.onUnauthorized(req, error, code);
      return NextResponse.json(
        {
          error,
          code: "palmprint_" + (code === 401 ? "unauthorized" : "forbidden"),
        },
        { status: code },
      );
    };

    return async (req, ctx) => {
      const token = extractToken(req);
      if (!token) {
        return respond(req, "Missing Palmprint session token", 401);
      }
      let session: SessionPayload;
      try {
        session = getPalmprint().verifySession(token);
      } catch (e) {
        const msg =
          e instanceof PalmprintTokenError ? e.message : "Invalid token";
        return respond(req, msg, 401);
      }
      if (opts.level) {
        const need = LEVEL_RANK[opts.level];
        const got = LEVEL_RANK[session.level];
        if (typeof got !== "number" || got < need) {
          return respond(
            req,
            `Insufficient verification level: required '${opts.level}', got '${session.level}'`,
            403,
          );
        }
      }
      return handler(req, session, ctx);
    };
  }

  function tryVerifyRequest(req: NextRequest): SessionPayload | null {
    const token = extractToken(req);
    if (!token) return null;
    try {
      return getPalmprint().verifySession(token);
    } catch {
      return null;
    }
  }

  return { requirePalmprint, tryVerifyRequest };
}
