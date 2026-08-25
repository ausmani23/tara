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
     schedule  the calendar: one entry per day, in date order. A day may have
               MORE than one entry (strength + cardio are separate slots).
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
               "drill" on cardio days, "check" on the check-in
     freeform  true → starts empty, you add exercises as you go
     exercises the movements, in order

   Exercise fields:
     name      display name — ALSO the key history matches on across sessions.
               The same lift on two different days shares a name on purpose:
               that is how the PREV column carries the last one forward.
     sets      how many rows to lay out
     fields    which columns this exercise records. Omit for lifting
               (weight/reps/rpe). Holds use ["duration","rpe"].
     labels    per-field column re-heading, e.g. {rpe:"PAIN"}
     phs       per-field placeholder override
     target    prescription line — the WEEK'S ask, updated each Sunday
     suggest   optional {field:value} prefill proposal, shown dimmed
     note      coaching line shown under the exercise
     warmup    true → excluded from the working-set count on the card
     (There is no in-app rest timer — she times rests on her Garmin.)

   TWO STANDING RULES FOR THIS FILE:

   1. NO WEIGHT FIELD, NO CALORIE FIELD, ANYWHERE. Not on the check-in, not in
      a note, not as a passing remark in a `sub`. High-burn work is programmed;
      it is never labelled, counted or displayed. This is a deliberate design
      constraint, not an oversight — do not "helpfully" add tracking.
      (The Bangalore document has a nutrition section. It deliberately does NOT
      appear in this app, and must never.)

   2. DO NOT DOUBLE-COUNT THE MORNING ROUTINE. The `bangalore` routine already
      delivers the day's mobility and the daily isometrics. The ONE sanctioned
      repeat is the Spanish squat / wall sit isometric opening each lower gym
      day — that is per the document (isometrics are safe daily, and the
      pre-lift dose has a pain-relieving effect that makes the session better).
      Everything else: replace or leave alone, never stack.
   ============================================================ */

