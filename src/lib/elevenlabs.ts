// src/lib/elevenlabs.ts
// ElevenLabs High-Fidelity Voice Synthesis Bridge

export interface ElevenLabsVoiceOption {
  id: string;
  name: string;
  gender: 'female' | 'male';
  preview: string;
  description: string;
}

export const ELEVENLABS_VOICES: ElevenLabsVoiceOption[] = [
  {
    id: 'EXAVITQu4vr4xnSDxMaL',
    name: 'Sarah',
    gender: 'female',
    preview: 'Soft, clear, and reassuring',
    description: 'Gentle, modern, and natural female voice',
  },
  {
    id: 'XB0fDUnXU5powFXDhCwa',
    name: 'Charlotte',
    gender: 'female',
    preview: 'Conversational, warm, and friendly',
    description: 'Crisp conversational female voice',
  },
  {
    id: '21m00Tcm4TlvDq8ikWAM',
    name: 'Rachel',
    gender: 'female',
    preview: 'Calm, confident, and professional',
    description: 'Smooth, composed female voice',
  },
  {
    id: 'cgSgspJ2msm6clMCkdW9',
    name: 'Jessica',
    gender: 'female',
    preview: 'Expressive, playful, and bright',
    description: 'Energetic and dynamic female voice',
  },
  {
    id: 'JBFqnCBsd6RMkjVDRZzb',
    name: 'George',
    gender: 'male',
    preview: 'Warm, narrative, and engaging',
    description: 'Natural British storytelling voice',
  },
  {
    id: 'onwK4e9ZLuTAKqWW03F9',
    name: 'Daniel',
    gender: 'male',
    preview: 'Authoritative, crisp, and deep',
    description: 'Deep, clear announcer voice',
  },
  {
    id: 'pNInz6obpgDQGcFmaJgB',
    name: 'Adam',
    gender: 'male',
    preview: 'Smooth, balanced, and approachable',
    description: 'Warm American conversational male voice',
  },
  {
    id: 'nPczCjzI2devNBz1zQrb',
    name: 'Brian',
    gender: 'male',
    preview: 'Rich, comforting, and resonant',
    description: 'Resonant and expressive male voice',
  },
];

export const ELEVENLABS_VOICE_MAP: Record<string, string> = {
  // ElevenLabs Standard Voice Names
  Sarah: 'EXAVITQu4vr4xnSDxMaL',
  Charlotte: 'XB0fDUnXU5powFXDhCwa',
  Rachel: '21m00Tcm4TlvDq8ikWAM',
  Jessica: 'cgSgspJ2msm6clMCkdW9',
  George: 'JBFqnCBsd6RMkjVDRZzb',
  Daniel: 'onwK4e9ZLuTAKqWW03F9',
  Adam: 'pNInz6obpgDQGcFmaJgB',
  Brian: 'nPczCjzI2devNBz1zQrb',

  // Loadout Card ID Mappings
  voice_sarah: 'EXAVITQu4vr4xnSDxMaL',
  voice_charlotte: 'XB0fDUnXU5powFXDhCwa',
  voice_rachel: '21m00Tcm4TlvDq8ikWAM',
  voice_jessica: 'cgSgspJ2msm6clMCkdW9',
  voice_george: 'JBFqnCBsd6RMkjVDRZzb',
  voice_daniel: 'onwK4e9ZLuTAKqWW03F9',
  voice_adam: 'pNInz6obpgDQGcFmaJgB',
  voice_brian: 'nPczCjzI2devNBz1zQrb',

  // Neural Persona mappings to ElevenLabs counterparts
  Charon: 'onwK4e9ZLuTAKqWW03F9',
  Aoede: 'EXAVITQu4vr4xnSDxMaL',
  Fenrir: 'nPczCjzI2devNBz1zQrb',
  Puck: 'cgSgspJ2msm6clMCkdW9',
  Kore: 'XB0fDUnXU5powFXDhCwa',
  voice_charon: 'onwK4e9ZLuTAKqWW03F9',
  voice_aoede: 'EXAVITQu4vr4xnSDxMaL',
  voice_fenrir: 'nPczCjzI2devNBz1zQrb',
  voice_puck: 'cgSgspJ2msm6clMCkdW9',
  voice_kore: 'XB0fDUnXU5powFXDhCwa',
};

export async function synthesizeElevenLabsAudio(
  text: string,
  voiceIdentifier?: string
): Promise<ArrayBuffer | null> {
  const clean = String(text || '')
    .replace(/[*_#`~[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return null;

  const targetVoiceId =
    ELEVENLABS_VOICE_MAP[voiceIdentifier || ''] ||
    voiceIdentifier ||
    'EXAVITQu4vr4xnSDxMaL';

  // 1. Electron Desktop IPC Bridge
  if (typeof window !== 'undefined' && (window as any).kiboAPI?.elevenlabsSpeak) {
    try {
      const storedKey = localStorage.getItem('kibo_elevenlabs_key') || '';
      const base64Audio = await (window as any).kiboAPI.elevenlabsSpeak({
        text: clean,
        voiceId: targetVoiceId,
        modelId: 'eleven_flash_v2_5',
        apiKey: storedKey,
      });
      if (base64Audio && typeof base64Audio === 'string') {
        const binary = atob(base64Audio);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
      }
    } catch (err) {
      console.warn('[ElevenLabs] Electron IPC synthesis failed:', err);
    }
  }

  // 2. Vite Dev Server Middleware Endpoint Fallback
  try {
    const storedKey = typeof window !== 'undefined' ? localStorage.getItem('kibo_elevenlabs_key') || '' : '';
    const res = await fetch('/api/elevenlabs-tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: clean,
        voiceId: targetVoiceId,
        modelId: 'eleven_flash_v2_5',
        apiKey: storedKey,
      }),
    });
    if (res.ok) {
      return await res.arrayBuffer();
    }
  } catch (_) {}

  return null;
}
