"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PiTreePalmDuotone } from "react-icons/pi";
import type { CaptureRecord } from "@/lib/captureStore";

type Storage = { backend: "memory" | "filesystem"; path?: string; count: number };

function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export default function CapturesViewerPage() {
  const [captures, setCaptures] = useState<CaptureRecord[]>([]);
  const [storage, setStorage] = useState<Storage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const res = await fetch("/api/palmprint/captures", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          captures: CaptureRecord[];
          storage: Storage;
        };
        if (!cancelled) {
          setCaptures(data.captures);
          setStorage(data.storage);
          setLoading(false);
        }
      } catch {
        // ignore
      }
    };
    void refresh();
    const t = setInterval(refresh, 4000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  // Group by sessionNonce.
  const groups = captures.reduce<Record<string, CaptureRecord[]>>((acc, c) => {
    (acc[c.sessionNonce] ??= []).push(c);
    return acc;
  }, {});

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col gap-6">
      <header className="flex items-center justify-between gap-3">
        <Link
          href="/"
          className="flex items-center gap-3 text-emerald-700 dark:text-emerald-400 hover:opacity-80"
        >
          <PiTreePalmDuotone className="text-4xl" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Captures bucket
            </h1>
            <p className="text-sm opacity-70">
              Photos and clips uploaded by the provider after a successful
              verification, grouped by challenge nonce.
            </p>
          </div>
        </Link>
        <Link
          href="/protected-action"
          className="text-sm text-foreground/70 hover:text-foreground"
        >
          Run signed flow →
        </Link>
      </header>

      {storage && (
        <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] px-4 py-3 text-xs text-foreground/70 flex items-center justify-between gap-3">
          <span>
            Storage backend:{" "}
            <span className="font-mono text-foreground">
              {storage.backend}
            </span>
            {storage.path && (
              <>
                {" "}— path{" "}
                <span className="font-mono text-foreground">
                  {storage.path}
                </span>
              </>
            )}
          </span>
          <span>{storage.count} total</span>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-foreground/55">Loading…</p>
      ) : captures.length === 0 ? (
        <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-8 text-center text-sm text-foreground/70">
          <p>No captures yet.</p>
          <p className="mt-1 text-xs text-foreground/50">
            Run a flow with{" "}
            <code className="font-mono">captureMode: &quot;photo&quot;</code> or{" "}
            <code className="font-mono">&quot;video&quot;</code> to populate
            this bucket.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {Object.entries(groups).map(([sessionNonce, items]) => (
            <section
              key={sessionNonce}
              className="rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-4 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs uppercase tracking-wider text-foreground/55">
                  Session nonce
                </span>
                <span className="font-mono text-xs text-foreground/85 truncate">
                  {sessionNonce}
                </span>
                <span className="text-[11px] text-foreground/55">
                  {items.length} item{items.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {items
                  .sort((a, b) => a.stepIndex - b.stepIndex)
                  .map((c) => (
                    <div
                      key={c.id}
                      className="flex flex-col gap-1 rounded-lg overflow-hidden bg-zinc-900 border border-foreground/5"
                    >
                      {c.type === "photo" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/api/palmprint/captures/${c.id}`}
                          alt={c.prompt}
                          className="w-full aspect-[4/3] object-cover -scale-x-100"
                        />
                      ) : (
                        <video
                          src={`/api/palmprint/captures/${c.id}`}
                          controls
                          playsInline
                          className="w-full aspect-[4/3] object-cover -scale-x-100"
                        />
                      )}
                      <div className="px-2 pb-2 pt-1 text-white flex items-center justify-between gap-2">
                        <div className="flex flex-col leading-tight overflow-hidden">
                          <span className="text-[11px] truncate">
                            #{c.stepIndex + 1} · {c.prompt || "—"}
                          </span>
                          <span className="text-[10px] text-zinc-400">
                            {fmtSize(c.size)} · {timeAgo(c.ts)}
                            {c.persisted && " · on-disk"}
                          </span>
                        </div>
                        <a
                          href={`/api/palmprint/captures/${c.id}`}
                          download={c.filename}
                          className="text-[11px] px-2 py-0.5 rounded bg-emerald-500 text-black font-medium hover:bg-emerald-400"
                        >
                          ↓
                        </a>
                      </div>
                    </div>
                  ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
