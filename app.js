/* ============================================================ ENGINE ============================================================
   Data lives in routines.js (const ROUTINES). This file should not need
   edits for content changes.
   Load-bearing invariants:
   - Wall-clock timing: position derives from Date.now() vs state.endsAt
     (resync()), never from counting ticks. Don't refactor to a decrement.
   - Audio must be unlocked by a user gesture (unlockAudio on Start).
   - Cues for timed runs are scheduled ahead on the AudioContext clock
     (scheduleAhead), so they fire even if JS is throttled in background.
   ============================================================ */
const $ = s => document.querySelector(s);
/* Bind a click only if the element is there. The test harnesses mount a subset
   of index.html, and a null here would throw at top level and abort the rest
   of the file — which is a silent, very confusing failure. */
const onClick = (sel, fn) => { const el = $(sel); if(el) el.onclick = fn; };
const PREP = 5;
/* budget: seconds the next run should fit in (null = everything left today);
   batch: the r.blocks indices the running sequence covers; total: its seconds.
   stack: null for an ordinary routine, else the [{r, v}] parts of a stacked run
   (see the stacks section); run: what buildSeq actually laid out, one
   {r, v, bis} per part, which is what finish() records against. */
let state = { routine:null, variant:0, moves:0, seq:[], i:0, left:0, up:0, total:0, running:false,
  budget:null, batch:[], stack:null, run:[],
  tick:null, wake:null, endsAt:null, startedAt:0, screen:"home", from:"home" };

/* ---------- persistence ----------
   One localStorage key.
   exLevels: per-routine, per-exercise level (keyed by block name, so repeated
             blocks like "Dead bug — 2nd round" share one level).
   levels:   legacy routine-wide level — kept only as a migration fallback.
   variantSel/variantDone: chosen and last-completed variant per routine.
   log: completion timestamps (epoch ms) per routine id.
   part: {routineId: {"YYYY-MM-DD": {v, done:[blockIndex…]}}} — the blocks of
         today's routine already done in an earlier batch (see the batches
         section). Indices into r.blocks; a week of days is kept.
   stacks: {"YYYY-MM-DD": [[routineId, …], …]} — routines dragged onto each
          other on Today, to be run as one. A day's grouping only; a week is kept.
   sched: {blockName: {sid: "YYYY-MM-DD"}} — days a session was dragged to on
          the Upcoming screen. The app has no backend and cannot edit
          program.js, so a move lives here. See schedule.js.
   notes: [{ts, text, ctx?}] — free-text feedback, newest last. Written here and
          read out through the export on the Notes screen; nothing else touches
          them. `ctx` is {kind,id,name} when the note was written from inside a
          routine or workout — see noteCtx below.
   strength: {sessions:[…]} — written by lift.js, see the shape documented there.
   The key comes from config.js: localStorage is per-ORIGIN, not per-path, and
   every sibling app lives on the same origin, so each needs its own. */
const DB_KEY = APP.dbKey;
function loadDB(){
  const def = { sound:true, levels:{}, exLevels:{}, variantSel:{}, variantDone:{}, log:{},
    notes:[], strength:{sessions:[]}, sched:{}, part:{}, stacks:{} };
  try{
    const db = Object.assign(def, JSON.parse(localStorage.getItem(DB_KEY)||"{}"));
    if(!Array.isArray(db.notes)) db.notes = [];
    if(!db.strength || !Array.isArray(db.strength.sessions)) db.strength = {sessions:[]};
    if(!db.part || typeof db.part !== "object") db.part = {};
    if(!db.stacks || typeof db.stacks !== "object") db.stacks = {};
    return db;
  }catch(e){ return def; }
}
const db = loadDB();
/* Batch records are only meaningful on their day; drop anything older than a
   week so the store doesn't grow forever. */
function gcPart(){
  if(!db.part || typeof addDays !== "function") return;
  const cut = addDays(todayKey(), -7);
  Object.keys(db.part).forEach(id=>{
    Object.keys(db.part[id]||{}).forEach(k=>{ if(k < cut) delete db.part[id][k]; });
    if(!Object.keys(db.part[id]||{}).length) delete db.part[id];
  });
  Object.keys(db.stacks||{}).forEach(k=>{ if(k < cut) delete db.stacks[k]; });
}
gcPart();
function saveDB(){ try{ localStorage.setItem(DB_KEY, JSON.stringify(db)); }catch(e){} }

/* What a note is about. Set when a routine or a workout is opened and cleared
   whenever you land back on a list screen — so "Add a note" off the finish
   screen files the note against the session you just did, while the Notes
   button on Today files it against nothing. It is context, not a foreign key:
   the name is copied in, so a note still reads correctly after the block that
   contained the workout has been rewritten. */
let noteCtx = null;
function setNoteCtx(c){ noteCtx = c; }
let sound = db.sound !== false;

const DAY = 864e5;
function dayOf(ts){ const d=new Date(ts); return new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime(); }
function stats(id){
  const ts = db.log[id]||[];
  if(!ts.length) return null;
  const days=[...new Set(ts.map(dayOf))].sort((a,b)=>b-a);
  let streak=0;
  /* nowMs(), not Date.now(): "last done" and "is it done today" have to agree
     about what day it is, and the schedule layer owns that. */
  const today=dayOf(nowMs());
  if(days[0]===today || days[0]===today-DAY){
    streak=1;
    for(let i=1;i<days.length;i++){ if(days[i]===days[i-1]-DAY) streak++; else break; }
  }
  return { count:ts.length, lastDay:days[0], streak };
}
function fmtLast(lastDay){
  const diff=Math.round((dayOf(nowMs())-lastDay)/DAY);
  return diff===0?"today":diff===1?"yesterday":`${diff} days ago`;
}

const NOSLEEP_MP4 = "data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAOIbW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAAA+gAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAArJ0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAA+gAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAEAAAABAAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAAPoAAAAAAABAAAAAAIqbWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAAAyAAAAMgBVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAAB1W1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAZVzdGJsAAAAuXN0c2QAAAAAAAAAAQAAAKlhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAEAAQABIAAAASAAAAAAAAAABFUxhdmM2MC4zMS4xMDIgbGlieDI2NAAAAAAAAAAAAAAAGP//AAAAL2F2Y0MBQsAe/+EAF2dCwB7ZBCbARAAAAwAEAAADAMg8WLkgAQAFaMuDyyAAAAAQcGFzcAAAAAEAAAABAAAAFGJ0cnQAAAAAAAAb+AAAG/gAAAAYc3R0cwAAAAAAAAABAAAAGQAAAgAAAAAUc3RzcwAAAAAAAAABAAAAAQAAABxzdHNjAAAAAAAAAAEAAAABAAAAGQAAAAEAAAB4c3RzegAAAAAAAAAAAAAAGQAAAo8AAAAKAAAACgAAAAoAAAAKAAAACgAAAAoAAAAKAAAACgAAAAoAAAAKAAAACgAAAAoAAAAKAAAACgAAAAoAAAAKAAAACgAAAAoAAAAKAAAACgAAAAoAAAAKAAAACgAAAAoAAAAUc3RjbwAAAAAAAAABAAADuAAAAGJ1ZHRhAAAAWm1ldGEAAAAAAAAAIWhkbHIAAAAAAAAAAG1kaXJhcHBsAAAAAAAAAAAAAAAALWlsc3QAAAAlqXRvbwAAAB1kYXRhAAAAAQAAAABMYXZmNjAuMTYuMTAwAAAACGZyZWUAAAOHbWRhdAAAAnEGBf//bdxF6b3m2Ui3lizYINkj7u94MjY0IC0gY29yZSAxNjQgcjMxMDggMzFlMTlmOSAtIEguMjY0L01QRUctNCBBVkMgY29kZWMgLSBDb3B5bGVmdCAyMDAzLTIwMjMgLSBodHRwOi8vd3d3LnZpZGVvbGFuLm9yZy94MjY0Lmh0bWwgLSBvcHRpb25zOiBjYWJhYz0wIHJlZj0zIGRlYmxvY2s9MTowOjAgYW5hbHlzZT0weDE6MHgxMTEgbWU9aGV4IHN1Ym1lPTcgcHN5PTEgcHN5X3JkPTEuMDA6MC4wMCBtaXhlZF9yZWY9MSBtZV9yYW5nZT0xNiBjaHJvbWFfbWU9MSB0cmVsbGlzPTEgOHg4ZGN0PTAgY3FtPTAgZGVhZHpvbmU9MjEsMTEgZmFzdF9wc2tpcD0xIGNocm9tYV9xcF9vZmZzZXQ9LTIgdGhyZWFkcz0xIGxvb2thaGVhZF90aHJlYWRzPTEgc2xpY2VkX3RocmVhZHM9MCBucj0wIGRlY2ltYXRlPTEgaW50ZXJsYWNlZD0wIGJsdXJheV9jb21wYXQ9MCBjb25zdHJhaW5lZF9pbnRyYT0wIGJmcmFtZXM9MCB3ZWlnaHRwPTAga2V5aW50PTI1MCBrZXlpbnRfbWluPTI1IHNjZW5lY3V0PTQwIGludHJhX3JlZnJlc2g9MCByY19sb29rYWhlYWQ9NDAgcmM9Y3JmIG1idHJlZT0xIGNyZj0yMy4wIHFjb21wPTAuNjAgcXBtaW49MCBxcG1heD02OSBxcHN0ZXA9NCBpcF9yYXRpbz0xLjQwIGFxPTE6MS4wMACAAAAAFmWIhAzyYoAAsLycnJ1111111111114AAAAGQZo4GeEYAAAABkGaVAZ4RgAAAAZBmmAzwjAAAAAGQZqAM8IwAAAABkGaoDPCMAAAAAZBmsAzwjAAAAAGQZrgM8IwAAAABkGbADPCMAAAAAZBmyAzwjAAAAAGQZtAM8IwAAAABkGbYDPCMAAAAAZBm4AzwjAAAAAGQZugM8IwAAAABkGbwDPCMAAAAAZBm+AzwjAAAAAGQZoAM8IwAAAABkGaIDPCMAAAAAZBmkAzwjAAAAAGQZpgM8IwAAAABkGagDPCMAAAAAZBmqAzwjAAAAAGQZrAL8IwAAAABkGa4C/CMAAAAAZBmwArwjA=";

