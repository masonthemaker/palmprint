"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FaceLandmarker,
  type FaceLandmarkerResult,
  FilesetResolver,
  GestureRecognizer,
  type GestureRecognizerResult,
} from "@mediapipe/tasks-vision";
import type { CaptureMode, Mode, SecurityLevel } from "@palmprint/core";
import { PiTreePalmDuotone } from "react-icons/pi";
export type { CaptureMode, Mode, SecurityLevel } from "@palmprint/core";

// ---------- Hand gestures ----------

type HandGestureName =
  | "Closed_Fist"
  | "Open_Palm"
  | "Pointing_Up"
  | "Thumb_Down"
  | "Thumb_Up"
  | "Victory"
  | "ILoveYou";

const HAND_POOL: HandGestureName[] = [
  "Closed_Fist",
  "Open_Palm",
  "Pointing_Up",
  "Thumb_Down",
  "Thumb_Up",
  "Victory",
  "ILoveYou",
];

const HAND_LABEL: Record<HandGestureName, string> = {
  Closed_Fist: "Closed Fist",
  Open_Palm: "Open Palm",
  Pointing_Up: "Pointing Up",
  Thumb_Down: "Thumbs Down",
  Thumb_Up: "Thumbs Up",
  Victory: "Victory",
  ILoveYou: "I Love You",
};

const HAND_EMOJI: Record<HandGestureName, string> = {
  Closed_Fist: "✊",
  Open_Palm: "🖐️",
  Pointing_Up: "☝️",
  Thumb_Down: "👎",
  Thumb_Up: "👍",
  Victory: "✌️",
  ILoveYou: "🤟",
};

// ---------- Face gestures ----------

type FaceGestureName =
  | "Smile"
  | "MouthOpen"
  | "WinkLeft"
  | "WinkRight"
  | "BrowsUp";

const FACE_POOL: FaceGestureName[] = [
  "Smile",
  "MouthOpen",
  "WinkLeft",
  "WinkRight",
  "BrowsUp",
];

const FACE_LABEL: Record<FaceGestureName, string> = {
  Smile: "Smile",
  MouthOpen: "Open Mouth",
  WinkLeft: "Wink Left Eye",
  WinkRight: "Wink Right Eye",
  BrowsUp: "Raise Brows",
};

const FACE_EMOJI: Record<FaceGestureName, string> = {
  Smile: "😀",
  MouthOpen: "😮",
  WinkLeft: "😉",
  WinkRight: "😉",
  BrowsUp: "🤨",
};

export type Capture = {
  id: string;
  stepIndex: number;
  prompt: string;
  type: "photo" | "video";
  mimeType: string;
  blob: Blob;
  url: string;
  ts: number;
};

export type ChallengeStyle =
  | "standard"
  | "handedness"
  | "two-hand"
  | "temporal"
  | "max";

type HandSide = "Left" | "Right";

type StepItem =
  | { kind: "hand"; name: HandGestureName; side?: HandSide }
  | { kind: "face"; name: FaceGestureName };
type StepPhase = StepItem[];
type Step = { phases: StepPhase[] };

const HAND_SIDE_LABEL: Record<HandSide, string> = {
  Left: "Left hand",
  Right: "Right hand",
};

const SECURITY: Record<
  SecurityLevel,
  {
    itemsPerStep: number;
    rotateMs: number;
    defaultTests: number;
    label: string;
    defaultStyle: ChallengeStyle;
  }
> = {
  low: {
    itemsPerStep: 1,
    rotateMs: 8000,
    defaultTests: 2,
    label: "Easy",
    defaultStyle: "standard",
  },
  medium: {
    itemsPerStep: 2,
    rotateMs: 5000,
    defaultTests: 2,
    label: "Medium",
    defaultStyle: "handedness",
  },
  high: {
    itemsPerStep: 2,
    rotateMs: 3500,
    defaultTests: 3,
    label: "Hard",
    defaultStyle: "temporal",
  },
  extra: {
    itemsPerStep: 3,
    rotateMs: 2500,
    defaultTests: 4,
    label: "Extra Hard",
    defaultStyle: "max",
  },
};

const HOLD_MS = 800;
const HAND_MIN_SCORE = 0.6;

// ---------- Step generation ----------

function pickN<T>(pool: readonly T[], n: number, distinct: boolean): T[] {
  if (!distinct || n >= pool.length) {
    const out: T[] = [];
    for (let i = 0; i < n; i++) {
      out.push(pool[Math.floor(Math.random() * pool.length)]);
    }
    return out;
  }
  const remaining = [...pool];
  const out: T[] = [];
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(Math.random() * remaining.length);
    out.push(remaining[idx]);
    remaining.splice(idx, 1);
  }
  return out;
}

function isFaceComboValid(items: FaceGestureName[]): boolean {
  // Wink-left + Wink-right is physiologically a blink, not two winks.
  return !(items.includes("WinkLeft") && items.includes("WinkRight"));
}

function randomHandSide(): HandSide {
  return Math.random() < 0.5 ? "Left" : "Right";
}

function usesHandedness(style: ChallengeStyle): boolean {
  return style === "handedness" || style === "max";
}

function usesTemporal(style: ChallengeStyle): boolean {
  return style === "temporal" || style === "max";
}

function handItems(
  names: HandGestureName[],
  style: ChallengeStyle,
): Extract<StepItem, { kind: "hand" }>[] {
  if (!usesHandedness(style)) {
    return names.map((name) => ({ kind: "hand" as const, name }));
  }
  const first = randomHandSide();
  const second: HandSide = first === "Left" ? "Right" : "Left";
  return names.map((name, index) => ({
    kind: "hand" as const,
    name,
    side: index % 2 === 0 ? first : second,
  }));
}

