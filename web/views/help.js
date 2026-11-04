// Help, safety and the legal small print, as plain text: a heading, then what it says.
import { h, iconButton } from '../lib/ui.js';

// Open-source software in the app, with the notices their licences ask for
const MIT = `Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`;

const ITEMS = [
  ['three.js', 'Copyright © 2010-2026 three.js authors', 'MIT License', 'https://github.com/mrdoob/three.js'],
  ['Capacitor and its Filesystem, Haptics, Local Notifications, Share and Status Bar plugins', 'Copyright (c) 2017-present Drifty Co.', 'MIT License', 'https://github.com/ionic-team/capacitor'],
  ['Capacitor Health', 'Cap-go. Used unmodified.', 'Mozilla Public License 2.0, with source code available at the link below', 'https://github.com/Cap-go/capacitor-health'],
  ['Outfit font', 'Copyright 2021 The Outfit Project Authors', 'SIL Open Font License 1.1', 'https://github.com/Outfitio/Outfit-Fonts'],
  ['Italiana font', 'Copyright (c) 2011, Santiago Orozco, with Reserved Font Name "Italiana"', 'SIL Open Font License 1.1', 'https://github.com/google/fonts/tree/main/ofl/italiana'],
];

export const SafetyList = () => h('ul', { class: 'safety' },
  h('li', {}, 'New numbness in the groin or saddle area'),
  h('li', {}, 'Changes in bladder or bowel control'),
  h('li', {}, 'Leg weakness that is getting worse'),
  h('li', {}, 'Symptoms spreading to both legs'));

const part = (title, ...body) => h('section', { class: 'doc-part' }, h('h2', {}, title), ...body);

export function HelpView() {
  return h('div', { class: 'view' },
    h('header', { class: 'top-bar' }, iconButton('‹', 'Back', () => history.back()), h('h1', {}, 'Help & safety'), h('span')),
    h('article', { class: 'doc' },
      part('Get medical help promptly if you notice', SafetyList(),
        h('p', {}, 'See a doctor or call emergency services straight away.')),
      part('What this app does',
        h('p', {}, 'It shows how what you do lines up with how your back feels. It isn’t a medical device, a diagnosis or a treatment, and it doesn’t replace a doctor.')),
      part('Patterns aren’t causes',
        h('p', {}, 'The app shows what tends to go with more or less pain in your own diary, often from only a few days. Two things going together doesn’t mean one causes the other. Check with a doctor before making medical decisions.')),
      part('Exercise and your back',
        h('p', {}, 'The routines and exercises here, including lifts like deadlifts and squats, are general examples. They aren’t medical advice or tailored to you, and they may not suit your back or your health.'),
        h('p', {}, 'Check with a doctor or physio before starting or changing exercise, especially if you have pain, an injury or a health condition. Stop if pain gets worse.'),
        h('p', { class: 'fine' }, 'You use the app and do any exercise at your own risk. To the extent the law allows, the app is provided as is, without warranties, and its maker isn’t liable for injury or loss from using it. Nothing here limits rights you have by law.')),
      part('Your data',
        h('p', {}, 'Your diary stays on this device. It only leaves when you share or export it. You can delete it in Settings.'),
        h('a', { class: 'help-link', href: 'https://reginaldoke.github.io/unfug-my-back/privacy.html', target: '_blank', rel: 'noopener' }, 'Privacy policy ›')),
      part('Open-source software',
        h('p', { class: 'fine' }, 'Back Story is built with this software. Thank you to the people who make it.'),
        ITEMS.map(([name, who, licence, url]) => h('p', { class: 'fine' },
          h('strong', {}, name), h('br'), who, h('br'), licence, h('br'),
          h('a', { class: 'ack-link', href: url, target: '_blank', rel: 'noopener' }, url.replace('https://', '')))),
        h('p', { class: 'fine ack-text' }, h('strong', {}, 'MIT License'), h('br'), MIT))));
}
