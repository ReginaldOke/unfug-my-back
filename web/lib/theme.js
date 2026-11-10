// Light and dark mode. Auto follows the day: light from 6am, dark from 5pm.
import * as R from './repos.js';

export const LIGHT_FROM = 6, DARK_FROM = 17;
const BG = { light: '#efebe6', dark: '#0d0d0f' };
// In the iOS app the clock and battery switch colour with the theme ('DARK' style means light text)
const Cap = globalThis.Capacitor;
const native = Cap?.isNativePlatform?.();
const StatusBar = native ? Cap.registerPlugin('StatusBar') : null;
const AppLaunch = native ? Cap.registerPlugin('AppLaunch') : null; // the loading screen reads the setting before any web code runs

/** 'auto' | 'light' | 'dark', as chosen in Settings. */
export const themeSetting = () => R.settings().theme ?? 'auto';

// The look picked on the marketing page, which carries into the web app until one is picked in Settings
const siteTheme = () => { try { const t = localStorage.getItem('back-story-site-theme'); return t === 'light' || t === 'dark' ? t : null; } catch { return null; } };

export function currentTheme(now = new Date()) {
  const s = themeSetting();
  if (s !== 'auto') return s;
  const site = native ? null : siteTheme();
  if (site) return site;
  const hr = now.getHours();
  return hr >= LIGHT_FROM && hr < DARK_FROM ? 'light' : 'dark';
}

let applied = null;
export function applyTheme() {
  const t = currentTheme();
  if (applied === t) return;
  applied = t;
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BG[t]);
  StatusBar?.setStyle({ style: t === 'light' ? 'LIGHT' : 'DARK' }).catch(() => {});
}

export function setTheme(value) {
  R.setSettings({ theme: value });
  AppLaunch?.setTheme({ setting: value }).catch(() => {});
  applyTheme();
}

/** Applies the theme now and keeps Auto in step with the clock. */
export function startTheme() {
  AppLaunch?.setTheme({ setting: themeSetting() }).catch(() => {});
  applyTheme();
  setInterval(applyTheme, 60_000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) applyTheme(); });
}
