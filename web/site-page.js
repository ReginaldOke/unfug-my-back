// The marketing page's motion: the phone that drops in and moves beside each section as the page scrolls, text
// that arrives as it comes into view, and an example diary drawn as a big chart told in four chapters.
(() => {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const theme = () => document.documentElement.dataset.theme
    || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = t => t * t * (3 - 2 * t);
  const lerp = (a, b, t) => a + (b - a) * t;
  const onTheme = fn => {
    new MutationObserver(fn).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    matchMedia('(prefers-color-scheme: light)').addEventListener('change', fn);
  };

  // ---- Text arrives as it scrolls in
  const seen = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); seen.unobserve(e.target); } }), { rootMargin: '0px 0px -12% 0px' });
  document.querySelectorAll('.reveal').forEach(el => seen.observe(el));

  // ---- The phone
  const phone = document.querySelector('.phone3d');
  const stage = document.querySelector('.stage');
  if (phone) {
    // The edge: thin slabs stacked behind the front, then the back, turned to face the other way
    const back = phone.querySelector('.back'), face = phone.querySelector('.face');
    face.style.backfaceVisibility = back.style.backfaceVisibility = 'hidden';
    const slabs = Array.from({ length: 12 }, () => { const s = document.createElement('div'); s.className = 'slab'; phone.insertBefore(s, back); return s; });
    const layEdge = () => {
      const d = Math.round(phone.offsetWidth * 0.055);
      slabs.forEach((s, i) => { s.style.transform = `translateZ(${-((i + 1) / (slabs.length + 1)) * d}px)`; });
      back.style.transform = `translateZ(${-d}px) rotateY(180deg)`;
    };
    layEdge();
    addEventListener('resize', layEdge);

    // Each clip in the look the page is in, loaded only when it's showing or next
    const videos = [...phone.querySelectorAll('video')];
    const byClip = new Map(videos.map(v => [v.dataset.clip, v]));
    let showing = null;
    const srcFor = v => `assets/site/${v.dataset.clip}-${theme()}.mp4`;
    const load = v => { if (v && v.dataset.loaded !== srcFor(v)) { v.poster = srcFor(v).replace('.mp4', '.jpg'); v.src = srcFor(v); v.dataset.loaded = srcFor(v); } };
    const show = (clip, next) => {
      load(byClip.get(next));
      if (clip === showing) return;
      showing = clip;
      videos.forEach(v => {
        const on = v.dataset.clip === clip;
        v.classList.toggle('on', on);
        if (on) { load(v); v.currentTime = 0; if (!still) v.play().catch(() => {}); } else v.pause();
      });
    };
    onTheme(() => { const c = showing; showing = null; videos.forEach(v => { v.dataset.loaded = ''; }); show(c); });

    // Where the phone sits beside each section. On a phone screen it stays central, above the words.
    // veil: how much the screen is softened, so the big name in front of it reads first.
    const narrow = () => innerWidth <= 820;
    const POSES = {
      hero: () => ({ x: 0, y: narrow() ? 0.02 : 0.05, s: narrow() ? 0.9 : 0.86, rx: 14, ry: -26, rz: 8, veil: 0.5, fade: 0 }),
      right: () => (narrow() ? { x: 0, y: -0.2, s: 0.84, rx: 4, ry: -12, rz: 0, veil: 0, fade: 0 } : { x: 0.24, y: 0, s: 1.02, rx: 2, ry: -16, rz: 1.5, veil: 0, fade: 0 }),
      left: () => (narrow() ? { x: 0, y: -0.2, s: 0.84, rx: 4, ry: 12, rz: 0, veil: 0, fade: 0 } : { x: -0.24, y: 0, s: 1.02, rx: 2, ry: 16, rz: -1.5, veil: 0, fade: 0 }),
    };
    // Leaving: it tips back, sinks away and fades, rather than being cut off by the next section
    POSES.exit = () => ({ ...POSES[sections.at(-2).dataset.pose](), y: narrow() ? -0.34 : -0.16, s: 0.72, rx: 26, fade: 1 });
    const sections = [...document.querySelectorAll('[data-pose]')];
    let anchors = [];
    const measure = () => {
      let turns = 0;
      anchors = sections.map((el, i) => {
        // A section can ask for a slide instead of a turn: the phone glides across and the screen fades over
        const turn = i > 0 && el.dataset.clip && el.dataset.clip !== sections[i - 1].dataset.clip && el.dataset.move !== 'slide';
        if (turn) turns++;
        const at = el.offsetTop + el.offsetHeight / 2 - innerHeight / 2;
        return { at: i ? at : 0, clip: el.dataset.clip || sections[i - 1].dataset.clip, pose: POSES[el.dataset.pose](), spin: turns * 360, slide: el.dataset.move === 'slide' };
      });
    };
    measure();
    addEventListener('resize', measure);
    addEventListener('load', measure);

    let lastY = -1;
    const frame = now => {
      requestAnimationFrame(frame);
      const y = scrollY;
      const journey = stage.parentElement;
      if (y > journey.offsetTop + journey.offsetHeight || (still && y === lastY)) return;
      lastY = y;
      let i = 0;
      while (i < anchors.length - 1 && y >= anchors[i + 1].at) i++;
      const a = anchors[i], b = anchors[Math.min(i + 1, anchors.length - 1)];
      // Rest at each section for a moment, then move on to the next
      const raw = b === a ? 0 : clamp((y - a.at) / (b.at - a.at));
      const t = ease(clamp((raw - 0.18) / 0.64));
      const mix = k => lerp(a.pose[k], b.pose[k], t);
      const spin = still ? 0 : lerp(a.spin, b.spin, t);
      // On a slide it leans into the way it's going, and straightens as it arrives
      const lean = b.slide && !still ? Math.sin(Math.PI * t) * Math.sign(b.pose.x - a.pose.x) : 0;
      // The screen changes halfway: on a turn that's when the back is showing, on a slide it fades across
      const clip = t < 0.5 ? a.clip : b.clip;
      show(clip, t < 0.5 ? b.clip : (anchors[i + 2] ?? b).clip);
      const sway = still ? 0 : Math.sin(now / 1400) * 1.6;
      phone.style.setProperty('--veil', mix('veil').toFixed(3));
      stage.style.opacity = (1 - mix('fade')).toFixed(3);
      phone.style.transform = `translate3d(${mix('x') * innerWidth}px, ${mix('y') * innerHeight}px, 0) scale(${mix('s')})
        rotateX(${mix('rx') + sway * 0.6}deg) rotateY(${mix('ry') + spin + sway + lean * 22}deg) rotateZ(${mix('rz') - lean * 4}deg)`;
    };
    show('patterns', 'track');
    requestAnimationFrame(frame);
  }

  // ---- The example diary, in four chapters
  const vis = document.querySelector('.vis');
  if (!vis) return;
  const track = vis.parentElement;
  const plot = vis.querySelector('.plot'), legend = vis.querySelector('.legend'), pills = vis.querySelector('.chapters');
  const msg = { eyebrow: vis.querySelector('.msg-eyebrow'), text: vis.querySelector('.msg'), day: vis.querySelector('.day') };

  // Eight weeks, made up but built the way diaries behave: more pain on long sitting days, less on days with a
  // good walk, a sore day after each long drive, and pain easing overall as the deadlifts go up.
  const N = 56, START = new Date(2026, 8, 7); // a Monday
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const days = Array.from({ length: N }, (_, i) => {
    const date = new Date(START); date.setDate(date.getDate() + i);
    const wd = date.getDay(), work = wd >= 1 && wd <= 5;
    return {
      date, work,
      sitting: work ? 4 + rnd() * 3 : 1 + rnd() * 1.5,
      walking: 20 + rnd() * 20 + (work ? 0 : 30),
      driving: 10 + rnd() * 25,
    };
  });
  [[3, 8.6], [8, 9.4], [11, 8.8], [15, 9.0]].forEach(([i, h]) => { days[i].sitting = h; });
  [[19, 92], [22, 18], [26, 105], [29, 15], [33, 88]].forEach(([i, m]) => { days[i].walking = m; });
  [[39, 165], [44, 150], [50, 175]].forEach(([i, m]) => { days[i].driving = m; });
  days.forEach((d, i) => {
    const drove = days[i - 1]?.driving ?? 20;
    const pain = 3.4 + 0.55 * (d.sitting - 4) - 0.035 * (d.walking - 35) + (drove > 120 ? 2.6 : 0) + 1.2 - 2.2 * (i / (N - 1)) + (rnd() - 0.5) * 0.6;
    d.pain = Math.round(clamp(pain, 1, 9));
  });
  // The routine, week by week, for the last chapter: deadlifts going up while weekly pain comes down
  const week = i => Math.min(7, Math.floor(i / 7));
  const weekPain = Array.from({ length: 8 }, (_, w) => days.slice(w * 7, w * 7 + 7).reduce((s, d) => s + d.pain, 0) / 7);
  const smoothWeeks = (vals, i) => { const f = i / 7 - 0.5, a = clamp(Math.floor(f), 0, 7), b = clamp(a + 1, 0, 7), u = clamp(f - a); return lerp(vals[a], vals[b], ease(u)); };
  const deadlift = [60, 65, 70, 70, 77.5, 82.5, 90, 95], birdDog = [6, 6, 8, 8, 10, 10, 12, 12], plank = [30, 35, 40, 45, 50, 60, 65, 75];

  const SERIES = [
    { key: 'pain', label: 'Pain', c: '#f4908a', min: 0, max: 10, fmt: v => `${v}/10`, front: true,
      row: { name: 'Pain, weekly average', vals: weekPain, min: 1, max: 7, end: v => `${v.toFixed(1)}/10`, c: '#f4908a' } },
    { key: 'sitting', label: 'Long sitting', c: '#f3b46e', min: 0, max: 11, fmt: v => `${v.toFixed(1)} h`,
      row: { name: 'Deadlift', vals: deadlift, min: 50, max: 100, end: v => `3 × 5 · ${v} kg`, c: '#74d4c0' } },
    { key: 'walking', label: 'Walking', c: '#74d4c0', min: 0, max: 120, fmt: v => `${Math.round(v)} min`,
      row: { name: 'Bird dog', vals: birdDog, min: 4, max: 13, end: v => `× ${v} each side`, c: '#74d4c0' } },
    { key: 'driving', label: 'Driving', c: '#e3a6f5', min: 0, max: 200, fmt: v => `${Math.round(v)} min`,
      row: { name: 'Plank', vals: plank, min: 20, max: 80, end: v => (v >= 60 ? `1:${String(v - 60).padStart(2, '0')}` : `0:${v}`), c: '#74d4c0' } },
  ];
  const CHAPTERS = [
    { from: 0, to: 18, key: 'sitting', pill: 'What goes with pain', eyebrow: 'What goes with pain', text: 'Pain is worse on days you sit for long' },
    { from: 18, to: 37, key: 'walking', pill: 'What eases it', eyebrow: 'What eases it', text: 'You have less pain on days you walk more' },
    { from: 37, to: N, key: 'driving', pill: 'What hurts later', eyebrow: 'What hurts later', text: 'Pain gets worse the day after a long drive' },
    { key: 'routine', pill: 'Your progress', eyebrow: 'Your progress', text: 'Your pain has eased since you started deadlifts' },
  ];
  const CALLOUTS = [
    { ch: 0, a: ['sitting', 8], b: ['pain', 8], text: 'A long day at the desk, and a sore back' },
    { ch: 1, a: ['walking', 26], b: ['pain', 26], text: 'A long walk, and an easier day' },
    { ch: 2, a: ['driving', 44], b: ['pain', 45], text: 'Two and a half hours driving, sore the next day' },
  ];

  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent?.append(e); return e; };
  const svg = el('svg', { 'aria-hidden': 'true' }); plot.prepend(svg);
  const notes = document.createElement('div'); notes.className = 'notes'; plot.append(notes);
  const rowsEl = document.createElement('div'); rowsEl.className = 'rows'; plot.append(rowsEl);

  // Legend: hover to bring a line forward, tap to hide it
  const hidden = new Set();
  let hoverSeries = null, hoverDay = null, hoverChapter = null;
  SERIES.forEach(s => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = s.label; b.style.setProperty('--c', s.c); b.setAttribute('aria-pressed', 'true');
    b.onclick = () => { hidden.has(s.key) ? hidden.delete(s.key) : hidden.add(s.key); b.setAttribute('aria-pressed', String(!hidden.has(s.key))); paint(); };
    b.onpointerenter = () => { hoverSeries = s.key; paint(); };
    b.onpointerleave = () => { hoverSeries = null; paint(); };
    legend.append(b);
  });
  // Chapter pills: hover to preview a chapter, tap to scroll to it
  const pillEls = CHAPTERS.map((c, k) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chapter'; b.innerHTML = '<span></span>'; b.firstChild.textContent = c.pill;
    b.onclick = () => scrollTo({ top: track.offsetTop + chapterStart(k) * (track.offsetHeight - innerHeight) + 2, behavior: still ? 'auto' : 'smooth' });
    b.onpointerenter = () => { hoverChapter = k; paint(); };
    b.onpointerleave = () => { hoverChapter = null; paint(); };
    pills.append(b);
    return b;
  });
  // The scroll is shared out: three chapters of days moving past, then the change to the routine view
  const SPLIT = 0.72;
  const chapterStart = k => (k < 3 ? (CHAPTERS[k].from / (N - 1)) * SPLIT : SPLIT + 0.02);

  // Hovering the chart picks the day under the pointer (mouse only: on a touch screen the scroll does it)
  plot.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || morphT > 0.3) return;
    const r = plot.getBoundingClientRect();
    hoverDay = clamp(Math.round((e.clientX - r.left - offset) / dayW - 0.5), 0, N - 1);
    paint();
  });
  plot.addEventListener('pointerleave', () => { hoverDay = null; paint(); });

  const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  const mixColour = (a, b, t) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], t))).join(',')})`; };
  const smooth = pts => {
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      d += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)},${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)},${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d;
  };
  const DAY = new Intl.DateTimeFormat('en-GB', { weekday: 'short' }), DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' });

  let W = 0, H = 0, dayW = 0, offset = 0, pos = 0, morphT = 0, chapter = 0, built = false;
  const parts = {};

  /** Builds the chart's pieces once per size or look; paint() moves them. */
  function build() {
    W = plot.clientWidth; H = plot.clientHeight;
    dayW = W / (W > 900 ? 21 : W > 560 ? 13 : 8);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.replaceChildren();
    const defs = el('defs', {}, svg);
    el('feGaussianBlur', { stdDeviation: 7 }, el('filter', { id: 'glow', x: '-10%', y: '-40%', width: '120%', height: '180%' }, defs));
    parts.band = el('rect', { y: 40, height: H - 40, rx: 18, fill: 'currentColor', opacity: 0 }, svg);
    parts.grid = el('g', {}, svg);
    parts.days = days.map((d, i) => {
      const g = el('g', {}, parts.grid);
      el('line', { x1: 0, x2: 0, y1: 44, y2: H - 4, stroke: 'currentColor', 'stroke-opacity': 0.07 }, g);
      const a = el('text', { y: 14, 'text-anchor': 'middle', 'font-size': 11, 'letter-spacing': '0.14em', fill: 'currentColor' }, g); a.textContent = DAY.format(d.date).toUpperCase();
      const b = el('text', { y: 32, 'text-anchor': 'middle', 'font-size': 12, fill: 'currentColor' }, g); b.textContent = d.date.getDate();
      return { g, a, b };
    });
    parts.series = SERIES.map(s => {
      const grad = el('linearGradient', { id: `f-${s.key}`, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
      const s0 = el('stop', { offset: 0, 'stop-color': s.c, 'stop-opacity': 0.5 }, grad);
      const s1 = el('stop', { offset: 1, 'stop-color': s.c, 'stop-opacity': 0 }, grad);
      const g = el('g', {}, svg);
      return { s, s0, s1, g, area: el('path', { fill: `url(#f-${s.key})` }, g), glow: el('path', { fill: 'none', 'stroke-width': 8, filter: 'url(#glow)', 'stroke-opacity': 0.5 }, g), line: el('path', { fill: 'none', 'stroke-linecap': 'round' }, g) };
    });
    // Pain on top
    svg.append(parts.series[0].g);
    parts.links = el('g', {}, svg);
    parts.cursor = el('line', { y1: 44, y2: H - 4, stroke: 'currentColor', 'stroke-width': 1.5 }, svg);
    // The routine view's rows: a name on the left, the trend in the middle, the latest on the right
    rowsEl.replaceChildren(...SERIES.map(s => {
      const r = document.createElement('div'); r.className = 'row';
      r.innerHTML = '<span class="name"></span><span class="end"></span>';
      r.firstChild.textContent = s.row.name;
      return r;
    }));
    notes.replaceChildren(...CALLOUTS.map(c => {
      const n = document.createElement('div'); n.className = 'callout';
      n.innerHTML = '<span class="tag"></span>'; n.firstChild.textContent = c.text;
      return n;
    }));
    built = true;
    paint();
  }

  function read() {
    const r = track.getBoundingClientRect();
    const p = clamp(-r.top / (r.height - innerHeight));
    pos = clamp(p / SPLIT) * (N - 1);
    morphT = ease(clamp((p - SPLIT - 0.03) / 0.2));
    chapter = p >= SPLIT ? 3 : CHAPTERS.findIndex(c => c.to > Math.round(pos));
  }

  function paint() {
    if (!built) return;
    const light = theme() === 'light';
    const t = still ? (morphT > 0.5 ? 1 : 0) : morphT;
    const day = hoverDay ?? Math.round(pos);
    const showCh = hoverChapter ?? chapter;
    offset = clamp(W / 2 - (pos + 0.5) * dayW, W - N * dayW, 0);
    const xh = i => offset + (i + 0.5) * dayW;
    const top = 58, bottom = H - 8;
    // Routine layout: a header, then a row per line
    const rowTop = 44, rowH = (H - rowTop) / SERIES.length;
    const sx0 = W * (W > 700 ? 0.3 : 0.45), sx1 = W * (W > 700 ? 0.74 : 0.69);
    const focus = CHAPTERS[showCh].key;

    // Days, grid and cursor fade out as the routine view comes in
    parts.grid.setAttribute('opacity', (1 - t).toFixed(3));
    parts.days.forEach(({ g, a, b }, i) => {
      g.setAttribute('transform', `translate(${xh(i).toFixed(1)},0)`);
      const on = i === day;
      a.setAttribute('fill-opacity', on ? 1 : 0.45); b.setAttribute('fill-opacity', on ? 1 : 0.45);
      a.setAttribute('font-weight', on ? 600 : 400); b.setAttribute('font-weight', on ? 600 : 400);
    });
    parts.cursor.setAttribute('x1', xh(day)); parts.cursor.setAttribute('x2', xh(day));
    parts.cursor.setAttribute('stroke-opacity', ((1 - t) * 0.85).toFixed(3));
    // The chapter's stretch of days, lit softly; brighter while a pill is hovered
    const ch = CHAPTERS[showCh];
    if (ch.from != null && t < 1) {
      parts.band.setAttribute('x', xh(ch.from) - dayW / 2 + 2); parts.band.setAttribute('width', (ch.to - ch.from) * dayW - 4);
      parts.band.setAttribute('opacity', ((hoverChapter != null ? 0.07 : 0.035) * (1 - t)).toFixed(3));
    } else parts.band.setAttribute('opacity', 0);

    parts.series.forEach(({ s, s0, s1, area, glow, line, g }, k) => {
      if (hidden.has(s.key)) { g.setAttribute('opacity', 0); return; }
      // Each line leaves for its row a moment after the one above, so the change reads as a cascade
      const tk = ease(clamp(t * 1.4 - k * 0.12));
      const lo = rowTop + rowH * k + 8, hi = rowTop + rowH * (k + 1) - 8;
      const pts = days.map((d, i) => {
        const yh = bottom - ((d[s.key] - s.min) / (s.max - s.min)) * (bottom - top);
        const rv = smoothWeeks(s.row.vals, i);
        const yr = hi - ((rv - s.row.min) / (s.row.max - s.row.min)) * (hi - lo);
        const xr = sx0 + (i / (N - 1)) * (sx1 - sx0);
        return [lerp(xh(i), xr, tk), lerp(yh, yr, tk)];
      });
      const base = lerp(bottom, hi, tk);
      const d = smooth(pts);
      line.setAttribute('d', d); glow.setAttribute('d', d);
      area.setAttribute('d', `${d} L${pts[N - 1][0].toFixed(1)},${base.toFixed(1)} L${pts[0][0].toFixed(1)},${base.toFixed(1)} Z`);
      const colour = mixColour(s.c, s.row.c, tk);
      line.setAttribute('stroke', colour); glow.setAttribute('stroke', colour);
      s0.setAttribute('stop-color', colour); s1.setAttribute('stop-color', colour);
      // The chapter's own line (and pain) stand out; the rest step back
      const lead = hoverSeries ? s.key === hoverSeries || s.front : s.front || s.key === focus || t > 0.5;
      g.setAttribute('opacity', lead ? 1 : 0.28);
      line.setAttribute('stroke-width', s.front || s.key === (hoverSeries ?? focus) ? 3 : 2);
      s0.setAttribute('stop-opacity', s.front ? 0.5 : lead ? (light ? 0.32 : 0.24) : 0.1);
      glow.setAttribute('opacity', s.front || s.key === (hoverSeries ?? focus) ? 1 : 0);
    });

    // Callouts for the chapter on show: a dashed link between the two points, and a note above
    parts.links.replaceChildren();
    [...notes.children].forEach((n, k) => {
      const c = CALLOUTS[k];
      const on = c.ch === showCh && t < 0.05 && !hidden.has(c.a[0]) && !hidden.has(c.b[0]);
      n.style.opacity = on ? 1 : 0;
      if (!on) return;
      const sa = SERIES.find(s => s.key === c.a[0]), sb = SERIES.find(s => s.key === c.b[0]);
      const p1 = [xh(c.a[1]), bottom - ((days[c.a[1]][c.a[0]] - sa.min) / (sa.max - sa.min)) * (bottom - top)];
      const p2 = [xh(c.b[1]), bottom - ((days[c.b[1]][c.b[0]] - sb.min) / (sb.max - sb.min)) * (bottom - top)];
      const lift = Math.min(p1[1], p2[1]) - 34;
      el('path', { d: p1[0] === p2[0] ? `M${p1[0]},${p1[1]} L${p2[0]},${p2[1]}` : `M${p1[0]},${p1[1]} C${p1[0]},${lift} ${p2[0]},${lift} ${p2[0]},${p2[1]}`, fill: 'none', stroke: sa.c, 'stroke-width': 1.5, 'stroke-dasharray': '4 4' }, parts.links);
      [[p1, sa.c], [p2, sb.c]].forEach(([[cx, cy], col]) => el('circle', { cx, cy, r: 5, fill: col, stroke: light ? '#fff' : '#0d0d0f', 'stroke-width': 2 }, parts.links));
      n.style.left = `${clamp((p1[0] + p2[0]) / 2, 120, W - 120)}px`;
      n.style.top = `${Math.max(40, Math.min(p1[1], p2[1]) - 92)}px`;
    });

    // Row labels for the routine view
    [...rowsEl.children].forEach((r, k) => {
      const s = SERIES[k], tk = ease(clamp(t * 1.4 - k * 0.12));
      r.style.top = `${rowTop + rowH * k}px`; r.style.height = `${rowH}px`;
      r.style.opacity = hidden.has(s.key) ? 0 : tk;
      r.lastChild.textContent = s.row.end(s.row.vals[7]);
    });
    rowsEl.style.setProperty('--hairline', t);

    // The message for the chapter, and the day under the line
    const c = CHAPTERS[showCh];
    if (msg.text.dataset.k !== String(showCh)) {
      msg.text.dataset.k = showCh;
      msg.text.animate?.([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: still ? 0 : 450, easing: 'ease-out' });
      msg.eyebrow.textContent = c.eyebrow; msg.text.textContent = c.text;
    }
    if (showCh === 3) msg.day.textContent = `Week 1 to week 8 · deadlift ${deadlift[0]} kg to ${deadlift[7]} kg · pain ${weekPain[0].toFixed(1)} to ${weekPain[7].toFixed(1)}`;
    else {
      const d = days[day];
      msg.day.textContent = `${DAY.format(d.date)} ${DATE.format(d.date)} · Pain ${d.pain}/10 · ${SERIES.slice(1).map(s => `${s.label} ${s.fmt(d[s.key])}`).join(' · ')}`;
    }
    pillEls.forEach((p, k) => { p.classList.toggle('on', k === chapter); p.classList.toggle('peek', k === hoverChapter && k !== chapter); });
    legend.style.opacity = (1 - clamp(t * 3)).toFixed(3);
    legend.style.pointerEvents = t > 0.2 ? 'none' : '';
  }

  read();
  build();
  addEventListener('resize', build);
  addEventListener('scroll', () => requestAnimationFrame(() => { read(); paint(); }), { passive: true });
  onTheme(build);
  document.fonts?.ready.then(build);
})();
