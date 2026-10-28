// Help and safety notice (SPEC.md › Privacy, App Store and regulation › Safety notice).
import { h, iconButton } from '../lib/ui.js';

export const SafetyList = () => h('ul', { class: 'safety' },
  h('li', {}, 'New numbness in the groin or saddle area'),
  h('li', {}, 'Changes in bladder or bowel control'),
  h('li', {}, 'Leg weakness that is getting worse'),
  h('li', {}, 'Symptoms spreading to both legs'));

export function HelpView() {
  return h('div', { class: 'view' },
    h('header', { class: 'top-bar' }, iconButton('‹', 'Back', () => history.back()), h('h1', {}, 'Help & safety'), h('span')),
    h('section', { class: 'card glass warn' },
      h('h2', {}, 'Get medical help promptly if you notice'), SafetyList(),
      h('p', { class: 'muted' }, 'Contact a doctor or emergency service straight away. Don’t wait for your next check-in.')),
    h('section', { class: 'card glass' },
      h('h2', {}, 'What this app does'),
      h('p', { class: 'muted' }, 'It helps you notice patterns between what you do and how your back feels. It doesn’t diagnose, treat or fix pain, and its findings are associations, not causes.')),
    h('section', { class: 'card glass' },
      h('h2', {}, 'Movement is safe'),
      h('p', { class: 'muted' }, 'A “stressor” here means worth watching, not dangerous. The goal is to build tolerance gradually, the same way you’d train for anything else.')),
    h('section', { class: 'card glass' },
      h('h2', {}, 'Your data'),
      h('p', { class: 'muted' }, 'Everything stays in this browser on this device. Claude only sees your diary when you tap Analyse. You can export or delete everything in Settings.')));
}
