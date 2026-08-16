/* ============================================================
   PROGRAM — the current training block. Unlike routines.js this file is MEANT
   to churn: it is rewritten every Sunday from that week's export.

   PROGRAM fields:
     block     name of the current block
     week      which week of the block this file programs
     weeks     how many weeks the block runs
     start     ISO date the block began (drives the week counter on home)
     focus     one line: what this block is trying to buy
     note      the block's rationale and its substitution rules, shown on
               Upcoming. NOT the day-by-day plan — that lives in `schedule`
               below and there is exactly one source of truth for it.
     mas       maximal aerobic speed in m/s, used to set interval distances.
               ALWAYS record `source` — "assumed" vs "tested" — so a guess is
               never later mistaken for a measurement.
     schedule  the calendar: one entry per day, in date order.
                 sid   unique and stable WITHIN the block. It is what an in-app
                       drag writes its override against and what a logged
                       session records, so the same workout on two days is two
                       independently tickable slots.
                 date  local "YYYY-MM-DD"
                 w     a workout id, or omit it and set `rest:true`
     workouts  the sessions

   Workout fields:
     id        unique and STABLE — the log is keyed to it
     name, accent, sub
     short     compact name for the daily summary line on Upcoming
     cat       "strength" | "cardio" | "check". Drives grouping. Default strength.
     sched     {freq:"daily"} → due every day, outside the dated calendar
     unit      what one exercise is called on the card — "lift" (default),
               "drill" on running days, "check" on the check-in
     freeform  true → starts empty, you add exercises as you go
     exercises the movements, in order

   Exercise fields:
     name      display name — ALSO the key history matches on across sessions.
               "400 m rep" appears in four different track sessions on purpose:
               that is how the PREV column carries the last one forward.
     sets      how many rows to lay out
     fields    which columns this exercise records. Omit for lifting
               (weight/reps/rpe). Runs use ["distance","duration","rpe"].
     labels    per-field column re-heading, e.g. {rpe:"PAIN"}
     phs       per-field placeholder override
     target    prescription line
     rest      seconds of rest counted down after each set
     note      coaching line shown under the exercise
     warmup    true → excluded from the working-set count on the card

   TWO STANDING RULES FOR THIS FILE:

   1. NO WEIGHT FIELD, NO CALORIE FIELD, ANYWHERE. Not on the check-in, not in
      a note, not as a passing remark in a `sub`. High-burn work is programmed;
      it is never labelled, counted or displayed. This is a deliberate design
      constraint, not an oversight — do not "helpfully" add tracking.

   2. DO NOT DOUBLE-COUNT THE MORNING ROUTINES. routines.js already loads the
      calf (stretching), the foot and the quad isometrically every day. The
      lifting days load the calf and the quad heavy. Replace or leave alone —
      never stack. The one thing deliberately NOT in the morning routine is
      Carolyn's calf raises off an edge, because they belong under load; they
      live on S1 instead.
   ============================================================ */

