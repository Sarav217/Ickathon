import {
  load, saveState, saveSettings, rollDay, isLocked, nextMidnight, debtLabel, bumpHistory, todayKey,
  DEBT_THRESHOLD, TASK_MINUTES, DEMO_TASK_SECONDS, MAX_PLANT_STAGE, DEFAULT_SITES,
} from "./lib/state.js";
import { MOODS, TIMES, HOBBIES, getTask } from "./lib/tasks.js";

const app = document.getElementById("app");
const hardstop = document.getElementById("hardstop");
const $ = (s, r = document) => r.querySelector(s);

// Campfire: a small, cooperative log. Simulated friends (max 5) stand in for a backend.
const FRIENDS = [
  { who: "Maya", text: "sketched my desk for 15 min 🌿" },
  { who: "Arjun", text: "learned two guitar chords 🎸" },
  { who: "Priya", text: "went for a phone-free walk" },
  { who: "Sam", text: "wrote a 100-word story" },
  { who: "Lena", text: "stretched out my neck and back" },
];

let ctx; // {settings, state}
let timerHandle = null;
let mirrorHandle = null;
let mixer = { mood: null, time: "15", hobby: null };

async function init() {
  ctx = await load();
  rollDay(ctx.state);
  seedCampfire();
  await saveState(ctx.state);
  chrome.storage.onChanged.addListener(async () => {
    if (document.hidden) return;
    const fresh = await load();
    ctx.settings = fresh.settings;
  });
  window.addEventListener("hashchange", route);
  $("#hs-demo-reset").addEventListener("click", async () => {
    ctx.state.lockedUntil = 0;
    await saveState(ctx.state);
    location.hash = "#home";
    route();
  });
  route();
}

function seedCampfire() {
  const s = ctx.state;
  if (s.campfire.some((e) => !e.you)) return;
  const now = Date.now();
  FRIENDS.slice(0, 3).forEach((f, i) => s.campfire.push({ ...f, at: now - (i + 1) * 47 * 60000 }));
}

// ---------- plants ----------
function plantSVG(stage, size = 180) {
  const pot = `<path d="M62 150 h56 l-6 34 h-44 z" fill="#c9825a"/><rect x="58" y="144" width="64" height="10" rx="4" fill="#d99870"/>`;
  const soil = `<ellipse cx="90" cy="146" rx="28" ry="4" fill="#5b3e2b"/>`;
  const stem = (h) => `<path d="M90 146 C88 ${146 - h / 2} 92 ${146 - h / 2} 90 ${146 - h}" stroke="#3f8f52" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  const leaf = (x, y, r, c = "#5cb36f") => `<ellipse cx="${x}" cy="${y}" rx="15" ry="7" fill="${c}" transform="rotate(${r} ${x} ${y})"/>`;
  let body = "";
  if (stage === 0) body = `<circle cx="90" cy="142" r="5" fill="#8a6a4a"/>`;
  if (stage >= 1) body += stem(24) + leaf(80, 128, -30) + leaf(100, 124, 30);
  if (stage >= 2) body += stem(52) + leaf(78, 112, -35) + leaf(102, 106, 35) + leaf(80, 96, -25, "#6fc27f");
  if (stage >= 3) body += stem(84) + leaf(76, 92, -40) + leaf(104, 86, 40) + leaf(78, 74, -30, "#6fc27f") + leaf(103, 68, 30, "#6fc27f");
  if (stage >= 4) {
    body += `<g>${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="90" cy="46" rx="7" ry="13" fill="#f2a1b5" transform="rotate(${a} 90 56) translate(0 -2)"/>`).join("")}<circle cx="90" cy="56" r="7" fill="#f6d365"/></g>`;
  }
  return `<svg class="sway" viewBox="0 0 180 190" width="${size}" height="${size}" aria-label="Plant, stage ${stage}">${pot}${soil}${body}</svg>`;
}

// ---------- routing ----------
function route() {
  clearInterval(timerHandle);
  clearInterval(mirrorHandle);
  const cur = location.hash.slice(1).split("?")[0];
  document.querySelectorAll("#nav a").forEach((a) => a.classList.toggle("on", a.dataset.r === (cur === "welcome" || !cur ? "home" : cur)));
  const [name, qs] = location.hash.slice(1).split("?");
  const params = new URLSearchParams(qs || "");
  const locked = isLocked(ctx.state);
  hardstop.hidden = !(locked && name !== "done" && name !== "settings");
  if (!hardstop.hidden) return showHardStop();

  switch (name) {
    case "mixer": return renderMixer(params);
    case "task": return renderTask();
    case "done": return renderDone();
    case "settings": return renderSettings();
    case "insights": return renderInsights();
    default: return renderHome(name === "welcome");
  }
}

