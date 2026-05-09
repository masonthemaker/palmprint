"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PiTreePalmDuotone } from "react-icons/pi";
import {
  CaptchaCheckbox,
  DEFAULT_CAPTCHA_CONFIG,
  DEFAULT_WIDGET_CONFIG,
  VerifyWidget,
  type CaptchaCheckboxConfig,
  type CaptchaTheme,
  type CaptureMode,
  type Mode,
  type SecurityLevel,
  type WidgetConfig,
  type WidgetShape,
  type WidgetSize,
  type WidgetTheme,
} from "@palmprint/react";

type WidgetKind = "button" | "checkbox";

type ScriptPosition =
  | "bottom-right"
  | "bottom-left"
  | "top-right"
  | "top-left"
  | "inline";

function generateCaptchaReactSnippet(c: CaptchaCheckboxConfig): string {
  return `import { CaptchaCheckbox } from "@palmprint/react";
// Requires <PalmprintProvider> somewhere up the tree (already in layout.tsx).

<CaptchaCheckbox
  config={{
    label: ${JSON.stringify(c.label)},
    verifyingLabel: ${JSON.stringify(c.verifyingLabel)},
    verifiedLabel: ${JSON.stringify(c.verifiedLabel)},
    failedLabel: ${JSON.stringify(c.failedLabel)},
    theme: ${JSON.stringify(c.theme)},
    fullWidth: ${c.fullWidth},
    level: ${JSON.stringify(c.level)},
    mode: ${JSON.stringify(c.mode)},
    numTests: ${c.numTests},
    captureMode: ${JSON.stringify(c.captureMode)},
  }}
  onVerified={({ sessionToken, captures }) => {
    // Send sessionToken to protected endpoints as Authorization: Bearer <token>.
    console.log(sessionToken, captures);
  }}
/>`;
}

function generateReactSnippet(c: WidgetConfig, apiBase: string): string {
  return `import { VerifyWidget } from "@palmprint/react";

<VerifyWidget
  apiBase=${JSON.stringify(apiBase)}
  config={{
    label: ${JSON.stringify(c.label)},
    verifiedLabel: ${JSON.stringify(c.verifiedLabel)},
    shape: ${JSON.stringify(c.shape)},
    size: ${JSON.stringify(c.size)},
    theme: ${JSON.stringify(c.theme)},
    showIcon: ${c.showIcon},
    fullWidth: ${c.fullWidth},
    level: ${JSON.stringify(c.level)},
    mode: ${JSON.stringify(c.mode)},
    numTests: ${c.numTests},
    captureMode: ${JSON.stringify(c.captureMode)},
  }}
  onVerified={({ sessionToken, captures }) => {
    // Send sessionToken to protected endpoints as Authorization: Bearer <token>.
    console.log(sessionToken, captures);
  }}
/>`;
}

function generateScriptSnippet(
  c: WidgetConfig,
  position: ScriptPosition,
  target: string,
  cdnUrl: string,
  apiBase: string,
): string {
  const attrs: [string, string | number | boolean][] = [
    ["src", cdnUrl],
  ];
  if (position === "inline") {
    attrs.push(["data-target", target || "#palmprint-slot"]);
  } else {
    attrs.push(["data-position", position]);
  }
  attrs.push(
    ["data-label", c.label],
    ["data-verified-label", c.verifiedLabel],
    ["data-shape", c.shape],
    ["data-size", c.size],
    ["data-theme", c.theme],
    ["data-icon", c.showIcon],
    ["data-full-width", c.fullWidth],
    ["data-level", c.level],
    ["data-mode", c.mode],
    ["data-num-tests", c.numTests],
    ["data-capture-mode", c.captureMode],
    ["data-api-base", apiBase],
  );
  const lines = attrs.map(([k, v]) => `  ${k}="${String(v)}"`);
  const inlineMount =
    position === "inline"
      ? `<!-- Mount point — must exist before the script runs. -->\n<span id="${(target || "#palmprint-slot").replace(/^#/, "")}"></span>\n\n`
      : "";
  return `${inlineMount}<script
${lines.join("\n")}
  defer
></script>

<script>
  window.addEventListener("palmprint:verified", (e) => {
    const { sessionToken, captures } = e.detail;
    // Send sessionToken to protected endpoints as Authorization: Bearer <token>.
    console.log(sessionToken, captures);
  });
</script>`;
}

