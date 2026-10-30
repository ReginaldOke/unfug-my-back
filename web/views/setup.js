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
      const shown = new Set(R.factors.all().filter(f => roles.includes(f.role) && !f.routineId).map(f => f.id));
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
        onEditChange: on => { done.hidden = !on; if (!on) list.querySelector('.rename-input')?.blur(); },
        onReorder: ids => R.factors.reorder(ids),
        onTap: (item, e) => renameInline(item, R.factors.get(item.dataset.id), e.target.closest('.well') ? 'icon' : 'name'),
      });
      fill();
      return h('div', { class: 'stack' },
        h('div', { class: 'row between' }, h('h1', { tabindex: -1 }, id === 'stressors' ? 'What tends to set it off?' : 'What tends to help?'), done),
        h('p', { class: 'muted' }, id === 'stressors'
          ? 'Pick the ones you want to track. Hold a card to move, rename or delete it.'
          : 'Pick the ones you do. Hold a card to move, rename or delete it.'),
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

// Just the last character typed (an emoji can be several code points), so a new one replaces the old
const lastGlyph = text => {
  const parts = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text.trim())];
  return parts.at(-1)?.segment ?? '';
};

/**
 * While editing the list, a card's emoji and name are fields: type over either, and it saves as you
 * leave them. The card (a button) is swapped for a plain look-alike while typing, as fields can't sit in a button.
 */
function renameInline(item, f, focus) {
  const open = item.querySelector('.rename-card');
  if (!f || open) { open?.querySelector(focus === 'icon' ? '.icon-input' : '.name-input')?.focus(); return; }
  const btn = item.querySelector('.select-card');
  const icon = h('input', { class: 'rename-input icon-input', value: f.icon || '', 'aria-label': `Emoji for ${f.name}`, autocomplete: 'off' });
  const name = h('input', { class: 'rename-input name-input', value: f.name, maxlength: 40, enterkeyhint: 'done', 'aria-label': 'Name', autocomplete: 'off' });
  const card = h('div', { class: 'select-card rename-card', 'aria-pressed': btn.getAttribute('aria-pressed') },
    h('span', { class: 'card-top' }, icon, h('span', { class: 'tick', 'aria-hidden': 'true' }, '✓')),
    h('span', { class: 'card-text' }, name, btn.querySelector('.card-detail')?.cloneNode(true)));
  item.classList.add('renaming');
  icon.addEventListener('input', () => { icon.value = lastGlyph(icon.value); if (icon.value) name.focus(); });
  const save = () => {
    // Wait a moment: focus may just be moving between the two fields
    setTimeout(() => {
      if (card.contains(document.activeElement) || !card.isConnected) return;
      const patch = { name: name.value.replace(/\s+/g, ' ').trim() || f.name, icon: icon.value || f.icon };
      if (patch.name !== f.name || patch.icon !== f.icon) R.factors.save(f.id, patch);
      Object.assign(f, patch);
      btn.querySelector('.well').textContent = patch.icon;
      btn.querySelector('.card-title').textContent = patch.name;
      card.replaceWith(btn);
      item.classList.remove('renaming');
    }, 0);
  };
  for (const el of [icon, name]) {
    el.addEventListener('blur', save);
    el.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } });
  }
  btn.replaceWith(card);
  const first = focus === 'icon' ? icon : name;
  first.focus();
  first.select();
}
