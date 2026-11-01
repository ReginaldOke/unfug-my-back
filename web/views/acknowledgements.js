// Open-source software in the app, with the notices their licences ask for.
import { h, iconButton } from '../lib/ui.js';

const MIT = `Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`;

const ITEMS = [
  ['three.js', 'Copyright © 2010-2026 three.js authors', 'MIT License', 'https://github.com/mrdoob/three.js'],
  ['Capacitor and its Filesystem, Haptics, Local Notifications, Share and Status Bar plugins', 'Copyright (c) 2017-present Drifty Co.', 'MIT License', 'https://github.com/ionic-team/capacitor'],
  ['Capacitor Health', 'Cap-go. Used unmodified.', 'Mozilla Public License 2.0, with source code available at the link below', 'https://github.com/Cap-go/capacitor-health'],
  ['Outfit font', 'Copyright 2021 The Outfit Project Authors', 'SIL Open Font License 1.1', 'https://github.com/Outfitio/Outfit-Fonts'],
];

export function AcknowledgementsView() {
  return h('div', { class: 'view' },
    h('header', { class: 'top-bar' }, iconButton('‹', 'Back', () => history.back()), h('h1', {}, 'Acknowledgements'), h('span')),
    h('p', { class: 'muted' }, 'Back Story is built with this open-source software. Thank you to the people who make it.'),
    ITEMS.map(([name, who, licence, url]) => h('section', { class: 'card glass stack tight' },
      h('h2', {}, name), h('p', { class: 'hint' }, who), h('p', { class: 'hint' }, licence),
      h('a', { class: 'hint ack-link', href: url, target: '_blank', rel: 'noopener' }, url.replace('https://', '')))),
    h('section', { class: 'card glass stack tight' }, h('h2', {}, 'MIT License'), h('p', { class: 'hint ack-text' }, MIT)));
}
