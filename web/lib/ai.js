// "Analyse with Claude": sends the diary to the local server, which calls the Claude API.
// The API key lives only on the server (SPEC.md › Never put an API key in the app binary).
import * as R from './repos.js';
import { buildExport, ANALYSIS_PROMPT } from './export.js';
import { REGIONS } from './regions.js';
import { localDate } from './dates.js';
import { copyText } from './ui.js';

const NOISE = new Set(['createdAt', 'updatedAt', 'schemaVersion', 'timeZone']);

/** The full diary, minus per-row bookkeeping fields Claude doesn't need. */
export function diaryForClaude() {
  const data = buildExport(R.snapshot(), { from: R.firstDataDate(), to: localDate(), regions: REGIONS });
  delete data.analysisPrompt;
  for (const [k, v] of Object.entries(data)) {
    if (Array.isArray(v)) data[k] = v.map(row => Object.fromEntries(Object.entries(row).filter(([f]) => !NOISE.has(f))));
  }
  return data;
}

export async function aiStatus() {
  try {
    const res = await fetch('api/status');
    return res.ok ? await res.json() : { ai: false };
  } catch {
    return { ai: false };
  }
}

export async function analyse() {
  const diary = diaryForClaude();
  const res = await fetch('api/analyse', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ diary }),
  }).catch(() => null);
  if (!res) throw Object.assign(new Error('Could not reach the local server.'), { code: 'offline' });
  const body = await res.json().catch(() => ({}));
  // No analysis server (e.g. the static website build): fall back to copy & paste
  if (!res.ok && !body.code && [404, 405, 501].includes(res.status)) throw Object.assign(new Error('No analysis server here.'), { code: 'offline' });
  if (!res.ok) throw Object.assign(new Error(body.error || 'Analysis failed.'), { code: body.code });
  return R.aiSummaries.create({
    text: body.summary, model: body.model, range: diary.range, checkins: diary.dailyEntries.length,
  });
}

/** Fallback with no API key: copy prompt + diary, then open Claude to paste it. */
export async function copyForClaude() {
  const text = `${ANALYSIS_PROMPT}\n\nHere is my diary:\n\`\`\`json\n${JSON.stringify(diaryForClaude())}\n\`\`\``;
  const ok = await copyText(text);
  window.open('https://claude.ai/new', '_blank', 'noopener');
  return ok;
}