function faceItems(count: number): Extract<StepItem, { kind: "face" }>[] {
  let attempt: FaceGestureName[] = [];
  for (let i = 0; i < 8; i++) {
    attempt = pickN(FACE_POOL, count, true);
    if (isFaceComboValid(attempt)) break;
  }
  return attempt.map((name) => ({ kind: "face" as const, name }));
}

function getItemsPerStep(
  level: SecurityLevel,
  mode: Mode,
  style: ChallengeStyle,
): number {
  const base = SECURITY[level].itemsPerStep;
  if (mode === "face") return base;
  if (style === "two-hand" || style === "max") {
    return mode === "both" ? 3 : 2;
  }
  if (style === "temporal") return 1;
  return base;
}

function phaseKey(phase: StepPhase): string {
  return phase
    .map((item) =>
      item.kind === "hand"
        ? `hand:${item.side ?? "any"}:${item.name}`
        : `face:${item.name}`,
    )
    .join("|");
}

function generateSinglePhase(
  mode: Mode,
  items: number,
  style: ChallengeStyle,
): StepPhase {
  if ((style === "two-hand" || style === "max") && mode !== "face") {
    const hands = handItems(pickN(HAND_POOL, 2, true), style);
    if (mode === "both") return [...hands, ...faceItems(1)];
    return hands;
  }

  if (mode === "hand") {
    return handItems(pickN(HAND_POOL, items, true), style);
  }
  if (mode === "face") {
    return faceItems(items);
  }
  // both: pair hand + face (or single of each kind, weighted)
  if (items === 1) {
    const kind: "hand" | "face" = Math.random() < 0.5 ? "hand" : "face";
    if (kind === "hand")
      return handItems(pickN(HAND_POOL, 1, false), style);
    return [{ kind: "face", name: pickN(FACE_POOL, 1, false)[0] }];
  }
  // 2+ items in "both" mode: 1 hand + (items-1) face, or vice-versa.
  const out: StepItem[] = [];
  out.push(...handItems(pickN(HAND_POOL, 1, false), style));
  const faceCount = items - 1;
  out.push(...faceItems(faceCount));
  return out;
}

function generateStep(
  mode: Mode,
  items: number,
  style: ChallengeStyle,
): Step {
  if (!usesTemporal(style)) {
    return { phases: [generateSinglePhase(mode, items, style)] };
  }

  const phaseCount = style === "max" ? 3 : 2;
  const phases: StepPhase[] = [];
  for (let i = 0; i < phaseCount; i++) {
    let phase = generateSinglePhase(mode, items, style);
    for (let attempt = 0; attempt < 8; attempt++) {
      const previous = phases[phases.length - 1];
      if (!previous || phaseKey(previous) !== phaseKey(phase)) break;
      phase = generateSinglePhase(mode, items, style);
    }
    phases.push(phase);
  }
  return { phases };
}

function generateChallenges(
  count: number,
  mode: Mode,
  itemsPerStep: number,
  style: ChallengeStyle,
): Step[] {
  const out: Step[] = [];
  for (let i = 0; i < count; i++) {
    out.push(generateStep(mode, itemsPerStep, style));
  }
  return out;
}

function itemLabel(it: StepItem): string {
  if (it.kind === "face") return FACE_LABEL[it.name];
  return it.side
    ? `${HAND_SIDE_LABEL[it.side]}: ${HAND_LABEL[it.name]}`
    : HAND_LABEL[it.name];
}
function itemEmoji(it: StepItem): string {
  return it.kind === "hand" ? HAND_EMOJI[it.name] : FACE_EMOJI[it.name];
}

function phaseLabel(phase: StepPhase): string {
  return phase.map(itemLabel).join(" + ");
}

function stepLabel(step: Step): string {
  return step.phases.map(phaseLabel).join(" then ");
}

// ---------- Detection ----------

function blendshapeScore(
  result: FaceLandmarkerResult | null | undefined,
  name: string,
): number {
  const cats = result?.faceBlendshapes?.[0]?.categories;
  if (!cats) return 0;
  for (const c of cats) {
    if (c.categoryName === name) return c.score;
  }
  return 0;
}

function faceGestureMatches(
  target: FaceGestureName,
  result: FaceLandmarkerResult | null | undefined,
): boolean {
  if (!result?.faceBlendshapes?.[0]) return false;
  const s = (n: string) => blendshapeScore(result, n);
  switch (target) {
    case "Smile":
      return (s("mouthSmileLeft") + s("mouthSmileRight")) / 2 > 0.55;
    case "MouthOpen":
      return s("jawOpen") > 0.5;
    case "WinkLeft":
      return s("eyeBlinkLeft") > 0.55 && s("eyeBlinkRight") < 0.25;
    case "WinkRight":
      return s("eyeBlinkRight") > 0.55 && s("eyeBlinkLeft") < 0.25;
    case "BrowsUp":
      return s("browInnerUp") > 0.45;
  }
}

