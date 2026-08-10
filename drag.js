/* ============================================================ DRAG ============================================================
   Moving a session to another day on the Upcoming screen.

   Pointer Events, not HTML5 drag-and-drop: DnD does not fire on iOS touch at
   all, and this app is used on a phone. The gesture starts on a dedicated grip
   (`⠿`) rather than the card body, which is why there is no long-press delay —
   the handle already disambiguates drag from tap and from scrolling the list,
   and a hold timer on a dedicated handle just feels broken.

   The drop target is any [data-day] group. The move is written through
   moveSlot() in schedule.js, which persists it to localStorage; nothing here
   knows about storage.
   ============================================================ */

let drag = null;

function initDrag(host){
  if(!host) return;
  host.querySelectorAll("[data-grip]").forEach(g=>{
    g.onpointerdown = e => startDrag(e, g);
  });
}

function startDrag(e, grip){
  if(drag) return;
  if(e.button != null && e.button > 0) return;      // right/middle click
  const slot = grip.closest("[data-sid]"); if(!slot) return;
  const day = slot.closest("[data-day]"); if(!day) return;
  e.preventDefault();

  const r = slot.getBoundingClientRect();
  const ghost = slot.cloneNode(true);
  ghost.classList.add("dragghost");
  ghost.style.cssText = `position:fixed;left:0;top:0;width:${r.width}px;` +
    `transform:translate(${r.left}px,${r.top}px);pointer-events:none;z-index:60`;
  document.body.appendChild(ghost);
  slot.classList.add("dragging");

  drag = { sid: slot.dataset.sid, from: day.dataset.day, slot, ghost, grip,
           dx: e.clientX - r.left, dy: e.clientY - r.top,
           x: e.clientX, y: e.clientY, over: null, id: e.pointerId };

  try{ grip.setPointerCapture(e.pointerId); }catch(err){}
  grip.onpointermove   = moveDrag;
  grip.onpointerup     = endDrag;
  grip.onpointercancel = cancelDrag;
  document.addEventListener("keydown", escDrag);
  /* Edge auto-scroll runs on a timer, not off pointermove: holding the finger
     still at the bottom of the screen has to keep scrolling. */
  drag.scroll = setInterval(edgeScroll, 16);
}

function moveDrag(e){
  if(!drag) return;
  e.preventDefault();
  drag.x = e.clientX; drag.y = e.clientY;
  drag.ghost.style.transform = `translate(${e.clientX-drag.dx}px,${e.clientY-drag.dy}px)`;
  paintTarget();
}
/* The ghost is pointer-events:none, so elementFromPoint sees straight through
   it to the day underneath. */
function paintTarget(){
  const el = document.elementFromPoint(drag.x, drag.y);
  const day = el && el.closest ? el.closest("[data-day]") : null;
  if(day === drag.over) return;
  if(drag.over) drag.over.classList.remove("dropping");
  drag.over = day;
  if(day && day.dataset.day !== drag.from) day.classList.add("dropping");
}
function edgeScroll(){
  if(!drag) return;
  const pad = 70, h = window.innerHeight;
  let dy = 0;
  if(drag.y < pad) dy = -Math.ceil((pad - drag.y) / 5);
  else if(drag.y > h - pad) dy = Math.ceil((drag.y - (h - pad)) / 5);
  if(!dy) return;
  window.scrollBy(0, dy);
  /* clientY is viewport-relative and unchanged by scrolling, but what is under
     it just moved — so re-evaluate the target as the page slides past. */
  drag.ghost.style.transform = `translate(${drag.x-drag.dx}px,${drag.y-drag.dy}px)`;
  paintTarget();
}

function endDrag(e){
  if(!drag) return;
  const to = drag.over && drag.over.dataset.day;
  const sid = drag.sid, from = drag.from;
  cleanupDrag();
  if(to && to !== from){
    moveSlot(sid, to);
    if(typeof ping === "function") ping(760, .09, .18);
  }
  renderUpcoming();
}
function cancelDrag(){ if(!drag) return; cleanupDrag(); renderUpcoming(); }
function escDrag(e){ if(e.key === "Escape") cancelDrag(); }

function cleanupDrag(){
  if(!drag) return;
  clearInterval(drag.scroll);
  if(drag.over) drag.over.classList.remove("dropping");
  drag.slot.classList.remove("dragging");
  drag.ghost.remove();
  try{ drag.grip.releasePointerCapture(drag.id); }catch(err){}
  drag.grip.onpointermove = drag.grip.onpointerup = drag.grip.onpointercancel = null;
  document.removeEventListener("keydown", escDrag);
  drag = null;
}
