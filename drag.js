/* ============================================================ DRAG ============================================================
   One pointer gesture, two uses:
     Upcoming — moving a session to another day (a slot onto a [data-day]).
     Today    — stacking a routine onto another (a card onto a [data-stackdrop]),
                so the two run as one; see the stacks section of app.js.

   Pointer Events, not HTML5 drag-and-drop: DnD does not fire on iOS touch at
   all, and this app is used on a phone. The gesture starts on a dedicated grip
   (`⠿`) rather than the card body, which is why there is no long-press delay —
   the handle already disambiguates drag from tap and from scrolling the list,
   and a hold timer on a dedicated handle just feels broken.

   Each use is a small config: where the dragged thing's id and origin come
   from, what counts as a target, and what to do on the drop. Storage is the
   callee's business (moveSlot / stackOnto); nothing here knows about it.
   ============================================================ */

let drag = null;

const DRAG_MOVE = {
  item:   "[data-sid]",
  id:     slot => slot.dataset.sid,
  from:   slot => { const d = slot.closest("[data-day]"); return d ? d.dataset.day : null; },
  target: "[data-day]",
  key:    el => el.dataset.day,
  drop:   (sid, from, to) => moveSlot(sid, to),
  render: () => renderUpcoming()
};
const DRAG_STACK = {
  item:   "[data-stackdrop]",
  id:     slot => slot.dataset.stackdrop,
  from:   slot => slot.dataset.stackdrop,
  target: "[data-stackdrop]",
  key:    el => el.dataset.stackdrop,
  drop:   (id, from, to) => stackOnto(id, to),
  render: () => renderToday()
};

function initDrag(host){
  if(!host) return;
  host.querySelectorAll("[data-grip]").forEach(g=>{ g.onpointerdown = e => startDrag(e, g, DRAG_MOVE); });
}
function initStackDrag(host){
  if(!host) return;
  host.querySelectorAll("[data-stackgrip]").forEach(g=>{ g.onpointerdown = e => startDrag(e, g, DRAG_STACK); });
}

function startDrag(e, grip, cfg){
  if(drag) return;
  if(e.button != null && e.button > 0) return;      // right/middle click
  const slot = grip.closest(cfg.item); if(!slot) return;
  const from = cfg.from(slot); if(from == null) return;
  e.preventDefault();

  const r = slot.getBoundingClientRect();
  const ghost = slot.cloneNode(true);
  ghost.classList.add("dragghost");
  ghost.style.cssText = `position:fixed;left:0;top:0;width:${r.width}px;` +
    `transform:translate(${r.left}px,${r.top}px);pointer-events:none;z-index:60`;
  document.body.appendChild(ghost);
  slot.classList.add("dragging");

  drag = { cfg, id: cfg.id(slot), from, slot, ghost, grip,
           dx: e.clientX - r.left, dy: e.clientY - r.top,
           x: e.clientX, y: e.clientY, over: null, pid: e.pointerId };

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
   it to whatever is underneath. The origin is never a target. */
function paintTarget(){
  const el = document.elementFromPoint(drag.x, drag.y);
  let t = el && el.closest ? el.closest(drag.cfg.target) : null;
  if(t && drag.cfg.key(t) === drag.from) t = null;
  if(t === drag.over) return;
  if(drag.over) drag.over.classList.remove("dropping");
  drag.over = t;
  if(t) t.classList.add("dropping");
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
  const cfg = drag.cfg, to = drag.over ? cfg.key(drag.over) : null;
  const id = drag.id, from = drag.from;
  cleanupDrag();
  if(to != null && to !== from){
    cfg.drop(id, from, to);
    if(typeof ping === "function") ping(760, .09, .18);
  }
  cfg.render();
}
function cancelDrag(){ if(!drag) return; const cfg = drag.cfg; cleanupDrag(); cfg.render(); }
function escDrag(e){ if(e.key === "Escape") cancelDrag(); }

function cleanupDrag(){
  if(!drag) return;
  clearInterval(drag.scroll);
  if(drag.over) drag.over.classList.remove("dropping");
  drag.slot.classList.remove("dragging");
  drag.ghost.remove();
  try{ drag.grip.releasePointerCapture(drag.pid); }catch(err){}
  drag.grip.onpointermove = drag.grip.onpointerup = drag.grip.onpointercancel = null;
  document.removeEventListener("keydown", escDrag);
  drag = null;
}
