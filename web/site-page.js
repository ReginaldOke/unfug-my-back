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
    const narrow = () => innerWidth <= 820;
    const POSES = {
      hero: () => ({ x: 0, y: 0, s: narrow() ? 0.84 : 0.8, rx: 14, ry: -26, rz: 8, fade: 0 }),
      right: () => (narrow() ? { x: 0, y: -0.2, s: 0.84, rx: 4, ry: -12, rz: 0, fade: 0 } : { x: 0.24, y: 0, s: 1.02, rx: 2, ry: -16, rz: 1.5, fade: 0 }),
      left: () => (narrow() ? { x: 0, y: -0.2, s: 0.84, rx: 4, ry: 12, rz: 0, fade: 0 } : { x: -0.24, y: 0, s: 1.02, rx: 2, ry: 16, rz: -1.5, fade: 0 }),
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
        // The exit finishes just as the phone's layer starts to scroll away, so it's gone before it could be cut off
        const at = el.dataset.pose === 'exit' ? el.offsetTop + el.offsetHeight - innerHeight : el.offsetTop + el.offsetHeight / 2 - innerHeight / 2;
        return { at: i ? at : 0, clip: el.dataset.clip || sections[i - 1].dataset.clip, pose: POSES[el.dataset.pose](), spin: turns * 360, slide: el.dataset.move === 'slide' };
      });
    };
    measure();
    addEventListener('resize', measure);
    addEventListener('load', measure);

    // The phone follows the scroll with a little give, so a wheel's steps turn into one smooth movement
    let follow = scrollY, lastNow = 0;
    const frame = now => {
      requestAnimationFrame(frame);
      const dt = Math.min(64, now - (lastNow || now)); lastNow = now;
      const target = scrollY;
      follow = still ? target : follow + (target - follow) * (1 - Math.exp(-dt / 110));
      if (Math.abs(target - follow) < 0.5) follow = target;
      const y = follow;
      const journey = stage.parentElement;
      if (y > journey.offsetTop + journey.offsetHeight) return;
      let i = 0;
      while (i < anchors.length - 1 && y >= anchors[i + 1].at) i++;
      const a = anchors[i], b = anchors[Math.min(i + 1, anchors.length - 1)];
      // Rest at each section for a moment, then move on to the next
      const raw = b === a ? 0 : clamp((y - a.at) / (b.at - a.at));
      const t = ease(clamp((raw - 0.18) / 0.64));
      const mix = k => lerp(a.pose[k], b.pose[k], t);
      const spin = still ? 0 : lerp(a.spin, b.spin, t);
      let x = mix('x') * innerWidth, yy = mix('y') * innerHeight, s = mix('s'), rx = mix('rx'), ry = mix('ry') + spin, rz = mix('rz');
      // A slide drifts like a car through a bend: an S-shaped path, the phone turning to follow it a beat late,
      // banking into the move, dipping slightly in size, then running a touch long and settling
      const dx = (b.pose.x - a.pose.x) * innerWidth;
      if (b.slide && dx && !still) {
        const dir = Math.sign(dx), amp = 0.03 * innerHeight;
        const back = u => { const c = 0.35; return 1 + (c + 1) * (u - 1) ** 3 + c * (u - 1) ** 2; };
        const u = clamp((raw - 0.15) / 0.7), e = ease(u);
        x = lerp(a.pose.x, b.pose.x, back(u)) * innerWidth;
        yy += amp * Math.sin(2 * Math.PI * e);
        const heading = k => Math.atan2(amp * 2 * Math.PI * Math.cos(2 * Math.PI * k), Math.abs(dx)) * 180 / Math.PI;
        const lag = clamp(e - 0.08);
        const bend = Math.sin(Math.PI * e);
        rz += dir * heading(lag) * 0.4 * bend ** 0.6;
        ry += dir * 10 * Math.sin(Math.PI * clamp(e - 0.04));
        rx += -heading(e) * 0.06;
        s *= 1 - 0.025 * bend;
      }
      // The screen changes halfway: on a turn that's when the back is showing, on a slide it fades across
      const clip = t < 0.5 ? a.clip : b.clip;
      show(clip, t < 0.5 ? b.clip : (anchors[i + 2] ?? b).clip);
      const sway = still ? 0 : Math.sin(now / 1400) * 1.6;
      stage.style.opacity = (1 - mix('fade')).toFixed(3);
      phone.style.transform = `translate3d(${x.toFixed(1)}px, ${yy.toFixed(1)}px, 0) scale(${s.toFixed(4)})
        rotateX(${(rx + sway * 0.6).toFixed(2)}deg) rotateY(${(ry + sway).toFixed(2)}deg) rotateZ(${rz.toFixed(2)}deg)`;
    };
    show('patterns', 'track');
    requestAnimationFrame(frame);
  }

  // ---- The example diary, in four chapters
  const vis = document.querySelector('.vis');
  if (!vis) return;
  const track = vis.parentElement;
  const plot = vis.querySelector('.plot'), legend = vis.querySelector('.legend'), pills = vis.querySelector('.chapters');
  const msg = { text: vis.querySelector('.msg'), day: vis.querySelector('.day') };

  // Eight weeks, made up but built the way diaries behave: more pain on long sitting days, less on days with a
  // good walk, a sore day after each long drive, and pain easing overall as the deadlifts go up.
  const N = 56, START = new Date(2026, 8, 7); // a Monday
  const LIFTS_FROM = 21; // deadlifts join the routine at the start of week 4
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
    const pain = 3.4 + 0.55 * (d.sitting - 4) - 0.035 * (d.walking - 35) + (drove > 120 ? 2.6 : 0) + 1.1 - (i < LIFTS_FROM ? 0 : 2.4 * clamp((i - LIFTS_FROM) / 21)) + (rnd() - 0.5) * 0.6;
    d.pain = Math.round(clamp(pain, 1, 9));
  });
  // The routine, week by week, for the last chapter: deadlifts going up while weekly pain comes down
  const week = i => Math.min(7, Math.floor(i / 7));
  const weekPain = Array.from({ length: 8 }, (_, w) => days.slice(w * 7, w * 7 + 7).reduce((s, d) => s + d.pain, 0) / 7);
  const smoothWeeks = (vals, i) => { const f = i / 7 - 0.5, a = clamp(Math.floor(f), 0, 7), b = clamp(a + 1, 0, 7), u = clamp(f - a); return lerp(vals[a], vals[b], ease(u)); };
  const deadlift = [60, 60, 60, 60, 70, 77.5, 87.5, 95], birdDog = [6, 6, 8, 8, 10, 10, 12, 12], plank = [30, 35, 40, 45, 50, 60, 65, 75];
  const avgPain = (a, b) => days.slice(a, b).reduce((t, d) => t + d.pain, 0) / (b - a);
  const clock = v => `${Math.floor(v / 60)}:${String(Math.round(v % 60)).padStart(2, '0')}`;

  const SERIES = [
    { key: 'pain', label: 'Pain', c: '#f4908a', min: 0, max: 10, fmt: v => `${v}/10`, front: true,
      row: { name: 'Pain', unit: 'weekly average', at: i => smoothWeeks(weekPain, i), min: 2, max: 6, fmt: v => `${v.toFixed(1)}/10`, from: avgPain(0, LIFTS_FROM), c: '#f4908a' } },
    { key: 'sitting', label: 'Long sitting', c: '#f3b46e', min: 0, max: 11, fmt: v => `${v.toFixed(1)} h`,
      // Nothing, then deadlifts from week 4: the line jumps up from flat
      row: { name: 'Deadlift', unit: 'kg', at: i => (i < LIFTS_FROM ? 0 : smoothWeeks(deadlift, i)), min: 0, max: 100, fmt: v => `${Math.round(v / 2.5) * 2.5} kg`, from: deadlift[3], c: '#74d4c0' } },
    { key: 'walking', label: 'Walking', c: '#74d4c0', min: 0, max: 120, fmt: v => `${Math.round(v)} min`,
      row: { name: 'Bird dog', unit: 'reps', at: i => smoothWeeks(birdDog, i), min: 4, max: 13, fmt: v => `${Math.round(v)} reps`, from: birdDog[0], c: '#74d4c0' } },
    { key: 'driving', label: 'Driving', c: '#e3a6f5', min: 0, max: 200, fmt: v => `${Math.round(v)} min`,
      row: { name: 'Plank', unit: 'hold', at: i => smoothWeeks(plank, i), min: 20, max: 80, fmt: clock, from: plank[0], c: '#74d4c0' } },
  ];
  const CHAPTERS = [
    { from: 0, to: 18, key: 'sitting', pill: 'What goes with pain', text: 'Pain is worse on days you sit for long' },
    { from: 18, to: 37, key: 'walking', pill: 'What eases it', text: 'You have less pain on days you walk more' },
    { from: 37, to: N, key: 'driving', pill: 'What hurts later', text: 'Pain gets worse the day after a long drive' },
    { key: 'routine', pill: 'Your progress', text: 'Your pain has eased since you started deadlifts' },
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
  const keyEls = SERIES.map(s => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'key on'; b.style.setProperty('--c', s.c); b.setAttribute('aria-pressed', 'true');
    b.innerHTML = '<i aria-hidden="true"></i><span class="key-name"></span><strong></strong>';
    b.querySelector('.key-name').textContent = s.label;
    b.onclick = () => { hidden.has(s.key) ? hidden.delete(s.key) : hidden.add(s.key); b.classList.toggle('on', !hidden.has(s.key)); b.setAttribute('aria-pressed', String(!hidden.has(s.key))); paint(); };
    b.onpointerenter = () => { hoverSeries = s.key; paint(); };
    b.onpointerleave = () => { hoverSeries = null; paint(); };
    legend.append(b);
    return b;
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
  // In the routine view the pointer (or a finger) runs along the weeks instead, as on the app's progress page
  plot.addEventListener('pointermove', e => {
    const r = plot.getBoundingClientRect(), x = e.clientX - r.left;
    if (morphT > 0.9) {
      scrub = x < sx[0] - 20 || x > sx[1] + 20 ? null : Math.round(clamp((x - sx[0]) / (sx[1] - sx[0])) * (N - 1));
    } else if (e.pointerType === 'mouse' && morphT < 0.3) {
      hoverDay = clamp(Math.round((x - offset) / dayW - 0.5), 0, N - 1);
    } else return;
    paint();
  });
  plot.addEventListener('pointerleave', () => { hoverDay = null; scrub = null; paint(); });

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

  let W = 0, H = 0, dayW = 0, offset = 0, pos = 0, morphT = 0, chapter = 0, built = false, scrub = null, sx = [0, 0];
  const parts = {};

  /** Builds the chart's pieces once per size or look; paint() moves them. */
  function build() {
    W = plot.clientWidth; H = plot.clientHeight;
    dayW = W / (W > 900 ? 21 : W > 560 ? 13 : 8);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.replaceChildren();
    const defs = el('defs', {}, svg);
    el('feGaussianBlur', { stdDeviation: 7 }, el('filter', { id: 'glow', x: '-10%', y: '-40%', width: '120%', height: '180%' }, defs));
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
    // Where deadlifts start: a dashed line down through every row and a dot where the line jumps
    parts.mark = el('g', { opacity: 0 }, svg);
    parts.markLine = el('line', { stroke: '#74d4c0', 'stroke-opacity': 0.6, 'stroke-dasharray': '3 5' }, parts.mark);
    parts.markDot = el('circle', { r: 5.5, fill: '#74d4c0' }, parts.mark);
    parts.scrub = el('g', { opacity: 0 }, svg);
    parts.scrubLine = el('line', { stroke: 'currentColor', 'stroke-opacity': 0.5 }, parts.scrub);
    parts.scrubDots = SERIES.map(s => el('circle', { r: 4.5, fill: s.row.c }, parts.scrub));
    parts.cursor = el('line', { y1: 44, y2: H - 4, stroke: 'currentColor', 'stroke-width': 1.5 }, svg);
    // The routine view's rows: a name on the left, the trend in the middle, the latest on the right
    rowsEl.replaceChildren(...SERIES.map(s => {
      const r = document.createElement('div'); r.className = 'row';
      r.innerHTML = '<span class="name"><b></b> <small></small></span><span class="end"></span>';
      r.querySelector('b').textContent = s.row.name; r.querySelector('small').textContent = s.row.unit;
      return r;
    }));
    parts.tag = document.createElement('div'); parts.tag.className = 'start-tag'; parts.tag.textContent = 'Started deadlifts';
    notes.replaceChildren(...CALLOUTS.map(c => {
      const n = document.createElement('div'); n.className = 'callout';
      n.innerHTML = '<span class="tag"></span>'; n.firstChild.textContent = c.text;
      return n;
    }));
    notes.append(parts.tag);
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
    // Wide: name, line, value side by side. Narrow: name and value above a full-width line
    const stacked = W < 700, labelRoom = stacked ? 30 : 8;
    const sx0 = W * (stacked ? 0.05 : 0.3), sx1 = W * (stacked ? 0.95 : 0.74);
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
    parts.series.forEach(({ s, s0, s1, area, glow, line, g }, k) => {
      if (hidden.has(s.key)) { g.setAttribute('opacity', 0); return; }
      // Each line leaves for its row a moment after the one above, so the change reads as a cascade
      const tk = ease(clamp(t * 1.4 - k * 0.12));
      const lo = rowTop + rowH * k + labelRoom, hi = rowTop + rowH * (k + 1) - 8;
      const pts = days.map((d, i) => {
        const yh = bottom - ((d[s.key] - s.min) / (s.max - s.min)) * (bottom - top);
        const rv = s.row.at(i);
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
    [...notes.querySelectorAll(".callout")].forEach((n, k) => {
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
      // The change over the eight weeks, or the week under the pointer
      r.lastChild.textContent = scrub != null ? s.row.fmt(s.row.at(scrub)) : `${s.row.fmt(s.row.from)} → ${s.row.fmt(s.row.at(N - 1))}`;
    });
    sx = [sx0, sx1];
    const xr = i => sx0 + (i / (N - 1)) * (sx1 - sx0);
    const yr = (k, i) => { const r = SERIES[k].row, lo = rowTop + rowH * k + labelRoom, hi = rowTop + rowH * (k + 1) - 8; return hi - ((r.at(i) - r.min) / (r.max - r.min)) * (hi - lo); };
    const ready = clamp((t - 0.85) / 0.15);
    parts.mark.setAttribute('opacity', ready.toFixed(3));
    const mx = xr(LIFTS_FROM);
    parts.markLine.setAttribute('x1', mx); parts.markLine.setAttribute('x2', mx);
    parts.markLine.setAttribute('y1', rowTop + 4); parts.markLine.setAttribute('y2', H - 4);
    parts.markDot.setAttribute('cx', mx); parts.markDot.setAttribute('cy', yr(1, LIFTS_FROM));
    parts.markDot.setAttribute('stroke', light ? '#fff' : '#0d0d0f'); parts.markDot.setAttribute('stroke-width', 2.5);
    parts.tag.style.opacity = ready; parts.tag.style.left = `${mx}px`; parts.tag.style.top = `${yr(1, LIFTS_FROM) - 44}px`;
    parts.scrub.setAttribute('opacity', scrub != null && t > 0.9 ? 1 : 0);
    if (scrub != null) {
      const x = xr(scrub);
      parts.scrubLine.setAttribute('x1', x); parts.scrubLine.setAttribute('x2', x); parts.scrubLine.setAttribute('y1', rowTop + 4); parts.scrubLine.setAttribute('y2', H - 4);
      parts.scrubDots.forEach((c, k) => { c.setAttribute('cx', x); c.setAttribute('cy', yr(k, scrub)); c.setAttribute('stroke', light ? '#fff' : '#0d0d0f'); c.setAttribute('stroke-width', 2); });
    }

    // The message for the chapter, and the day under the line
    const c = CHAPTERS[showCh];
    if (msg.text.dataset.k !== String(showCh)) {
      msg.text.dataset.k = showCh;
      msg.text.animate?.([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: still ? 0 : 450, easing: 'ease-out' });
      msg.text.textContent = c.text;
    }
    if (showCh === 3) msg.day.textContent = scrub != null ? `Week ${week(scrub) + 1}` : `Deadlifts from week 4. Average pain ${avgPain(0, LIFTS_FROM).toFixed(1)} before, ${avgPain(LIFTS_FROM, N).toFixed(1)} since`;
    else {
      const d = days[day];
      msg.day.textContent = '';
      keyEls.forEach((b, k) => { b.lastChild.textContent = SERIES[k].fmt(d[SERIES[k].key]); });
    }
    pillEls.forEach((p, k) => { p.classList.toggle('on', k === chapter); p.classList.toggle('peek', k === hoverChapter && k !== chapter); });
    legend.style.opacity = (1 - clamp(t * 3)).toFixed(3);
    svg.style.setProperty('--edge', t.toFixed(3));
    legend.style.pointerEvents = t > 0.2 ? 'none' : '';
  }

  read();
  build();
  addEventListener('resize', build);
  addEventListener('scroll', () => requestAnimationFrame(() => { read(); paint(); }), { passive: true });
  onTheme(build);
  document.fonts?.ready.then(build);
})();
