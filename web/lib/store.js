// Storage layer: the whole diary is one JSON document in localStorage.
// Only repos.js imports this module; views go through the repositories.

export const SCHEMA_VERSION = 1;
const KEY = 'unfug-my-back/v1';

export const TABLES = [
  'factors', 'factorChanges', 'factorLogs', 'dailyEntries', 'painMarkers', 'flares',
  'reminderEvents', 'routines', 'routineCompletions', 'aiSummaries', 'healthDays', 'routineChanges',
];

// Nudges default to working hours: 9 to 5, Monday to Friday
const ACTIVE_HOURS = { on: true, start: '09:00', end: '17:00' };

export const DEFAULT_SETTINGS = {
  onboarded: false,
  seeded: false,
  checkinTime: '21:00',
  aiConsent: false,
  reminder: {
    enabled: true,
    intervalMin: 45,
    minWalkMin: 2,
    minSteps: 150,
    snoozeMin: 10,
    activeHours: Array.from({ length: 7 }, (_, d) => ({ ...ACTIVE_HOURS, on: d >= 1 && d <= 5 })), // indexed by Date#getDay()
  },
  pausedUntil: null,
  lastMovementAt: null,
  lastWakeAt: null,
  drivingSince: null,
  motionSamples: [],
  lastNotified: {},
};

export const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

let db = null;
let batching = 0;
const listeners = new Set();

export function uuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  // randomUUID only exists in secure contexts; a phone on the LAN address isn't one
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function blank() {
  return { schemaVersion: SCHEMA_VERSION, settings: structuredClone(DEFAULT_SETTINGS), ...Object.fromEntries(TABLES.map(t => [t, []])) };
}

export function load() {
  try { db = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { db = null; }
  if (!db) db = blank();
  for (const t of TABLES) db[t] ||= [];
  db.settings = {
    ...structuredClone(DEFAULT_SETTINGS),
    ...db.settings,
    reminder: { ...structuredClone(DEFAULT_SETTINGS.reminder), ...db.settings?.reminder },
  };
  return db;
}

export function save() {
  if (batching) return;
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { console.error('Could not save diary', e); }
  listeners.forEach(fn => fn());
}

/** Run several writes and persist once at the end. */
export function batch(fn) {
  batching++;
  try { return fn(); } finally { batching--; save(); }
}

// Another tab or window of the app saved: pick up its copy rather than overwrite it with ours later
if (typeof window !== 'undefined') {
  window.addEventListener('storage', e => {
    if (e.key !== KEY || !e.newValue) return;
    load();
    listeners.forEach(fn => fn());
  });
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export const nowISO = () => new Date().toISOString();

export const table = t => db[t];

export function insert(t, fields) {
  const now = nowISO();
  const row = { id: uuid(), createdAt: now, updatedAt: now, timeZone, schemaVersion: SCHEMA_VERSION, ...fields };
  db[t].push(row);
  save();
  return row;
}

export function update(t, id, patch) {
  const row = db[t].find(r => r.id === id);
  if (!row) return null;
  Object.assign(row, patch, { updatedAt: nowISO() });
  save();
  return row;
}

/** Hard delete. Only for rows that are being replaced in the same batch (e.g. re-saving a check-in). */
export function removeWhere(t, pred) {
  db[t] = db[t].filter(r => !pred(r));
}

export const settings = () => db.settings;

export function setSettings(patch) {
  Object.assign(db.settings, patch);
  save();
}

export const snapshot = () => structuredClone(db);

export function wipe() {
  localStorage.removeItem(KEY);
  db = blank();
}
