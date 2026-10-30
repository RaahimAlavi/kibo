// src/lib/voiceEngine.ts

export type KiboVoiceName = 'Charon' | 'Aoede' | 'Fenrir' | 'Puck';


export interface SpeakOptions {
  apiKey?: string;
  voice?: KiboVoiceName;
  personality?: string;
  onStart?: () => void;
  onEnd?: () => void;
}

const LIVE_AUDIO_MODELS = [
  'models/gemini-2.0-flash-exp',
  'models/gemini-2.5-flash',
  'models/gemini-2.0-flash',
];

const REST_TTS_MODELS = [
  'gemini-2.5-flash-preview-tts',
  'gemini-3.8-flash-tts',
  'gemini-3.8-flash-lite-tts',
  'gemini-3.1-flash-tts-preview',
];

class KiboVoiceEngine {
  private audioCtx: AudioContext | null = null;
  private nextStartTime: number = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private isSpeakingState: boolean = false;
  private listeners: Set<(speaking: boolean) => void> = new Set();
  private keepAliveTimer: any = null;

  private getAudioContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtx({ sampleRate: 24000 });
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  public onSpeakingStateChange(cb: (speaking: boolean) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  public isSpeaking(): boolean {
    return this.isSpeakingState;
  }

  private setSpeaking(val: boolean) {
    if (this.isSpeakingState === val) return;
    this.isSpeakingState = val;
    this.listeners.forEach((cb) => cb(val));
  }

  // Stop any currently playing speech immediately (barge-in support)
  public stop() {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
    this.activeSources.forEach((src) => {
      try {
        src.stop();
        src.disconnect();
      } catch (_) {}
    });
    this.activeSources = [];
    this.nextStartTime = 0;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      (window as any)._kiboSpeechUtterance = null;
    }
    this.setSpeaking(false);
  }

  // Decode base64 16-bit 24kHz little-endian PCM chunk and schedule gapless playback
  private enqueuePcm24kChunk(base64Pcm: string, onEnd?: () => void) {
    const ctx = this.getAudioContext();
    const binaryStr = atob(base64Pcm);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const samplesCount = Math.floor(len / 2);
    const int16 = new Int16Array(bytes.buffer, bytes.byteOffset, samplesCount);
    const float32 = new Float32Array(samplesCount);
    for (let i = 0; i < samplesCount; i++) {
      float32[i] = int16[i] / 32768.0;
    }

    const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
    audioBuffer.getChannelData(0).set(float32);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const currentTime = ctx.currentTime;
    if (this.nextStartTime < currentTime) {
      this.nextStartTime = currentTime + 0.02;
    }

    source.start(this.nextStartTime);
    this.nextStartTime += audioBuffer.duration;
    this.activeSources.push(source);

    this.setSpeaking(true);

    source.onended = () => {
      this.activeSources = this.activeSources.filter((s) => s !== source);
      if (this.activeSources.length === 0) {
        this.nextStartTime = 0;
        this.setSpeaking(false);
        onEnd?.();
      }
    };
  }

