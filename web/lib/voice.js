// Voice notes and spoken reps. In the iPhone app this uses Apple's speech recogniser through a small native
// plugin (the app's web view has no speech recognition of its own); in a browser, the Web Speech API.
// Note: Chrome's implementation sends audio to Google for transcription; Safari uses Apple's service.

const Recognition = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
const Cap = globalThis.Capacitor;
const Native = Cap?.isNativePlatform?.() ? Cap.registerPlugin('Speech') : null;

export const voiceSupported = !!(Native || Recognition);

// Apple's recogniser keeps one running transcript; a pause this long ends a phrase, so each thing said
// ("10 push ups", then "20 squats") arrives on its own, as the browser's does
const PHRASE_PAUSE = 1100;

/** Starts dictation. onText(finalText, interimText) fires as words arrive. Returns a stop function. */
export function startDictation({ onText, onEnd }) {
  return Native ? nativeDictation({ onText, onEnd }) : webDictation({ onText, onEnd });
}

function nativeDictation({ onText, onEnd }) {
  let heard = '', committed = '', pause = 0, done = false;
  const handles = [];
  const commit = () => {
    clearTimeout(pause);
    if (heard.length > committed.length) { committed = heard; onText(committed, ''); }
  };
  const end = err => {
    if (done) return;
    done = true;
    commit();
    handles.forEach(h => h.remove());
    onEnd?.(err);
  };
  (async () => {
    handles.push(await Native.addListener('result', ({ text, final }) => {
      heard = text;
      onText(committed, text.slice(committed.length).trim());
      clearTimeout(pause);
      if (final) commit(); else pause = setTimeout(commit, PHRASE_PAUSE);
    }));
    handles.push(await Native.addListener('end', () => end()));
    try { await Native.start({ lang: navigator.language || 'en-AU' }); } catch (e) { end(/allowed/.test(e?.message ?? '') ? 'not-allowed' : 'error'); }
  })();
  return () => { commit(); Native.stop().catch(() => end()); };
}

function webDictation({ onText, onEnd }) {
  const rec = new Recognition();
  rec.lang = navigator.language || 'en-AU';
  rec.interimResults = true;
  rec.continuous = true;
  let finalText = '';
  rec.onresult = e => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += (finalText && !/^\s/.test(r[0].transcript) ? ' ' : '') + r[0].transcript;
      else interim += r[0].transcript;
    }
    onText(finalText, interim);
  };
  rec.onerror = e => onEnd?.(e.error);
  rec.onend = () => onEnd?.();
  rec.start();
  return () => rec.stop();
}
