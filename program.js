/* ============================================================
   PROGRAM — the current training block. Unlike routines.js this file is MEANT
   to churn: it is rewritten every Sunday from that week's export.

   PROGRAM fields:
     block     name of the current block
     week      which week of the block this file programs
     weeks     how many weeks the block runs
     start     ISO date the week counter runs from (drives the counter on home)
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

   WEEK 2 SOURCE: Tara's own plan for 1–6 Sep (the "training-week-1-6-sep"
   document she shared on 31 Aug, laid out with her own Claude session).
   Transcribed, not improved. It re-cuts the week — tendon days moved to
   Tue/Fri/Sun, both tennis lessons onto gym days — and adds the quad-knot
   protocol. Week 3 rolls the same weekly shape forward and gets rewritten
   from next Sunday's export as usual.
   ============================================================ */

const PROGRAM = {
  block: "Bangalore — tendon & strength base",
  week: 2,
  weeks: 3,
  /* The Tuesday before the first session, NOT the first session's date: the
     plan's week rows run Tue–Mon (wk 2 = 1–7 Sep, wk 3 = 8–14 Sep), and
     programWeek() counts 7-day chunks from here — this start makes the
     counter agree with the plan. */
  start: "2026-08-25",

  focus: "Three weeks to settle the patellar tendon under heavy slow load and build genuinely hard everywhere that doesn't hurt. The tendon is loaded on three spaced days a week and protected on the rest — and tennis counts toward that budget, which is why the lessons sit on gym days. That constraint, not the exercise list, is what makes the plan work.",

  note: "THE RULE THAT GOVERNS EVERYTHING. Up to 4 out of 10 pain during a session is fine. It must settle inside 24 hours, and the knee must not be stiffer the next morning. If it IS worse the next morning, the load was too high — drop it by 20% and keep going. Do not stop entirely: tendons get worse with rest and better with the right amount of load, and the whole skill is finding that amount and staying just under it.\n\nTHE WEEK WAS RE-CUT FOR WEEK 2 — from Tara's own plan (31 Aug). The tendon still gets exactly three loaded days with recovery between them, but they moved so that both tennis lessons land on days the tendon is already working, and the protected days stay genuinely quiet. On the Wednesday the gym half is upper-body only — the day's whole tendon budget is the lesson itself. Wednesday evening's touch session is COACHING — standing and instructing costs the tendon nothing; playing is not on this block. The calendar below is the only statement of which day is which.\n\nHOW THE HEAVY SLOW WORK PROGRESSES. The squat and leg-press work runs at 3 seconds down, 3 seconds up, always. Week 2 (from 1 Sep) is 4 × 10 around a 12-rep max. One honesty clause from the plan: if the 3-second tempo wasn't actually being used last week, stay at 4 × 12 and treat this as week 1 instead — tempo matters more than load. Week 3 (from 8 Sep) is 4 × 8 around a 10-rep max, the heaviest.\n\nNEW THIS WEEK: THE QUAD KNOT. A knot in the lower left quad is aggravated. A tight quad pulls straight through the extensor mechanism, so it adds load to the tendon all day — which is why it now gets a dedicated protocol before every lower session (heat, roll, pin-and-stretch — it is the first item on each lower card), and why Tuesday's quad volume is trimmed slightly: one leg-press set moved into the Romanian deadlift.\n\nNOT THIS BLOCK: no leg extension (highest tendon force per kilo of any quad exercise — it is the machine that kept this loop going), no running, no touch playing (coaching is fine), no pistol, sissy or jump squats, no box jumps or plyometrics, no deep loaded knee flexion.\n\nCARDIO FORM RULES. Swimming is freestyle, not breaststroke — that kick bothers knees. The bike is seated the whole way, seat set high, light gear at 90+ rpm: no standing climbs, and no grinding a big gear — both load the tendon hard.\n\nUPPER DAYS: push genuinely hard. Nothing there touches the knee, and it is where most of the visible three-week progress comes from. Wrist rule as always: neutral grips, straps whenever the grip is the limit, nothing loading a bent-back wrist.\n\nThe last two days before the 17 Sep departure are travel wind-down: mobility and swim only.",

  schedule: [
    /* Week 1 (Tue 25 – Mon 31 Aug) as it actually ran — the 25th was the rest
       day before the first session, kept on the calendar so the week rows run
       Tue–Mon like the plan's. Do not edit past days: logged sessions key to
       these sids. */
    { sid:"s00", date:"2026-08-25", rest:true    },
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

    /* Week 2 — her plan's shape: tendon Tue / Fri / Sun, tennis Wed + Fri,
       Monday protected. */
    { sid:"s12", date:"2026-09-01", w:"lowA"     },
    { sid:"s13", date:"2026-09-01", w:"swim"     },
    { sid:"s14", date:"2026-09-02", w:"push"     },
    { sid:"s15", date:"2026-09-02", w:"tennis"   },
    { sid:"s16", date:"2026-09-03", w:"pull"     },
    { sid:"s17", date:"2026-09-03", w:"swim"     },
    { sid:"s18", date:"2026-09-04", w:"lowB"     },
    { sid:"s19", date:"2026-09-04", w:"tennis"   },
    { sid:"s20", date:"2026-09-05", w:"upfull"   },
    { sid:"s21", date:"2026-09-05", w:"peloEasy" },
    { sid:"s22", date:"2026-09-06", w:"lowC"     },
    { sid:"s23", date:"2026-09-06", w:"swim"     },
    { sid:"s24", date:"2026-09-07", w:"swim"     },

    /* Week 3 — the same shape rolled forward. Gets rewritten from next
       Sunday's export (loads move to 4 × 8 around a 10-rep max). */
    { sid:"s25", date:"2026-09-08", w:"lowA"     },
    { sid:"s26", date:"2026-09-08", w:"swim"     },
    { sid:"s27", date:"2026-09-09", w:"push"     },
    { sid:"s28", date:"2026-09-09", w:"tennis"   },
    { sid:"s29", date:"2026-09-10", w:"pull"     },
    { sid:"s30", date:"2026-09-10", w:"swim"     },
    { sid:"s31", date:"2026-09-11", w:"lowB"     },
    { sid:"s32", date:"2026-09-11", w:"tennis"   },
    { sid:"s33", date:"2026-09-12", w:"upfull"   },
    { sid:"s34", date:"2026-09-12", w:"peloEasy" },
    { sid:"s35", date:"2026-09-13", w:"lowC"     },
    { sid:"s36", date:"2026-09-13", w:"swim"     },
    { sid:"s37", date:"2026-09-14", w:"swim"     },

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
    sub:"Tuesday — a tendon day. Quad protocol and isometrics first, then the heavy slow work: 3 seconds down, 3 seconds up, every rep of the squat and leg-press work, counted. Week 2 moves to 4 × 10 around a 12-rep max — but only if the 3-second tempo was honestly there last week; if not, stay at 4 × 12 and call this week 1. Up to 4/10 pain during is fine — it must settle inside 24 hours.",
    exercises:[
      { name:"Quad knot protocol", sets:1, fields:["duration","rpe"], warmup:true,
        target:"Heat first · 2–3 min roll · 10 pin-and-stretch bends",
        note:"The aggravated knot in the lower quad adds tension straight through the extensor mechanism, so it gets treated before every lower session. Heat beforehand, not ice. Foam roller or massage ball on the middle and lower third of the quad — STOP 5 cm above the kneecap, never over the tendon or the scar. Then pin the tender spot and slowly bend and straighten the knee 10 times under the pressure." },
      { name:"Spanish squat or wall sit", sets:5, fields:["duration","rpe"], warmup:true,
        target:"5 × 45 s @ ~70% effort · 2 min rest",
        note:"Same drill as the morning list, repeated on purpose: the pain-relieving effect makes the session after it better. Vertical shin, least painful angle." },
      { name:"Smith machine squat", sets:4,
        target:"4 × 10 around a 12-rep max · 3 s down, 3 s up",
        note:"To a TOLERATED depth — let the knee vote. One notch heavier than last week's 4 × 12, not a leap; the tempo is the part that is not negotiable." },
      { name:"Leg press", sets:2,
        target:"2 × 10 · shallow-to-moderate range · same tempo",
        note:"Reduced from 3 sets this week — the quad knot's tax comes out of accessory quad volume, not out of the squat." },
      { name:"Romanian deadlift", sets:4,
        target:"4 × 10",
        note:"An extra set this week, replacing the trimmed leg-press volume. Hinge, don't squat — the hamstrings were never touched by the graft, so this can be honest work. Straps are the right call for the wrist." },
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
    sub:"Friday — a tendon day on the calendar, but the gym half is the gentlest of the three: the sore tissue is barely involved in a hip hinge, so the loading here can be genuinely ambitious while the tendon saves its budget for the afternoon's tennis. Quad protocol and isometrics first all the same.",
    exercises:[
      { name:"Quad knot protocol", sets:1, fields:["duration","rpe"], warmup:true,
        target:"Heat first · 2–3 min roll · 10 pin-and-stretch bends",
        note:"Heat, not ice. Roll the middle and lower third of the quad, stopping 5 cm above the kneecap — never over the tendon or the scar — then pin the tender spot and bend and straighten the knee 10 times under it." },
      { name:"Spanish squat or wall sit", sets:5, fields:["duration","rpe"], warmup:true,
        target:"5 × 45 s @ ~70% effort · 2 min rest",
        note:"Vertical shin, least painful angle." },
      { name:"Romanian deadlift", sets:4,
        target:"4 × 8 · heavier than Tuesday",
        note:"Tuesday's RDL was an accessory; this is the main dish. Bar close, soft knees, stop where the hamstrings run out of length." },
      { name:"Hip thrust", sets:4, target:"4 × 10 · pause 1 s at the top",
        note:"Chin tucked, ribs down, hold the squeeze for the full second. The biggest glute lift there is." },
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
    sub:"Sunday — the third tendon day. Quad protocol and isometrics first, then heavy slow: 3 seconds down, 3 seconds up. Same rule as Tuesday — up to 4/10 during, settled inside 24 hours, never stiffer next morning. The evening swim afterwards is half a kilometre and nothing else.",
    exercises:[
      { name:"Quad knot protocol", sets:1, fields:["duration","rpe"], warmup:true,
        target:"Heat first · 2–3 min roll · 10 pin-and-stretch bends",
        note:"Heat, not ice. Roll the middle and lower third of the quad, stopping 5 cm above the kneecap — never over the tendon or the scar — then pin the tender spot and bend and straighten the knee 10 times under it." },
      { name:"Spanish squat or wall sit", sets:5, fields:["duration","rpe"], warmup:true,
        target:"5 × 45 s @ ~70% effort · 2 min rest",
        note:"Vertical shin, least painful angle." },
      { name:"Leg press", sets:4,
        target:"4 × 10 · slightly deeper than Tuesday if the week has gone well · 3 s down, 3 s up",
        note:"'If the week has gone well' means every knee reaction settled within 24 hours. If not, same range as Tuesday and 20% off." },
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
    sub:"Wednesday — the gym is tendon-free; the day's whole tendon budget is the afternoon's tennis lesson. Push genuinely hard: nothing here touches the knee, and this is where most of the visible three-week progress comes from. WRIST RULE: neutral grips wherever they exist, nothing loading a bent-back wrist, straps or lighter before sore.",
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
    sub:"Freestyle, not breaststroke — that kick bothers knees. Easy means easy: this is the recovery half of the day, not a second workout. After Sunday's Lower C it is half a kilometre and done; on the protected Monday it is the whole day — tendons remodel on the days they aren't being hammered, so the quiet day is doing work even though it doesn't feel like it.",
    exercises:[
      { name:"Freestyle swim", sets:1, fields:["distance","duration","rpe"],
        target:"0.5–1 km easy · Thu up to 1 km · Sun 0.5 km, nothing more",
        note:"Log metres, minutes and how it felt. If the pool is a mess, a long walk does the same job." }
    ]
  },

  {
    id:"peloZ2", name:"Peloton · Zone 2", short:"Peloton",
    accent:"#5BC9BC", unit:"drill", cat:"cardio",
    sub:"Seated only, seat HIGH, light gear at 90+ rpm, no standing climbs — standing loads the tendon hard.",
    exercises:[
      { name:"Peloton ride", sets:1, fields:["duration","rpe"],
        target:"40 min Zone 2 · conversational",
        note:"Zone 2 means you could talk the whole way. Seated, seat high, spin a light gear rather than grinding a big one." }
    ]
  },

  {
    id:"peloEasy", name:"Peloton easy / swim / walk", short:"Easy spin",
    accent:"#5BC9BC", unit:"drill", cat:"cardio",
    sub:"Saturday afternoon: an easy spin, a swim, or a long walk — whichever the day wants. Same bike rules — seated, seat high, light gear, no standing climbs.",
    exercises:[
      { name:"Easy ride or walk", sets:1, fields:["duration","rpe"],
        target:"30 min easy",
        note:"Genuinely easy. The lifting earlier was the day's work." }
    ]
  },

  {
    id:"tennis", name:"Tennis", short:"Tennis",
    accent:"#8FBF6B", unit:"drill", cat:"cardio",
    sub:"Coached lesson, Wednesday and Friday — deliberately on days the tendon is already asked for something: tendons care about how many days a week something big happens, not how much on any one day, and clustering keeps the protected days genuinely protected. Wednesday evening's touch session is coaching only — standing and instructing costs nothing; playing is not on this block.",
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
