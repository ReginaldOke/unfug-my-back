// Date helpers. Calendar days are local 'YYYY-MM-DD' strings; instants are ISO UTC strings.

export const pad = n => String(n).padStart(2, '0');

export function localDate(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s, n) {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return localDate(d);
}

export function daysBetween(a, b) {
  return Math.round((parseDate(b) - parseDate(a)) / 86_400_000);
}

export function dayLabel(s, today = localDate()) {
  if (s === today) return 'Today';
  if (s === addDays(today, -1)) return 'Yesterday';
  return parseDate(s).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

export const weekdayLetter = s => parseDate(s).toLocaleDateString(undefined, { weekday: 'narrow' });

export const fmtTime = d => new Date(d).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

export const fmtDateTime = d => new Date(d).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function fmtMinutes(min) {
  min = Math.round(min);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export const minutesSince = (iso, now = new Date()) => (now - new Date(iso)) / 60_000;

export function toLocalInput(d) {
  return `${localDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
