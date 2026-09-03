/* ============================================================ STRENGTH ============================================================
   Set-by-set logging for the lifting days. Loaded AFTER app.js — it depends on
   db / saveDB / go / ping / mmss / $ from there, and on PROGRAM from program.js.

   Three things carry the design:
   - Every field proposes a value before anything is typed: the program's
     `suggest` (the week's PRESCRIPTION, refreshed each re-program), falling
     back to last session's number where the program is silent. Last session
     itself shows in the PREV column. A proposal is rendered dimmed and is NOT
     logged until the set is ticked or the field edited — the tick is the
     "did it as written" gesture.
   - Nothing is required. A blank set is simply not logged; the point is a
     record honest enough to program from, not a complete one.
   - Storage is ALWAYS in lbs (mirroring Hevy's weight_lbs column). kg exists
     only at the display surface — see the units section.
   ============================================================ */

/* ---------- shape of the stored log ----------
   db.strength.sessions: newest last.
     { w, sid, block, week, start, end, note, mins, exNotes,
       sets:[{ex, n, weight, height, reps, distance, duration, where, rpe}] }
   `sid` is the schedule slot it was logged against (see schedule.js) and may
   be absent — sessions logged before the calendar existed simply lack it, and
   anything opened from Browse has no slot to record.
   `ex` is the exercise name and `n` the set number, so history survives a
   workout being reordered or renamed.
   `mins` is the self-reported session length (he times on the Garmin — the
   app deliberately does not trust its own elapsed clock, which once claimed a
   long evening for a 70-minute workout because the tab stayed open).
   `exNotes` is {exerciseName: text} — per-lift notes, exported under the lift.

   Every key is optional — a set records only the fields its exercise declares
   (see FIELDS below), so a barbell set and a running interval share one shape.
   That shape deliberately mirrors Hevy's CSV columns (weight_lbs, reps,
   distance_miles, duration_seconds, rpe), which keeps import/export honest.
   Sessions logged before distance/duration existed simply lack those keys.

   db.strength.hist: flat imported history, [{ex, d:"YYYY-MM-DD", w, r}] —
   written only by the Hevy-CSV import on the Notes screen, read only by the
   per-lift history panel. Replaced wholesale on each import. */
function sessions(){ return (db.strength && db.strength.sessions) || []; }

/* ---------- what a set can record ----------
   An exercise declares `fields`; omitted means lifting. `labels` re-heads a
   column without inventing a new field type (the daily check-in uses it to
   show MINUTES / PAIN over duration / rpe). */
const FIELDS = {
  weight:   { label:"WEIGHT", ph:"wt",   mode:"decimal" },
  height:   { label:"HEIGHT", ph:"cm",   mode:"numeric" },   // box height — cm, never unit-converted
  reps:     { label:"REPS",   ph:"reps", mode:"numeric" },
  distance: { label:"DIST",   ph:"m",    mode:"decimal" },
  duration: { label:"TIME",   ph:"m:ss", mode:"text"    },
  where:    { label:"WHERE",  ph:"spot", mode:"text"    },   // free text — the check-in's "which body part"
  rpe:      { label:"RPE",    ph:"rpe",  mode:"decimal" }
};
const LIFT_FIELDS = ["weight","reps","rpe"];
function exFields(e){ return (e && e.fields) || LIFT_FIELDS; }
function fieldLabel(e,k){ return (e.labels && e.labels[k]) || FIELDS[k].label; }
function fieldPh(e,k){ return (e.phs && e.phs[k]) || FIELDS[k].ph; }

/* ---------- units ----------
   Canonical weight is lbs, always — the log, the export and `suggest` never
   change meaning when the toggle flips. kg exists only in what the weight
   fields show and accept, so he can flip mid-workout in a kg gym and every
   number (prev column, proposals, already-typed sets) converts in place.

   The global toggle is db.unit; a single lift can override it for the session
   (a kg-plated barbell in an otherwise-lb gym) via lift.exUnit[ei]. wOut/wIn
   take an explicit kg flag so per-exercise contexts pass their own; omitted,
   they follow the global toggle. */