function showHardStop() {
  $("#hs-plant").innerHTML = plantSVG(ctx.state.plantStage, 150);
  const when = new Date(ctx.state.lockedUntil);
  $("#hs-sub").textContent = `Locked until ${when.toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}. Distraction sites will remind you.`;
  $("#hs-demo-reset").hidden = !ctx.settings.demoMode;
}

function timeAgo(at) {
  const m = Math.max(1, Math.round((Date.now() - at) / 60000));
  return m < 60 ? `${m}m ago` : `${Math.round(m / 60)}h ago`;
}

// ---------- home / terrarium ----------
function renderHome(welcome) {
  const s = ctx.state;
  const label = debtLabel(s.debt);
  const t = s.history[todayKey()] || { scroll: 0 };
  app.innerHTML = `
    ${welcome ? `<div class="toast">Installed. Open Instagram, YouTube or Reddit: you'll get a 5-second pause first, then the Focus Debt widget.</div>` : ""}
    <div class="grid">
      <div class="stack">
        <section class="card">
          <div class="step-label">Your terrarium</div>
          <div class="scene">
            <div class="sun"></div><div class="cloud"></div><div class="cloud c2"></div>
            <div class="hill"></div><div class="hill b"></div>
            <div class="plantwrap">${plantSVG(s.plantStage, 200)}</div>
          </div>
          <div class="stats">
            <div class="stat"><b>${Math.floor(s.debt)}m</b><span>Focus Debt · ${label}</span></div>
            <div class="stat"><b>${s.plantStage}/${MAX_PLANT_STAGE}</b><span>Growth</span></div>
            <div class="stat"><b>${Math.round(t.scroll / 60)}m</b><span>Scrolled today</span></div>
          </div>
          <p class="sub" style="margin:14px 0">${s.plantStage >= MAX_PLANT_STAGE ? "Fully bloomed! Keep tending it." : "Every 15-minute task grows your plant."}</p>
          <div class="row"><button id="go">Pay off debt now</button></div>
          ${ctx.settings.demoMode ? `<div class="row" style="margin-top:14px">
            <button class="ghost" id="addDebt">Demo: add ${DEBT_THRESHOLD} min debt</button>
            <button class="ghost" id="resetAll">Demo: reset everything</button></div>` : ""}
        </section>
      </div>
      <div class="stack">
        <section class="card">
          <div class="step-label">🔥 Campfire</div>
          <h2>Friends who stepped away today</h2>
          <ul class="log">
            ${s.campfire.slice().sort((a, b) => b.at - a.at).map((e) =>
              `<li class="${e.you ? "you" : ""}"><span class="who">${esc(e.you ? ctx.settings.name : e.who)}</span> ${esc(e.text)}<time>${timeAgo(e.at)}</time></li>`).join("") || `<li class="empty">Nobody yet.</li>`}
          </ul>
          <p class="fire">Up to 5 friends. No leaderboard, no streak shaming.</p>
        </section>
        <section class="card" id="mirror-card"></section>
      </div>
    </div>`;
  $("#go").onclick = () => (location.hash = "#mixer");
  if ($("#addDebt")) $("#addDebt").onclick = async () => { s.debt += DEBT_THRESHOLD; await saveState(s); renderHome(); };
  if ($("#resetAll")) $("#resetAll").onclick = async () => {
    Object.assign(s, { debt: 0, plantStage: 0, tasksDone: 0, lockedUntil: 0, campfire: [], history: {}, gatePasses: {} });
    seedCampfire(); await saveState(s); await chrome.storage.local.remove("activeTask"); renderHome();
  };
  renderMirrorCard();
}

// ---------- Focus Mirror card ----------
function renderMirrorCard() {
  const el = $("#mirror-card");
  if (!el) return;
  if (!ctx.settings.camera) {
    el.innerHTML = `<div class="step-label">📷 Focus Mirror</div><h2>See your fatigue as it builds</h2>
      <p class="sub" style="margin-bottom:14px">Optional. Uses your camera, on this device only, to notice low blink rate, yawns, long eye closure and sitting too close. Nothing is recorded or uploaded.</p>
      <a href="#settings"><button class="ghost">Set up in Settings</button></a>`;
    return;
  }
  const draw = async () => {
    const c = await chrome.runtime.sendMessage({ type: "cam-read" }).catch(() => null);
    if (!el.isConnected) return clearInterval(mirrorHandle);
    let body;
    if (!c || !c.fresh) body = `<p class="sub">${c && c.error ? `<span class="err">${esc(c.error)}</span>` : "Starting camera…"}</p>`;
    else if (!c.present) body = `<p class="sub">No face in view. Debt is paused while you're away.</p>`;
    else body = `<div class="mirror">
        <div class="m ${c.lowBlink ? "warn" : ""}"><b>${c.blinksPerMin}/min</b><span>Blink rate (healthy: 12+)</span></div>
        <div class="m ${c.drowsy ? "bad" : ""}"><b>${c.drowsy ? "Drowsy" : "Alert"}</b><span>Eyes & yawns</span></div>
        <div class="m ${c.tooClose ? "warn" : ""}"><b>${c.tooClose ? "Too close" : "Good"}</b><span>Distance</span></div>
        <div class="m"><b>On</b><span>Frames stay on-device</span></div></div>`;
    el.innerHTML = `<div class="step-label"><span class="dot ${c && c.fresh ? "" : "off"}"></span>Focus Mirror · live</div><h2>How you look right now</h2>${body}`;
  };
  draw();
  mirrorHandle = setInterval(draw, 1500);
}

