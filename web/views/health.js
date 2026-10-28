// Apple Health: bring in steps and sleep from the Health app's export, or daily from a Shortcut.
import { h, iconButton, toast, copyText } from '../lib/ui.js';
import * as R from '../lib/repos.js';
import { readHealthExport, parseShortcut } from '../lib/health.js';
import { dayLabel } from '../lib/dates.js';
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
    ...(isNative ? [nativeCard(render)] : [importCard(render), shortcutCard()]),
    h('section', { class: 'card glass stack' },
      h('h2', {}, 'Screen time'),
      h('p', { class: 'hint' }, 'Screen time isn’t in Apple Health, and iPhone doesn’t share it with apps like this one. Log it on the Screen time stressor instead: Settings › Screen Time shows each day’s total.')));
  render();
  return root;
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

function status() {
  const days = R.health.all();
  if (!days.length) return h('p', { class: 'muted' }, 'See how your steps and sleep line up with your pain. Everything stays on this phone.');
  const steps = days.filter(d => d.steps != null).length, sleep = days.filter(d => d.sleepHours != null).length;
  return h('section', { class: 'card glass health-status' },
    h('div', {}, h('span', { class: 'num' }, String(days.length)), h('span', { class: 'unit' }, 'days')),
    h('p', { class: 'hint' }, `${steps} with steps, ${sleep} with sleep. Latest: ${dayLabel(days.at(-1).date)}.`),
    h('p', { class: 'hint' }, 'Add them to the chart on Today with the + under it.'));
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
