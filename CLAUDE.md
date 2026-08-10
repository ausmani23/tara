# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

Tara's exercise-routine timer PWA — plain HTML/CSS/JS, no framework, no build
step, no dependencies. Deployed to GitHub Pages at
https://ausmani23.github.io/tara/.

It is a **sibling of `ausmani23/routines`**, which is Adaner's version of the
same app. The shell is shared; only `routines.js`, `program.js`, the branding
strings and the icons diverge. Shell fixes should flow between the two:

```sh
git remote add upstream https://github.com/ausmani23/routines.git   # once
git fetch upstream && git log upstream/main --oneline               # what's new
git cherry-pick <sha>                                               # take a fix
```

**Adaner owns and runs this repo. Tara uses the app and never touches the
code.** She logs sessions on her phone, and on Sunday taps **Notes & export →
Copy everything** and sends him the markdown. That export is the only input to
the re-program. There is no backend and no sync; the manual hand-off is the
design.

## The three standing constraints

These are not preferences. Breaking any of them is a real harm, so they come
before anything else in this file.

1. **The app is silent about calories and bodyweight.** Tara has a history of
   disordered eating. She wants the weight loss to come from calorie burn, so
   high-burn sessions are *programmed* — but never labelled, counted, estimated
   or displayed. There is no weight field on the check-in, no calorie field
   anywhere, and no copy that mentions either. `lift.html` asserts this. Do not
   "helpfully" add tracking.

2. **Carolyn's instructions are authoritative and get transcribed, not
   improved.** She is Adaner and Tara's shared physio and the wrist, left
   shoulder and plantar-fascia content is hers, verbatim from `source/notes
   from carolyn.txt`. If something here disagrees with her, she is right. Do
   not invent rehab content for a real knee — an earlier draft of this app had
   made-up median nerve glides in it before her note arrived, and they were
   wrong.

3. **Don't double-count the daily routines.** `routines.js` already loads the
   calf (stretching), the foot and the quad isometrically *every day*. The
   lifting days load the calf and the quad heavy. Replace or leave alone, never
   stack. The one deliberate exception is Carolyn's calf raises off an edge:
   they belong under load, so they live on S1 and are kept out of the mornings
   entirely.

## Who this is for

Tara Menon. 2022 ACL reconstruction with a patellar tendon graft, **left** knee
— and the left knee is the whole story: patellar tendinopathy, a quad that
never fully came back, and a flexion deficit. Plus plantar fasciitis, wrist pain
(carpal tunnel / an old avulsion fracture), and a left shoulder that the brief
first described as "upper back tightness".

She is a long-time high-level touch rugby athlete who rehabbed back to sport
with Paul Read (18 months, TrueCoach, `source/Tara Menon workout log.txt`) and
finished at RFE split squats, drop-jump-to-box-jump and a measured MAS of
3.4 m/s. Then came 2025: three rounds of IVF and a long way off run training.
**She is not a beginner, she is detrained** — program the return, not the
introduction.

Worth knowing about that log: the sessions she marked `missed` were
overwhelmingly the daily prehab. That is the entire argument for this app, and
the reason the prehab is the first thing on the screen every morning.

## Commands

No build, lint, or test step. Development is: edit files, open `index.html`, or
push and check the live URL.

- **Deploy**: `git push` — GitHub Pages serves the repo root from `main`.
- **When any app file changes, bump `CACHE` in `sw.js`** (`tara-v1` →
  `tara-v2`, …). Installed clients only pick up a new version when the cache
  name changes.
- **If a change appears not to have shipped, suspect the cache before the
  code.** Verify what is actually being served
  (`curl -s <url>/app.js | grep …`) rather than re-pushing.
- Test harnesses live in `claude_workspace/tests/` — see the README there.
  `schedule.html` asserts the real `PROGRAM.schedule` is well-formed, so **run
  it after every re-program**. Current state: 238 assertions passing.
- **Never use `--screenshot` at a narrow `--window-size` to check mobile
  layout.** Headless Chrome lays out at a fixed ~500px regardless, so the image
  is a crop of a wider render and looks exactly like a clipping bug. Render
  through a fixed-width iframe instead (`shot-nav.html`).
- The screenshot harnesses need `--allow-file-access-from-files`. Without it
  they still report READY and silently render every frame unseeded.

## Architecture

- `routines.js` — the `ROUTINES` array: the daily prehab. Two 10-minute
  routines that run every morning (`lower` — knee & foot, `upper` — wrist &
  shoulder), plus four on-demand extras. Schema and provenance are documented in
  the file header. This churns far less than `program.js`.
- `program.js` — the `PROGRAM` object: the current training block. **Meant to
  churn** — rewritten every Sunday from that week's export. Past blocks go in
  `PROGRAM_ARCHIVE` at the bottom.
- `schedule.js` — the scheduling layer: dates, the agenda for a day, completion
  lookups, drag overrides. Pure functions, no DOM. Loads **before** `app.js`
  and touches `db` only from inside function bodies.
- `drag.js` — moving a session to another day on Upcoming. Pointer Events, not
  HTML5 drag-and-drop, which does not fire on iOS touch at all.