const PROGRAM = {
  block: "Mile — August to mid-September",
  week: 1,
  weeks: 5,
  start: "2026-08-11",

  focus: "Five weeks to a faster mile, off a left knee that has never been asked for this. Everything below serves the mile: the lifting is there to make the leg tolerate the running, and the running is deliberately only three days a week so the tendon and the heel get a say.",

  note: "THE MILE IS TESTED ONCE, ON TUE 15 SEP, AND NOT BEFORE. Every pace here is derived from an assumed MAS of 3.0 m/s — a discount off the 3.4 measured with Paul in 2024 — so treat the numbers as a starting guess and the effort words as the real instruction. If week one's intervals feel easy, the assumption was too conservative and it gets corrected on Sunday, not by you going harder on the day.\n\nSUBSTITUTIONS. The Wednesday spin slot can be spin or any low-impact class you like — its job is aerobic work with nothing landing on the knee. The yoga slots are yoga. Barry's is a treadmill-interval session and therefore COUNTS AS A RUN DAY: if you do Barry's, that is the day's running, not an extra on top of it. Three running days a week is the ceiling and it is the number that keeps the heel quiet.\n\nTWO-A-DAYS are fine on a lifting day — add the class in the evening. They are not fine on a track day; the track session is the point of that day and nothing should be sitting on top of it.\n\nIF SOMETHING HURTS. First-step foot pain and left knee pain are on the check-in every morning because they are the steering wheel. Two bad mornings in a row is a note in the app, not a heroic week. Nothing here is worth the six weeks after it.",

  mas: { value: 3.0, units: "m/s", source: "assumed", date: "2026-08-10",
         basis: "3.4 m/s measured with Paul Read mid-2024. Discounted for two years, an IVF year and a long way off run training. Correct from week 1's intervals — do not test." },

  schedule: [
    /* Week 1 — re-entry. Starts on a Tuesday and opens with a lift, not a run:
       the knee gets a look at load before it gets a look at the track. */
    { sid:"d01", date:"2026-08-11", w:"s1"     },
    { sid:"d02", date:"2026-08-12", w:"c1"     },
    { sid:"d03", date:"2026-08-13", w:"spin"   },
    { sid:"d04", date:"2026-08-14", w:"s2"     },
    { sid:"d05", date:"2026-08-15", w:"ceasy"  },
    { sid:"d06", date:"2026-08-16", rest:true  },

    /* Week 2 — the full MAS session, the one from Paul's cards. */
    { sid:"d07", date:"2026-08-17", w:"s1"     },
    { sid:"d08", date:"2026-08-18", w:"c2"     },
    { sid:"d09", date:"2026-08-19", w:"spin"   },
    { sid:"d10", date:"2026-08-20", w:"s2"     },
    { sid:"d11", date:"2026-08-21", w:"yoga"   },
    { sid:"d12", date:"2026-08-22", w:"ceasy"  },
    { sid:"d13", date:"2026-08-23", rest:true  },

    /* Week 3 — 400s arrive, and so do the jumps. */
    { sid:"d14", date:"2026-08-24", w:"s1b"    },
    { sid:"d15", date:"2026-08-25", w:"c3"     },
    { sid:"d16", date:"2026-08-26", w:"spin"   },
    { sid:"d17", date:"2026-08-27", w:"s2"     },
    { sid:"d18", date:"2026-08-28", w:"yoga"   },
    { sid:"d19", date:"2026-08-29", w:"ctempo" },
    { sid:"d20", date:"2026-08-30", rest:true  },

    /* Week 4 — peak. The hardest week of the block. */
    { sid:"d21", date:"2026-08-31", w:"s1b"    },
    { sid:"d22", date:"2026-09-01", w:"c4"     },
    { sid:"d23", date:"2026-09-02", w:"spin"   },
    { sid:"d24", date:"2026-09-03", w:"s2"     },
    { sid:"d25", date:"2026-09-04", w:"barrys" },
    { sid:"d26", date:"2026-09-05", w:"ctempo" },
    { sid:"d27", date:"2026-09-06", rest:true  },

    /* Week 5 — sharpen, then get out of the way. */
    { sid:"d28", date:"2026-09-07", w:"s1b"    },
    { sid:"d29", date:"2026-09-08", w:"c5"     },
    { sid:"d30", date:"2026-09-09", w:"spin"   },
    { sid:"d31", date:"2026-09-10", w:"s2"     },
    { sid:"d32", date:"2026-09-11", w:"yoga"   },
    { sid:"d33", date:"2026-09-12", w:"ceasy"  },
    { sid:"d34", date:"2026-09-13", w:"yoga"   },
    { sid:"d35", date:"2026-09-14", rest:true  },
    { sid:"d36", date:"2026-09-15", w:"ctest"  }
  ],

  workouts: [

  /* ---------- daily ---------- */
  {
    id:"checkin", name:"Morning check-in", short:"Check-in",
    accent:"#C9A227", unit:"check", cat:"check", sched:{freq:"daily"},
    sub:"Ten seconds, before anything else. Four dials, one per thing Carolyn is watching. This is what next Sunday's programming actually reads — a week of quiet 2s and a week of quiet 6s get very different blocks.",
    exercises:[
      { name:"Left knee", sets:1, fields:["rpe"], labels:{rpe:"PAIN"}, phs:{rpe:"0-10"},
        target:"Front of the left knee · 0–10",
        note:"Pain at the front of the knee, right now. Not how it felt yesterday in the gym." },
      { name:"First steps (foot)", sets:1, fields:["rpe"], labels:{rpe:"PAIN"}, phs:{rpe:"0-10"},
        target:"First steps out of bed · 0–10",
        note:"The first few steps after standing up, before the foot warms up. This is THE plantar fasciitis number — it is the one that tells you whether the loading is working, and it moves weeks before anything else does." },
      { name:"Wrist", sets:1, fields:["rpe"], labels:{rpe:"PAIN"}, phs:{rpe:"0-10"},
        target:"Wrist · 0–10",
        note:"Pain, ache or pins and needles — score whichever is loudest." },
      { name:"Left shoulder", sets:1, fields:["rpe"], labels:{rpe:"PAIN"}, phs:{rpe:"0-10"},
        target:"Left shoulder & upper back · 0–10",
        note:"Includes the upper-back tightness; Carolyn treats them as the same story." }
    ]
  },

  /* ---------- strength ---------- */
  {
    id:"s1", name:"S1 · Knee & tendon", short:"S1",
    accent:"#C97F5B", cat:"strength",
    sub:"Monday. The quad and the patellar tendon, loaded heavy and slow — the two things standing between this knee and a faster mile. Weeks 1–2; the jumps arrive in week 3.",
    exercises:[
      { name:"Pogos", sets:3, fields:["reps","rpe"], target:"3 × 20", warmup:true, rest:45,
        note:"Small, stiff, fast off the ankles. Primes the calf and tendon for what follows." },
      { name:"Isometric knee extension push", sets:5, target:"5 × 5 sec @ ~85%", rest:60,
        note:"Paul's drill, lengthened: knee at 90° against an immovable pad, drive as hard and as FAST as you can and hold five seconds. Left leg. This is a nervous-system exercise — it should feel like effort, not like a burn." },
      { name:"Leg extension · 3 up 3 down", sets:4, target:"4 × 8 @ RPE 7–8 · 3 s up, 3 s down", rest:120,
        note:"The main dish. Heavy slow resistance is the best-evidenced treatment there is for a painful patellar tendon, AND it is the most direct answer to a quad that never came back. Six seconds a rep, counted. Pain up to about 3/10 during the set is acceptable and expected; it should settle within 24 hours. Start light enough that 8 is honest and add from there." },
      { name:"Rear-foot elevated split squat", sets:4, target:"4 × 6 each @ RPE 7", rest:120,
        note:"Paul's cue, kept: keep the tibia on the front leg VERTICAL. Left leg first, and let the left leg decide the weight for both." },
      { name:"Step-down", sets:3, target:"3 × 8 each · 3 s down", rest:90,
        note:"Off a box, lowering under control until the other heel just touches, then back up. Knee tracks over the middle of the foot and the pelvis stays level. Start at a height where the left is clean." },
      { name:"Calf raise off an edge", sets:3, target:"3 × 12 each @ RPE 8", rest:90,
        note:"Carolyn's, loaded. Off the edge of a step so the heel drops BELOW the toes — the deep bit is the point. Single leg, slow down. This is the only calf raise in the week; the mornings do stretching, not raises." },
      { name:"Seated soleus raise", sets:3, target:"3 × 15 @ RPE 8", rest:60,
        note:"Knee bent, load on the thigh. Different muscle from the standing version, and the one that takes the most force per stride when you run." },
      { name:"Prone banded knee flexion", sets:2, fields:["duration","rpe"], target:"2 × 40 s each side, left first", rest:30,
        note:"Moved here from the morning routine — the band lives at the gym anyway. Face down, band anchored in front of you and looped round the ankle so it pulls the heel toward the backside. Let it draw you in, then add your own pull at the end. Ease into it. Paul prescribed 2 × 30 sec on the ACL side and 1 × 30 on the other; the left is the one that matters." }
    ]
  },

  {
    id:"s1b", name:"S1 · Knee & power", short:"S1",
    accent:"#C97F5B", cat:"strength",
    sub:"Monday, weeks 3–5. Same tendon work, with jumping added in front of it. Everything here she has done before with Paul — this is a return, not an introduction.",
    exercises:[
      { name:"Pogos", sets:3, fields:["reps","rpe"], target:"3 × 20", warmup:true, rest:45,
        note:"Same primer as always." },
      { name:"Isometric knee extension push", sets:5, target:"5 × 5 sec @ ~85%", rest:60,
        note:"Still before the jumping, not after. It wakes the quad up rather than tiring it." },
      { name:"Split tuck jump", sets:4, fields:["reps","rpe"], target:"4 × 3 each", rest:90,
        note:"Straight off Paul's Gym Day 1. Scissor the legs in the air, land soft and quiet. If the landing is loud or the left knee dives inward, stop the set — quality only." },
      { name:"Drop jump to box jump", sets:3, fields:["reps","rpe"], target:"3 × 3", rest:120,
        note:"His again: step off a low box, land, and immediately jump onto a second one. SHORT ground contact time is the whole exercise. Start with a very low drop box and only raise it once the contact is quick." },
      { name:"Leg extension · 3 up 3 down", sets:4, target:"4 × 6 @ RPE 8 · 3 s up, 3 s down", rest:150,
        note:"Heavier than weeks 1–2, two fewer reps. Same six-second tempo — that does not change no matter what the load says." },
      { name:"Rear-foot elevated split squat", sets:4, target:"4 × 5 each @ RPE 8", rest:120,
        note:"Vertical shin. Heavier now." },
      { name:"Calf raise off an edge", sets:4, target:"4 × 10 each @ RPE 8", rest:90,
        note:"Full drop below the step. Carolyn's, still the only calf raises in the week." },
      { name:"Seated soleus raise", sets:3, target:"3 × 15 @ RPE 8", rest:60,
        note:"Unchanged. It is doing quiet work for the heel as much as for the mile." },
      { name:"Prone banded knee flexion", sets:2, fields:["duration","rpe"], target:"2 × 40 s each side, left first", rest:30,
        note:"Moved here from the morning routine. Face down, band looped round the ankle pulling the heel toward the backside; let it draw you in, then add your own pull at the end. Ease into it — the left is the one that matters." }
    ]
  },

  {
    id:"s2", name:"S2 · Hips, chain & upper", short:"S2",
    accent:"#B48EAD", cat:"strength",
    sub:"Thursday. Posterior chain for the running, and the upper body chosen entirely around the wrist and Carolyn's left shoulder. WRIST RULE: nothing loads a bent-back wrist. No barbell front rack, no push-ups on flat hands, no loaded wrist extension. If a grip hurts, use straps and tell Adaner.",
    exercises:[
      { name:"Hip thrust", sets:4, target:"4 × 8 @ RPE 7–8", rest:120,
        note:"Chin tucked, ribs down, hold the top for a beat. The biggest glute lift there is and the one that takes work off the knee when you run." },
      { name:"Romanian deadlift", sets:4, target:"4 × 6 @ RPE 7", rest:150,
        note:"Hinge, don't squat. Bar close, soft knees, stop when the hamstrings run out of length rather than when the bar reaches the floor. Straps are fine and are the right call for the wrist." },
      { name:"Single-leg hip thrust", sets:3, target:"3 × 8 each @ RPE 7", rest:90,
        note:"Paul had this with a barbell; a bodyweight or lightly-loaded version is plenty. Drive up hard and fast, control the way down. Level pelvis." },
      { name:"Seated leg curl", sets:3, target:"3 × 10 @ RPE 8", rest:90,
        note:"Hamstrings on their own. They protect the knee at speed, which matters more the faster the mile gets." },
      { name:"Face pulls", sets:3, target:"3 × 15 @ RPE 7", rest:60,
        note:"Carolyn's, loaded on a cable here rather than a band. Elbows high, split the hands at the end. Light and clean — if the traps take over, drop the weight." },
      { name:"Wall angels", sets:2, fields:["reps","rpe"], target:"2 × 10 · slow", rest:60,
        note:"Carolyn's, and worth doing here too even though it was in the morning: two minutes, no load, and the shoulder is warm now." },
      { name:"Neutral-grip DB press", sets:3, target:"3 × 8 @ RPE 7", rest:90,
        note:"Dumbbells, palms facing each other. Neutral grip keeps the wrist STRAIGHT and stacked, which a barbell does not. If it aches, go lighter before you go home." },
      { name:"Chest-supported row", sets:3, target:"3 × 10 @ RPE 7", rest:90,
        note:"Chest on the pad so the low back is out of it. Pull to the ribs, squeeze the blades. The other half of opening the chest up." }
    ]
  },

  /* ---------- running ---------- */
  {
    id:"c1", name:"C1 · MAS re-entry", short:"Track",
    accent:"#8FBF6B", unit:"drill", cat:"cardio",
    sub:"Week 1 on the track. Paul's 2-minute MAS format, at half the volume he finished on. Do the 'Before you run' routine first — all of it.",
    exercises:[
      { name:"2 min interval", sets:5, fields:["distance","duration","rpe"],
        target:"5 × 2 min @ 90% MAS · ~325 m", rest:120,
        note:"Aim for about 325 m in each two minutes, with two minutes of ACTIVE WALKING between — keep moving, don't sit down. Log the distance you actually covered; that number is what corrects the MAS assumption on Sunday. It should feel like RPE 7: working, but you could do another one." },
      { name:"Cool-down jog", sets:1, fields:["duration","rpe"], target:"5 min very easy",
        note:"Then the calf stretch card before you leave. Not later — before you leave." },
      { name:"Session RPE", sets:1, fields:["rpe"], labels:{rpe:"RPE"},
        target:"Rate the whole session 0–10",
        note:"Paul asked for this at the end of every running session and it is worth keeping: one number for the session as a whole." }
    ]
  },

  {
    id:"c2", name:"C2 · MAS full session", short:"Track",
    accent:"#8FBF6B", unit:"drill", cat:"cardio",
    sub:"Week 2. The complete session off Paul's card — twenty minutes of running work. 'Before you run' first.",
    exercises:[
      { name:"2 min interval", sets:10, fields:["distance","duration","rpe"],
        target:"2 × (5 × 2 min) @ 90% MAS · ~325 m", rest:120,
        note:"Five intervals, two minutes of active walk between each. Then THREE minutes rest, and the second block of five. The last two are supposed to be hard; if you are still hitting the distance on rep 10, say so in Notes and the MAS goes up." },
      { name:"Cool-down jog", sets:1, fields:["duration","rpe"], target:"5 min very easy",
        note:"Then the calf stretch card." },
      { name:"Session RPE", sets:1, fields:["rpe"], labels:{rpe:"RPE"}, target:"Rate the whole session 0–10" }
    ]
  },

  {
    id:"c3", name:"C3 · 6 × 400", short:"Track",
    accent:"#8FBF6B", unit:"drill", cat:"cardio",
    sub:"Week 3. The first session run at mile effort rather than aerobic effort — this is where the block turns toward the actual event. 'Before you run' first.",
    exercises:[
      { name:"400 m rep", sets:6, fields:["distance","duration","rpe"],
        target:"6 × 400 m @ mile effort · ~2:08", rest:180,
        note:"One lap, at the pace you think you could hold for a whole mile — not faster. Three minutes walking between. The first two should feel almost too easy; if rep 1 is your fastest, you went out too hard. Even splits are the skill being learned here." },
      { name:"Cool-down jog", sets:1, fields:["duration","rpe"], target:"8 min very easy" },
      { name:"Session RPE", sets:1, fields:["rpe"], labels:{rpe:"RPE"}, target:"Rate the whole session 0–10" }
    ]
  },

  {
    id:"c4", name:"C4 · Ladder", short:"Track",
    accent:"#8FBF6B", unit:"drill", cat:"cardio",
    sub:"Week 4, the peak session. Descending reps at descending pace, twice through. 'Before you run' first.",
    exercises:[
      { name:"400 m rep", sets:2, fields:["distance","duration","rpe"],
        target:"400 m @ mile effort · ~2:05", rest:120,
        note:"One at the top of each round. Mile effort, not faster." },
      { name:"300 m rep", sets:2, fields:["distance","duration","rpe"],
        target:"300 m slightly faster · ~1:32", rest:120,
        note:"A touch quicker than mile pace. Should feel like a gear change, not a sprint." },
      { name:"200 m rep", sets:2, fields:["distance","duration","rpe"],
        target:"200 m fast · ~58 s", rest:240,
        note:"Fast and relaxed. After the first 200, take four minutes before starting round two." },
      { name:"Cool-down jog", sets:1, fields:["duration","rpe"], target:"8 min very easy" },
      { name:"Session RPE", sets:1, fields:["rpe"], labels:{rpe:"RPE"}, target:"Rate the whole session 0–10" }
    ]
  },

  {
    id:"c5", name:"C5 · Sharpener", short:"Track",
    accent:"#8FBF6B", unit:"drill", cat:"cardio",
    sub:"Week 5. Short, fast, and a long way from exhausting — the last hard session before the test, and its job is to feel good. 'Before you run' first.",
    exercises:[
      { name:"400 m rep", sets:3, fields:["distance","duration","rpe"],
        target:"3 × 400 m @ target mile pace · ~2:00", rest:240,
        note:"Full four minutes between. These are meant to feel controlled and fast, and you should finish wanting a fourth. You do not get a fourth — that is what next Tuesday is for." },
      { name:"Cool-down jog", sets:1, fields:["duration","rpe"], target:"8 min very easy" },
      { name:"Session RPE", sets:1, fields:["rpe"], labels:{rpe:"RPE"}, target:"Rate the whole session 0–10" }
    ]
  },

  {
    id:"ctest", name:"THE MILE", short:"Mile test",
    accent:"#E5A33C", unit:"drill", cat:"cardio",
    sub:"Tuesday 15 September. Four laps, one number, the whole point of the block. Full 'Before you run' warm-up including the strides, then ten minutes of doing nothing before you start.",
    exercises:[
      { name:"Mile — timed", sets:1, fields:["distance","duration","rpe"],
        target:"1600 m · 4 laps · all out",
        note:"Even effort beats a fast first lap every time. Target splits off the block: about 2:00 a lap for 8:00. Go through 400 no faster than 2:00 even if it feels absurdly easy, hold through 800 and 1200, and empty it on the last lap. Log the total time in the TIME column." },
      { name:"Cool-down jog", sets:1, fields:["duration","rpe"], target:"10 min very easy",
        note:"Then write down what it felt like while it is fresh — that note is where the next block starts." },
      { name:"Session RPE", sets:1, fields:["rpe"], labels:{rpe:"RPE"}, target:"Rate the whole session 0–10" }
    ]
  },

  {
    id:"ceasy", name:"Easy run + strides", short:"Easy run",
    accent:"#8FBF6B", unit:"drill", cat:"cardio",
    sub:"Aerobic base with a bit of speed on the end. Easy means genuinely easy — grass or a soft path if the heel has been talking.",
    exercises:[
      { name:"Easy continuous run", sets:1, fields:["distance","duration","rpe"],
        target:"25–35 min easy · RPE 4–5",
        note:"Conversational the whole way. This run is not supposed to be interesting; it is supposed to be repeatable." },
      { name:"Strides", sets:4, fields:["distance","rpe"], target:"4 × 40 m @ 75%", rest:60,
        note:"On the end, on flat ground. Build, hold, ease down, walk back." },
      { name:"Session RPE", sets:1, fields:["rpe"], labels:{rpe:"RPE"}, target:"Rate the whole session 0–10" }
    ]
  },

  {
    id:"ctempo", name:"Tempo", short:"Tempo",
    accent:"#8FBF6B", unit:"drill", cat:"cardio",
    sub:"Comfortably hard, sustained. This is the session that raises the ceiling the 400s are run under.",
    exercises:[
      { name:"Easy continuous run", sets:1, fields:["distance","duration","rpe"],
        target:"10 min easy", warmup:true,
        note:"Warm-up. Add 3 × 40 m strides at the end of it before the first block." },
      { name:"Tempo block", sets:2, fields:["distance","duration","rpe"],
        target:"2 × 8 min @ RPE 7", rest:180,
        note:"Comfortably hard: you could say a short sentence, not a long one. Three minutes easy jogging between the two. Slower than the 400s by a long way — if you are gasping, it has become the wrong session." },
      { name:"Cool-down jog", sets:1, fields:["duration","rpe"], target:"8 min very easy" },
      { name:"Session RPE", sets:1, fields:["rpe"], labels:{rpe:"RPE"}, target:"Rate the whole session 0–10" }
    ]
  },

  /* ---------- classes ---------- */
  {
    id:"spin", name:"Spin", short:"Spin",
    accent:"#5BC9BC", unit:"drill", cat:"cardio",
    sub:"Aerobic work with nothing landing on the knee, which is exactly why it is here on the day between the track and the second lift. Go hard — this is the one place in the week where the legs can be emptied without a cost.",
    exercises:[
      { name:"Spin class", sets:1, fields:["duration","rpe"], target:"45–60 min · RPE 7–8",
        note:"Any low-impact class does the same job if spin is not on. Log the minutes and how hard it felt." }
    ]
  },

  {
    id:"barrys", name:"Barry's", short:"Barry's",
    accent:"#C97F5B", unit:"drill", cat:"cardio",
    sub:"Counts as a RUN DAY, not an extra — the treadmill intervals are running, and they land on the knee and the heel like running does. Take the weights section easy on anything that loads a bent-back wrist.",
    exercises:[
      { name:"Barry's Bootcamp", sets:1, fields:["duration","rpe"], target:"50 min · RPE 8",
        note:"On the treadmill sections, run them — that is the point of putting it here. On the floor sections, dumbbells with a neutral grip and no push-ups on flat hands." }
    ]
  },

  {
    id:"yoga", name:"Yoga", short:"Yoga",
    accent:"#9BB8D3", unit:"drill", cat:"cardio",
    sub:"A real part of the week, not a filler. Watch the left knee in deep kneeling shapes and the wrists in anything weight-bearing — fists or forearms instead of flat palms, every time.",
    exercises:[
      { name:"Yoga class", sets:1, fields:["duration","rpe"], target:"45–75 min · easy",
        note:"Wrists: come onto fists or forearms rather than flat palms in plank and down dog. Knee: a folded blanket under it in anything kneeling. Neither of those is a failure, they are the reason you get to keep going." }
    ]
  },

  /* ---------- spare ---------- */
  {
    id:"free", name:"Spare session", short:"Spare",
    accent:"#7F8FA3", cat:"strength",
    sub:"Empty. For anything unplanned — a class you swapped in, a travel day, a session that turned into something else. Add exercises as you go.",
    freeform:true,
    exercises:[]
  },

  /* Not freeform, because ad-hoc added exercises can only get weight/reps
     columns — a canned rep exercise is what buys the distance/time layout. */
  {
    id:"freerun", name:"Spare run", short:"Run",
    accent:"#8FBF6B", unit:"drill", cat:"cardio",
    sub:"A blank running session — your own 6 × 200s, a fartlek, whatever the day turned into. Six rep rows to start; add or ignore as needed. The rest timer between reps runs at 60 sec — note the actual rest in the session note if it differed.",
    exercises:[
      { name:"Run rep", sets:6, fields:["distance","duration","rpe"],
        target:"distance · time · effort, per rep", rest:60,
        note:"Log each rep as you go — distance in meters, time as m:ss. Blank rows are simply not logged, so extra rows cost nothing." }
    ]
  }

  ]
};

/* Past blocks. Nothing reads this at runtime — it is here so a re-program can
   see what came before without digging through git. */
const PROGRAM_ARCHIVE = [
  { block: "Paul Read — ACL return to sport", start: "2023-01-02", end: "2024-07-01",
    note: "Eighteen months of coached rehab after the 2022 left ACL reconstruction, delivered through TrueCoach. Ended at RFE split squats, drop-jump-to-box-jump, barbell single-leg hip thrusts, BFR leg press, and a measured MAS of 3.4 m/s. The full log is in source/ and is where this block's knee and foot content comes from. Worth knowing: the sessions she marked 'missed' were overwhelmingly the daily prehab, which is why it is now the first thing on the screen every morning." }
];
