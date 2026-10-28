// Apple Health import. A web app can't read HealthKit, so data comes in two ways:
//  1. The Health app's own export (export.zip, or the export.xml inside it): daily steps and sleep,
//     read on the phone in a stream so even years of data fit in memory.
//  2. A Shortcut that opens #/health?steps=2026-10-28:8412,… once a day. The data rides in the URL
//     fragment, which never leaves the phone.
// Parsing is pure and tested in test/health.test.js.

import { isNative } from './native.js';

// On in the iOS app, which reads HealthKit directly. Off in the browser: the export and Shortcut routes
// were too fiddly. Turning this on brings back the strips, the screen and the lines.
export const HEALTH_IMPORT = isNative;

const STEP_TYPE = 'HKQuantityTypeIdentifierStepCount';
const SLEEP_TYPE = 'HKCategoryTypeIdentifierSleepAnalysis';
const attr = (line, name) => line.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];

/**
 * Collects daily totals from export.xml lines. iPhone and Watch both count steps (and sleep), so each
 * source is totalled separately and the day takes the larger one, close to what the Health app shows.
 */
export function createCollector() {
  const steps = new Map(); // date → source → total
  const sleep = new Map(); // wake-up date → source → minutes asleep
  const add = (m, date, source, v) => {
    if (!m.has(date)) m.set(date, new Map());
    const bySource = m.get(date);
    bySource.set(source, (bySource.get(source) ?? 0) + v);
  };
  return {
    line(line) {
      if (!line.includes('<Record ')) return;
      const type = attr(line, 'type');
      if (type === STEP_TYPE) {
        const v = Number(attr(line, 'value'));
        if (Number.isFinite(v)) add(steps, attr(line, 'startDate').slice(0, 10), attr(line, 'sourceName') ?? '', v);
      } else if (type === SLEEP_TYPE && /Asleep/.test(attr(line, 'value') ?? '')) {
        const start = parseHealthDate(attr(line, 'startDate')), end = parseHealthDate(attr(line, 'endDate'));
        if (start && end > start) add(sleep, attr(line, 'endDate').slice(0, 10), attr(line, 'sourceName') ?? '', (end - start) / 60_000);
      }
    },
    /** [{ date, steps?, sleepHours? }] oldest first. */
    days() {
      const best = m => new Map([...m].map(([d, s]) => [d, Math.max(...s.values())]));
      const st = best(steps), sl = best(sleep);
      return [...new Set([...st.keys(), ...sl.keys()])].sort().map(date => ({
        date,
        steps: st.has(date) ? Math.round(st.get(date)) : undefined,
        // Under an hour is a nap or a watch blip, not a night
        sleepHours: sl.get(date) >= 60 ? Math.round(sl.get(date) / 6) / 10 : undefined,
      }));
    },
  };
}

/** "2026-10-28 07:12:03 +0100" → Date */
export function parseHealthDate(s) {
  const m = s?.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{2})(\d{2})$/);
  return m ? new Date(`${m[1]}T${m[2]}${m[3]}:${m[4]}`) : null;
}

/** Feeds a text stream to the collector line by line. */
async function readLines(stream, collector, onProgress) {
  const reader = stream.getReader();
  let rest = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const lines = (rest + value).split('\n');
    rest = lines.pop();
    for (const l of lines) collector.line(l);
    onProgress?.();
  }
  collector.line(rest);
}

/** Finds export.xml in the zip and returns its decompressed byte stream. */
async function exportXmlFromZip(file) {
  const u32 = (dv, o) => dv.getUint32(o, true), u16 = (dv, o) => dv.getUint16(o, true);
  // The central directory's end record sits in the last 64 KB
  const tailStart = Math.max(0, file.size - 65_557);
  const tail = new DataView(await file.slice(tailStart).arrayBuffer());
  let eocd = -1;
  for (let i = tail.byteLength - 22; i >= 0; i--) if (u32(tail, i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('This doesn’t look like a Health export.');
  const cdSize = u32(tail, eocd + 12), cdOffset = u32(tail, eocd + 16);
  if (cdOffset === 0xffffffff) throw new Error('This export is too big to read here. Try exporting on a newer iPhone, or ask for help.');
  const cd = new DataView(await file.slice(cdOffset, cdOffset + cdSize).arrayBuffer());
  const dec = new TextDecoder();
  for (let p = 0; p + 46 <= cd.byteLength && u32(cd, p) === 0x02014b50;) {
    const method = u16(cd, p + 10), compSize = u32(cd, p + 20);
    const nameLen = u16(cd, p + 28), extraLen = u16(cd, p + 30), commentLen = u16(cd, p + 32), local = u32(cd, p + 42);
    const name = dec.decode(new Uint8Array(cd.buffer, p + 46, nameLen));
    if (/(^|\/)export\.xml$/.test(name)) {
      const lh = new DataView(await file.slice(local, local + 30).arrayBuffer());
      const start = local + 30 + u16(lh, 26) + u16(lh, 28);
      const raw = file.slice(start, start + compSize).stream();
      if (method === 0) return raw;
      if (method === 8) return raw.pipeThrough(new DecompressionStream('deflate-raw'));
      throw new Error('Unsupported zip compression.');
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error('No export.xml in this file. Pick the export.zip from the Health app.');
}

/** Reads a Health export (.zip or .xml). onProgress(fraction of the file read, roughly). */
export async function readHealthExport(file, onProgress) {
  const collector = createCollector();
  const isZip = /\.zip$/i.test(file.name) || file.type === 'application/zip';
  const bytes = isZip ? await exportXmlFromZip(file) : file.stream();
  // Progress by compressed bytes would need a second pass; count decoded text against a typical 1:12 ratio
  let seen = 0;
  const expected = isZip ? file.size * 12 : file.size;
  const counted = bytes.pipeThrough(new TextDecoderStream()).pipeThrough(new TransformStream({
    transform(chunk, ctl) { seen += chunk.length; ctl.enqueue(chunk); },
  }));
  await readLines(counted, collector, () => onProgress?.(Math.min(0.99, seen / expected)));
  return collector.days();
}

/** #/health?steps=2026-10-28:8412,2026-10-29:10233&sleep=2026-10-29:7.4 → rows, ignoring anything malformed. */
export function parseShortcut(params) {
  const rows = new Map();
  const read = (key, field, ok) => {
    for (const pair of (params.get(key) ?? '').split(/[,;\n]/)) {
      const m = pair.trim().match(/^(\d{4}-\d{2}-\d{2})[:=]\s*([\d.]+)$/);
      if (!m || !ok(Number(m[2]))) continue;
      rows.set(m[1], { ...rows.get(m[1]), date: m[1], [field]: Number(m[2]) });
    }
  };
  read('steps', 'steps', v => v >= 0 && v < 200_000);
  read('sleep', 'sleepHours', v => v > 0 && v <= 16);
  return [...rows.values()].map(r => (r.steps != null ? { ...r, steps: Math.round(r.steps) } : r));
}
