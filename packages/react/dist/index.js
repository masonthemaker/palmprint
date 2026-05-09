"use client";

// packages/react/src/Palmprint.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FaceLandmarker,
  FilesetResolver,
  GestureRecognizer
} from "@mediapipe/tasks-vision";
import { PiTreePalmDuotone } from "react-icons/pi";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
var HAND_POOL = [
  "Closed_Fist",
  "Open_Palm",
  "Pointing_Up",
  "Thumb_Down",
  "Thumb_Up",
  "Victory",
  "ILoveYou"
];
var HAND_LABEL = {
  Closed_Fist: "Closed Fist",
  Open_Palm: "Open Palm",
  Pointing_Up: "Pointing Up",
  Thumb_Down: "Thumbs Down",
  Thumb_Up: "Thumbs Up",
  Victory: "Victory",
  ILoveYou: "I Love You"
};
var HAND_EMOJI = {
  Closed_Fist: "\u270A",
  Open_Palm: "\u{1F590}\uFE0F",
  Pointing_Up: "\u261D\uFE0F",
  Thumb_Down: "\u{1F44E}",
  Thumb_Up: "\u{1F44D}",
  Victory: "\u270C\uFE0F",
  ILoveYou: "\u{1F91F}"
};
var FACE_POOL = [
  "Smile",
  "MouthOpen",
  "WinkLeft",
  "WinkRight",
  "BrowsUp"
];
var FACE_LABEL = {
  Smile: "Smile",
  MouthOpen: "Open Mouth",
  WinkLeft: "Wink Left Eye",
  WinkRight: "Wink Right Eye",
  BrowsUp: "Raise Brows"
};
var FACE_EMOJI = {
  Smile: "\u{1F600}",
  MouthOpen: "\u{1F62E}",
  WinkLeft: "\u{1F609}",
  WinkRight: "\u{1F609}",
  BrowsUp: "\u{1F928}"
};
var SECURITY = {
  low: { itemsPerStep: 1, rotateMs: 8e3, defaultTests: 2, label: "Low" },
  medium: {
    itemsPerStep: 2,
    rotateMs: 5e3,
    defaultTests: 2,
    label: "Medium"
  },
  high: { itemsPerStep: 2, rotateMs: 3500, defaultTests: 3, label: "High" }
};
var HOLD_MS = 800;
var HAND_MIN_SCORE = 0.6;
function pickN(pool, n, distinct) {
  if (!distinct || n >= pool.length) {
    const out2 = [];
    for (let i = 0; i < n; i++) {
      out2.push(pool[Math.floor(Math.random() * pool.length)]);
    }
    return out2;
  }
  const remaining = [...pool];
  const out = [];
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(Math.random() * remaining.length);
    out.push(remaining[idx]);
    remaining.splice(idx, 1);
  }
  return out;
}
function isFaceComboValid(items) {
  return !(items.includes("WinkLeft") && items.includes("WinkRight"));
}
function generateStep(mode, items) {
  if (mode === "hand") {
    return pickN(HAND_POOL, items, true).map((name) => ({
      kind: "hand",
      name
    }));
  }
  if (mode === "face") {
    let attempt = [];
    for (let i = 0; i < 8; i++) {
      attempt = pickN(FACE_POOL, items, true);
      if (isFaceComboValid(attempt)) break;
    }
    return attempt.map((name) => ({ kind: "face", name }));
  }
  if (items === 1) {
    const kind = Math.random() < 0.5 ? "hand" : "face";
    if (kind === "hand")
      return [{ kind, name: pickN(HAND_POOL, 1, false)[0] }];
    return [{ kind: "face", name: pickN(FACE_POOL, 1, false)[0] }];
  }
  const out = [];
  out.push({ kind: "hand", name: pickN(HAND_POOL, 1, false)[0] });
  const faceCount = items - 1;
  let faceItems = [];
  for (let i = 0; i < 8; i++) {
    faceItems = pickN(FACE_POOL, faceCount, true);
    if (isFaceComboValid(faceItems)) break;
  }
  for (const name of faceItems) out.push({ kind: "face", name });
  return out;
}
function generateChallenges(count, mode, itemsPerStep) {
  const out = [];
  for (let i = 0; i < count; i++) out.push(generateStep(mode, itemsPerStep));
  return out;
}
function itemLabel(it) {
  return it.kind === "hand" ? HAND_LABEL[it.name] : FACE_LABEL[it.name];
}
function itemEmoji(it) {
  return it.kind === "hand" ? HAND_EMOJI[it.name] : FACE_EMOJI[it.name];
}
function blendshapeScore(result, name) {
  const cats = result?.faceBlendshapes?.[0]?.categories;
  if (!cats) return 0;
  for (const c of cats) {
    if (c.categoryName === name) return c.score;
  }
  return 0;
}
function faceGestureMatches(target, result) {
  if (!result?.faceBlendshapes?.[0]) return false;
  const s = (n) => blendshapeScore(result, n);
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
function stepMatches(step, hand, face) {
  const usedHandIdx = /* @__PURE__ */ new Set();
  for (const item of step) {
    if (item.kind === "face") {
      if (!faceGestureMatches(item.name, face)) return false;
      continue;
    }
    const hands = hand?.gestures ?? [];
    let found = -1;
    for (let i = 0; i < hands.length; i++) {
      if (usedHandIdx.has(i)) continue;
      const top = hands[i]?.[0];
      if (top && top.categoryName === item.name && top.score >= HAND_MIN_SCORE) {
        found = i;
        break;
      }
    }
    if (found === -1) return false;
    usedHandIdx.add(found);
  }
  return true;
}
var HAND_CONNECTIONS = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [0, 17]
];
function drawHand(ctx, w, h, landmarks, matched) {
  const lineColor = matched ? "rgba(52, 211, 153, 0.95)" : "rgba(255, 255, 255, 0.85)";
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
function drawFace(ctx, w, h, landmarks, matched) {
  ctx.lineWidth = 1;
  ctx.strokeStyle = matched ? "rgba(52, 211, 153, 0.35)" : "rgba(255, 255, 255, 0.18)";
  const tess = FaceLandmarker.FACE_LANDMARKS_TESSELATION;
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
  const fl = FaceLandmarker;
  const sets = [
    fl.FACE_LANDMARKS_FACE_OVAL,
    fl.FACE_LANDMARKS_LIPS,
    fl.FACE_LANDMARKS_LEFT_EYE,
    fl.FACE_LANDMARKS_RIGHT_EYE,
    fl.FACE_LANDMARKS_LEFT_EYEBROW,
    fl.FACE_LANDMARKS_RIGHT_EYEBROW,
    fl.FACE_LANDMARKS_LEFT_IRIS,
    fl.FACE_LANDMARKS_RIGHT_IRIS
  ];
  ctx.lineWidth = Math.max(1.5, w / 480);
  ctx.strokeStyle = matched ? "rgba(52, 211, 153, 0.95)" : "rgba(96, 165, 250, 0.95)";
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
function drawOverlay(canvas, video, hand, face, matched) {
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
function base64Url(s) {
  return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
function generateToken(meta) {
  const nonce = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  const now = Math.floor(Date.now() / 1e3);
  const payload = {
    v: 1,
    iss: "palmprint",
    iat: now,
    exp: now + 300,
    nonce,
    level: meta.level,
    steps: meta.steps,
    items_per_step: meta.itemsPerStep
  };
  if (meta.challengeNonce) {
    payload.challenge_nonce = meta.challengeNonce;
  }
  return `palmprint.${base64Url(JSON.stringify(payload))}`;
}
function pickRecorderMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4"
  ];
  for (const t of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(t)) return t;
    } catch {
    }
  }
  return "";
}
function snapshotPhoto(video) {
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
function newCapture(opts) {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  return {
    id,
    stepIndex: opts.stepIndex,
    prompt: opts.prompt,
    type: opts.type,
    mimeType: opts.mimeType,
    blob: opts.blob,
    url: URL.createObjectURL(opts.blob),
    ts: Date.now()
  };
}
function captureFileName(c) {
  const ext = c.type === "photo" ? "png" : c.mimeType.includes("mp4") ? "mp4" : "webm";
  const slug = c.prompt.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `palmprint-step-${c.stepIndex + 1}-${slug || "step"}.${ext}`;
}
function Palmprint({
  initialLevel = "medium",
  initialMode = "both",
  initialNumTests,
  initialCaptureMode = "off",
  lockSettings = false,
  autoStart = false,
  compact = false,
  onCancel,
  onVerified,
  challengeNonce
} = {}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const handRef = useRef(null);
  const faceRef = useRef(null);
  const rafRef = useRef(null);
  const streamRef = useRef(null);
  const lastVideoTimeRef = useRef(-1);
  const holdStartRef = useRef(null);
  const stepStartRef = useRef(0);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);
  const [level, setLevel] = useState(initialLevel);
  const [numTests, setNumTests] = useState(
    initialNumTests ?? SECURITY[initialLevel].defaultTests
  );
  const [mode, setMode] = useState(initialMode);
  const [captureMode, setCaptureMode] = useState(initialCaptureMode);
  const [showSettings, setShowSettings] = useState(false);
  const [captures, setCaptures] = useState([]);
  const recorderRef = useRef(null);
  const recorderChunksRef = useRef([]);
  const captureModeRef = useRef(captureMode);
  useEffect(() => {
    captureModeRef.current = captureMode;
  }, [captureMode]);
  const verifiedFiredRef = useRef(false);
  const onVerifiedRef = useRef(onVerified);
  useEffect(() => {
    onVerifiedRef.current = onVerified;
  }, [onVerified]);
  const itemsPerStep = SECURITY[level].itemsPerStep;
  const rotateMs = SECURITY[level].rotateMs;
  const [challenges, setChallenges] = useState(
    () => generateChallenges(numTests, mode, itemsPerStep)
  );
  const [stepIndex, setStepIndex] = useState(0);
  const [holdProgress, setHoldProgress] = useState(0);
  const [token, setToken] = useState(null);
  const [copied, setCopied] = useState(false);
  const stepIndexRef = useRef(stepIndex);
  useEffect(() => {
    stepIndexRef.current = stepIndex;
  }, [stepIndex]);
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
  const rotateMsRef = useRef(rotateMs);
  useEffect(() => {
    rotateMsRef.current = rotateMs;
  }, [rotateMs]);
  const challengeNonceRef = useRef(challengeNonce);
  useEffect(() => {
    challengeNonceRef.current = challengeNonce;
  }, [challengeNonce]);
  const currentStep = challenges[stepIndex] ?? null;
  useEffect(() => {
    const original = console.error;
    console.error = (...args) => {
      const first = args[0];
      if (typeof first === "string" && first.startsWith("INFO:")) return;
      original.apply(console, args);
    };
    return () => {
      console.error = original;
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        const [hand, face] = await Promise.all([
          GestureRecognizer.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: "https://storage.googleapis.com/mediapipe-tasks/gesture_recognizer/gesture_recognizer.task",
              delegate: "GPU"
            },
            runningMode: "VIDEO",
            numHands: 2
          }),
          FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task",
              delegate: "GPU"
            },
            runningMode: "VIDEO",
            numFaces: 1,
            outputFaceBlendshapes: true
          })
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
      const recorder = mt ? new MediaRecorder(stream, { mimeType: mt }) : new MediaRecorder(stream);
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
  const finalizeRecorder = useCallback(() => {
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
  useEffect(() => {
    return () => {
      for (const c of captures) URL.revokeObjectURL(c.url);
    };
  }, []);
  const tickRef = useRef(() => {
  });
  const tick = useCallback(() => {
    const video = videoRef.current;
    const hand = handRef.current;
    const face = faceRef.current;
    if (!video || !hand || !face) return;
    if (video.readyState >= 2 && video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;
      const ts = performance.now();
      const step = challengesRef.current[stepIndexRef.current] ?? null;
      const needHand = step ? step.some((s) => s.kind === "hand") : false;
      const needFace = step ? step.some((s) => s.kind === "face") : true;
      let handResult = null;
      let faceResult = null;
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
      const matched = step ? stepMatches(step, handResult, faceResult) : false;
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
          const promptText = completedStep ? completedStep.map(itemLabel).join(" + ") : `step-${completedIdx + 1}`;
          const isLast = completedIdx + 1 >= challengesRef.current.length;
          const captureMode2 = captureModeRef.current;
          if (captureMode2 === "photo" && video) {
            void snapshotPhoto(video).then((blob) => {
              if (!blob) return;
              setCaptures((prev) => [
                ...prev,
                newCapture({
                  stepIndex: completedIdx,
                  prompt: promptText,
                  type: "photo",
                  mimeType: "image/png",
                  blob
                })
              ]);
            });
          }
          if (captureMode2 === "video") {
            void finalizeRecorder().then((res) => {
              if (!res) return;
              setCaptures((prev) => [
                ...prev,
                newCapture({
                  stepIndex: completedIdx,
                  prompt: promptText,
                  type: "video",
                  mimeType: res.mimeType,
                  blob: res.blob
                })
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
                  challengeNonce: challengeNonceRef.current
                })
              );
              if (captureMode2 === "video") {
                setTimeout(() => stop(), 250);
              } else {
                stop();
              }
            }
            return next;
          });
          if (!isLast && captureMode2 === "video") {
            startRecorder();
          }
        }
      } else {
        holdStartRef.current = null;
        setHoldProgress(0);
        if (ts - stepStartRef.current > rotateMsRef.current) {
          stepStartRef.current = ts;
          const idx = stepIndexRef.current;
          setChallenges((prev) => {
            const copy = [...prev];
            copy[idx] = generateStep(modeRef.current, itemsRef.current);
            return copy;
          });
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
        audio: false
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      setChallenges(generateChallenges(numTests, mode, itemsPerStep));
      setStepIndex(0);
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
        e instanceof Error ? e.message : "Could not access the camera. Grant permission and try again."
      );
      setStatus("error");
    }
  }, [itemsPerStep, mode, numTests, startRecorder]);
  const reset = useCallback(() => {
    stop();
    setChallenges(generateChallenges(numTests, mode, itemsPerStep));
    setStepIndex(0);
    setStatus(handRef.current && faceRef.current ? "ready" : "loading");
    setError(null);
    setToken(null);
    setCopied(false);
    setCaptures((prev) => {
      for (const c of prev) URL.revokeObjectURL(c.url);
      return [];
    });
    verifiedFiredRef.current = false;
  }, [itemsPerStep, mode, numTests, stop]);
  useEffect(() => {
    if (!autoStart || status !== "ready") return;
    const t = setTimeout(() => {
      void start();
    }, 0);
    return () => clearTimeout(t);
  }, [autoStart, status]);
  useEffect(() => {
    if (status !== "verified" || !token || verifiedFiredRef.current) return;
    verifiedFiredRef.current = true;
    const timer = setTimeout(() => {
      onVerifiedRef.current?.({ token, captures });
    }, 300);
    return () => clearTimeout(timer);
  }, [status, token, captures]);
  const handleLevelChange = (next) => {
    setLevel(next);
    setNumTests(
      (current) => current < SECURITY[next].defaultTests ? SECURITY[next].defaultTests : current
    );
  };
  const copyToken = useCallback(async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
    }
  }, [token]);
  const settingsLocked = status === "running";
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: `w-full ${compact ? "" : "max-w-2xl"} mx-auto flex flex-col items-center gap-${compact ? "4" : "6"}`,
      children: [
        /* @__PURE__ */ jsxs("header", { className: "w-full flex items-center justify-between gap-3", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 text-emerald-700 dark:text-emerald-400", children: [
            /* @__PURE__ */ jsx(PiTreePalmDuotone, { className: compact ? "text-3xl" : "text-5xl" }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx(
                "h1",
                {
                  className: `${compact ? "text-xl" : "text-3xl"} font-bold tracking-tight text-foreground`,
                  children: "Palmprint"
                }
              ),
              !compact && /* @__PURE__ */ jsx("p", { className: "text-sm opacity-80", children: "Gesture & face human verification" })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
            !lockSettings && /* @__PURE__ */ jsx(
              "button",
              {
                onClick: () => setShowSettings((v) => !v),
                disabled: settingsLocked,
                className: "px-3 py-2 rounded-full bg-foreground/5 hover:bg-foreground/10 text-sm font-medium border border-foreground/10 disabled:opacity-40 disabled:cursor-not-allowed text-foreground",
                "aria-label": "Settings",
                children: "\u2699 Settings"
              }
            ),
            onCancel && /* @__PURE__ */ jsx(
              "button",
              {
                onClick: onCancel,
                className: "px-3 py-2 rounded-full bg-foreground/5 hover:bg-foreground/10 text-sm font-medium border border-foreground/10 text-foreground",
                "aria-label": "Close",
                children: "\u2715"
              }
            )
          ] })
        ] }),
        showSettings && !settingsLocked && !lockSettings && /* @__PURE__ */ jsxs("div", { className: "w-full rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-4 flex flex-col gap-4 text-foreground", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-2", children: [
            /* @__PURE__ */ jsx("span", { className: "text-sm font-medium", children: "Security level" }),
            /* @__PURE__ */ jsx("div", { className: "grid grid-cols-3 gap-2", children: ["low", "medium", "high"].map((l) => /* @__PURE__ */ jsx(
              "button",
              {
                onClick: () => handleLevelChange(l),
                className: `px-3 py-2 rounded-lg text-sm font-medium border transition ${level === l ? "bg-emerald-500 text-black border-emerald-500" : "bg-transparent border-foreground/15 hover:bg-foreground/5"}`,
                children: SECURITY[l].label
              },
              l
            )) }),
            /* @__PURE__ */ jsxs("p", { className: "text-xs text-foreground/60", children: [
              itemsPerStep === 1 ? "1 item per step" : `${itemsPerStep} simultaneous items per step`,
              " ",
              "\xB7 prompts rotate every ",
              (rotateMs / 1e3).toFixed(1),
              "s if not matched"
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-2", children: [
            /* @__PURE__ */ jsxs("label", { className: "text-sm font-medium flex items-center justify-between", children: [
              /* @__PURE__ */ jsx("span", { children: "Number of tests" }),
              /* @__PURE__ */ jsx("span", { className: "font-mono text-emerald-600 dark:text-emerald-400", children: numTests })
            ] }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "range",
                min: 1,
                max: 5,
                step: 1,
                value: numTests,
                onChange: (e) => setNumTests(Number(e.target.value)),
                className: "accent-emerald-500"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-2", children: [
            /* @__PURE__ */ jsx("span", { className: "text-sm font-medium", children: "Detection mode" }),
            /* @__PURE__ */ jsx("div", { className: "grid grid-cols-3 gap-2", children: ["hand", "face", "both"].map((m) => /* @__PURE__ */ jsx(
              "button",
              {
                onClick: () => setMode(m),
                className: `px-3 py-2 rounded-lg text-sm font-medium border transition ${mode === m ? "bg-emerald-500 text-black border-emerald-500" : "bg-transparent border-foreground/15 hover:bg-foreground/5"}`,
                children: m === "hand" ? "Hand only" : m === "face" ? "Face only" : "Both"
              },
              m
            )) }),
            mode === "hand" && itemsPerStep > 1 && /* @__PURE__ */ jsx("p", { className: "text-xs text-foreground/60", children: "Two hand gestures = use both hands at once." })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-2", children: [
            /* @__PURE__ */ jsx("span", { className: "text-sm font-medium", children: "Capture on success" }),
            /* @__PURE__ */ jsx("div", { className: "grid grid-cols-3 gap-2", children: ["off", "photo", "video"].map((c) => /* @__PURE__ */ jsx(
              "button",
              {
                onClick: () => setCaptureMode(c),
                className: `px-3 py-2 rounded-lg text-sm font-medium border transition ${captureMode === c ? "bg-emerald-500 text-black border-emerald-500" : "bg-transparent border-foreground/15 hover:bg-foreground/5"}`,
                children: c === "off" ? "Off" : c === "photo" ? "Photo" : "Video clip"
              },
              c
            )) }),
            /* @__PURE__ */ jsx("p", { className: "text-xs text-foreground/60", children: captureMode === "off" ? "No frames are kept after verification." : captureMode === "photo" ? "Saves a raw PNG of each successful pose \u2014 useful for offline AI/deepfake analysis." : "Records a WebM clip per successful step. Discarded on prompt rotation." })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-black/80 ring-1 ring-white/10 shadow-2xl", children: [
          /* @__PURE__ */ jsx(
            "video",
            {
              ref: videoRef,
              playsInline: true,
              muted: true,
              className: "absolute inset-0 w-full h-full object-cover -scale-x-100"
            }
          ),
          /* @__PURE__ */ jsx(
            "canvas",
            {
              ref: canvasRef,
              className: "absolute inset-0 w-full h-full object-cover -scale-x-100 pointer-events-none"
            }
          ),
          status !== "running" && status !== "verified" && /* @__PURE__ */ jsxs("div", { className: "absolute inset-0 flex flex-col items-center justify-center text-white/90 gap-3 bg-black/50", children: [
            /* @__PURE__ */ jsx(PiTreePalmDuotone, { className: "text-7xl text-emerald-400" }),
            status === "loading" && /* @__PURE__ */ jsx("p", { children: "Loading hand & face models\u2026" }),
            status === "ready" && /* @__PURE__ */ jsxs(Fragment, { children: [
              /* @__PURE__ */ jsx(
                "button",
                {
                  onClick: start,
                  className: "px-5 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-semibold transition",
                  children: "Start verification"
                }
              ),
              /* @__PURE__ */ jsxs("p", { className: "text-xs text-white/60", children: [
                SECURITY[level].label,
                " \xB7 ",
                numTests,
                " ",
                numTests === 1 ? "test" : "tests",
                " \xB7",
                " ",
                mode === "hand" ? "hand" : mode === "face" ? "face" : "hand + face"
              ] })
            ] }),
            status === "error" && /* @__PURE__ */ jsxs(Fragment, { children: [
              /* @__PURE__ */ jsx("p", { className: "text-rose-300 max-w-sm text-center px-4", children: error ?? "Something went wrong." }),
              /* @__PURE__ */ jsx(
                "button",
                {
                  onClick: reset,
                  className: "px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white",
                  children: "Try again"
                }
              )
            ] })
          ] }),
          status === "verified" && /* @__PURE__ */ jsx("div", { className: "absolute inset-0 overflow-y-auto bg-emerald-500/95 text-black", children: /* @__PURE__ */ jsxs("div", { className: "min-h-full flex flex-col items-center justify-center gap-3 px-6 py-6", children: [
            /* @__PURE__ */ jsx(
              PiTreePalmDuotone,
              {
                className: compact ? "text-6xl" : "text-5xl"
              }
            ),
            /* @__PURE__ */ jsx(
              "p",
              {
                className: `${compact ? "text-3xl" : "text-2xl"} font-bold`,
                children: "Verified"
              }
            ),
            !compact && token && /* @__PURE__ */ jsxs("div", { className: "w-full max-w-md flex flex-col gap-2", children: [
              /* @__PURE__ */ jsx("span", { className: "text-xs uppercase tracking-wider opacity-70", children: "Session token (5 min)" }),
              /* @__PURE__ */ jsx(
                "textarea",
                {
                  readOnly: true,
                  value: token,
                  className: "w-full h-16 text-xs font-mono p-2 rounded-md bg-black/80 text-emerald-300 resize-none",
                  onFocus: (e) => e.currentTarget.select()
                }
              ),
              /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    onClick: copyToken,
                    className: "flex-1 px-3 py-2 rounded-full bg-black/85 text-emerald-300 hover:bg-black text-sm",
                    children: copied ? "Copied!" : "Copy token"
                  }
                ),
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    onClick: reset,
                    className: "flex-1 px-3 py-2 rounded-full bg-black/85 text-white hover:bg-black text-sm",
                    children: "Run again"
                  }
                )
              ] })
            ] }),
            !compact && captures.length > 0 && /* @__PURE__ */ jsxs("div", { className: "w-full max-w-md flex flex-col gap-2 mt-2", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
                /* @__PURE__ */ jsxs("span", { className: "text-xs uppercase tracking-wider opacity-70", children: [
                  "Captures (",
                  captures.length,
                  ")"
                ] }),
                /* @__PURE__ */ jsxs("span", { className: "text-[10px] opacity-60", children: [
                  "raw",
                  " ",
                  captures[0]?.type === "photo" ? "PNG" : "WebM",
                  " blobs"
                ] })
              ] }),
              /* @__PURE__ */ jsx("div", { className: "grid grid-cols-2 gap-2", children: captures.map((c) => /* @__PURE__ */ jsxs(
                "div",
                {
                  className: "flex flex-col gap-1 rounded-lg overflow-hidden bg-black/85",
                  children: [
                    c.type === "photo" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      /* @__PURE__ */ jsx(
                        "img",
                        {
                          src: c.url,
                          alt: c.prompt,
                          className: "w-full aspect-[4/3] object-cover -scale-x-100"
                        }
                      )
                    ) : /* @__PURE__ */ jsx(
                      "video",
                      {
                        src: c.url,
                        controls: true,
                        playsInline: true,
                        className: "w-full aspect-[4/3] object-cover -scale-x-100"
                      }
                    ),
                    /* @__PURE__ */ jsxs("div", { className: "px-2 pb-2 pt-1 flex items-center justify-between gap-2 text-white", children: [
                      /* @__PURE__ */ jsxs("span", { className: "text-[11px] truncate", children: [
                        "#",
                        c.stepIndex + 1,
                        " \xB7 ",
                        c.prompt
                      ] }),
                      /* @__PURE__ */ jsx(
                        "a",
                        {
                          href: c.url,
                          download: captureFileName(c),
                          className: "text-[11px] px-2 py-0.5 rounded bg-emerald-500 text-black font-medium hover:bg-emerald-400",
                          children: "\u2193"
                        }
                      )
                    ] })
                  ]
                },
                c.id
              )) })
            ] })
          ] }) }),
          status === "running" && currentStep && /* @__PURE__ */ jsxs("div", { className: "absolute top-3 left-3 right-3 flex items-start justify-between gap-3", children: [
            /* @__PURE__ */ jsxs("div", { className: "px-3 py-2 rounded-xl bg-black/60 backdrop-blur text-white text-sm max-w-[70%]", children: [
              /* @__PURE__ */ jsxs("div", { className: "opacity-70 text-xs", children: [
                "Step ",
                stepIndex + 1,
                " of ",
                challenges.length,
                " \u2014",
                " ",
                currentStep.length === 1 ? currentStep[0].kind === "hand" ? "show" : "make" : "do all at once"
              ] }),
              /* @__PURE__ */ jsx("div", { className: "font-semibold flex flex-col gap-0.5", children: currentStep.map((it, i) => /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                /* @__PURE__ */ jsx("span", { className: "text-xl", children: itemEmoji(it) }),
                /* @__PURE__ */ jsx("span", { children: itemLabel(it) })
              ] }, i)) })
            ] }),
            /* @__PURE__ */ jsx("div", { className: "flex gap-1.5 flex-wrap justify-end max-w-[28%]", children: challenges.map((_, i) => /* @__PURE__ */ jsx(
              "div",
              {
                className: `h-2 w-8 rounded-full ${stepIndex > i ? "bg-emerald-400" : stepIndex === i ? "bg-white/70" : "bg-white/20"}`
              },
              i
            )) })
          ] }),
          status === "running" && /* @__PURE__ */ jsxs("div", { className: "absolute bottom-3 left-3 right-3 flex items-center gap-3", children: [
            /* @__PURE__ */ jsx("div", { className: "flex-1 h-2 rounded-full bg-white/15 overflow-hidden", children: /* @__PURE__ */ jsx(
              "div",
              {
                className: "h-full bg-emerald-400 transition-[width] duration-75",
                style: { width: `${Math.round(holdProgress * 100)}%` }
              }
            ) }),
            /* @__PURE__ */ jsx("div", { className: "text-xs text-white/80 font-mono", children: SECURITY[level].label })
          ] })
        ] }),
        /* @__PURE__ */ jsx("p", { className: "text-sm text-foreground/70 text-center max-w-md", children: "Hold each prompt steady for ~0.8s. Prompts rotate periodically to stop pre-recorded video attacks. All processing is local." })
      ]
    }
  );
}

