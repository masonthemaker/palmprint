// Captures bucket. Stores blobs uploaded after a successful verification.
//
// Storage backend:
//   - In-memory `Map` by default.
//   - If PALMPRINT_CAPTURE_DIR is set, blobs are written to disk under that
//     path (records still live in memory). Suitable for local dev forensics.
//
// Production deployments should swap this for an S3/R2/GCS adapter — the
// `CaptureStore` interface is the contract.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

export type CaptureType = "photo" | "video";

export type CaptureRecord = {
  id: string;
  /** The challenge_nonce of the session that produced this capture. */
  sessionNonce: string;
  type: CaptureType;
  mimeType: string;
  prompt: string;
  stepIndex: number;
  ts: number;
  size: number;
  filename: string;
  /** True if the bytes were persisted to disk. */
  persisted: boolean;
};

export type CaptureInput = {
  sessionNonce: string;
  type: CaptureType;
  mimeType: string;
  prompt: string;
  stepIndex: number;
  ts: number;
  blob: Buffer;
  filename: string;
};

export type CaptureStore = {
  put(input: CaptureInput): Promise<CaptureRecord>;
  get(id: string): Promise<{ blob: Buffer; record: CaptureRecord } | null>;
  list(opts?: { sessionNonce?: string }): Promise<CaptureRecord[]>;
  remove(id: string): Promise<boolean>;
};

declare global {
  var __palmprintCaptureRecords: Map<string, CaptureRecord> | undefined;
  var __palmprintCaptureBlobs: Map<string, Buffer> | undefined;
}

const records: Map<string, CaptureRecord> =
  globalThis.__palmprintCaptureRecords ??
  (globalThis.__palmprintCaptureRecords = new Map());
const blobs: Map<string, Buffer> =
  globalThis.__palmprintCaptureBlobs ??
  (globalThis.__palmprintCaptureBlobs = new Map());

const PERSIST_DIR =
  process.env.PALMPRINT_CAPTURE_DIR ??
  (process.env.NODE_ENV === "development"
    ? join(tmpdir(), "palmprint-captures")
    : undefined);

if (PERSIST_DIR && !existsSync(PERSIST_DIR)) {
  try {
    mkdirSync(PERSIST_DIR, { recursive: true });
  } catch {
    // ignore — fall back to in-memory only.
  }
}

function diskPath(id: string, filename: string): string {
  if (!PERSIST_DIR) throw new Error("PERSIST_DIR not set");
  // Sanitize filename — keep only alnum, dot, underscore, dash.
  const safe = filename.replaceAll(/[^a-zA-Z0-9._-]/g, "_");
  return join(PERSIST_DIR, `${id}-${safe}`);
}

export const captureStore: CaptureStore = {
  async put(input) {
    const id = randomBytes(8).toString("hex");
    let persisted = false;
    if (PERSIST_DIR && existsSync(PERSIST_DIR)) {
      try {
        writeFileSync(diskPath(id, input.filename), input.blob);
        persisted = true;
      } catch (e) {
        console.warn("[palmprint] capture persist failed", e);
      }
    }
    if (!persisted) {
      blobs.set(id, input.blob);
    }
    const record: CaptureRecord = {
      id,
      sessionNonce: input.sessionNonce,
      type: input.type,
      mimeType: input.mimeType,
      prompt: input.prompt,
      stepIndex: input.stepIndex,
      ts: input.ts,
      size: input.blob.length,
      filename: input.filename,
      persisted,
    };
    records.set(id, record);
    return record;
  },

  async get(id) {
    const record = records.get(id);
    if (!record) return null;
    if (record.persisted && PERSIST_DIR) {
      const path = diskPath(record.id, record.filename);
      if (!existsSync(path)) return null;
      return { blob: readFileSync(path), record };
    }
    const blob = blobs.get(id);
    if (!blob) return null;
    return { blob, record };
  },

  async list(opts = {}) {
    const all = Array.from(records.values()).sort((a, b) => b.ts - a.ts);
    if (opts.sessionNonce) {
      return all.filter((r) => r.sessionNonce === opts.sessionNonce);
    }
    return all;
  },

  async remove(id) {
    if (!records.has(id)) return false;
    records.delete(id);
    blobs.delete(id);
    return true;
  },
};

export function captureStorageInfo() {
  return {
    backend: PERSIST_DIR ? "filesystem" : "memory",
    path: PERSIST_DIR,
    count: records.size,
  };
}
