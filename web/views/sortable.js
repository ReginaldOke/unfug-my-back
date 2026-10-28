// Hold-to-edit grid, like the iPhone home screen: hold a card to start editing, then drag cards to
// reorder (the others glide out of the way) or tap ✕ to delete. Tap Done, or outside the cards, to stop.
import { vibrate } from '../lib/ui.js';

const HOLD_MS = 420;
const SLOP = 8;
const GLIDE = { duration: 320, easing: 'cubic-bezier(.2, .9, .25, 1)' };

/**
 * grid: container whose element children with [data-id] are the sortable items.
 * onEditChange(editing), onReorder(ids in the new order).
 */
export function makeSortable(grid, { onEditChange = () => {}, onReorder = () => {} }) {
  let editing = false, press = null, drag = null, swallowClick = false;
  const items = () => [...grid.children].filter(el => el.dataset.id);

  function setEditing(on) {
    if (editing === on) return;
    editing = on;
    grid.classList.toggle('editing', on);
    onEditChange(on);
  }

  /** Moves `el` to sit before `ref` (or at the end), animating every other card from where it was. */
  function moveWithGlide(el, ref) {
    const others = items().filter(x => x !== el);
    const before = new Map(others.map(x => [x, x.getBoundingClientRect()]));
    grid.insertBefore(el, ref);
    for (const x of others) {
      const a = before.get(x), b = x.getBoundingClientRect();
      const dx = a.left - b.left, dy = a.top - b.top;
      if (dx || dy) x.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], GLIDE);
    }
  }

  function startDrag(el, e) {
    const r = el.getBoundingClientRect();
    drag = { el, offX: e.clientX - r.left, offY: e.clientY - r.top, startOrder: items().map(x => x.dataset.id) };
    el.classList.add('lifted');
    vibrate(10);
    follow(e);
  }

  // The lifted card is positioned relative to its own slot, which moves as the order changes
  function follow(e) {
    const { el, offX, offY } = drag;
    el.style.transform = 'none';
    const slot = el.getBoundingClientRect();
    el.style.transform = `translate(${e.clientX - offX - slot.left}px, ${e.clientY - offY - slot.top}px) scale(1.06)`;
  }

  function overTarget(e) {
    const { el } = drag;
    for (const x of items()) {
      if (x === el) continue;
      const r = x.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) continue;
      const list = items();
      // Dropping onto a later card goes after it, onto an earlier card before it
      const ref = list.indexOf(x) > list.indexOf(el) ? x.nextElementSibling : x;
      moveWithGlide(el, ref);
      vibrate(4);
      return;
    }
  }

  function endDrag() {
    const { el, startOrder } = drag;
    drag = null;
    const from = el.style.transform;
    el.style.transform = '';
    el.classList.remove('lifted');
    el.animate([{ transform: from }, { transform: 'none' }], GLIDE);
    const order = items().map(x => x.dataset.id);
    if (order.join() !== startOrder.join()) onReorder(order);
  }

  grid.addEventListener('pointerdown', e => {
    const el = e.target.closest('[data-id]');
    if (!el || e.target.closest('.del') || e.button > 0) return;
    press = { el, x: e.clientX, y: e.clientY, id: e.pointerId };
    if (editing) return; // in edit mode a drag starts as soon as the finger moves
    press.timer = setTimeout(() => {
      if (!press) return;
      setEditing(true);
      swallowClick = true;
      grid.setPointerCapture?.(press.id);
      startDrag(press.el, press.last ?? e);
    }, HOLD_MS);
  });

  grid.addEventListener('pointermove', e => {
    if (drag) { e.preventDefault(); follow(e); overTarget(e); return; }
    if (!press) return;
    press.last = e;
    const moved = Math.hypot(e.clientX - press.x, e.clientY - press.y) > SLOP;
    if (!moved) return;
    if (editing) {
      grid.setPointerCapture?.(press.id);
      swallowClick = true;
      startDrag(press.el, e);
    } else {
      clearTimeout(press.timer); // it's a scroll, not a hold
      press = null;
    }
  });

  const release = () => {
    if (press) clearTimeout(press.timer);
    press = null;
    if (drag) endDrag();
  };
  grid.addEventListener('pointerup', release);
  grid.addEventListener('pointercancel', release);

  // Stop the page scrolling under a drag (iOS needs a non-passive touchmove listener for this)
  grid.addEventListener('touchmove', e => { if (drag) e.preventDefault(); }, { passive: false });
  grid.addEventListener('contextmenu', e => { if (e.target.closest('[data-id]')) e.preventDefault(); });

  // While editing, taps don't toggle cards; the click that ends a hold never does
  grid.addEventListener('click', e => {
    if (e.target.closest('.del')) return;
    if (swallowClick || editing) {
      e.stopPropagation();
      e.preventDefault();
      if (!swallowClick && editing && !e.target.closest('[data-id]')) setEditing(false);
      swallowClick = false;
    }
  }, true);

  return { setEditing, get editing() { return editing; } };
}

