// ─── Frontend TTS Utility ─────────────────────────────────────────────────────
// Text-to-speech for the report page (English only).
// Tries POST /api/speech/tts (QVAC Chatterbox, on-device) first.
// Falls back to the browser's SpeechSynthesis API transparently.

const BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

let currentAudio: HTMLAudioElement | null = null;
let currentUtterance: SpeechSynthesisUtterance | null = null;
let qvacTtsAvailable: boolean | null = null; // null = not yet checked

async function checkQvacTts(): Promise<boolean> {
  if (qvacTtsAvailable !== null) return qvacTtsAvailable;
  try {
    const res = await fetch(`${BASE}/api/speech/capabilities`);
    if (!res.ok) { qvacTtsAvailable = false; return false; }
    const { tts } = await res.json();
    qvacTtsAvailable = Boolean(tts);
  } catch {
    qvacTtsAvailable = false;
  }
  return qvacTtsAvailable;
}

/**
 * Speak `text` in English.
 * Tries QVAC backend TTS first; falls back to browser SpeechSynthesis.
 * @returns `'qvac'` | `'browser'` — which engine was used.
 */
export async function speakText(
  text: string,
  onEnd?: () => void
): Promise<'qvac' | 'browser'> {
  stopSpeaking();

  const useQvac = await checkQvacTts();

  if (useQvac) {
    try {
      const res = await fetch(`${BASE}/api/speech/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        currentAudio = audio;
        audio.onended = () => {
          URL.revokeObjectURL(url);
          currentAudio = null;
          onEnd?.();
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          currentAudio = null;
          onEnd?.();
        };
        audio.play();
        return 'qvac';
      }
    } catch {
      // fall through to browser TTS
    }
  }

  // Browser SpeechSynthesis fallback
  return new Promise<'browser'>(resolve => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.95;
    utterance.onend = () => {
      currentUtterance = null;
      onEnd?.();
      resolve('browser');
    };
    utterance.onerror = () => {
      currentUtterance = null;
      onEnd?.();
      resolve('browser');
    };
    currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
    resolve('browser');
  });
}

/** Stop any active TTS playback immediately. */
export function stopSpeaking(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (currentUtterance || window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
    currentUtterance = null;
  }
}

/** Returns true if the browser supports SpeechSynthesis. */
export function isTtsSupportedInBrowser(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}