/* ---------- audio ----------
   Cues for timed segments are SCHEDULED AHEAD on the AudioContext clock, so they
   still fire if the phone locks or the tab is backgrounded and JS stops ticking. */
let actx=null, scheduled=[];
/* iOS 16.4+ exposes navigator.audioSession. Declaring the session "ambient"
   lets the beeps MIX with whatever else is playing (music kept pausing
   otherwise). The trade: ambient audio obeys the ringer switch, so beeps are
   silent with the ringer off — accepted, since music + cues together is the
   actual use. On browsers without audioSession the old behavior stands. */
const canAmbient = typeof navigator !== "undefined" && "audioSession" in navigator;
function ctx(){
  if(!actx){
    if(canAmbient){ try{ navigator.audioSession.type = "ambient"; }catch(e){} }
    actx = new (window.AudioContext||window.webkitAudioContext)();
  }
  if(actx.state==="suspended") actx.resume();
  return actx;
}
function toneAt(when, freq, dur, vol){
  if(!sound) return;
  try{
    const c=ctx(), o=c.createOscillator(), g=c.createGain();
    o.type="sine"; o.frequency.value=freq;
    g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(.0001, when+dur);
    o.connect(g); g.connect(c.destination);
    o.start(when); o.stop(when+dur);
    scheduled.push(o);
  }catch(e){}
}
function ping(freq=880, dur=.09, vol=.22){ try{ toneAt(ctx().currentTime+.01, freq, dur, vol); }catch(e){} }
function clearScheduled(){ scheduled.forEach(o=>{ try{o.stop();}catch(e){} }); scheduled=[]; }

/* Schedule every cue from segment `i` forward until a rep-gated segment or the end. */
function scheduleAhead(i, firstEndsAt){
  clearScheduled();
  if(!sound) return;
  let c; try{ c=ctx(); }catch(e){ return; }
  let t = c.currentTime + Math.max(0,(firstEndsAt-Date.now())/1000);
  for(let k=i+1; k<state.seq.length; k++){
    const prev=state.seq[k-1];
    if(prev.mode==="reps") return;
    toneAt(t-3,880,.07,.16); toneAt(t-2,880,.07,.16); toneAt(t-1,880,.07,.16);
    toneAt(t,660,.13,.2);
    const s=state.seq[k];
    if(s.mode==="reps") return;
    t += s.sec;
  }
  toneAt(t-3,880,.07,.16); toneAt(t-2,880,.07,.16); toneAt(t-1,880,.07,.16);
  toneAt(t,760,.14,.25); toneAt(t+.15,1010,.22,.25);
}
/* Legacy path, pre-audioSession iOS only. iOS mutes Web Audio when the ringer
   switch is on silent; looping a silent HTML5 <audio> track during a run
   promotes the session to "media playback", which the mute switch doesn't
   silence — but which also PAUSES other apps' audio, which is why it is
   skipped entirely wherever the ambient audio session above is available. */
let silentEl=null;
function silentWavURL(){ // 0.5 s of silence, 8 kHz mono 16-bit, built in memory
  const rate=8000, n=rate/2, buf=new ArrayBuffer(44+n*2), v=new DataView(buf);
  const w=(o,s)=>{ for(let i=0;i<s.length;i++) v.setUint8(o+i,s.charCodeAt(i)); };
  w(0,"RIFF"); v.setUint32(4,36+n*2,true); w(8,"WAVEfmt ");
  v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,1,true);
  v.setUint32(24,rate,true); v.setUint32(28,rate*2,true);
  v.setUint16(32,2,true); v.setUint16(34,16,true);
  w(36,"data"); v.setUint32(40,n*2,true);
  return URL.createObjectURL(new Blob([buf],{type:"audio/wav"}));
}
function mediaSession(on){
  if(canAmbient) return;   // ambient session already mixes; the loop would pause the music
  try{
    if(on){
      if(!silentEl){ silentEl=new Audio(silentWavURL()); silentEl.loop=true; }
      silentEl.play().catch(()=>{});
    }else if(silentEl){
      // grace period so the end-of-routine chime isn't re-muted mid-play
      setTimeout(()=>{ if(!state.running && silentEl) silentEl.pause(); }, 2500);
    }
  }catch(e){}
}

function unlockAudio(){ try{ ctx(); }catch(e){} }

/* ---------- keeping the screen on ----------
   Wake Lock is the real mechanism but needs a secure context (https:// or localhost).
   Opened as a local file it silently does nothing — hence the looping-video fallback,
   which holds the screen on in Safari and older Android browsers. */
let awakeMode="none";
async function keepAwake(on){
  const v=$("#nosleep");
  if(on){
    try{
      if("wakeLock" in navigator && window.isSecureContext){
        state.wake = await navigator.wakeLock.request("screen");
        awakeMode="wakelock";
      }
    }catch(e){ state.wake=null; }
    if(!state.wake){
      try{ if(!v.src) v.src=NOSLEEP_MP4; await v.play(); awakeMode="video"; }
      catch(e){ awakeMode="none"; }
    }
  }else{
    try{ if(state.wake){ state.wake.release(); state.wake=null; } }catch(e){}
    try{ v.pause(); }catch(e){}
  }
  paintAwakeStatus();
}
function paintAwakeStatus(){
  const el=$("#awakeStatus"); if(!el) return;
  if(window.isSecureContext && "wakeLock" in navigator)
    el.textContent = "Screen-lock prevention: on (wake lock).";
  else if(!window.isSecureContext)
    el.textContent = "Opened as a local file, so the browser won't grant a wake lock. A looping-video fallback is used instead. Host the file over https for the reliable version.";
  else
    el.textContent = "This browser has no wake lock; a looping-video fallback is used instead.";
}
document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="visible" && state.running){ keepAwake(true); resync(); }
});

/* The three list screens. `state.from` remembers which one you opened a routine
   or workout from, so Back returns there instead of always dumping you on
   Today — you can work down the Upcoming list without losing your place. */
const LISTS = ["home","upcoming","browse"];
function go(id){
  if(LISTS.includes(state.screen) && !LISTS.includes(id)) state.from = state.screen;
  state.screen = id;
  document.querySelectorAll(".screen").forEach(s=>s.classList.toggle("on", s.id===id));
  window.scrollTo(0,0);
  if(id!=="run"){ stopTick(); keepAwake(false); clearScheduled(); mediaSession(false); state.running=false; }
  // the accent is set per routine/workout; drop it so a list screen returns to the base teal
  if(LISTS.includes(id)||id==="notes") document.documentElement.style.removeProperty("--signal");
  if(LISTS.includes(id)) noteCtx = null;   // back on a list = no longer inside a session
  if(id==="notes"){ paintNoteCtx(); renderNotes(); }
  if(id==="home"){ renderToday(); applySWReload(); }  // a deploy that landed mid-routine applies here
  if(id==="upcoming") renderUpcoming();
  if(id==="browse") renderBrowse();
  paintNav();
}
function paintNav(){
  document.querySelectorAll(".nav .nv").forEach(b=>
    b.setAttribute("aria-pressed", b.dataset.go === state.screen));
}
document.addEventListener("click", e=>{ const b=e.target.closest("[data-go]"); if(b) go(b.dataset.go); });
document.addEventListener("click", e=>{ if(e.target.closest("[data-back]")) go(state.from||"home"); });

function mmss(t){ const m=Math.floor(t/60), s=t%60; return `${m}:${String(s).padStart(2,"0")}`; }
function fmtMin(t){ return `${Math.round(t/60)} min`; }

/* ---------- per-exercise levels & routine variants ---------- */
function exLevel(r,b){
  if(!b.levels) return 0;
  const ex = db.exLevels[r.id]||{};
  let v = ex[b.name];
  if(v==null) v = b.defaultLevel;           // per-exercise starting point
  if(v==null) v = db.levels[r.id];          // migrate old routine-wide level
  if(v==null) v = r.defaultLevel||0;
  return Math.min(Math.max(v,0), b.levels.length-1);
}
function setExLevel(r,b,v){ (db.exLevels[r.id] = db.exLevels[r.id]||{})[b.name]=v; saveDB(); }
/* A block marked `paused:true` (an item Carolyn has parked) never runs and never
   counts; the detail screen lists it dimmed so the card keeps its text. */
function activeBlocks(r,v){ return r.blocks.filter(b=>!b.paused && (b.variant==null || b.variant===v)); }
function pausedBlocks(r,v){ return r.blocks.filter(b=>b.paused && (b.variant==null || b.variant===v)); }
function defaultVariant(r){
  if(!r.variants) return 0;
  /* A day started in batches stays on the variant it started on. */
  const p = partToday(r);
  if(p && p.v < r.variants.length) return p.v;
  if(r.variantMode==="alternate"){
    const last = db.variantDone[r.id];
    return last==null ? 0 : (last+1)%r.variants.length;
  }
  const sel = db.variantSel[r.id];
  return (sel!=null && sel<r.variants.length) ? sel : 0;
}
function blockSeconds(b){
  const n=(b.sides||1)*(b.sets||1);
  const rest=(b.rest||0)*((b.sets||1)-1);   // between-set rest counts toward the honest total
  return (b.mode==="reps" ? (b.est||60)*n : b.sec*n) + rest;
}
/* Optional blocks are reported separately so the headline time reflects the
   work that actually has to happen — the 10-min-per-session budget. */
