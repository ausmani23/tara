/* ============================================================ SCHEDULE ============================================================
   The layer that answers "what am I doing today, and what's next".

   Loaded AFTER routines.js/program.js and BEFORE app.js. It is deliberately
   pure — no DOM, no rendering. It touches `db`/`saveDB` (declared in app.js,
   which evaluates later) only from inside function bodies, never at load time.

   Two kinds of thing get scheduled:
     RECURRING — a routine or workout carrying `sched:{freq:"daily"}`. It is due
       every day, forever. This is the mobility/PT work and the morning check-in.
       A routine may instead carry `sched:{freq:"weekly", days:[…]}` and be due
       on those weekdays only, or `sched:{freq:"gym"}` and be due on the days
       the calendar puts a strength session (the pre-lift prep).
     DATED — an entry in PROGRAM.schedule pinning one workout to one date. This
       is the current training block's calendar — see program.js.

   A dated entry can be moved in-app (drag on the Upcoming screen). The move is
   stored as an override in db.sched, keyed by block name then by `sid`, because
   the app has no backend and cannot write program.js. Overrides therefore
   persist across a re-program; a new block name simply starts empty.
   ============================================================ */

/* Areas, in the order they happen in a day. `check` is its own group on Today
   (it is ten seconds, before anything else) but files under mobility elsewhere. */
const AREAS = {
  check:    { label:"First thing",   cap:"ten seconds, before coffee" },
  mobility: { label:"Mobility & PT", cap:"daily, non-negotiable" },
  strength: { label:"Strength",      cap:"the block" },
  cardio:   { label:"Cardio",        cap:"running and cutting" }
};
/* Labels and captions are program vocabulary ("Mobility & PT" for one person,
   "Prehab" for another), so config.js may override them per area. */
Object.keys((typeof APP !== "undefined" && APP.areas) || {}).forEach(a=>{
  if(AREAS[a]) Object.assign(AREAS[a], APP.areas[a]);
});
const AREA_ORDER = ["check", "mobility", "strength", "cardio"];
/* Everything that isn't a routine declares its area on the workout as `cat`.
   Default to strength so a workout added without one still appears somewhere. */
function areaOf(w){ return (w && w.cat) || "strength"; }
/* Where an area lands on the Browse screen, which has only three sections. */
function browseArea(a){ return a === "check" ? "mobility" : a; }

/* ---------- dates ----------
   Everything is a local "YYYY-MM-DD" key. Local, not UTC: "today" has to mean
   the day you are standing in, and ISO strings sort correctly as text anyway.
   nowMs() is the one seam the harness pins so schedule assertions can be
   written against fixed dates without freezing the clock the timers read. */
