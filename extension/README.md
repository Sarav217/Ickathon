# Terrarium: Focus Debt (Chrome extension)

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
