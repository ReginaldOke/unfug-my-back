// Settings: what you track, reminders, your data, help.
import { h, shareOrDownload, sheet, vibrate, toast, segmented } from '../lib/ui.js';
import * as R from '../lib/repos.js';
import { buildExport } from '../lib/export.js';
import { planImport, isDiaryExport } from '../lib/import.js';
import { readWorkoutText, readCSV } from '../lib/interpret.js';
import { readHealthExport } from '../lib/health.js';
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

  return h('div', { class: 'view settings-view' },
    h('header', { class: 'top-bar' }, h('h1', {}, 'Settings')),

    appearanceSection(),

    h('section', { class: 'card glass' },
      row('#/setup?step=stressors&edit=1', 'Stressors & helpers', `${nStress} stressors · ${nHelp} helpers`),
      h('button', { type: 'button', class: 'list-row', onclick: openReminderSheet },
        h('span', { class: 'grow' }, 'Reminders', h('span', { class: 'hint block' }, rem.enabled ? `Move every ${rem.intervalMin} min · ${hoursSummary(rem)}` : 'Move nudges off')),
        h('span', { class: 'chev', 'aria-hidden': 'true' }, '›')),
      HEALTH_IMPORT ? row('#/health', 'Apple Health', R.health.all().length ? `Steps and sleep for ${R.health.all().length} days` : 'Bring in steps and sleep') : null),

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
  return h('section', { class: 'card glass row between appearance' }, h('h2', { class: 'row-title' }, 'Appearance'), seg);
}

const exportAll = () => shareOrDownload(`unfug-my-back-${R.firstDataDate()}-to-${localDate()}.json`, JSON.stringify(buildExport(R.snapshot(), { from: R.firstDataDate(), to: localDate(), regions: REGIONS }), null, 2), 'application/json');

function dataSection() {
  const from = h('input', { type: 'date', class: 'glass-input', value: R.firstDataDate(), 'aria-label': 'Export from' });
  const to = h('input', { type: 'date', class: 'glass-input', value: localDate(), 'aria-label': 'Export to' });
  const exportData = () => buildExport(R.snapshot(), { from: from.value, to: to.value, regions: REGIONS });

  return h('section', { class: 'card glass stack' },
    h('h2', { class: 'row-title' }, 'Your data'),
    h('p', { class: 'hint' }, 'Saves your diary as one file. It includes instructions for AI, so you can attach it to any AI chat as is.'),
    h('div', { class: 'row' }, from, h('span', { class: 'hint' }, 'to'), to),
    h('div', { class: 'row data-actions' },
      h('button', { type: 'button', class: 'btn glass', onclick: () => shareOrDownload(`unfug-my-back-${from.value}-to-${to.value}.json`, JSON.stringify(exportData(), null, 2), 'application/json') }, 'Export'),
      h('button', { type: 'button', class: 'btn glass', onclick: openImportSheet }, 'Import')),
    h('button', { type: 'button', class: 'btn danger', onclick: () => openWipeSheet(exportAll) }, 'Delete all data'));
}

/**
 * Import: a file (our export, a CSV from another app, a Health export, a note saved as text) or text
 * pasted in (a workout from Notes). It's read on the phone, previewed, then merged in.
 */
function openImportSheet() {
  sheet(close => {
    const status = h('p', { class: 'hint', 'aria-live': 'polite' });
    const input = h('input', {
      type: 'file', hidden: true,
      onchange: async e => {
        const file = e.target.files[0];
        input.value = '';
        if (!file) return;
        status.textContent = 'Reading…';
        try {
          const data = await readFile(file, f => { status.textContent = `Reading… ${Math.round(f * 100)}%`; });
          status.textContent = '';
          if (!data) { status.textContent = 'Couldn’t find anything to bring in from that file.'; return; }
          close();
          previewImport(data);
        } catch (err) { status.textContent = err.message || 'Couldn’t read that file.'; }
      },
    });
    const text = h('textarea', { class: 'notes glass import-text', rows: 6, placeholder: 'Or paste a workout, e.g.\nPush:\nBench press 3x8 60kg\nDips 3x10', 'aria-label': 'Paste a workout or a CSV' });
    return h('div', { class: 'stack' },
      h('h2', {}, 'Import'),
      h('p', { class: 'muted' }, 'A backup from this app, a CSV from another app, an Apple Health export, or a workout written as a note.'),
      input,
      h('button', { type: 'button', class: 'btn primary', onclick: () => input.click() }, 'Choose a file'),
      text,
      h('button', {
        type: 'button', class: 'btn glass', onclick: () => {
          const data = readText(text.value);
          if (!data) { status.textContent = 'Couldn’t find a workout or table in that text.'; return; }
          close();
          previewImport(data);
        },
      }, 'Read pasted text'),
      status);
  }, { tall: true });
}

/** Works out what a file is and reads it into the export's shape (or null). */
async function readFile(file, onProgress) {
  if (/\.(zip|xml)$/i.test(file.name)) {
    const days = await readHealthExport(file, onProgress);
    return days.length ? { factors: [], dailyEntries: [], healthDays: days.map(d => ({ id: R.uuid(), source: 'apple-health-export', ...d })) } : null;
  }
  // Backups, notes and CSVs are small; anything this big is a mistake (or meant to jam the app)
  if (file.size > 25 * 1024 * 1024) throw new Error('That file is too big to import.');
  const raw = await file.text();
  if (/\.json$/i.test(file.name) || raw.trimStart().startsWith('{')) {
    let data;
    try { data = JSON.parse(raw); } catch { data = null; }
    if (isDiaryExport(data)) return data;
  }
  return /\.(csv|tsv)$/i.test(file.name) ? readCSV(raw) : readText(raw);
}

