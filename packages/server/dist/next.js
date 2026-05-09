// packages/server/src/next.ts
import { NextResponse } from "next/server.js";

// packages/server/src/server.ts
var PalmprintTokenError = class extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PalmprintTokenError";
    this.code = code;
  }
};

// packages/server/src/next.ts
var LEVEL_RANK = {
  low: 0,
  medium: 1,
  high: 2
};
function extractToken(req) {
  const auth = req.headers.get("authorization");
  if (auth) {
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (m) return m[1].trim();
  }
  const x = req.headers.get("x-palmprint-token");
  if (x) return x.trim();
  return null;
}
function createPalmprintNext(getPalmprint) {
  function requirePalmprint(options, handler) {
    const opts = options ?? {};
    const respond = async (req, error, code) => {
      if (opts.onUnauthorized) return opts.onUnauthorized(req, error, code);
      return NextResponse.json(
        {
          error,
          code: "palmprint_" + (code === 401 ? "unauthorized" : "forbidden")
        },
        { status: code }
      );
    };
    return async (req, ctx) => {
      const token = extractToken(req);
      if (!token) {
        return respond(req, "Missing Palmprint session token", 401);
      }
      let session;
      try {
        session = getPalmprint().verifySession(token);
      } catch (e) {
        const msg = e instanceof PalmprintTokenError ? e.message : "Invalid token";
        return respond(req, msg, 401);
      }
      if (opts.level) {
        const need = LEVEL_RANK[opts.level];
        const got = LEVEL_RANK[session.level];
        if (typeof got !== "number" || got < need) {
          return respond(
            req,
            `Insufficient verification level: required '${opts.level}', got '${session.level}'`,
            403
          );
        }
      }
      return handler(req, session, ctx);
    };
  }
  function tryVerifyRequest(req) {
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
export {
  createPalmprintNext
};
//# sourceMappingURL=next.js.map