// ---------- insights ----------
function renderInsights() {
  const h = ctx.state.history;
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const k = todayKey(d);
    days.push({ k, label: d.toLocaleDateString([], { weekday: "short" }), ...(h[k] || { scroll: 0, paid: 0, tasks: 0, gateSkips: 0 }), today: i === 0 });
  }
  const max = Math.max(60, ...days.map((d) => d.scroll));
  const sum = (f) => days.reduce((a, d) => a + (d[f] || 0), 0);
  app.innerHTML = `
    <h1>Insights</h1><p class="sub">The last 7 days, kept only in this browser.</p>
    <div class="grid">
      <section class="card">
        <div class="step-label">Minutes on feed sites</div>
        <div class="bars">${days.map((d) => `<div class="bar"><em>${Math.round(d.scroll / 60)}</em><i class="${d.today ? "today" : ""}" style="height:${Math.max(3, (d.scroll / max) * 100)}%"></i><span>${d.label}</span></div>`).join("")}</div>
      </section>
      <section class="card">
        <div class="stats" style="grid-template-columns:1fr 1fr">
          <div class="stat"><b>${Math.round(sum("scroll") / 60)}m</b><span>Scrolled this week</span></div>
          <div class="stat"><b>${Math.round(sum("paid"))}m</b><span>Debt paid off</span></div>
          <div class="stat"><b>${sum("tasks")}</b><span>Micro-tasks done</span></div>
          <div class="stat"><b>${sum("gateSkips")}</b><span>Times you walked away at the pause</span></div>
        </div>
        <p class="sub" style="margin:16px 0 0;font-size:13px">${ctx.settings.demoMode ? "Demo Mode inflates scroll time, so these numbers are illustrative." : "Real time, measured only while a feed tab is in front."}</p>
      </section>
    </div>`;
}

// ---------- life mixer ----------
function chips(name, items, selected) {
  return `<div class="chips" data-group="${name}">${items.map((i) =>
    `<button class="chip ${i.id === selected ? "sel" : ""}" data-id="${i.id}">${i.emoji ? i.emoji + " " : ""}${i.label}</button>`).join("")}</div>`;
}

function renderMixer(params) {
  const debt = params.get("debt");
  const from = params.get("from");
  app.innerHTML = `
    <div class="card">
      ${debt ? `<span class="debt-pill">${debt} min of debt${from ? ` from ${esc(from)}` : ""}, paid off here</span>` : ""}
      <h1>Life Mixer</h1>
      <p class="sub">Three taps. We'll hand you exactly one thing to do for 15 minutes.</p>
      <div class="step-label">How are you feeling?</div>${chips("mood", MOODS, mixer.mood)}
      <div class="step-label">How much time do you have?</div>${chips("time", TIMES, mixer.time)}
      <div class="step-label">Pick a hobby</div>${chips("hobby", HOBBIES, mixer.hobby)}
      <button id="mix" ${mixer.mood && mixer.hobby ? "" : "disabled"}>Give me my task</button>
    </div>`;
  document.querySelectorAll(".chips").forEach((g) => g.addEventListener("click", (e) => {
    const b = e.target.closest(".chip"); if (!b) return;
    mixer[g.dataset.group] = b.dataset.id;
    renderMixer(params);
  }));
  $("#mix").onclick = async () => {
    $("#mix").disabled = true; $("#mix").textContent = "Mixing…";
    const task = await getTask(mixer, ctx.settings);
    await chrome.storage.local.set({ activeTask: { task, endsAt: null } });
    location.hash = "#task";
  };
}

