import React from "react";
import { createRoot } from "react-dom/client";
import VerifyWidget, {
  DEFAULT_WIDGET_CONFIG,
  type WidgetConfig,
  type WidgetShape,
  type WidgetSize,
  type WidgetTheme,
} from "../packages/react/src/VerifyWidget";
import CaptchaCheckbox, {
  DEFAULT_CAPTCHA_CONFIG,
  type CaptchaCheckboxConfig,
  type CaptchaTheme,
} from "../packages/react/src/CaptchaCheckbox";
import { PalmprintProvider } from "../packages/react/src/PalmprintProvider";
import type {
  CaptureMode,
  ChallengeStyle,
  Mode,
  SecurityLevel,
} from "../packages/react/src/Palmprint";
import widgetCss from "./.cache/widget.css";

type Position =
  | "bottom-right"
  | "bottom-left"
  | "top-right"
  | "top-left"
  | "inline";

type WidgetMountOptions = Partial<WidgetConfig> & {
  widget?: WidgetKind;
  captchaConfig?: Partial<CaptchaCheckboxConfig>;
  apiBase?: string | false;
  uploadCaptures?: boolean;
};

type WidgetKind = "button" | "checkbox";

const BundlePalmprintProvider = PalmprintProvider as React.ComponentType<{
  apiBase: string | false;
  uploadCaptures: boolean;
  children?: React.ReactNode;
}>;

const POSITION_STYLES: Record<
  Exclude<Position, "inline">,
  Partial<CSSStyleDeclaration>
> = {
  "bottom-right": {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    zIndex: "2147483646",
  },
  "bottom-left": {
    position: "fixed",
    bottom: "20px",
    left: "20px",
    zIndex: "2147483646",
  },
  "top-right": {
    position: "fixed",
    top: "20px",
    right: "20px",
    zIndex: "2147483646",
  },
  "top-left": {
    position: "fixed",
    top: "20px",
    left: "20px",
    zIndex: "2147483646",
  },
};

function parseConfig(script: HTMLScriptElement | null): {
  widget: WidgetKind;
  config: WidgetConfig;
  captchaConfig: CaptchaCheckboxConfig;
  apiBase: string | false;
  uploadCaptures: boolean;
  position: Position;
  target: string | null;
} {
  let widget: WidgetKind = "button";
  const config: WidgetConfig = { ...DEFAULT_WIDGET_CONFIG };
  const captchaConfig: CaptchaCheckboxConfig = { ...DEFAULT_CAPTCHA_CONFIG };
  let apiBase: string | false = "/api/palmprint";
  let uploadCaptures = true;
  let position: Position = "bottom-right";
  let target: string | null = null;

  if (!script)
    return { widget, config, captchaConfig, apiBase, uploadCaptures, position, target };
  const ds = script.dataset;
  if (ds.widget === "checkbox") widget = "checkbox";
  if (ds.label) config.label = ds.label;
  if (ds.verifiedLabel) config.verifiedLabel = ds.verifiedLabel;
  if (ds.shape) config.shape = ds.shape as WidgetShape;
  if (ds.size) config.size = ds.size as WidgetSize;
  if (ds.theme) config.theme = ds.theme as WidgetTheme;
  if (ds.icon != null) config.showIcon = ds.icon !== "false";
  if (ds.fullWidth != null) config.fullWidth = ds.fullWidth === "true";
  if (ds.level) config.level = ds.level as SecurityLevel;
  if (ds.mode) config.mode = ds.mode as Mode;
  if (ds.numTests) config.numTests = Number(ds.numTests);
  if (ds.captureMode) config.captureMode = ds.captureMode as CaptureMode;
  if (ds.challengeStyle) config.challengeStyle = ds.challengeStyle as ChallengeStyle;
  if (ds.label) captchaConfig.label = ds.label;
  if (ds.verifyingLabel) captchaConfig.verifyingLabel = ds.verifyingLabel;
  if (ds.verifiedLabel) captchaConfig.verifiedLabel = ds.verifiedLabel;
  if (ds.failedLabel) captchaConfig.failedLabel = ds.failedLabel;
  if (ds.captchaTheme) captchaConfig.theme = ds.captchaTheme as CaptchaTheme;
  if (ds.theme && widget === "checkbox") captchaConfig.theme = ds.theme as CaptchaTheme;
  if (ds.fullWidth != null) captchaConfig.fullWidth = ds.fullWidth === "true";
  if (ds.level) captchaConfig.level = ds.level as SecurityLevel;
  if (ds.mode) captchaConfig.mode = ds.mode as Mode;
  if (ds.numTests) captchaConfig.numTests = Number(ds.numTests);
  if (ds.captureMode) captchaConfig.captureMode = ds.captureMode as CaptureMode;
  if (ds.challengeStyle)
    captchaConfig.challengeStyle = ds.challengeStyle as ChallengeStyle;
  if (ds.position) position = ds.position as Position;
  if (ds.target) target = ds.target;
  if (ds.apiBase) apiBase = ds.apiBase === "false" ? false : ds.apiBase;
  if (ds.uploadCaptures != null) uploadCaptures = ds.uploadCaptures !== "false";
  if (target) position = "inline";
  return { widget, config, captchaConfig, apiBase, uploadCaptures, position, target };
}