function generateCaptchaScriptSnippet(
  c: CaptchaCheckboxConfig,
  position: ScriptPosition,
  target: string,
  cdnUrl: string,
  apiBase: string,
): string {
  const attrs: [string, string | number | boolean | undefined][] = [
    ["src", cdnUrl],
  ];
  if (position === "inline") {
    attrs.push(["data-target", target || "#palmprint-slot"]);
  } else {
    attrs.push(["data-position", position]);
  }
  attrs.push(
    ["data-widget", "checkbox"],
    ["data-label", c.label],
    ["data-verifying-label", c.verifyingLabel],
    ["data-verified-label", c.verifiedLabel],
    ["data-failed-label", c.failedLabel],
    ["data-theme", c.theme],
    ["data-full-width", c.fullWidth],
    ["data-level", c.level],
    ["data-mode", c.mode],
    ["data-num-tests", c.numTests],
    ["data-capture-mode", c.captureMode],
    ["data-api-base", apiBase],
  );
  const lines = attrs
    .filter((a): a is [string, string | number | boolean] => a[1] !== undefined)
    .map(([k, v]) => `  ${k}="${String(v)}"`);
  const inlineMount =
    position === "inline"
      ? `<!-- Mount point — must exist before the script runs. -->\n<span id="${(target || "#palmprint-slot").replace(/^#/, "")}"></span>\n\n`
      : "";
  return `${inlineMount}<script
${lines.join("\n")}
  defer
></script>

<script>
  window.addEventListener("palmprint:verified", (e) => {
    const { sessionToken, captures } = e.detail;
    // Send sessionToken to protected endpoints as Authorization: Bearer <token>.
    console.log(sessionToken, captures);
  });
</script>`;
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-foreground/70">
        {label}
      </span>
      {children}
      {hint && <span className="text-xs text-foreground/55">{hint}</span>}
    </div>
  );
}

function Pills<T extends string>({
  options,
  value,
  onChange,
  labels,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  labels?: Partial<Record<T, string>>;
}) {
  return (
    <div
      className={`grid gap-2`}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`px-3 py-2 rounded-lg text-sm font-medium border transition ${
            value === o
              ? "bg-emerald-500 text-black border-emerald-500"
              : "bg-transparent border-foreground/15 hover:bg-foreground/5 text-foreground"
          }`}
        >
          {labels?.[o] ?? o}
        </button>
      ))}
    </div>
  );
}

type SnippetTab = "react" | "script";

