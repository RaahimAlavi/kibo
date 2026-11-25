// src/lib/voiceEngine.ts
import { synthesizeElevenLabsAudio } from './elevenlabs';

export type KiboVoiceName =
  | 'Charon'
  | 'Aoede'
  | 'Fenrir'
  | 'Puck'
  | 'Kore'
  | 'Sarah'
  | 'Alice'
  | 'Lily'
  | 'Charlotte'
  | 'Rachel'
  | 'Jessica'
  | 'George'
  | 'Daniel'
  | 'Adam'
  | 'Brian';

export interface SpeakOptions {
  apiKey?: string;
  voice?: KiboVoiceName;
  personality?: string;
  outputDeviceId?: string;
  onStart?: () => void;
  onEnd?: () => void;
}

// Verified Active Unlimited Quota Live API models from Google AI Studio
const LIVE_AUDIO_MODELS = [
  'models/gemini-3.8-live',
  'models/gemini-3-flash-live',
];

// Verified Active Google Gemini REST TTS Models
const REST_TTS_MODELS = [
  'gemini-3.8-flash-lite-tts',
  'gemini-3.8-flash-tts',
  'gemini-2.5-flash-preview-tts',
];

const deadTtsModels = new Map<string, number>();

function isModelOnCooldown(model: string): boolean {
  const until = deadTtsModels.get(model);
  if (!until) return false;
  if (Date.now() > until) {
    deadTtsModels.delete(model);
    return false;
  }
  return true;
}

function markModelCooldown(model: string, durationMs = 120_000) {
  deadTtsModels.set(model, Date.now() + durationMs);
}

class KiboVoiceEngine {
  private audioCtx: AudioContext | null = null;
  private currentSinkId: string = 'default';
  private nextStartTime: number = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private activeAudioEl: HTMLAudioElement | null = null;
  private activeBlobUrl: string | null = null;
  private isSpeakingState: boolean = false;
  private listeners: Set<(speaking: boolean) => void> = new Set();
  private keepAliveTimer: any = null;
  private activeWs: WebSocket | null = null;
  private speakSessionId: number = 0;
  private pcmStreamStarted: boolean = false;