// ---------- task + timer ----------
async function renderTask() {
  const { activeTask } = await chrome.storage.local.get("activeTask");
  if (!activeTask) { location.hash = "#mixer"; return; }
  const { task } = activeTask;
  const total = ctx.settings.demoMode ? DEMO_TASK_SECONDS : TASK_MINUTES * 60;
  app.innerHTML = `
    <div class="grid">
      <section class="card task">
        <div class="step-label">Your 15-minute task${task.source !== "bundled" ? " · AI" : ""}</div>
        <h1>${esc(task.title)}</h1>
        <p class="why">${esc(task.why || "")}</p>
        <ol>${task.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
        ${safeUrl(task.resource_url) ? `<a class="res" href="${esc(task.resource_url)}" target="_blank" rel="noopener">↗ ${esc(task.resource_label || "Open resource")}</a>` : ""}
      </section>
      <section class="card timer">
        <div class="step-label">Timer</div>
        <div class="clock" id="clock">${fmt(total)}</div>
        <div class="ring"><i id="ring"></i></div>
        <button id="start">Start</button>
        <div class="row" style="justify-content:center;margin-top:12px"><button class="ghost" id="swap">Different task</button></div>
        ${ctx.settings.demoMode ? `<p class="sub" style="margin-top:12px;font-size:12px">Demo Mode: timer is ${DEMO_TASK_SECONDS}s</p>` : ""}
      </section>
    </div>`;
  $("#swap").onclick = () => (location.hash = "#mixer");
  let endsAt = activeTask.endsAt;
  const tick = async () => {
    const left = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
    $("#clock").textContent = fmt(left);
    $("#ring").style.width = ((total - left) / total) * 100 + "%";
    if (left <= 0) { clearInterval(timerHandle); await complete(task); }
  };
  const begin = () => {
    $("#start").disabled = true; $("#start").textContent = "Focus…";
    timerHandle = setInterval(tick, 500); tick();
  };
  if (endsAt) begin();
  $("#start").onclick = async () => {
    endsAt = Date.now() + total * 1000;
    await chrome.storage.local.set({ activeTask: { task, endsAt } });
    begin();
  };
}

const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

async function complete(task) {
  const s = ctx.state;
  s.lastPaidDebt = Math.round(s.debt);
  s.debt = 0;
  s.snoozeUntilDebt = 0;
  s.tasksDone += 1;
  s.plantStage = Math.min(MAX_PLANT_STAGE, s.plantStage + 1);
  s.lastTask = task.title;
  bumpHistory(s, { paid: s.lastPaidDebt, tasks: 1 });
  s.campfire.push({ who: ctx.settings.name, you: true, at: Date.now(), text: `finished "${task.title}" 🌱` });
  await saveState(s);
  await chrome.storage.local.remove("activeTask");
  location.hash = "#done";
}

// ---------- done → Hard Stop ----------
function confetti() {
  const box = document.createElement("div"); box.className = "confetti";
  const cols = ["#5fae73", "#e9b949", "#f2a1b5", "#7ec0e8", "#e0614a"];
  for (let i = 0; i < 48; i++) {
    const p = document.createElement("i");
    p.style.cssText = `left:${Math.random() * 100}%;background:${cols[i % cols.length]};animation-delay:${Math.random() * 0.8}s;animation-duration:${2 + Math.random() * 1.5}s`;
    box.appendChild(p);
  }
  document.body.appendChild(box); setTimeout(() => box.remove(), 4500);
}

function renderDone() {
  const s = ctx.state;
  confetti();
  app.innerHTML = `
    <div class="card celebrate">
      <div class="step-label">Debt paid</div>
      <h1>Your plant grew 🌱</h1>
      <div class="pot drop">${plantSVG(s.plantStage, 220)}</div>
      <p class="sub">${s.lastPaidDebt} min of Focus Debt cleared. Your friends can see it at the Campfire.</p>
      <p class="fire">Going quiet in a moment…</p>
    </div>`;
  setTimeout(async () => {
    s.lockedUntil = ctx.settings.demoMode ? Date.now() + 10 * 60000 : nextMidnight();
    await saveState(s);
    location.hash = "#home";
    route();
  }, 3500);
}