function phaseMatches(phase: StepPhase, hand: GestureRecognizerResult | null,
  face: FaceLandmarkerResult | null,
): boolean {
  // Track which detected hand has been used so two required hand gestures
  // must come from two different hands.
  const usedHandIdx = new Set<number>();
  for (const item of phase) {
    if (item.kind === "face") {
      if (!faceGestureMatches(item.name, face)) return false;
      continue;
    }
    const hands = hand?.gestures ?? [];
    let found = -1;
    for (let i = 0; i < hands.length; i++) {
      if (usedHandIdx.has(i)) continue;
      const top = hands[i]?.[0];
      const side = hand?.handedness?.[i]?.[0]?.categoryName;
      const sideMatches = !item.side || side === item.side;
      if (
        top &&
        top.categoryName === item.name &&
        top.score >= HAND_MIN_SCORE &&
        sideMatches
      ) {
        found = i;
        break;
      }
    }
    if (found === -1) return false;
    usedHandIdx.add(found);
  }
  return true;
}

// ---------- Drawing ----------

const HAND_CONNECTIONS: ReadonlyArray<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

type Landmark = { x: number; y: number; z: number };

function drawHand(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  landmarks: Landmark[],
  matched: boolean,
) {
  const lineColor = matched
    ? "rgba(52, 211, 153, 0.95)"
    : "rgba(255, 255, 255, 0.85)";
  const pointColor = matched ? "rgb(16, 185, 129)" : "rgb(244, 114, 182)";
  ctx.lineWidth = Math.max(2, w / 320);
  ctx.strokeStyle = lineColor;
  ctx.lineCap = "round";
  ctx.beginPath();
  for (const [a, b] of HAND_CONNECTIONS) {
    const pa = landmarks[a];
    const pb = landmarks[b];
    if (!pa || !pb) continue;
    ctx.moveTo(pa.x * w, pa.y * h);
    ctx.lineTo(pb.x * w, pb.y * h);
  }
  ctx.stroke();
  ctx.fillStyle = pointColor;
  const r = Math.max(3, w / 200);
  for (const p of landmarks) {
    ctx.beginPath();
    ctx.arc(p.x * w, p.y * h, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

type Connector = { start: number; end: number };

function drawFace(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  landmarks: Landmark[],
  matched: boolean,
) {
  ctx.lineWidth = 1;
  ctx.strokeStyle = matched
    ? "rgba(52, 211, 153, 0.35)"
    : "rgba(255, 255, 255, 0.18)";
  const tess = (
    FaceLandmarker as unknown as { FACE_LANDMARKS_TESSELATION?: Connector[] }
  ).FACE_LANDMARKS_TESSELATION;
  if (tess) {
    ctx.beginPath();
    for (const c of tess) {
      const a = landmarks[c.start];
      const b = landmarks[c.end];
      if (!a || !b) continue;
      ctx.moveTo(a.x * w, a.y * h);
      ctx.lineTo(b.x * w, b.y * h);
    }
    ctx.stroke();
  }
  const fl = FaceLandmarker as unknown as Record<string, Connector[] | undefined>;
  const sets = [
    fl.FACE_LANDMARKS_FACE_OVAL,
    fl.FACE_LANDMARKS_LIPS,
    fl.FACE_LANDMARKS_LEFT_EYE,
    fl.FACE_LANDMARKS_RIGHT_EYE,
    fl.FACE_LANDMARKS_LEFT_EYEBROW,
    fl.FACE_LANDMARKS_RIGHT_EYEBROW,
    fl.FACE_LANDMARKS_LEFT_IRIS,
    fl.FACE_LANDMARKS_RIGHT_IRIS,
  ];
  ctx.lineWidth = Math.max(1.5, w / 480);
  ctx.strokeStyle = matched
    ? "rgba(52, 211, 153, 0.95)"
    : "rgba(96, 165, 250, 0.95)";
  ctx.beginPath();
  for (const set of sets) {
    if (!set) continue;
    for (const c of set) {
      const a = landmarks[c.start];
      const b = landmarks[c.end];
      if (!a || !b) continue;
      ctx.moveTo(a.x * w, a.y * h);
      ctx.lineTo(b.x * w, b.y * h);
    }
  }
  ctx.stroke();
}

function drawOverlay(
  canvas: HTMLCanvasElement | null,
  video: HTMLVideoElement,
  hand: GestureRecognizerResult | null,
  face: FaceLandmarkerResult | null,
  matched: boolean,
) {
  if (!canvas) return;
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);

  const faceLm = face?.faceLandmarks?.[0];
  if (faceLm && faceLm.length > 0) drawFace(ctx, w, h, faceLm, matched);

  const handsLm = hand?.landmarks ?? [];
  for (const lm of handsLm) {
    if (lm && lm.length > 0) drawHand(ctx, w, h, lm, matched);
  }
}

// ---------- Token ----------

function base64Url(s: string): string {
  return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function generateToken(meta: {
  level: SecurityLevel;
  steps: number;
  itemsPerStep: number;
  challengeNonce?: string;
}): string {
  const nonce =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  const now = Math.floor(Date.now() / 1000);
  const payload: Record<string, unknown> = {
    v: 1,
    iss: "palmprint",
    iat: now,
    exp: now + 300,
    nonce,
    level: meta.level,
    steps: meta.steps,
    items_per_step: meta.itemsPerStep,
  };
  if (meta.challengeNonce) {
    payload.challenge_nonce = meta.challengeNonce;
  }
  return `palmprint.${base64Url(JSON.stringify(payload))}`;
}

// ---------- Capture helpers ----------

function pickRecorderMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4",
  ];
  for (const t of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(t)) return t;
    } catch {
      // ignore
    }
  }
  return "";
}

function snapshotPhoto(video: HTMLVideoElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (!video.videoWidth || !video.videoHeight) return resolve(null);
    const c = document.createElement("canvas");
    c.width = video.videoWidth;
    c.height = video.videoHeight;
    const ctx = c.getContext("2d");
    if (!ctx) return resolve(null);
    ctx.drawImage(video, 0, 0, c.width, c.height);
    c.toBlob((blob) => resolve(blob), "image/png");
  });
}

