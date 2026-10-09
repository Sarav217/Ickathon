# EarnYourScroll: Health Tasks That Unlock Your Feed
*Phantom Troupe · Ick-a-thon 2026 · working name, change it if you like*

## The Ick (Slide 2)
- You open your phone "for 5 minutes" and lose an hour or more to reels and negative news.
- This leaves you tired, anxious, sleeping badly and less productive.
- It mostly affects students and young adults, especially at night and between classes.
- App blockers fail because users simply bypass them.

## Our Take (Slide 3)
**Insight:** Scrolling is never "earned." It costs nothing, so it never stops.

**Key idea:** Scrolling stays locked until you complete the right task: a short exercise, quiz or game that is personalized to your health and approved by a mentor.

**Model: B2C platform with three parties**
```
Pharmacy / Hospital  ──►  EarnYourScroll  ◄──  Mentor / Guide
   (partner, refers users)    (software)         (assigns tasks)
                                  ▲
                                  │
                                User
```
- **Pharmacies and hospitals** partner with the platform, refer users and verify mentors.
- **Mentors and guides** (physiotherapists, fitness trainers, wellness coaches) monitor users and assign tasks that suit each user's health condition.
- **Users** complete a task to unlock a set amount of scroll time.

**Task examples by condition**
- Eye strain: the 20-20-20 eye exercise, blink drills and an eye-health diet tip (for example, foods rich in Vitamin A such as carrots), checked with the camera.
- Neck or back pain from phone posture: stretches checked with camera pose detection.
- Low activity: a step goal tracked by the phone's sensors.
- Stress: a 5-minute breathing exercise.

**AI fallback when no mentor is assigned:** AI learns which kinds of reels the user enjoys (for example cricket, music or science) and automatically creates matching quizzes, mini-games and exercises. A cricket fan, say, gets a cricket quiz plus 10 squats.

**Result:** Less scrolling, better physical health and better mental health, because the time to scroll is earned instead of endless.

## Technical Implementation (Slide 4)
- **App:** Flutter (Android first).
- **Locking the feed:** Android Accessibility Service or UsageStatsManager detects when Instagram or YouTube opens and shows a lock screen until a task is done.
- **Checking the task was done:** MediaPipe pose and face detection on the camera, which runs on the phone, plus step and motion sensors.
- **AI personalization:** reel interests come from user-selected topics and watch-time categories. An AI model generates quizzes and games from these interests as JSON.
- **Backend:** Firebase (Auth, Firestore, Cloud Messaging) with a mentor dashboard on the web.
- **Workflow:** User opens a reel app → app is locked → task assigned (by a mentor, or by AI if none) → camera or sensors check it → scroll time unlocked → progress shared with the mentor.
- **Privacy:** camera checks run on the phone and are never uploaded, and health data is shared only with the user's consent.

## Project Screenshots (Slide 5)
1. Lock screen over Instagram that says "Complete your task to unlock 15 min."
2. A task card, such as an eye exercise, with the camera check running.
3. The AI-generated quiz built from the user's reel interests.
4. The mentor dashboard showing users, their conditions and assigned tasks.
5. Progress screen with tasks done, minutes earned and a health streak.

## Points to watch
- **Keep doomscrolling as the headline.** Judges are scoring the scrolling ick, so present health as *how* the user unlocks the feed, not as a separate health app.
- Call the tasks **wellness tips**, not treatment. The app doesn't diagnose; mentors and doctors handle medical advice.
- The model is really **B2B2C**: hospitals and pharmacies are partners, and users are the customers. Revenue could come from a premium mentor plan or partner subscriptions.
