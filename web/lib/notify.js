// In-app banners, plus a system notification when the page is in the background and permission is granted.
// Stands in for UserNotifications actionable notifications.

let banners = [];
const listeners = new Set();
let seq = 0;

const emit = () => listeners.forEach(fn => fn(banners));

export function onBanners(fn) {
  listeners.add(fn);
  fn(banners);
  return () => listeners.delete(fn);
}

/** actions: [{ label, primary?, run }] */
export function notify({ key, title, body, actions = [] }) {
  if (key) banners = banners.filter(b => b.key !== key);
  banners = [...banners, { id: ++seq, key, title, body, actions }];
  emit();
  // The iOS app schedules real notifications ahead of time (native.js); this is the browser's stand-in
  if (!globalThis.Capacitor?.isNativePlatform?.() && document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    try {
      const n = new Notification(title, { body, tag: key });
      n.onclick = () => { window.focus(); n.close(); };
    } catch { /* some browsers only allow notifications from a service worker */ }
  }
}

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