function newCapture(opts: {
  stepIndex: number;
  prompt: string;
  type: "photo" | "video";
  mimeType: string;
  blob: Blob;
}): Capture {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return {
    id,
    stepIndex: opts.stepIndex,
    prompt: opts.prompt,
    type: opts.type,
    mimeType: opts.mimeType,
    blob: opts.blob,
    url: URL.createObjectURL(opts.blob),
    ts: Date.now(),
  };
}

export function captureFileName(c: Capture): string {
  const ext = c.type === "photo" ? "png" : c.mimeType.includes("mp4") ? "mp4" : "webm";
  const slug = c.prompt.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `palmprint-step-${c.stepIndex + 1}-${slug || "step"}.${ext}`;
}

// ---------- Component ----------

type Status = "loading" | "ready" | "running" | "verified" | "error";

export type PalmprintProps = {
  initialLevel?: SecurityLevel;
  initialMode?: Mode;
  initialNumTests?: number;
  initialCaptureMode?: CaptureMode;
  initialChallengeStyle?: ChallengeStyle;
  /** Hides the settings gear button (settings still take effect from initial* props). */
  lockSettings?: boolean;
  /** Auto-start the verification once models load. */
  autoStart?: boolean;
  /** Compact header for embedding (modal/widget). */
  compact?: boolean;
  /** Show a close (×) button — only rendered when this is provided. */
  onCancel?: () => void;
  /** Fired once when verification succeeds. */
  onVerified?: (result: { token: string; captures: Capture[] }) => void;
  /**
   * Server-issued nonce from the challenge endpoint. When provided, it's
   * embedded in the client token so the server can bind the verification
   * to the original challenge.
   */
  challengeNonce?: string;
};

