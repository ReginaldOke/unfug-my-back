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
      h('p', { class: 'muted' }, 'See a doctor or call emergency services straight away.')),
    h('section', { class: 'card glass' },
      h('h2', {}, 'What this app does'),
      h('p', { class: 'muted' }, 'It shows how what you do lines up with how your back feels. It isn’t a diagnosis or a treatment.')),
    h('section', { class: 'card glass' },
      h('h2', {}, 'Movement is safe'),
      h('p', { class: 'muted' }, 'A stressor is something worth keeping an eye on, not something to avoid. Backs get stronger with gradual use, like anything else you train.')),
    h('section', { class: 'card glass' },
      h('h2', {}, 'Your data'),
      h('p', { class: 'muted' }, 'Your diary stays on this device. It only leaves when you share or export it. You can delete it in Settings.')));
}
