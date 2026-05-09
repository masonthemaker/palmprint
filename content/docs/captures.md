# Captures bucket

When `captureMode` is `"photo"` or `"video"`, the browser produces raw `Blob`s for each matched step. With the React auto-flow, the provider uploads them to `/api/palmprint/captures` as soon as the session token is issued, gated by `requirePalmprint` — so only verified sessions can populate the bucket.

## Why captures

Captures are the bridge between Palmprint as "the user reacted in real time" and Palmprint as "the user is genuinely a live human." The bucket gives you raw, lossless frames you can run through any downstream pipeline:

- AI / deepfake classifiers (e.g. AIGC detection).
- Manual review for suspicious sessions.
- Forensic investigation after fraud reports.
- Training data for your own liveness model.

The format is **lossless PNG** for photos and **native browser-encoded WebM** (or MP4 on Safari) for video — no re-encoding by us.

## Storage interface

Implementations live behind `CaptureStore` in [`src/lib/captureStore.ts`](https://github.com/your-org/palmprint/blob/main/src/lib/captureStore.ts):

```ts
type CaptureStore = {
  put(input: CaptureInput): Promise<CaptureRecord>;
  get(id: string): Promise<{ blob: Buffer; record: CaptureRecord } | null>;
  list(opts?: { sessionNonce?: string }): Promise<CaptureRecord[]>;
  remove(id: string): Promise<boolean>;
};
```

The default ships:

- **In-memory** records (always, for fast list/get).
- **Filesystem persistence** for blobs when `PALMPRINT_CAPTURE_DIR` is set, or in development under `os.tmpdir()/palmprint-captures`.

## Drop-in adapters

The interface is small enough that swapping in your own backend is straightforward. Here's an S3 sketch:

```ts
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import type { CaptureStore } from "@/lib/captureStore";

const s3 = new S3Client({});
const Bucket = process.env.PALMPRINT_S3_BUCKET!;

export const s3CaptureStore: CaptureStore = {
  async put(input) {
    const id = crypto.randomBytes(8).toString("hex");
    const Key = `${input.sessionNonce}/${id}-${input.filename}`;
    await s3.send(new PutObjectCommand({
      Bucket, Key,
      Body: input.blob,
      ContentType: input.mimeType,
    }));
    return {
      id, sessionNonce: input.sessionNonce, type: input.type,
      mimeType: input.mimeType, prompt: input.prompt,
      stepIndex: input.stepIndex, ts: input.ts,
      size: input.blob.length, filename: input.filename, persisted: true,
    };
  },
  async get(id) {
    // ... fetch record from your own DB, then S3 GetObjectCommand for the bytes
  },
  async list({ sessionNonce } = {}) {
    // ... query your DB; S3 doesn't fit a record store
  },
  async remove(id) {
    // ... delete from S3 + DB
  },
};
```

## Endpoints

### `POST /api/palmprint/captures`

Multipart form upload. Bound to `session.challenge_nonce` server-side (the middleware enforces this).

**Headers:** `Authorization: Bearer <session_token>`

**Body fields:**

- `file` — the blob (image/png or video/webm).
- `meta` — JSON string with `{ type, prompt, stepIndex, ts }`.

**Response:**

```json
{
  "id": "abc123def456",
  "size": 81234,
  "persisted": true,
  "session_nonce": "<challenge_nonce>"
}
```

**Status codes:** 200 on success, 400 on missing/invalid form fields, 401 on bad session token (from `requirePalmprint`).

### `GET /api/palmprint/captures?session=<nonce>`

Lists capture records (metadata only). Optional `session` query param filters by nonce. In production you'd want to scope this further.

```json
{
  "captures": [
    {
      "id": "abc123def456",
      "sessionNonce": "9b8a...",
      "type": "photo",
      "mimeType": "image/png",
      "prompt": "Closed Fist + Smile",
      "stepIndex": 0,
      "ts": 1730000000000,
      "size": 81234,
      "filename": "palmprint-step-1-closed-fist-smile.png",
      "persisted": true
    }
  ],
  "storage": { "backend": "filesystem", "path": "...", "count": 12 }
}
```

### `GET /api/palmprint/captures/:id`

Streams the raw blob with the original mime type. Use directly as `<img src="...">` or `<video src="...">`. Not currently auth-gated — add auth in production.

## Filenames

Generated client-side in the format `palmprint-step-{N}-{prompt-slug}.{png|webm|mp4}` and preserved server-side, so a forensic queue can batch-process them by name alone.

## Viewer

The `/captures` route is a built-in browser for the bucket. It groups uploads by session nonce, shows thumbnails (img / video controls), file size, persistence status, time, and a download button per record. The storage backend (memory vs filesystem with path) is shown in the header. Auto-refreshes every 4 seconds.

## Privacy and retention

Captures are sensitive — they're literally a video of the user. Apply the same controls you use for other PII:

- Retention policy (delete after N days unless flagged).
- Access logging.
- Encryption at rest (S3 does this automatically; filesystem does not).
- User-facing disclosure that captures are kept.

The React provider only uploads captures when `captureMode` is set on the verification options — opt-in, never on by default.
