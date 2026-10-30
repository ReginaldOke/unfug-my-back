// Reminder settings drawer, opened from the Today movement card and from Settings.
import { h, sheet, segmented, toast } from '../lib/ui.js';
import * as R from '../lib/repos.js';
import * as reminders from '../lib/reminders.js';
import { notificationStatus } from '../lib/notify.js';
import { isNative, testNotification, notificationSummary } from '../lib/native.js';
import { fmtDateTime } from '../lib/dates.js';

// Mon first; values are Date#getDay() indexes, as activeHours is stored
const DAYS = [[1, 'M'], [2, 'T'], [3, 'W'], [4, 'T'], [5, 'F'], [6, 'S'], [0, 'S']];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** One time window for every day it's on (the stored per-day hours all share it). */
export function nudgeHours(rem = R.settings().reminder) {
  const on = DAYS.map(([d]) => d).filter(d => rem.activeHours[d].on);
  const first = rem.activeHours[on[0] ?? 1];
  return { on, start: first.start, end: first.end };
}

const hm = t => {
  const [hh, mm] = t.split(':').map(Number);
  const h12 = hh % 12 || 12;
  return `${h12}${mm ? `:${String(mm).padStart(2, '0')}` : ''}${hh < 12 ? 'am' : 'pm'}`;
};

/** "9am–5pm, Mon–Fri" */
export function hoursSummary(rem = R.settings().reminder) {
  const { on, start, end } = nudgeHours(rem);
  if (!on.length) return 'No days set';
  const key = on.join();
  const days = key === '1,2,3,4,5,6,0' ? 'every day' : key === '1,2,3,4,5' ? 'Mon–Fri' : key === '6,0' ? 'weekends' : on.map(d => DAY_NAMES[d]).join(', ');
  return `${hm(start)}–${hm(end)}, ${days}`;
}

export function openReminderSheet() {
  const setRem = patch => { R.setSettings({ reminder: { ...R.settings().reminder, ...patch } }); reminders.reschedule(); };
  const setHours = ({ on, start, end }) => {
    const cur = nudgeHours();
    const days = on ?? cur.on;
    const s = start ?? cur.start, e = end ?? cur.end;
    if (s >= e) toast('Start should be before end');
    setRem({ activeHours: Array.from({ length: 7 }, (_, d) => ({ on: days.includes(d), start: s, end: e })) });
  };

  sheet(close => {
    const s = R.settings();
    const hours = nudgeHours(s.reminder);
    const body = h('div', { class: 'stack' + (s.reminder.enabled ? '' : ' is-off') });
    const dayChips = h('div', { class: 'day-chips', role: 'group', 'aria-label': 'Days' });
    const paintDays = () => dayChips.replaceChildren(...DAYS.map(([d, letter]) => {
      const on = nudgeHours().on.includes(d);
      return h('button', {
        type: 'button', class: `day-chip${on ? ' on' : ''}`, 'aria-pressed': String(on), 'aria-label': DAY_NAMES[d],
        onclick: () => { const cur = nudgeHours().on; setHours({ on: on ? cur.filter(x => x !== d) : [...cur, d] }); paintDays(); },
      }, letter);
    }));
    paintDays();

    const perm = notificationStatus();
    // Plain DOM append prints null as text, so empty slots are dropped first
    body.append(...[
      h('label', { class: 'row between' }, h('span', {}, 'Nudge me to move'),
        h('input', { type: 'checkbox', class: 'switch', checked: s.reminder.enabled, 'aria-label': 'Nudge me to move', onchange: e => { setRem({ enabled: e.target.checked }); body.classList.toggle('is-off', !e.target.checked); } })),
      h('div', { class: 'field dim-off' }, h('span', { class: 'field-label' }, 'After sitting still for'),
        segmented([[20, '20'], [30, '30'], [45, '45'], [60, '60 min']], s.reminder.intervalMin, v => setRem({ intervalMin: v }), 'Nudge interval')),
      h('div', { class: 'field dim-off' }, h('span', { class: 'field-label' }, 'Only between'),
        h('div', { class: 'row tight' },
          h('input', { type: 'time', class: 'glass-input', value: hours.start, 'aria-label': 'From', onchange: e => setHours({ start: e.target.value }) }),
          h('span', { class: 'hint' }, 'and'),
          h('input', { type: 'time', class: 'glass-input', value: hours.end, 'aria-label': 'To', onchange: e => setHours({ end: e.target.value }) })),
        dayChips),
      h('hr', { class: 'sep' }),
      h('label', { class: 'row between' }, h('span', {}, 'Evening check-in reminder'),
        h('input', { type: 'time', class: 'glass-input narrow', value: s.checkinTime, 'aria-label': 'Check-in reminder time', onchange: e => R.setSettings({ checkinTime: e.target.value }) })),
      perm === 'default'
        ? h('button', { type: 'button', class: 'btn glass', onclick: async () => { await Notification.requestPermission(); close(); openReminderSheet(); } }, 'Allow notifications')
        : perm === 'denied' ? h('p', { class: 'hint' }, 'Notifications are blocked in your phone’s settings.') : null,
      // In the iOS app: check a nudge actually arrives, with its sound
      isNative ? h('button', {
        type: 'button', class: 'btn glass', onclick: async () => {
          const ok = await testNotification();
          toast(ok ? 'Test nudge in 5 seconds. Lock your phone to see it.' : 'Notifications are off. Turn them on in Settings › Notifications › Unfug My Back.');
        },
      }, 'Send a test nudge') : null,
      isNative ? nativeStatus() : null,
    ].filter(Boolean));

    return h('div', { class: 'stack' },
      h('h2', {}, 'Reminders'),
      body);
  });
}

/** One line on what iOS has lined up: allowed or not, how many, and when the next one is. */
function nativeStatus() {
  const line = h('p', { class: 'hint' });
  notificationSummary().then(n => {
    if (!n) return;
    line.textContent = !n.allowed ? 'iPhone isn’t letting the app send notifications. Turn them on in Settings › Notifications › Unfug My Back.'
      : !n.pending ? 'Nothing scheduled yet.'
      : `${n.pending} scheduled. Next: ${n.next.title}, ${fmtDateTime(n.next.at)}.`;
  }).catch(() => {});
  return line;
}
