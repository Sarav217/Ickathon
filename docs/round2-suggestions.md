# Round 2 Suggestions: Phantom Troupe

**Ick:** Doomscrolling eats young people's free time, and there's no easy way out.
**Current idea:** an AI Hobby Coach that suggests a replacement hobby, plus a scroll tracker, an Arena leaderboard with friends, and gentle nudges.

---

## 1. The main gap to fix

Hobby apps, streaks and leaderboards are common, and the template asks for an idea that is **"unique and novel."** What would make yours stand out is acting **at the moment the urge to scroll hits**, not only in a separate app the user has to remember to open. The strongest pitch is:

> **"We don't block the scroll. We swap it."** At the exact moment you reach for Instagram, you get a 10-minute hobby task that's ready to start.

All of the ideas below build on that.

---

## 2. New or improved solution ideas

### A. Scroll Swap: catch the user at the moment of the urge (recommended core feature)
- When the user opens a feed app (Instagram, YouTube Shorts, Reels), a 5-second card appears before the feed loads: *"Opening Instagram for the 4th time tonight. Swap for 10 min of sketching?"*
- It gives two buttons: **Swap** (starts the hobby micro-task timer) and **Scroll anyway** (no guilt, just logged).
- Why it's better than blocking: the user keeps control, so there's nothing to bypass. It adds a moment of friction plus a ready alternative.
- How to build it: Android **UsageStatsManager** with a foreground service, or an Accessibility Service to detect when an app opens. On iOS, Shortcuts "App opened" automations can stand in for the demo.

### B. Mood-aware swaps: treat the cause, not just the habit
- People doomscroll because they're bored, anxious, lonely or avoiding something. A one-tap emoji check-in on the Swap card ("How are you feeling?") lets the AI pick a fitting activity:
  - Anxious: 5-minute doodle or breathing walk
  - Bored: a quick skill drill (a guitar chord, a Duolingo-style micro-lesson)
  - Lonely: ping a friend for a co-hobby session (see C)
- This links the idea to youth mental health, which WIE judges are likely to care about.

### C. Buddy "Swap with me": a live co-hobby session
- Tap to invite a friend to a 15-minute session where you both do your hobbies at the same time ("body doubling"), each with a live timer and a photo of what you made at the end.
- This makes the Arena *live* instead of only a leaderboard, and it's harder to skip when someone is waiting for you.

### D. Feed Flip: retrain the algorithm instead of fighting it
- A guided 10-minute "feed reset": the app takes the user's chosen hobby and walks them through following, liking and saving hobby-related creators and tutorials, and marking negative or news content as "Not interested."
- Even when they *do* scroll, the feed now teaches the hobby. Few teams will think of this angle.

### E. Night Mode ritual: aim at the worst time of day
- Your own persona scrolls at night, so make bedtime a dedicated flow. At the user's usual scroll time, the phone suggests a wind-down: a grayscale screen tip, a 10-minute offline hobby card (journal, sketch, read), and a sleep goal.
- Track a "slept before 12" streak alongside "hours reclaimed."

### F. Show what the time could have been
- Convert scroll time into a visible trade-off: *"Your 2h 40m today = 3 guitar chords or 1 finished sketch."*
- At week's end, show a Reclaimed Reel: an auto-made recap of photos of what they created instead of scrolling, which can be shared to the same social apps.

### G. Campus Circles: move it offline
- Connect hobbies to real SSN clubs, events and nearby groups ("3 people from your college picked photography, and there's a photowalk Saturday").
- This gives social and community impact, plus a believable plan to launch on one campus first.

### H. Low-stakes commitment points
- Users set a daily scroll budget. Staying under it earns points, and going over gives points to a friend or a donation pool. This adds accountability without any blocking.

**Suggested final concept:** use **A (Scroll Swap)** as the hero feature, **B + C** as the differentiators, and keep the Hobby Coach and Arena as supporting features. F gives you the headline metric. D, E, G and H work well as "future scope" bullets.

---

## 3. Fitting it into the Round 2 template

