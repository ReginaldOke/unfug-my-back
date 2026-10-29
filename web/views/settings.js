// Settings: what you track, reminders, your data, help.
import { h, shareOrDownload, confirmSheet } from '../lib/ui.js';
import * as R from '../lib/repos.js';
import { buildExport } from '../lib/export.js';
import { REGIONS } from '../lib/regions.js';
import { localDate } from '../lib/dates.js';
import { openReminderSheet, hoursSummary } from './reminder-sheet.js';
import { HEALTH_IMPORT } from '../lib/health.js';
import { themeSetting, setTheme } from '../lib/theme.js';

const row = (href, title, detail) => h('a', { class: 'list-row', href },
  h('span', { class: 'grow' }, title, detail ? h('span', { class: 'hint block' }, detail) : null),
  h('span', { class: 'chev', 'aria-hidden': 'true' }, '›'));

export function SettingsView() {
  const active = R.factors.all().filter(f => !f.routineId);
  const nStress = active.filter(f => f.role !== 'helper').length, nHelp = active.length - nStress;
  const rem = R.settings().reminder;

  return h('div', { class: 'view' },
    h('header', { class: 'top-bar' }, h('h1', {}, 'Settings')),

    h('section', { class: 'card glass' },
      row('#/setup?step=stressors&edit=1', 'Stressors & helpers', `${nStress} stressors · ${nHelp} helpers`),
      h('button', { type: 'button', class: 'list-row', onclick: openReminderSheet },
        h('span', { class: 'grow' }, 'Reminders', h('span', { class: 'hint block' }, rem.enabled ? `Move every ${rem.intervalMin} min · ${hoursSummary(rem)}` : 'Move nudges off')),
        h('span', { class: 'chev', 'aria-hidden': 'true' }, '›')),
      HEALTH_IMPORT ? row('#/health', 'Apple Health', R.health.all().length ? `Steps and sleep for ${R.health.all().length} days` : 'Bring in steps and sleep') : null),

    appearanceSection(),

    dataSection(),

    h('section', { class: 'card glass' }, row('#/help', 'Help & safety')));
}

function appearanceSection() {
  const opts = [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']];
  const seg = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'Appearance' });
  const paint = () => seg.replaceChildren(...opts.map(([v, label]) => h('button', {
    type: 'button', role: 'radio', class: themeSetting() === v ? 'on' : '', 'aria-checked': String(themeSetting() === v),
    onclick: () => { setTheme(v); paint(); },
  }, label)));
  paint();
  return h('section', { class: 'card glass row between appearance' }, h('h2', {}, 'Appearance'), seg);
}

function dataSection() {
  const from = h('input', { type: 'date', class: 'glass-input', value: R.firstDataDate(), 'aria-label': 'Export from' });
  const to = h('input', { type: 'date', class: 'glass-input', value: localDate(), 'aria-label': 'Export to' });
  const exportData = () => buildExport(R.snapshot(), { from: from.value, to: to.value, regions: REGIONS });

  return h('section', { class: 'card glass stack' },
    h('h2', {}, 'Your data'),
    h('p', { class: 'hint' }, 'Saves your diary as one file. It includes instructions for AI, so you can attach it to any AI chat as is.'),
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
