/* ============================================================
   ROUTINES DATA — this is the file you edit to change content.
   The engine (app.js) needs no changes for new routines.

   PROVENANCE. Two sources, with different standing:

     CAROLYN (physio, current) — the wrist, left shoulder and plantar fascia
       content is transcribed from her instructions, not paraphrased. If a line
       here disagrees with her, she is right. Her note is in source/.
     PAUL READ (S&C, Jan 2023 – Jul 2024) — the knee content is adapted from
       the "Knee prehab", "Foot / ankle prehab" and "Daily isometrics" cards he
       wrote during the ACL return-to-sport block. Adapted, not transcribed:
       those were aimed at getting back to touch rugby, and this block is aimed
       at a faster mile. Where his wording survives it is kept.

   Anything NOT from one of those two is a judgement call and should say so in
   its cue. Do not invent rehab content for a real knee.

   The left knee is the operated side (2022 ACL reconstruction, patellar tendon
   graft): patellar tendinopathy, a quad that never fully came back, and a
   flexion deficit. Left is also the painful shoulder. When a block says "left",
   it means it.

   Routine fields:
     id          unique string
     name        display name
     short       compact name for the one-line daily summary on Upcoming
     accent      per-routine color
     sub         subtitle on home + detail
     variants    optional array of variant names → a selector appears on the
                 detail screen; blocks are filtered by their `variant` field
     variantTags optional captions under the variant buttons
     variantMode "alternate" → the app defaults to whichever variant you did
                 NOT complete last time; "pick" (default) → remembers the last
                 manual choice
     defaultLevel  starting level index for leveled blocks
     sched       {freq:"daily"} → appears on Today every day.
                 {freq:"onDemand"} → never scheduled; reached from Browse or
                 the "On demand" row at the foot of Today.
     blocks      the exercises, in order

   Block fields:
     group    optional section header shown above this block
     name     exercise name — also the progression key: blocks with the same
              name in one routine share a difficulty level
     badge    req | new | opt | rec  → labeled pill. `opt` also keeps the block
              out of the headline time estimate.
     mode     "time" (counts down, auto-advances) | "reps" (waits for a tap)
     sec      seconds per segment (time mode)
     target   dial label (reps mode)
     sides    2 → runs Left then Right
     sets     n → repeats the whole block n times
     est      reps mode only: rough seconds per segment, for the estimate
     dose     the prescription line
     detail   how-to shown during the move
     cue      the italic coaching note
     levels   optional per-level detail text, overrides `detail`. Progression is
              PER EXERCISE, persisted individually.
     variant  optional index into the routine's `variants` — this block only
              runs in that variant. Omit to run in EVERY variant, which is how
              the daily non-negotiables carry across A and B.
     tag      optional small qualifier next to the name

   BUDGET: the two daily routines are 10 minutes each, 20 minutes together.
   `claude_workspace/tests/durations.html` flags anything over 10.5. Keep it
   honest — a morning routine that quietly grows to fifteen minutes is a
   morning routine that stops happening.
   ============================================================ */