// packages/react/src/PalmprintProvider.tsx
import {
  createContext,
  useCallback as useCallback2,
  useContext,
  useEffect as useEffect2,
  useRef as useRef2,
  useState as useState2
} from "react";
import { PiTreePalmDuotone as PiTreePalmDuotone2 } from "react-icons/pi";
import { jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
var PalmprintCtx = createContext(null);
function PalmprintProvider({
  children,
  apiBase = "/api/palmprint",
  uploadCaptures = true
}) {
  const [open, setOpen] = useState2(false);
  const [opts, setOpts] = useState2({});
  const [statusMsg, setStatusMsg] = useState2(null);
  const resolverRef = useRef2(null);
  const flowRef = useRef2(null);
  const requireVerification = useCallback2(
    async (o) => {
      resolverRef.current?.reject(
        new Error("Superseded by another verification request")
      );
      const level = o?.level ?? "medium";
      let challengeToken = o?.challengeToken;
      let challengeNonce = o?.challengeNonce;
      if (!challengeToken && apiBase !== false) {
        try {
          setStatusMsg("Asking server for a challenge\u2026");
          const res = await fetch(`${apiBase}/challenge`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              required_level: level,
              required_steps: o?.numTests
            })
          });
          if (res.ok) {
            const data = await res.json();
            challengeToken = data.challenge_token;
            challengeNonce = data.challenge_nonce;
          } else {
            console.warn(
              `[palmprint] /challenge returned ${res.status}; falling back to unsigned mode`
            );
          }
        } catch (e) {
          console.warn(
            "[palmprint] could not reach /challenge; falling back to unsigned mode",
            e
          );
        }
      }
      flowRef.current = { challengeToken, challengeNonce, level };
      setStatusMsg(null);
      return new Promise((resolve, reject) => {
        resolverRef.current = { resolve, reject };
        setOpts({ ...o, challengeNonce });
        setOpen(true);
      });
    },
    [apiBase]
  );
  const handleModalVerified = useCallback2(
    async (modalResult) => {
      const resolver = resolverRef.current;
      const flow = flowRef.current;
      resolverRef.current = null;
      flowRef.current = null;
      setOpen(false);
      if (!resolver) return;
      let sessionToken = "";
      let expiresAt = 0;
      const uploadedCaptureIds = [];
      if (flow?.challengeToken && apiBase !== false) {
        try {
          const res = await fetch(`${apiBase}/redeem`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              challenge_token: flow.challengeToken,
              client_token: modalResult.token
            })
          });
          const data = await res.json();
          if (!res.ok) {
            resolver.reject(
              new Error(
                data.error ? `Redeem failed: ${data.error}` : `Redeem failed (${res.status})`
              )
            );
            return;
          }
          sessionToken = data.session_token;
          expiresAt = data.expires_at;
        } catch (e) {
          resolver.reject(
            e instanceof Error ? e : new Error("Redeem network error")
          );
          return;
        }
      }
      if (uploadCaptures && sessionToken && apiBase !== false && modalResult.captures.length > 0) {
        for (const cap of modalResult.captures) {
          try {
            const fd = new FormData();
            fd.append("file", cap.blob, captureFileName(cap));
            fd.append(
              "meta",
              JSON.stringify({
                type: cap.type,
                prompt: cap.prompt,
                stepIndex: cap.stepIndex,
                ts: cap.ts
              })
            );
            const res = await fetch(`${apiBase}/captures`, {
              method: "POST",
              headers: { Authorization: `Bearer ${sessionToken}` },
              body: fd
            });
            if (res.ok) {
              const data = await res.json();
              if (data?.id) uploadedCaptureIds.push(data.id);
            } else {
              console.warn(
                `[palmprint] capture upload returned ${res.status}`
              );
            }
          } catch (e) {
            console.warn("[palmprint] capture upload failed", e);
          }
        }
      }
      resolver.resolve({
        sessionToken,
        expiresAt,
        level: flow?.level ?? "medium",
        challengeNonce: flow?.challengeNonce ?? "",
        clientToken: modalResult.token,
        captures: modalResult.captures,
        uploadedCaptureIds
      });
    },
    [apiBase, uploadCaptures]
  );
  const handleCancel = useCallback2(() => {
    const resolver = resolverRef.current;
    resolverRef.current = null;
    flowRef.current = null;
    setOpen(false);
    setStatusMsg(null);
    resolver?.reject(new Error("Verification cancelled"));
  }, []);
  useEffect2(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") handleCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, handleCancel]);
  useEffect2(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
  return /* @__PURE__ */ jsxs2(PalmprintCtx.Provider, { value: { requireVerification, isOpen: open }, children: [
    children,
    statusMsg && !open && /* @__PURE__ */ jsx2("div", { className: "fixed bottom-4 right-4 z-[1001] px-3 py-2 rounded-full bg-zinc-900 text-zinc-100 text-xs shadow-lg", children: statusMsg }),
    open && /* @__PURE__ */ jsx2(
      "div",
      {
        role: "dialog",
        "aria-modal": "true",
        className: "fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm",
        onClick: (e) => {
          if (e.target === e.currentTarget) handleCancel();
        },
        children: /* @__PURE__ */ jsxs2("div", { className: "w-full max-w-xl rounded-2xl bg-zinc-50 dark:bg-zinc-950 p-5 shadow-2xl border border-foreground/10 max-h-[95vh] overflow-y-auto", children: [
          (opts.reason || opts.description) && /* @__PURE__ */ jsxs2("div", { className: "mb-4 flex items-start gap-3", children: [
            /* @__PURE__ */ jsx2(PiTreePalmDuotone2, { className: "text-3xl text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" }),
            /* @__PURE__ */ jsxs2("div", { className: "flex flex-col gap-1", children: [
              opts.reason && /* @__PURE__ */ jsx2("h2", { className: "text-lg font-bold text-foreground leading-tight", children: opts.reason }),
              opts.description && /* @__PURE__ */ jsx2("p", { className: "text-sm text-foreground/70 leading-snug", children: opts.description })
            ] })
          ] }),
          /* @__PURE__ */ jsx2(
            Palmprint,
            {
              initialLevel: opts.level ?? "medium",
              initialMode: opts.mode ?? "both",
              initialNumTests: opts.numTests,
              initialCaptureMode: opts.captureMode ?? "off",
              challengeNonce: opts.challengeNonce,
              lockSettings: true,
              compact: true,
              autoStart: true,
              onCancel: handleCancel,
              onVerified: handleModalVerified
            }
          )
        ] })
      }
    )
  ] });
}
function usePalmprintGate() {
  const ctx = useContext(PalmprintCtx);
  if (!ctx) {
    throw new Error(
      "usePalmprintGate must be used inside <PalmprintProvider>"
    );
  }
  return ctx;
}
function usePalmprint() {
  const ctx = usePalmprintGate();
  return {
    ...ctx,
    verify: ctx.requireVerification
  };
}

// packages/react/src/PalmprintGuard.tsx
import {
  useCallback as useCallback3,
  useEffect as useEffect3,
  useRef as useRef3,
  useState as useState3
} from "react";
import { PiTreePalmDuotone as PiTreePalmDuotone3 } from "react-icons/pi";
import { Fragment as Fragment2, jsx as jsx3, jsxs as jsxs3 } from "react/jsx-runtime";
function PalmprintGuard({
  children,
  level = "medium",
  numTests,
  mode,
  captureMode,
  reason = "Verification required",
  description,
  onVerified,
  fallback,
  autoOpen = true
}) {
  const { requireVerification } = usePalmprintGate();
  const [verified, setVerified] = useState3(null);
  const [pending, setPending] = useState3(false);
  const [error, setError] = useState3(null);
  const triggered = useRef3(false);
  const trigger = useCallback3(async () => {
    setPending(true);
    setError(null);
    try {
      const result = await requireVerification({
        level,
        numTests,
        mode,
        captureMode,
        reason,
        description
      });
      setVerified(result);
      onVerified?.(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cancelled");
    } finally {
      setPending(false);
    }
  }, [
    requireVerification,
    level,
    numTests,
    mode,
    captureMode,
    reason,
    description,
    onVerified
  ]);
  useEffect3(() => {
    if (!autoOpen || triggered.current) return;
    triggered.current = true;
    const t = setTimeout(() => void trigger(), 0);
    return () => clearTimeout(t);
  }, [autoOpen, trigger]);
  if (verified) return /* @__PURE__ */ jsx3(Fragment2, { children });
  if (fallback !== void 0) return /* @__PURE__ */ jsx3(Fragment2, { children: fallback });
  return /* @__PURE__ */ jsx3("div", { className: "flex flex-1 items-center justify-center min-h-[60vh] px-4", children: /* @__PURE__ */ jsxs3("div", { className: "max-w-md w-full rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-6 flex flex-col items-center gap-3 text-center", children: [
    /* @__PURE__ */ jsx3(PiTreePalmDuotone3, { className: "text-5xl text-emerald-700 dark:text-emerald-400" }),
    /* @__PURE__ */ jsx3("h1", { className: "text-xl font-bold text-foreground", children: reason }),
    description && /* @__PURE__ */ jsx3("p", { className: "text-sm text-foreground/70", children: description }),
    /* @__PURE__ */ jsxs3("p", { className: "text-[11px] uppercase tracking-wider text-foreground/55", children: [
      "Auth level: ",
      level
    ] }),
    error && /* @__PURE__ */ jsx3("p", { className: "text-xs text-rose-600", children: error }),
    /* @__PURE__ */ jsx3(
      "button",
      {
        onClick: () => void trigger(),
        disabled: pending,
        className: "mt-1 px-5 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-semibold disabled:opacity-60",
        children: pending ? "Waiting\u2026" : "Verify with Palmprint"
      }
    )
  ] }) });
}

// packages/react/src/VerifyWidget.tsx
import { useCallback as useCallback4, useEffect as useEffect4, useRef as useRef4, useState as useState4 } from "react";
import { PiTreePalmDuotone as PiTreePalmDuotone4 } from "react-icons/pi";
import { Fragment as Fragment3, jsx as jsx4, jsxs as jsxs4 } from "react/jsx-runtime";
var DEFAULT_WIDGET_CONFIG = {
  label: "Verify with Palmprint",
  verifiedLabel: "Verified \u2713",
  shape: "pill",
  size: "md",
  theme: "emerald",
  showIcon: true,
  fullWidth: false,
  level: "medium",
  mode: "both",
  numTests: 2,
  captureMode: "off"
};
var SHAPE_CLASS = {
  pill: "rounded-full",
  rounded: "rounded-xl",
  square: "rounded-none"
};
var SIZE_CLASS = {
  sm: "px-3 py-1.5 text-sm gap-1.5",
  md: "px-5 py-2.5 text-base gap-2",
  lg: "px-7 py-3.5 text-lg gap-2.5"
};
var ICON_SIZE = {
  sm: "text-base",
  md: "text-xl",
  lg: "text-2xl"
};
var THEME_CLASS = {
  emerald: "bg-emerald-500 hover:bg-emerald-400 text-black border border-emerald-600",
  dark: "bg-zinc-900 hover:bg-zinc-800 text-emerald-300 border border-zinc-700",
  light: "bg-white hover:bg-zinc-50 text-emerald-700 border border-emerald-200 shadow-sm"
};
function VerifyWidget({
  config,
  apiBase = false,
  uploadCaptures = true,
  onVerified,
  openSignal
}) {
  const [open, setOpen] = useState4(false);
  const [verifiedToken, setVerifiedToken] = useState4(null);
  const [busy, setBusy] = useState4(false);
  const [error, setError] = useState4(null);
  const [flow, setFlow] = useState4(null);
  const seenOpenSignalRef = useRef4(0);
  useEffect4(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
  const startFlow = useCallback4(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    let challengeToken;
    let challengeNonce;
    if (apiBase !== false) {
      try {
        const res = await fetch(`${apiBase}/challenge`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            required_level: config.level,
            required_steps: config.numTests
          })
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error ?? `Challenge failed (${res.status})`);
        }
        challengeToken = data.challenge_token;
        challengeNonce = data.challenge_nonce;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Could not start verification";
        setError(msg);
        setBusy(false);
        return;
      }
    }
    setFlow({ challengeToken, challengeNonce });
    setBusy(false);
    setOpen(true);
  }, [apiBase, busy, config.level, config.numTests]);
  useEffect4(() => {
    if (openSignal === void 0 || openSignal <= 0) return;
    if (seenOpenSignalRef.current === openSignal) return;
    seenOpenSignalRef.current = openSignal;
    const t = setTimeout(() => void startFlow(), 0);
    return () => clearTimeout(t);
  }, [openSignal, startFlow]);
  const handleVerified = useCallback4(
    async (result) => {
      let sessionToken = "";
      let expiresAt = 0;
      const uploadedCaptureIds = [];
      if (apiBase !== false && flow?.challengeToken) {
        try {
          const res = await fetch(`${apiBase}/redeem`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              challenge_token: flow.challengeToken,
              client_token: result.token
            })
          });
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data?.error ?? `Redeem failed (${res.status})`);
          }
          sessionToken = data.session_token;
          expiresAt = data.expires_at;
        } catch (e) {
          setError(e instanceof Error ? e.message : "Redeem failed");
          setOpen(false);
          return;
        }
      }
      if (uploadCaptures && apiBase !== false && sessionToken && result.captures.length > 0) {
        for (const cap of result.captures) {
          try {
            const fd = new FormData();
            fd.append("file", cap.blob, captureFileName(cap));
            fd.append(
              "meta",
              JSON.stringify({
                type: cap.type,
                prompt: cap.prompt,
                stepIndex: cap.stepIndex,
                ts: cap.ts
              })
            );
            const res = await fetch(`${apiBase}/captures`, {
              method: "POST",
              headers: { Authorization: `Bearer ${sessionToken}` },
              body: fd
            });
            if (res.ok) {
              const data = await res.json();
              if (data?.id) uploadedCaptureIds.push(data.id);
            }
          } catch (e) {
            console.warn("[palmprint] capture upload failed", e);
          }
        }
      }
      const token = sessionToken || result.token;
      setVerifiedToken(token);
      onVerified?.({
        token,
        sessionToken,
        clientToken: result.token,
        expiresAt,
        challengeNonce: flow?.challengeNonce ?? "",
        captures: result.captures,
        uploadedCaptureIds
      });
      setTimeout(() => setOpen(false), 600);
    },
    [apiBase, flow, onVerified, uploadCaptures]
  );
  const buttonClass = [
    "inline-flex items-center justify-center font-semibold transition select-none",
    SHAPE_CLASS[config.shape],
    SIZE_CLASS[config.size],
    THEME_CLASS[config.theme],
    config.fullWidth ? "w-full" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ jsxs4(Fragment3, { children: [
    /* @__PURE__ */ jsxs4(
      "button",
      {
        type: "button",
        onClick: () => void startFlow(),
        disabled: busy,
        className: buttonClass,
        "aria-label": config.label,
        children: [
          config.showIcon && /* @__PURE__ */ jsx4(PiTreePalmDuotone4, { className: ICON_SIZE[config.size] }),
          /* @__PURE__ */ jsx4("span", { children: busy ? "Starting..." : verifiedToken ? config.verifiedLabel : config.label })
        ]
      }
    ),
    error && /* @__PURE__ */ jsx4("p", { className: "mt-2 text-xs text-rose-600 max-w-xs", role: "alert", children: error }),
    open && /* @__PURE__ */ jsx4(
      "div",
      {
        className: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm",
        role: "dialog",
        "aria-modal": "true",
        onClick: (e) => {
          if (e.target === e.currentTarget) setOpen(false);
        },
        children: /* @__PURE__ */ jsx4("div", { className: "w-full max-w-xl rounded-2xl bg-zinc-50 dark:bg-zinc-950 p-5 shadow-2xl border border-foreground/10 max-h-[95vh] overflow-y-auto", children: /* @__PURE__ */ jsx4(
          Palmprint,
          {
            initialLevel: config.level,
            initialMode: config.mode,
            initialNumTests: config.numTests,
            initialCaptureMode: config.captureMode,
            challengeNonce: flow?.challengeNonce,
            lockSettings: true,
            compact: true,
            onCancel: () => setOpen(false),
            onVerified: handleVerified
          }
        ) })
      }
    )
  ] });
}

