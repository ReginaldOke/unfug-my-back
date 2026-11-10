import * as R from './lib/repos.js';
import * as reminders from './lib/reminders.js';
import { h } from './lib/ui.js';
import { HomeView } from './views/home.js';
import { CheckinView } from './views/checkin.js';
import { SetupView } from './views/setup.js';
import { FactorDetailView, ScoreView } from './views/factor.js';
import { RoutinesView, RoutineView, RoutineRunView } from './views/routines.js';
import { SettingsView } from './views/settings.js';
import { HelpView } from './views/help.js';
import { HealthView } from './views/health.js';
import { CheckinsView, CheckinDetailView } from './views/checkins.js';
import { toast } from './lib/ui.js';
import { startTheme } from './lib/theme.js';

// Inside another site's frame, show nothing: a framed copy would see this site's stored diary. Our own
// phone frame (try.html) is fine, and that's where a wide desktop window goes: the app is made for a phone.
const framed = window.top !== window.self;
let ownFrame = false;
try { ownFrame = framed && window.top.location.origin === location.origin; } catch { /* another site's frame */ }
if (framed && !ownFrame) {
  document.body.textContent = 'Open Back Story directly.';
  throw new Error('Framed');
}
if (!framed && !globalThis.Capacitor?.isNativePlatform?.() && innerWidth >= 760 && matchMedia('(pointer: fine)').matches) {
  location.replace('try.html');
  throw new Error('Showing the phone frame');
}

R.init();
startTheme();
addEventListener('diary-save-failed', () => toast('Couldn’t save. Your phone may be out of space: export a backup from Settings.'));

// Full-screen flows hide the tab bar
const routes = [
  [/^\/$/, HomeView],
  [/^\/checkin$/, CheckinView, { flow: true }],
  [/^\/checkins$/, CheckinsView],
  [/^\/checkins\/(\d{4}-\d{2}-\d{2})$/, CheckinDetailView],
  [/^\/setup$/, SetupView, { flow: true }],
  [/^\/factor\/([\w-]+)$/, FactorDetailView],
  [/^\/score\/(\w+)$/, ScoreView],
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

// Entrance motion plays once per screen, not on every re-render
function playEntrance(el) {
  el.classList.add('enter');
  setTimeout(() => el.classList.remove('enter'), 1000);
}

// In the app the loading spine is drawn natively: it's told the page is ready, and calls back as it fades.
// In a browser it shows for at least one beat of its animation, so a fast start doesn't flicker.
const BOOT_MIN_MS = 500;
let booted = false;
const riseIn = () => { if (app.firstElementChild) playEntrance(app.firstElementChild); };
async function finishBoot() {
  const boot = document.getElementById('boot');
  const native = globalThis.Capacitor?.isNativePlatform?.();
  await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 400))]);
  if (!native) await new Promise(r => setTimeout(r, Math.max(0, BOOT_MIN_MS - performance.now())));
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  booted = true;
  if (native) {
    boot.remove();
    window.__reveal = riseIn;
    window.__appReady = true;
    return;
  }
  riseIn();
  boot.classList.add('out');
  setTimeout(() => boot.remove(), 450);
}

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
  if (booted) playEntrance(el);
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

// No dragging links and images out of the page, and a fade under the status bar once scrolled
addEventListener('dragstart', e => e.preventDefault());

// iOS still sends a click when a long press on a link is let go, even after dragging away. Only a real
// tap opens a link: a press that moved or was held doesn't. Clicks with no touch before them (VoiceOver) pass.
let press = null;
addEventListener('touchstart', e => { const t = e.touches[0]; press = { x: t.clientX, y: t.clientY, at: Date.now(), moved: false, ended: 0 }; }, { capture: true, passive: true });
addEventListener('touchmove', e => {
  const t = e.touches[0];
  if (press && Math.hypot(t.clientX - press.x, t.clientY - press.y) > 12) press.moved = true;
}, { capture: true, passive: true });
addEventListener('touchend', () => { if (press) press.ended = Date.now(); }, { capture: true, passive: true });
addEventListener('click', e => {
  const p = press;
  press = null;
  if (!p?.ended || Date.now() - p.ended > 600 || !e.target.closest?.('a[href]')) return;
  if (p.moved || p.ended - p.at > 600) { e.preventDefault(); e.stopPropagation(); }
}, true);
addEventListener('scroll', () => document.body.classList.toggle('scrolled', scrollY > 24), { passive: true });

window.addEventListener('hashchange', render);
render();
finishBoot();
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