function routineSeconds(r, v){
  return activeBlocks(r, v==null?defaultVariant(r):v)
    .filter(b=>b.badge!=="opt").reduce((a,b)=>a+blockSeconds(b),0);
}
function optionalSeconds(r, v){
  return activeBlocks(r, v==null?defaultVariant(r):v)
    .filter(b=>b.badge==="opt").reduce((a,b)=>a+blockSeconds(b),0);
}
/* ---------- batches: a routine in pieces across the day ----------
   "Give me 10 minutes." db.part[routineId][YYYY-MM-DD] = {v, done:[…]} records
   which blocks of today's routine are already behind you — indices into
   r.blocks, because names repeat within a routine (the hip opener runs the
   same three moves three times) and indices don't. A record is OPEN only
   while a REQUIRED block of its variant is still undone. Once every required
   block is in `done`, the day is logged in db.log exactly as a single run
   would be, and the record reads as absent everywhere: "Run again" is the
   whole routine again, an optional tail can never re-log a day, and the
   Upcoming totals for a finished routine don't change. */
const BUDGETS = [300, 600, 900];
/* config.js may switch the budget chips off (`budgets:false`) — the routines
   app stacks whole cards instead (see the stacks section); the batch records
   underneath stay, so "End routine" still keeps what was done. */
function budgetsOn(){ return !(typeof APP !== "undefined" && APP.budgets === false); }
function partRecord(r, k){
  const p = db.part && db.part[r.id] && db.part[r.id][k];
  if(!p || !Array.isArray(p.done)) return null;
  const v = r.variants ? Math.min(p.v||0, r.variants.length-1) : 0;
  const open = activeBlocks(r, v).some(b=>b.badge!=="opt" && !p.done.includes(r.blocks.indexOf(b)));
  return open ? p : null;
}
function partToday(r){ return partRecord(r, todayKey()); }
/* The active blocks not yet done on day k, in routine order, as {b, bi}. */
function remainingBlocks(r, v, k){
  const p = partRecord(r, k==null ? todayKey() : k), done = p ? p.done : [];
  return activeBlocks(r, v).map(b=>({b, bi:r.blocks.indexOf(b)})).filter(x=>!done.includes(x.bi));
}
function remainingSeconds(r, v, k){
  if(v==null) v = defaultVariant(r);
  return remainingBlocks(r, v, k).filter(x=>x.b.badge!=="opt").reduce((a,x)=>a+blockSeconds(x.b),0);
}
/* The prefix of what's left that fits `budget` seconds: keep adding blocks
   while the running total is still under budget, so a batch is never empty
   and ends just past the mark rather than well short of it. A null budget is
   everything left. */
function pickBatch(r, v, budget){
  const rem = remainingBlocks(r, v);
  if(budget==null) return rem;
  const out=[]; let t=0;
  for(const x of rem){ if(t >= budget) break; out.push(x); t += blockSeconds(x.b); }
  return out;
}
function recordProgress(r, v, bis){
  const k = todayKey();
  db.part = db.part || {};
  const byId = db.part[r.id] = db.part[r.id] || {};
  const p = byId[k] = byId[k] || { v, done:[] };
  p.v = v;
  bis.forEach(bi=>{ if(!p.done.includes(bi)) p.done.push(bi); });
  saveDB();
}
function badgeHTML(b){
  if(!b.badge) return "";
  const map={req:["req","non-negotiable"],new:["new","new"],opt:["opt","optional"],rec:["rec","recommended"]};
  const m=map[b.badge]; return m?`<span class="badge ${m[0]}">${m[1]}</span>`:"";
}
function didHTML(id){
  const st=stats(id);
  if(!st) return `<div class="did">Not yet logged</div>`;
  return `<div class="did">Last done <b>${fmtLast(st.lastDay)}</b> · <b>${st.count}×</b> total` +
    (st.streak>1?` · <span class="streak">${st.streak}-day streak</span>`:"") + `</div>`;
}
/* `opts.done` dims the card and adds a tick; `opts.when` appends a scheduling
   line. Both are optional so a plain cardHTML(r) still works. */
function cardHTML(r, opts){
  opts = opts || {};
  const v = defaultVariant(r), part = partToday(r);
  /* Part-way through today's batches the card shows what is LEFT, not the
     whole routine. */
  const time = part ? `${fmtMin(remainingSeconds(r,v))} left` : fmtMin(routineSeconds(r,v));
  /* Skip the variant chip when the variant is just named for its length
     (core's "5 min"), so the card doesn't read "5 min · 5 min". */
  const showVariant = r.variants && r.variants[v] !== time;
  return `
    <button class="card${opts.done?" is-done":""}${part?" is-part":""}" data-r="${r.id}" style="--accent:${r.accent}">
      ${opts.done?`<span class="tickmark">✓</span>`:part?`<span class="tickmark part">◐</span>`:""}
      <h2>${r.name}</h2><div class="sub">${r.sub}</div>
      <div class="meta"><span><b>${time}</b>${!part && optionalSeconds(r,v)?` +${fmtMin(optionalSeconds(r,v))} opt`:""}</span>
      <span class="moves"><b>${part ? remainingBlocks(r,v).length : activeBlocks(r,v).length}</b> moves</span>
      ${showVariant?`<span><b>${r.variants[v]}</b>${part?" in progress":r.variantMode==="alternate"?" next":""}</span>`:""}</div>
      ${opts.when?`<div class="whenline">${opts.when}</div>`:""}
      ${didHTML(r.id)}
    </button>`;
}
/* One agenda item → a card. Workout cards come from lift.js, which loads after
   this file — the guard is what keeps the test harnesses (which mount a subset)
   from throwing. */
function itemCardHTML(it, opts){
  opts = Object.assign({done: it.done, sid: it.sid}, opts||{});
  if(it.kind === "routine") return cardHTML(it.r, opts);
  return typeof workoutCardHTML === "function" ? workoutCardHTML(it.w, opts) : "";
}
function wireCards(host){
  if(!host) return;
  host.querySelectorAll("[data-r]").forEach(el=>{ el.onclick=()=>openDetail(el.dataset.r); });
  if(typeof openLift === "function")
    host.querySelectorAll("[data-w]").forEach(el=>{ el.onclick=()=>openLift(el.dataset.w, el.dataset.sid||null); });
}

/* ---------- stacks: routines run as one ----------
   The daily work is filed in buckets — hips, core, mobility, PT, pre-gym —
   each its own card, so a day can be done in pieces. When there is time for
   more than one, a card is dragged (by its grip) onto another and the two
   become a STACK: one card, one run, straight through, logged as each of its
   members. db.stacks[YYYY-MM-DD] = [[id, id, …], …] — a grouping for the day,
   nothing more; the routines themselves are untouched, and a member that is
   no longer due (a program change, a lift dragged off the day) simply drops
   out. Stacking is Today-only: Upcoming and Browse never see it. */
function stacksOn(k){
  if(!db.stacks || typeof db.stacks !== "object") db.stacks = {};
  const due = new Set(routinesOn(k).map(r=>r.id));
  return (db.stacks[k]||[]).map(ids=>ids.filter(id=>due.has(id))).filter(ids=>ids.length>=2);
}
/* Drop `fromId` onto `to`: a routine id (a new stack of the two, or that
   routine's existing stack) or "#n" (the n-th stack card). The dragged card
   leaves whatever stack it was in first, so a routine is never in two. */
function stackOnto(fromId, to, k){
  k = k || todayKey();
  const stacks = stacksOn(k).map(ids=>ids.filter(id=>id!==fromId));
  if(String(to).charAt(0)==="#"){ const i=+String(to).slice(1); if(stacks[i]) stacks[i].push(fromId); }
  else if(to && to!==fromId){
    const i = stacks.findIndex(ids=>ids.includes(to));
    if(i>=0) stacks[i].push(fromId); else stacks.push([to, fromId]);
  }
  db.stacks[k] = stacks.filter(ids=>ids.length>=2);
  saveDB();
}
function unstack(i, k){
  k = k || todayKey();
  db.stacks[k] = stacksOn(k).filter((_,j)=>j!==i);
  saveDB();
}
/* Reorder inside a stack: member `p` moves one place up (dir -1) or down.
   The order is the order the run happens in. */
function moveInStack(i, p, dir, k){
  k = k || todayKey();
  const stacks = stacksOn(k), ids = stacks[i]; if(!ids) return false;
  const q = p + dir; if(q < 0 || q >= ids.length) return false;
  [ids[p], ids[q]] = [ids[q], ids[p]];
  db.stacks[k] = stacks; saveDB();
  return true;
}
function stackName(parts){ return parts.map(p=>p.r.short||p.r.name).join(" + "); }
/* The mobility group with today's stacks folded in: a stack sits where its
   first member would, and every other unfinished routine card gets a grip so
   it can be dragged onto another. Workouts (the check-in) and finished cards
   are left as they are. */
function stackEntries(list, k){
  const stacks = stacksOn(k), where = new Map();
  stacks.forEach((ids,i)=>ids.forEach(id=>where.set(id,i)));
  const out=[], placed=new Set();
  list.forEach(it=>{
    if(it.kind!=="routine"){ out.push({done:it.done, html:itemCardHTML(it)}); return; }
    const si = where.get(it.id);
    if(si!=null){
      if(placed.has(si)) return;
      placed.add(si);
      const members = stacks[si].map(id=>list.find(x=>x.id===id)).filter(Boolean);
      out.push({done: members.every(m=>m.done), html: stackCardHTML(members, si)});
      return;
    }
    out.push({done:it.done, html: it.done ? cardHTML(it.r,{done:true}) : stackableHTML(it)});
  });
  return out;
}
function stackableHTML(it){
  return `<div class="slot stackable" data-stackdrop="${it.id}">${cardHTML(it.r)}
    <button class="grip" data-stackgrip="${it.id}" aria-label="Drag ${esc(it.name)} onto another routine to stack them">⠿</button></div>`;
}
function stackCardHTML(members, si){
  const done = members.every(m=>m.done);
  let secs=0, moves=0;
  members.forEach(m=>{
    if(m.done) return;
    const v = defaultVariant(m.r), part = partToday(m.r);
    secs  += part ? remainingSeconds(m.r,v) : routineSeconds(m.r,v);
    moves += part ? remainingBlocks(m.r,v).length : activeBlocks(m.r,v).length;
  });
  const names = members.map(m=>m.r.short||m.r.name).join(" + ");
  return `<div class="slot stack" data-stackdrop="#${si}">
    <button class="card is-stack${done?" is-done":""}" data-stack="${si}" style="--accent:${members[0].r.accent}">
      ${done?`<span class="tickmark">✓</span>`:""}
      <h2>${esc(names)}</h2>
      <div class="sub">Stacked for today — one run, logged as ${members.length}.</div>
      <div class="members">${members.map(m=>`<span class="member${m.done?" is-done":""}" style="--accent:${m.r.accent}">${esc(m.r.short||m.r.name)}${m.done?" ✓":""}</span>`).join("")}</div>
      <div class="meta"><span><b>${done?"done":fmtMin(secs)}</b></span><span class="moves"><b>${moves}</b> moves</span></div>
    </button>
    <button class="grip unstack" data-unstack="${si}" aria-label="Unstack ${esc(names)}">✕</button>
  </div>`;
}
function wireStacks(host){
  if(!host) return;
  host.querySelectorAll("[data-stack]").forEach(el=>{ el.onclick=()=>openStack(+el.dataset.stack); });
  host.querySelectorAll("[data-unstack]").forEach(el=>{ el.onclick=()=>{ unstack(+el.dataset.unstack); renderToday(); }; });
}

