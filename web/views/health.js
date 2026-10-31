// Apple Health: bring in steps and sleep from the Health app's export, or daily from a Shortcut.
import { h, iconButton, toast, copyText } from '../lib/ui.js';
import * as R from '../lib/repos.js';
import { readHealthExport, parseShortcut } from '../lib/health.js';
import { dayLabel, localDate } from '../lib/dates.js';
import { isNative, connectHealth } from '../lib/native.js';

export function HealthView(ctx) {
  // Opened by the Shortcut with today's numbers: save them and go back to Today
  const fromShortcut = parseShortcut(ctx.params);
  if (fromShortcut.length) {
    const n = R.health.merge(fromShortcut, 'shortcut');
    toast(`Apple Health: ${n} day${n === 1 ? '' : 's'} updated`);
    setTimeout(() => { location.hash = '#/'; }, 0);
    return h('div', { class: 'view' });
  }

  const root = h('div', { class: 'view' });
  const render = () => root.replaceChildren(
    h('header', { class: 'top-bar' }, iconButton('‹', 'Back', () => history.back()), h('h1', {}, 'Apple Health'), h('span')),
    status(),
    // The app reads Health directly; the browser has to make do with an export or a Shortcut
    ...(isNative ? [nativeCard(render), syncReport()] : [importCard(render), shortcutCard()]));
  render();
  return root;
}

/** What the last sync found, so a missing number can be traced: nothing in Health, no permission, or an error. */
function syncReport() {
  const r = R.settings().healthReport;
  if (!r) return null;
  const lines = [
    `Steps: ${r.stepDays} days`,
    `Sleep: ${r.sleepSamples} records${r.sleepSamples ? ` (${r.sleepStates.join(', ')}), ${r.sleepNights} nights of an hour or more` : ''}`,
    ...r.errors,
  ];
  const report = h('section', { class: 'card glass stack tight sync-report' },
    h('h2', {}, `Last sync · ${new Date(r.at).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })}`),
    lines.map(t => h('p', { class: 'hint' }, t)));
  if (r.errors.length || r.sleepSamples) return report;
  // Steps came but no sleep at all: almost always Sleep switched off for the app in Health's permissions
  return h('div', { class: 'stack' },
    h('section', { class: 'card glass stack sleep-fix' },
      h('h2', {}, 'Sleep isn’t coming through'),
      h('p', { class: 'muted' }, 'iPhone isn’t sharing sleep with the app yet. To turn it on:'),
      h('ol', { class: 'fix-steps' },
        h('li', {}, 'Open the Health app and tap your picture (top right)'),
        h('li', {}, 'Tap Apps, then Unfug My Back'),
        h('li', {}, 'Turn on Sleep'),
        h('li', {}, 'Come back here and tap Sync now')),
      h('a', { class: 'btn glass', href: 'x-apple-health://' }, 'Open the Health app'),
      h('p', { class: 'hint' }, 'If Sleep is already on, check the Health app has sleep under Browse › Sleep. Without an Apple Watch, set a sleep schedule there with “Track Time in Bed with iPhone” turned on.')),
    report);
}

function nativeCard(render) {
  const on = R.settings().healthSync;
  return h('section', { class: 'card glass stack' },
    h('h2', {}, on ? 'Connected' : 'Connect Apple Health'),
    h('p', { class: 'hint' }, 'Reads your daily steps and sleep so you can see how they line up with your pain. Nothing leaves your phone.'),
    h('button', {
      type: 'button', class: 'btn primary', onclick: async e => {
        e.currentTarget.disabled = true;
        try {
          const n = await connectHealth();
          toast(n ? `Apple Health: ${n} day${n === 1 ? '' : 's'} updated` : 'Nothing new from Apple Health. Check Settings › Health › Data Access.');
        } catch { toast('Couldn’t reach Apple Health'); }
        render();
      },
    }, on ? 'Sync now' : 'Connect'));
}

const vsText = (date, key) => {
  const pct = R.health.vsUsual(date, key);
  return pct == null ? null : Math.abs(pct) < 5 ? 'About usual' : `${pct > 0 ? '↑' : '↓'} ${Math.abs(pct)}% on usual`;
};

