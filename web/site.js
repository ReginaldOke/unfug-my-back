// The marketing page's light and dark switch. The page follows the device until the switch is used, then
// remembers the choice. The theme is set straight away, before the page draws, so it never flashes.
const root = document.documentElement;
const KEY = 'back-story-site-theme';
try { const saved = localStorage.getItem(KEY); if (saved === 'light' || saved === 'dark') root.dataset.theme = saved; } catch {}

const current = () => root.dataset.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');

addEventListener('DOMContentLoaded', () => {
  const btn = document.querySelector('.theme-switch');
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