const LB_PER_KG = 2.20462;
function unitKg(){ return db.unit === "kg"; }
function exKg(ei){
  const u = lift.exUnit && lift.exUnit[ei];
  return u ? u === "kg" : unitKg();
}
function wOut(v, kg){                   // canonical lbs → what the field shows
  const n = parseFloat(v);
  if(v == null || v === "" || isNaN(n)) return v == null ? "" : String(v);
  if(kg === undefined) kg = unitKg();
  return kg ? String(Math.round(n/LB_PER_KG*10)/10) : String(v);
}
function wIn(v, kg){                    // what was typed → canonical lbs
  const n = parseFloat(v);
  if(v === "" || isNaN(n)) return v;
  if(kg === undefined) kg = unitKg();
  return kg ? String(Math.round(n*LB_PER_KG*10)/10) : v;
}
function paintUnit(){ const b=$("#lUnit"); if(b) b.textContent = unitKg() ? "kg" : "lb"; }

/* One previous set, rendered for the PREV column. Weight+reps get the familiar
   "225×8" treatment; everything else is joined plainly. */
function fmtPrev(e, p, kg){
  if(!p) return "—";
  const f = exFields(e), out = [];
  if(f.includes("weight") && f.includes("reps")) out.push(`${p.weight?wOut(p.weight,kg):"bw"}×${p.reps||"—"}`);
  else if(f.includes("weight") && p.weight) out.push(wOut(p.weight,kg));
  else if(f.includes("reps") && p.reps) out.push(p.reps);
  if(f.includes("height") && p.height) out.push(`${p.height}cm`);
  if(f.includes("distance") && p.distance) out.push(`${p.distance}m`);
  if(f.includes("duration") && p.duration) out.push(p.duration);
  if(f.includes("where") && p.where) out.push(p.where);
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
/* The most recent per-exercise note left for this lift, for the "last note"
   line — this is the other half of "my notes vanished": they saved fine, but
   nothing ever showed them back. */
function lastExNote(name){
  const all = sessions();
  for(let i=all.length-1; i>=0; i--){
    if(all[i].exNotes && all[i].exNotes[name]) return all[i].exNotes[name];
  }
  return null;
}

/* What a field proposes before anything is typed: the program's `suggest` —
   which the weekly re-program sets to THIS week's prescription — and only
   where the program is silent, last session's value for this set number.
   The PREV column is where last week lives; the prefill is the ask.
   Canonical units (lbs). */
function suggestFor(e, k, p){
  if(e.suggest && e.suggest[k] != null) return String(e.suggest[k]);
  if(p && p[k]) return String(p[k]);
  return "";
}

function programWeek(ts){
  if(!PROGRAM.start) return PROGRAM.week||1;
  const started = dayOf(new Date(PROGRAM.start+"T00:00:00").getTime());
  const w = Math.floor((dayOf(ts==null?Date.now():ts)-started)/(7*DAY)) + 1;
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
   the DOM is rebuilt from it on every structural change. A rendered proposal
   is NOT in `entries`; only typing or ticking puts it there. */
let lift = { w:null, sid:null, ex:[], entries:{}, exNotes:{}, exUnit:{}, histOpen:{}, startedAt:0 };

/* ---------- draft persistence ----------
   Everything typed mid-session is mirrored into db.liftDraft on every input,
   keyed by workout+slot, and restored when the same session is reopened. This
   is what actually fixes "my notes vanished": Back, a reload, or iOS evicting
   the PWA mid-workout no longer discards anything. finishLift clears the
   draft; stale drafts fall off after a week. */
function draftKey(){ return lift.w ? `${lift.w.id}|${lift.sid||""}` : null; }
function saveLiftDraft(){
  const k = draftKey(); if(!k) return;
  db.liftDraft = db.liftDraft || {};
  db.liftDraft[k] = {
    ex: lift.ex, entries: lift.entries, exNotes: lift.exNotes, exUnit: lift.exUnit,
    note: $("#lNote") ? $("#lNote").value : "",
    dur: $("#lDur") ? $("#lDur").value : "",
    date: $("#lDate") ? $("#lDate").value : "",
    startedAt: lift.startedAt, savedAt: Date.now()
  };
  saveDB();
}
function clearLiftDraft(){
  const k = draftKey();
  if(k && db.liftDraft && db.liftDraft[k]){ delete db.liftDraft[k]; saveDB(); }
}
function pruneLiftDrafts(){
  if(!db.liftDraft) return;
  Object.keys(db.liftDraft).forEach(k=>{
    if(Date.now() - (db.liftDraft[k].savedAt||0) > 7*DAY) delete db.liftDraft[k];
  });
}

/* `sid` is the scheduled slot this was opened from, so the same workout on two
   different days ticks off independently. Null when opened from Browse. */
function openLift(id, sid){
  const w = PROGRAM.workouts.find(x=>x.id===id); if(!w) return;
  lift.w = w;
  lift.sid = sid || null;
  pruneLiftDrafts();
  const draft = db.liftDraft && db.liftDraft[`${w.id}|${sid||""}`];
  if(draft){
    lift.ex = draft.ex;
    lift.entries = draft.entries || {};
    lift.exNotes = draft.exNotes || {};
    lift.exUnit = draft.exUnit || {};
    lift.startedAt = draft.startedAt || Date.now();
  }else{
    lift.ex = (w.exercises||[]).map(e=>Object.assign({}, e, {sets:e.sets||3}));
    lift.entries = {};
    lift.exNotes = {};
    lift.exUnit = {};
    lift.startedAt = Date.now();
  }
  lift.histOpen = {};
  if(typeof setNoteCtx === "function") setNoteCtx({ kind:"workout", id:w.id, name:w.name });
  document.documentElement.style.setProperty("--signal", w.accent||"#C97F5B");
  $("#lName").textContent = w.name;
  $("#lSub").textContent = w.sub || "";
  $("#lNote").value = draft ? (draft.note||"") : "";
  const dur = $("#lDur"); if(dur) dur.value = draft ? (draft.dur||"") : "";
  /* "Log it for" defaults to today; change it to enter a forgotten session on
     the day it actually happened (the completion tick follows the date). */
  const dt = $("#lDate");
  if(dt) dt.value = (draft && draft.date) || isoDay(Date.now());
  /* Surface last time's session note on the way in — a note you can't ever
     see again is a note that "didn't save". */
  const last = lastSession(w.id), lp = $("#lPrev");
  if(lp){
    lp.hidden = !(last && last.note);
    lp.textContent = last && last.note ? `Last time — “${last.note}”` : "";
  }
  paintUnit();
  renderLift();
  go("lift");
}

function entry(e,s){ return lift.entries[`${e}|${s}`] || (lift.entries[`${e}|${s}`] = {}); }

/* RPE can only be 0–10 (the check-in reuses the column as a pain score, which
   is what keeps 0 in range) — so it is a dropdown, not a keyboard. */
function rpeSelect(e, ei, si, val, sugg){
  const shown = val || sugg;
  let opts = `<option value=""${shown===""?" selected":""}>${esc(fieldPh(e,"rpe"))}</option>`;
  for(let v=0; v<=10; v+=0.5){
    const s = (v%1) ? v.toFixed(1) : String(v);
    opts += `<option value="${s}"${shown===s?" selected":""}>${s}</option>`;
  }
  return `<select class="fld${!val && shown ? " sugg":""}" data-e="${ei}" data-s="${si}" data-k="rpe"
    aria-label="${esc(fieldLabel(e,"rpe"))}, set ${si+1}">${opts}</select>`;
}

/* ---------- per-lift history ----------
   Tap a lift's name for the Hevy-style view: rep records, estimated 1RM
   (Epley) over time, recent sessions. Reads the in-app log plus whatever the
   Hevy import supplied. Matching is by normalised name, so Hevy's
   "Deadlift (Barbell)" and the program's "Deadlift" are one lift. */
/* Two names refer to the same lift when their BASE (the name minus
   parenthesised qualifiers and equipment words) agrees AND the qualifiers
   don't conflict. A name with no qualifier matches any — that keeps
   "Deadlift" ≡ "Deadlift (Barbell)" and "Pull-up" ≡ "Pull-up (weighted)"
   working — while equipment words must agree when both sides state one, so
   "DB bench press" finds Hevy's "Bench Press (Dumbbell)" but never
   "Bench Press (Barbell)". */
const EQUIP = { db:"dumbbell", dumbbell:"dumbbell", dumbbells:"dumbbell",
                bb:"barbell", barbell:"barbell",
                kb:"kettlebell", kettlebell:"kettlebell",
                machine:"machine", cable:"cable", smith:"smith" };
function exKey(s){
  const qualWords = [];
  const stripped = String(s).toLowerCase()
    .replace(/\((.*?)\)/g, (_,q)=>{ qualWords.push(q); return " "; });
  const base = [];
  stripped.replace(/[^a-z0-9]+/g," ").trim().split(" ").filter(Boolean)
    .forEach(w=>{ if(EQUIP[w]) qualWords.push(w); else base.push(w); });
  const quals = {};
  qualWords.join(" ").replace(/[^a-z0-9]+/g," ").trim().split(" ").filter(Boolean)
    .forEach(w=>{ quals[EQUIP[w]||w] = true; });
  return { base: base.join(" "), quals };
}
function exMatch(a,b){
  if(a.base !== b.base) return false;
  const qa = Object.keys(a.quals);
  if(!qa.length || !Object.keys(b.quals).length) return true;
  return qa.some(q=>b.quals[q]);
}
function historyFor(name){
  const key = exKey(name), byDay = {};
  const add = (d,w,r)=>{ if(!isNaN(w)&&!isNaN(r)&&r>0) (byDay[d]=byDay[d]||[]).push({w,r}); };
  sessions().forEach(s=>{
    s.sets.forEach(x=>{
      if(exMatch(exKey(x.ex),key)) add(isoDay(s.end||s.start), parseFloat(x.weight), parseInt(x.reps,10));
    });
  });
  /* history.js — the baked-in past (Hevy + the Paul Read log), committed to
     the repo as bare [ex, date, lbs, reps] rows. See make_history.py. */
  (typeof HISTORY !== "undefined" ? HISTORY : []).forEach(h=>{
    if(exMatch(exKey(h[0]),key)) add(h[1], h[2], h[3]);
  });
  /* …plus anything pasted in through the Notes-screen Hevy import since the
     last regeneration. Overlap with HISTORY is harmless: records and the
     trend are max-per-day, so duplicates change nothing. */
  ((db.strength && db.strength.hist)||[]).forEach(h=>{
    if(exMatch(exKey(h.ex),key)) add(h.d, h.w, h.r);
  });
  return Object.keys(byDay).sort().map(d=>({d, sets:byDay[d]}));
}
function e1rm(w,r){ return w*(1+r/30); }   // Epley — same estimate Hevy uses
function sparkHTML(vals){
  if(vals.length<2) return "";
  const W=280, H=40, min=Math.min(...vals), max=Math.max(...vals), span=(max-min)||1;
  const pts = vals.map((v,i)=>
    `${(i/(vals.length-1)*W).toFixed(1)},${(H-4-(v-min)/span*(H-8)).toFixed(1)}`);
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"
    aria-hidden="true"><polyline points="${pts.join(" ")}"/></svg>`;
}
function histHTML(e, kg){
  const days = historyFor(e.name);
  if(!days.length) return `<div class="hist">No logged history for this lift yet —
    it starts filling in the first time you log it (or import your Hevy CSV on the Notes screen).</div>`;
  if(kg === undefined) kg = unitKg();
  const u = kg ? "kg" : "lb";
  /* best weight for each rep count, and the best estimated 1RM overall */
  const repBest = {};
  let best = null;
  days.forEach(day=>day.sets.forEach(s=>{
    if(!repBest[s.r] || s.w > repBest[s.r]) repBest[s.r] = s.w;
    if(!best || e1rm(s.w,s.r) > e1rm(best.w,best.r)) best = s;
  }));
  const recs = Object.keys(repBest).map(Number).sort((a,b)=>a-b).slice(0,12)
    .map(r=>`<span><b>${r}</b> × ${wOut(repBest[r],kg)}</span>`).join("");
  const trend = days.map(day=>Math.max(...day.sets.map(s=>e1rm(s.w,s.r))));
  const recent = days.slice(-3).reverse().map(day=>
    `<div class="hist-day"><s>${day.d}</s> ${day.sets.map(s=>`${wOut(s.w,kg)}×${s.r}`).join(", ")}</div>`).join("");
  return `<div class="hist">
    <div class="big">Est. 1RM <b>${wOut(Math.round(e1rm(best.w,best.r)),kg)} ${u}</b>
      <s>from ${wOut(best.w,kg)}×${best.r} · ${days.length} session${days.length>1?"s":""}</s></div>
    ${sparkHTML(trend)}
    <p class="hist-cap">Best weight per rep count (${u})</p>
    <div class="reprec">${recs}</div>
    ${recent}
  </div>`;
}

function renderLift(){
  $("#lBody").innerHTML = lift.ex.map((e,ei)=>{
    const hist = lastSetsFor(e.name);
    const f = exFields(e);
    const kg = exKg(ei);
    /* `target` overrides the composed line — a run's prescription ("2 min @
       RPE 7") doesn't decompose into reps/rpe/load the way a lift's does. */
    const target = e.target || [e.reps?`${e.reps} reps`:"", e.rpe?`RPE ${e.rpe}`:"", e.load||""]
      .filter(Boolean).join(" · ");
    const rows = Array.from({length:e.sets}, (_,si)=>{
      const en = entry(ei,si), p = setAt(hist, si+1);
      const inputs = f.map(k=>{
        if(k==="rpe") return rpeSelect(e, ei, si, en.rpe||"", suggestFor(e,"rpe",p));
        const meta = FIELDS[k];
        const typed = en[k]||"", sugg = suggestFor(e,k,p);
        const raw = typed || sugg;
        const shown = k==="weight" ? wOut(raw, kg) : raw;
        const ph = (p && p[k]) || fieldPh(e,k);
        return `<input class="fld${!typed && sugg ? " sugg":""}" data-e="${ei}" data-s="${si}" data-k="${k}"
          inputmode="${meta.mode}" placeholder="${esc(ph)}" value="${esc(shown)}"
          aria-label="${esc(fieldLabel(e,k))}, set ${si+1}">`;
      }).join("");
      return `<div class="setrow${en.done?" logged":""}" style="--nf:${f.length}">
        <div class="sn">${si+1}</div>
        <div class="prev">${esc(fmtPrev(e,p,kg))}</div>
        ${inputs}
        <button class="tick-set" data-done="${ei}|${si}" aria-pressed="${!!en.done}">✓</button>
      </div>`;
    }).join("");
    const prevNote = lastExNote(e.name);
    const heads = f.map(k=>{
      const lbl = fieldLabel(e,k);
      return (k==="weight" && !(e.labels && e.labels.weight))
        ? `${esc(lbl)} (${kg?"KG":"LB"})` : esc(lbl);
    });
    return `<div class="lift-ex">
      <div class="lift-head">
        <button class="nm" data-hist="${ei}" aria-expanded="${!!lift.histOpen[ei]}">${esc(e.name)}${e.warmup?` <span class="badge opt">warm-up</span>`:""}<s class="histgo">${lift.histOpen[ei]?"▾":"▸"}</s></button>
        ${f.includes("weight")?`<button class="exunit" data-unit="${ei}" aria-label="Units for ${esc(e.name)}">${kg?"kg":"lb"}</button>`:""}
        <button class="exmove" data-move="${ei}|-1" aria-label="Move ${esc(e.name)} up"${ei===0?" disabled":""}>▲</button>
        <button class="exmove" data-move="${ei}|1" aria-label="Move ${esc(e.name)} down"${ei===lift.ex.length-1?" disabled":""}>▼</button>
        ${e.added?`<button class="exdel" data-del="${ei}" aria-label="Remove ${esc(e.name)}">✕</button>`:""}
      </div>
      ${target?`<div class="dose">${esc(target)}</div>`:""}
      ${e.note?`<div class="cue">${esc(e.note)}</div>`:""}
      ${hist?`<div class="histline">Last time · ${fmtLast(dayOf(hist.when))}</div>`:""}
      ${prevNote?`<div class="cue exn-prev">Last note · ${esc(prevNote)}</div>`:""}
      ${lift.histOpen[ei]?histHTML(e,kg):""}
      <div class="sethead" style="--nf:${f.length}"><div class="sn">SET</div><div class="prev">PREV</div>
        ${heads.map(h=>`<div>${h}</div>`).join("")}<div></div></div>
      ${rows}
      <button class="addset" data-add="${ei}">+ set</button>${e.sets>1?`<button class="addset" data-sub="${ei}" aria-label="Remove last set of ${esc(e.name)}">− set</button>`:""}
      <textarea class="exnote" data-xn="${ei}" rows="1" placeholder="Note for this exercise — machine, grip, pain…"
        aria-label="Note for ${esc(e.name)}">${esc(lift.exNotes[ei]||"")}</textarea>
    </div>`;
  }).join("") + `
    <div class="addex">
      <input id="exName" placeholder="Add an exercise…" aria-label="New exercise name">
      <button id="exAdd">Add</button>
    </div>`;

  $("#lBody").querySelectorAll(".fld").forEach(el=>{
    el.oninput = ()=>{
      const k = el.dataset.k, v = el.value.trim();
      entry(+el.dataset.e, +el.dataset.s)[k] = (k==="weight") ? wIn(v, exKg(+el.dataset.e)) : v;
      el.classList.remove("sugg");
      saveLiftDraft();
    };
    /* A proposal clears the moment the field is tapped so there is nothing to
       delete before typing; leave without typing and it comes straight back. */
    if(el.tagName === "INPUT"){
      el.onfocus = ()=>{
        if(el.classList.contains("sugg")){ el.dataset.sugg = el.value; el.value = ""; }
      };
      el.onblur = ()=>{
        if(el.dataset.sugg !== undefined){
          if(el.value.trim() === ""){ el.value = el.dataset.sugg; el.classList.add("sugg"); }
          delete el.dataset.sugg;
        }
      };
    }
  });
  $("#lBody").querySelectorAll("[data-unit]").forEach(el=>{
    el.onclick = ()=>{
      const ei = +el.dataset.unit;
      lift.exUnit[ei] = exKg(ei) ? "lb" : "kg";
      saveLiftDraft();
      renderLift();
    };
  });
  $("#lBody").querySelectorAll("[data-move]").forEach(el=>{
    el.onclick = ()=>{ const [ei,dir] = el.dataset.move.split("|").map(Number); moveExercise(ei,dir); };
  });
  $("#lBody").querySelectorAll("[data-done]").forEach(el=>{
    el.onclick = ()=>{ const [ei,si] = el.dataset.done.split("|").map(Number); toggleSet(ei,si); };
  });
  $("#lBody").querySelectorAll("[data-add]").forEach(el=>{
    el.onclick = ()=>{ lift.ex[+el.dataset.add].sets++; saveLiftDraft(); renderLift(); };
  });
  /* "− set" undoes "+ set": it only ever removes the LAST row (with whatever
     was typed into it), so no entry re-indexing is needed. */
  $("#lBody").querySelectorAll("[data-sub]").forEach(el=>{
    el.onclick = ()=>{
      const ei = +el.dataset.sub, e = lift.ex[ei];
      if(e.sets <= 1) return;
      e.sets--;
      delete lift.entries[`${ei}|${e.sets}`];
      saveLiftDraft(); renderLift();
    };
  });
  $("#lBody").querySelectorAll("[data-del]").forEach(el=>{
    el.onclick = ()=>{ removeExercise(+el.dataset.del); };
  });
  $("#lBody").querySelectorAll("[data-hist]").forEach(el=>{
    el.onclick = ()=>{ const i=+el.dataset.hist; lift.histOpen[i]=!lift.histOpen[i]; renderLift(); };
  });
  /* Notes wrap and grow downward instead of scrolling off to the right:
     height is re-derived from scrollHeight on every input, and once at
     render so a restored draft opens at the right height. */
  const growNote = el => { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; };
  $("#lBody").querySelectorAll(".exnote").forEach(el=>{
    growNote(el);
    el.oninput = ()=>{ lift.exNotes[+el.dataset.xn] = el.value; growNote(el); saveLiftDraft(); };
  });
  const ln = $("#lNote"); if(ln){ growNote(ln); ln.oninput = ()=>{ growNote(ln); saveLiftDraft(); }; }
  const ld = $("#lDur"); if(ld) ld.oninput = saveLiftDraft;
  const lda = $("#lDate"); if(lda) lda.oninput = saveLiftDraft;
  $("#exAdd").onclick = addExercise;
  $("#exName").onkeydown = e => { if(e.key==="Enter"){ e.preventDefault(); addExercise(); } };
  const n = loggedSets().length;
  $("#btnLiftDone").textContent = n ? `Finish & log · ${n} ${n===1?"set":"sets"}` : "Finish";
}

/* Ticking a set is also the "as proposed" shortcut: anything still blank
   inherits the proposal (last session's number, else the program's suggest),
   so a set done as written is one tap. */
function toggleSet(ei,si){
  const e = lift.ex[ei], en = entry(ei,si);
  if(en.done){ en.done = false; renderLift(); return; }
  const p = setAt(lastSetsFor(e.name), si+1);
  exFields(e).forEach(k=>{ const s = suggestFor(e,k,p); if(!en[k] && s) en[k] = s; });
  en.done = true;
  saveLiftDraft();
  renderLift();
  ping(760,.09,.18);
}

/* Reordering swaps every index-keyed map along with the exercises themselves,
   or typed numbers, notes and unit overrides would re-attach to the wrong
   lift — same discipline as removeExercise below. */
function moveExercise(ei, dir){
  const j = ei + dir;
  if(j < 0 || j >= lift.ex.length) return;
  [lift.ex[ei], lift.ex[j]] = [lift.ex[j], lift.ex[ei]];
  const remap = i => i===ei ? j : i===j ? ei : i;
  const entries = {};
  Object.keys(lift.entries).forEach(k=>{
    const [e,s] = k.split("|").map(Number);
    entries[`${remap(e)}|${s}`] = lift.entries[k];
  });
  lift.entries = entries;
  [lift.exNotes, lift.exUnit, lift.histOpen] = [lift.exNotes, lift.exUnit, lift.histOpen].map(o=>{
    const next = {};
    Object.keys(o).forEach(k=>{ next[remap(+k)] = o[k]; });
    return next;
  });
  saveLiftDraft();
  renderLift();
}

function addExercise(){
  const el = $("#exName"), name = el.value.trim();
  if(!name) return;
  lift.ex.push({ name, sets:3, added:true });
  el.value = "";
  saveLiftDraft();
  renderLift();
  const cards = $("#lBody").querySelectorAll(".lift-ex");
  if(cards.length) cards[cards.length-1].scrollIntoView({block:"center"});
}
/* Removing an exercise has to shift every entry above it down a slot, or the
   typed numbers would silently re-attach to the wrong lift. Same for the
   per-exercise notes. */
function removeExercise(ei){
  lift.ex.splice(ei,1);
  const next = {};
  Object.keys(lift.entries).forEach(k=>{
    const [e,s] = k.split("|").map(Number);
    if(e === ei) return;
    next[`${e>ei?e-1:e}|${s}`] = lift.entries[k];
  });
  lift.entries = next;
  const notes = {};
  Object.keys(lift.exNotes).forEach(k=>{
    const e = +k;
    if(e === ei) return;
    notes[e>ei?e-1:e] = lift.exNotes[k];
  });
  lift.exNotes = notes;
  const units = {};
  Object.keys(lift.exUnit).forEach(k=>{
    const e = +k;
    if(e === ei) return;
    units[e>ei?e-1:e] = lift.exUnit[k];
  });
  lift.exUnit = units;
  lift.histOpen = {};
  saveLiftDraft();
  renderLift();
}

/* ---------- finishing ----------
   A set counts as logged if it has any typed or ticked content. Proposals
   showing in untouched fields are NOT content — they never reach `entries` —
   so a workout you open and abandon stores nothing. */
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
  const exNotes = {};
  lift.ex.forEach((e,ei)=>{
    const t = (lift.exNotes[ei]||"").trim();
    if(t) exNotes[e.name] = t;
  });
  const hasExNotes = Object.keys(exNotes).length > 0;
  /* Session length is self-reported (Garmin), never the app's elapsed clock. */
  const durEl = $("#lDur");
  const mins = durEl ? parseInt(durEl.value, 10) : NaN;
  if(sets.length || note || hasExNotes){
    db.strength = db.strength || { sessions:[] };
    /* Backdating: if "Log it for" was moved off today, the session is stored
       at noon of that day, so the schedule tick and the export both land on
       the day the work actually happened. */
    let start = lift.startedAt, end = Date.now();
    const dEl = $("#lDate");
    if(dEl && dEl.value && dEl.value !== isoDay(end)){
      const t = new Date(dEl.value + "T12:00:00").getTime();
      if(!isNaN(t)){ start = t; end = t; }
    }
    const s = {
      w: lift.w.id, sid: lift.sid, wName: lift.w.name, block: PROGRAM.block, week: programWeek(end),
      start, end, note, sets
    };
    if(hasExNotes) s.exNotes = exNotes;
    if(mins > 0) s.mins = mins;
    db.strength.sessions.push(s);
    saveDB();
  }
  clearLiftDraft();
  showDone(lift.w.name,
    sets.length ? `${sets.length} sets logged${mins>0?` · ${mins} min`:""}.` : "Nothing logged — session discarded.",
    sets.length ? "Ready for Sunday." : "");
}

/* ---------- export ----------
   Markdown rather than JSON: it is what actually gets pasted into a
   conversation on Sunday, and it stays readable in the repo afterwards.

   A stored set carries only the keys its exercise declared, and the exercise
   definition is long gone by export time — so format from what is actually
   present rather than from a assumed shape. "1200 m in 4:26 @8", "225×8 @7",
   "45s". Weights export as stored — lbs — whatever the display toggle says. */
function fmtLoggedSet(x){
  const has = k => x[k] != null && x[k] !== "";
  const out = [];
  if(has("where")) out.push(x.where);
  if(has("weight") || (has("reps") && !has("height"))) out.push(`${x.weight||"bw"}×${has("reps")?x.reps:"?"}`);
  if(has("height")) out.push(`${x.height} cm${has("reps")?` × ${x.reps}`:""}`);
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
    const head = `### ${d.toISOString().slice(0,10)} — ${s.wName||s.w} (${s.block||"?"}, week ${s.week||"?"})`
      + (s.mins ? ` · ${s.mins} min` : "");
    const byEx = [];
    s.sets.forEach(x=>{
      let g = byEx.find(y=>y.ex===x.ex);
      if(!g) byEx.push(g = {ex:x.ex, sets:[]});
      g.sets.push(x);
    });
    /* exercises that only got a note still deserve a line */
    if(s.exNotes) Object.keys(s.exNotes).forEach(ex=>{
      if(!byEx.find(y=>y.ex===ex)) byEx.push({ex, sets:[]});
    });
    const body = byEx.map(g=>{
      let line = `- **${g.ex}**` + (g.sets.length ? ` — ${g.sets.map(fmtLoggedSet).join(", ")}` : "");
      const n = s.exNotes && s.exNotes[g.ex];
      if(n) line += `\n  - _${n.replace(/\s*\n\s*/g," / ")}_`;
      return line;
    }).join("\n");
    return head + "\n" + body + (s.note?`\n\n> ${s.note}`:"");
  }).join("\n\n") + "\n";
}

onClick("#btnLiftDone", finishLift);
onClick("#lUnit", ()=>{
  db.unit = unitKg() ? "lb" : "kg";
  saveDB();
  paintUnit();
  if(lift.w && state.screen==="lift") renderLift();
});

/* app.js renders Today before this file has loaded, so its workout cards come
   out empty. Render it once more now that workoutCardHTML exists. */
if(typeof renderHome === "function") renderHome();