/* ---------- Today ----------
   Everything due on this date, grouped by area in the order you do it:
   check-in, then mobility & PT, then whatever the block asks for. Finished
   items sink to the bottom of their group rather than disappearing, so the
   screen still reads as a record of the day at 9pm. */
function renderToday(){
  const host = $("#cards"); if(!host) return;
  const k = todayKey(), items = agendaFor(k);
  const line = $("#dayLine");
  if(line){
    const n = blockDay(k), len = blockLength();
    line.textContent = fmtDayLong(k) + (n ? ` · day ${n} of ${len}` : "");
  }
  const groups = AREA_ORDER.map(a=>({a, list:items.filter(i=>i.area===a)})).filter(g=>g.list.length);
  const trained = items.some(i=>i.area==="strength"||i.area==="cardio");
  host.innerHTML = groups.map(g=>{
    const entries = g.a==="mobility" ? stackEntries(g.list, k)
      : g.list.map(it=>({done:it.done, html:itemCardHTML(it)}));
    const left = entries.filter(e=>!e.done), done = entries.filter(e=>e.done);
    const cap = left.length ? AREAS[g.a].cap : "all done";
    return `<div class="area"><p class="col-h">${AREAS[g.a].label} <s>${cap}</s></p>
      ${[...left, ...done].map(e=>e.html).join("")}</div>`;
  }).join("") + (trained ? "" : restTodayHTML(k)) + onDemandHTML();
  wireCards(host); wireStacks(host);
  if(typeof initStackDrag === "function") initStackDrag(host);
}
function restTodayHTML(k){
  const nx = nextSlotAfter(k), w = nx && workoutById(nx.w);
  let next = w ? ` Next up · <b>${w.name}</b>, ${relDay(nx.date)||fmtDay(nx.date)}.` : "";
  if(!next && typeof nextWeeklyAfter === "function"){
    const nw = nextWeeklyAfter(k);   // apps whose sessions are weekday routines
    if(nw) next = ` Next up · <b>${nw.r.name}</b>, ${relDay(nw.date)||fmtDay(nw.date)}.`;
  }
  return `<div class="area"><p class="col-h">Training <s>rest day</s></p>
    <p class="restline">Nothing programmed today.${next}</p></div>`;
}
function onDemandHTML(){
  const rs = onDemandRoutines(), ws = unscheduledWorkouts();
  if(!rs.length && !ws.length) return "";
  return `<div class="area ondemand"><p class="col-h">On demand <s>when it's called for</s></p>
    <div class="cols">${rs.map(r=>`<div>${cardHTML(r)}</div>`).join("")}
    ${ws.map(w=>`<div>${typeof workoutCardHTML==="function"?workoutCardHTML(w):""}</div>`).join("")}</div></div>`;
}
/* renderHome is still the name the finish screen and the toggles call. */
function renderHome(){ renderToday(); paintNav(); }

/* ---------- Upcoming ----------
   Day by day, today first. The daily work is one grey line per day instead of
   four repeated cards — the point of this screen is what VARIES. */
function renderUpcoming(){
  const host = $("#upDays"); if(!host) return;
  const blk = $("#upBlock");
  if(blk) blk.textContent = PROGRAM.block || "";
  const note = $("#upNote");
  /* Split on blank lines rather than setting textContent: a note that runs to
     more than one paragraph — rationale, then substitution rules, then what to
     do when something hurts — otherwise renders as one unreadable wall. A
     single-paragraph note is unaffected. esc() first: this is still data, not
     markup. */
  if(note) note.innerHTML = (PROGRAM.note || "").split(/\n\s*\n/)
    .map(p=>`<span class="para">${esc(p.trim())}</span>`).join("");
  host.innerHTML = upcomingDays(10).map(d=>{
    const s = dailySummary(d.key);
    const names = s.items.map(i=>i.short).join(" · ");
    /* Weekly and gym-day routines are cards (they are what varies); only a
       dated session gets a grip, since only a session can be moved. */
    return `<div class="day" data-day="${d.key}">
      <p class="day-h"><b>${d.rel || d.label}</b>
        <s>${d.rel ? d.label : ""}${d.day?`${d.rel?" · ":""}day ${d.day}`:""}</s></p>
      ${s.items.length ? `<p class="dailyline">${s.left ? "Daily" : "Daily ✓"} · ${names}${s.secs?` <b>${fmtMin(s.secs)}</b>`:""}</p>` : ""}
      ${d.items.length
        ? d.items.map(it=>it.kind==="routine" ? cardHTML(it.r, {done:it.done}) : slotHTML(it)).join("")
        : s.items.length
          ? ((PROGRAM.schedule||[]).length ? `<p class="restline">Rest · dailies only</p>` : "")
          : `<p class="restline">Rest day</p>`}
    </div>`;
  }).join("");
  wireCards(host);
  if(typeof initDrag === "function") initDrag(host);
}
function slotHTML(it){
  return `<div class="slot${it.moved?" moved":""}" data-sid="${it.sid}">
    ${itemCardHTML(it)}
    <button class="grip" data-grip="${it.sid}" aria-label="Move ${esc(it.name)} to another day">⠿</button>
  </div>`;
}

/* ---------- Browse ----------
   Every routine and every workout, filed by area, ignoring the calendar. The
   only screen where nothing is ever hidden. */
function renderBrowse(){
  const host = $("#brBody"); if(!host) return;
  const cnt = $("#brCount");
  if(cnt) cnt.textContent = `${ROUTINES.length + (PROGRAM.workouts||[]).length} in all`;
  const secs = [
    /* The check-in is a workout by machinery but a daily rehab item by nature,
       so it heads this section rather than getting a group of its own. */
    { key:"mobility", cap:"daily unless marked on demand",
      cards: (PROGRAM.workouts||[]).filter(w=>browseArea(areaOf(w))==="mobility").map(w=>({w}))
               .concat(ROUTINES.filter(r=>freqOf(r)!=="onDemand").map(r=>({r})), onDemandRoutines().map(r=>({r}))) },
    { key:"strength", cap: PROGRAM.block || "",
      cards: (PROGRAM.workouts||[]).filter(w=>areaOf(w)==="strength").map(w=>({w})) },
    { key:"cardio", cap:"running, cutting and grids",
      cards: (PROGRAM.workouts||[]).filter(w=>areaOf(w)==="cardio").map(w=>({w})) }
  ];
  host.innerHTML = secs.filter(s=>s.cards.length).map(s=>
    `<div class="area"><p class="col-h">${AREAS[s.key].label} <s>${esc(s.cap)}</s></p>
      ${s.cards.map(c=>c.r ? cardHTML(c.r, {when: routineWhen(c.r)})
                           : browseWorkoutHTML(c.w)).join("")}</div>`).join("");
  wireCards(host);
}
function browseWorkoutHTML(w){
  if(typeof workoutCardHTML !== "function") return "";
  const nx = nextSlotFor(w.id);
  const when = w.sched && w.sched.freq === "daily" ? "Every day"
    : nx ? `Next · ${relDay(nx.date) || fmtDay(nx.date)}`
    : "Not scheduled";
  return workoutCardHTML(w, {when});
}

function nowStr(){ $("#clockNow").textContent = new Date().toLocaleTimeString([],{hour:"numeric",minute:"2-digit"}); }

function openDetail(id){
  const r = ROUTINES.find(x=>x.id===id);
  state.routine=r; state.stack=null;
  state.variant=defaultVariant(r);
  state.budget=null;                       // every open starts on "all that's left"
  setNoteCtx({ kind:"routine", id:r.id, name:r.name });
  renderDetail(); go("detail");
}
/* A stack opens as one detail screen: each member's steps under its own
   heading, numbered straight through, with its variant picker where it has
   one. Members already logged today are shown but skipped by the run. */
function openStack(i){
  const ids = stacksOn(todayKey())[i]; if(!ids) return;
  const parts = ids.map(id=>ROUTINES.find(r=>r.id===id)).filter(Boolean).map(r=>({r, v:defaultVariant(r)}));
  if(parts.length<2) return;
  state.stack=parts; state.stackIdx=i; state.routine=parts[0].r; state.variant=parts[0].v; state.budget=null;
  setNoteCtx({ kind:"stack", id:ids.join("+"), name:stackName(parts) });
  renderDetail(); go("detail");
}
/* The parts on the detail screen — the stack, or the one routine as a list of one. */
function detailParts(){ return state.stack || [{r:state.routine, v:state.variant}]; }
function variantPickerHTML(r, v, locked, p){
  return `<div class="levels">` + r.variants.map((n,i)=>
    `<button class="lvl" data-v="${i}" data-p="${p}" aria-pressed="${i===v}"${locked&&i!==v?" disabled":""}><b>${n}</b><s>${(r.variantTags&&r.variantTags[i])||"&nbsp;"}</s></button>`).join("") + `</div>` +
    (locked ? `<p class="label partnote">${r.variants[v]} · in progress — finish today's batches first</p>` : "");
}
/* One routine's step list. `n0` is the move number to count on from (a stack
   numbers straight through); `p` tags the level chips with their part. */