const PROGRAM = {
  block: "Bangalore — tendon & strength base",
  week: 1,
  weeks: 3,
  start: "2026-08-26",

  focus: "Three weeks to settle the patellar tendon under heavy slow load and build genuinely hard everywhere that doesn't hurt. The tendon is loaded on three days only — Monday, Wednesday, Friday — and protected on the rest. That constraint, not the exercise list, is what makes the plan work.",

  note: "THE RULE THAT GOVERNS EVERYTHING. Up to 4 out of 10 pain during a session is fine. It must settle inside 24 hours, and the knee must not be stiffer the next morning. If it IS worse the next morning, the load was too high — drop it by 20% and keep going. Do not stop entirely: tendons get worse with rest and better with the right amount of load, and the whole skill is finding that amount and staying just under it.\n\nHOW THE HEAVY SLOW WORK PROGRESSES. The squat and leg-press work runs at 3 seconds down, 3 seconds up, always. Week 1 (through 31 Aug) is 4 × 12 around a 15-rep max — deliberately light, finding the range and load the tendon accepts, not proving anything. Week 2 (from 1 Sep) is 4 × 10 around a 12-rep max; week 3 (from 8 Sep) is 4 × 8 around a 10-rep max, the heaviest. The target lines below are week 1's — they get rewritten each Sunday from the export. Slow tempo is what makes heavy load tolerable; speed is what hurts.\n\nNOT THIS BLOCK: no leg extension (highest tendon force per kilo of any quad exercise — it is the machine that kept this loop going), and no running.\n\nCARDIO FORM RULES. Swimming is freestyle, not breaststroke — that kick bothers knees. Peloton is seated only, seat high, no standing climbs: standing loads the tendon hard.\n\nTENNIS is deliberately clustered onto lifting days — tendons care about how many days a week something big is asked of them, not how much on any one day, and clustering keeps the protected days genuinely protected. Week 1 has Friday only. The Monday session joins from week 2 ONLY IF every week-1 knee reaction settled within 24 hours — if any didn't, say so in Notes and Monday stays a swim.\n\nUPPER DAYS: push genuinely hard. Nothing there touches the knee, and it is where most of the visible three-week progress comes from. Wrist rule as always: neutral grips, straps whenever the grip is the limit, nothing loading a bent-back wrist.\n\nThe last two days before the 17 Sep departure are travel wind-down: mobility and swim only.",

  schedule: [
    /* The block starts on a Wednesday, so the opening partial week runs
       Wed–Mon and the PDF's week rows (26–31 Aug, 1–7 Sep, 8–14 Sep) land the
       tendon days on Wed / Fri / Mon — always non-consecutive. */
    { sid:"s01", date:"2026-08-26", w:"lowB"     },
    { sid:"s02", date:"2026-08-26", w:"peloZ2"   },
    { sid:"s03", date:"2026-08-27", w:"pull"     },
    { sid:"s04", date:"2026-08-27", w:"swim"     },
    { sid:"s05", date:"2026-08-28", w:"lowC"     },
    { sid:"s06", date:"2026-08-28", w:"tennis"   },
    { sid:"s07", date:"2026-08-29", w:"upfull"   },
    { sid:"s08", date:"2026-08-29", w:"peloEasy" },
    { sid:"s09", date:"2026-08-30", w:"swim"     },
    { sid:"s10", date:"2026-08-31", w:"lowA"     },
    { sid:"s11", date:"2026-08-31", w:"swim"     },

    { sid:"s12", date:"2026-09-01", w:"push"     },
    { sid:"s13", date:"2026-09-01", w:"swim"     },
    { sid:"s14", date:"2026-09-02", w:"lowB"     },
    { sid:"s15", date:"2026-09-02", w:"peloZ2"   },
    { sid:"s16", date:"2026-09-03", w:"pull"     },
    { sid:"s17", date:"2026-09-03", w:"swim"     },
    { sid:"s18", date:"2026-09-04", w:"lowC"     },
    { sid:"s19", date:"2026-09-04", w:"tennis"   },
    { sid:"s20", date:"2026-09-05", w:"upfull"   },
    { sid:"s21", date:"2026-09-05", w:"peloEasy" },
    { sid:"s22", date:"2026-09-06", w:"swim"     },
    { sid:"s23", date:"2026-09-07", w:"lowA"     },
    { sid:"s24", date:"2026-09-07", w:"tennis"   },

    { sid:"s25", date:"2026-09-08", w:"push"     },
    { sid:"s26", date:"2026-09-08", w:"swim"     },
    { sid:"s27", date:"2026-09-09", w:"lowB"     },
    { sid:"s28", date:"2026-09-09", w:"peloZ2"   },
    { sid:"s29", date:"2026-09-10", w:"pull"     },
    { sid:"s30", date:"2026-09-10", w:"swim"     },
    { sid:"s31", date:"2026-09-11", w:"lowC"     },
    { sid:"s32", date:"2026-09-11", w:"tennis"   },
    { sid:"s33", date:"2026-09-12", w:"upfull"   },
    { sid:"s34", date:"2026-09-12", w:"peloEasy" },
    { sid:"s35", date:"2026-09-13", w:"swim"     },
    { sid:"s36", date:"2026-09-14", w:"lowA"     },
    { sid:"s37", date:"2026-09-14", w:"tennis"   },

    /* travel wind-down — the morning mobility is daily anyway */
    { sid:"s38", date:"2026-09-15", w:"swim"     },
    { sid:"s39", date:"2026-09-16", w:"swim"     },
    { sid:"s40", date:"2026-09-17", rest:true    }
  ],

  workouts: [

  /* ---------- daily ---------- */
  {
    id:"checkin", name:"Morning check-in", short:"Check-in",
    accent:"#C9A227", unit:"check", cat:"check", sched:{freq:"daily"},
    sub:"Ten seconds, before anything else. Four dials. This is what next Sunday's programming actually reads — a week of quiet 2s and a week of quiet 6s get very different blocks.",
    exercises:[
      { name:"Left knee", sets:1, fields:["rpe"], labels:{rpe:"PAIN"}, phs:{rpe:"0-10"},
        target:"Front of the left knee, this morning · 0–10",
        note:"THE number for this block: did yesterday's loading settle within 24 hours, and is the knee stiffer than it was yesterday morning? This dial is what sets today's load — worse than yesterday morning means the last session was 20% too heavy." },
      { name:"First steps (foot)", sets:1, fields:["rpe"], labels:{rpe:"PAIN"}, phs:{rpe:"0-10"},
        target:"First steps out of bed · 0–10",
        note:"The first few steps after standing up, before the foot warms up. The plantar fasciitis number — it moves weeks before anything else does." },
      { name:"Wrist", sets:1, fields:["rpe"], labels:{rpe:"PAIN"}, phs:{rpe:"0-10"},
        target:"Wrist · 0–10",
        note:"Pain, ache or pins and needles — score whichever is loudest. Six lifting days a week means the grips matter more than usual." },
      { name:"Left shoulder", sets:1, fields:["rpe"], labels:{rpe:"PAIN"}, phs:{rpe:"0-10"},
        target:"Left shoulder & upper back · 0–10",
        note:"Includes the upper-back tightness; Carolyn treats them as the same story." }
    ]
  },

  /* ---------- strength: the three tendon days ---------- */
  {
    id:"lowA", name:"Lower A · squat biased", short:"Lower A",
    accent:"#C97F5B", cat:"strength",
    sub:"Monday — a tendon day. Isometrics first, then the heavy slow work: 3 seconds down, 3 seconds up, every rep of the squat and leg-press work, counted. Slow tempo is what makes heavy load tolerable; speed is what hurts. Up to 4/10 pain during is fine — it must settle inside 24 hours.",
    exercises:[
      { name:"Spanish squat or wall sit", sets:5, fields:["duration","rpe"], warmup:true,
        target:"5 × 45 s @ ~70% effort · 2 min rest",
        note:"Same drill as the morning list, repeated on purpose: the pain-relieving effect makes the session after it better. Vertical shin, least painful angle." },
      { name:"Smith machine squat", sets:4,
        target:"4 × 12 around a 15-rep max · 3 s down, 3 s up",
        note:"To a TOLERATED depth — start around 60–70° of bend and let the knee vote. Week 1 is finding the range and load the tendon accepts, not proving anything." },
      { name:"Leg press", sets:3,
        target:"3 × 12 · shallow-to-moderate range · same tempo",
        note:"Closed chain, controlled range. No deep bend this week." },
      { name:"Romanian deadlift", sets:3,
        target:"3 × 10",
        note:"Hinge, don't squat. The hamstrings were never touched by the graft — this can be honest work. Straps are the right call for the wrist." },
      { name:"Seated hamstring curl", sets:3, target:"3 × 12" },
      { name:"Cable hip abduction", sets:3, target:"3 × 15 each side",
        note:"Log left and right as separate sets if they differ." },
      { name:"Standing calf raise", sets:3, target:"3 × 15" },
      { name:"Copenhagen plank", sets:3, fields:["duration","rpe"],
        target:"3 × 20 s each side",
        note:"Short lever (knee on the bench) is fine. Adductors protect the knee at speed later in the arc." }
    ]
  },

  {
    id:"lowB", name:"Lower B · hinge biased", short:"Lower B",
    accent:"#C97F5B", cat:"strength",
    sub:"Wednesday — the lowest-tendon lower day. Isometrics first, then hinge everything: the sore tissue is involved not at all in a hip hinge, so the loading here can be genuinely ambitious while the tendon has a moderate day.",
    exercises:[
      { name:"Spanish squat or wall sit", sets:5, fields:["duration","rpe"], warmup:true,
        target:"5 × 45 s @ ~70% effort · 2 min rest",
        note:"Vertical shin, least painful angle." },
      { name:"Romanian deadlift", sets:4,
        target:"4 × 8 · heavier than Monday",
        note:"Monday's RDL was an accessory; this is the main dish. Bar close, soft knees, stop where the hamstrings run out of length." },
      { name:"Hip thrust", sets:4, target:"4 × 10",
        note:"Chin tucked, ribs down, squeeze the top for a beat. The biggest glute lift there is." },
      { name:"Cable pull-through", sets:3, target:"3 × 15" },
      { name:"B-stance RDL or single-leg hip thrust", sets:3,
        target:"3 × 10 each side",
        note:"Pick whichever the gym makes easy — the point is one leg at a time, pelvis level." },
      { name:"Lying hamstring curl", sets:3, target:"3 × 12" },
      { name:"Banded lateral walk", sets:3, fields:["reps","rpe"],
        target:"3 × 15 each side" },
      { name:"Calf raise", sets:3, target:"3 × 15" },
      { name:"Pallof press", sets:3, target:"3 × 12 each side" }
    ]
  },

  {
    id:"lowC", name:"Lower C · leg press biased", short:"Lower C",
    accent:"#C97F5B", cat:"strength",
    sub:"Friday — a tendon day. Isometrics first, then heavy slow: 3 seconds down, 3 seconds up. Same rule as Monday — up to 4/10 during, settled inside 24 hours, never stiffer next morning.",
    exercises:[
      { name:"Spanish squat or wall sit", sets:5, fields:["duration","rpe"], warmup:true,
        target:"5 × 45 s @ ~70% effort · 2 min rest",
        note:"Vertical shin, least painful angle." },
      { name:"Leg press", sets:4,
        target:"4 × 12 · slightly deeper than Monday if the week has gone well · 3 s down, 3 s up",
        note:"'If the week has gone well' means every knee reaction settled within 24 hours. If not, same range as Monday and 20% off." },
      { name:"Goblet or Smith squat", sets:3,
        target:"3 × 10 · same tempo",
        note:"Goblet keeps the wrist neutral; Smith if the load outgrows what you can hold." },
      { name:"Single-leg leg press", sets:3,
        target:"3 × 10 each side · controlled range, no deep bend",
        note:"Left leg decides the load for both." },
      { name:"Hip thrust", sets:3, target:"3 × 12" },
      { name:"Hamstring curl", sets:3, target:"3 × 10" },
      { name:"Cable hip abduction", sets:3, target:"3 × 15 each side" },
      { name:"Calf raise", sets:3, target:"3 × 15" },
      { name:"Dead bug", sets:3, fields:["reps","rpe"], target:"3 × 10 each side" }
    ]
  },

  /* ---------- strength: the protected upper days ---------- */
  {
    id:"push", name:"Upper · push", short:"Push",
    accent:"#B48EAD", cat:"strength",
    sub:"Tuesday — tendon protected. Push genuinely hard today: nothing here touches the knee, and this is where most of the visible three-week progress comes from. WRIST RULE: neutral grips wherever they exist, nothing loading a bent-back wrist, straps or lighter before sore.",
    exercises:[
      { name:"Chest press or DB bench", sets:4, target:"4 × 8–10",
        note:"Machine or dumbbells — whichever the gym does well. Dumbbells let the wrists sit neutral." },
      { name:"Overhead press", sets:4, target:"4 × 8",
        note:"DB or Smith. Ribs down, no low-back arch." },
      { name:"Incline DB press", sets:3, target:"3 × 10" },
      { name:"Cable chest fly", sets:3, target:"3 × 12" },
      { name:"Lateral raise", sets:3, target:"3 × 15" },
      { name:"Tricep pushdown", sets:3, target:"3 × 12" },
      { name:"Overhead tricep extension", sets:3, target:"3 × 12" },
      { name:"Cable crunch", sets:3, target:"3 × 15" },
      { name:"Pallof press", sets:3, target:"3 × 12 each side" }
    ]
  },

  {
    id:"pull", name:"Upper · pull", short:"Pull",
    accent:"#B48EAD", cat:"strength",
    sub:"Thursday — tendon protected. The back that holds the shoulder where Carolyn wants it, plus arms. Same wrist rule: if a grip aches, straps or a rotated handle before load comes off.",
    exercises:[
      { name:"Lat pulldown", sets:4, target:"4 × 10" },
      { name:"Seated cable row", sets:4, target:"4 × 10" },
      { name:"Single-arm DB row", sets:3, target:"3 × 12 each side" },
      { name:"Straight-arm pulldown", sets:3, target:"3 × 12" },
      { name:"Face pull", sets:3, target:"3 × 15",
        note:"Carolyn's, loaded. Elbows high, split the hands at the end, light and clean — if the traps take over, drop the weight." },
      { name:"Rear delt fly", sets:3, target:"3 × 15" },
      { name:"Cable curl", sets:3, target:"3 × 12" },
      { name:"Hammer curl", sets:3, target:"3 × 12",
        note:"Neutral grip — the curl the wrist likes." },
      { name:"Hanging leg raise", sets:3, fields:["reps","rpe"], target:"3 × 10",
        note:"Straps or the captain's chair if hanging bothers the wrist." },
      { name:"Side plank", sets:3, fields:["duration","rpe"], target:"3 × 40 s each side",
        note:"On the forearm, never a flat bent-back hand." }
    ]
  },

  {
    id:"upfull", name:"Upper & carries", short:"Upper",
    accent:"#B48EAD", cat:"strength",
    sub:"Saturday — tendon protected. Full upper plus loaded carries. Carries are walking, not knee bending — heavy in the hands, tall through the trunk. Grip work is wrist work: straps the moment the grip is the limit rather than the target.",
    exercises:[
      { name:"Pull-up or assisted pull-up", sets:4, target:"4 × 6–8",
        note:"Log assistance as negative weight in the note, or added load as weight." },
      { name:"DB bench press", sets:3, target:"3 × 10" },
      { name:"Landmine or DB shoulder press", sets:3, target:"3 × 10",
        note:"The landmine keeps the wrist stacked and neutral — first choice if the gym has one." },
      { name:"Cable row", sets:3, target:"3 × 12" },
      { name:"Farmer carry", sets:4, fields:["weight","distance","rpe"],
        target:"4 × 40 m",
        note:"Both hands loaded. Tall, quiet steps." },
      { name:"Suitcase carry", sets:3, fields:["weight","distance","rpe"],
        target:"3 × 30 m each side",
        note:"One side loaded — the obliques do the anti-lean work." },
      { name:"Ab wheel or hanging leg raise", sets:3, fields:["reps","rpe"], target:"3 × 10",
        note:"Ab wheel on FISTS or handles, never bent-back palms." },
      { name:"Side plank", sets:3, fields:["duration","rpe"], target:"3 × 40 s each side" }
    ]
  },

  /* ---------- cardio ---------- */
  {
    id:"swim", name:"Swim", short:"Swim",
    accent:"#9BB8D3", unit:"drill", cat:"cardio",
    sub:"Freestyle, not breaststroke — that kick bothers knees. Easy means easy: this is the recovery half of the day, not a second workout. On Sundays it is the whole day: tendons remodel on the days they aren't being hammered, so the quiet day is doing work even though it doesn't feel like it.",
    exercises:[
      { name:"Freestyle swim", sets:1, fields:["duration","rpe"],
        target:"25–30 min easy (20–30 on a Sunday)",
        note:"Log the minutes and how it felt. If the pool is a mess, a long walk does the same job." }
    ]
  },

  {
    id:"peloZ2", name:"Peloton · Zone 2", short:"Peloton",
    accent:"#5BC9BC", unit:"drill", cat:"cardio",
    sub:"Seated only, seat HIGH, no standing climbs — standing loads the tendon hard, and Wednesday's tendon budget is already spent in the gym.",
    exercises:[
      { name:"Peloton ride", sets:1, fields:["duration","rpe"],
        target:"40 min Zone 2 · conversational",
        note:"Zone 2 means you could talk the whole way. Seated, seat high, resistance over cadence-mashing." }
    ]
  },

  {
    id:"peloEasy", name:"Peloton easy / walk", short:"Easy spin",
    accent:"#5BC9BC", unit:"drill", cat:"cardio",
    sub:"Saturday afternoon: an easy spin or a long walk, whichever the day wants. Same bike rules — seated, seat high, no standing climbs.",
    exercises:[
      { name:"Easy ride or walk", sets:1, fields:["duration","rpe"],
        target:"30 min easy",
        note:"Genuinely easy. The lifting earlier was the day's work." }
    ]
  },

  {
    id:"tennis", name:"Tennis", short:"Tennis",
    accent:"#8FBF6B", unit:"drill", cat:"cardio",
    sub:"Coached lesson. Deliberately on lifting days: tendons care about how many days a week something big is asked of them, not how much on any one day — clustering the load keeps the protected days genuinely protected. Week 1 is Friday only; Monday joins from week 2 only if every week-1 knee reaction settled within 24 hours.",
    exercises:[
      { name:"Tennis lesson", sets:1, fields:["duration","rpe"],
        target:"Lesson · log minutes and effort",
        note:"If the knee is loud DURING, ease the movement demands — more feeding, less chasing — and put it in Notes. How it feels tomorrow morning is the number that matters." }
    ]
  },

  /* ---------- spare ---------- */
  {
    id:"free", name:"Spare session", short:"Spare",
    accent:"#7F8FA3", cat:"strength",
    sub:"Empty. For anything unplanned — a class you swapped in, a travel day, a session that turned into something else. Add exercises as you go.",
    freeform:true,
    exercises:[]
  }

  ]
};

