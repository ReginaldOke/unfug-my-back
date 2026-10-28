// "Analyse with AI": the diary goes to whichever AI chat app the user picks, through the share sheet
// or the clipboard. The app never sends it anywhere itself.
import * as R from './repos.js';
import { buildExport, ANALYSIS_PROMPT } from './export.js';
import { REGIONS } from './regions.js';
import { localDate } from './dates.js';
import { copyText, shareOrDownload } from './ui.js';

const NOISE = new Set(['createdAt', 'updatedAt', 'schemaVersion', 'timeZone']);

/** The full diary, minus per-row bookkeeping fields a chat doesn't need. */
export function diaryForAI() {
  const data = buildExport(R.snapshot(), { from: R.firstDataDate(), to: localDate(), regions: REGIONS });
  for (const [k, v] of Object.entries(data)) {
    if (Array.isArray(v)) data[k] = v.map(row => Object.fromEntries(Object.entries(row).filter(([f]) => !NOISE.has(f))));
  }
  return data;
}

/** The diary file, with the analysis instructions inside, to attach to a chat. */
export const shareDiary = () =>
  shareOrDownload(`back-diary-${localDate()}.json`, JSON.stringify(diaryForAI(), null, 2), 'application/json');

/** Instructions plus the diary as one block of text, to paste into a chat. */
export function copyDiary() {
  const { analysisPrompt, ...diary } = diaryForAI();
  return copyText(`${analysisPrompt ?? ANALYSIS_PROMPT}\n\nHere is my diary:\n\`\`\`json\n${JSON.stringify(diary)}\n\`\`\``);
}