function stepsHTML(r, v, doneSet, batchSet, n0, p){
  const blocks = activeBlocks(r, v);
  let html = blocks.map((b,i)=>{
    const bi = r.blocks.indexOf(b);
    const cls = doneSet.has(bi) ? " is-done" : batchSet.has(bi) ? "" : " is-later";
    const dose = b.dose || (b.sides? `${b.sec}s × ${b.sides}` : `${b.sec}s`);
    const lvl = exLevel(r,b);
    const line = b.levels? b.levels[lvl] : (b.detail||"");
    const chips = b.levels? `<div class="exlvls">`+b.levels.map((_,li)=>
      `<button class="exl" data-p="${p}" data-ex="${i}" data-l="${li}" aria-pressed="${li===lvl}">L${li+1}</button>`).join("")+`</div>` : "";
    return (b.group?`<p class="group">${b.group}</p>`:"") +
      `<div class="step${cls}"><div class="n">${doneSet.has(bi)?"✓":n0+i+1}</div><div class="body">
        <div class="nm">${b.name}${b.tag?` <span style="color:var(--dimmer);font-weight:400">· ${b.tag}</span>`:""}${badgeHTML(b)}</div>
        <div class="dose">${dose}${b.mode==="reps"?" · tap to advance":""}</div>
        <div class="lv">${line}</div>
        ${b.cue?`<div class="cue">${b.cue}</div>`:""}
        ${b.link?`<a class="steplink" href="${b.link.url}" target="_blank" rel="noopener">${b.link.label} ↗</a>`:""}
        ${chips}</div></div>`;
  }).join("");
  const paused = pausedBlocks(r, v);
  if(paused.length) html += `<p class="group paused">Paused — not run</p>` + paused.map(b=>
    `<div class="step is-paused"><div class="n">–</div><div class="body">
      <div class="nm">${b.name}${badgeHTML(b)}</div>
      <div class="dose">${b.dose||""}</div>
      ${b.cue?`<div class="cue">${b.cue}</div>`:""}</div></div>`).join("");
  return html;
}
function wireDetail(){
  document.querySelectorAll("#detail [data-v]").forEach(el=>{ el.onclick=()=>{
    const p = detailParts()[+el.dataset.p]; if(!p || partToday(p.r)) return;
    p.v = +el.dataset.v;
    if(!state.stack) state.variant = p.v;
    if(p.r.variantMode!=="alternate"){ db.variantSel[p.r.id]=p.v; saveDB(); }
    renderDetail(); }; });
  document.querySelectorAll("#dSteps .exl").forEach(el=>{ el.onclick=()=>{
    const p = detailParts()[+el.dataset.p]; if(!p) return;
    setExLevel(p.r, activeBlocks(p.r,p.v)[+el.dataset.ex], +el.dataset.l); renderDetail(); }; });
}
function renderDetail(){
  if(state.stack) return renderStackDetail();
  const r=state.routine;
  $("#dName").textContent=r.name; $("#dSub").textContent=r.sub;
  document.documentElement.style.setProperty("--signal", r.accent);

  /* A day begun in batches is locked to its variant: the other buttons stay
     visible but disabled, so the picker still reads as the picker. */
  const part = partToday(r), locked = !!part;
  let head = r.variants ? variantPickerHTML(r, state.variant, locked, 0) : `<p class="label">The circuit</p>`;
  /* "How long have you got?" — only the budgets that are actually shorter
     than what's left, so a 5-minute routine shows no row at all. */
  const remSecs = remainingSeconds(r, state.variant);
  const budgets = budgetsOn() ? BUDGETS.filter(s=>s < remSecs) : [];
  if(budgets.length){
    head += `<p class="label">How long have you got?</p><div class="levels budgets">` +
      budgets.map(s=>`<button class="lvl" data-budget="${s}" aria-pressed="${state.budget===s}"><b>${fmtMin(s)}</b><s>&nbsp;</s></button>`).join("") +
      `<button class="lvl" data-budget="" aria-pressed="${state.budget==null}"><b>All</b><s>${fmtMin(remSecs)}${part?" left":""}</s></button></div>`;
  }
  $("#dLevels").innerHTML = head;
  $("#dLevels").querySelectorAll("[data-budget]").forEach(el=>{ el.onclick=()=>{
    state.budget = el.dataset.budget==="" ? null : +el.dataset.budget;
    renderDetail(); }; });

  const doneSet = new Set(part ? part.done : []);
  const batch = pickBatch(r, state.variant, state.budget);
  $("#dSteps").innerHTML = stepsHTML(r, state.variant, doneSet, new Set(batch.map(x=>x.bi)), 0, 0);
  wireDetail();
  const opt=optionalSeconds(r,state.variant);
  if(!part && state.budget==null){
    $("#btnStart").textContent = `Start routine · ${fmtMin(routineSeconds(r,state.variant))}` +
      (opt?` +${fmtMin(opt)} opt`:"");
  }else{
    /* The ACTUAL batch length, so a budget that overshoots by a block is
       visible before the tap. */
    const secs = batch.reduce((a,x)=>a+blockSeconds(x.b),0);
    $("#btnStart").textContent = `${part?"Continue":"Start"} · ${batch.length} move${batch.length===1?"":"s"} · ${fmtMin(secs)}`;
  }
}
function renderStackDetail(){
  const parts = state.stack, k = todayKey();
  $("#dName").textContent = stackName(parts);
  $("#dSub").textContent = `Stacked for today — one run, logged as ${parts.length}. ` +
    parts.map(p=>`${p.r.short||p.r.name} ${routineDoneOn(p.r.id,k) ? "done" : fmtMin(remainingSeconds(p.r,p.v))}`).join(" · ") + ".";
  document.documentElement.style.setProperty("--signal", parts[0].r.accent);
  $("#dLevels").innerHTML = "";
  let n = 0;
  $("#dSteps").innerHTML = parts.map((p,pi)=>{
    const part = partToday(p.r), done = routineDoneOn(p.r.id, k);
    const doneSet = new Set(part ? part.done : []);
    const rem = done ? [] : remainingBlocks(p.r, p.v);
    /* ▲▼ reorder the members — the order is the order the run happens in. */
    const arrows = `<span class="stackmoves"><button class="exmove" data-sm="${pi}" data-dir="-1" aria-label="Move ${esc(p.r.short||p.r.name)} earlier"${pi===0?" disabled":""}>▲</button><button class="exmove" data-sm="${pi}" data-dir="1" aria-label="Move ${esc(p.r.short||p.r.name)} later"${pi===parts.length-1?" disabled":""}>▼</button></span>`;
    let html = `<p class="stackhead" style="--accent:${p.r.accent}"><span>${esc(p.r.name)}</span> <s>${done ? "done today — skipped" : fmtMin(remainingSeconds(p.r,p.v))}</s>${arrows}</p>`;
    if(p.r.variants && !done) html += variantPickerHTML(p.r, p.v, !!part, pi);
    html += stepsHTML(p.r, p.v, done ? new Set(activeBlocks(p.r,p.v).map(b=>p.r.blocks.indexOf(b))) : doneSet,
                      new Set(rem.map(x=>x.bi)), n, pi);
    n += activeBlocks(p.r,p.v).length;
    return `<div class="stackpart">${html}</div>`;
  }).join("");
  wireDetail();
  $("#dSteps").querySelectorAll("[data-sm]").forEach(el=>{ el.onclick=()=>{
    const p = +el.dataset.sm, dir = +el.dataset.dir;
    if(!moveInStack(state.stackIdx, p, dir)) return;
    [parts[p], parts[p+dir]] = [parts[p+dir], parts[p]];
    state.routine = parts[0].r; state.variant = parts[0].v;
    ping(700,.06,.12); renderDetail(); }; });
  const live = parts.filter(p=>!routineDoneOn(p.r.id,k));
  const moves = live.reduce((a,p)=>a+remainingBlocks(p.r,p.v).length,0);
  const secs  = live.reduce((a,p)=>a+remainingSeconds(p.r,p.v),0);
  $("#btnStart").textContent = live.length
    ? `Start stack · ${moves} move${moves===1?"":"s"} · ${fmtMin(secs)}`
    : `Run the stack again · ${fmtMin(parts.reduce((a,p)=>a+routineSeconds(p.r,p.v),0))}`;
}

/* The sequence covers this run's BATCH — what's left today, cut to the
   budget — not necessarily the whole routine; for a stack, what's left of
   every member not already logged today, one after another (or the whole
   stack again once all of them are). Each work step carries `rid` and `bi`
   (which routine, which index into its blocks — what gets recorded as done)
   and `block` (its position in the run, for "Move 3 of 7"). */
function buildSeq(){
  const seq=[], all = state.stack ? state.stack.map(p=>({r:p.r, v:p.v})) : [{r:state.routine, v:state.variant}];
  const whole = p => activeBlocks(p.r,p.v).map(b=>({b, bi:p.r.blocks.indexOf(b)}));
  let plan = all.map(p=>({p, batch:
      state.stack ? (routineDoneOn(p.r.id, todayKey()) ? [] : remainingBlocks(p.r,p.v))
                  : pickBatch(p.r, p.v, state.budget)}))
    .filter(x=>x.batch.length);
  if(!plan.length) plan = all.map(p=>({p, batch:whole(p)}));    // "Run again": the lot
  state.run   = plan.map(x=>({r:x.p.r, v:x.p.v, bis:x.batch.map(y=>y.bi)}));
  state.batch = state.run[0].bis;
  state.moves = plan.reduce((a,x)=>a+x.batch.length,0);
  state.total = plan.reduce((a,x)=>a+x.batch.reduce((s,y)=>s+blockSeconds(y.b),0),0);
  seq.push({type:"prep", mode:"time", sec:PREP, name:"Get set", label:plan[0].batch[0].b.name});
  let k=0;
  plan.forEach(({p,batch})=>{
    const r=p.r, part = state.stack ? (r.short||r.name) : "";
    batch.forEach(x=>{
      const b=x.b, bi=x.bi;
      const line = b.levels? b.levels[exLevel(r,b)] : (b.detail||"");
      const sides=b.sides||1, sets=b.sets||1;
      for(let st=0; st<sets; st++){
        for(let s=0; s<sides; s++){
          seq.push({
            type:"work", mode:b.mode||"time", sec:b.sec, target:b.target,
            name:b.name, tag:b.tag, detail:line, cue:b.cue, block:k, bi, rid:r.id, part,
            side: sides>1 ? (s===0?"Left":"Right") : "",
            set: sets>1 ? `Set ${st+1} of ${sets}` : ""
          });
        }
        /* A block may declare `rest` (seconds) — a real countdown between its
           sets, not after the last one. Multi-set holds (wall sits) need it. */
        if(b.rest && st < sets-1)
          seq.push({ type:"rest", mode:"time", sec:b.rest, name:"Rest",
                     label:`${b.name} — set ${st+2} of ${sets}`, block:k, bi, rid:r.id, part });
      }
      k++;
    });
  });
  return seq;
}