/* Past blocks. Nothing reads this at runtime — it is here so a re-program can
   see what came before without digging through git. */
const PROGRAM_ARCHIVE = [
  { block: "Paul Read — ACL return to sport", start: "2023-01-02", end: "2024-07-01",
    note: "Eighteen months of coached rehab after the 2022 left ACL reconstruction, delivered through TrueCoach. Ended at RFE split squats, drop-jump-to-box-jump, barbell single-leg hip thrusts, BFR leg press, and a measured MAS of 3.4 m/s. The full log is in source/ and is where the knee and foot routine content comes from. Worth knowing: the sessions she marked 'missed' were overwhelmingly the daily prehab, which is why it is now the first thing on the screen every morning." },

  { block: "Mile — August to mid-September", start: "2026-08-11", end: "2026-08-25",
    note: "Five weeks toward a timed mile off an assumed MAS of 3.0 m/s; cut short mid-week-3 and the mile never tested. Superseded by the Bangalore block after the patellar-tendinopathy conversation reframed the knee: pain at the BPTB graft donor site, aggravated most by exactly this block's leg extension (S1's '3 up 3 down' main dish) and by running volume. Both are banned in the replacement block — heavy slow closed-chain work and daily isometrics instead, no running. The S2 hip/posterior/upper template and the wrist rules carried forward largely intact." }
];
