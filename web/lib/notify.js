// In-app notices, shown at the top of Home, plus a system notification when the page is in the background
// and permission is granted. Each one clears itself after a while, or after a few visits to Home.

let banners = [];
const listeners = new Set();
let seq = 0;

const emit = () => listeners.forEach(fn => fn(banners));

export function onBanners(fn) {
  listeners.add(fn);
  fn(banners);
  return () => listeners.delete(fn);
}

const TTL_MIN = 45; // a notice is stale after this long
const MAX_VISITS = 3; // ...or once it's been seen on this many visits to Home

/** actions: [{ label, primary?, run }]. ttlMin: minutes before it clears itself. */
export function notify({ key, title, body, actions = [], ttlMin = TTL_MIN }) {
  if (key) banners = banners.filter(b => b.key !== key);
  banners = [...banners, { id: ++seq, key, title, body, actions, expires: Date.now() + ttlMin * 60_000, visits: 0 }];
  emit();
  // The iOS app schedules real notifications ahead of time (native.js); this is the browser's stand-in
  if (!globalThis.Capacitor?.isNativePlatform?.() && document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    try {
      const n = new Notification(title, { body, tag: key });
      n.onclick = () => { window.focus(); n.close(); };
    } catch { /* some browsers only allow notifications from a service worker */ }
  }
}

/** Called each time Home opens: counts a visit for each notice, and clears the ones seen enough. */
export function countVisit() {
  banners = banners.map(b => ({ ...b, visits: b.visits + 1 })).filter(b => b.visits <= MAX_VISITS);
  emit();
}

setInterval(() => {
  const live = banners.filter(b => b.expires > Date.now());
  if (live.length !== banners.length) { banners = live; emit(); }
}, 30_000);

export function dismiss(id) {
  banners = banners.filter(b => b.id !== id);
  emit();
}

export function dismissKey(key) {
  banners = banners.filter(b => b.key !== key);
  emit();
}

export function notificationStatus() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission; // 'granted' | 'denied' | 'default'
}