function startRoutine(){
  unlockAudio(); mediaSession(true);
  state.seq=buildSeq(); state.i=0;
  renderBeads(); loadStep(0);
  state.running=true; keepAwake(true); go("run"); startTick();
}
function renderBeads(){
  $("#beads").innerHTML = state.seq.map((s,i)=>
    `<div class="bead" data-b="${i}" ${s.type==="prep"||s.type==="rest"?'style="flex:.3"':""}><i></i></div>`).join("");
}
function paintBeads(){
  state.seq.forEach((s,i)=>{
    const el=$(`.bead[data-b="${i}"]`); if(!el) return;
    const bar=el.querySelector("i");
    if(i<state.i){ el.classList.add("done"); bar.style.width="100%"; }
    else if(i===state.i){ el.classList.remove("done");
      bar.style.width = s.mode==="reps" ? "50%" : (100*(s.sec-state.left)/s.sec)+"%"; }
    else { el.classList.remove("done"); bar.style.width="0"; }
  });
}
const C = 2*Math.PI*66;
function paintRing(){
  const s=state.seq[state.i], ring=$("#ring");
  ring.style.strokeDasharray = C;
  ring.style.strokeDashoffset = (s && s.mode==="reps") ? 0 : C*(1-(s? state.left/s.sec : 0));
}
function isReps(){ const s=state.seq[state.i]; return s && s.mode==="reps"; }

function loadStep(i, opts){
  opts = opts || {};
  state.i=i; const s=state.seq[i];
  state.left = s.mode==="reps" ? 0 : s.sec;
  state.up = 0;
  state.endsAt = s.mode==="reps" ? null : Date.now() + s.sec*1000;
  state.startedAt = Date.now();
  if(s.mode!=="reps" && !opts.silent) scheduleAhead(i, state.endsAt);
  const reps = s.mode==="reps";

  $("#ringwrap").classList.toggle("tap", reps);
  $("#tRemain").classList.toggle("reps", reps);
  $("#tRemain").textContent = reps ? s.target : s.sec;
  $("#tSide").textContent = s.side || "";
  $("#tElapsed").textContent = reps ? "tap when done" : (s.set||"");

  $("#phase").textContent = s.type==="prep" ? "Starting"
      : s.type==="rest" ? "Breathe"
      : `Move ${s.block+1} of ${state.moves}${s.part?" · "+s.part:""}${s.set?" · "+s.set:""}${s.tag?" · "+s.tag:""}`;
  $("#rName").textContent = s.type==="prep" ? "Get set" : s.type==="rest" ? "Rest" : s.name;
  $("#rLvl").textContent  = (s.type==="prep"||s.type==="rest") ? `Up next: ${s.label}` : (s.detail||"");
  $("#rCue").textContent  = (s.type==="prep"||s.type==="rest") ? "" : (s.cue||"");

  const nx=state.seq[i+1];
  $("#rNext").innerHTML = nx ? `Next · <b>${nx.name}${nx.side?" — "+nx.side:""}</b>` : "Last one";

  const main=$("#btnPause");
  main.classList.toggle("reps", reps);
  main.classList.remove("paused");
  main.textContent = reps ? "Done — next" : "Pause";

  paintRing(); paintBeads();
  if(opts.silent) return;
  if(s.mode==="reps") ping(s.type==="prep"?520:660,.13,.2);
}
function advance(){
  if(state.i >= state.seq.length-1) finish();
  else loadStep(state.i+1);
}

/* Rebuild position from the wall clock. Called every tick and whenever the app
   comes back to the foreground, so a locked screen or a backgrounded tab
   catches up instead of drifting behind. */
function resync(){
  let guard=0;
  while(state.running && !isReps() && state.endsAt && Date.now()>=state.endsAt && guard++<400){
    if(state.i >= state.seq.length-1){ finish(); return; }
    const over = Date.now() - state.endsAt;
    loadStep(state.i+1, {silent:true});
    if(state.endsAt) state.endsAt -= over;
  }
  if(isReps()){
    state.up = Math.floor((Date.now()-state.startedAt)/1000);
    $("#tElapsed").textContent = `${mmss(state.up)} · tap when done`;
  }else if(state.endsAt){
    const left = Math.max(0, Math.ceil((state.endsAt-Date.now())/1000));
    if(left!==state.left){ state.left=left; $("#tRemain").textContent=left; }
    paintRing(); paintBeads();
  }
}
function startTick(){
  stopTick();
  state.tick=setInterval(()=>{ if(state.running) resync(); },200);
}
function stopTick(){ if(state.tick){ clearInterval(state.tick); state.tick=null; } }
/* One done screen serves both the timed routines and the strength sessions.
   `again` is the repeat action; omitted (as it is for lifting) the button
   hides. `againLabel` renames it ("Continue" after a batch) and is reset on
   every call so the rename never sticks. */
function showDone(name, sub, streak, again, againLabel){
  $("#doneName").textContent = name;
  $("#doneSub").textContent = sub;
  $("#doneStreak").textContent = streak || "";
  const b = $("#btnAgain");
  b.hidden = !again;
  b.onclick = again || null;
  b.textContent = againLabel || "Run again";
  renderHome();
  go("done");
}
function finish(){
  stopTick(); state.running=false; keepAwake(false); clearScheduled();
  ping(760,.14,.25); setTimeout(()=>ping(1010,.22,.25),150);
  (state.run||[]).forEach(x=>recordProgress(x.r, x.v, x.bis));
  closeRun(state.run||[]);
}
/* A part whose day's record exists and has every required block in it. Not
   the same as partToday()===null, which is also true when nothing has been
   done at all — that distinction is what keeps an untouched member of a
   stack from being logged on an early End. */
function partClosed(r, k){
  k = k || todayKey();
  return !!(db.part && db.part[r.id] && db.part[r.id][k]) && !partRecord(r, k);
}
/* Every required block is behind you (in one run or several): log the day. */
function logDay(r, v){
  /* nowMs(), not Date.now(): the completion has to land on the day the
     schedule layer calls today, or "done today" disagrees with the log. */
  (db.log[r.id] = db.log[r.id]||[]).push(nowMs());
  if(r.variants) db.variantDone[r.id]=v;
  saveDB();
}
/* After a run (or an End that closed something): log every part whose
   required blocks are all behind you, then one done screen for the lot. */
function closeRun(run){
  const logged = run.filter(x=>partClosed(x.r)), open = run.filter(x=>partToday(x.r));
  logged.forEach(x=>logDay(x.r, x.v));
  if(state.stack){
    const nm = x => x.r.short||x.r.name;
    let sub = logged.length ? `${logged.map(nm).join(", ")} logged.` : "";
    if(open.length) sub += ` ${open.map(x=>`${nm(x)} · ${fmtMin(remainingSeconds(x.r,x.v))} left`).join(", ")}.`;
    showDone(stackName(state.stack), sub.trim(),
      open.length ? "Not all logged yet — finish the rest to count it." : "Logged for today.",
      startRoutine, open.length ? "Continue" : "Run again");
    return;
  }
  const r=state.routine, v=state.variant;
  if(open.length){
    /* A batch, with more still to do today: nothing is logged yet. */
    showDone(r.name,
      `${fmtMin(state.total)} done · ${fmtMin(remainingSeconds(r,v))} left today.`,
      "Not logged yet — finish the rest to count it.",
      ()=>openDetail(r.id), "Continue");
    return;
  }
  const st=stats(r.id);
  let sub = `${activeBlocks(r,v).length} moves complete.`;
  if(r.variants){
    sub = `${r.variants[v]} — ${sub}`;
    if(r.variantMode==="alternate")
      sub += ` Next time: ${r.variants[(v+1)%r.variants.length]}.`;
  }
  showDone(r.name, sub, st.streak>1 ? `${st.streak}-day streak.` : "Logged for today.", startRoutine);
}
/* "End routine" keeps what was finished: every block whose LAST segment is
   already behind the current one counts as done (a skipped segment counts as
   passed, as it does at the end of a run). If that happens to close a day,
   the day is logged. */
function quitRoutine(){
  const seq=state.seq, i=state.i, run=state.run||[];
  if(seq.length) run.forEach(x=>{
    const mine = s => s.type!=="prep" && s.bi!=null && s.rid===x.r.id;
    const behind = new Set(seq.slice(0,i).filter(mine).map(s=>s.bi));
    const done = [...behind].filter(bi=>!seq.some((s,j)=>j>=i && mine(s) && s.bi===bi));
    if(done.length) recordProgress(x.r, x.v, done);
  });
  if(run.some(x=>partClosed(x.r))) return closeRun(run);
  go("home");
}

