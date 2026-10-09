// Life Mixer → one 15-minute micro-task.
// Uses an AI provider when the user adds a key; otherwise (or on any failure) picks from bundled tasks,
// so the demo never depends on Wi-Fi.

export const MOODS = [
  { id: "restless", label: "Restless", emoji: "⚡" },
  { id: "tired", label: "Tired", emoji: "🥱" },
  { id: "anxious", label: "Anxious", emoji: "🌧️" },
  { id: "bored", label: "Bored", emoji: "😐" },
  { id: "low", label: "Low", emoji: "🫥" },
];

export const TIMES = [
  { id: "15", label: "15 min" },
  { id: "30", label: "30 min" },
  { id: "60", label: "1 hour+" },
];

export const HOBBIES = [
  { id: "drawing", label: "Drawing", emoji: "✏️" },
  { id: "music", label: "Music", emoji: "🎸" },
  { id: "fitness", label: "Exercise (camera-checked)", emoji: "💪" },
  { id: "movement", label: "Stretch & move", emoji: "🧘" },
  { id: "reading", label: "Reading", emoji: "📖" },
  { id: "writing", label: "Writing", emoji: "🖋️" },
  { id: "coding", label: "Coding", emoji: "💻" },
  { id: "cooking", label: "Cooking", emoji: "🍳" },
  { id: "nature", label: "Nature", emoji: "🌿" },
];

