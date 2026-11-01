// Help, safety and the legal small print.
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
      h('p', { class: 'muted' }, 'It shows how what you do lines up with how your back feels. It isn’t a medical device, a diagnosis or a treatment, and it doesn’t replace a doctor.')),
    h('section', { class: 'card glass' },
      h('h2', {}, 'Patterns aren’t causes'),
      h('p', { class: 'muted' }, 'The app shows what tends to go with more or less pain in your own diary, often from only a few days. Two things going together doesn’t mean one causes the other. Check with a doctor before making medical decisions.')),
    h('section', { class: 'card glass' },
      h('h2', {}, 'Exercise and your back'),
      h('p', { class: 'muted' }, 'The routines and exercises here, including lifts like deadlifts and squats, are general examples. They aren’t medical advice or tailored to you, and they may not suit your back or your health.'),
      h('p', { class: 'muted' }, 'Check with a doctor or physio before starting or changing exercise, especially if you have pain, an injury or a health condition. Stop if pain gets worse.'),
      h('p', { class: 'hint' }, 'You use the app and do any exercise at your own risk. To the extent the law allows, the app is provided as is, without warranties, and its maker isn’t liable for injury or loss from using it. Nothing here limits rights you have by law.')),
    h('section', { class: 'card glass' },
      h('h2', {}, 'Your data'),
      h('p', { class: 'muted' }, 'Your diary stays on this device. It only leaves when you share or export it. You can delete it in Settings.'),
      h('a', { class: 'help-link', href: 'https://reginaldoke.github.io/unfug-my-back/privacy.html', target: '_blank', rel: 'noopener' }, 'Privacy policy ›')));
}