// packages/react/src/CaptchaCheckbox.tsx
import { useState as useState5 } from "react";
import { PiTreePalmDuotone as PiTreePalmDuotone5 } from "react-icons/pi";
import { jsx as jsx5, jsxs as jsxs5 } from "react/jsx-runtime";
var DEFAULT_CAPTCHA_CONFIG = {
  label: "I'm not a robot",
  verifyingLabel: "Verifying\u2026",
  verifiedLabel: "Verified",
  failedLabel: "Try again",
  theme: "light",
  fullWidth: false,
  level: "medium",
  mode: "both",
  numTests: 2
};
function CaptchaCheckbox({
  config = {},
  onVerified
}) {
  const cfg = { ...DEFAULT_CAPTCHA_CONFIG, ...config };
  const { requireVerification } = usePalmprintGate();
  const [phase, setPhase] = useState5("idle");
  const [errorMsg, setErrorMsg] = useState5(null);
  const handleClick = async () => {
    if (phase === "verified" || phase === "loading") return;
    setPhase("loading");
    setErrorMsg(null);
    try {
      const result = await requireVerification({
        level: cfg.level,
        mode: cfg.mode,
        numTests: cfg.numTests,
        captureMode: cfg.captureMode,
        challengeNonce: cfg.challengeNonce,
        reason: "Verify you're human",
        description: "Complete the Palmprint challenge to continue."
      });
      setPhase("verified");
      onVerified?.(result);
    } catch (e) {
      setPhase("error");
      setErrorMsg(e instanceof Error ? e.message : "Cancelled");
    }
  };
  const isDark = cfg.theme === "dark";
  const containerClass = [
    "flex items-stretch gap-3 px-3 py-3 rounded-md border select-none transition",
    isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100 hover:bg-zinc-800" : "bg-white border-zinc-300 text-zinc-900 hover:shadow-sm",
    cfg.fullWidth ? "w-full" : "w-72",
    phase === "verified" || phase === "loading" ? "cursor-default" : "cursor-pointer"
  ].filter(Boolean).join(" ");
  const text = phase === "idle" ? cfg.label : phase === "loading" ? cfg.verifyingLabel : phase === "verified" ? cfg.verifiedLabel : errorMsg ?? cfg.failedLabel;
  return /* @__PURE__ */ jsxs5(
    "button",
    {
      type: "button",
      onClick: handleClick,
      disabled: phase === "verified" || phase === "loading",
      "aria-checked": phase === "verified",
      role: "checkbox",
      className: containerClass,
      children: [
        /* @__PURE__ */ jsx5(CheckboxIndicator, { phase, dark: isDark }),
        /* @__PURE__ */ jsx5(
          "span",
          {
            className: `flex-1 text-left text-sm font-medium self-center ${phase === "error" ? "text-rose-600" : ""}`,
            children: text
          }
        ),
        /* @__PURE__ */ jsxs5("div", { className: "flex flex-col items-center justify-center gap-0.5 self-center opacity-80", children: [
          /* @__PURE__ */ jsx5(PiTreePalmDuotone5, { className: "text-2xl text-emerald-600 dark:text-emerald-400" }),
          /* @__PURE__ */ jsx5(
            "span",
            {
              className: `text-[8px] uppercase tracking-wider font-semibold ${isDark ? "text-zinc-300" : "text-zinc-600"}`,
              children: "Palmprint"
            }
          )
        ] })
      ]
    }
  );
}
function CheckboxIndicator({
  phase,
  dark
}) {
  const base = "w-7 h-7 self-center rounded-sm border-2 grid place-items-center text-base font-bold transition";
  if (phase === "loading") {
    return /* @__PURE__ */ jsx5("div", { className: `${base} ${dark ? "border-zinc-600" : "border-zinc-300"}`, children: /* @__PURE__ */ jsx5(Spinner, {}) });
  }
  if (phase === "verified") {
    return /* @__PURE__ */ jsx5(
      "div",
      {
        className: `${base} bg-emerald-500 border-emerald-500 text-white`,
        "aria-hidden": true,
        children: "\u2713"
      }
    );
  }
  if (phase === "error") {
    return /* @__PURE__ */ jsx5(
      "div",
      {
        className: `${base} bg-rose-500 border-rose-500 text-white`,
        "aria-hidden": true,
        children: "\u2715"
      }
    );
  }
  return /* @__PURE__ */ jsx5(
    "div",
    {
      className: `${base} ${dark ? "border-zinc-500 bg-zinc-800" : "border-zinc-400 bg-white"}`,
      "aria-hidden": true
    }
  );
}
function Spinner() {
  return /* @__PURE__ */ jsx5(
    "span",
    {
      "aria-label": "loading",
      className: "w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"
    }
  );
}
export {
  CaptchaCheckbox,
  DEFAULT_CAPTCHA_CONFIG,
  DEFAULT_WIDGET_CONFIG,
  Palmprint,
  PalmprintGuard,
  PalmprintProvider,
  VerifyWidget,
  captureFileName,
  usePalmprint,
  usePalmprintGate
};
//# sourceMappingURL=index.js.map