const FALLBACK = [
  { hobby: "drawing", moods: ["anxious", "low", "tired"], title: "Draw the room from where you sit",
    why: "Slow observation pulls attention out of the feed and into what's in front of you.",
    steps: ["Grab any pen and paper", "Pick one corner of the room", "Draw only the outlines for 10 minutes, no erasing", "Spend the last 5 minutes adding shadows"],
    resource_url: "https://drawabox.com/lesson/1", resource_label: "Drawabox lesson 1: lines and observation" },
  { hobby: "drawing", moods: ["restless", "bored"], title: "30-second gesture sprint",
    why: "Fast, timed sketches burn off restless energy and leave something to show for it.",
    steps: ["Open a pose reference site", "Sketch one pose every 30 seconds", "Do 20 poses, then circle your favourite three"],
    resource_url: "https://line-of-action.com/", resource_label: "Line of Action: timed pose references" },
  { hobby: "music", moods: ["restless", "bored"], title: "Learn one new chord change",
    why: "A tiny, clear win: by the end you'll switch between two chords without looking.",
    steps: ["Pick two chords you don't know yet", "Practise switching slowly for 5 minutes", "Strum along to a slow song for 10 minutes"],
    resource_url: "https://www.justinguitar.com/", resource_label: "JustinGuitar beginner lessons" },
  { hobby: "music", moods: ["anxious", "low", "tired"], title: "One album side, eyes closed",
    why: "Deep listening is the opposite of skipping clips every 8 seconds.",
    steps: ["Pick an album you've never heard all the way through", "Phone face down, headphones on", "Listen to 15 minutes without skipping", "Write one line about what you noticed"],
    resource_url: "https://www.bbc.co.uk/sounds/category/music", resource_label: "BBC Sounds: full mixes and albums" },
  { hobby: "movement", moods: ["tired", "low", "anxious"], title: "15-minute gentle stretch",
    why: "Scrolling locks your neck and shoulders; this undoes exactly that.",
    steps: ["Stand up and roll your shoulders 10 times", "Follow the neck and back stretch video", "Finish with 2 minutes of slow breathing"],
    resource_url: "https://www.nhs.uk/live-well/exercise/flexibility-exercises/", resource_label: "NHS flexibility exercises" },
  { hobby: "movement", moods: ["restless", "bored"], title: "Bodyweight mini-circuit",
    why: "Restless energy wants an outlet. Three rounds and you'll feel reset.",
    steps: ["10 squats", "10 push-ups (knees are fine)", "30-second plank", "Rest 1 minute, repeat 3 times"],
    resource_url: "https://www.nhs.uk/live-well/exercise/strength-exercises/", resource_label: "NHS strength exercises" },
  { hobby: "movement", moods: ["anxious", "tired", "low", "restless"], title: "Sun-salutation flow, three rounds",
    why: "Slow, linked movement settles a busy mind and loosens a stiff back.",
    steps: ["Stand tall, arms up, fold forward", "Step back to a plank, lower, then cobra", "Push back to downward dog, walk forward, rise", "Repeat three rounds, five slow breaths each"],
    resource_url: "https://www.nhs.uk/live-well/exercise/flexibility-exercises/", resource_label: "NHS flexibility exercises" },
  { hobby: "movement", moods: ["bored", "restless", "low"], title: "Dance break: three songs",
    why: "Moving to music is the quickest mood lift there is, and nobody is watching.",
    steps: ["Pick three songs you love", "Phone down, volume up", "Dance until all three are done"],
    resource_url: "https://www.bbc.co.uk/sounds/category/music", resource_label: "BBC Sounds: music" },
  { hobby: "reading", moods: ["anxious", "low", "tired", "bored", "restless"], title: "Read one short story",
    why: "One complete story beats a hundred half-watched clips.",
    steps: ["Pick a short story under 15 minutes", "Read it start to finish", "Write down the one line you liked most"],
    resource_url: "https://www.gutenberg.org/ebooks/bookshelf/634", resource_label: "Project Gutenberg short stories" },
  { hobby: "writing", moods: ["anxious", "low"], title: "Brain dump, then one next step",
    why: "Anxiety loves vagueness. Writing it down makes it smaller.",
    steps: ["Set the timer and write everything on your mind for 10 minutes", "Circle one thing you can act on", "Write the very next step for it"],
    resource_url: "https://www.ted.com/talks/tim_ferriss_why_you_should_define_your_fears_instead_of_your_goals", resource_label: "Tim Ferriss: define your fears" },
  { hobby: "writing", moods: ["bored", "restless", "tired"], title: "Write a 100-word story",
    why: "A hard limit makes it a puzzle, and you finish with a complete piece.",
    steps: ["Pick a prompt", "Draft freely for 8 minutes", "Cut it to exactly 100 words"],
    resource_url: "https://blog.reedsy.com/creative-writing-prompts/", resource_label: "Reedsy writing prompts" },
  { hobby: "coding", moods: ["bored", "restless"], title: "Solve one small puzzle",
    why: "A bounded problem gives the same 'just one more' itch, with a real payoff.",
    steps: ["Open an easy puzzle", "Solve it in any language", "Read one other person's solution and note one trick"],
    resource_url: "https://adventofcode.com/2023/day/1", resource_label: "Advent of Code, day 1" },
  { hobby: "coding", moods: ["tired", "low", "anxious"], title: "Make one tiny web toy",
    why: "Low stakes, instant feedback, and something you made yourself.",
    steps: ["Open a blank CodePen", "Make a button that changes the background colour", "Add one thing you didn't plan to"],
    resource_url: "https://codepen.io/pen/", resource_label: "Blank CodePen" },
  { hobby: "cooking", moods: ["low", "tired", "bored", "anxious", "restless"], title: "Make a proper snack",
    why: "Hands busy, senses on, and you get to eat the result.",
    steps: ["Pick a 10-minute recipe with what you have", "Cook it without your phone", "Eat it at a table, not a screen"],
    resource_url: "https://www.bbcgoodfood.com/recipes/collection/quick-snack-recipes", resource_label: "Quick snack recipes" },
  { hobby: "nature", moods: ["anxious", "low", "tired"], title: "Phone-free walk around the block",
    why: "Daylight and movement are the fastest reset for a fried attention span.",
    steps: ["Leave the phone at home (or on airplane mode)", "Walk for 12 minutes", "Notice five things you hadn't seen before"],
    resource_url: "https://www.health.harvard.edu/staying-healthy/walking-your-steps-to-health", resource_label: "Why short walks help" },
  { hobby: "nature", moods: ["bored", "restless"], title: "Identify three plants or birds",
    why: "Turns a walk into a quest with a finish line.",
    steps: ["Step outside or to a window", "Photograph three living things", "Look each one up and note its name"],
    resource_url: "https://www.inaturalist.org/", resource_label: "iNaturalist" },
];

