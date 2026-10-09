// Focus Mirror: runs in an offscreen document. Camera frames are analysed on this device by MediaPipe
// and immediately discarded. Only a few numbers (blink rate, eyes closed, face distance) leave this file.
import { FaceLandmarker, FilesetResolver } from "./vendor/mediapipe/vision_bundle.mjs";

const video = document.getElementById("v");
const send = (m) => chrome.runtime.sendMessage(m).catch(() => {});

let landmarker, stream, timer;
const blinks = []; // timestamps of recent blinks
const yawns = [];
let closedSince = 0, wasClosed = false, yawnSince = 0, started = 0;

async function start() {
  const files = await FilesetResolver.forVisionTasks(chrome.runtime.getURL("vendor/mediapipe"));
  landmarker = await FaceLandmarker.createFromOptions(files, {
    baseOptions: { modelAssetPath: chrome.runtime.getURL("vendor/mediapipe/face_landmarker.task"), delegate: "CPU" },
    runningMode: "VIDEO",
    numFaces: 1,
    outputFaceBlendshapes: true,
  });
  stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240, frameRate: 10 } });
  video.srcObject = stream;
  await video.play();
  started = performance.now();
  timer = setInterval(analyse, 125);
  setInterval(report, 1000);
}

let latest = { present: false, tooClose: false, eyesClosed: false, yawning: false };

function analyse() {
  if (video.readyState < 2) return;
  const now = performance.now();
  const res = landmarker.detectForVideo(video, now);
  const face = res.faceLandmarks?.[0];
  if (!face) { latest = { present: false, tooClose: false, eyesClosed: false, yawning: false }; wasClosed = false; closedSince = 0; return; }

  const bs = Object.fromEntries(res.faceBlendshapes[0].categories.map((c) => [c.categoryName, c.score]));
  const closed = (bs.eyeBlinkLeft + bs.eyeBlinkRight) / 2 > 0.5;
  if (closed && !wasClosed) closedSince = now;
  if (!closed && wasClosed && now - closedSince < 600) blinks.push(Date.now()); // a blink, not a long close
  wasClosed = closed;

  const yawning = bs.jawOpen > 0.55 && (bs.mouthStretchLeft + bs.mouthStretchRight) / 2 < 0.5;
  if (yawning && !yawnSince) yawnSince = now;
  if (!yawning) { if (yawnSince && now - yawnSince > 1200) yawns.push(Date.now()); yawnSince = 0; }

  const width = Math.abs(face[454].x - face[234].x); // face width as a fraction of the frame
  latest = {
    present: true,
    eyesClosed: closed && now - closedSince > 1500,
    yawning: yawning && now - yawnSince > 1200,
    tooClose: width > 0.62,
  };
}

function report() {
  const cutoff = Date.now() - 60000;
  while (blinks.length && blinks[0] < cutoff) blinks.shift();
  while (yawns.length && yawns[0] < Date.now() - 300000) yawns.shift();
  const warm = performance.now() - started > 20000;
  const secs = Math.min(60, (performance.now() - started) / 1000);
  send({
    type: "cam",
    ...latest,
    warm,
    blinksPerMin: Math.round((blinks.length / secs) * 60),
    yawns: yawns.length,
  });
}

start().catch((e) => send({ type: "cam-error", error: String(e && e.message || e) }));
