"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePalmprint } from "@palmprint/react";
import type { SecurityLevel } from "@palmprint/react";

// reCAPTCHA v2 image-challenge median from Google's own UX research (2014)
// and widely corroborated industry benchmarks: ~9.8 s average.
const CAPTCHA_BASELINE_MS = 9800;

type RunResult = {
  id: number;
  durationMs: number;
  level: SecurityLevel;
  status: "pass" | "cancel" | "error";
};

type Level = SecurityLevel | "random";

const LEVELS: { value: Level; label: string }[] = [
  { value: "low", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "Hard" },
  { value: "extra", label: "Extra" },
  { value: "random", label: "Random" },
];

function pickLevel(l: Level): SecurityLevel {
  if (l !== "random") return l;
  const opts: SecurityLevel[] = ["low", "medium", "high", "extra"];
  return opts[Math.floor(Math.random() * opts.length)];
}

function fmt(ms: number) {
  return (ms / 1000).toFixed(2) + "s";
}

function avg(runs: RunResult[]) {
  const passed = runs.filter((r) => r.status === "pass");
  if (!passed.length) return null;
  return passed.reduce((s, r) => s + r.durationMs, 0) / passed.length;
}

function SpeedBar({
  palmMs,
  baselineMs,
}: {
  palmMs: number;
  baselineMs: number;
}) {
  const ratio = Math.min(palmMs / baselineMs, 1);
  const pct = Math.round(ratio * 100);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs text-foreground/60">
        <span>Palmprint avg</span>
        <span>reCAPTCHA baseline ({fmt(baselineMs)})</span>
      </div>
      <div className="relative h-3 w-full rounded-full bg-foreground/10 overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-emerald-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
        <div className="absolute right-0 top-0 h-full w-px bg-foreground/30" />
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
          {fmt(palmMs)}
        </span>
        <span className="text-foreground/50">{fmt(baselineMs)}</span>
      </div>
    </div>
  );
}

