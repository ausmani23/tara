/* ============================================================ STRENGTH ============================================================
   Set-by-set logging for the lifting days. Loaded AFTER app.js — it depends on
   db / saveDB / go / ping / mmss / $ from there, and on PROGRAM from program.js.

   Two things carry the design:
   - The previous session's numbers are the placeholder in every field, so
     "same as last time" is zero typing and progression is visible at a glance.
   - Nothing is required. A blank set is simply not logged; the point is a
     record honest enough to program from, not a complete one.
   ============================================================ */

/* ---------- shape of the stored log ----------
   db.strength.sessions: newest last.
     { w, sid, block, week, start, end, note,
       sets:[{ex, n, weight, reps, distance, duration, rpe}] }
   `sid` is the schedule slot it was logged against (see schedule.js) and may
   be absent — sessions logged before the calendar existed simply lack it, and
   anything opened from Browse has no slot to record.
   `ex` is the exercise name and `n` the set number, so history survives a
   workout being reordered or renamed.

   Every key is optional — a set records only the fields its exercise declares
   (see FIELDS below), so a barbell set and a running interval share one shape.
   That shape deliberately mirrors Hevy's CSV columns (weight_lbs, reps,
   distance_miles, duration_seconds, rpe), which keeps import/export honest.
   Sessions logged before distance/duration existed simply lack those keys. */
function sessions(){ return (db.strength && db.strength.sessions) || []; }

/* ---------- what a set can record ----------
   An exercise declares `fields`; omitted means lifting. `labels` re-heads a
   column without inventing a new field type (the daily check-in uses it to
   show MINUTES / PAIN over duration / rpe). */
const FIELDS = {
  weight:   { label:"WEIGHT", ph:"wt",   mode:"decimal" },
  reps:     { label:"REPS",   ph:"reps", mode:"numeric" },
  distance: { label:"DIST",   ph:"m",    mode:"decimal" },
  duration: { label:"TIME",   ph:"m:ss", mode:"text"    },
  rpe:      { label:"RPE",    ph:"rpe",  mode:"decimal" }
};
const LIFT_FIELDS = ["weight","reps","rpe"];
function exFields(e){ return (e && e.fields) || LIFT_FIELDS; }
function fieldLabel(e,k){ return (e.labels && e.labels[k]) || FIELDS[k].label; }
function fieldPh(e,k){ return (e.phs && e.phs[k]) || FIELDS[k].ph; }

/* One previous set, rendered for the PREV column. Weight+reps get the familiar
   "225×8" treatment; everything else is joined plainly. */
function fmtPrev(e, p){
  if(!p) return "—";
  const f = exFields(e), out = [];
  if(f.includes("weight") && f.includes("reps")) out.push(`${p.weight||"bw"}×${p.reps||"—"}`);
  else if(f.includes("weight") && p.weight) out.push(p.weight);
  else if(f.includes("reps") && p.reps) out.push(p.reps);
  if(f.includes("distance") && p.distance) out.push(`${p.distance}m`);
  if(f.includes("duration") && p.duration) out.push(p.duration);
  /* "/" not " · ": this column is ~70px on a phone and a run needs to fit
     distance, time and RPE in it without ellipsing. */
  let s = out.join("/") || "—";
  if(f.includes("rpe") && p.rpe) s += ` @${p.rpe}`;
  return s;
}

/* Most recent session of this workout — for the card's "last done" line. */
function lastSession(wid){
  const s = sessions().filter(x=>x.w===wid);
  return s.length ? s[s.length-1] : null;
}
/* Most recent logged sets for one exercise, from ANY workout, so a lift that
   moves between days (or gets added ad hoc on the road) keeps its history. */
function lastSetsFor(name){
  const all = sessions();
  for(let i=all.length-1; i>=0; i--){
    const hit = all[i].sets.filter(s=>s.ex===name);
    if(hit.length) return { when:all[i].end||all[i].start, sets:hit };
  }
  return null;
}
function setAt(hist, n){ return hist && hist.sets.find(s=>s.n===n); }