  private async getAudioContext(sinkId?: string): Promise<AudioContext> {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtx();
    }
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume().catch(() => {});
    }
    const targetSink =
      sinkId ||
      (typeof window !== 'undefined' ? localStorage.getItem('kibo_audio_output_device') || 'default' : 'default');
    if (targetSink && targetSink !== this.currentSinkId && typeof (this.audioCtx as any).setSinkId === 'function') {
      try {
        await (this.audioCtx as any).setSinkId(targetSink === 'default' ? '' : targetSink);
        this.currentSinkId = targetSink;
      } catch (_) {}
    }
    return this.audioCtx;
  }

  public async setOutputDevice(deviceId: string) {
    this.currentSinkId = deviceId;
    if (typeof window !== 'undefined') {
      localStorage.setItem('kibo_audio_output_device', deviceId);
    }
    if (this.audioCtx && typeof (this.audioCtx as any).setSinkId === 'function') {
      try {
        await (this.audioCtx as any).setSinkId(deviceId === 'default' ? '' : deviceId);
      } catch (_) {}
    }
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

  private cleanupAudioEl() {
    if (this.activeAudioEl) {
      try {
        this.activeAudioEl.pause();
        this.activeAudioEl.currentTime = 0;
        this.activeAudioEl.src = '';
      } catch (_) {}
      this.activeAudioEl = null;
    }
    if (this.activeBlobUrl) {
      try {
        URL.revokeObjectURL(this.activeBlobUrl);
      } catch (_) {}
      this.activeBlobUrl = null;
    }
  }

  // Stop any currently playing speech immediately (barge-in support)
  public stop() {
    this.speakSessionId++;
    this.pcmStreamStarted = false;
    this.cleanupAudioEl();
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
    if (this.activeWs) {
      try {
        this.activeWs.close();
      } catch (_) {}
      this.activeWs = null;
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

  // Decode base64 16-bit 24kHz little-endian PCM or WAV audio and schedule gapless, pop-free playback
  private async enqueuePcm24kChunk(base64Audio: string, sinkId?: string, onEnd?: () => void) {
    const ctx = await this.getAudioContext(sinkId);
    const binaryStr = atob(base64Audio);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    // Strip RIFF / WAVE header if present (standard 44 bytes or search for 'data' chunk)
    let pcmOffset = 0;
    if (len >= 44 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
      for (let i = 12; i < Math.min(len - 8, 200); i++) {
        if (bytes[i] === 0x64 && bytes[i + 1] === 0x61 && bytes[i + 2] === 0x74 && bytes[i + 3] === 0x61) {
          pcmOffset = i + 8;
          break;
        }
      }
      if (pcmOffset === 0) pcmOffset = 44;
    }

    const rawLen = len - pcmOffset;
    const samplesCount = Math.floor(rawLen / 2);
    if (samplesCount <= 0) {
      onEnd?.();
      return;
    }

    const int16 = new Int16Array(bytes.buffer, bytes.byteOffset + pcmOffset, samplesCount);
    const float32 = new Float32Array(samplesCount);
    for (let i = 0; i < samplesCount; i++) {
      float32[i] = int16[i] / 32768.0;
    }

    const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
    audioBuffer.getChannelData(0).set(float32);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;

    const currentTime = ctx.currentTime;
    const isFreshStart = !this.pcmStreamStarted || this.nextStartTime < currentTime;
    if (this.nextStartTime < currentTime) {
      // 60ms jitter buffer ensures packet arrival jitter does not create playback gaps
      this.nextStartTime = currentTime + 0.06;
    }

    const gainNode = ctx.createGain();
    const startTime = this.nextStartTime;
    // Only apply a subtle 4ms fade-in on the start of a stream; never dip gain between contiguous chunks
    if (isFreshStart) {
      this.pcmStreamStarted = true;
      gainNode.gain.setValueAtTime(0.0001, startTime);
      gainNode.gain.linearRampToValueAtTime(1.0, startTime + 0.004);
    } else {
      gainNode.gain.setValueAtTime(1.0, startTime);
    }

    source.connect(gainNode);
    gainNode.connect(ctx.destination);

    source.start(this.nextStartTime);
    this.nextStartTime += audioBuffer.duration;
    this.activeSources.push(source);

    this.setSpeaking(true);

    source.onended = () => {
      this.activeSources = this.activeSources.filter((s) => s !== source);
      try {
        source.disconnect();
        gainNode.disconnect();
      } catch (_) {}
      if (this.activeSources.length === 0 && !this.activeWs) {
        this.nextStartTime = 0;
        this.pcmStreamStarted = false;
        this.setSpeaking(false);
        onEnd?.();
      }
    };
  }

  // Tier 1: Speak or Converse via Unlimited Gemini Live WebSocket API (gemini-3.8-live, gemini-3-flash-live, gemini-2.5-flash-native-audio-dialog)
  public async speakViaLiveAPI(
    promptOrText: string,
    mode: 'SAY_EXACT' | 'CONVERSE',
    options: SpeakOptions = {}
  ): Promise<boolean> {
    const apiKey =
      options.apiKey ||
      (typeof window !== 'undefined' ? localStorage.getItem('kibo_gemini_key') || '' : '');
    if (!apiKey) return false;

    const savedVoice =
      typeof window !== 'undefined' ? (localStorage.getItem('kibo_voice_name') as KiboVoiceName) : null;
    const voice: KiboVoiceName = options.voice || savedVoice || 'Aoede';
    const personality = options.personality || 'Prime Operator';

    const cleanText = promptOrText
      .replace(/[*_#`~[\]]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleanText) {
      options.onEnd?.();
      return true;
    }

    for (const model of LIVE_AUDIO_MODELS) {
      if (isModelOnCooldown(model)) continue;

      const success = await new Promise<boolean>((resolve) => {
        let resolved = false;
        let receivedAudio = false;

        const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(apiKey.trim())}`;
        let ws: WebSocket;
        try {
          ws = new WebSocket(wsUrl);
          this.activeWs = ws;
        } catch (_) {
          return resolve(false);
        }

        const firstChunkTimeout = setTimeout(() => {
          if (!receivedAudio && !resolved) {
            resolved = true;
            this.activeWs = null;
            markModelCooldown(model, 120_000);
            try {
              ws.close();
            } catch (_) {}
            resolve(false);
          }
        }, 2200);

        const totalTimeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            this.activeWs = null;
            try {
              ws.close();
            } catch (_) {}
            resolve(receivedAudio);
          }
        }, 15000);

        ws.onopen = () => {
          const systemText =
            mode === 'SAY_EXACT'
              ? 'You are a high-precision voice synthesizer. Speak the exact text provided by the user aloud with warm, natural expression. Never add introductory words, never answer questions, only read the exact text verbatim.'
              : `You are Kibo, a fast desktop companion with a "${personality}" personality. Keep spoken replies under 2 short sentences, natural and direct.`;

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
            clearTimeout(firstChunkTimeout);
            clearTimeout(totalTimeout);
            if (!resolved) {
              resolved = true;
              this.activeWs = null;
              resolve(false);
            }
          }
        };

        ws.onmessage = async (event) => {
          try {
            const rawText = event.data instanceof Blob ? await event.data.text() : event.data;
            const msg = JSON.parse(rawText);

            if (msg.error) {
              markModelCooldown(model, 120_000);
              clearTimeout(firstChunkTimeout);
              clearTimeout(totalTimeout);
              if (!resolved) {
                resolved = true;
                this.activeWs = null;
                try {
                  ws.close();
                } catch (_) {}
                resolve(false);
              }
              return;
            }

            if (msg.setupComplete) {
              ws.send(
                JSON.stringify({
                  clientContent: {
                    turns: [
                      {
                        role: 'user',
                        parts: [
                          {
                            text:
                              mode === 'SAY_EXACT'
                                ? `Read this exact line aloud verbatim: "${cleanText}"`
                                : cleanText,
                          },
                        ],
                      },
                    ],
                    turnComplete: true,
                  },
                })
              );
              return;
            }

            const parts = msg?.serverContent?.modelTurn?.parts;
            if (Array.isArray(parts)) {
              for (const part of parts) {
                const inline = part?.inlineData;
                if (inline?.data && (!inline.mimeType || inline.mimeType.startsWith('audio/'))) {
                  if (!receivedAudio) {
                    receivedAudio = true;
                    clearTimeout(firstChunkTimeout);
                    options.onStart?.();
                  }
                  await this.enqueuePcm24kChunk(inline.data, options.outputDeviceId, options.onEnd);
                }
              }
            }

            if (msg?.serverContent?.turnComplete) {
              clearTimeout(firstChunkTimeout);
              clearTimeout(totalTimeout);
              this.activeWs = null;
              if (!resolved) {
                resolved = true;
                try {
                  ws.close();
                } catch (_) {}
                if (this.activeSources.length === 0) {
                  this.setSpeaking(false);
                  options.onEnd?.();
                }
                resolve(receivedAudio);
              }
            }
          } catch (_) {}
        };

        ws.onerror = () => {
          clearTimeout(firstChunkTimeout);
          clearTimeout(totalTimeout);
          this.activeWs = null;
          if (!resolved) {
            resolved = true;
            resolve(receivedAudio);
          }
        };

        ws.onclose = () => {
          clearTimeout(firstChunkTimeout);
          clearTimeout(totalTimeout);
          this.activeWs = null;
          if (!resolved) {
            resolved = true;
            if (receivedAudio && this.activeSources.length === 0) {
              this.setSpeaking(false);
              options.onEnd?.();
            }
            resolve(receivedAudio);
          }
        };
      });

      if (success) return true;
    }

    return false;
  }

  // Tier 2: Dedicated Google Gemini REST TTS Models (gemini-3.1-flash-preview-tts, gemini-3.8-flash-lite-preview-tts, gemini-2.5-flash-preview-tts)
  private async speakViaRestTTS(text: string, options: SpeakOptions = {}): Promise<boolean> {
    const apiKey =
      options.apiKey ||
      (typeof window !== 'undefined' ? localStorage.getItem('kibo_gemini_key') || '' : '');
    if (!apiKey) return false;

    const savedVoice =
      typeof window !== 'undefined' ? (localStorage.getItem('kibo_voice_name') as KiboVoiceName) : null;
    const voice: KiboVoiceName = options.voice || savedVoice || 'Aoede';

    const cleanText = text
      .replace(/[*_#`~[\]]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleanText) {
      options.onEnd?.();
      return true;
    }

    for (const model of REST_TTS_MODELS) {
      if (isModelOnCooldown(model)) continue;

      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey.trim())}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(9000),
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

        if (res.status === 429 || res.status === 404 || res.status === 400) {
          markModelCooldown(model, res.status === 404 ? 600_000 : 120_000);
          continue;
        }

        if (!res.ok) continue;
        const data = await res.json();
        const inlineData = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
        if (inlineData?.data) {
          options.onStart?.();
          await this.enqueuePcm24kChunk(inlineData.data, options.outputDeviceId, options.onEnd);
          return true;
        }
      } catch (_) {}
    }

    return false;
  }

  // Tier 3: Last-Resort Offline OS Neural Voice (only if API key is missing or offline)
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

    const sentences =
      cleanText
        .match(/[^.!?]+[.!?]+|\s*[^.!?]+$/g)
        ?.map((s) => s.trim())
        .filter(Boolean) || [cleanText];
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(
      (v) =>
        v.name.includes('Natural') ||
        v.name.includes('Online') ||
        v.name.includes('Aria') ||
        v.name.includes('Jenny') ||
        v.name.includes('Guy')
    );

    const savedVoice =
      typeof window !== 'undefined' ? (localStorage.getItem('kibo_voice_name') as KiboVoiceName) : null;
    const voiceProfile = options.voice || savedVoice || 'Aoede';
    const pitch =
      voiceProfile === 'Charon' ? 0.95 : voiceProfile === 'Fenrir' ? 0.88 : voiceProfile === 'Aoede' ? 1.06 : 1.02;

    let currentIdx = 0;
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

    const speakNextChunk = () => {
      if (currentIdx >= sentences.length) {
        finish();
        return;
      }

      const chunk = sentences[currentIdx++];
      const utterance = new SpeechSynthesisUtterance(chunk);
      (window as any)._kiboSpeechUtterance = utterance;

      if (preferred) utterance.voice = preferred;
      utterance.pitch = pitch;
      utterance.rate = 1.05;

      utterance.onstart = () => {
        this.setSpeaking(true);
        if (currentIdx === 1) {
          options.onStart?.();
        }
      };

      utterance.onend = () => {
        if (currentIdx < sentences.length) {
          speakNextChunk();
        } else {
          finish();
        }
      };

      utterance.onerror = () => {
        if (currentIdx < sentences.length) {
          speakNextChunk();
        } else {
          finish();
        }
      };

      window.speechSynthesis.speak(utterance);
    };

    speakNextChunk();
  }

  private playAudioBufferElement(
    arrayBuffer: ArrayBuffer,
    outputDeviceId?: string,
    onFirstStart?: () => void
  ): Promise<boolean> {
    return new Promise<boolean>(async (resolve) => {
      this.cleanupAudioEl();
      const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      this.activeBlobUrl = url;

      const audio = new Audio(url);
      this.activeAudioEl = audio;

      const targetSink =
        outputDeviceId ||
        (typeof window !== 'undefined' ? localStorage.getItem('kibo_audio_output_device') || 'default' : 'default');

      if (targetSink && targetSink !== 'default' && typeof (audio as any).setSinkId === 'function') {
        try {
          await (audio as any).setSinkId(targetSink);
        } catch (_) {}
      }

      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        this.cleanupAudioEl();
        resolve(ok);
      };

      audio.onplay = () => {
        this.setSpeaking(true);
        onFirstStart?.();
      };
      audio.onended = () => finish(true);
      audio.onerror = (e) => {
        console.warn('[ElevenLabs Audio] Playback error:', e);
        finish(false);
      };
      audio.play().catch((err) => {
        console.warn('[ElevenLabs Audio] play() rejected:', err);
        finish(false);
      });
    });
  }

  // Tier 0: ElevenLabs AI Studio Voice Synthesis with sentence pipelining for fast start & smooth audio
  public async speakViaElevenLabs(
    text: string,
    options: SpeakOptions = {}
  ): Promise<boolean> {
    const cleanText = text
      .replace(/[*_#`~[\]]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleanText) {
      options.onEnd?.();
      return true;
    }

    const savedVoice =
      typeof window !== 'undefined' ? (localStorage.getItem('kibo_voice_name') as KiboVoiceName) : null;
    const voice = options.voice || savedVoice || 'Sarah';
    const sessionId = this.speakSessionId;

    // Split longer replies into 2-3 natural sentence chunks so sentence 1 starts speaking while sentence 2 synthesizes
    const rawSentences =
      cleanText.length > 120
        ? cleanText
            .match(/[^.!?]+[.!?]+|[^.!?]+$/g)
            ?.map((s) => s.trim())
            .filter(Boolean) || [cleanText]
        : [cleanText];

    const chunks: string[] = [];
    for (const s of rawSentences) {
      if (chunks.length > 0 && (chunks[chunks.length - 1].length < 45 || chunks.length >= 3)) {
        chunks[chunks.length - 1] = `${chunks[chunks.length - 1]} ${s}`;
      } else {
        chunks.push(s);
      }
    }

    try {
      let nextPromise: Promise<ArrayBuffer | null> | null = synthesizeElevenLabsAudio(chunks[0], voice);
      let startedNotified = false;

      for (let i = 0; i < chunks.length; i++) {
        if (this.speakSessionId !== sessionId) return true;
        const currentBuf = await nextPromise;
        if (this.speakSessionId !== sessionId) return true;

        if (!currentBuf || currentBuf.byteLength === 0) {
          if (i === 0) return false;
          break;
        }

        // Pre-fetch next sentence in parallel while current sentence plays
        nextPromise = i + 1 < chunks.length ? synthesizeElevenLabsAudio(chunks[i + 1], voice) : null;

        const ok = await this.playAudioBufferElement(currentBuf, options.outputDeviceId, () => {
          if (!startedNotified) {
            startedNotified = true;
            options.onStart?.();
          }
        });
        if (!ok) {
          if (i === 0) {
            this.setSpeaking(false);
            return false;
          }
          break;
        }
      }

      if (this.speakSessionId === sessionId) {
        this.setSpeaking(false);
        options.onEnd?.();
      }
      return true;
    } catch (err) {
      console.warn('[ElevenLabs Engine] Synthesis/playback failed:', err);
      this.setSpeaking(false);
      return false;
    }
  }

  // Main Public Method 1: Speak exact text aloud using ElevenLabs AI Voices -> REST TTS -> Gemini Live -> Offline Fallback
  public async speak(text: string, options: SpeakOptions = {}) {
    if (!text || !text.trim()) {
      options.onEnd?.();
      return;
    }
    this.stop();

    // 0. Primary: ElevenLabs Studio Voice AI (Ultra-clean, lifelike, 100% gapless, zero jitter)
    const okEleven = await this.speakViaElevenLabs(text, options);
    if (okEleven) return;

    const apiKey =
      options.apiKey ||
      (typeof window !== 'undefined' ? localStorage.getItem('kibo_gemini_key') || '' : '');

    if (apiKey) {
      // 1. Secondary: Single-payload Google Gemini REST TTS Models (~600ms latency, zero WebSocket chunk jitter)
      const okRest = await this.speakViaRestTTS(text, { ...options, apiKey });
      if (okRest) return;

      // 2. Tertiary: Streaming Gemini Live API
      const okLive = await this.speakViaLiveAPI(text, 'SAY_EXACT', { ...options, apiKey });
      if (okLive) return;
    }

    // 3. Offline native OS fallback
    this.speakViaNativeOS(text, options);
  }

  // Main Public Method 2: Ask Kibo a question and have it answer in voice directly
  public async askAndSpeak(userPrompt: string, options: SpeakOptions = {}) {
    if (!userPrompt.trim()) return;
    this.stop();

    const usedLive = await this.speakViaLiveAPI(userPrompt, 'CONVERSE', options);
    if (!usedLive) {
      this.speakViaNativeOS('I am ready. Check your Gemini API key in Settings to enable Google Live voices.', options);
    }
  }
}

export const voiceEngine = new KiboVoiceEngine();
