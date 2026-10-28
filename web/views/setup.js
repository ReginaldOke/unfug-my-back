// Setup: pick stressors, pick helpers, reminders. Also reused from Settings to edit the lists.
import { h, segmented, toast, iconButton, confirmSheet } from '../lib/ui.js';
import * as R from '../lib/repos.js';
import * as reminders from '../lib/reminders.js';
import { notificationStatus } from '../lib/notify.js';
import { SelectCard } from './controls.js';
import { quickAddFactor } from './factor.js';
import { makeSortable } from './sortable.js';
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
      toast('Saved');
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
      const list = h('div', { class: 'card-grid sortable' });
      const done = h('button', { type: 'button', class: 'chip glass done-edit', hidden: true, onclick: () => sort.setEditing(false) }, 'Done');
      // Your list, in your order. Switched-off ones stay until you leave, then live in Add your own
      const shown = new Set(R.factors.all().filter(f => roles.includes(f.role)).map(f => f.id));
      const fill = () => list.replaceChildren(
        ...R.factors.all({ archived: true }).filter(f => shown.has(f.id)).sort((a, b) => a.sortWeight - b.sortWeight).map(f => h('div', { class: 'sortable-item', 'data-id': f.id },
          SelectCard({
            icon: f.icon || ROLE_ICON[f.role], title: f.name,
            detail: `${MEASURE_OPTIONS.find(([m]) => m === f.measureType)?.[1] ?? ''}${f.role === 'unsure' ? ' · not sure yet' : ''}`,
            on: !f.isArchived,
            onToggle: on => R.factors.setArchived(f.id, !on),
          }),
          h('button', {
            type: 'button', class: 'del', 'aria-label': `Delete ${f.name}`, onclick: async () => {
              const logged = R.factors.logs(f.id).length;
              const ok = await confirmSheet(`Delete ${f.name}?`, logged ? `This also deletes the ${logged} day${logged === 1 ? '' : 's'} you logged it.` : 'It comes off your check-in.', 'Delete', { danger: true });
              if (!ok) return;
              R.factors.remove(f.id);
              shown.delete(f.id);
              fill();
            },
          }, '✕'))),
        h('button', {
          type: 'button', class: 'select-card add', onclick: async () => {
            const added = await quickAddFactor({ role: id === 'stressors' ? 'trigger' : 'helper' });
            for (const f of added) shown.add(f.id);
            if (added.length) fill();
          },
        }, h('span', { class: 'well', 'aria-hidden': 'true' }, '+'), h('span', { class: 'card-title' }, 'Add your own')));
      const sort = makeSortable(list, {
        onEditChange: on => { done.hidden = !on; },
        onReorder: ids => R.factors.reorder(ids),
      });
      fill();
      return h('div', { class: 'stack' },
        h('div', { class: 'row between' }, h('h1', { tabindex: -1 }, id === 'stressors' ? 'What tends to set it off?' : 'What tends to help?'), done),
        h('p', { class: 'muted' }, id === 'stressors'
          ? 'Pick the ones you want to track. Hold a card to move or delete it.'
          : 'Pick the ones you do. Hold a card to move or delete it.'),
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
      h('p', { class: 'muted' }, 'If you sit still too long, you’ll get a reminder to move.'),
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