// ---------- settings ----------
function renderSettings() {
  const st = ctx.settings;
  const opt = (id, title, desc, on) => `<label class="opt"><input type="checkbox" id="${id}" ${on ? "checked" : ""}><span><b>${title}</b><small>${desc}</small></span></label>`;
  app.innerHTML = `
    <h1>Settings</h1><p class="sub">Every technique is optional. Turn on what helps.</p>
    <div class="grid">
      <div class="stack">
        <section class="card">
          <h2>Anti-doomscroll techniques</h2>
          ${opt("gate", "Mindful pause", "A 5-second breath and a quick \"why are you here, and for how long?\" before a feed opens.", st.gate)}
          ${opt("fade", "Colour fade", "The page slowly drains to greyscale as your Focus Debt builds, so scrolling literally gets duller.", st.fade)}
          ${opt("breaks", "20-20-20 eye breaks", "While you're drifting, a nudge every 20 minutes to look 20 feet away for 20 seconds.", st.breaks)}
          ${opt("demo", "Demo Mode", "10 min of debt in ~20 seconds, a 15-second timer and a 10-minute Hard Stop.", st.demoMode)}
        </section>
        <section class="card">
          <h2>📷 Focus Mirror (camera)</h2>
          <div class="privacy"><b>Private by design.</b> Video is analysed on this device by a bundled model. Frames are never saved or sent anywhere, and only four numbers (blink rate, eyes closed, yawns, distance) are used. Chrome shows its camera indicator whenever it's on, and you can switch it off here at any time.</div>
          <div class="row"><button id="camToggle" class="${st.camera ? "danger" : ""}">${st.camera ? "Turn off camera" : "Allow camera and turn on"}</button></div>
          <div id="camMsg"></div>
          <p class="sub" style="margin:12px 0 0;font-size:13px">What it changes: low blink rate or drowsiness makes debt build faster, and debt pauses while you're not in front of the screen.</p>
        </section>
      </div>
      <div class="stack">
        <section class="card">
          <h2>You</h2>
          <label class="fld" for="name">Name on the Campfire</label><input type="text" id="name" value="${esc(st.name)}">
          <label class="fld" for="sites">Distraction sites (comma separated)</label><input type="text" id="sites" value="${esc(st.sites.join(", "))}">
        </section>
        <section class="card">
          <h2>Optional AI tasks</h2>
          <label class="fld" for="prov">Provider</label>
          <select id="prov">
            <option value="none" ${st.aiProvider === "none" ? "selected" : ""}>None (bundled tasks)</option>
            <option value="gemini" ${st.aiProvider === "gemini" ? "selected" : ""}>Gemini</option>
            <option value="openai" ${st.aiProvider === "openai" ? "selected" : ""}>OpenAI</option>
          </select>
          <label class="fld" for="key">API key (stored only in this browser)</label><input type="password" id="key" value="${esc(st.aiKey)}" autocomplete="off">
        </section>
        <div class="row"><button id="save">Save</button><button class="ghost" id="clear">Reset all data</button></div>
        <div id="msg"></div>
      </div>
    </div>`;

  $("#camToggle").onclick = async () => {
    const msg = $("#camMsg");
    msg.innerHTML = "";
    if (ctx.settings.camera) {
      ctx.settings.camera = false;
      await saveSettings(ctx.settings);
      await chrome.runtime.sendMessage({ type: "cam-sync" });
      return renderSettings();
    }
    try {
      // This is the moment Chrome asks for permission. The grant belongs to the extension and is remembered.
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch (e) {
      msg.innerHTML = `<p class="err">Camera access wasn't granted (${esc(e.name)}). Allow it from the camera icon in the address bar, then try again.</p>`;
      return;
    }
    ctx.settings.camera = true;
    await saveSettings(ctx.settings);
    await chrome.runtime.sendMessage({ type: "cam-sync" });
    renderSettings();
  };

  $("#save").onclick = async () => {
    ctx.settings = {
      ...ctx.settings,
      demoMode: $("#demo").checked,
      gate: $("#gate").checked,
      fade: $("#fade").checked,
      breaks: $("#breaks").checked,
      name: $("#name").value.trim() || "You",
      sites: $("#sites").value.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean),
      aiProvider: $("#prov").value,
      aiKey: $("#key").value.trim(),
    };
    if (!ctx.settings.sites.length) ctx.settings.sites = DEFAULT_SITES;
    await saveSettings(ctx.settings);
    $("#msg").innerHTML = `<div class="toast" style="margin-top:14px">Saved.</div>`;
  };
  $("#clear").onclick = async () => {
    await chrome.storage.local.clear();
    ctx.settings.camera = false;
    await chrome.runtime.sendMessage({ type: "cam-sync" });
    location.hash = "#home"; location.reload();
  };
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function safeUrl(u) { return /^https:\/\//i.test(u || ""); }

init();

// After the extension reloads itself on a code change, this page's context is dead: refresh it.
setInterval(() => { if (!chrome.runtime?.id) location.reload(); }, 1500);