function programWeek(){
  if(!PROGRAM.start) return PROGRAM.week||1;
  const started = dayOf(new Date(PROGRAM.start+"T00:00:00").getTime());
  const w = Math.floor((dayOf(Date.now())-started)/(7*DAY)) + 1;
  return Math.max(1, w);
}
function workingSets(w){ return w.exercises.reduce((a,e)=>a+(e.warmup?0:(e.sets||0)),0); }

/* ---------- the card ----------
   Rendered into whichever list screen asked for it — Today, Upcoming or
   Browse. `opts.sid` is the scheduled slot it came from (null when it came
   from Browse), `opts.done` marks it finished for that day, `opts.when` adds a
   scheduling line. Mirrors cardHTML in app.js so both kinds of card can sit in
   one list. */
function workoutCardHTML(w, opts){
  opts = opts || {};
  const last = lastSession(w.id);
  const n = workingSets(w), ex = w.exercises.length;
  const unit = w.unit || "lift";   // "drill" on conditioning days, "check" on the check-in
  return `
    <button class="card${opts.done?" is-done":""}" data-w="${w.id}"
      ${opts.sid?`data-sid="${opts.sid}"`:""} style="--accent:${w.accent||'#C97F5B'}">
      ${opts.done?`<span class="tickmark">✓</span>`:""}
      <h2>${w.name}</h2><div class="sub">${w.sub||""}</div>
      <div class="meta">
        ${ex ? `<span><b>${ex}</b> ${unit}${ex===1?"":"s"}</span>
                ${n?`<span class="moves"><b>${n}</b> ${n===1?"set":"sets"}</span>`:""}`
             : `<span><b>Open</b> log as you go</span>`}
      </div>
      ${opts.when?`<div class="whenline">${esc(opts.when)}</div>`:""}
      <div class="did">${last
        ? `Last done <b>${fmtLast(dayOf(last.end||last.start))}</b> · <b>${last.sets.length}</b> sets logged`
        : "Not yet logged"}</div>
    </button>`;
}

/* ---------- session state ----------
   `ex` is a working copy of the programmed exercises so sets can be added and
   substitutions made without touching PROGRAM. `entries` is keyed
   "exIndex|setIndex" and is the single source of truth for what is typed —
   the DOM is rebuilt from it on every structural change. */
let lift = { w:null, sid:null, ex:[], entries:{}, startedAt:0, rest:null, restEnds:0 };

/* `sid` is the scheduled slot this was opened from, so the same workout on two
   different days ticks off independently. Null when opened from Browse. */
function openLift(id, sid){
  const w = PROGRAM.workouts.find(x=>x.id===id); if(!w) return;
  lift.w = w;
  lift.sid = sid || null;
  lift.ex = (w.exercises||[]).map(e=>Object.assign({}, e, {sets:e.sets||3}));
  lift.entries = {};
  lift.startedAt = Date.now();
  if(typeof setNoteCtx === "function") setNoteCtx({ kind:"workout", id:w.id, name:w.name });
  document.documentElement.style.setProperty("--signal", w.accent||"#C97F5B");
  $("#lName").textContent = w.name;
  $("#lSub").textContent = w.sub || "";
  $("#lNote").value = "";
  stopRest();
  renderLift();
  go("lift");
}

function entry(e,s){ return lift.entries[`${e}|${s}`] || (lift.entries[`${e}|${s}`] = {}); }

