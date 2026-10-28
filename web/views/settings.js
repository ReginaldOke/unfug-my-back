// Settings: what you track, nudges, Claude, your data, help.
import { h, segmented, toast, shareOrDownload, confirmSheet } from '../lib/ui.js';
import * as R from '../lib/repos.js';
import * as reminders from '../lib/reminders.js';
import { notificationStatus } from '../lib/notify.js';
import { buildExport } from '../lib/export.js';
import { REGIONS } from '../lib/regions.js';
import { localDate } from '../lib/dates.js';
import { aiStatus } from '../lib/ai.js';

const DAYS = [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [0, 'Sun']];

const row = (href, title, detail) => h('a', { class: 'list-row', href },
  h('span', { class: 'grow' }, title, detail ? h('span', { class: 'hint block' }, detail) : null),
  h('span', { class: 'chev', 'aria-hidden': 'true' }, '›'));

export function SettingsView() {
  const s = R.settings();
  const setRem = patch => { R.setSettings({ reminder: { ...R.settings().reminder, ...patch } }); reminders.reschedule(); };
  const updDay = (d, patch) => {
    const hours = structuredClone(R.settings().reminder.activeHours);
    Object.assign(hours[d], patch);
    if (hours[d].start >= hours[d].end) toast('Start time should be before end time');
    setRem({ activeHours: hours });
  };

  const active = R.factors.all();
  const nStress = active.filter(f => f.role !== 'helper').length, nHelp = active.length - nStress;

  const aiLine = h('p', { class: 'hint' }, 'Checking…');
  aiStatus().then(({ ai }) => {
    aiLine.textContent = ai
      ? 'Connected. “Analyse my data” shows a summary here.'
      : '“Analyse my data” copies your diary so you can paste it into Claude.';
  });

  const perm = notificationStatus();

  return h('div', { class: 'view' },
    h('header', { class: 'top-bar' }, h('h1', {}, 'Settings')),

    h('section', { class: 'card glass' },
      row('#/setup?step=stressors&edit=1', 'Stressors & helpers', `${nStress} stressors · ${nHelp} helpers`)),

    h('section', { class: 'card glass stack' },
      h('label', { class: 'row between' }, h('h2', {}, 'Nudge me to move'),
        h('input', { type: 'checkbox', class: 'switch', checked: s.reminder.enabled, 'aria-label': 'Nudge me to move', onchange: e => setRem({ enabled: e.target.checked }) })),
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'After sitting still for'),
        segmented([[20, '20'], [30, '30'], [45, '45'], [60, '60 min']], s.reminder.intervalMin, v => setRem({ intervalMin: v }), 'Nudge interval')),
      h('details', { class: 'more' }, h('summary', {}, 'Active hours'),
        h('div', { class: 'days' }, DAYS.map(([d, label]) => {
          const ah = s.reminder.activeHours[d];
          return h('div', { class: 'day-row' },
            h('label', { class: 'row tight' }, h('input', { type: 'checkbox', checked: ah.on, onchange: e => updDay(d, { on: e.target.checked }) }), label),
            h('input', { type: 'time', class: 'glass-input', value: ah.start, 'aria-label': `${label} start`, onchange: e => updDay(d, { start: e.target.value }) }),
            h('span', { class: 'hint' }, 'to'),
            h('input', { type: 'time', class: 'glass-input', value: ah.end, 'aria-label': `${label} end`, onchange: e => updDay(d, { end: e.target.value }) }));
        }))),
      h('label', { class: 'row between' }, h('span', {}, 'Evening check-in reminder'),
        h('input', { type: 'time', class: 'glass-input narrow', value: s.checkinTime, onchange: e => R.setSettings({ checkinTime: e.target.value }) })),
      perm === 'default' ? h('button', { type: 'button', class: 'btn glass', onclick: async () => { await Notification.requestPermission(); location.reload(); } }, 'Allow browser notifications')
        : h('p', { class: 'hint' }, perm === 'granted' ? 'Browser notifications are on.' : perm === 'denied' ? 'Notifications are blocked in your browser settings.' : 'This browser can’t show notifications.')),

    h('section', { class: 'card glass stack' }, h('h2', {}, 'Claude'), aiLine),

    dataSection(),

    h('section', { class: 'card glass' }, row('#/help', 'Help & safety')));
}

function dataSection() {
  const from = h('input', { type: 'date', class: 'glass-input', value: R.firstDataDate(), 'aria-label': 'Export from' });
  const to = h('input', { type: 'date', class: 'glass-input', value: localDate(), 'aria-label': 'Export to' });
  const exportData = () => buildExport(R.snapshot(), { from: from.value, to: to.value, regions: REGIONS });

  return h('section', { class: 'card glass stack' },
    h('h2', {}, 'Your data'),
    h('p', { class: 'hint' }, 'Saves your diary as one file. It includes instructions for Claude, so you can attach it to a chat as is.'),
    h('div', { class: 'row' }, from, h('span', { class: 'hint' }, 'to'), to),
    h('button', { type: 'button', class: 'btn primary', onclick: () => shareOrDownload(`unfug-my-back-${from.value}-to-${to.value}.json`, JSON.stringify(exportData(), null, 2), 'application/json') }, 'Export'),
    h('button', {
      type: 'button', class: 'btn danger', onclick: async () => {
        if (!(await confirmSheet('Delete everything?', 'This erases every check-in, stressor, helper and routine on this device. Export first if you want a copy.', 'Delete all', { danger: true }))) return;
        R.wipeEverything();
        location.hash = '#/';
        location.reload();
      },
    }, 'Delete all data'));
}
