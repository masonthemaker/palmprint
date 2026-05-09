import { NextRequest, NextResponse } from "next/server";
import { captureStore } from "@/lib/captureStore";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await captureStore.get(id);
  if (!result) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(result.blob), {
    headers: {
      "Content-Type": result.record.mimeType,
      "Content-Disposition": `inline; filename="${result.record.filename}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