function splitMountOptions(options?: WidgetMountOptions): {
  widget: WidgetKind;
  config: WidgetConfig;
  captchaConfig: CaptchaCheckboxConfig;
  apiBase: string | false;
  uploadCaptures: boolean;
} {
  const {
    widget = "button",
    captchaConfig,
    apiBase = "/api/palmprint",
    uploadCaptures = true,
    ...config
  } = options ?? {};
  return {
    widget,
    config: { ...DEFAULT_WIDGET_CONFIG, ...config },
    captchaConfig: { ...DEFAULT_CAPTCHA_CONFIG, ...captchaConfig },
    apiBase,
    uploadCaptures,
  };
}

function mountInto(
  host: HTMLElement,
  widget: WidgetKind,
  config: WidgetConfig,
  captchaConfig: CaptchaCheckboxConfig,
  apiBase: string | false,
  uploadCaptures: boolean,
) {
  const shadow = host.attachShadow
    ? host.attachShadow({ mode: "open" })
    : (host as unknown as ShadowRoot);
  if (shadow !== (host as unknown as ShadowRoot)) {
    const style = document.createElement("style");
    style.textContent = widgetCss as unknown as string;
    shadow.appendChild(style);
  }
  const reactRoot = document.createElement("div");
  shadow.appendChild(reactRoot);
  const dispatchVerified = (detail: unknown) => {
    const event = new CustomEvent("palmprint:verified", {
      detail,
      bubbles: true,
      composed: true,
    });
    host.dispatchEvent(event);
    window.dispatchEvent(event);
  };
  const root =
    widget === "checkbox"
      ? React.createElement(
          BundlePalmprintProvider,
          { apiBase, uploadCaptures },
          React.createElement(CaptchaCheckbox, {
            config: captchaConfig,
            onVerified: dispatchVerified,
          }),
        )
      : React.createElement(VerifyWidget, {
          config,
          apiBase,
          uploadCaptures,
          onVerified: dispatchVerified,
        });
  createRoot(reactRoot).render(root);
  return host;
}

function createFloatingHost(position: Exclude<Position, "inline">): HTMLElement {
  const host = document.createElement("div");
  host.setAttribute("data-palmprint-host", position);
  Object.assign(host.style, POSITION_STYLES[position]);
  document.body.appendChild(host);
  return host;
}

function autoMount(script: HTMLScriptElement | null) {
  const { widget, config, captchaConfig, apiBase, uploadCaptures, position, target } =
    parseConfig(script);
  if (target) {
    const el = document.querySelector(target);
    if (el instanceof HTMLElement)
      mountInto(el, widget, config, captchaConfig, apiBase, uploadCaptures);
    else
      console.warn(`[palmprint] target selector "${target}" matched no element`);
    return;
  }
  if (position === "inline") return;
  mountInto(
    createFloatingHost(position),
    widget,
    config,
    captchaConfig,
    apiBase,
    uploadCaptures,
  );
}

declare global {
  interface Window {
    Palmprint?: {
      mount: (host: HTMLElement, options?: WidgetMountOptions) => HTMLElement;
      defaultConfig: WidgetConfig;
      version: string;
    };
  }
}

// Capture currentScript synchronously — it's null after the initial parse.
const SCRIPT = document.currentScript as HTMLScriptElement | null;

window.Palmprint = {
  mount: (host: HTMLElement, options?: WidgetMountOptions) => {
    const { widget, config, captchaConfig, apiBase, uploadCaptures } =
      splitMountOptions(options);
    return mountInto(host, widget, config, captchaConfig, apiBase, uploadCaptures);
  },
  defaultConfig: DEFAULT_WIDGET_CONFIG,
  version: "0.1.0",
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => autoMount(SCRIPT));
} else {
  autoMount(SCRIPT);
}
