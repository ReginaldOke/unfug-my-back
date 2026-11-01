// Light and dark mode. Auto follows the day: light from 6am, dark from 5pm.
import * as R from './repos.js';

export const LIGHT_FROM = 6, DARK_FROM = 17;
const BG = { light: '#efebe6', dark: '#0d0d0f' };
// In the iOS app the clock and battery switch colour with the theme ('DARK' style means light text)
const Cap = globalThis.Capacitor;
const StatusBar = Cap?.isNativePlatform?.() ? Cap.registerPlugin('StatusBar') : null;

/** 'auto' | 'light' | 'dark', as chosen in Settings. */
export const themeSetting = () => R.settings().theme ?? 'auto';

export function currentTheme(now = new Date()) {
  const s = themeSetting();
  if (s !== 'auto') return s;
  const hr = now.getHours();
  return hr >= LIGHT_FROM && hr < DARK_FROM ? 'light' : 'dark';
}

export function applyTheme() {
  const t = currentTheme();
  if (document.documentElement.dataset.theme === t) return;
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BG[t]);
  StatusBar?.setStyle({ style: t === 'light' ? 'LIGHT' : 'DARK' }).catch(() => {});
}

export function setTheme(value) {
  R.setSettings({ theme: value });
  applyTheme();
}

/** Applies the theme now and keeps Auto in step with the clock. */
export function startTheme() {
  applyTheme();
  setInterval(applyTheme, 60_000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) applyTheme(); });
}
