import * as R from './lib/repos.js';
import * as reminders from './lib/reminders.js';
import { onBanners, dismiss } from './lib/notify.js';
import { h } from './lib/ui.js';
import { HomeView } from './views/home.js';
import { CheckinView } from './views/checkin.js';
import { SetupView } from './views/setup.js';
import { FactorDetailView } from './views/factor.js';
import { RoutinesView, RoutineEditView, RoutineRunView } from './views/routines.js';
import { SettingsView } from './views/settings.js';
import { HelpView } from './views/help.js';

R.init();

// Full-screen flows hide the tab bar
const routes = [
  [/^\/$/, HomeView],
  [/^\/checkin$/, CheckinView, { flow: true }],
  [/^\/setup$/, SetupView, { flow: true }],
  [/^\/factor\/([\w-]+)$/, FactorDetailView],
  [/^\/routines$/, RoutinesView],
  [/^\/routine\/new$/, RoutineEditView],
  [/^\/routine\/([\w-]+)\/edit$/, RoutineEditView],
  [/^\/routine\/([\w-]+)\/run$/, RoutineRunView, { flow: true }],
  [/^\/settings$/, SettingsView],
  [/^\/help$/, HelpView],
];

const app = document.getElementById('app');
const tabs = document.getElementById('tabs');
let cleanups = [];

function render() {
  cleanups.forEach(fn => fn());
  cleanups = [];
  const [path = '/', qs = ''] = (location.hash.slice(1) || '/').split('?');
  if (!R.settings().onboarded && path !== '/setup' && path !== '/help') {
    location.replace('#/setup');
    return;
  }
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
  window.scrollTo(0, 0);
  for (const a of tabs.querySelectorAll('a')) {
    const p = a.dataset.path;
    const active = p === '/' ? path === '/' : path.startsWith(p);
    a.classList.toggle('active', active);
    if (active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
}

function NotFound() {
  return h('div', { class: 'view' }, h('h1', {}, 'Not found'), h('a', { href: '#/' }, 'Go home'));
}

const bannersEl = document.getElementById('banners');
onBanners(list => bannersEl.replaceChildren(...list.map(b => h('div', { class: 'banner glass', role: 'alert' },
  h('div', { class: 'banner-text' }, h('strong', {}, b.title), h('p', {}, b.body)),
  h('div', { class: 'banner-actions' },
    b.actions.map(a => h('button', { type: 'button', class: `btn small ${a.primary ? 'primary' : 'glass'}`, onclick: () => { dismiss(b.id); a.run?.(); } }, a.label)),
    h('button', { type: 'button', class: 'icon-btn small', 'aria-label': 'Dismiss', onclick: () => dismiss(b.id) }, '✕'))))));

window.addEventListener('hashchange', render);
render();
if (R.settings().onboarded) reminders.start();
else window.addEventListener('hashchange', function startOnce() {
  if (!R.settings().onboarded) return;
  window.removeEventListener('hashchange', startOnce);
  reminders.start();
});

// Installable app: offline support and updates on each open (see sw.js)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(e => console.warn('Offline support unavailable', e));
  });
}
// Ask the browser not to clear the diary under storage pressure (home-screen apps on iOS already get this)
navigator.storage?.persist?.().catch(() => {});