The Round 2 template has **different sections** from your current document. "Why is it an Ick", "Feasibility" and "Impact" no longer have their own slides. Use 5 content slides plus the title slide (the limit is 7 including the title), and delete the instructions slide. Don't rename the template's headings or pointers; rule 5 doesn't allow it.

### Slide 1: Title
- Fill in the problem statement title, team name and members. Use the same spelling of names everywhere (the PDF has "S.A.Sarvajit").

### Slide 2: The Assigned Ick
- Keep your 4 existing bullets; they're good.
- **Add one real statistic with its source.** Your own draft flags this. Pick one you can verify and cite it on the slide, for example a Pew Research Center teen survey on being online "almost constantly," a Common Sense Media census of teen daily screen time, or an Indian survey on youth screen time if you can find one. Check the figure against the original source before using it.
- Add a small visual: a clock showing "5 min planned → 60+ min lost."

### Slide 3: Our Take on the Ick
- **Insight, in one line:** "Blockers fail because they take something away without giving anything back. The urge wins in the first 5 seconds."
- **Focus:** the moment of the urge, plus what drives it (boredom or anxiety), especially at night.
- **Key idea:** "Don't block the scroll, swap it": Scroll Swap, then a mood-aware 10-minute hobby task, then progress with friends.
- Bring in the Priya persona here as a mini storyboard: 11 pm, opens Reels, gets a Swap card, sketches for 10 minutes, keeps her streak.
- A small **comparison table** shows novelty quickly:

| | App blockers / timers | Habit apps | **Ours** |
|---|---|---|---|
| Acts at the moment of the urge | ✓ (blocks) | ✗ | ✓ (swaps) |
| Gives an alternative | ✗ | partly | ✓ AI-picked hobby |
| Easy to bypass | Yes | n/a | Nothing to bypass |
| Social accountability | ✗ | some | ✓ live co-sessions |

### Slide 4: Technical Implementation
This slide is **empty in your current draft**, so it needs the most work. Suggested stack (all free tier):
- **App:** Flutter or React Native (Android first)
- **Detecting app opens and screen time:** Android `UsageStatsManager` with a foreground service. This replaces the self-reported entry in your feasibility slide and makes the project much stronger technically.
- **AI Hobby Coach:** an LLM API (Gemini or Claude free tier) with a structured prompt that takes interests, time, budget, solo or social, and mood, and returns 3 hobbies plus a 15-minute starter task as JSON.
- **Backend:** Firebase Auth and Firestore (users, streaks, Arena), Cloud Functions for weekly leaderboard resets, FCM for nudges at peak times.
- **Workflow diagram (draw it, don't write it):**
  `Onboarding quiz → AI Coach → 3 hobbies → User opens feed app → Swap card + mood tap → 10-min task timer → Log "hours reclaimed" → Arena / friends`
- Add one line each on **privacy** (screen-time data stays on the phone, only totals are shared, private mode) and **retention** (streaks, live co-sessions, weekly resets). This is where your feasibility points go now.

### Slide 5: Project Screenshots
Round 2 expects a **working prototype**, so plan your build around these 5 or 6 screens:
1. Onboarding quiz (chat-style)
2. The 3 hobby cards with the AI's reasons
3. **The Scroll Swap card** over Instagram (your hero shot)
4. The 10-minute starter task timer
5. Dashboard with "hours reclaimed" and streak
6. Arena leaderboard or live co-session

Show them as a left-to-right user flow with arrows and short captions, not one big grid. If you can, add a QR code to a demo video.

### Impact (no slide of its own)
- Put 2 or 3 impact bullets at the bottom of slide 3, or as a strip on slide 5, using "hours reclaimed" as the headline metric.

---

## 4. General polish
- Use bullets, icons and diagrams. No paragraphs (instruction 2).
- Use one consistent color for the product and give it a name (for example *SwapIt*, *Unscroll* or *ReClaim*). A name makes it easier to remember.
- Export to PDF and check that fonts and diagrams survived the conversion before uploading.
- The deck is worth **50% of the final score**, so the prototype screenshots and the tech diagram matter most.