export default function WidgetConfiguratorPage() {
  const [kind, setKind] = useState<WidgetKind>("button");
  const [config, setConfig] = useState<WidgetConfig>(DEFAULT_WIDGET_CONFIG);
  const [captchaConfig, setCaptchaConfig] = useState<CaptchaCheckboxConfig>(
    DEFAULT_CAPTCHA_CONFIG,
  );
  const [openSignal, setOpenSignal] = useState(0);
  const [copied, setCopied] = useState(false);
  const [lastResult, setLastResult] = useState<{
    token: string;
    capturesCount: number;
  } | null>(null);

  const [snippetTab, setSnippetTab] = useState<SnippetTab>("react");
  const [position, setPosition] = useState<ScriptPosition>("bottom-right");
  const [target, setTarget] = useState("#palmprint-slot");
  const [cdnUrl, setCdnUrl] = useState(
    "https://your-cdn.example/palmprint-widget.js",
  );
  const [apiBase, setApiBase] = useState("/api/palmprint");

  const snippet = useMemo(() => {
    if (kind === "checkbox") {
      return snippetTab === "react"
        ? generateCaptchaReactSnippet(captchaConfig)
        : generateCaptchaScriptSnippet(
            captchaConfig,
            position,
            target,
            cdnUrl,
            apiBase,
          );
    }
    return snippetTab === "react"
      ? generateReactSnippet(config, apiBase)
      : generateScriptSnippet(config, position, target, cdnUrl, apiBase);
  }, [kind, captchaConfig, config, snippetTab, position, target, cdnUrl, apiBase]);

  const update = <K extends keyof WidgetConfig>(
    key: K,
    value: WidgetConfig[K],
  ) => setConfig((c) => ({ ...c, [key]: value }));

  const updateCaptcha = <K extends keyof CaptchaCheckboxConfig>(
    key: K,
    value: CaptchaCheckboxConfig[K],
  ) => setCaptchaConfig((c) => ({ ...c, [key]: value }));

  // Challenge settings (level, mode, numTests, captureMode) update both
  // configs so toggling widget kind doesn't lose settings.
  const setSharedLevel = (v: SecurityLevel) => {
    update("level", v);
    updateCaptcha("level", v);
  };
  const setSharedMode = (v: Mode) => {
    update("mode", v);
    updateCaptcha("mode", v);
  };
  const setSharedNumTests = (v: number) => {
    update("numTests", v);
    updateCaptcha("numTests", v);
  };
  const setSharedCaptureMode = (v: CaptureMode) => {
    update("captureMode", v);
    updateCaptcha("captureMode", v);
  };

  const handleKindChange = (k: WidgetKind) => {
    setKind(k);
  };

  const copySnippet = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const previewBg =
    kind === "checkbox"
      ? captchaConfig.theme === "dark"
        ? "bg-zinc-900"
        : "bg-zinc-50"
      : config.theme === "light"
      ? "bg-zinc-50"
      : config.theme === "dark"
        ? "bg-zinc-900"
        : "bg-gradient-to-br from-emerald-50 via-zinc-50 to-zinc-100 dark:from-zinc-950 dark:via-black dark:to-zinc-950";

  return (
    <div className="w-full max-w-6xl mx-auto px-5 py-8 flex flex-col gap-8">
      <header className="flex items-center justify-between gap-3">
        <Link
          href="/"
          className="flex items-center gap-3 text-emerald-700 dark:text-emerald-400 hover:opacity-80"
        >
          <PiTreePalmDuotone className="text-4xl" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Palmprint Widget Builder
            </h1>
            <p className="text-sm opacity-70">
              Configure a verify widget, then copy the snippet.
            </p>
          </div>
        </Link>
        <Link
          href="/"
          className="text-sm text-foreground/70 hover:text-foreground"
        >
          ← Back to demo
        </Link>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_22rem] gap-6">
        {/* Preview */}
        <div className="flex flex-col gap-4">
          <div
            className={`relative ${previewBg} rounded-2xl border border-foreground/10 min-h-72 flex items-center justify-center p-8`}
          >
            {kind === "button" ? (
              <>
                <div className={config.fullWidth ? "w-full" : ""}>
                  <VerifyWidget
                    config={config}
                    apiBase="/api/palmprint"
                    openSignal={openSignal}
                    onVerified={(r) =>
                      setLastResult({
                        token: r.sessionToken || r.clientToken,
                        capturesCount: r.captures.length,
                      })
                    }
                  />
                </div>
                <button
                  onClick={() => setOpenSignal((n) => n + 1)}
                  className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-medium bg-foreground/5 hover:bg-foreground/10 border border-foreground/15 text-foreground"
                >
                  Open challenge
                </button>
              </>
            ) : (
              <div className={captchaConfig.fullWidth ? "w-full" : ""}>
                <CaptchaCheckbox
                  config={captchaConfig}
                  onVerified={(r) =>
                    setLastResult({
                      token: r.sessionToken || r.clientToken,
                      capturesCount: r.captures.length,
                    })
                  }
                />
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.03]">
            <div className="px-2 py-2 flex items-center justify-between border-b border-foreground/10 gap-2">
              <div className="flex gap-1">
                {(["react", "script"] as SnippetTab[]).map((t) => {
                  return (
                    <button
                      key={t}
                      onClick={() => setSnippetTab(t)}
                      className={`text-xs px-3 py-1.5 rounded-full font-medium transition ${
                        snippetTab === t
                          ? "bg-foreground text-background"
                          : "bg-transparent text-foreground/70 hover:bg-foreground/5"
                      }`}
                    >
                      {t === "react" ? "React / JSX" : "Script tag"}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={copySnippet}
                className="text-xs px-2.5 py-1 rounded-full bg-emerald-500 text-black hover:bg-emerald-400 font-medium"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>

            {snippetTab === "script" && (
              <div className="px-4 py-3 border-b border-foreground/10 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="flex flex-col gap-1 text-xs">
                  <span className="font-semibold uppercase tracking-wider text-foreground/70">
                    Mount
                  </span>
                  <select
                    value={position}
                    onChange={(e) =>
                      setPosition(e.target.value as ScriptPosition)
                    }
                    className="px-2 py-1.5 rounded-md bg-background border border-foreground/15 text-sm text-foreground"
                  >
                    <option value="bottom-right">Floating · bottom-right</option>
                    <option value="bottom-left">Floating · bottom-left</option>
                    <option value="top-right">Floating · top-right</option>
                    <option value="top-left">Floating · top-left</option>
                    <option value="inline">Inline (CSS selector)</option>
                  </select>
                </label>
                {position === "inline" && (
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-semibold uppercase tracking-wider text-foreground/70">
                      Target
                    </span>
                    <input
                      value={target}
                      onChange={(e) => setTarget(e.target.value)}
                      placeholder="#palmprint-slot"
                      className="px-2 py-1.5 rounded-md bg-background border border-foreground/15 text-sm font-mono text-foreground"
                    />
                  </label>
                )}
                <label
                  className={`flex flex-col gap-1 text-xs ${position === "inline" ? "" : "sm:col-span-2"}`}
                >
                  <span className="font-semibold uppercase tracking-wider text-foreground/70">
                    Bundle URL
                  </span>
                  <input
                    value={cdnUrl}
                    onChange={(e) => setCdnUrl(e.target.value)}
                    className="px-2 py-1.5 rounded-md bg-background border border-foreground/15 text-sm font-mono text-foreground"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs sm:col-span-3">
                  <span className="font-semibold uppercase tracking-wider text-foreground/70">
                    Server URL
                  </span>
                  <input
                    value={apiBase}
                    onChange={(e) => setApiBase(e.target.value)}
                    placeholder="https://your-app.example/api/palmprint"
                    className="px-2 py-1.5 rounded-md bg-background border border-foreground/15 text-sm font-mono text-foreground"
                  />
                  <span className="text-[11px] text-foreground/55">
                    Must expose /challenge, /redeem, and /captures. Use a full
                    URL when the widget runs on another domain.
                  </span>
                </label>
              </div>
            )}

            <pre className="text-xs font-mono p-4 overflow-x-auto whitespace-pre text-foreground/85">
              {snippet}
            </pre>
          </div>

          {lastResult && (
            <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 flex flex-col gap-1 text-sm">
              <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                Last verification
              </span>
              <span className="font-mono text-xs break-all text-foreground/80">
                {lastResult.token}
              </span>
              <span className="text-xs text-foreground/60">
                {lastResult.capturesCount} capture
                {lastResult.capturesCount === 1 ? "" : "s"}
              </span>
            </div>
          )}
        </div>

        {/* Config panel */}
        <aside className="flex flex-col gap-5 rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-5 h-fit lg:sticky lg:top-4">
          <Field label="Widget type">
            <Pills<WidgetKind>
              options={["button", "checkbox"] as const}
              value={kind}
              onChange={handleKindChange}
              labels={{ button: "Button", checkbox: "CAPTCHA checkbox" }}
            />
          </Field>

          <hr className="border-foreground/10" />

          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground/70">
            Appearance
          </h2>

          {kind === "button" ? (
            <>
              <Field label="Label">
                <input
                  value={config.label}
                  onChange={(e) => update("label", e.target.value)}
                  className="px-3 py-2 rounded-lg bg-background border border-foreground/15 text-sm text-foreground"
                />
              </Field>

              <Field label="Verified label">
                <input
                  value={config.verifiedLabel}
                  onChange={(e) => update("verifiedLabel", e.target.value)}
                  className="px-3 py-2 rounded-lg bg-background border border-foreground/15 text-sm text-foreground"
                />
              </Field>

              <Field label="Shape">
                <Pills<WidgetShape>
                  options={["pill", "rounded", "square"] as const}
                  value={config.shape}
                  onChange={(v) => update("shape", v)}
                  labels={{
                    pill: "Pill",
                    rounded: "Rounded",
                    square: "Square",
                  }}
                />
              </Field>

              <Field label="Size">
                <Pills<WidgetSize>
                  options={["sm", "md", "lg"] as const}
                  value={config.size}
                  onChange={(v) => update("size", v)}
                  labels={{ sm: "Small", md: "Medium", lg: "Large" }}
                />
              </Field>

              <Field label="Theme">
                <Pills<WidgetTheme>
                  options={["emerald", "dark", "light"] as const}
                  value={config.theme}
                  onChange={(v) => update("theme", v)}
                  labels={{
                    emerald: "Emerald",
                    dark: "Dark",
                    light: "Light",
                  }}
                />
              </Field>

              <div className="flex flex-col gap-2">
                <label className="flex items-center justify-between text-sm text-foreground">
                  <span>Show palm icon</span>
                  <input
                    type="checkbox"
                    checked={config.showIcon}
                    onChange={(e) => update("showIcon", e.target.checked)}
                    className="accent-emerald-500 size-4"
                  />
                </label>
                <label className="flex items-center justify-between text-sm text-foreground">
                  <span>Full width</span>
                  <input
                    type="checkbox"
                    checked={config.fullWidth}
                    onChange={(e) => update("fullWidth", e.target.checked)}
                    className="accent-emerald-500 size-4"
                  />
                </label>
              </div>
            </>
          ) : (
            <>
              <Field label="Idle label">
                <input
                  value={captchaConfig.label}
                  onChange={(e) => updateCaptcha("label", e.target.value)}
                  className="px-3 py-2 rounded-lg bg-background border border-foreground/15 text-sm text-foreground"
                />
              </Field>

              <Field label="Verifying label">
                <input
                  value={captchaConfig.verifyingLabel}
                  onChange={(e) =>
                    updateCaptcha("verifyingLabel", e.target.value)
                  }
                  className="px-3 py-2 rounded-lg bg-background border border-foreground/15 text-sm text-foreground"
                />
              </Field>

              <Field label="Verified label">
                <input
                  value={captchaConfig.verifiedLabel}
                  onChange={(e) =>
                    updateCaptcha("verifiedLabel", e.target.value)
                  }
                  className="px-3 py-2 rounded-lg bg-background border border-foreground/15 text-sm text-foreground"
                />
              </Field>

              <Field label="Failed label">
                <input
                  value={captchaConfig.failedLabel}
                  onChange={(e) =>
                    updateCaptcha("failedLabel", e.target.value)
                  }
                  className="px-3 py-2 rounded-lg bg-background border border-foreground/15 text-sm text-foreground"
                />
              </Field>

              <Field label="Theme">
                <Pills<CaptchaTheme>
                  options={["light", "dark"] as const}
                  value={captchaConfig.theme ?? "light"}
                  onChange={(v) => updateCaptcha("theme", v)}
                  labels={{ light: "Light", dark: "Dark" }}
                />
              </Field>

              <label className="flex items-center justify-between text-sm text-foreground">
                <span>Full width</span>
                <input
                  type="checkbox"
                  checked={!!captchaConfig.fullWidth}
                  onChange={(e) =>
                    updateCaptcha("fullWidth", e.target.checked)
                  }
                  className="accent-emerald-500 size-4"
                />
              </label>
            </>
          )}

          <hr className="border-foreground/10" />

          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground/70">
            Challenge
          </h2>

          <Field label="Security level">
            <Pills<SecurityLevel>
              options={["low", "medium", "high"] as const}
              value={config.level}
              onChange={setSharedLevel}
              labels={{ low: "Low", medium: "Medium", high: "High" }}
            />
          </Field>

          <Field label="Detection mode">
            <Pills<Mode>
              options={["hand", "face", "both"] as const}
              value={config.mode}
              onChange={setSharedMode}
              labels={{ hand: "Hand", face: "Face", both: "Both" }}
            />
          </Field>

          <Field
            label={`Number of tests (${config.numTests})`}
            hint="1–5 challenges in sequence."
          >
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={config.numTests}
              onChange={(e) => setSharedNumTests(Number(e.target.value))}
              className="accent-emerald-500"
            />
          </Field>

          <Field
            label="Capture on success"
            hint="Photo = raw PNG; Video = WebM clip per step."
          >
            <Pills<CaptureMode>
              options={["off", "photo", "video"] as const}
              value={config.captureMode}
              onChange={setSharedCaptureMode}
              labels={{ off: "Off", photo: "Photo", video: "Video" }}
            />
          </Field>
        </aside>
      </div>
    </div>
  );
}