// Physical tasks the camera can verify (counted on-device from pose landmarks, see lib/reps.js).
const PHYSICAL = [
  { exercise: "squat", reps: 10, moods: ["tired", "low", "bored"], title: "10 slow squats",
    why: "Big muscles, fast reset: your legs wake your whole brain up.",
    steps: ["Stand 2 metres from the screen so your whole body is in view", "Feet shoulder-width apart", "Sink until your thighs are near parallel, then stand tall", "The camera counts each rep for you"] },
  { exercise: "jacks", reps: 20, moods: ["restless", "anxious", "bored"], title: "20 jumping jacks",
    why: "Restless or anxious energy needs somewhere to go. This is a fast way to spend it.",
    steps: ["Stand 2 metres from the screen so your whole body is in view", "Arms overhead and feet wide, then back together", "Keep a steady rhythm", "The camera counts each rep for you"] },
  { exercise: "reach", reps: 12, moods: ["tired", "low", "anxious", "restless", "bored"], title: "12 overhead reaches",
    why: "Scrolling hunches your neck and shoulders. This opens them back up.",
    steps: ["Sit or stand so your head, shoulders and hands are in view", "Reach both hands high above your head", "Lower them back to your shoulders", "The camera counts each rep for you"] },
];

export function pickPhysical(mood) {
  const match = PHYSICAL.filter((t) => t.moods.includes(mood));
  const t = (match.length ? match : PHYSICAL)[Math.floor(Math.random() * (match.length || PHYSICAL.length))];
  return { ...t, duration: 15, source: "bundled", verify: { type: "pose", exercise: t.exercise, reps: t.reps } };
}

export function pickFallback(mood, hobby) {
  if (hobby === "fitness") return pickPhysical(mood);
  const byHobby = FALLBACK.filter((t) => t.hobby === hobby);
  const pool = byHobby.length ? byHobby : FALLBACK;
  const match = pool.filter((t) => t.moods.includes(mood));
  const choices = match.length ? match : pool;
  const t = choices[Math.floor(Math.random() * choices.length)];
  return { ...t, duration: 15, source: "bundled" };
}

function prompt({ mood, time, hobby, note }) {
  return `You help a young person stop doomscrolling. They just paid off their "Focus Debt" and want ONE micro-task.
Mood: ${mood}. Time available: ${time} minutes. Hobby/interest: ${hobby}${note ? `. Extra context: ${note}` : ""}.
Return ONLY JSON: {"title": string (max 8 words), "why": string (one sentence, why this fits their mood),
"steps": string[] (3-4 short imperative steps), "resource_url": string (a real, well-known https URL),
"resource_label": string, "duration": 15}. The task must take exactly 15 minutes, need no purchases, and work offline once started. Never link to social media or video-feed sites (YouTube, Instagram, TikTok, Reddit, X).`;
}

async function callGemini(key, model, body) {
  const m = model || "gemini-2.5-flash";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: body }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.9 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  return data.candidates[0].content.parts[0].text;
}

async function callOpenAI(key, model, body) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: model || "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: body }],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

export async function getTask(input, settings) {
  if (input.hobby === "fitness") return pickPhysical(input.mood); // verified exercises are bundled so the camera knows what to count
  if (settings.aiProvider !== "none" && settings.aiKey) {
    try {
      const call = settings.aiProvider === "gemini" ? callGemini : callOpenAI;
      const text = await Promise.race([
        call(settings.aiKey, settings.aiModel, prompt(input)),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 8000)),
      ]);
      const t = JSON.parse(text);
      if (t.title && Array.isArray(t.steps) && t.steps.length) {
        return { ...t, duration: 15, source: settings.aiProvider };
      }
    } catch (e) {
      console.warn("AI task failed, using bundled task:", e);
    }
  }
  return pickFallback(input.mood, input.hobby);
}
