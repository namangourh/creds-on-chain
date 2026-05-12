// ─── QVAC Speech Service ──────────────────────────────────────────────────────
// Lazy-loads @qvac/transcription-whispercpp (STT) and @qvac/tts-onnx (TTS).
// Both are wrapped in try/catch so the server starts normally even when the
// QVAC Bare addons are not installed.  Callers check isSttAvailable() /
// isTtsAvailable() before calling transcribe() / synthesize().

let whisperModel: any | null = null;
let whisperInitAttempted = false;

let ttsModel: any | null = null;
let ttsInitAttempted = false;

// ─── STT (Whisper) ────────────────────────────────────────────────────────────

async function getWhisperModel(): Promise<any | null> {
  if (whisperInitAttempted) return whisperModel;
  whisperInitAttempted = true;
  try {
    const { TranscriptionWhispercpp } = await import(
      "@qvac/transcription-whispercpp"
    );
    const FilesystemDL = (await import("@qvac/dl-filesystem")).default;

    const dirPath = process.env.QVAC_MODELS_DIR || "./models";
    const modelName = "ggml-tiny.bin";

    const fsDL = new FilesystemDL({ dirPath });
    const model = new TranscriptionWhispercpp(
      { modelName, loader: fsDL, diskPath: dirPath },
      {
        whisperConfig: {
          audio_format: "s16le",
          language: "en",
          suppress_nst: true,
        },
      }
    );
    await model.load();
    whisperModel = model;
    console.log("[speech] QVAC Whisper STT ready — transcription is on-device");
  } catch (e: any) {
    console.warn("[speech] QVAC Whisper unavailable:", e?.message);
    whisperModel = null;
  }
  return whisperModel;
}

/** Returns true when the Whisper engine loaded successfully. */
export function isSttAvailable(): boolean {
  return whisperModel !== null;
}

/**
 * Transcribe a PCM audio Buffer (s16le, 16 kHz, mono) to text.
 * Returns null if Whisper is not available.
 */
export async function transcribeAudio(
  audioBuffer: Buffer
): Promise<string | null> {
  const model = await getWhisperModel();
  if (!model) return null;

  try {
    const { Readable } = await import("stream");
    const stream = Readable.from(audioBuffer);
    const response = await model.run(stream);

    const segments: any[] = [];
    for await (const chunk of response.iterate()) {
      const items = Array.isArray(chunk) ? chunk : [chunk];
      segments.push(...items);
    }

    return segments
      .map((s: any) => s.text ?? "")
      .join(" ")
      .trim();
  } catch (e: any) {
    console.error("[speech] Whisper transcription error:", e?.message);
    return null;
  }
}

// ─── TTS (Chatterbox / ONNX) ─────────────────────────────────────────────────

async function getTtsModel(): Promise<any | null> {
  if (ttsInitAttempted) return ttsModel;
  ttsInitAttempted = true;
  try {
    const ONNXTTS = (await import("@qvac/tts-onnx")).default;
    const dirPath = process.env.QVAC_MODELS_DIR || "./models";
    const chatterboxDir = `${dirPath}/chatterbox`;

    const model = new ONNXTTS(
      {
        tokenizerPath: `${chatterboxDir}/tokenizer.json`,
        speechEncoderPath: `${chatterboxDir}/speech_encoder.onnx`,
        embedTokensPath: `${chatterboxDir}/embed_tokens.onnx`,
        conditionalDecoderPath: `${chatterboxDir}/conditional_decoder.onnx`,
        languageModelPath: `${chatterboxDir}/language_model.onnx`,
        opts: { stats: false },
        logger: console,
      },
      { language: "en" }
    );
    await model.load();
    ttsModel = model;
    console.log("[speech] QVAC TTS (Chatterbox) ready — synthesis is on-device");
  } catch (e: any) {
    console.warn("[speech] QVAC TTS unavailable:", e?.message);
    ttsModel = null;
  }
  return ttsModel;
}

/** Returns true when the Chatterbox TTS engine loaded successfully. */
export function isTtsAvailable(): boolean {
  return ttsModel !== null;
}

/**
 * Synthesize `text` to raw PCM samples (Int16Array, 24 kHz, mono).
 * Returns null if TTS is not available.
 */
export async function synthesizeSpeech(
  text: string
): Promise<Int16Array | null> {
  const model = await getTtsModel();
  if (!model) return null;

  try {
    const response = await model.run({ input: text, type: "text" });
    const samples: number[] = [];

    await response
      .onUpdate((data: any) => {
        if (data?.outputArray) {
          samples.push(...Array.from(data.outputArray as Int16Array));
        }
      })
      .await();

    return new Int16Array(samples);
  } catch (e: any) {
    console.error("[speech] TTS synthesis error:", e?.message);
    return null;
  }
}

/**
 * Convert Int16Array PCM samples to a WAV Buffer.
 * Sample rate: 24000 Hz, mono, 16-bit PCM.
 */
export function pcmToWav(samples: Int16Array, sampleRate = 24000): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = samples.length * 2; // 2 bytes per sample
  const headerSize = 44;
  const buf = Buffer.alloc(headerSize + dataSize);

  // RIFF header
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);          // PCM chunk size
  buf.writeUInt16LE(1, 20);           // PCM format
  buf.writeUInt16LE(numChannels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(bitsPerSample, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples.length; i++) {
    buf.writeInt16LE(samples[i], headerSize + i * 2);
  }

  return buf;
}
