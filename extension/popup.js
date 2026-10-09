import { todayKey } from "./lib/state.js";

const $ = (s) => document.querySelector(s);
const C = 201.06;
const v = await chrome.runtime.sendMessage({ type: "popup" });
const frac = Math.min(1, v.debt / v.threshold);
const state = v.label.toLowerCase();
$("#num").textContent = Math.floor(v.debt);
$("#lbl").textContent = v.label;
$("#sub").textContent = state === "calm" ? "minutes owed" : state === "drifting" ? "slipping a little" : "time to pay it off";
$("#arc").style.strokeDashoffset = C * (1 - frac);
$("#arc").style.stroke = state === "drained" ? "#e0614a" : state === "drifting" ? "#e9b949" : "#5fae73";
const t = v.history[todayKey()] || { scroll: 0, items: 0 };
$("#today").textContent = Math.round(t.scroll / 60) + "m";
$("#items").textContent = t.items || 0;
$("#plant").textContent = `${v.plantStage}/4`;
const days = [];
for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push({ k: todayKey(d), today: i === 0 }); }
const max = Math.max(60, ...days.map((d) => (v.history[d.k] || {}).scroll || 0));
$("#spark").innerHTML = days.map((d) => `<i class="${d.today ? "today" : ""}" style="height:${Math.max(8, (((v.history[d.k] || {}).scroll || 0) / max) * 100)}%"></i>`).join("");
if (v.locked) { $("#lock").hidden = false; $("#pay").hidden = true; }
const openDash = (hash = "") => { chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html" + hash) }); window.close(); };
$("#pay").onclick = () => openDash("#mixer");
$("#open").onclick = (e) => { e.preventDefault(); openDash("#home"); };
