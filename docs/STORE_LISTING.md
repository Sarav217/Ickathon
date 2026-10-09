# Chrome Web Store listing (draft)

**Name:** Terrarium: Doomscroll Blocker & Focus Debt
**Summary (132 chars max):** Stop doomscrolling by replacing it: feed-aware limits, a mindful pause, one 15-minute task, and a Hard Stop until tomorrow.

**Description**
Every other blocker just nags. Terrarium catches you in the act, then gives you something better to do, and ends the session.
- Feed-aware: tracks YouTube Shorts and the home feed, Instagram Reels, TikTok, Reddit, X and Facebook, but leaves lectures, DMs and work alone.
- Counts Shorts, Reels and videos, with a daily limit and per-site minute budgets.
- Mindful pause: a 5-second breath and "why are you here, and for how long?" before a feed opens.
- Focus Debt: a live gauge from time, scroll speed and time of day. The page fades to greyscale as it builds.
- Pay it off: one 15-minute micro-task picked from your mood, time and hobby. Includes camera-checked squats, jumping jacks and reaches that are counted on your device.
- Hard Stop: once you've paid off, feeds stay closed until tomorrow. Settings lock while you're in debt so you can't talk yourself out of it.
- Optional Focus Mirror camera (off by default, on-device only): notices low blink rate and drowsiness.
- No account, no tracking, no ads. Settings sync across your Chrome browsers.

**Permission justifications**
- `storage`: save your sites, limits and progress.
- Host access to YouTube, Instagram, TikTok, Reddit, X/Twitter, Facebook: measure time and scrolling on feeds. Other sites only if you add them, one at a time, via an optional permission prompt.
- `scripting`: register the on-page widget for sites you add.
- `alarms`: development auto-reload and housekeeping.
- `offscreen`: run the optional camera analysis in the background without a visible window.
- Camera (runtime prompt, optional): Focus Mirror and exercise counting. Never recorded.

**Single purpose:** help the user stop doomscrolling.

**Assets still needed:** 1280x800 screenshots (see `screenshots/v3-0`), a 440x280 promo tile, a hosted copy of PRIVACY.md, a 128px icon (done).
**Note:** the package is about 20 MB because it bundles two small on-device vision models; store limit is far higher.
