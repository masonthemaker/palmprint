import { NextRequest, NextResponse } from "next/server";
import { captureStore, captureStorageInfo } from "@/lib/captureStore";
import { requirePalmprint } from "@/lib/palmprintMiddleware";

// POST /api/palmprint/captures
// Multipart form upload bound to the caller's verified session.
// Body fields:
//   - file:    the blob (image/png or video/webm).
//   - meta:    JSON string with { type, prompt, stepIndex, ts }.
export const POST = requirePalmprint({}, async (req, session) => {
  const formData = await req.formData();
  const file = formData.get("file");
  const metaRaw = formData.get("meta");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Multipart 'file' field is required" },
      { status: 400 },
    );
  }
  let meta: Record<string, unknown> = {};
  if (typeof metaRaw === "string" && metaRaw.length > 0) {
    try {
      meta = JSON.parse(metaRaw);
    } catch {
      return NextResponse.json(
        { error: "Invalid 'meta' JSON" },
        { status: 400 },
      );
    }
  }

  const blob = Buffer.from(await file.arrayBuffer());
  const record = await captureStore.put({
    sessionNonce: session.challenge_nonce,
    type: meta.type === "video" ? "video" : "photo",
    mimeType: file.type || (meta.type === "video" ? "video/webm" : "image/png"),
    prompt: typeof meta.prompt === "string" ? meta.prompt : "",
    stepIndex: typeof meta.stepIndex === "number" ? meta.stepIndex : 0,
    ts: typeof meta.ts === "number" ? meta.ts : Date.now(),
    blob,
    filename: file.name || `capture.${meta.type === "video" ? "webm" : "png"}`,
  });

  return NextResponse.json({
    id: record.id,
    size: record.size,
    persisted: record.persisted,
    session_nonce: record.sessionNonce,
  });
});

// GET /api/palmprint/captures?session=<nonce>
// Lists capture metadata. In production you'd auth this further; for the
// demo we let anyone enumerate by session nonce (which is a high-entropy
// 32-char hex string).
export async function GET(req: NextRequest) {
  const sessionNonce = req.nextUrl.searchParams.get("session");
  const captures = await captureStore.list(
    sessionNonce ? { sessionNonce } : {},
  );
  return NextResponse.json({
    captures,
    storage: captureStorageInfo(),
  });
}
