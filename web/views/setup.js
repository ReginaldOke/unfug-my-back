// Setup: pick stressors, pick helpers, reminders. Also reused from Settings to edit the lists.
import { h, segmented, toast, iconButton } from '../lib/ui.js';
import * as R from '../lib/repos.js';
import * as reminders from '../lib/reminders.js';
import { notificationStatus } from '../lib/notify.js';
import { SelectCard } from './controls.js';
import { quickAddFactor } from './factor.js';
import { ROLE_ICON, MEASURE_OPTIONS } from '../lib/labels.js';

const STEPS = ['stressors', 'helpers', 'reminders'];

export function SetupView(ctx) {
  const editing = ctx.params.get('edit') === '1';
  let step = Math.max(0, STEPS.indexOf(ctx.params.get('step') || 'stressors'));
  const root = h('div', { class: 'flow setup' });

  function go(n) {
    // Editing from Settings walks stressors then helpers; reminders live in Settings already
    if (n < 0 || n >= STEPS.length || (editing && STEPS[n] === 'reminders')) return finish();
    step = n;
    render();
  }

  function finish() {
    if (!R.settings().onboarded) {
      R.setSettings({ onboarded: true });
      reminders.reschedule();
      toast('All set. Check in this evening.');
    }
    location.hash = editing ? '#/settings' : '#/';
  }

  function render() {
    const id = STEPS[step];
    root.replaceChildren(
      h('header', { class: 'flow-head' },
        step > 0 || editing ? iconButton('‹', 'Back', () => go(step - 1)) : h('span'),
        editing ? h('span') : h('div', { class: 'progress inline', 'aria-hidden': 'true' }, STEPS.map((_, i) => h('i', { class: i < step ? 'done' : i === step ? 'now' : '' }))),
        h('span')),
      h('div', { class: 'flow-body' }, content(id)),
      h('div', { class: 'flow-footer single' },
        h('button', { type: 'button', class: 'btn primary wide', onclick: () => go(step + 1) },
          editing ? (id === 'helpers' ? 'Done' : 'Next') : id === 'reminders' ? 'Finish' : 'Next')));
    root.querySelector('h1')?.focus({ preventScroll: true });
  }

  function content(id) {
    if (id === 'stressors' || id === 'helpers') {
      const roles = id === 'stressors' ? ['trigger', 'unsure'] : ['helper'];
      const list = h('div', { class: 'card-grid' });
      const fill = () => list.replaceChildren(
        ...R.factors.all({ archived: true }).filter(f => roles.includes(f.role)).map(f => SelectCard({
          icon: f.icon || ROLE_ICON[f.role], title: f.name,
          detail: `${MEASURE_OPTIONS.find(([m]) => m === f.measureType)?.[1] ?? ''}${f.role === 'unsure' ? ' · not sure yet' : ''}`,
          on: !f.isArchived,
          onToggle: on => R.factors.setArchived(f.id, !on),
        })),
        h('button', {
          type: 'button', class: 'select-card add', onclick: async () => {
            const f = await quickAddFactor({ role: id === 'stressors' ? 'trigger' : 'helper' });
            if (f) fill();
          },
        }, h('span', { class: 'well', 'aria-hidden': 'true' }, '+'), h('span', { class: 'card-title' }, id === 'stressors' ? 'Add your own' : 'Add your own')));
      fill();
      return h('div', { class: 'stack' },
        h('h1', { tabindex: -1 }, id === 'stressors' ? 'What tends to set it off?' : 'What tends to help?'),
        h('p', { class: 'muted' }, id === 'stressors'
          ? 'Switch on anything you suspect. These become tiles in your daily check-in. You can change them any time.'
          : 'Movement and recovery habits you want to track.'),
        list,
        id === 'stressors' && !editing ? h('a', { class: 'hint safety-link', href: '#/help' }, 'This app tracks patterns; it doesn’t diagnose. See warning signs that need a doctor ›') : null);
    }
    // reminders
    const s = R.settings();
    const perm = notificationStatus();
    const permBtn = h('button', {
      type: 'button', class: 'btn glass wide', disabled: perm !== 'default',
      onclick: async () => { await Notification.requestPermission(); render(); },
    }, perm === 'granted' ? 'Notifications on ✓' : perm === 'denied' ? 'Notifications blocked in browser settings' : perm === 'unsupported' ? 'Notifications not supported here' : 'Allow notifications');
    return h('div', { class: 'stack' },
      h('h1', { tabindex: -1 }, 'Nudges to move'),
      h('p', { class: 'muted' }, 'If you haven’t moved for a while during the day, you’ll get a gentle nudge. Moving resets the timer.'),
      h('section', { class: 'card glass stack' },
        h('h2', {}, 'Nudge after sitting still for'),
        segmented([[30, '30 min'], [45, '45 min'], [60, '60 min']], s.reminder.intervalMin,
          v => { R.setSettings({ reminder: { ...R.settings().reminder, intervalMin: v } }); }, 'Nudge interval'),
        h('p', { class: 'hint' }, 'Only between 8am and 10pm. Change hours in Settings.')),
      h('section', { class: 'card glass stack' },
        h('h2', {}, 'Evening check-in at'),
        h('input', { type: 'time', class: 'glass-input', value: s.checkinTime, 'aria-label': 'Check-in reminder time', onchange: e => R.setSettings({ checkinTime: e.target.value }) })),
      permBtn,
      h('p', { class: 'hint' }, 'In this web prototype, reminders appear while the page is open in a tab.'));
  }

  render();
  return root;
}