/** What's come in: last night's sleep and the latest day's steps, each with its weekly average. */
function status() {
  const days = R.health.all();
  if (!days.length) return h('p', { class: 'muted' }, 'See how your steps and sleep line up with your pain. Everything stays on this phone.');
  const latest = key => days.filter(d => d[key] != null).at(-1);
  const weekAvg = key => {
    const last = days.filter(d => d[key] != null).slice(-7);
    return last.length ? last.reduce((a, d) => a + d[key], 0) / last.length : null;
  };
  const night = latest('sleepHours'), walk = latest('steps');
  const sleepAvg = weekAvg('sleepHours'), stepsAvg = weekAvg('steps');
  const stat = (label, big, unit, sub) => h('div', { class: 'health-stat' },
    h('span', { class: 'hint' }, label),
    h('div', {}, h('span', { class: 'num' }, big), unit ? h('span', { class: 'unit' }, unit) : null),
    sub ? h('span', { class: 'hint' }, sub) : null);
  return h('section', { class: 'card glass health-summary' },
    h('div', { class: 'health-stats' },
      night ? stat(`${R.health.sleepWord()} · ${night.date === localDate() ? 'last night' : dayLabel(night.date).toLowerCase()}`, String(night.sleepHours), 'h', [vsText(night.date, 'sleepHours'), sleepAvg != null ? `Week average ${sleepAvg.toFixed(1)} h` : null].filter(Boolean).join(' · '))
        : stat('Sleep', '–', '', 'None recorded yet'),
      walk ? stat(`Steps · ${dayLabel(walk.date).toLowerCase()}`, walk.steps.toLocaleString(), '', [vsText(walk.date, 'steps'), stepsAvg != null ? `Week average ${Math.round(stepsAvg).toLocaleString()}` : null].filter(Boolean).join(' · '))
        : stat('Steps', '–', '', 'None recorded yet')),
    h('p', { class: 'hint' }, `${days.length} days brought in. They show on Home's chart and in each check-in.`));
}

function importCard(rerender) {
  const bar = h('div', { class: 'import-bar', hidden: true }, h('i'));
  const msg = h('p', { class: 'hint', 'aria-live': 'polite' });
  const input = h('input', {
    type: 'file', accept: '.zip,.xml,application/zip,text/xml', hidden: true,
    onchange: async e => {
      const file = e.target.files[0];
      if (!file) return;
      pick.disabled = true;
      bar.hidden = false;
      msg.textContent = 'Reading… big exports take a minute.';
      try {
        const days = await readHealthExport(file, f => { bar.firstChild.style.transform = `scaleX(${f})`; });
        const n = R.health.merge(days, 'apple-health-export');
        toast(n ? `Added ${n} days from Apple Health` : 'No steps or sleep found in that file');
        rerender();
      } catch (err) {
        console.error(err);
        msg.textContent = err.message || 'Couldn’t read that file.';
        pick.disabled = false;
        bar.hidden = true;
      }
    },
  });
  const pick = h('button', { type: 'button', class: 'btn primary', onclick: () => input.click() }, 'Choose export.zip');
  return h('section', { class: 'card glass stack' },
    h('h2', {}, 'Bring in your history'),
    h('ol', { class: 'how' },
      h('li', {}, 'Open the Health app and tap your picture, top right.'),
      h('li', {}, 'Tap ', h('strong', {}, 'Export All Health Data'), ', then ', h('strong', {}, 'Save to Files'), '.'),
      h('li', {}, 'Come back here and choose that file.')),
    input, pick, bar, msg,
    h('p', { class: 'hint' }, 'Only daily steps and sleep are kept. The file is read on your phone and never uploaded.'));
}

function shortcutCard() {
  const base = `${location.origin}${location.pathname}#/health?steps=`;
  return h('section', { class: 'card glass' },
    h('details', { class: 'how-details' },
      h('summary', {}, h('h2', {}, 'Keep it up to date'), h('span', { class: 'hint' }, 'Optional: a Shortcut sends each day’s steps')),
      h('ol', { class: 'how' },
        h('li', {}, 'In Shortcuts, make a new shortcut and add ', h('strong', {}, 'Find Health Samples'), ': Type is Steps, Start Date is in the last 7 days, Group by Day.'),
        h('li', {}, 'Add ', h('strong', {}, 'Repeat with Each'), '. Inside it add ', h('strong', {}, 'Text'), ' with the Repeat Item’s Start Date (custom format yyyy-MM-dd), a colon, then its Value.'),
        h('li', {}, 'After the repeat, add ', h('strong', {}, 'Combine Text'), ' on Repeat Results, with a comma.'),
        h('li', {}, 'Add ', h('strong', {}, 'Open URLs'), ' with this link followed by the Combined Text:'),
      ),
      h('div', { class: 'row tight' },
        h('code', { class: 'url-box grow' }, base),
        h('button', { type: 'button', class: 'btn small glass', onclick: async () => toast((await copyText(base)) ? 'Link copied' : 'Couldn’t copy') }, 'Copy')),
      h('p', { class: 'hint' }, 'Then in Automation, run it each evening before your check-in.')));
}
