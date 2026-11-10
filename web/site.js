// The marketing page's light and dark switch. The page follows the device until the switch is used, then
// remembers the choice. The theme is set straight away, before the page draws, so it never flashes.
const root = document.documentElement;
const KEY = 'back-story-site-theme';
try { const saved = localStorage.getItem(KEY); if (saved === 'light' || saved === 'dark') root.dataset.theme = saved; } catch {}

const current = () => root.dataset.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');

addEventListener('DOMContentLoaded', () => {
  const btn = document.querySelector('.theme-switch');
  if (!btn) return;
  const meta = document.querySelector('meta[name="theme-color"]');
  const paint = () => {
    const mode = current();
    btn.dataset.mode = mode;
    btn.setAttribute('aria-label', mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    meta?.setAttribute('content', mode === 'dark' ? '#0d0d0f' : '#efeeec');
  };
  btn.addEventListener('click', () => {
    root.dataset.theme = current() === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(KEY, root.dataset.theme); } catch {}
    paint();
  });
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', paint);
  paint();
});

// The feature clips: only the one in the page's current look is loaded, once it's close to the screen, and it
// plays while it's in view. With reduced motion asked for, the still frame stays.
addEventListener('DOMContentLoaded', () => {
  const clips = [...document.querySelectorAll('video[data-src]')];
  if (!clips.length || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const shown = v => v.offsetParent !== null;
  const near = new Set();
  const update = () => clips.forEach(v => {
    if (near.has(v) && shown(v)) {
      if (!v.src) v.src = v.dataset.src;
      v.play().catch(() => {});
    } else if (!v.paused) v.pause();
  });
  // Each phone frame is watched, and both looks' clips inside it follow it
  const frames = new Map(clips.map(v => [v.parentElement, clips.filter(c => c.parentElement === v.parentElement)]));
  const seen = new IntersectionObserver(entries => {
    entries.forEach(e => frames.get(e.target).forEach(v => (e.isIntersecting ? near.add(v) : near.delete(v))));
    update();
  }, { rootMargin: '200px 0px' });
  frames.forEach((_, f) => seen.observe(f));
  new MutationObserver(update).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', update);
});
