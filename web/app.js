import * as R from './lib/repos.js';
import * as reminders from './lib/reminders.js';
import { h } from './lib/ui.js';
import { HomeView } from './views/home.js';
import { CheckinView } from './views/checkin.js';
import { SetupView } from './views/setup.js';
import { FactorDetailView } from './views/factor.js';
import { RoutinesView, RoutineView, RoutineRunView } from './views/routines.js';
import { SettingsView } from './views/settings.js';
import { HelpView } from './views/help.js';
import { HealthView } from './views/health.js';
import { CheckinsView, CheckinDetailView } from './views/checkins.js';
import { startTheme } from './lib/theme.js';

R.init();
startTheme();

// Full-screen flows hide the tab bar
const routes = [
  [/^\/$/, HomeView],
  [/^\/checkin$/, CheckinView, { flow: true }],
  [/^\/checkins$/, CheckinsView],
  [/^\/checkins\/(\d{4}-\d{2}-\d{2})$/, CheckinDetailView],
  [/^\/setup$/, SetupView, { flow: true }],
  [/^\/factor\/([\w-]+)$/, FactorDetailView],
  [/^\/routines$/, RoutinesView],
  [/^\/routine\/(new)$/, RoutineView, { flow: true }],
  [/^\/routine\/([\w-]+)\/edit$/, RoutineView, { flow: true }],
  [/^\/routine\/([\w-]+)\/run$/, RoutineRunView, { flow: true }],
  [/^\/routine\/([\w-]+)$/, RoutineView, { flow: true }],
  [/^\/settings$/, SettingsView],
  [/^\/help$/, HelpView],
  [/^\/health$/, HealthView],
];

const app = document.getElementById('app');
const tabs = document.getElementById('tabs');
let cleanups = [];

function render() {
  cleanups.forEach(fn => fn());
  cleanups = [];
  const [path = '/', qs = ''] = (location.hash.slice(1) || '/').split('?');
  let view = NotFound, args = [], opts = {};
  for (const [re, v, o = {}] of routes) {
    const m = path.match(re);
    if (m) { view = v; args = m.slice(1); opts = o; break; }
  }
  const ctx = { params: new URLSearchParams(qs), args, onCleanup: fn => cleanups.push(fn) };
  const el = view(ctx);
  app.replaceChildren(el);
  // Entrance motion plays once per screen, not on every re-render
  el.classList.add('enter');
  setTimeout(() => el.classList.remove('enter'), 1000);
  document.body.classList.toggle('in-flow', !!opts.flow);
  // Only Today gets the colourful glow; every other screen is plain and darker
  document.body.classList.toggle('on-home', view === HomeView);
  window.scrollTo(0, 0);
  for (const a of tabs.querySelectorAll('a')) {
    const p = a.dataset.path;
    const active = p === '/' ? path === '/' : path.startsWith(p);
    a.classList.toggle('active', active);
    if (active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
  moveGlider();
}

// The selected tab's glass lens: one piece that slides between tabs. Like iOS's liquid glass it
// stretches toward where it's going, thins a little in flight, then settles with a small overshoot.
const glider = h('span', { class: 'tab-glider', 'aria-hidden': 'true' });
tabs.prepend(glider);
let gliderAt = null;
function moveGlider() {
  const a = tabs.querySelector('a.active');
  if (!a || !a.offsetWidth) { glider.style.opacity = '0'; gliderAt = null; return; }
  const to = { x: a.offsetLeft, w: a.offsetWidth };
  const from = gliderAt;
  gliderAt = to;
  glider.style.opacity = '1';
  glider.style.width = `${to.w}px`;
  glider.style.transform = `translateX(${to.x}px)`;
  if (!from || from.x === to.x || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  // Mid-flight it spans from the old tab toward the new one, slightly flattened
  const left = Math.min(from.x, to.x), right = Math.max(from.x + from.w, to.x + to.w);
  const midW = (right - left) * 0.72, midX = to.x > from.x ? right - midW - (right - to.x - to.w) * 0.6 : left + (from.x - left) * 0.15;
  glider.animate([
    // Stretch out smoothly, then spring into place
    { transform: `translateX(${from.x}px) scaleY(1)`, width: `${from.w}px`, easing: 'cubic-bezier(.45, 0, .55, 1)' },
    { transform: `translateX(${midX}px) scaleY(0.86)`, width: `${midW}px`, offset: 0.4, easing: 'cubic-bezier(.25, 1.5, .5, 1)' },
    { transform: `translateX(${to.x}px) scaleY(1)`, width: `${to.w}px` },
  ], { duration: 560 });
}
addEventListener('resize', () => { gliderAt = null; moveGlider(); });

function NotFound() {
  return h('div', { class: 'view' }, h('h1', {}, 'Not found'), h('a', { href: '#/' }, 'Go home'));
}

window.addEventListener('hashchange', render);
render();
// New users start on Today with sensible defaults; setup is optional (Settings › Stressors & helpers)
reminders.start();

// Installable app: offline support and updates on each open (see sw.js)
// The iOS app ships its files inside the app, so it needs no offline cache
if ('serviceWorker' in navigator && !globalThis.Capacitor?.isNativePlatform?.()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(e => console.warn('Offline support unavailable', e));
  });
}
// Ask the browser not to clear the diary under storage pressure (home-screen apps on iOS already get this)
navigator.storage?.persist?.().catch(() => {});
