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