function renderLift(){
  $("#lBody").innerHTML = lift.ex.map((e,ei)=>{
    const hist = lastSetsFor(e.name);
    const f = exFields(e);
    /* `target` overrides the composed line — a run's prescription ("2 min @
       RPE 7") doesn't decompose into reps/rpe/load the way a lift's does. */
    const target = e.target || [e.reps?`${e.reps} reps`:"", e.rpe?`RPE ${e.rpe}`:"", e.load||""]
      .filter(Boolean).join(" · ");
    const rows = Array.from({length:e.sets}, (_,si)=>{
      const en = entry(ei,si), p = setAt(hist, si+1);
      const inputs = f.map(k=>{
        const meta = FIELDS[k], ph = (p && p[k]) || fieldPh(e,k);
        return `<input class="fld" data-e="${ei}" data-s="${si}" data-k="${k}"
          inputmode="${meta.mode}" placeholder="${esc(ph)}" value="${esc(en[k]||"")}"
          aria-label="${esc(fieldLabel(e,k))}, set ${si+1}">`;
      }).join("");
      return `<div class="setrow${en.done?" logged":""}" style="--nf:${f.length}">
        <div class="sn">${si+1}</div>
        <div class="prev">${esc(fmtPrev(e,p))}</div>
        ${inputs}
        <button class="tick-set" data-done="${ei}|${si}" aria-pressed="${!!en.done}">✓</button>
      </div>`;
    }).join("");
    return `<div class="lift-ex">
      <div class="lift-head">
        <div class="nm">${esc(e.name)}${e.warmup?` <span class="badge opt">warm-up</span>`:""}</div>
        ${e.added?`<button class="exdel" data-del="${ei}" aria-label="Remove ${esc(e.name)}">✕</button>`:""}
      </div>
      ${target?`<div class="dose">${esc(target)}</div>`:""}
      ${e.note?`<div class="cue">${esc(e.note)}</div>`:""}
      ${hist?`<div class="histline">Last time · ${fmtLast(dayOf(hist.when))}</div>`:""}
      <div class="sethead" style="--nf:${f.length}"><div class="sn">SET</div><div class="prev">PREV</div>
        ${f.map(k=>`<div>${esc(fieldLabel(e,k))}</div>`).join("")}<div></div></div>
      ${rows}
      <button class="addset" data-add="${ei}">+ set</button>
    </div>`;
  }).join("") + `
    <div class="addex">
      <input id="exName" placeholder="Add an exercise…" aria-label="New exercise name">
      <button id="exAdd">Add</button>
    </div>`;

  $("#lBody").querySelectorAll(".fld").forEach(el=>{
    el.oninput = ()=>{ entry(+el.dataset.e, +el.dataset.s)[el.dataset.k] = el.value.trim(); };
  });
  $("#lBody").querySelectorAll("[data-done]").forEach(el=>{
    el.onclick = ()=>{ const [ei,si] = el.dataset.done.split("|").map(Number); toggleSet(ei,si); };
  });
  $("#lBody").querySelectorAll("[data-add]").forEach(el=>{
    el.onclick = ()=>{ lift.ex[+el.dataset.add].sets++; renderLift(); };
  });
  $("#lBody").querySelectorAll("[data-del]").forEach(el=>{
    el.onclick = ()=>{ removeExercise(+el.dataset.del); };
  });
  $("#exAdd").onclick = addExercise;
  $("#exName").onkeydown = e => { if(e.key==="Enter"){ e.preventDefault(); addExercise(); } };
  const n = loggedSets().length;
  $("#btnLiftDone").textContent = n ? `Finish & log · ${n} ${n===1?"set":"sets"}` : "Finish";
}

/* Ticking a set is also the "same as last time" shortcut: anything still blank
   inherits the previous session's number, so a maintenance set is one tap. */
function toggleSet(ei,si){
  const e = lift.ex[ei], en = entry(ei,si);
  if(en.done){ en.done = false; renderLift(); return; }
  const p = setAt(lastSetsFor(e.name), si+1);
  if(p){ exFields(e).forEach(k=>{ if(!en[k] && p[k]) en[k] = p[k]; }); }
  en.done = true;
  renderLift();
  ping(760,.09,.18);
  startRest(lift.ex[ei].rest || 120);
}

function addExercise(){
  const el = $("#exName"), name = el.value.trim();
  if(!name) return;
  lift.ex.push({ name, sets:3, added:true, rest:120 });
  el.value = "";
  renderLift();
  const cards = $("#lBody").querySelectorAll(".lift-ex");
  if(cards.length) cards[cards.length-1].scrollIntoView({block:"center"});
}
/* Removing an exercise has to shift every entry above it down a slot, or the
   typed numbers would silently re-attach to the wrong lift. */
function removeExercise(ei){
  lift.ex.splice(ei,1);
  const next = {};
  Object.keys(lift.entries).forEach(k=>{
    const [e,s] = k.split("|").map(Number);
    if(e === ei) return;
    next[`${e>ei?e-1:e}|${s}`] = lift.entries[k];
  });
  lift.entries = next;
  renderLift();
}

/* ---------- rest timer ----------
   Wall-clock, same reason as the routine engine: a backgrounded tab stops
   ticking but Date.now() doesn't lie. */
