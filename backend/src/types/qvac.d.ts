// ─── QVAC SDK Type Stubs ─────────────────────────────────────────────────────
// These packages run fully on-device via the QVAC runtime. They are not
// published to npm so we declare them as `any` to satisfy the TypeScript
// compiler. Runtime imports are guarded with try/catch for graceful fallback.

declare module "@qvac/llm-llamacpp" {
  export class LLM {
    constructor(options: { model: string; [key: string]: any });
    init(): Promise<void>;
    chat(messages: Array<{ role: string; content: string }>): Promise<string | { content: string }>;
    [key: string]: any;
  }
}

declare module "@qvac/embed-llamacpp" {
  export class Embedder {
    constructor(options?: { model?: string; [key: string]: any });
    init(): Promise<void>;
    embed(text: string): Promise<number[]>;
    [key: string]: any;
  }
}

declare module "@qvac/ocr-onnx" {
  export class OCR {
    constructor(options?: { [key: string]: any });
    init(): Promise<void>;
    recognize(buffer: Buffer): Promise<string | { text: string }>;
    [key: string]: any;
  }
}

declare module "@qvac/translation-nmtcpp" {
  export class Translator {
    constructor(options?: { [key: string]: any });
    init(): Promise<void>;
    translate(text: string, options: { from: string; to: string }): Promise<string | { text: string }>;
    [key: string]: any;
  }
}

declare module "@qvac/transcription-whispercpp" {
  export class TranscriptionWhispercpp {
    constructor(args: { modelName: string; loader: any; diskPath: string }, config?: any);
    load(closeLoader?: boolean, onProgress?: (p: any) => void): Promise<void>;
    run(audioStream: any): Promise<{ onUpdate: (cb: (data: any) => void) => { await: () => Promise<void> }; iterate: () => AsyncIterable<any> }>;
    unload(): Promise<void>;
    [key: string]: any;
  }
}

declare module "@qvac/tts-onnx" {
  export default class ONNXTTS {
    constructor(args: { [key: string]: any }, config?: { language?: string; useGPU?: boolean });
    load(closeLoader?: boolean, onProgress?: (p: any) => void): Promise<void>;
    run(params: { input: string; type: 'text' }): Promise<{ onUpdate: (cb: (data: any) => void) => { await: () => Promise<void> }; stats?: any }>;
    unload(): Promise<void>;
    [key: string]: any;
  }
}

declare module "@qvac/dl-filesystem" {
  export default class FilesystemDL {
    constructor(options: { dirPath: string });
    close(): Promise<void>;
    [key: string]: any;
  }
}