onClick("#btnStart", startRoutine);
onClick("#ringwrap", ()=>{ if(isReps()){ clearScheduled(); ping(700,.1,.2); advance(); } });
onClick("#btnPause", ()=>{
  if(isReps()){ ping(700,.1,.2); advance(); return; }
  state.running=!state.running;
  $("#btnPause").textContent = state.running?"Pause":"Resume";
  $("#btnPause").classList.toggle("paused", !state.running);
  if(state.running){
    state.endsAt = Date.now() + state.left*1000;
    scheduleAhead(state.i, state.endsAt);
    keepAwake(true);
  }else{
    clearScheduled();
  }
});
onClick("#btnNext", ()=>{ clearScheduled(); advance(); });
onClick("#btnQuit", quitRoutine);
onClick("#btnPrev", ()=>{
  clearScheduled();
  if(!isReps() && state.left < state.seq[state.i].sec - 2) loadStep(state.i);
  else if(state.i>0) loadStep(state.i-1);
  else loadStep(0);
});
function paintToggles(){
  const s=$("#tgSound"); if(!s) return;
  s.setAttribute("aria-pressed",sound); s.textContent = sound?"Beeps on":"Beeps off";
}
onClick("#tgSound", ()=>{ sound=!sound; db.sound=sound; saveDB(); paintToggles();
  if(sound){unlockAudio();ping();} });
onClick("#upReset", ()=>{ resetSchedule(); renderUpcoming(); });

/* ---------- notes ----------
   A place to think out loud across a week without leaving the app. Nothing
   reads these at runtime; they exist to be exported and handed over when the
   program gets rewritten. The app is a static page on GitHub Pages with no
   backend, so it cannot write into the repo itself — export is the bridge. */
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const isoDay = ts => new Date(ts - new Date(ts).getTimezoneOffset()*6e4).toISOString().slice(0,10);

/* The chip above the box: what this note will be filed against, with an ✕ to
   detach if the thought turned out to be about something else. */
function paintNoteCtx(){
  const el = $("#nCtx"); if(!el) return;
  el.hidden = !noteCtx;
  if(!noteCtx){ el.innerHTML = ""; return; }
  el.innerHTML = `<span>About <b>${esc(noteCtx.name)}</b></span>` +
    `<button class="exdel" id="nCtxX" aria-label="Write this note about nothing in particular">✕</button>`;
  $("#nCtxX").onclick = ()=>{ setNoteCtx(null); paintNoteCtx(); };
}
/* Notes written inside a strength session (the session note and the per-lift
   notes) live on the session record, not in db.notes — but they must still be
   VISIBLE here, or they read as lost. Rendered read-only: deleting them would
   mean editing the training log, which the ✕ on a free note should not do. */
function sessionNoteItems(){
  const ss = (db.strength && db.strength.sessions) || [];
  const out = [];
  ss.forEach(s=>{
    const bits = [];
    if(s.note) bits.push(s.note);
    if(s.exNotes) Object.keys(s.exNotes).forEach(ex=>bits.push(`${ex} — ${s.exNotes[ex]}`));
    if(bits.length) out.push({ ts:s.end||s.start, text:bits.join("\n"), name:s.wName||s.w, sess:true });
  });
  return out;
}
/* ---------- past sessions ----------
   The finished-workout record, in-app. Every session on THIS device, newest
   first, tap a row for the sets. Sessions finished on another device live in
   that device's localStorage; the weekly export is still the only merge. */
const sessOpen = {};
function renderPastSessions(){
  const host = $("#nSessions"); if(!host) return;
  const ss = ((db.strength && db.strength.sessions) || []).slice().reverse();
  const cnt = $("#nSessCount");
  if(cnt) cnt.textContent = ss.length ? `${ss.length} on this device` : "none yet";
  if(!ss.length){
    host.innerHTML = `<p class="hint" style="border:0">Nothing logged on this device yet. Finished
      workouts land here. (Each device keeps its own log — sessions finished on
      another one only meet in the weekly export.)</p>`;
    return;
  }
  host.innerHTML = ss.map((s,i)=>{
    const d = isoDay(s.end||s.start);
    const open = !!sessOpen[i];
    const nSets = (s.sets||[]).length;
    let body = "";
    if(open){
      const byEx = [];
      (s.sets||[]).forEach(x=>{
        let g = byEx.find(y=>y.ex===x.ex);
        if(!g) byEx.push(g = {ex:x.ex, sets:[]});
        g.sets.push(x);
      });
      body = byEx.map(g=>{
        const line = typeof fmtLoggedSet === "function"
          ? g.sets.map(fmtLoggedSet).join(", ")
          : `${g.sets.length} set${g.sets.length===1?"":"s"}`;
        const xn = s.exNotes && s.exNotes[g.ex];
        return `<div class="sess-ex"><b>${esc(g.ex)}</b> — ${esc(line)}${
          xn?`<div class="sess-xn">${esc(xn)}</div>`:""}</div>`;
      }).join("") || `<div class="sess-ex">No sets — note only.</div>`;
      if(s.note) body += `<div class="sess-note">“${esc(s.note)}”</div>`;
    }
    return `<div class="sess-card">
      <button class="sess-h" data-sess="${i}" aria-expanded="${open}">
        <span>${d} · <em>${esc(s.wName||s.w)}</em></span>
        <s>${s.week?`wk ${s.week} · `:""}${nSets} set${nSets===1?"":"s"}${s.mins?` · ${s.mins} min`:""} ${open?"▾":"▸"}</s>
      </button>
      ${body}
    </div>`;
  }).join("");
  host.querySelectorAll("[data-sess]").forEach(el=>{ el.onclick=()=>{
    const i=+el.dataset.sess; sessOpen[i]=!sessOpen[i]; renderPastSessions(); }; });
}

function renderNotes(){
  /* The copy that differs per person — who the export goes to — comes from
     config.js, so index.html stays identical across the sibling apps. */
  const intro = $("#nIntro"); if(intro) intro.innerHTML = APP.notesIntro || "";   // our copy, not user data
  const lbl = $("#nExpLabel"); if(lbl) lbl.textContent = APP.notesLabel || "Export";
  const imp = $("#nImport"); if(imp) imp.hidden = !APP.history;
  renderPastSessions();
  const list = $("#nList");
  const items = db.notes.map(x=>({ ts:x.ts, text:x.text, name:x.ctx && x.ctx.name, del:x.ts }))
    .concat(sessionNoteItems())
    .sort((a,b)=>b.ts-a.ts);
  $("#nCount").textContent = items.length ? `${items.length} note${items.length>1?"s":""}` : "none yet";
  list.innerHTML = !items.length
    ? `<p class="hint" style="border:0">Nothing yet. Jot down anything you want the next re-program to
       take into account — what felt easy, what hurt, what you skipped and why, how the week went.</p>`
    : items.map(x=>`
        <div class="note">
          <div class="note-h"><span>${isoDay(x.ts)} · ${new Date(x.ts).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}${
            x.name ? ` · <em>${esc(x.name)}</em>` : ""}${x.sess ? ` · <i class="sess">session</i>` : ""}</span>
            ${x.del ? `<button class="exdel" data-note="${x.del}" aria-label="Delete note">✕</button>` : ""}</div>
          <div class="note-b">${esc(x.text).replace(/\n/g,"<br>")}</div>
        </div>`).join("");
  list.querySelectorAll("[data-note]").forEach(el=>{ el.onclick=()=>{
    const ts = +el.dataset.note;
    db.notes = db.notes.filter(x=>x.ts!==ts); saveDB(); renderNotes(); }; });
}
function addNote(){
  const el = $("#nText"), text = el.value.trim();
  if(!text) return;
  /* ts is the delete key, so it has to be unique: two saves inside the same
     millisecond would otherwise share one, and deleting either would silently
     take both. Nudge forward rather than dedupe on read. */
  const prev = db.notes[db.notes.length-1];
  let ts = Date.now();
  if(prev && ts <= prev.ts) ts = prev.ts + 1;
  const note = { ts, text };
  if(noteCtx) note.ctx = { kind:noteCtx.kind, id:noteCtx.id, name:noteCtx.name };
  db.notes.push(note);
  el.value = ""; db.noteDraft = ""; saveDB(); renderNotes();
  ping(880,.08,.16);
}

/* The whole week in one paste: notes, lifting, and what actually got done.
   Completions are listed one by one with date and time (Sep 2026) — the
   summary line alone could only be reconstructed by inference when the log
   had to be rebuilt from exports, and the exact days are what a history
   analysis wants anyway. */
const hhmm = ts => new Date(ts).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit", hour12:false});
function exportMD(){
  const cut = nowMs() - 28*DAY;   // the schedule clock, so "done today" and the window agree
  const notes = db.notes.filter(x=>x.ts>=cut);
  const done = ROUTINES.map(r=>{
    const st = stats(r.id); if(!st) return null;
    const recent = (db.log[r.id]||[]).filter(t=>t>=cut).sort((a,b)=>a-b);
    return `- **${r.name}** — ${recent.length}× in the last 28 days · last ${fmtLast(st.lastDay)}` +
      (st.streak>1?` · ${st.streak}-day streak`:"") +
      (recent.length ? `
  - ${recent.map(t=>`${isoDay(t)} ${hhmm(t)}`).join(", ")}` : "");
  }).filter(Boolean);
  return [
    `# ${APP.exportTitle} — ${isoDay(Date.now())}`,
    `Current block: **${PROGRAM.block}**, week ${typeof programWeek==="function"?programWeek():PROGRAM.week}.`,
    ``,
    /* The calendar as it actually stands. Days he dragged only exist on the
       device, so without this the re-program would silently re-plan against a
       schedule he no longer follows. */
    `## Schedule`,
    typeof scheduleExportMD==="function" ? scheduleExportMD() : "_unavailable_",
    `## Notes`,
    notes.length ? notes.map(x=>
      `### ${isoDay(x.ts)}${x.ctx && x.ctx.name ? ` — ${x.ctx.name}` : ""}\n${x.text}`).join("\n\n")
      : `_No notes in the last 28 days._`,
    ``,
    `## Strength sessions`,
    typeof strengthExportMD==="function" ? strengthExportMD(28) : "_unavailable_",
    `## Routine completions`,
    done.length ? done.join("\n") : `_Nothing logged._`,
    ``
  ].join("\n");
}
function flash(msg, sel){
  const el = $(sel||"#nFlash") || $("#nFlash"); if(!el) return;
  el.textContent = msg;
  clearTimeout(flash.t); flash.t = setTimeout(()=>{ el.textContent=""; }, 4000);
}
async function copyExport(){
  const md = exportMD();
  try{
    await navigator.clipboard.writeText(md);
    flash("Copied — paste it into the Sunday chat.");
  }catch(e){
    /* clipboard API needs https + a user gesture; fall back to selecting the
       text so a long-press copy still works. */
    const ta = $("#nText"); ta.value = md; ta.select();
    flash("Couldn't copy automatically — it's in the box above, select and copy.");
  }
}
function downloadExport(){
  try{
    const url = URL.createObjectURL(new Blob([exportMD()],{type:"text/markdown"}));
    const a = document.createElement("a");
    a.href = url; a.download = `${APP.exportFile}-${isoDay(Date.now())}.md`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 4000);
    flash(`Downloaded — ${APP.exportHint}.`);
  }catch(e){ flash("Download failed — use Copy instead."); }
}
/* ---------- lift-history import ----------
   The repo is public, so past training data can never ship with the app —
   history arrives by pasting a Hevy CSV export into the notes box and tapping
   Import. Parsed into db.strength.hist (flat {ex, d, w, r} records, lbs) and
   read only by the per-lift history panel on the strength screen. Each import
   replaces the last, so re-exporting from Hevy is always safe. */