const ROUTINES = [

/* ---------------------------------------------------------------
   1. LOWER — knee & foot. Daily, alternating A/B.
   The wall sit and the calf stretching run every single day; the A/B only
   decides what goes on top. Both of those are the highest-frequency things
   anyone asked for, so neither is allowed to be a variant.
   --------------------------------------------------------------- */
{
  id:"lower", name:"Morning — knee & foot", short:"Knee & foot", accent:"#5BC9BC",
  sched:{freq:"daily"},
  variants:["A — knee","B — foot"],
  variantTags:["flexion & quad","plantar & balance"],
  variantMode:"alternate", defaultLevel:0,
  sub:"Ten minutes, before the day starts. The wall sit and the calf stretching happen every day regardless of which side you land on — Carolyn asked for calf stretching 1–2× daily, so there is a second dose on Browse when you have a spare three minutes. Off the mat: orthotics in any non-supportive shoe, and trial the gel cups to see whether the extra cushion helps.",
  blocks:[

    /* --- every day --- */
    {name:"Wall sit", badge:"req", mode:"time", sec:45, sets:3,
     dose:"3 × 45 sec",
     cue:"Paul's daily isometrics, and the single most evidence-backed thing you can do for a painful patellar tendon. It is also the one that kept getting marked 'missed' — which is exactly why it is first, timed, and not optional. Squash down through the LEFT foot and feel the quad working. Some ache is fine; sharp pain at the front of the knee means come up higher.",
     levels:["Both legs, back on the wall, thighs wherever you can hold 45 sec. Build toward 3 × 60.",
             "Both legs at 90°, 3 × 60 sec.",
             "Staggered stance — most of the weight through the left. 3 × 45–60 sec.",
             "Single leg, left, slightly above 90°. 3 × 45 sec.",
             "Single leg, left, at a true 90°. 3 × 45–60 sec. This is the target."]},

    {name:"Calf stretch — straight leg", badge:"req", mode:"time", sec:45, sides:2,
     dose:"45 sec each side",
     detail:"Hands on the wall, back leg straight, heel driven down and hip pushed forward. Keep the back foot pointing straight ahead — if it drifts out you stretch nothing.",
     cue:"Straight knee puts it through the gastroc. Carolyn's word was TONS, at least once or twice a day, and this is the lever that actually takes tension off the plantar fascia."},

    {name:"Calf stretch — bent knee", badge:"req", mode:"time", sec:30, sides:2,
     dose:"30 sec each side",
     detail:"Same wall position, but bend the back knee and keep the heel down. Smaller, deeper, further down the leg.",
     cue:"Bending the knee takes the gastroc out and puts it through the soleus, which is the one that matters for both the heel and the mile. Two stretches, not one — do not skip the bent-knee version because it feels like less."},

    /* --- A: knee (adapted from Paul Read's Knee prehab card) --- */
    {group:"Knee", variant:0, name:"Quad ball release", mode:"time", sec:90,
     dose:"90 sec, left quad",
     detail:"Ball or roller into the left quad. Park it on a tight spot and slowly bend and straighten the knee over it rather than rolling up and down. Do the outside of the quad too.",
     cue:"Paul's version, and the reason it is a bend-and-straighten rather than a roll: you are trying to get the quad to let go of the flexion range, not to massage it."},

    {group:"Knee", variant:0, name:"Quadruped rock-back", mode:"reps", target:"10 reps · 2 sec", sets:2, est:50,
     dose:"2 × 10, holding 2 sec at the end",
     cue:"Straight off Paul's card, towel and all. Slowly is the whole instruction — this is the exercise that buys back left knee flexion, and it only works at the end of the range where it is uncomfortable.",
     levels:["Hands and knees, rolled towel behind the left knee. Rock the hips back slowly toward the heels, hold 2 sec at the end, come out slowly. 1 × 10.",
             "Same, towel in, 2 × 10.",
             "Same, towel in, 3 × 10.",
             "Towel out — rock back onto the bare heel. 3 × 10.",
             "Paul's replacement once these feel comfortable: reverse nordics. 3 × 6, controlled, stop well short of pain."]},

    {group:"Knee", variant:0, name:"Prone banded knee flexion", mode:"time", sec:40, sides:2,
     dose:"40 sec each side, left first",
     detail:"Face down, band anchored in front of you and looped round the ankle so it pulls the heel toward the backside. Let it draw you in, then add your own pull at the end. Ease into it — do not be aggressive with this one.",
     cue:"Paul prescribed 2 × 30 sec on the ACL side and 1 × 30 on the other; the app gives both sides one longer set, which is the same work with less bookkeeping. The left is the one that matters."},

    {group:"Knee", variant:0, name:"Seated knee flexion", badge:"opt", mode:"reps", target:"10 in · 10 out", sets:2, est:40,
     dose:"2 × (10 flexion + 10 extension), left only",
     detail:"Sitting on the edge of a bench, slide the left heel back underneath you as far as it goes, then straighten all the way out. Ten each way.",
     cue:"Paul had this as a standing item; here it is the bonus round when the rock-backs felt good and you have the extra ninety seconds. Left leg only."},

    /* --- B: foot (Carolyn, transcribed) --- */
    {group:"Foot", variant:1, name:"Ball under the foot", mode:"time", sec:45, sides:2,
     dose:"45 sec each side",
     detail:"Ball or massage gun under the arch. Slow, searching, more pressure on the sore spots and less on the rest.",
     cue:"Carolyn's 'mobilize'. Do it before the balance work, not after — the foot reads the ground better once it has been woken up."},

    {group:"Foot", variant:1, name:"Toe yoga", mode:"reps", target:"10 each way", sides:2, est:40,
     dose:"10 big-toe-only, 10 other-four-only, each foot",
     detail:"Foot flat. Lift ONLY the big toe, keeping the other four down. Then reverse it: four toes up, big toe pinned. Ten of each.",
     cue:"Carolyn's first strengthener. It will look ridiculous and one of the two directions will be genuinely impossible at first — that is the one worth doing."},

    {group:"Foot", variant:1, name:"Single-leg balance · doming", mode:"time", sec:45, sides:2,
     dose:"45 sec each side, barefoot",
     detail:"Barefoot, one leg. Dome the arch — shorten the foot by drawing the ball of the foot toward the heel WITHOUT curling the toes — and hold that shape for the whole set.",
     cue:"Carolyn's 'stabilize'. Paul was after the same thing with the barefoot Y-balance and the short-arch hold. The doming is the exercise; the balancing is just what makes you do it honestly.",
     levels:["Barefoot on the floor, eyes open, arch domed.",
             "Same, eyes closed.",
             "Y-balance: standing on the domed foot, reach the other foot out front, then back-left, then back-right. 5 reaches each direction."]},

    {group:"Foot", variant:1, name:"Towel scrunches", badge:"opt", mode:"reps", target:"3 × 15", sides:2, est:40,
     dose:"3 × 15 each foot",
     detail:"Towel flat on the floor, heel planted, scrunch the towel toward you with the toes.",
     cue:"Carolyn's third strengthener. Optional here only because toe yoga already hits the intrinsics and the twenty minutes has to end somewhere — do it if the foot has been loud."}
  ]
},

/* ---------------------------------------------------------------
   2. UPPER — wrist & shoulder. Daily, alternating A/B.
   All of this is Carolyn's, transcribed. The forearm work and the wrist
   traction run every day; A is release, B is strength.
   --------------------------------------------------------------- */
{
  id:"upper", name:"Morning — wrist & shoulder", short:"Wrist", accent:"#E5A33C",
  sched:{freq:"daily"},
  variants:["A — release","B — strength"],
  variantTags:["soft tissue & stretch","back & chest"],
  variantMode:"alternate", defaultLevel:0,
  sub:"Ten minutes, all of it Carolyn's. The forearm work and the wrist traction happen every day; the A/B alternates between letting the left shoulder go and building the back that holds it there. Release days are the ones that feel like nothing is happening — do them anyway.",
  blocks:[

    /* --- every day --- */
    {name:"Forearm soft tissue", badge:"req", mode:"time", sec:60, sides:2,
     dose:"60 sec each side",
     detail:"Massage gun or scraping tool, and Carolyn was specific: BOTH sides of the forearm. Palm-side from the wrist crease up toward the elbow, then turn the arm over and do the back of the forearm the same way.",
     cue:"Both sides is the instruction people skip — the extensor side is usually the one that is actually angry, and it is the one you cannot see."},

    {name:"Wrist traction squeeze", badge:"req", mode:"time", sec:45, sets:2,
     dose:"2 × 45 sec",
     detail:"Carolyn's words: wrist squeezing for traction, with the wrist extended back. Take the affected wrist in the other hand, wrap round it just below the joint, squeeze and pull gently away from the hand to open the joint up, and hold the wrist bent backward while you do it.",
     cue:"Gentle and sustained, not a wrench. If any of this sends pins and needles into the fingers, back off the extension and ask her before pushing on."},

    /* --- A: release --- */
    {group:"Left shoulder", variant:0, name:"Shoulder ball release", mode:"time", sec:120,
     dose:"2 min, left shoulder",
     detail:"Lie on your back with a ball under the back of the left shoulder — rear delt, the blade, the top of the trap. Let bodyweight do the pressing; move the arm slowly overhead and back to work the ball across the tissue.",
     cue:"Carolyn's soft tissue work for the left shoulder. Lying on your back rather than against a wall is deliberate: you get bodyweight into it and the arm free to move."},

    {group:"Left shoulder", variant:0, name:"Yoga block goal-post", mode:"time", sec:120,
     dose:"2 min",
     detail:"On your back, yoga block lengthways between the shoulder blades so the chest opens over it. Arms out to the sides and bent up at ninety degrees — a goal post. Let gravity take the elbows and the backs of the hands toward the floor. Breathe.",
     cue:"Carolyn's stretch, exactly as written. Two minutes is a long time here and it should be — the position only starts working once you stop bracing against it."},

    {group:"Left shoulder", variant:0, name:"Nerve flossing", mode:"time", sec:45, sides:2,
     dose:"45 sec each side, slow",
     detail:"Arm out to the side at shoulder height, palm up. As you tip the head AWAY from that arm, let the wrist drop; as you bring the head back toward the arm, extend the wrist and reach the fingers away. Slow, smooth, one end to the other.",
     cue:"Carolyn asked for nerve flossing with Alexander Technique — so lead with the neck and the length through the spine, not with the arm. This is a glide, never a stretch: it should never build up or leave anything tingling afterward."},

    /* --- B: strength --- */
    {group:"Back & chest", variant:1, name:"Wall angels", mode:"reps", target:"10 reps · slow", sets:2, est:55,
     dose:"2 × 10, slow",
     detail:"Back against the wall, feet a few inches out, low back flattened. Arms in the goal-post position with the backs of the hands, elbows and wrists touching the wall. Slide the arms up as far as they go WITHOUT the ribs flaring or the hands leaving the wall, then back down.",
     cue:"Carolyn's 'strengthen back and open chest'. Range is not the point — contact with the wall is. Half the height with everything still touching beats the full slide with the back arched.",
     levels:["Standing against the wall.", "Standing, with a 2 sec pause at the top of each rep.",
             "Lying on your back on the floor, which is stricter and gives you nowhere to cheat."]},

    {group:"Back & chest", variant:1, name:"Face pulls", mode:"reps", target:"12–15 reps", sets:3, est:50,
     dose:"3 × 12–15",
     detail:"Band anchored at head height, or the cable at the gym. Pull toward the face, splitting the hands apart at the end and turning the thumbs back. Elbows stay high, level with the shoulders.",
     cue:"The other half of Carolyn's line. Light and clean beats heavy and shrugged — if the traps take over, drop the load. Programmed here as a band at home; it also appears loaded on the Thursday lift, and doing both in one day is fine because it is that light."},

    {group:"Back & chest", variant:1, name:"Open book", mode:"time", sec:45, sides:2,
     dose:"45 sec each side",
     detail:"On your side, knees bent up in front of you, arms stacked out straight. Keeping the knees down, sweep the top arm in a big arc over and behind you and let the chest follow. Breathe out at the end of the range.",
     cue:"For the upper-back tightness — which turns out to be the same story as the left shoulder. Rotation first thing does more for a stiff thoracic spine than any amount of stretching."}
  ]
},

/* ---------------------------------------------------------------
   3–6. ON DEMAND. Never scheduled; reached from Browse.
   --------------------------------------------------------------- */
{
  id:"calf", name:"Calf stretch — second dose", short:"Calf", accent:"#9BB8D3",
  sched:{freq:"onDemand"},
  sub:"Three minutes. Carolyn asked for calf stretching at least once or twice a day and the morning routine only delivers one — this is the other one. Evening, after a run, or any time the heel has been talking.",
  blocks:[
    {name:"Calf stretch — straight leg", badge:"req", mode:"time", sec:60, sides:2,
     dose:"60 sec each side",
     detail:"Hands on the wall, back leg straight, heel driven down, back foot pointing straight ahead.",
     cue:"Longer than the morning version, because this one is not competing with anything."},
    {name:"Calf stretch — bent knee", badge:"req", mode:"time", sec:45, sides:2,
     dose:"45 sec each side",
     detail:"Same position, back knee bent, heel still down.",
     cue:"The soleus. This is the one that goes after a hard track session."},
    {name:"Ball under the foot", mode:"time", sec:45, sides:2,
     dose:"45 sec each side",
     detail:"Ball or massage gun under the arch, slow and searching.",
     cue:"Stretch the calf first, then release the foot — the fascia and the calf are one continuous system and this is the downstream end of it."}
  ]
},

{
  id:"prerun", name:"Before you run", short:"Warm-up", accent:"#8FBF6B",
  sched:{freq:"onDemand"},
  sub:"Paul's warm-up sequence, verbatim, off the MAS session cards. Do this before every track session and before anything with strides in it. Not before an easy jog — just start slow.",
  blocks:[
    {name:"Easy jog", badge:"req", mode:"time", sec:300,
     dose:"5 min at about 50% effort",
     detail:"Genuinely easy. You should be able to hold a conversation the whole way.",
     cue:"Five minutes is what he wrote and five minutes is what it takes — the first two are just moving blood around."},
    {name:"Pogos", mode:"reps", target:"2 × 10", sets:2, est:40,
     dose:"2 × 10",
     detail:"Small, stiff, fast bounces off the ankles. Knees barely bend. Minimal ground contact time.",
     cue:"Wakes up the calf and the tendon before you ask them for anything fast. Land midfoot and let the heel kiss the ground."},
    {name:"A-skips", mode:"reps", target:"1 × 20 m", est:40,
     dose:"20 m",
     detail:"Tall posture, drive the knee up, quick snap of the foot back down under the hip.",
     cue:"Posture is the point — if you are leaning back you are practising the thing that slows you down."},
    {name:"B-skips", mode:"reps", target:"1 × 20 m", est:40,
     dose:"20 m",
     detail:"The A-skip plus a reach: knee up, then extend the lower leg out and pull it back down under you.",
     cue:"The pull-back is the whole exercise. Reaching out and stepping on it is how you get a heel strike."},
    {name:"Strides", badge:"req", mode:"reps", target:"3 × 40 m @ 75%", sets:3, est:50,
     dose:"3 × 40 m at 75%",
     detail:"Build smoothly over the first ten metres, hold relaxed speed for twenty, ease down over the last ten. Walk back between.",
     cue:"75%, not a sprint. This is the bridge between the warm-up and whatever the session is asking for."}
  ]
},

{
  id:"flare", name:"Flare — extra dose", short:"Flare", accent:"#B48EAD",
  sched:{freq:"onDemand"},
  sub:"For a bad morning: the knee sore after a lift, or the first steps out of bed hurting more than usual. Not a replacement for the daily routines — an addition, and a signal to flag it in Notes so next week's programming knows.",
  blocks:[
    {name:"Wall sit", badge:"req", mode:"time", sec:45, sets:3,
     dose:"3 × 45 sec, easier than usual",
     detail:"Higher than you would normally sit, both legs, no heroics.",
     cue:"Counter-intuitive but right: an angry patellar tendon usually wants MORE isometric loading, not rest. Just at a height that does not hurt."},
    {name:"Quad ball release", mode:"time", sec:90,
     dose:"90 sec, left",
     detail:"Ball into the left quad, bending and straightening the knee over the tight spots.",
     cue:"Takes some of the pull off the front of the knee."},
    {name:"Calf stretch — straight leg", mode:"time", sec:60, sides:2, dose:"60 sec each side",
     detail:"Wall, back leg straight, heel down.", cue:"For a loud heel, this and the ball do more than anything else."},
    {name:"Ball under the foot", mode:"time", sec:60, sides:2, dose:"60 sec each side",
     detail:"Ball or massage gun under the arch, slow.",
     cue:"If the first steps in the morning are the problem, do this sitting on the edge of the bed before you stand up."}
  ]
},

{
  id:"release", name:"Recovery & release", short:"Release", accent:"#7FA8C9",
  sched:{freq:"onDemand"},
  sub:"Paul's recovery and release work. An evening after a hard day, or a rest day that still wants something. Nothing here is loaded — if it feels like a workout, slow down.",
  blocks:[
    {name:"Glute ball release", mode:"time", sec:60, sides:2,
     dose:"60 sec each side",
     detail:"Sitting on a ball, ankle crossed over the opposite knee. Find a tight spot and stay on it, moving the knee slowly in and out.",
     cue:"Paul's card opened with this. The glute is usually where the knee's complaints have moved to."},
    {name:"Quad ball release", mode:"time", sec:120,
     dose:"2 min, left",
     detail:"Full two minutes into the left quad, including the outside. Bend and straighten the knee over the tight spots.",
     cue:"His full dose, not the shortened morning version."},
    {name:"Calf foam roll", mode:"time", sec:120, sides:2,
     dose:"2 min each side",
     detail:"Calf over the roller, other leg stacked on top for pressure. Slow, and pause where it bites.",
     cue:"Two to three minutes a side was his number. Long, boring, and the thing that keeps the heel quiet."},
    {name:"Popliteal fossa mobility", mode:"time", sec:60, sides:2,
     dose:"60 sec each side",
     detail:"Thumbs or a small ball into the soft hollow at the back of the knee, gently, bending and straightening the knee as you go.",
     cue:"Straight off Paul's foot and ankle card. Gently is not a figure of speech — there is a lot of nerve and vessel back there."},
    {name:"Banded ankle mobility", badge:"opt", mode:"reps", target:"2 × 10", sides:2, sets:2, est:40,
     dose:"2 × 10 each side",
     detail:"Band round the front of the ankle pulling backward, foot flat on a box, drive the knee forward over the toes and let the ankle bend. Heel stays down.",
     cue:"Ankle range feeds the knee and the foot both. His number, and worth it if the calf work keeps feeling blocked."}
  ]
}

];
