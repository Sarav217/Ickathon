# Terrarium: Focus Debt (Chrome extension) v2

Catches doomscrolling as it happens, shows your Focus Debt, sends you to a Terrarium for one 15-minute micro-task, then locks the feeds until tomorrow.

## Install (30 seconds)
1. Download/copy this `extension/` folder to your computer.
2. Open `chrome://extensions` and switch on **Developer mode** (top right).
3. Click **Load unpacked** and pick the `extension/` folder. The Terrarium opens.
4. Visit reddit.com, youtube.com, instagram.com, tiktok.com, x.com or facebook.com and scroll.

## Demo Mode (on by default)
- Debt builds 30x faster: 10 min of debt in about 20 seconds of scrolling.
- Task timer is 15 seconds. The Hard Stop lasts 10 minutes (**Demo: reset lock** button on the lockout screen).
- Turn it off in **Settings** for real thresholds (10 min of debt, 15-min timer, lock until midnight).
- Home has **Demo: add 10 min debt** and **Demo: reset everything** buttons.

## How Focus Debt works
`debt += seconds × (1 + scrollIntensity) × nightMultiplier`
- scrollIntensity: pixels scrolled per second, normalised (fast and continuous = zoning out)
- nightMultiplier: 1.5 between 23:00 and 05:00
- Calm < 5 min, Drifting 5-10 min, Drained 10+ min

## Optional AI
Settings → pick Gemini or OpenAI and paste a key (stored only in this browser). Without a key, or if the call fails/times out (8 s), it uses 14 bundled tasks, so the demo never breaks.

## Notes
- Campfire is simulated locally (3 seeded friends plus you). A shared backend (e.g. Supabase realtime) would replace `seedCampfire()` in `dashboard.js`.
- Everything stays in `chrome.storage.local`; nothing is sent anywhere except the optional AI call.

## Live updates while developing
Unpacked installs auto-reload within a few seconds when any extension file changes (`dev-reload.js`). Load the folder once; after that, edits or `git pull` in that folder show up without touching `chrome://extensions`. Open dashboard tabs need a manual refresh.

## v2: anti-doomscroll techniques (all optional, Settings)
- **Mindful pause**: a 5-second breath, then "why are you here and for how long?" before a feed opens. Walking away is counted in Insights.
- **Colour fade**: the page drains to greyscale as debt builds, so scrolling gets duller.
- **20-20-20 eye breaks**: nudges while you're drifting.
- **Focus Mirror (camera, opt-in)**: runs MediaPipe Face Landmarker bundled in `vendor/mediapipe/`, in an offscreen document, fully on-device. Frames are never stored or sent; only blink rate, eyes closed, yawns and face distance are used. Low blink rate or drowsiness makes debt build faster; debt pauses when you're away. Chrome asks for camera permission once, when you click "Allow camera and turn on" in Settings. Turn it off there at any time.
- **Insights**: 7-day scroll minutes, debt paid, tasks done, times you walked away.
- Redesigned widget (gauge ring), alert, Terrarium scene, Hard Stop.