function startRest(sec){
  stopRest();
  lift.restEnds = Date.now() + sec*1000;
  $("#rest").hidden = false;
  paintRest();
  lift.rest = setInterval(paintRest, 250);
}
function paintRest(){
  const left = Math.ceil((lift.restEnds - Date.now())/1000);
  if(left <= 0){ ping(660,.14,.22); stopRest(); return; }
  $("#restT").textContent = mmss(left);
}
function stopRest(){
  if(lift.rest){ clearInterval(lift.rest); lift.rest = null; }
  const el = $("#rest"); if(el) el.hidden = true;
}

/* ---------- finishing ----------
   A set counts as logged if it has any content at all. Ticked-but-empty sets
   are dropped rather than written as blanks. */
function loggedSets(){
  const out = [];
  lift.ex.forEach((e,ei)=>{
    const f = exFields(e);
    for(let si=0; si<e.sets; si++){
      const en = lift.entries[`${ei}|${si}`];
      if(!en || !f.some(k=>en[k])) continue;
      const rec = { ex:e.name, n:si+1 };
      f.forEach(k=>{ rec[k] = en[k]||""; });
      out.push(rec);
    }
  });
  return out;
}
function finishLift(){
  const sets = loggedSets();
  const note = $("#lNote").value.trim();
  stopRest();
  if(sets.length || note){
    db.strength = db.strength || { sessions:[] };
    db.strength.sessions.push({
      w: lift.w.id, sid: lift.sid, wName: lift.w.name, block: PROGRAM.block, week: programWeek(),
      start: lift.startedAt, end: Date.now(), note, sets
    });
    saveDB();
  }
  const mins = Math.max(1, Math.round((Date.now()-lift.startedAt)/60000));
  showDone(lift.w.name,
    sets.length ? `${sets.length} sets logged in ${mins} min.` : "Nothing logged — session discarded.",
    sets.length ? "Ready for Sunday." : "");
}

/* ---------- export ----------
   Markdown rather than JSON: it is what actually gets pasted into a
   conversation on Sunday, and it stays readable in the repo afterwards.

   A stored set carries only the keys its exercise declared, and the exercise
   definition is long gone by export time — so format from what is actually
   present rather than from a assumed shape. "1200 m in 4:26 @8", "225×8 @7",
   "45s". */
function fmtLoggedSet(x){
  const has = k => x[k] != null && x[k] !== "";
  const out = [];
  if(has("weight") || has("reps")) out.push(`${x.weight||"bw"}×${has("reps")?x.reps:"?"}`);
  if(has("distance")) out.push(`${x.distance} m`);
  if(has("duration")) out.push(has("distance") ? `in ${x.duration}` : x.duration);
  return (out.join(" ") || "—") + (has("rpe") ? ` @${x.rpe}` : "");
}
function strengthExportMD(sinceDays){
  const cut = sinceDays ? Date.now() - sinceDays*DAY : 0;
  const ss = sessions().filter(s=>(s.end||s.start) >= cut);
  if(!ss.length) return "_No strength sessions logged._\n";
  return ss.map(s=>{
    const d = new Date(s.end||s.start);
    const head = `### ${d.toISOString().slice(0,10)} — ${s.wName||s.w} (${s.block||"?"}, week ${s.week||"?"})`;
    const byEx = [];
    s.sets.forEach(x=>{
      let g = byEx.find(y=>y.ex===x.ex);
      if(!g) byEx.push(g = {ex:x.ex, sets:[]});
      g.sets.push(x);
    });
    const body = byEx.map(g=>`- **${g.ex}** — ` +
      g.sets.map(fmtLoggedSet).join(", ")).join("\n");
    return head + "\n" + body + (s.note?`\n\n> ${s.note}`:"");
  }).join("\n\n") + "\n";
}

onClick("#btnLiftDone", finishLift);
onClick("#restSkip", ()=>{ stopRest(); });
document.addEventListener("visibilitychange", ()=>{ if(document.visibilityState==="visible" && lift.rest) paintRest(); });

/* app.js renders Today before this file has loaded, so its workout cards come
   out empty. Render it once more now that workoutCardHTML exists. */
if(typeof renderHome === "function") renderHome();