function nowMs(){ return window.SCHED_NOW || Date.now(); }
function ymd(ts){
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function todayKey(){ return ymd(nowMs()); }
function keyMs(k){ const [y,m,d] = k.split("-").map(Number); return new Date(y, m-1, d).getTime(); }
/* setDate rather than +86400000 — arithmetic on milliseconds slips an hour
   across a DST boundary and can land you on the same day twice. */
function addDays(k, n){ const d = new Date(keyMs(k)); d.setDate(d.getDate()+n); return ymd(d.getTime()); }
function daysBetween(a, b){ return Math.round((keyMs(b) - keyMs(a)) / 864e5); }
function fmtDay(k){
  return new Date(keyMs(k)).toLocaleDateString([], {weekday:"short", day:"numeric", month:"short"});
}
function fmtDayLong(k){
  return new Date(keyMs(k)).toLocaleDateString([], {weekday:"long", day:"numeric", month:"long"});
}
function relDay(k){
  const n = daysBetween(todayKey(), k);
  return n === 0 ? "Today" : n === 1 ? "Tomorrow" : "";
}
/* Which day of the block a date is, 1-based; null outside the window. */
function blockDay(k){
  if(!PROGRAM.start) return null;
  const n = daysBetween(PROGRAM.start, k) + 1;
  return (n >= 1 && n <= blockLength()) ? n : null;
}
function blockLength(){
  const dates = (PROGRAM.schedule||[]).map(s=>s.date).filter(Boolean).sort();
  if(!dates.length || !PROGRAM.start) return 0;
  return daysBetween(PROGRAM.start, dates[dates.length-1]) + 1;
}

/* ---------- overrides ----------
   db.sched[blockName][sid] = "YYYY-MM-DD". Guarded for the harnesses, which
   sometimes load this file without app.js. */
function overrides(){
  if(typeof db === "undefined" || !db) return {};
  if(!db.sched || typeof db.sched !== "object") db.sched = {};
  const b = PROGRAM.block || "?";
  return (db.sched[b] = db.sched[b] || {});
}
function slotDate(slot){ return overrides()[slot.sid] || slot.date; }
function moveSlot(sid, dateKey){
  overrides()[sid] = dateKey;
  if(typeof saveDB === "function") saveDB();
}
/* Clears every block's overrides, not just the current one — otherwise moves
   made under a block name that no longer exists accumulate forever. */
function resetSchedule(){
  if(typeof db === "undefined" || !db) return;
  db.sched = {};
  if(typeof saveDB === "function") saveDB();
}
function isMoved(slot){ return !!overrides()[slot.sid] && overrides()[slot.sid] !== slot.date; }

/* ---------- what is scheduled ---------- */
function workoutById(id){ return (PROGRAM.workouts||[]).find(w=>w.id===id) || null; }
/* Dated entries with the override already applied. */
function slots(){
  return (PROGRAM.schedule||[]).map(s=>Object.assign({}, s, {date: slotDate(s), moved: isMoved(s)}));
}
function slotsOn(k){ return slots().filter(s=>s.date===k && !s.rest && workoutById(s.w)); }
/* The next dated session strictly after `k`, for the "rest day — next up" line. */
function nextSlotAfter(k){
  return slots().filter(s=>!s.rest && s.date > k && workoutById(s.w))
                .sort((a,b)=>a.date < b.date ? -1 : 1)[0] || null;
}
function nextSlotFor(wid){
  const t = todayKey();
  return slots().filter(s=>s.w===wid && s.date >= t)
                .sort((a,b)=>a.date < b.date ? -1 : 1)[0] || null;
}

/* A routine with no `sched` falls back to the legacy `onDemand` boolean, so an
   older copy of routines.js (or a harness that injects one) still renders. */
function freqOf(r){ return (r.sched && r.sched.freq) || (r.onDemand ? "onDemand" : "daily"); }
function dailyRoutines(){ return ROUTINES.filter(r=>freqOf(r)==="daily"); }
function onDemandRoutines(){ return ROUTINES.filter(r=>freqOf(r)==="onDemand"); }
/* `sched:{freq:"weekly", days:[1,3,5]}` — due on those weekdays only (0 =
   Sunday), for the apps whose sessions are a few fixed days a week. */
const WEEKDAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
function routinesOn(k){
  const wd = new Date(keyMs(k)).getDay();
  return ROUTINES.filter(r=>{
    const f = freqOf(r);
    return f==="daily" || (f==="weekly" && ((r.sched && r.sched.days)||[]).includes(wd))
      || (f==="gym" && isGymDay(k));
  });
}
/* A day with a strength session on the calendar — overrides applied, so a
   lift dragged to Thursday takes its prep with it. */
function isGymDay(k){ return slotsOn(k).some(s=>areaOf(workoutById(s.w))==="strength"); }
/* The routines that vary by day — weekly or gym-day — as opposed to the
   dailies, which Upcoming compresses into one line. */
function datedRoutinesOn(k){ return routinesOn(k).filter(r=>freqOf(r)!=="daily"); }
/* The next weekday routine strictly after k, within a week — the "rest day,
   next up" line for an app whose sessions are routines rather than workouts. */
function nextWeeklyAfter(k){
  for(let i=1;i<=7;i++){
    const d = addDays(k,i), r = routinesOn(d).find(x=>freqOf(x)==="weekly");
    if(r) return { r, date:d };
  }
  return null;
}
/* The Browse screen's when-line: "Every day" / "Mon · Wed · Fri" / "On demand". */
function routineWhen(r){
  const f = freqOf(r);
  if(f==="daily") return "Every day";
  if(f==="weekly") return ((r.sched && r.sched.days)||[]).map(d=>WEEKDAYS[d]).join(" · ");
  if(f==="gym") return "Lift days";
  return "On demand";
}
function dailyWorkouts(){ return (PROGRAM.workouts||[]).filter(w=>w.sched && w.sched.freq==="daily"); }
/* Workouts that are neither daily nor pinned to a date — the spare session. */
function unscheduledWorkouts(){
  const dated = new Set((PROGRAM.schedule||[]).map(s=>s.w));
  return (PROGRAM.workouts||[]).filter(w=>!dated.has(w.id) && !(w.sched && w.sched.freq==="daily"));
}

/* ---------- completion ----------
   Two stores, because routines and strength sessions were never one thing:
   db.log[id] is a flat array of timestamps; db.strength.sessions are objects.
   A workout is matched by `sid` when it has one, so S1 on day 1 and S1 on day 6
   are separately tickable — falling back to the workout id for sessions logged
   before sid existed. */
function routineDoneOn(id, k){
  if(typeof db === "undefined" || !db.log) return false;
  return (db.log[id]||[]).some(ts=>ymd(ts)===k);
}
function workoutDoneOn(wid, sid, k){
  if(typeof db === "undefined" || !db.strength) return false;
  return (db.strength.sessions||[]).some(s=>{
    if(ymd(s.start || s.end) !== k) return false;
    if(sid && s.sid) return s.sid === sid;
    return s.w === wid;
  });
}

/* ---------- the agenda ----------
   One item per thing you could do on a given date, sorted into area order.
   Array.sort is stable, so within an area the declared order survives. */
function routineItem(r, k){
  return { kind:"routine", id:r.id, sid:null, area:"mobility", name:r.name,
           short: r.short || r.name, accent:r.accent, r, done: routineDoneOn(r.id, k) };
}
function workoutItem(w, sid, k){
  return { kind:"workout", id:w.id, sid: sid||null, area: areaOf(w), name:w.name,
           short: w.short || w.name, accent:w.accent, w, done: workoutDoneOn(w.id, sid, k) };
}
function agendaFor(k){
  const out = [];
  dailyWorkouts().forEach(w=>out.push(workoutItem(w, null, k)));
  routinesOn(k).forEach(r=>out.push(routineItem(r, k)));
  slotsOn(k).forEach(s=>{ out.push(workoutItem(workoutById(s.w), s.sid, k)); });
  return out.sort((a,b)=>AREA_ORDER.indexOf(a.area) - AREA_ORDER.indexOf(b.area));
}

/* ---------- the upcoming list ----------
   Today forward: through the end of the block, past it if an override pushed a
   session there, and never fewer than `min` days so the screen is never empty
   once a block finishes. */
function upcomingDays(min){
  const start = todayKey();
  let last = start;
  slots().forEach(s=>{ if(s.date > last) last = s.date; });
  const days = [];
  let k = start;
  for(let guard=0; guard<200; guard++){
    /* Weekly and gym-day routines are what VARIES, so they get cards here;
       the dailies stay on the summary line. */
    const items = datedRoutinesOn(k).map(r=>routineItem(r, k))
      .concat(slotsOn(k).map(s=>Object.assign(workoutItem(workoutById(s.w), s.sid, k), {moved:s.moved})));
    days.push({ key:k, label:fmtDay(k), rel:relDay(k), day:blockDay(k),
                rest: !items.length, items });
    if(k >= last && days.length >= (min||7)) break;
    k = addDays(k, 1);
  }
  return days;
}
/* ---------- export ----------
   The calendar as it ACTUALLY stands, not a list of diffs: the app cannot
   write to program.js, so a drag only exists in localStorage, and this block is
   the only way a move reaches the Sunday re-program. Emitting the effective
   plan rather than the overrides means the reader never has to apply a diff in
   their head to work out what really happened.

   Fenced, because the columns are aligned and markdown would otherwise collapse
   the whitespace. */
function scheduleExportMD(){
  const sched = PROGRAM.schedule || [];
  if(!sched.length) return "_No calendar in this block._\n";
  const rows = sched.map(s=>{
    const to = slotDate(s);
    return { sid:s.sid, from:s.date, to, rest:!!s.rest,
             w: s.w ? workoutById(s.w) : null, moved: to !== s.date };
  });
  /* Both dates, because a move creates a row on the day it landed on AND
     leaves a hole on the day it left. */
  const dates = [...new Set(rows.reduce((a,r)=>a.concat([r.from, r.to]), []))].sort();
  const lines = [];
  dates.forEach(d=>{
    const here = rows.filter(r=>r.to===d && r.w);
    const gone = rows.filter(r=>r.from===d && r.moved && r.w);
    const rest = rows.some(r=>r.to===d && r.rest);
    const n = PROGRAM.start ? daysBetween(PROGRAM.start, d)+1 : null;
    const head = ((n && n>0) ? `Day ${n}` : "").padEnd(7) + fmtDay(d).padEnd(14);
    const note = gone.length
      ? `(${gone.map(r=>`${r.w.name} moved to ${fmtDay(r.to)}`).join("; ")})` : "";
    if(!here.length){
      lines.push((head + (note ? "— " + note : rest ? "rest" : "—")).trimEnd());
      return;
    }
    /* Only report where something went when the day was left EMPTY. On a swap
       the receiving day already says "← moved from", and saying it twice reads
       like two separate moves. */
    here.forEach((r,i)=>{
      lines.push(((i ? "".padEnd(21) : head) + r.w.name.padEnd(30) +
        (workoutDoneOn(r.w.id, r.sid, d) ? "  ✓ done" : "") +
        (r.moved ? `  ← moved from ${fmtDay(r.from)}` : "")).trimEnd());
    });
  });
  return "```\n" + lines.join("\n") + "\n```\n";
}

/* The one-line "Daily · hips · core · mobility · PT" summary Upcoming shows in
   place of repeating four cards on every single day. */
function dailySummary(k){
  const items = agendaFor(k).filter(i=>(i.area === "check" || i.area === "mobility") &&
    (i.kind !== "routine" || freqOf(i.r) === "daily"));
  /* What is LEFT, when a routine is part-way through its batches today. */
  const secs = items.reduce((a,i)=>a + (i.kind !== "routine" ? 0
    : typeof remainingSeconds === "function" ? remainingSeconds(i.r, null, k)
    : typeof routineSeconds === "function" ? routineSeconds(i.r) : 0), 0);
  return { items, left: items.filter(i=>!i.done).length, secs };
}
