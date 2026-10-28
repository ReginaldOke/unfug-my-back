// Local server for the web prototype: serves web/ and proxies "Analyse with Claude" to the Claude API,
// so the API key stays on this machine (ANTHROPIC_API_KEY, or an `ant auth login` profile).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { ANALYSIS_PROMPT } from './web/lib/export.js';

const root = fileURLToPath(new URL('./web/', import.meta.url));
const threeRoot = fileURLToPath(new URL('./node_modules/three/', import.meta.url));
const port = Number(process.env.PORT) || 4321;
const MODEL = 'claude-opus-5-5';
const MAX_BODY = 8 * 1024 * 1024;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.obj': 'text/plain', '.bin': 'application/octet-stream',
};

const SYSTEM = `You help one person understand their own back pain diary. You are not their clinician.
Write for a phone screen: plain language, short sentences, under 350 words. Write the way a good physio would text a client: specific and direct, no filler, no hype, no em dashes. Use markdown with these sections:
## In short — two or three sentences on the overall picture.
## Patterns — the strongest associations, each with the numbers behind it (days with vs without, lag, sample size).
## What seems to help
## Try next — up to 3 small experiments, and concrete changes to their movement routine.
## How sure is this — sample sizes and caveats.
Frame findings as associations, never causes. Follow a tolerance-building view of back pain: suggest graded exposure and pacing, never permanent avoidance, and never imply bending or activity is dangerous.
Never diagnose. If the notes mention new numbness in the groin or saddle area, bladder or bowel changes, progressive leg weakness, or symptoms in both legs, say first that they should get prompt medical care.
If there are fewer than about 7 check-ins, say what you can and explain how many more days would make patterns clearer.`;

let client;
const getClient = () => (client ??= new Anthropic());

function sendJSON(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw Object.assign(new Error('Diary too large'), { status: 413 });
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function analyse(req, res) {
  let diary;
  try {
    ({ diary } = await readBody(req));
  } catch (e) {
    return sendJSON(res, e.status || 400, { error: e.status ? e.message : 'Invalid request' });
  }
  if (!diary?.dailyEntries?.length) return sendJSON(res, 400, { error: 'Log at least one check-in first.', code: 'no_data' });

  try {
    const response = await getClient().beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium' },
      system: SYSTEM,
      messages: [{ role: 'user', content: `${ANALYSIS_PROMPT}\n\n<diary>\n${JSON.stringify(diary)}\n</diary>` }],
    });
    if (response.stop_reason === 'refusal') {
      return sendJSON(res, 422, { error: 'Claude declined to analyse this diary.', code: 'refusal' });
    }
    const summary = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    if (!summary) return sendJSON(res, 502, { error: 'Claude returned an empty answer. Try again.' });
    return sendJSON(res, 200, { summary, model: response.model });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
      return sendJSON(res, 401, { error: 'The server’s Claude API key was rejected.', code: 'no_credentials' });
    }
    if (e instanceof Anthropic.RateLimitError) return sendJSON(res, 429, { error: 'Claude is busy. Try again in a minute.' });
    if (e instanceof Anthropic.APIConnectionError) return sendJSON(res, 502, { error: 'Could not reach Claude. Check your connection.' });
    if (e instanceof Anthropic.APIError) return sendJSON(res, 502, { error: `Claude API error (${e.status}).` });
    // The client throws before any request when no credentials are configured
    console.error(e);
    return sendJSON(res, 503, { error: 'No Claude API key is set up on the server.', code: 'no_credentials' });
  }
}

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);

  if (path === '/api/status') {
    return sendJSON(res, 200, { ai: Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_PROFILE), model: MODEL });
  }
  if (path === '/api/analyse' && req.method === 'POST') return analyse(req, res);

  // three.js is served straight from node_modules (see the import map in index.html)
  const base = path.startsWith('/vendor/three/') ? threeRoot : root;
  const rel = base === threeRoot ? path.slice('/vendor/three/'.length) : path;
  const file = normalize(join(base, rel.endsWith('/') || rel === '' ? `${rel}index.html` : rel));
  if (!file.startsWith(base)) return res.writeHead(403).end();
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).on('error', e => {
  if (e.code !== 'EADDRINUSE') throw e;
  console.error(`Port ${port} is already in use — is the app already running? Stop it, or start on another port: PORT=4322 npm start`);
  process.exit(1);
}).listen(port, () => {
  console.log(`Unfug My Back running at http://localhost:${port}`);
  const hasKey = process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_API_KEY.includes('...');
  console.log(hasKey ? 'Claude analysis: API key found.' : 'Claude analysis: no API key — "Analyse my data" will fall back to copy & paste.');
});
