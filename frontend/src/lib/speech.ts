// ─── Frontend Speech Utilities ────────────────────────────────────────────────
// STT: Uses the browser's SpeechRecognition API (Chrome/Edge/Safari).
//      When QVAC backend STT is available the mic still records in-browser and
//      sends the blob to POST /api/speech/transcribe instead of using the
//      cloud-based browser API.
//
// TTS: Tries POST /api/speech/tts (QVAC Chatterbox, English only).
//      Falls back to the browser's SpeechSynthesis API.

const BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

// ─── STT ─────────────────────────────────────────────────────────────────────

/** Returns true if the browser supports the SpeechRecognition Web API. */
export function isSpeechRecognitionSupported(): boolean {
  return typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
}

let activeRecognition: SpeechRecognition | null = null;

/**
 * Start listening for speech and populate a text query.
 *
 * @param onInterim  - Called with live partial transcripts while speaking.
 * @param onFinal    - Called once with the confirmed final transcript.
 * @param onError    - Called if recognition fails or is not supported.
 * @returns          A `stop()` function to cancel recognition.
 */
export function startVoiceSearch(
  onInterim: (text: string) => void,
  onFinal: (text: string) => void,
  onError: () => void
): () => void {
  if (!isSpeechRecognitionSupported()) {
    onError();
    return () => {};
  }

  // Stop any previous session
  if (activeRecognition) {
    activeRecognition.abort();
    activeRecognition = null;
  }

  const SpeechRecognitionImpl =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;

  const recognition: SpeechRecognition = new SpeechRecognitionImpl();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'en-US';
  recognition.maxAlternatives = 1;

  recognition.onresult = (event: SpeechRecognitionEvent) => {
    let interim = '';
    let final = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        final += transcript;
      } else {
        interim += transcript;
      }
    }
    if (interim) onInterim(interim);
    if (final) onFinal(final.trim());
  };

  recognition.onerror = () => {
    activeRecognition = null;
    onError();
  };

  recognition.onend = () => {
    activeRecognition = null;
  };

  recognition.start();
  activeRecognition = recognition;

  return () => {
    recognition.abort();
    activeRecognition = null;
  };
}

// ─── TTS ─────────────────────────────────────────────────────────────────────

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