- `lift.js` — the training engine, for lifting **and** running: set-by-set
  logging, previous-session values as placeholders, ad-hoc exercises, rest
  timer, markdown export. Loads **after** `app.js`.
- `app.js` — audio (`toneAt`/`scheduleAhead`/`say`), screen-wake (`keepAwake`),
  navigation (`go`), rendering
  (`renderToday`/`renderUpcoming`/`renderBrowse`/`renderDetail`), the sequence
  builder (`buildSeq` flattens blocks × sides × sets into `state.seq`), the run
  loop (`loadStep`/`advance`/`resync`), and localStorage persistence.
- `index.html` — eight `<section class="screen">` blocks toggled by an `.on`
  class; no router.
- `sw.js` — cache-first service worker with background refresh.

### `DB_KEY` and `CACHE` must not match the sibling app

localStorage is per-**origin**, not per-path. Both apps are served from
`ausmani23.github.io`, so `tara.v1` (`app.js`) and `tara-v1` (`sw.js`) are what
keep her log and his log from being the same object. Never rename either back.

### The schedule is data, not prose

`PROGRAM.schedule` is an array of `{sid, date, w}` (or `{sid, date, rest:true}`)
and is the **only** statement of what happens when — `PROGRAM.note` must not
re-enumerate the days, or the two will drift on the first re-program. Recurring
work instead carries `sched:{freq:"daily"|"onDemand"}`.

`sid` is stable within a block and is what a drag override and a logged session
are keyed to, so the same workout on two days ticks off independently.

Three areas — **prehab** (every routine, plus the check-in), **strength**,
**running** — set by `cat` on a workout; routines are always prehab. They sort
in that order within a day, which is the order the day actually happens in.

### Three ways in, one screen each

`home` is **Today**, `upcoming` is the day-by-day list, `browse` is everything
by area ignoring the calendar. `go()` renders the screen it switches to.
Dragging on Upcoming writes `db.sched[blockName][sid]` — the app has no backend
and cannot edit `program.js`, so **a move is an override, not an edit**.

### Progression is per exercise, not per routine

`db.exLevels[routineId][blockName]` holds one level per exercise, keyed by block
**name** — so two blocks sharing a name share a level. `exLevel()` falls back to
the legacy routine-wide `db.levels[id]`. Don't reintroduce a routine-wide level
selector.

### A/B routines

A routine with `variants:[...]` filters its blocks through `activeBlocks()`: a
block with **no** `variant` field runs in every variant. That is how the daily
non-negotiables carry across A and B — the wall sit and both calf stretches on
`lower`, the forearm work and wrist traction on `upper`.
`variantMode:"alternate"` makes the app default to whichever variant was *not*
completed last, so A/B rotates on its own.

### Sets are field-driven, not weight/reps/RPE

An exercise declares `fields` and the set row is built from it: omitted means
lifting (`weight/reps/rpe`); a run uses `["distance","duration","rpe"]`; a pain
dial `["rpe"]` with `labels:{rpe:"PAIN"}`. A track day is therefore an ordinary
workout with different fields — **do not add a second engine or screen for
running.**

A stored set carries only the keys its exercise declared, so the shape is a
superset. Anything reading a set back (`fmtLoggedSet`) must format from **which
keys are present**, because the exercise definition is long gone by then.

Exercise `name` is the history key across sessions. `400 m rep` appears in three
different track sessions on purpose — that is how the PREV column carries
forward. Rename one and the history silently stops following it.

### Session budget

The two morning routines are 10 minutes each, 20 together, which is what she
asked for. `routineSeconds()` counts only required blocks; `optionalSeconds()`
counts `badge:"opt"` ones. `claude_workspace/tests/durations.html` flags
anything over 10.5. A morning routine that quietly grows to fifteen minutes is
a morning routine that stops happening.

## Load-bearing invariants (do not refactor away)

- **Wall-clock timing**: segment position is always derived from `Date.now()`
  vs `state.endsAt` in `resync()` — never a per-tick decrement. This is what
  makes backgrounding/lock not drift.
- **Audio scheduled ahead**: cues for a run of timed segments are queued on the
  AudioContext clock (`scheduleAhead`) so they fire even when JS is throttled.
- **Audio unlock**: all sound must stay behind the first-tap `unlockAudio()`;
  iOS produces no audio otherwise.
- **Never use `done` as a bare CSS state class.** `.done` styles the finish
  screen; unscoped it also matches `.bead.done` on the run screen and grows the
  3px progress strip to 16vh as soon as one segment completes. Those rules are
  scoped to `#done`, and `lift.js` marks logged sets `.logged`. There is a
  geometry assertion for this in `lift.html`.
- **Top-level DOM bindings must tolerate a missing element.** Use the `onClick`
  helper, not `$("#x").onclick = …`. The harnesses mount a subset of
  `index.html`, and a `null` here throws during script evaluation, aborting the
  rest of the file — which surfaces as a baffling "cannot access X before
  initialization" from a completely unrelated line.

## `source/` is gitignored, and must stay that way

`source/` holds her coached training log, Carolyn's notes and the original
brief. **This repo is public** — it has to be, GitHub Pages only serves public
repos for free. None of that material goes in a commit.
