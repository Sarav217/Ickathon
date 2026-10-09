// Rep counting from MediaPipe pose landmarks (33 points, normalised x/y, y grows downward).
// Pure logic, no browser APIs, so it can be unit tested with synthetic poses.

export const EXERCISES = {
  squat: { label: "Squats", emoji: "🦵", cue: "Stand back so your whole body is in view. Bend your knees, then stand tall." },
  jacks: { label: "Jumping jacks", emoji: "🤸", cue: "Stand back so your whole body is in view. Arms and legs out, then back in." },
  reach: { label: "Overhead reach", emoji: "🙆", cue: "Reach both hands above your head, then lower them to your shoulders." },
};

const L = { nose: 0, lSh: 11, rSh: 12, lWr: 15, rWr: 16, lHip: 23, rHip: 24, lKn: 25, rKn: 26, lAn: 27, rAn: 28 };

const vis = (p) => (p ? (p.visibility ?? 1) : 0);
const ok = (lm, ...ids) => ids.every((i) => vis(lm[i]) > 0.5);

function angle(a, b, c) {
  const v1 = [a.x - b.x, a.y - b.y], v2 = [c.x - b.x, c.y - b.y];
  const dot = v1[0] * v2[0] + v1[1] * v2[1];
  const m = Math.hypot(...v1) * Math.hypot(...v2) || 1;
  return (Math.acos(Math.max(-1, Math.min(1, dot / m))) * 180) / Math.PI;
}

export class RepCounter {
  constructor(exercise) {
    this.exercise = exercise;
    this.reps = 0;
    this.phase = "up"; // "up" = start position, "down"/"open" = mid-rep
    this.hint = EXERCISES[exercise].cue;
  }

  update(lm) {
    if (!lm) { this.hint = "I can't see you. Step into the frame."; return this._state(); }
    const fn = { squat: this._squat, jacks: this._jacks, reach: this._reach }[this.exercise];
    fn.call(this, lm);
    return this._state();
  }

  _state() { return { reps: this.reps, phase: this.phase, hint: this.hint }; }

  _squat(lm) {
    if (!ok(lm, L.lHip, L.rHip, L.lKn, L.rKn, L.lAn, L.rAn)) { this.hint = "Step back so I can see your hips, knees and feet."; return; }
    const knee = (angle(lm[L.lHip], lm[L.lKn], lm[L.lAn]) + angle(lm[L.rHip], lm[L.rKn], lm[L.rAn])) / 2;
    if (this.phase === "up" && knee < 110) { this.phase = "down"; this.hint = "Now stand tall."; }
    else if (this.phase === "down" && knee > 160) { this.phase = "up"; this.reps++; this.hint = "Nice. Again."; }
    else if (this.phase === "up") this.hint = "Bend your knees.";
  }

  _jacks(lm) {
    if (!ok(lm, L.nose, L.lSh, L.rSh, L.lWr, L.rWr, L.lAn, L.rAn)) { this.hint = "Step back so I can see your whole body."; return; }
    const sw = Math.abs(lm[L.lSh].x - lm[L.rSh].x) || 0.1;
    const wristsUp = lm[L.lWr].y < lm[L.nose].y && lm[L.rWr].y < lm[L.nose].y;
    const wristsDown = lm[L.lWr].y > lm[L.lSh].y && lm[L.rWr].y > lm[L.rSh].y;
    const feetWide = Math.abs(lm[L.lAn].x - lm[L.rAn].x) > 1.5 * sw;
    const feetClose = Math.abs(lm[L.lAn].x - lm[L.rAn].x) < 1.1 * sw;
    if (this.phase === "up" && wristsUp && feetWide) { this.phase = "open"; this.hint = "Back in."; }
    else if (this.phase === "open" && wristsDown && feetClose) { this.phase = "up"; this.reps++; this.hint = "Nice. Again."; }
    else if (this.phase === "up") this.hint = "Arms up and feet wide.";
  }

  _reach(lm) {
    if (!ok(lm, L.nose, L.lSh, L.rSh, L.lWr, L.rWr)) { this.hint = "Step back so I can see your head, shoulders and hands."; return; }
    const up = lm[L.lWr].y < lm[L.nose].y && lm[L.rWr].y < lm[L.nose].y;
    const down = lm[L.lWr].y > lm[L.lSh].y && lm[L.rWr].y > lm[L.rSh].y;
    if (this.phase === "up" && up) { this.phase = "open"; this.hint = "Lower to your shoulders."; }
    else if (this.phase === "open" && down) { this.phase = "up"; this.reps++; this.hint = "Nice. Again."; }
    else if (this.phase === "up") this.hint = "Reach both hands above your head.";
  }
}

// Connections for drawing a simple skeleton.
export const BONES = [[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28]];
