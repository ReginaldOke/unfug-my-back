// Voice notes via the Web Speech API. Stands in for the iOS Speech framework (on-device) in the native app.
// Note: Chrome's implementation sends audio to Google for transcription; Safari uses Apple's service.

const Recognition = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;

export const voiceSupported = !!Recognition;

/** Starts dictation. onText(finalText, interimText) fires as words arrive. Returns a stop function. */
export function startDictation({ onText, onEnd }) {
  const rec = new Recognition();
  rec.lang = navigator.language || 'en-AU';
  rec.interimResults = true;
  rec.continuous = true;
  let finalText = '';
  rec.onresult = e => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += r[0].transcript;
      else interim += r[0].transcript;
    }
    onText(finalText, interim);
  };
  rec.onerror = e => onEnd?.(e.error);
  rec.onend = () => onEnd?.();
  rec.start();
  return () => rec.stop();
}