export default function TestPage() {
  const { verify } = usePalmprint();

  const [runs, setRuns] = useState<RunResult[]>([]);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [selectedLevel, setSelectedLevel] = useState<Level>("medium");

  const counterRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef<number>(0);
  const runIdRef = useRef(0);

  const stopCounter = useCallback(() => {
    if (counterRef.current !== null) {
      clearInterval(counterRef.current);
      counterRef.current = null;
    }
  }, []);

  useEffect(() => () => stopCounter(), [stopCounter]);

  const handleRun = useCallback(async () => {
    if (running) return;
    const level = pickLevel(selectedLevel);
    setRunning(true);
    setElapsed(0);

    startRef.current = performance.now();
    counterRef.current = setInterval(() => {
      setElapsed(Math.round(performance.now() - startRef.current));
    }, 100);

    const id = ++runIdRef.current;
    let result: RunResult;

    try {
      await verify({ level, reason: "Speed test", description: `Level: ${level}` });
      const durationMs = Math.round(performance.now() - startRef.current);
      result = { id, durationMs, level, status: "pass" };
    } catch (e: unknown) {
      const durationMs = Math.round(performance.now() - startRef.current);
      const cancelled =
        e instanceof Error && e.message.toLowerCase().includes("cancel");
      result = { id, durationMs, level, status: cancelled ? "cancel" : "error" };
    }

    stopCounter();
    setElapsed(result.durationMs);
    setRuns((prev) => [result, ...prev]);
    setRunning(false);
  }, [running, selectedLevel, verify, stopCounter]);

  const handleReset = useCallback(() => {
    stopCounter();
    setRuns([]);
    setElapsed(0);
    setRunning(false);
    runIdRef.current = 0;
  }, [stopCounter]);

  const passedRuns = runs.filter((r) => r.status === "pass");
  const average = avg(runs);
  const fastest = passedRuns.length
    ? Math.min(...passedRuns.map((r) => r.durationMs))
    : null;
  const speedupX =
    average !== null ? (CAPTCHA_BASELINE_MS / average).toFixed(1) : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-zinc-50 to-zinc-100 dark:from-zinc-950 dark:via-black dark:to-black font-sans px-4 py-10">
      <div className="max-w-2xl mx-auto flex flex-col gap-8">

        {/* Header */}
        <div className="flex flex-col gap-2">
          <Link
            href="/"
            className="text-xs text-foreground/50 hover:text-foreground w-fit"
          >
            ← Back
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Speed Benchmark
          </h1>
          <p className="text-foreground/65 text-sm leading-relaxed max-w-lg">
            Complete a few Palmprint verifications and see how your average
            compares to the{" "}
            <span className="font-medium text-foreground">9.8 s</span> median
            for a reCAPTCHA&nbsp;v2 image challenge.
          </p>
        </div>

        {/* Run control */}
        <div className="rounded-2xl border border-foreground/10 bg-white/60 dark:bg-white/5 p-5 flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-full border border-foreground/10 p-1">
              {LEVELS.map((l) => (
                <button
                  key={l.value}
                  onClick={() => setSelectedLevel(l.value)}
                  disabled={running}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                    selectedLevel === l.value
                      ? "bg-foreground text-background"
                      : "text-foreground/60 hover:text-foreground hover:bg-foreground/5"
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRun}
              disabled={running}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm transition"
            >
              {running ? (
                <>
                  <span className="inline-block w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Verifying…
                </>
              ) : (
                "▶ Run test"
              )}
            </button>

            {running && (
              <div className="text-2xl font-mono font-bold tabular-nums text-foreground">
                {(elapsed / 1000).toFixed(1)}s
              </div>
            )}

            {runs.length > 0 && !running && (
              <button
                onClick={handleReset}
                className="ml-auto text-xs text-foreground/50 hover:text-foreground px-3 py-1.5 rounded-full border border-foreground/10 hover:bg-foreground/5"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        {passedRuns.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-foreground/10 bg-white/60 dark:bg-white/5 p-4 flex flex-col gap-1">
              <div className="text-xs text-foreground/55 uppercase tracking-wider">
                Your average
              </div>
              <div className="text-2xl font-bold tabular-nums text-foreground">
                {fmt(average!)}
              </div>
            </div>

            <div className="rounded-2xl border border-foreground/10 bg-white/60 dark:bg-white/5 p-4 flex flex-col gap-1">
              <div className="text-xs text-foreground/55 uppercase tracking-wider">
                Fastest run
              </div>
              <div className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {fmt(fastest!)}
              </div>
            </div>

            <div className="rounded-2xl border border-foreground/10 bg-white/60 dark:bg-white/5 p-4 flex flex-col gap-1">
              <div className="text-xs text-foreground/55 uppercase tracking-wider">
                vs reCAPTCHA
              </div>
              <div className="text-2xl font-bold tabular-nums text-foreground">
                {speedupX}×
                <span className="text-sm font-normal text-foreground/60 ml-1">
                  faster
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-foreground/10 bg-white/60 dark:bg-white/5 p-4 flex flex-col gap-1">
              <div className="text-xs text-foreground/55 uppercase tracking-wider">
                Runs
              </div>
              <div className="text-2xl font-bold tabular-nums text-foreground">
                {passedRuns.length}
                {runs.length !== passedRuns.length && (
                  <span className="text-sm font-normal text-foreground/40 ml-1">
                    / {runs.length}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Speed bar */}
        {average !== null && (
          <div className="rounded-2xl border border-foreground/10 bg-white/60 dark:bg-white/5 p-5">
            <SpeedBar palmMs={average} baselineMs={CAPTCHA_BASELINE_MS} />
          </div>
        )}

        {/* Run log */}
        {runs.length > 0 && (
          <div className="rounded-2xl border border-foreground/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-foreground/10 bg-foreground/[0.03]">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-foreground/50 uppercase tracking-wider">
                    Run
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-foreground/50 uppercase tracking-wider">
                    Level
                  </th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-foreground/50 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-foreground/50 uppercase tracking-wider">
                    vs baseline
                  </th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-foreground/50 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run, i) => {
                  const ratio =
                    run.status === "pass"
                      ? ((CAPTCHA_BASELINE_MS - run.durationMs) /
                          CAPTCHA_BASELINE_MS) *
                        100
                      : null;
                  const isFirst = i === 0;
                  return (
                    <tr
                      key={run.id}
                      className={`border-b border-foreground/[0.06] last:border-0 ${isFirst ? "bg-emerald-500/[0.04]" : ""}`}
                    >
                      <td className="px-4 py-3 text-foreground/60 tabular-nums">
                        #{runs.length - i}
                      </td>
                      <td className="px-4 py-3">
                        <span className="capitalize text-foreground/80">
                          {run.level}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-medium tabular-nums text-foreground">
                        {run.status === "pass" ? fmt(run.durationMs) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {ratio !== null ? (
                          <span
                            className={
                              ratio > 0
                                ? "text-emerald-600 dark:text-emerald-400 font-medium"
                                : "text-red-500 font-medium"
                            }
                          >
                            {ratio > 0 ? "-" : "+"}
                            {Math.abs(ratio).toFixed(0)}%
                          </span>
                        ) : (
                          <span className="text-foreground/30">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {run.status === "pass" && (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                            ✓ Passed
                          </span>
                        )}
                        {run.status === "cancel" && (
                          <span className="text-xs text-foreground/40">
                            Cancelled
                          </span>
                        )}
                        {run.status === "error" && (
                          <span className="text-xs text-red-500">Error</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Empty state */}
        {runs.length === 0 && !running && (
          <div className="text-center py-12 text-foreground/40 text-sm">
            Hit <strong className="text-foreground/60">Run test</strong> to
            start timing.
          </div>
        )}

        {/* Methodology note */}
        <p className="text-xs text-foreground/40 text-center leading-relaxed max-w-md mx-auto">
          Timer starts the moment the modal opens and stops when verification
          completes. The 9.8 s reCAPTCHA baseline is the median completion time
          for a v2 image challenge reported in Google&apos;s 2014 accessibility
          research and widely cited since.
        </p>
      </div>
    </div>
  );
}
