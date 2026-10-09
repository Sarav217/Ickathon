# Terrarium: Focus Debt (Chrome extension) v3

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

## v2.1: how tasks are verified, and exercises
- **Camera-checked exercises** (pick "Exercise (camera-checked)" in the Life Mixer): squats, jumping jacks, overhead reaches. A bundled pose model (`vendor/mediapipe/pose_landmarker_lite.task`) counts reps on-device; the task completes when the rep goal is reached (3 reps in Demo Mode). Rep logic is in `lib/reps.js` with tests in `tests/reps.test.mjs` (`node tests/reps.test.mjs`).
- **Other tasks** can't be seen by a camera (drawing, reading, a walk), so they use: a timer that **pauses while a feed site is the tab you're looking at**, plus an honest "Did you actually do it?" confirmation. Nothing is verified beyond that.
- More stretch/movement tasks (sun-salutation flow, dance break).

## v3: built after comparing three Web Store competitors (see `docs/competitors.md`)
- **Path-aware rules:** only feed pages count (YouTube Shorts and home, Instagram Reels/Explore/home, whole TikTok and Reddit...). YouTube lectures and Instagram DMs are left alone. Edit in Settings.
- **Shorts / Reels / TikTok counter:** each new item is counted as you swipe, adds a little debt, and has a daily limit (default 20).
- **Per-site daily minute budgets** in Settings.
- **Slimmer permissions:** no `<all_urls>`, no `tabs`. Only the listed feed sites; any extra site you add asks Chrome for just that site.
- **Popup:** click the toolbar icon for debt gauge, today's minutes, items and a 7-day sparkline.
- **Settings lock:** while you're in debt or on a Hard Stop, settings need a typed phrase and a 30-second wait (off in Demo Mode).
- **Chrome sync** for settings (never the API key).
- `PRIVACY.md` and `docs/STORE_LISTING.md` are ready for a Web Store submission.
- Tests: `node tests/rules.test.mjs`, `node tests/reps.test.mjs`.