  // Tier 1: Speak or Converse via Unlimited Gemini Live WebSocket API
  public async speakViaLiveAPI(
    promptOrText: string,
    mode: 'SAY_EXACT' | 'CONVERSE',
    options: SpeakOptions = {}
  ): Promise<boolean> {
    const apiKey = options.apiKey || (localStorage.getItem('kibo_gemini_key') || localStorage.getItem('kibo_gemini_key')) || '';
    if (!apiKey) return false;

    const voice: KiboVoiceName = options.voice || 'Charon';
    const personality = options.personality || 'Prime Operator';

    for (const model of LIVE_AUDIO_MODELS) {
      const success = await new Promise<boolean>((resolve) => {
        let resolved = false;
        let receivedAudio = false;

        const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;
        let ws: WebSocket;
        try {
          ws = new WebSocket(wsUrl);
        } catch (_) {
          return resolve(false);
        }

        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            try { ws.close(); } catch (_) {}
            resolve(receivedAudio);
          }
        }, 12000);

        ws.onopen = () => {
          const systemText =
            mode === 'SAY_EXACT'
              ? 'Read the user message aloud verbatim with natural human expression. Do not add extra words.'
              : `You are Kibo, a tactile desktop cyber-droid with a "${personality}" personality. Keep spoken replies under 2 short sentences, crisp, and direct.`;

          // 1. Send Live session setup with prebuilt voice (Charon, Aoede, Fenrir, Puck)
          try {
            ws.send(
              JSON.stringify({
                setup: {
                  model,
                  generationConfig: {
                    responseModalities: ['AUDIO'],
                    speechConfig: {
                      voiceConfig: {
                        prebuiltVoiceConfig: {
                          voiceName: voice,
                        },
                      },
                    },
                  },
                  systemInstruction: {
                    parts: [{ text: systemText }],
                  },
                },
              })
            );
          } catch (_) {
            clearTimeout(timeout);
            if (!resolved) {
              resolved = true;
              resolve(false);
            }
          }
        };

        ws.onmessage = async (event) => {
          try {
            const rawText =
              event.data instanceof Blob ? await event.data.text() : event.data;
            const msg = JSON.parse(rawText);

            // 2. Once setup completes, send the text turn
            if (msg.setupComplete) {
              ws.send(
                JSON.stringify({
                  clientContent: {
                    turns: [
                      {
                        role: 'user',
                        parts: [{ text: promptOrText }],
                      },
                    ],
                    turnComplete: true,
                  },
                })
              );
              return;
            }

            // 3. Stream incoming 24kHz PCM audio chunks immediately
            const parts = msg?.serverContent?.modelTurn?.parts;
            if (Array.isArray(parts)) {
              for (const part of parts) {
                const inline = part?.inlineData;
                if (inline?.data && inline?.mimeType?.startsWith('audio/pcm')) {
                  if (!receivedAudio) {
                    receivedAudio = true;
                    options.onStart?.();
                  }
                  this.enqueuePcm24kChunk(inline.data);
                }
              }
            }

            if (msg?.serverContent?.turnComplete) {
              clearTimeout(timeout);
              resolved = true;
              try { ws.close(); } catch (_) {}
              resolve(receivedAudio);
            }
          } catch (_) {}
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          if (!resolved) {
            resolved = true;
            resolve(false);
          }
        };

        ws.onclose = () => {
          clearTimeout(timeout);
          if (!resolved) {
            resolved = true;
            resolve(receivedAudio);
          }
        };
      });

      if (success) return true;
    }

    return false;
  }

  // Tier 2: Fallback to REST TTS Models
  private async speakViaRestTTS(text: string, options: SpeakOptions = {}): Promise<boolean> {
    const apiKey =
      options.apiKey ||
      (typeof window !== 'undefined'
        ? localStorage.getItem('kibo_gemini_key') || ''
        : '');
    if (!apiKey) return false;

    const voice: KiboVoiceName = options.voice || 'Charon';

    const cleanText = text
      .replace(/[*_#`~[\]]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleanText) {
      options.onEnd?.();
      return true;
    }

    for (const model of REST_TTS_MODELS) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: cleanText }] }],
              generationConfig: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: {
                      voiceName: voice,
                    },
                  },
                },
              },
            }),
          }
        );

        if (!res.ok) continue;
        const data = await res.json();
        const inlineData = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
        if (inlineData?.data) {
          options.onStart?.();
          this.enqueuePcm24kChunk(inlineData.data, options.onEnd);
          return true;
        }
      } catch (_) {}
    }

    return false;
  }

  // Tier 3: Offline / No-Key Native OS Neural Voice Fallback
  private speakViaNativeOS(text: string, options: SpeakOptions = {}) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      options.onEnd?.();
      return;
    }

    window.speechSynthesis.cancel();
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }

    const cleanText = text
      .replace(/[*_#`~[\]]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleanText) {
      options.onEnd?.();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    // Retain global reference so Chromium garbage collection never kills speech mid-sentence
    (window as any)._kiboSpeechUtterance = utterance;

    const voices = window.speechSynthesis.getVoices();

    // Pick high-quality Windows 11 Natural / Online voice if available
    const preferred = voices.find(
      (v) =>
        v.name.includes('Natural') ||
        v.name.includes('Online') ||
        v.name.includes('David') ||
        v.name.includes('Zira') ||
        v.name.includes('Mark')
    );
    if (preferred) utterance.voice = preferred;

    // Match pitch subtly to selected Kibo voice profile
    const voiceProfile = options.voice || 'Charon';
    utterance.pitch =
      voiceProfile === 'Charon' ? 0.95 : voiceProfile === 'Fenrir' ? 0.88 : voiceProfile === 'Aoede' ? 1.08 : 1.02;
    utterance.rate = 1.05;

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (this.keepAliveTimer) {
        clearInterval(this.keepAliveTimer);
        this.keepAliveTimer = null;
      }
      this.setSpeaking(false);
      options.onEnd?.();
      (window as any)._kiboSpeechUtterance = null;
    };

    utterance.onstart = () => {
      this.setSpeaking(true);
      options.onStart?.();

      // Chromium keep-alive to bypass 15-second speech synthesis cutoff bug
      if (this.keepAliveTimer) clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = setInterval(() => {
        if (window.speechSynthesis && window.speechSynthesis.speaking) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        } else {
          finish();
        }
      }, 7000);
    };

    utterance.onend = () => {
      finish();
    };

    utterance.onerror = (e) => {
      console.warn('[Kibo Voice] Speech error or canceled:', e);
      finish();
    };

    window.speechSynthesis.speak(utterance);
  }

  // Main Public Method 1: Speak exact text aloud
  public async speak(text: string, options: SpeakOptions = {}) {
    if (!text || !text.trim()) {
      options.onEnd?.();
      return;
    }
    this.stop();

    const apiKey =
      options.apiKey ||
      (typeof window !== 'undefined'
        ? localStorage.getItem('kibo_gemini_key') || ''
        : '');

    if (apiKey) {
      const ok = await this.speakViaRestTTS(text, { ...options, apiKey });
      if (ok) return;
    }

    // Instant Native OS TTS as offline fallback
    this.speakViaNativeOS(text, options);
  }

  // Main Public Method 2: Ask Kibo a question and have it answer in voice directly
  public async askAndSpeak(userPrompt: string, options: SpeakOptions = {}) {
    if (!userPrompt.trim()) return;
    this.stop();

    const usedLive = await this.speakViaLiveAPI(userPrompt, 'CONVERSE', options);
    if (!usedLive) {
      this.speakViaNativeOS("I'm right here with you. Add your Gemini key in settings for my full Live voice.", options);
    }
  }
}

export const voiceEngine = new KiboVoiceEngine();