function parseCSV(text){
  const rows=[]; let row=[], cur="", q=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(q){ if(c==='"'){ if(text[i+1]==='"'){ cur+='"'; i++; } else q=false; } else cur+=c; }
    else if(c==='"') q=true;
    else if(c===',' ){ row.push(cur); cur=""; }
    else if(c==='\n'||c==='\r'){
      if(cur!==""||row.length){ row.push(cur); rows.push(row); row=[]; cur=""; }
      if(c==='\r'&&text[i+1]==='\n') i++;
    }
    else cur+=c;
  }
  if(cur!==""||row.length){ row.push(cur); rows.push(row); }
  return rows;
}
function importHistory(){
  const txt = $("#nText").value;
  if(!txt.trim()){ flash("Paste a Hevy CSV export into the box above first."); return; }
  const rows = parseCSV(txt);
  const head = rows[0]||[], col = n=>head.indexOf(n);
  const iEx=col("exercise_title"), iT=col("start_time"), iW=col("weight_lbs"),
        iR=col("reps"), iTy=col("set_type");
  if(iEx<0 || iW<0 || iR<0){ flash("That doesn't look like a Hevy CSV export — nothing imported."); return; }
  const hist=[], exSet=new Set();
  rows.slice(1).forEach(r=>{
    if(iTy>=0 && r[iTy]==="warmup") return;
    const w=parseFloat(r[iW]), reps=parseInt(r[iR],10);
    if(isNaN(w) || isNaN(reps) || reps<=0) return;
    const t=Date.parse(r[iT]); if(isNaN(t)) return;
    hist.push({ ex:r[iEx], d:isoDay(t), w, r:reps });
    exSet.add(r[iEx]);
  });
  if(!hist.length){ flash("No usable sets in that paste — nothing imported."); return; }
  db.strength = db.strength || { sessions:[] };
  db.strength.hist = hist;
  $("#nText").value=""; db.noteDraft="";
  saveDB();
  flash(`Imported ${hist.length} sets across ${exSet.size} exercises (replaces any earlier import).`);
}
/* ---------- backup ----------
   Everything on this device as one block of JSON — notes, sessions, the
   completion log, levels, moves, stacks — for moving to another phone or
   another address. (Sep 2026: the site moved to a custom domain, and
   localStorage is per-origin, so the old install's data was marooned. This is
   the bridge for next time.) Restore MERGES: what is already here wins, the
   backup fills the gaps, nothing is deleted — so pasting twice is harmless
   and so is restoring onto a device that has since logged more. */
function backupJSON(){ return JSON.stringify({ app:APP.dbKey, when:new Date().toISOString(), db }); }
async function copyBackup(){
  const txt = backupJSON();
  try{
    await navigator.clipboard.writeText(txt);
    flash("Copied — paste it into the box on the other device and tap Restore.", "#nFlash2");
  }catch(e){
    const ta = $("#nText"); ta.value = txt; ta.select();
    flash("Couldn't copy automatically — it's in the box above, select and copy.", "#nFlash2");
  }
}
/* Deep-fill: values already on this device win; the backup fills the gaps. */
function fillIn(cur, inc){
  if(!inc || typeof inc!=="object" || Array.isArray(inc)) return cur;
  Object.keys(inc).forEach(k=>{
    if(cur[k]==null) cur[k]=inc[k];
    else if(typeof cur[k]==="object" && !Array.isArray(cur[k]) && typeof inc[k]==="object" && !Array.isArray(inc[k]))
      fillIn(cur[k], inc[k]);
  });
  return cur;
}
function mergeDB(inc){
  const n = {notes:0, sessions:0, log:0};
  (inc.notes||[]).forEach(x=>{ if(x && x.ts && !db.notes.some(y=>y.ts===x.ts)){ db.notes.push(x); n.notes++; } });
  db.notes.sort((a,b)=>a.ts-b.ts);
  const ss = (inc.strength && inc.strength.sessions) || [], at = s => s.start || s.end;
  ss.forEach(s=>{ if(s && at(s) && !db.strength.sessions.some(y=>at(y)===at(s))){ db.strength.sessions.push(s); n.sessions++; } });
  db.strength.sessions.sort((a,b)=>at(a)-at(b));
  if(inc.strength && inc.strength.hist && !db.strength.hist) db.strength.hist = inc.strength.hist;
  Object.keys(inc.log||{}).forEach(id=>{
    const cur = db.log[id] = db.log[id]||[];
    (inc.log[id]||[]).forEach(ts=>{ if(!cur.includes(ts)){ cur.push(ts); n.log++; } });
    cur.sort((a,b)=>a-b);
  });
  ["exLevels","levels","variantSel","variantDone","sched","part","stacks"].forEach(key=>{
    db[key] = fillIn(db[key] || {}, inc[key]);
  });
  return n;
}
function downloadBackup(){
  try{
    const url = URL.createObjectURL(new Blob([backupJSON()],{type:"application/json"}));
    const a = document.createElement("a");
    a.href = url; a.download = `${APP.exportFile}-backup-${isoDay(Date.now())}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 4000);
    flash("Downloaded — keep it somewhere you can reach from the other device.", "#nFlash2");
  }catch(e){ flash("Download failed — use Copy backup instead.", "#nFlash2"); }
}
/* A backup as a file (iOS: the picker opens Files, where Dropbox shows up), or
   pasted into the box; both land in restoreText. A 40 KB JSON blob is hard to
   select-all on a phone, which is why the file route exists. */
function restoreBackup(){
  const txt = ($("#nText").value||"").trim();
  if(!txt){ flash("Paste a backup into the box above first, or use Restore from a file.", "#nFlash2"); return; }
  if(restoreText(txt)){ $("#nText").value=""; db.noteDraft=""; saveDB(); }
}
function restoreFile(file){
  if(!file) return;
  const rd = new FileReader();
  rd.onload = ()=>restoreText(String(rd.result||"").trim());
  rd.onerror = ()=>flash("Couldn't read that file.", "#nFlash2");
  rd.readAsText(file);
}
function restoreText(txt){
  let data; try{ data = JSON.parse(txt); }catch(e){ flash("That isn't a backup — nothing restored.", "#nFlash2"); return false; }
  const inc = data && data.db && typeof data.db==="object" ? data.db : data;
  if(!inc || typeof inc!=="object" || !(inc.log || inc.notes || inc.strength)){
    flash("That isn't a backup — nothing restored.", "#nFlash2"); return false; }
  if(data.app && data.app!==APP.dbKey){ flash(`That backup is from ${data.app}, not this app — nothing restored.`, "#nFlash2"); return false; }
  const n = mergeDB(inc);
  saveDB(); renderNotes(); renderHome();
  flash(`Restored — added ${n.notes} note${n.notes===1?"":"s"}, ${n.sessions} session${n.sessions===1?"":"s"}, ${n.log} routine completion${n.log===1?"":"s"}.`, "#nFlash2");
  return true;
}
onClick("#nAdd", addNote);
onClick("#nCopy", copyExport);
onClick("#nDl", downloadExport);
onClick("#nImport", importHistory);
onClick("#nBackup", copyBackup);
onClick("#nBackupDl", downloadBackup);
onClick("#nRestore", restoreBackup);
onClick("#nRestoreFile", ()=>{ const f = $("#nFile"); if(f){ f.value = ""; f.click(); } });
if($("#nFile")) $("#nFile").onchange = ()=>restoreFile($("#nFile").files && $("#nFile").files[0]);
if($("#nText")) $("#nText").oninput = ()=>{ db.noteDraft = $("#nText").value; saveDB(); };
document.addEventListener("click", e=>{
  if(e.target.closest('[data-go="notes"]') && $("#nText")){
    $("#nText").value = db.noteDraft||""; renderNotes(); }   /* the chip is painted by go() */
});

/* offline: cache-first service worker (only meaningful over https)
   The worker serves cached files, so after a deploy the page in front of you is
   still running the old JS/CSS until it reloads. Reload as soon as the new
   worker takes control — but never mid-routine, since that would kill a running
   timer. Deferred reloads fire on the way back to the home screen. */
let swReloadPending = false;
function applySWReload(){ if(swReloadPending && !state.running) location.reload(); }
if("serviceWorker" in navigator && window.isSecureContext){
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", ()=>{
    if(!hadController || swReloadPending) return;  // first install: nothing stale to refresh
    swReloadPending = true;
    applySWReload();
  });
  window.addEventListener("load", ()=>{ navigator.serviceWorker.register("sw.js").catch(()=>{}); });
}

/* Larger type for the apps that want it: one zoom on the body (config.js). */
if(APP.textScale && APP.textScale !== 1) document.body.style.zoom = APP.textScale;
renderHome(); nowStr(); setInterval(nowStr,20000); paintAwakeStatus(); paintToggles();