/** Pasted or plain text: a table if it looks like one, otherwise a workout. */
const readText = raw => (/^[^\n]*[,\t;][^\n]*\n[^\n]*[,\t;]/.test(raw.trim()) && readCSV(raw)) || readWorkoutText(raw);

/** What an import would add, then merge it in on Import. */
function previewImport(data) {
  const n = (k, one, many = `${one}s`) => `${k} ${k === 1 ? one : many}`;
  // Days checked in both here and in the file: the file's version can replace this phone's
  let replaceDays = false;
  const summaryOf = plan => {
    const { checkins, factors, routines, sessions, healthDays } = plan.summary;
    return [checkins && n(checkins, 'check-in'), factors && n(factors, 'thing to track', 'things to track'),
      routines && n(routines, 'routine'), sessions && n(sessions, 'past session'), healthDays && n(healthDays, 'day of steps and sleep', 'days of steps and sleep')].filter(Boolean);
  };
  const plans = { keep: planImport(R.snapshot(), data), replace: planImport(R.snapshot(), data, { replaceDays: true }) };
  const clashes = plans.keep.summary.skippedDays;
  if (!summaryOf(plans.keep).length && !clashes) return toast('Nothing new to add');
  // Show the routines as they'll appear, so a note that was read oddly is caught before it's added
  const newRoutines = plans.keep.add.routines ?? [];
  const adds = h('p', { class: 'muted' });
  const paint = () => {
    const list = summaryOf(replaceDays ? plans.replace : plans.keep);
    adds.textContent = list.length ? `Adds ${list.join(', ').replace(/, ([^,]*)$/, ' and $1')}.` : 'Nothing new to add.';
  };
  paint();
  const choice = clashes ? h('div', { class: 'stack tight import-clash' },
    h('p', {}, `${n(clashes, 'day')} in this file ${clashes === 1 ? 'is' : 'are'} already checked in on this phone. Which version should ${clashes === 1 ? 'it' : 'they'} keep?`),
    segmented([['keep', 'This phone’s'], ['replace', 'The file’s']], 'keep', v => { replaceDays = v === 'replace'; paint(); }, 'Which check-ins to keep')) : null;
  sheet(close => h('div', { class: 'stack' },
    h('h2', {}, 'Bring this in?'),
    adds,
    newRoutines.length ? h('div', { class: 'import-routines' }, newRoutines.map(routinePreview)) : null,
    choice,
    h('p', { class: 'hint' }, 'Nothing else here is changed or removed. You can edit or delete anything afterwards.'),
    h('button', {
      type: 'button', class: 'btn primary', onclick: () => {
        const plan = replaceDays ? plans.replace : plans.keep;
        const list = summaryOf(plan);
        if (!list.length) { close(); return toast('Nothing new to add'); }
        R.importDiary(data, plan);
        close();
        toast(`Added ${list[0]}${list.length > 1 ? ' and more' : ''}`);
      },
    }, 'Add'),
    h('button', { type: 'button', class: 'btn ghost', onclick: close }, 'Cancel')), { tall: true });
}

const routinePreview = r => h('div', {},
  h('strong', {}, r.group ? `${r.group} · ${r.name}` : r.name),
  h('ul', {}, r.items.map(it => h('li', {},
    h('span', {}, it.name),
    h('span', { class: 'hint' }, [it.dose, it.extra].filter(Boolean).join(' · '))))));

/** Deleting everything takes a deliberate press and hold, after saying exactly what goes. */
function openWipeSheet(exportAll) {
  const n = (k, one, many) => `${k} ${k === 1 ? one : many}`;
  const lost = `${n(R.checkins.all().length, 'check-in', 'check-ins')}, ${n(R.factors.all().filter(f => !f.routineId).length, 'stressor or helper', 'stressors and helpers')} and ${n(R.routines.all().length, 'routine', 'routines')}`;
  const HOLD_MS = 1500;
  sheet(close => {
    let timer = 0;
    const btn = h('button', { type: 'button', class: 'btn danger hold-btn' }, h('span', { class: 'hold-fill', 'aria-hidden': 'true' }), h('span', { class: 'hold-label' }, 'Hold to delete'));
    const cancel = () => { clearTimeout(timer); btn.classList.remove('holding'); };
    btn.addEventListener('pointerdown', e => {
      e.preventDefault();
      btn.classList.add('holding');
      vibrate(6);
      timer = setTimeout(() => { vibrate(20); R.wipeEverything(); location.hash = '#/'; location.reload(); }, HOLD_MS);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => btn.addEventListener(t, cancel));
    btn.addEventListener('contextmenu', e => e.preventDefault());
    btn.style.setProperty('--hold', `${HOLD_MS}ms`);
    return h('div', { class: 'stack wipe-sheet' },
      h('h2', {}, 'Delete all data?'),
      h('p', { class: 'muted' }, `This erases ${lost} from this device. It can't be undone.`),
      h('button', { type: 'button', class: 'btn ghost', onclick: exportAll }, 'Export a copy first'),
      btn,
      h('button', { type: 'button', class: 'btn ghost', onclick: close }, 'Cancel'));
  });
}