export default function Palmprint({
  initialLevel = "medium",
  initialMode = "both",
  initialNumTests,
  initialCaptureMode = "off",
  initialChallengeStyle,
  lockSettings = false,
  autoStart = false,
  compact = false,
  onCancel,
  onVerified,
  challengeNonce,
}: PalmprintProps = {}) {
  const startingChallengeStyle =
    initialChallengeStyle ?? SECURITY[initialLevel].defaultStyle;
  const initialMaxTests = startingChallengeStyle === "max" ? 7 : 5;
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handRef = useRef<GestureRecognizer | null>(null);
  const faceRef = useRef<FaceLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastVideoTimeRef = useRef<number>(-1);
  const holdStartRef = useRef<number | null>(null);
  const stepStartRef = useRef<number>(0);

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);

  const [level, setLevel] = useState<SecurityLevel>(initialLevel);
  const [numTests, setNumTests] = useState(
    Math.min(
      initialNumTests ?? SECURITY[initialLevel].defaultTests,
      initialMaxTests,
    ),
  );
  const [mode, setMode] = useState<Mode>(initialMode);
  const [captureMode, setCaptureMode] = useState<CaptureMode>(initialCaptureMode);
  const [challengeStyle, setChallengeStyle] =
    useState<ChallengeStyle>(startingChallengeStyle);
  const [showSettings, setShowSettings] = useState(false);

  const [captures, setCaptures] = useState<Capture[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderChunksRef = useRef<Blob[]>([]);
  const captureModeRef = useRef<CaptureMode>(captureMode);
  useEffect(() => {
    captureModeRef.current = captureMode;
  }, [captureMode]);

  const verifiedFiredRef = useRef(false);
  const onVerifiedRef = useRef(onVerified);
  useEffect(() => {
    onVerifiedRef.current = onVerified;
  }, [onVerified]);

  const itemsPerStep = getItemsPerStep(level, mode, challengeStyle);
  const rotateMs = SECURITY[level].rotateMs;
  const maxTests = challengeStyle === "max" ? 7 : 5;

  const [challenges, setChallenges] = useState<Step[]>(() =>
    generateChallenges(numTests, mode, itemsPerStep, challengeStyle),
  );
  const [stepIndex, setStepIndex] = useState(0);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [holdProgress, setHoldProgress] = useState(0);
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const stepIndexRef = useRef(stepIndex);
  useEffect(() => {
    stepIndexRef.current = stepIndex;
  }, [stepIndex]);
  const phaseIndexRef = useRef(phaseIndex);
  useEffect(() => {
    phaseIndexRef.current = phaseIndex;
  }, [phaseIndex]);
  const challengesRef = useRef(challenges);
  useEffect(() => {
    challengesRef.current = challenges;
  }, [challenges]);
  const modeRef = useRef(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  const itemsRef = useRef(itemsPerStep);
  useEffect(() => {
    itemsRef.current = itemsPerStep;
  }, [itemsPerStep]);
  const challengeStyleRef = useRef(challengeStyle);
  useEffect(() => {
    challengeStyleRef.current = challengeStyle;
  }, [challengeStyle]);
  const rotateMsRef = useRef(rotateMs);
  useEffect(() => {
    rotateMsRef.current = rotateMs;
  }, [rotateMs]);
  const challengeNonceRef = useRef<string | undefined>(challengeNonce);
  useEffect(() => {
    challengeNonceRef.current = challengeNonce;
  }, [challengeNonce]);

  const currentStep = challenges[stepIndex] ?? null;
  const currentPhase = currentStep?.phases[phaseIndex] ?? null;

  // Suppress harmless TF Lite "INFO:" lines logged via console.error.
  useEffect(() => {
    const original = console.error;
    console.error = (...args: unknown[]) => {
      const first = args[0];
      if (typeof first === "string" && first.startsWith("INFO:")) return;
      original.apply(console, args);
    };
    return () => {
      console.error = original;
    };
  }, []);

  // Load both models once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
        );
        const [hand, face] = await Promise.all([
          GestureRecognizer.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-tasks/gesture_recognizer/gesture_recognizer.task",
              delegate: "GPU",
            },
            runningMode: "VIDEO",
            numHands: 2,
          }),
          FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task",
              delegate: "GPU",
            },
            runningMode: "VIDEO",
            numFaces: 1,
            outputFaceBlendshapes: true,
          }),
        ]);
        if (cancelled) {
          hand.close();
          face.close();
          return;
        }
        handRef.current = hand;
        faceRef.current = face;
        setStatus("ready");
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "Failed to load models.");
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const startRecorder = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || typeof MediaRecorder === "undefined") return;
    try {
      const mt = pickRecorderMimeType();
      const recorder = mt
        ? new MediaRecorder(stream, { mimeType: mt })
        : new MediaRecorder(stream);
      recorderChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recorderChunksRef.current.push(e.data);
      };
      recorder.start();
      recorderRef.current = recorder;
    } catch (e) {
      console.warn("MediaRecorder failed to start", e);
    }
  }, []);

  // Stops the current recorder and resolves with the finalized blob.
  const finalizeRecorder = useCallback((): Promise<{
    blob: Blob;
    mimeType: string;
  } | null> => {
    return new Promise((resolve) => {
      const r = recorderRef.current;
      const chunks = recorderChunksRef.current;
      recorderRef.current = null;
      recorderChunksRef.current = [];
      if (!r || r.state === "inactive") {
        resolve(null);
        return;
      }
      r.onstop = () => {
        if (chunks.length === 0) return resolve(null);
        const mimeType = r.mimeType || "video/webm";
        resolve({ blob: new Blob(chunks, { type: mimeType }), mimeType });
      };
      try {
        r.stop();
      } catch {
        resolve(null);
      }
    });
  }, []);

  const discardRecorder = useCallback(() => {
    const r = recorderRef.current;
    recorderRef.current = null;
    recorderChunksRef.current = [];
    if (r && r.state !== "inactive") {
      try {
        r.ondataavailable = null;
        r.onstop = null;
        r.stop();
      } catch {
        // ignore
      }
    }
  }, []);

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const stream = streamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    const c = canvasRef.current;
    if (c) {
      const cx = c.getContext("2d");
      cx?.clearRect(0, 0, c.width, c.height);
    }
    discardRecorder();
    holdStartRef.current = null;
    setHoldProgress(0);
  }, [discardRecorder]);

  useEffect(() => {
    return () => {
      stop();
      handRef.current?.close();
      faceRef.current?.close();
      handRef.current = null;
      faceRef.current = null;
    };
  }, [stop]);

  // Revoke blob URLs whenever captures are replaced or unmounted.
  useEffect(() => {
    return () => {
      for (const c of captures) URL.revokeObjectURL(c.url);
    };
    // We only want to revoke on unmount or when the array reference changes
    // wholesale (start/reset both replace the array via revoke-then-set).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tickRef = useRef<() => void>(() => {});
  const tick = useCallback(() => {
    const video = videoRef.current;
    const hand = handRef.current;
    const face = faceRef.current;
    if (!video || !hand || !face) return;

    if (
      video.readyState >= 2 &&
      video.currentTime !== lastVideoTimeRef.current
    ) {
      lastVideoTimeRef.current = video.currentTime;

      const ts = performance.now();
      const step = challengesRef.current[stepIndexRef.current] ?? null;
      const phase = step?.phases[phaseIndexRef.current] ?? null;
      const needHand = phase ? phase.some((s) => s.kind === "hand") : false;
      const needFace = phase ? phase.some((s) => s.kind === "face") : true;

      let handResult: GestureRecognizerResult | null = null;
      let faceResult: FaceLandmarkerResult | null = null;
      try {
        if (needHand) handResult = hand.recognizeForVideo(video, ts);
      } catch (e) {
        console.error(e);
      }
      try {
        if (needFace) faceResult = face.detectForVideo(video, ts);
      } catch (e) {
        console.error(e);
      }

      const matched = phase
        ? phaseMatches(phase, handResult, faceResult)
        : false;
      drawOverlay(canvasRef.current, video, handResult, faceResult, matched);

      if (matched) {
        if (holdStartRef.current === null) holdStartRef.current = ts;
        const elapsed = ts - holdStartRef.current;
        setHoldProgress(Math.min(1, elapsed / HOLD_MS));
        if (elapsed >= HOLD_MS) {
          holdStartRef.current = null;
          setHoldProgress(0);
          stepStartRef.current = ts;

          const completedIdx = stepIndexRef.current;
          const completedStep = challengesRef.current[completedIdx];
          const nextPhase = phaseIndexRef.current + 1;
          if (completedStep && nextPhase < completedStep.phases.length) {
            setPhaseIndex(nextPhase);
          } else {
            const promptText = completedStep
              ? stepLabel(completedStep)
              : `step-${completedIdx + 1}`;
            const isLast = completedIdx + 1 >= challengesRef.current.length;
            const captureMode = captureModeRef.current;

            // Snapshot the current frame synchronously for "photo" mode so we
            // capture the exact pose, regardless of what happens next.
            if (captureMode === "photo" && video) {
              void snapshotPhoto(video).then((blob) => {
                if (!blob) return;
                setCaptures((prev) => [
                  ...prev,
                  newCapture({
                    stepIndex: completedIdx,
                    prompt: promptText,
                    type: "photo",
                    mimeType: "image/png",
                    blob,
                  }),
                ]);
              });
            }

            if (captureMode === "video") {
              void finalizeRecorder().then((res) => {
                if (!res) return;
                setCaptures((prev) => [
                  ...prev,
                  newCapture({
                    stepIndex: completedIdx,
                    prompt: promptText,
                    type: "video",
                    mimeType: res.mimeType,
                    blob: res.blob,
                  }),
                ]);
              });
            }

            setStepIndex((s) => {
              const next = s + 1;
              if (next >= challengesRef.current.length) {
                setStatus("verified");
                setToken(
                  generateToken({
                    level,
                    steps: challengesRef.current.length,
                    itemsPerStep: itemsRef.current,
                    challengeNonce: challengeNonceRef.current,
                  }),
                );
                // Tracks must stay alive long enough for the recorder onstop
                // callback to flush. Delay tearing down the camera.
                if (captureMode === "video") {
                  setTimeout(() => stop(), 250);
                } else {
                  stop();
                }
              }
              setPhaseIndex(0);
              return next;
            });

            if (!isLast && captureMode === "video") {
              startRecorder();
            }
          }
        }
      } else {
        holdStartRef.current = null;
        setHoldProgress(0);
        // Rotate the current step if it has been visible too long without
        // a successful match — defeats AI-video pre-generation attacks.
        if (ts - stepStartRef.current > rotateMsRef.current) {
          stepStartRef.current = ts;
          const idx = stepIndexRef.current;
          setChallenges((prev) => {
            const copy = [...prev];
            copy[idx] = generateStep(
              modeRef.current,
              itemsRef.current,
              challengeStyleRef.current,
            );
            return copy;
          });
          setPhaseIndex(0);
          // Discard the in-flight recording — the prompt has changed.
          if (captureModeRef.current === "video") {
            discardRecorder();
            startRecorder();
          }
        }
      }
    }

    rafRef.current = requestAnimationFrame(() => tickRef.current());
  }, [discardRecorder, finalizeRecorder, level, startRecorder, stop]);

  useEffect(() => {
    tickRef.current = tick;
  }, [tick]);

  const start = useCallback(async () => {
    setError(null);
    setToken(null);
    setCopied(false);
    verifiedFiredRef.current = false;
    // Free previous run's blobs.
    setCaptures((prev) => {
      for (const c of prev) URL.revokeObjectURL(c.url);
      return [];
    });
    if (!handRef.current || !faceRef.current) {
      setError("Models not ready yet.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      setChallenges(
        generateChallenges(numTests, mode, itemsPerStep, challengeStyle),
      );
      setStepIndex(0);
      setPhaseIndex(0);
      setStatus("running");
      lastVideoTimeRef.current = -1;
      holdStartRef.current = null;
      stepStartRef.current = performance.now();
      setShowSettings(false);
      if (captureModeRef.current === "video") startRecorder();
      rafRef.current = requestAnimationFrame(() => tickRef.current());
    } catch (e) {
      console.error(e);
      setError(
        e instanceof Error
          ? e.message
          : "Could not access the camera. Grant permission and try again.",
      );
      setStatus("error");
    }
  }, [challengeStyle, itemsPerStep, mode, numTests, startRecorder]);

  const reset = useCallback(() => {
    stop();
    setChallenges(
      generateChallenges(numTests, mode, itemsPerStep, challengeStyle),
    );
    setStepIndex(0);
    setPhaseIndex(0);
    setStatus(handRef.current && faceRef.current ? "ready" : "loading");
    setError(null);
    setToken(null);
    setCopied(false);
    setCaptures((prev) => {
      for (const c of prev) URL.revokeObjectURL(c.url);
      return [];
    });
    verifiedFiredRef.current = false;
  }, [challengeStyle, itemsPerStep, mode, numTests, stop]);

  // Auto-start once when models are ready, if requested.
  useEffect(() => {
    if (!autoStart || status !== "ready") return;
    const t = setTimeout(() => {
      void start();
    }, 0);
    return () => clearTimeout(t);
    // start identity changes when settings change; we only want to auto-fire
    // the *first* time we land on "ready" with autoStart on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, status]);

  // Fire onVerified once the verified state settles (gives video captures
  // a moment to flush in via setTimeout-delayed stop).
  useEffect(() => {
    if (status !== "verified" || !token || verifiedFiredRef.current) return;
    verifiedFiredRef.current = true;
    const timer = setTimeout(() => {
      onVerifiedRef.current?.({ token, captures });
    }, 300);
    return () => clearTimeout(timer);
  }, [status, token, captures]);

  const handleLevelChange = (next: SecurityLevel) => {
    setLevel(next);
    setChallengeStyle(SECURITY[next].defaultStyle);
    setNumTests((current) =>
      current < SECURITY[next].defaultTests
        ? SECURITY[next].defaultTests
        : SECURITY[next].defaultStyle !== "max" && current > 5
          ? 5
        : current,
    );
  };

  const handleChallengeStyleChange = (next: ChallengeStyle) => {
    setChallengeStyle(next);
    if (next !== "max") {
      setNumTests((current) => Math.min(current, 5));
    }
  };

  const copyToken = useCallback(async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Ignore — user can still select-copy from the textarea.
    }
  }, [token]);

  const settingsLocked = status === "running";

  return (
    <div
      className={`w-full ${compact ? "" : "max-w-2xl"} mx-auto flex flex-col items-center gap-${compact ? "4" : "6"}`}
    >
      <header className="w-full flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-emerald-700 dark:text-emerald-400">
          <PiTreePalmDuotone className={compact ? "text-3xl" : "text-5xl"} />
          <div>
            <h1
              className={`${compact ? "text-xl" : "text-3xl"} font-bold tracking-tight text-foreground`}
            >
              Palmprint
            </h1>
            {!compact && (
              <p className="text-sm opacity-80">
                Gesture & face human verification
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {!lockSettings && (
            <button
              onClick={() => setShowSettings((v) => !v)}
              disabled={settingsLocked}
              className="px-3 py-2 rounded-full bg-foreground/5 hover:bg-foreground/10 text-sm font-medium border border-foreground/10 disabled:opacity-40 disabled:cursor-not-allowed text-foreground"
              aria-label="Settings"
            >
              ⚙ Settings
            </button>
          )}
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-3 py-2 rounded-full bg-foreground/5 hover:bg-foreground/10 text-sm font-medium border border-foreground/10 text-foreground"
              aria-label="Close"
            >
              ✕
            </button>
          )}
        </div>
      </header>

      {showSettings && !settingsLocked && !lockSettings && (
        <div className="w-full rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-4 flex flex-col gap-4 text-foreground">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Security level</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(["low", "medium", "high", "extra"] as SecurityLevel[]).map((l) => (
                <button
                  key={l}
                  onClick={() => handleLevelChange(l)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition ${
                    level === l
                      ? "bg-emerald-500 text-black border-emerald-500"
                      : "bg-transparent border-foreground/15 hover:bg-foreground/5"
                  }`}
                >
                  {SECURITY[l].label}
                </button>
              ))}
            </div>
            <p className="text-xs text-foreground/60">
              {itemsPerStep === 1
                ? "1 item per step"
                : `${itemsPerStep} simultaneous items per step`}{" "}
              · prompts rotate every {(rotateMs / 1000).toFixed(1)}s if not
              matched
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium flex items-center justify-between">
              <span>Number of tests</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400">
                {numTests}
              </span>
            </label>
            <input
              type="range"
              min={1}
              max={maxTests}
              step={1}
              value={numTests}
              onChange={(e) => setNumTests(Number(e.target.value))}
              className="accent-emerald-500"
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Detection mode</span>
            <div className="grid grid-cols-3 gap-2">
              {(["hand", "face", "both"] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition ${
                    mode === m
                      ? "bg-emerald-500 text-black border-emerald-500"
                      : "bg-transparent border-foreground/15 hover:bg-foreground/5"
                  }`}
                >
                  {m === "hand"
                    ? "Hand only"
                    : m === "face"
                      ? "Face only"
                      : "Both"}
                </button>
              ))}
            </div>
            {mode === "hand" && itemsPerStep > 1 && (
              <p className="text-xs text-foreground/60">
                Two hand gestures = use both hands at once.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Challenge style</span>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {(
                [
                  "standard",
                  "handedness",
                  "two-hand",
                  "temporal",
                  "max",
                ] as ChallengeStyle[]
              ).map((s) => (
                <button
                  key={s}
                  onClick={() => handleChallengeStyleChange(s)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition ${
                    challengeStyle === s
                      ? "bg-emerald-500 text-black border-emerald-500"
                      : "bg-transparent border-foreground/15 hover:bg-foreground/5"
                  }`}
                >
                  {s === "standard"
                    ? "Standard"
                    : s === "handedness"
                      ? "Left/right"
                      : s === "two-hand"
                        ? "Two hand"
                        : s === "temporal"
                          ? "Then"
                          : "Max combos"}
                </button>
              ))}
            </div>
            <p className="text-xs text-foreground/60">
              {challengeStyle === "standard"
                ? "Uses the normal canned MediaPipe gesture pool, including I Love You when hand prompts are generated."
                : challengeStyle === "handedness"
                  ? "Adds left/right hand requirements to hand prompts."
                  : challengeStyle === "two-hand"
                    ? "Requires two simultaneous hand gestures; Both mode adds a face prompt too."
                    : challengeStyle === "temporal"
                      ? "Asks for ordered sequences like Thumbs Up then Thumbs Down."
                      : "Combines ordered sequences, left/right hands, two-hand prompts, Both mode face prompts, and up to 7 tests."}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Capture on success</span>
            <div className="grid grid-cols-3 gap-2">
              {(["off", "photo", "video"] as CaptureMode[]).map((c) => (
                <button
                  key={c}
                  onClick={() => setCaptureMode(c)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition ${
                    captureMode === c
                      ? "bg-emerald-500 text-black border-emerald-500"
                      : "bg-transparent border-foreground/15 hover:bg-foreground/5"
                  }`}
                >
                  {c === "off" ? "Off" : c === "photo" ? "Photo" : "Video clip"}
                </button>
              ))}
            </div>
            <p className="text-xs text-foreground/60">
              {captureMode === "off"
                ? "No frames are kept after verification."
                : captureMode === "photo"
                  ? "Saves a raw PNG of each successful pose — useful for offline AI/deepfake analysis."
                  : "Records a WebM clip per successful step. Discarded on prompt rotation."}
            </p>
          </div>
        </div>
      )}

      <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-black/80 ring-1 ring-white/10 shadow-2xl">
        <video
          ref={videoRef}
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover -scale-x-100"
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-cover -scale-x-100 pointer-events-none"
        />

        {status !== "running" && status !== "verified" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/90 gap-3 bg-black/50">
            <PiTreePalmDuotone className="text-7xl text-emerald-400" />
            {status === "loading" && <p>Loading hand & face models…</p>}
            {status === "ready" && (
              <>
                <button
                  onClick={start}
                  className="px-5 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-semibold transition"
                >
                  Start verification
                </button>
                <p className="text-xs text-white/60">
                  {SECURITY[level].label} · {numTests}{" "}
                  {numTests === 1 ? "test" : "tests"} ·{" "}
                  {mode === "hand"
                    ? "hand"
                    : mode === "face"
                      ? "face"
                      : "hand + face"}
                </p>
              </>
            )}
            {status === "error" && (
              <>
                <p className="text-rose-300 max-w-sm text-center px-4">
                  {error ?? "Something went wrong."}
                </p>
                <button
                  onClick={reset}
                  className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
                >
                  Try again
                </button>
              </>
            )}
          </div>
        )}

        {status === "verified" && (
          <div className="absolute inset-0 overflow-y-auto bg-emerald-500/95 text-black">
            <div className="min-h-full flex flex-col items-center justify-center gap-3 px-6 py-6">
              <PiTreePalmDuotone
                className={compact ? "text-6xl" : "text-5xl"}
              />
              <p
                className={`${compact ? "text-3xl" : "text-2xl"} font-bold`}
              >
                Verified
              </p>

              {/* Token + captures + "Run again" are hidden in compact mode —
                  the embedding flow consumes the token via onVerified, and
                  captures are a backend concern. */}
              {!compact && token && (
                <div className="w-full max-w-md flex flex-col gap-2">
                  <span className="text-xs uppercase tracking-wider opacity-70">
                    Session token (5 min)
                  </span>
                  <textarea
                    readOnly
                    value={token}
                    className="w-full h-16 text-xs font-mono p-2 rounded-md bg-black/80 text-emerald-300 resize-none"
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={copyToken}
                      className="flex-1 px-3 py-2 rounded-full bg-black/85 text-emerald-300 hover:bg-black text-sm"
                    >
                      {copied ? "Copied!" : "Copy token"}
                    </button>
                    <button
                      onClick={reset}
                      className="flex-1 px-3 py-2 rounded-full bg-black/85 text-white hover:bg-black text-sm"
                    >
                      Run again
                    </button>
                  </div>
                </div>
              )}

              {!compact && captures.length > 0 && (
                <div className="w-full max-w-md flex flex-col gap-2 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider opacity-70">
                      Captures ({captures.length})
                    </span>
                    <span className="text-[10px] opacity-60">
                      raw{" "}
                      {captures[0]?.type === "photo" ? "PNG" : "WebM"} blobs
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {captures.map((c) => (
                      <div
                        key={c.id}
                        className="flex flex-col gap-1 rounded-lg overflow-hidden bg-black/85"
                      >
                        {c.type === "photo" ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={c.url}
                            alt={c.prompt}
                            className="w-full aspect-[4/3] object-cover -scale-x-100"
                          />
                        ) : (
                          <video
                            src={c.url}
                            controls
                            playsInline
                            className="w-full aspect-[4/3] object-cover -scale-x-100"
                          />
                        )}
                        <div className="px-2 pb-2 pt-1 flex items-center justify-between gap-2 text-white">
                          <span className="text-[11px] truncate">
                            #{c.stepIndex + 1} · {c.prompt}
                          </span>
                          <a
                            href={c.url}
                            download={captureFileName(c)}
                            className="text-[11px] px-2 py-0.5 rounded bg-emerald-500 text-black font-medium hover:bg-emerald-400"
                          >
                            ↓
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {status === "running" && currentStep && currentPhase && (
          <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-3">
            <div className="px-3 py-2 rounded-xl bg-black/60 backdrop-blur text-white text-sm max-w-[70%]">
              <div className="opacity-70 text-xs">
                Step {stepIndex + 1} of {challenges.length} —{" "}
                {currentStep.phases.length > 1
                  ? `part ${phaseIndex + 1} of ${currentStep.phases.length}`
                  : currentPhase.length === 1
                    ? currentPhase[0].kind === "hand"
                    ? "show"
                    : "make"
                    : "do all at once"}
              </div>
              <div className="font-semibold flex flex-col gap-0.5">
                {currentPhase.map((it, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xl">{itemEmoji(it)}</span>
                    <span>{itemLabel(it)}</span>
                  </div>
                ))}
              </div>
              {currentStep.phases.length > 1 && (
                <div className="mt-1 text-[11px] text-white/60">
                  Full order: {stepLabel(currentStep)}
                </div>
              )}
            </div>
            <div className="flex gap-1.5 flex-wrap justify-end max-w-[28%]">
              {challenges.map((_, i) => (
                <div
                  key={i}
                  className={`h-2 w-8 rounded-full ${
                    stepIndex > i
                      ? "bg-emerald-400"
                      : stepIndex === i
                        ? "bg-white/70"
                        : "bg-white/20"
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        {status === "running" && (
          <div className="absolute bottom-3 left-3 right-3 flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-white/15 overflow-hidden">
              <div
                className="h-full bg-emerald-400 transition-[width] duration-75"
                style={{ width: `${Math.round(holdProgress * 100)}%` }}
              />
            </div>
            <div className="text-xs text-white/80 font-mono">
              {SECURITY[level].label}
            </div>
          </div>
        )}
      </div>

      <p className="text-sm text-foreground/70 text-center max-w-md">
        Hold each prompt steady for ~0.8s. Prompts rotate periodically to stop
        pre-recorded video attacks. All processing is local.
      </p>
    </div>
  );
}