/**
 * Vertical drag-to-reorder list; the other rows glide out of the way. Rows are children with .drag-row.
 * By default a row is dragged by its .grip (routine moves). hold: press anywhere on a row and hold to
 * lift it instead (Today's sections), so ordinary taps and scrolling still work. Near the top or bottom
 * of the screen the page scrolls along. skip: what a hold can't start on. onReorder(rows in their new order) runs on drop if anything moved.
 */
export function dragHandles(list, { onReorder = () => {}, hold = false, skip = 'input, textarea, .vslider, .grip', onLift = () => {}, onDrop = () => {} }) {
  let drag = null, press = null, swallowUntil = 0, raf = 0;
  const rows = () => [...list.children].filter(el => el.classList.contains('drag-row'));

  function glideTo(el, ref) {
    const others = rows().filter(x => x !== el);
    const before = new Map(others.map(x => [x, x.getBoundingClientRect().top]));
    list.insertBefore(el, ref);
    for (const x of others) {
      const dy = before.get(x) - x.getBoundingClientRect().top;
      if (dy) x.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], GLIDE);
    }
    vibrate(4);
  }

  function follow() {
    const { el, offY, y } = drag;
    el.style.transform = 'none';
    const slot = el.getBoundingClientRect().top;
    el.style.transform = `translateY(${y - offY - slot}px) scale(${hold ? 0.97 : 1.02})`;
    // Swap once the finger passes the middle of a neighbour
    const list_ = rows(), i = list_.indexOf(el);
    const prev = list_[i - 1], next = list_[i + 1];
    if (next && y > next.getBoundingClientRect().top + next.offsetHeight / 2) glideTo(el, next.nextElementSibling);
    else if (prev && y < prev.getBoundingClientRect().top + prev.offsetHeight / 2) glideTo(el, prev);
  }

  // Scroll the page while the finger rests near an edge
  function edgeScroll() {
    if (!drag) return;
    const edge = 90, { y } = drag;
    const speed = y < edge ? -(edge - y) / 6 : y > innerHeight - edge ? (y - (innerHeight - edge)) / 6 : 0;
    if (speed) { scrollBy(0, speed); follow(); }
    raf = requestAnimationFrame(edgeScroll);
  }

  function lift(el, e, target) {
    try { target.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
    drag = { el, offY: e.clientY - el.getBoundingClientRect().top, y: e.clientY, start: rows() };
    el.classList.add('lifted');
    list.classList.add('dragging');
    vibrate(hold ? 12 : 8);
    onLift();
    if (hold) raf = requestAnimationFrame(edgeScroll);
  }

  list.addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    if (!hold) {
      const grip = e.target.closest('.grip');
      if (!grip) return;
      e.preventDefault();
      lift(grip.closest('.drag-row'), e, grip);
      return;
    }
    const el = e.target.closest('.drag-row');
    if (!el || e.target.closest(skip)) return;
    press = { el, x: e.clientX, y: e.clientY, target: e.target };
    press.timer = setTimeout(() => { if (press) { lift(press.el, press.last ?? e, list); press = null; } }, HOLD_MS);
  });
  list.addEventListener('pointermove', e => {
    if (drag) { e.preventDefault(); drag.y = e.clientY; follow(); return; }
    if (!press) return;
    press.last = e;
    // Moving before the hold completes is a scroll or a swipe, not a drag
    if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > SLOP) { clearTimeout(press.timer); press = null; }
  });
  const drop = () => {
    if (press) { clearTimeout(press.timer); press = null; }
    if (!drag) return;
    cancelAnimationFrame(raf);
    swallowUntil = performance.now() + 400;
    const { el, start } = drag;
    drag = null;
    const from = el.style.transform;
    el.style.transform = '';
    el.classList.remove('lifted');
    list.classList.remove('dragging');
    el.animate([{ transform: from }, { transform: 'none' }], GLIDE);
    const now = rows();
    if (now.some((r, i) => r !== start[i])) onReorder(now);
    onDrop();
  };
  list.addEventListener('pointerup', drop);
  list.addEventListener('pointercancel', drop);
  list.addEventListener('touchmove', e => { if (drag) e.preventDefault(); }, { passive: false });
  // The release of a hold isn't a tap on whatever was under the finger; nor is the long-press menu
  list.addEventListener('click', e => { if (performance.now() < swallowUntil) { e.stopPropagation(); e.preventDefault(); } }, true);
  if (hold) list.addEventListener('contextmenu', e => { if (e.target.closest('.drag-row')) e.preventDefault(); });
}
