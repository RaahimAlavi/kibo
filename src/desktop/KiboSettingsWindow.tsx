// src/desktop/KiboSettingsWindow.tsx
// Phase 2 Minimal macOS-Style Settings Window (Zero Neon, Classic vs Floating Notch Preview, Gaming Focus Shield)
import React, { useEffect, useState } from 'react';
import { KiboDropdown } from '../components/KiboDropdown';
import { voiceEngine, KiboVoiceName } from '../lib/voiceEngine';
import { soundFX } from '../lib/soundFX';
import { SOUL_SKINS } from '../lib/soulMath';
import { GameHudConfig, DEFAULT_GAME_HUD_CONFIG } from '../components/KiboGameStatsHud';
import { KiboLogoIcon } from '../components/KiboLogoIcon';

type SettingsSection = 'Appearance' | 'GameHud' | 'General' | 'Voice' | 'Shortcuts' | 'Account' | 'About';

interface ShortcutsConfigState {
  ask: string;
  dictate: string;
  lasso: string;
  askEnabled: boolean;
  dictateEnabled: boolean;
  lassoEnabled: boolean;
  gamingShield: boolean;
  holdDelayMs: number;
  pausedAll: boolean;
}

const DEFAULT_SHORTCUTS: ShortcutsConfigState = {
  ask: 'Win + Alt',
  dictate: 'Ctrl + Win',
  lasso: 'Ctrl + Shift',
  askEnabled: true,
  dictateEnabled: true,
  lassoEnabled: true,
  gamingShield: true,
  holdDelayMs: 260,
  pausedAll: false,
};

const VOICE_OPTIONS = [
  { value: 'voice_sarah', label: 'Sarah', sublabel: 'Natural & Soft', group: 'ElevenLabs AI Voices' },
  { value: 'voice_alice', label: 'Alice', sublabel: 'Clear & Articulate', group: 'ElevenLabs AI Voices' },
  { value: 'voice_lily', label: 'Lily', sublabel: 'Velvety & Expressive', group: 'ElevenLabs AI Voices' },
  { value: 'voice_jessica', label: 'Jessica', sublabel: 'Playful & Bright', group: 'ElevenLabs AI Voices' },
  { value: 'voice_george', label: 'George', sublabel: 'Narrative British', group: 'ElevenLabs AI Voices' },
  { value: 'voice_daniel', label: 'Daniel', sublabel: 'Deep & Crisp', group: 'ElevenLabs AI Voices' },
  { value: 'voice_brian', label: 'Brian', sublabel: 'Deep & Resonant', group: 'ElevenLabs AI Voices' },
  { value: 'voice_adam', label: 'Adam', sublabel: 'Smooth American', group: 'ElevenLabs AI Voices' },
  { value: 'voice_charon', label: 'Charon', sublabel: 'Tactical Synth', group: 'Google Neural Voices' },
  { value: 'voice_aoede', label: 'Aoede', sublabel: 'Expressive', group: 'Google Neural Voices' },
  { value: 'voice_fenrir', label: 'Fenrir', sublabel: 'Sub-Bass', group: 'Google Neural Voices' },
  { value: 'voice_puck', label: 'Puck', sublabel: 'Kinetic', group: 'Google Neural Voices' },
  { value: 'voice_kore', label: 'Kore', sublabel: 'Balanced', group: 'Google Neural Voices' },
];

const VOICE_ID_TO_NAME: Record<string, KiboVoiceName> = {
  voice_sarah: 'Sarah',
  voice_alice: 'Alice',
  voice_lily: 'Lily',
  voice_jessica: 'Jessica',
  voice_george: 'George',
  voice_daniel: 'Daniel',
  voice_brian: 'Brian',
  voice_adam: 'Adam',
  voice_charlotte: 'Alice',
  voice_rachel: 'Lily',
  voice_charon: 'Charon',
  voice_aoede: 'Aoede',
  voice_fenrir: 'Fenrir',
  voice_puck: 'Puck',
  voice_kore: 'Kore',
};

const NAME_TO_VOICE_ID: Record<string, string> = {
  Sarah: 'voice_sarah',
  Alice: 'voice_alice',
  Lily: 'voice_lily',
  Jessica: 'voice_jessica',
  George: 'voice_george',
  Daniel: 'voice_daniel',
  Brian: 'voice_brian',
  Adam: 'voice_adam',
  Charlotte: 'voice_alice',
  Rachel: 'voice_lily',
  Charon: 'voice_charon',
  Aoede: 'voice_aoede',
  Fenrir: 'voice_fenrir',
  Puck: 'voice_puck',
  Kore: 'voice_kore',
};

function normalizeVoiceCardId(rawId?: string, rawName?: string): string {
  if (rawId === 'voice_charlotte') return 'voice_alice';
  if (rawId === 'voice_rachel') return 'voice_lily';
  if (rawId && VOICE_OPTIONS.some((v) => v.value === rawId)) return rawId;
  if (rawName && NAME_TO_VOICE_ID[rawName]) return NAME_TO_VOICE_ID[rawName];
  return 'voice_sarah';
}

function normalizeSection(raw?: string): SettingsSection {
  if (!raw) return 'Appearance';
  if (raw === 'Core') return 'Appearance';
  const valid: SettingsSection[] = ['Appearance', 'GameHud', 'General', 'Voice', 'Shortcuts', 'Account', 'About'];
  return valid.includes(raw as SettingsSection) ? (raw as SettingsSection) : 'Appearance';
}

export const KiboSettingsWindow: React.FC<{ initialSection?: string }> = ({
  initialSection = 'Appearance',
}) => {
  const api = (window as any).kiboAPI;

  const [section, setSection] = useState<SettingsSection>(() => normalizeSection(initialSection));

  // Phase 2 Appearance states
  const [notchStyle, setNotchStyle] = useState<'classic' | 'floating'>(() =>
    localStorage.getItem('kibo_notch_style') === 'floating' ? 'floating' : 'classic'
  );
  const [glassEnabled, setGlassEnabled] = useState<boolean>(() => localStorage.getItem('kibo_glass_enabled') !== 'false');
  const [glassTint, setGlassTint] = useState<number>(() => {
    const raw = parseInt(localStorage.getItem('kibo_glass_tint') || '20', 10);
    return isNaN(raw) ? 20 : Math.min(90, Math.max(10, raw));
  });
  const [notchTrigger, setNotchTrigger] = useState<'hover' | 'click'>(() =>
    localStorage.getItem('kibo_notch_trigger') === 'click' ? 'click' : 'hover'
  );
  const [animSpeed, setAnimSpeed] = useState<'smooth' | 'snappy' | 'bouncy'>(() => {
    const raw = localStorage.getItem('kibo_anim_speed');
    return raw === 'snappy' || raw === 'bouncy' ? raw : 'smooth';
  });
  const [selectedSkinKey, setSelectedSkinKey] = useState<string>(
    () => localStorage.getItem('kibo_chassis') || SOUL_SKINS[0]?.key || 'kibo_mk1_cobalt'
  );

  // Account & Keys states
  const [userName, setUserName] = useState<string>(() => localStorage.getItem('kibo_user_name') || '');
  const [geminiDraft, setGeminiDraft] = useState<string>(() => localStorage.getItem('kibo_gemini_key') || '');
  const [elevenDraft, setElevenDraft] = useState<string>(() => localStorage.getItem('kibo_elevenlabs_key') || '');
  const [geminiSaved, setGeminiSaved] = useState(false);
  const [elevenSaved, setElevenSaved] = useState(false);

  // General states
  const [autoTuck, setAutoTuck] = useState<boolean>(() => localStorage.getItem('kibo_autotuck') !== 'false');
  const [autoHideFs, setAutoHideFs] = useState<boolean>(() => localStorage.getItem('kibo_auto_hide_fullscreen') === 'true');
  const [launchStartup, setLaunchStartup] = useState<boolean>(() => localStorage.getItem('kibo_startup') !== 'false');
  const [showTaskbar, setShowTaskbar] = useState<boolean>(() => localStorage.getItem('kibo_show_taskbar') === 'true');
  const [sfxEnabled, setSfxEnabled] = useState<boolean>(() => soundFX.isEnabled());
  const [volumeHudEnabled, setVolumeHudEnabled] = useState<boolean>(
    () => localStorage.getItem('kibo_volume_hud_enabled') !== 'false'
  );

  // Phase 3 Game Stats HUD config
  const [gameHud, setGameHud] = useState<GameHudConfig>(() => {
    try {
      const raw = localStorage.getItem('kibo_game_hud_config');
      if (raw) return { ...DEFAULT_GAME_HUD_CONFIG, ...JSON.parse(raw) };
    } catch (_) {}
    return DEFAULT_GAME_HUD_CONFIG;
  });

  const persistGameHud = (patch: Partial<GameHudConfig>) => {
    setGameHud((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem('kibo_game_hud_config', JSON.stringify(next));
      api?.saveStoredSettings?.({ kibo_game_hud_config: next });
      return next;
    });
  };

  // Voice & Audio states
  const [voiceCardId, setVoiceCardId] = useState<string>(() =>
    normalizeVoiceCardId(localStorage.getItem('kibo_loadout_voice') || undefined, localStorage.getItem('kibo_voice_name') || undefined)
  );
  const [elevenModel, setElevenModel] = useState<string>(() => localStorage.getItem('kibo_elevenlabs_model') || 'eleven_turbo_v2_5');
  const [voiceTts, setVoiceTts] = useState<boolean>(() => localStorage.getItem('kibo_voice_tts') !== 'false');
  const [isTestingVoice, setIsTestingVoice] = useState(false);
  const [outputDevices, setOutputDevices] = useState<Array<{ deviceId: string; label: string }>>([
    { deviceId: 'default', label: 'System Default Speaker' },
  ]);
  const [inputDevices, setInputDevices] = useState<Array<{ deviceId: string; label: string }>>([
    { deviceId: 'default', label: 'System Default Microphone' },
  ]);
  const [speakerId, setSpeakerId] = useState<string>(() => localStorage.getItem('kibo_output_device_id') || 'default');
  const [micId, setMicId] = useState<string>(() => localStorage.getItem('kibo_mic_device_id') || 'default');
  const [equippedCards, setEquippedCards] = useState<Record<string, string>>({
    Soul: 'soul_kibo_mk1',
    Voice: 'voice_sarah',
    Personality: 'pers_prime',
    Abilities: 'none',
  });

  // Shortcuts & Gaming Focus Shield states
  const [shortcuts, setShortcuts] = useState<ShortcutsConfigState>(DEFAULT_SHORTCUTS);

  const persistShortcuts = (next: ShortcutsConfigState) => {
    setShortcuts(next);
    api?.updateShortcuts?.(next);
  };

  useEffect(() => {
    document.documentElement.style.background = '#1A1A1D';
    document.body.style.background = '#1A1A1D';
    document.body.style.margin = '0';
    document.body.style.overflow = 'hidden';

    api?.getStoredSettings?.().then((s: Record<string, any>) => {
      if (!s || typeof s !== 'object') return;
      if (s.kibo_notch_style === 'classic' || s.kibo_notch_style === 'floating') setNotchStyle(s.kibo_notch_style);
      if (typeof s.kibo_glass_enabled === 'boolean') setGlassEnabled(s.kibo_glass_enabled);
      if (typeof s.kibo_glass_tint === 'number') setGlassTint(Math.min(90, Math.max(10, Math.round(s.kibo_glass_tint))));
      if (s.kibo_notch_trigger === 'hover' || s.kibo_notch_trigger === 'click') setNotchTrigger(s.kibo_notch_trigger);
      if (s.kibo_anim_speed === 'smooth' || s.kibo_anim_speed === 'snappy' || s.kibo_anim_speed === 'bouncy') {
        setAnimSpeed(s.kibo_anim_speed);
      }
      if (typeof s.kibo_user_name === 'string') setUserName(s.kibo_user_name);
      if (typeof s.kibo_gemini_key === 'string') setGeminiDraft(s.kibo_gemini_key);
      if (typeof s.kibo_elevenlabs_key === 'string') setElevenDraft(s.kibo_elevenlabs_key);
      if (typeof s.kibo_autotuck === 'boolean') setAutoTuck(s.kibo_autotuck);
      if (typeof s.kibo_auto_hide_fullscreen === 'boolean') setAutoHideFs(s.kibo_auto_hide_fullscreen);
      if (typeof s.kibo_show_taskbar === 'boolean') setShowTaskbar(s.kibo_show_taskbar);
      if (typeof s.kibo_sfx_enabled === 'boolean') setSfxEnabled(s.kibo_sfx_enabled);
      if (typeof s.kibo_volume_hud_enabled === 'boolean') setVolumeHudEnabled(s.kibo_volume_hud_enabled);
      if (s.kibo_game_hud_config && typeof s.kibo_game_hud_config === 'object') {
        setGameHud({ ...DEFAULT_GAME_HUD_CONFIG, ...s.kibo_game_hud_config });
      }
      if (typeof s.kibo_voice_tts === 'boolean') setVoiceTts(s.kibo_voice_tts);
      if (typeof s.kibo_elevenlabs_model === 'string') setElevenModel(s.kibo_elevenlabs_model);
      if (typeof s.kibo_chassis === 'string') setSelectedSkinKey(s.kibo_chassis);
      if (typeof s.kibo_output_device_id === 'string') setSpeakerId(s.kibo_output_device_id);
      if (typeof s.kibo_mic_device_id === 'string') setMicId(s.kibo_mic_device_id);
      if (s.kibo_equipped_cards && typeof s.kibo_equipped_cards === 'object') {
        setEquippedCards(s.kibo_equipped_cards);
      }
      setVoiceCardId(
        normalizeVoiceCardId(s.kibo_equipped_cards?.Voice || s.kibo_loadout_voice, s.kibo_voice_name)
      );
      if (s.kibo_shortcuts_config && typeof s.kibo_shortcuts_config === 'object') {
        setShortcuts({ ...DEFAULT_SHORTCUTS, ...s.kibo_shortcuts_config });
      }
    }).catch(() => {});

    api?.getShortcuts?.().then((sc: any) => {
      if (sc && typeof sc === 'object') {
        setShortcuts({ ...DEFAULT_SHORTCUTS, ...sc });
      }
    }).catch(() => {});

    api?.getStartupSetting?.().then((enabled: boolean) => {
      if (typeof enabled === 'boolean') setLaunchStartup(enabled);
    }).catch(() => {});

    if (navigator.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then((list) => {
        const outs = list
          .filter((d) => d.kind === 'audiooutput')
          .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Speaker ${i + 1}` }));
        const ins = list
          .filter((d) => d.kind === 'audioinput')
          .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${i + 1}` }));
        if (outs.length > 0) setOutputDevices(outs);
        if (ins.length > 0) setInputDevices(ins);
      }).catch(() => {});
    }

    const unregNav = api?.onSettingsNavigate?.((next: string) => {
      setSection(normalizeSection(next));
    });
    const unregSync = api?.onSettingsSynced?.((patch: Record<string, any>) => {
      if (patch?.kibo_shortcuts_config) {
        setShortcuts((prev) => ({ ...prev, ...patch.kibo_shortcuts_config }));
      }
    });
    return () => {
      unregNav?.();
      unregSync?.();
      voiceEngine.stop();
    };
  }, []);

  const previewVoice = (cardId: string) => {
    const vName = VOICE_ID_TO_NAME[cardId] || 'Sarah';
    setIsTestingVoice(true);
    voiceEngine.speak(`Hello, I am ${vName}. Ready to help.`, {
      voice: vName,
      outputDeviceId: speakerId,
      onEnd: () => setIsTestingVoice(false),
    });
  };

  const selectVoice = (val: string) => {
    const vName = VOICE_ID_TO_NAME[val] || 'Sarah';
    const nextEquipped = { ...equippedCards, Voice: val };
    setVoiceCardId(val);
    setEquippedCards(nextEquipped);
    localStorage.setItem('kibo_voice_name', vName);
    localStorage.setItem('kibo_loadout_voice', val);
    localStorage.setItem('kibo_equipped_cards', JSON.stringify(nextEquipped));
    api?.saveStoredSettings?.({
      kibo_voice_name: vName,
      kibo_loadout_voice: val,
      kibo_equipped_cards: nextEquipped,
    });
  };

  const renderSidebarIcon = (id: SettingsSection) => {
    const iconConfigs: Record<SettingsSection, { bg: string; svg: React.ReactNode }> = {
      General: {
        bg: '#636366',
        svg: (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.85 1 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        ),
      },
      Appearance: {
        bg: '#48484A',
        svg: (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2">
            <circle cx="12" cy="12" r="8" />
            <path d="M12 4a8 8 0 0 1 0 16V4z" fill="#FFFFFF" />
          </svg>
        ),
      },
      GameHud: {
        bg: '#32ADE6',
        svg: (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="6" width="20" height="12" rx="4" />
            <line x1="6" y1="12" x2="10" y2="12" />
            <line x1="8" y1="10" x2="8" y2="14" />
            <circle cx="15.5" cy="10.5" r="0.8" fill="#FFFFFF" />
            <circle cx="17.5" cy="13.5" r="0.8" fill="#FFFFFF" />
          </svg>
        ),
      },
      Voice: {
        bg: '#FF375F',
        svg: (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
          </svg>
        ),
      },
      Shortcuts: {
        bg: '#30D158',
        svg: (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        ),
      },
      Account: {
        bg: '#0A84FF',
        svg: (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
          </svg>
        ),
      },
      About: {
        bg: '#5E5CE6',
        svg: (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        ),
      },
    };
    const cfg = iconConfigs[id];
    return (
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          background: cfg.bg,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {cfg.svg}
      </span>
    );
  };

  const navItems: Array<{ id: SettingsSection; label: string }> = [
    { id: 'General', label: 'General' },
    { id: 'Appearance', label: 'Appearance' },
    { id: 'GameHud', label: 'Game HUD' },
    { id: 'Voice', label: 'Voice & Audio' },
    { id: 'Shortcuts', label: 'Shortcuts & Safety' },
    { id: 'Account', label: 'Account & Keys' },
  ];

  const groupLabelStyle: React.CSSProperties = {
    fontSize: 11.5,
    fontWeight: 600,
    color: '#8E8E93',
    marginBottom: 8,
    marginTop: 4,
    paddingLeft: 2,
  };

  const cardStyle: React.CSSProperties = {
    background: '#242428',
    border: '1px solid rgba(255, 255, 255, 0.07)',
    borderRadius: 12,
    padding: '2px 16px',
    display: 'flex',
    flexDirection: 'column',
  };

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    padding: '12px 0',
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
  };

  const toggleBtn = (on: boolean, onToggle: () => void) => (
    <button
      type="button"
      onClick={onToggle}
      style={{
        width: 40,
        height: 22,
        borderRadius: 999,
        border: 'none',
        padding: 2,
        cursor: 'pointer',
        background: on ? '#30D158' : 'rgba(255, 255, 255, 0.16)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: on ? 'flex-end' : 'flex-start',
        transition: 'background 0.16s ease',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: '#FFFFFF',
          boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
        }}
      />
    </button>
  );

  const segmentedControl = <T extends string>(
    value: T,
    options: Array<{ value: T; label: string }>,
    onChange: (next: T) => void
  ) => (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: 'rgba(255, 255, 255, 0.06)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 8,
        padding: 2,
        gap: 2,
        flexShrink: 0,
      }}
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              border: 'none',
              borderRadius: 6,
              padding: '4px 11px',
              fontSize: 12,
              fontWeight: active ? 600 : 500,
              background: active ? 'rgba(255, 255, 255, 0.16)' : 'transparent',
              color: active ? '#FFFFFF' : '#98989F',
              cursor: 'pointer',
              transition: 'all 0.14s ease',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );

  const updateGlassTint = (delta: number) => {
    const next = Math.min(90, Math.max(10, glassTint + delta));
    setGlassTint(next);
    localStorage.setItem('kibo_glass_tint', String(next));
    api?.saveStoredSettings?.({ kibo_glass_tint: next });
  };

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        background: '#1A1A1D',
        color: '#F4F4F5',
        fontFamily: 'Figtree, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
        userSelect: 'none',
      }}
    >
      {/* Minimal macOS-Style Sidebar */}
      <aside
        style={{
          width: 224,
          background: '#1E1E22',
          borderRight: '1px solid rgba(255, 255, 255, 0.07)',
          padding: '16px 12px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              padding: '4px 8px 14px',
              marginBottom: 4,
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <KiboLogoIcon size={24} />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.01em' }}>Kibo</span>
          </div>

          {navItems.map((item) => {
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '7px 9px',
                  borderRadius: 8,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  background: active ? 'rgba(255, 255, 255, 0.11)' : 'transparent',
                  color: active ? '#FFFFFF' : '#B4B4BC',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  transition: 'background 0.14s ease, color 0.14s ease',
                }}
              >
                {renderSidebarIcon(item.id)}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid rgba(255, 255, 255, 0.07)', paddingTop: 10 }}>
          <button
            type="button"
            onClick={() => setSection('About')}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '7px 9px',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: section === 'About' ? 600 : 500,
              background: section === 'About' ? 'rgba(255, 255, 255, 0.11)' : 'transparent',
              color: section === 'About' ? '#FFFFFF' : '#B4B4BC',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            {renderSidebarIcon('About')}
            <span>About</span>
          </button>

          <button
            type="button"
            onClick={() => api?.quitApp?.()}
            style={{
              width: '100%',
              padding: '7px 10px',
              borderRadius: 8,
              border: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'rgba(255, 255, 255, 0.04)',
              color: '#F87171',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              marginTop: 2,
            }}
          >
            Quit Kibo
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {section === 'Appearance' && (
          <>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>Appearance</h2>

            {/* Original Kibo Notch Style Cards (Monochrome Studio Aesthetic) */}
            <div>
              <div style={groupLabelStyle}>Notch style</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {(
                  [
                    {
                      id: 'classic' as const,
                      title: 'Classic Bezel',
                      desc: 'Fused cleanly to the top edge',
                    },
                    {
                      id: 'floating' as const,
                      title: 'Floating Island',
                      desc: 'Detached frosted capsule with spring drop',
                    },
                  ] as const
                ).map((item) => {
                  const selected = notchStyle === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setNotchStyle(item.id);
                        localStorage.setItem('kibo_notch_style', item.id);
                        api?.saveStoredSettings?.({ kibo_notch_style: item.id });
                      }}
                      style={{
                        background: selected ? 'rgba(255, 255, 255, 0.07)' : '#242428',
                        border: selected ? '1.5px solid #F4F4F5' : '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: 14,
                        padding: 12,
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                        transition: 'border-color 0.16s ease, background 0.16s ease',
                      }}
                    >
                      {/* Original Kibo Minimal Frosted Screen Diagram */}
                      <div
                        style={{
                          width: '100%',
                          height: 68,
                          borderRadius: 10,
                          background:
                            'radial-gradient(circle at 28% 72%, rgba(255,255,255,0.11) 0%, transparent 52%), radial-gradient(circle at 78% 35%, rgba(255,255,255,0.08) 0%, transparent 48%), linear-gradient(180deg, #1E1F25 0%, #14151A 100%)',
                          border: '1px solid rgba(255, 255, 255, 0.09)',
                          position: 'relative',
                          overflow: 'hidden',
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'flex-start',
                        }}
                      >
                        {/* Soft blurred ambient wave behind the miniature notch */}
                        <div
                          style={{
                            position: 'absolute',
                            top: 12,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: 120,
                            height: 28,
                            borderRadius: 999,
                            background: 'rgba(255, 255, 255, 0.08)',
                            filter: 'blur(12px)',
                            pointerEvents: 'none',
                          }}
                        />

                        {item.id === 'classic' ? (
                          <div
                            style={{
                              position: 'relative',
                              width: 118,
                              height: 18,
                              background: '#0A0A0D',
                              borderBottomLeftRadius: 9,
                              borderBottomRightRadius: 9,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              zIndex: 1,
                            }}
                          >
                            {/* Miniature concave bezel arches matching real Classic Kibo notch */}
                            <svg
                              width="10"
                              height="10"
                              viewBox="0 0 24 24"
                              style={{ position: 'absolute', top: 0, left: -9 }}
                            >
                              <path d="M 0 0 L 24 0 L 24 24 L 23 24 C 23 10 13.5 0 0 0 Z" fill="#0A0A0D" />
                            </svg>
                            <svg
                              width="10"
                              height="10"
                              viewBox="0 0 24 24"
                              style={{ position: 'absolute', top: 0, right: -9 }}
                            >
                              <path d="M 24 0 L 0 0 L 0 24 L 1 24 C 1 10 10.5 0 24 0 Z" fill="#0A0A0D" />
                            </svg>
                            <span
                              style={{
                                width: 32,
                                height: 3.5,
                                borderRadius: 999,
                                background: 'rgba(255, 255, 255, 0.2)',
                              }}
                            />
                          </div>
                        ) : (
                          <div
                            style={{
                              width: 118,
                              height: 20,
                              marginTop: 10,
                              background: 'rgba(11, 12, 15, 0.94)',
                              borderRadius: 999,
                              border: '1px solid rgba(255, 255, 255, 0.16)',
                              boxShadow: '0 8px 20px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255,255,255,0.14)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              position: 'relative',
                              zIndex: 1,
                            }}
                          >
                            <span
                              style={{
                                width: 32,
                                height: 3.5,
                                borderRadius: 999,
                                background: 'rgba(255, 255, 255, 0.22)',
                              }}
                            />
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#FFFFFF' }}>{item.title}</div>
                          <div style={{ fontSize: 11.5, color: '#8E8E93', marginTop: 2 }}>{item.desc}</div>
                        </div>
                        {selected && (
                          <span
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: '50%',
                              background: '#F4F4F5',
                              color: '#09090B',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 11,
                              fontWeight: 800,
                              flexShrink: 0,
                            }}
                          >
                            &#x2713;
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Frosted Glass & Tint Card */}
            <div style={cardStyle}>
              <div style={rowStyle}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Frosted Glass</div>
                  <div style={{ fontSize: 11.5, color: '#8E8E93' }}>Live blurred desktop glass behind the open notch</div>
                </div>
                {toggleBtn(glassEnabled, () => {
                  const next = !glassEnabled;
                  setGlassEnabled(next);
                  localStorage.setItem('kibo_glass_enabled', String(next));
                  api?.saveStoredSettings?.({ kibo_glass_enabled: next });
                })}
              </div>

              <div style={{ ...rowStyle, borderBottom: 'none', opacity: glassEnabled ? 1 : 0.45 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Glass Tint</div>
                  <div style={{ fontSize: 11.5, color: '#8E8E93' }}>Control how dark or translucent the smoked frost appears</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    type="button"
                    disabled={!glassEnabled}
                    onClick={() => updateGlassTint(-5)}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      border: '1px solid rgba(255,255,255,0.14)',
                      background: 'rgba(255,255,255,0.08)',
                      color: '#FFFFFF',
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: glassEnabled ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                    }}
                  >
                    &#x2212;
                  </button>
                  <span style={{ fontSize: 12.5, fontWeight: 600, minWidth: 34, textAlign: 'center', color: '#F4F4F5' }}>
                    {glassTint}%
                  </span>
                  <button
                    type="button"
                    disabled={!glassEnabled}
                    onClick={() => updateGlassTint(5)}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      border: '1px solid rgba(255,255,255,0.14)',
                      background: 'rgba(255,255,255,0.08)',
                      color: '#FFFFFF',
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: glassEnabled ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Behavior, Motion & Companion Finish Card */}
            <div>
              <div style={groupLabelStyle}>Interaction &amp; motion</div>
              <div style={cardStyle}>
                <div style={rowStyle}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Open the notch</div>
                    <div style={{ fontSize: 11.5, color: '#8E8E93' }}>Choose Click if you never want hover opens near browser tabs</div>
                  </div>
                  {segmentedControl(
                    notchTrigger,
                    [
                      { value: 'hover', label: 'Hover' },
                      { value: 'click', label: 'Click' },
                    ],
                    (next) => {
                      setNotchTrigger(next);
                      localStorage.setItem('kibo_notch_trigger', next);
                      api?.saveStoredSettings?.({ kibo_notch_trigger: next });
                    }
                  )}
                </div>

                <div style={rowStyle}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Motion feel</div>
                    <div style={{ fontSize: 11.5, color: '#8E8E93' }}>Spring physics curve for expanding and collapsing the notch</div>
                  </div>
                  {segmentedControl(
                    animSpeed,
                    [
                      { value: 'smooth', label: 'Smooth' },
                      { value: 'snappy', label: 'Snappy' },
                      { value: 'bouncy', label: 'Bouncy' },
                    ],
                    (next) => {
                      setAnimSpeed(next);
                      localStorage.setItem('kibo_anim_speed', next);
                      api?.saveStoredSettings?.({ kibo_anim_speed: next });
                    }
                  )}
                </div>

                <div style={{ ...rowStyle, borderBottom: 'none' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Companion finish</div>
                    <div style={{ fontSize: 11.5, color: '#8E8E93' }}>Color finish for Kibo's animated face</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    {SOUL_SKINS.map((skin) => {
                      const active = skin.key === selectedSkinKey;
                      return (
                        <button
                          key={skin.key}
                          type="button"
                          title={skin.name}
                          onClick={() => {
                            setSelectedSkinKey(skin.key);
                            localStorage.setItem('kibo_chassis', skin.key);
                            localStorage.setItem('kibo_soul_skin', skin.key);
                            api?.saveStoredSettings?.({ kibo_chassis: skin.key });
                            api?.updateTrayColor?.(skin.primaryColor);
                          }}
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: '50%',
                            background: skin.primaryColor,
                            border: active ? '2px solid #FFFFFF' : '1px solid rgba(255,255,255,0.2)',
                            cursor: 'pointer',
                            padding: 0,
                            transform: active ? 'scale(1.12)' : 'scale(1)',
                            transition: 'transform 0.14s ease',
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {section === 'GameHud' && (
          <>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>Game HUD</h2>

            <div>
              <div style={groupLabelStyle}>Overlay &amp; placement</div>
              <div style={cardStyle}>
                <div style={rowStyle}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Enable Game Stats HUD</div>
                    <div style={{ fontSize: 11.5, color: '#8E8E93' }}>
                      Automatically show live FPS, frametime, GPU, CPU, RAM, and ping when a game is detected
                    </div>
                  </div>
                  {toggleBtn(gameHud.enabled, () => persistGameHud({ enabled: !gameHud.enabled }))}
                </div>

                <div style={rowStyle}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Preview HUD on Desktop</div>
                    <div style={{ fontSize: 11.5, color: '#8E8E93' }}>
                      Display live RTX/CPU telemetry right now without launching a game
                    </div>
                  </div>
                  {toggleBtn(gameHud.previewOnDesktop, () =>
                    persistGameHud({ enabled: true, previewOnDesktop: !gameHud.previewOnDesktop })
                  )}
                </div>

                <div style={rowStyle}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>HUD Position</div>
                    <div style={{ fontSize: 11.5, color: '#8E8E93' }}>
                      Integrate into the top notch or float cleanly in a screen corner
                    </div>
                  </div>
                  {segmentedControl(
                    gameHud.layout,
                    [
                      { value: 'notch', label: 'Notch' },
                      { value: 'top-left', label: 'Top Left' },
                      { value: 'top-right', label: 'Top Right' },
                    ],
                    (next) => persistGameHud({ layout: next })
                  )}
                </div>

                <div style={{ ...rowStyle, borderBottom: 'none' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Click-Through While Gaming</div>
                    <div style={{ fontSize: 11.5, color: '#8E8E93' }}>
                      Overlay ignores all mouse input during gameplay so crosshair flicks never steal focus
                    </div>
                  </div>
                  {toggleBtn(gameHud.clickThrough, () =>
                    persistGameHud({ clickThrough: !gameHud.clickThrough })
                  )}
                </div>
              </div>
            </div>

            <div>
              <div style={groupLabelStyle}>Displayed metrics</div>
              <div style={cardStyle}>
                {(
                  [
                    { key: 'showFps', label: 'FPS & Frametime (ms)', desc: 'Live DWM frame rate and frame pacing readout' },
                    { key: 'showGpu', label: 'GPU Utilization & Temp', desc: 'Live graphics load (%) and temperature (C) via official driver telemetry' },
                    { key: 'showVram', label: 'VRAM Usage', desc: 'Dedicated video memory currently allocated (GB)' },
                    { key: 'showCpu', label: 'CPU Utilization', desc: 'Total processor load across cores (%)' },
                    { key: 'showRam', label: 'RAM Usage', desc: 'System memory currently in use (GB)' },
                    { key: 'showPing', label: 'Network Ping', desc: 'Live network latency (ms)' },
                    { key: 'showGraph', label: 'Frametime Sparkline', desc: 'Minimalist live frame-pacing stability graph' },
                  ] as const
                ).map((item, idx, arr) => (
                  <div
                    key={item.key}
                    style={{
                      ...rowStyle,
                      borderBottom: idx === arr.length - 1 ? 'none' : rowStyle.borderBottom,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{item.label}</div>
                      <div style={{ fontSize: 11.5, color: '#8E8E93' }}>{item.desc}</div>
                    </div>
                    {toggleBtn(Boolean(gameHud[item.key]), () =>
                      persistGameHud({ [item.key]: !gameHud[item.key] } as Partial<GameHudConfig>)
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                background: 'rgba(48, 209, 88, 0.08)',
                border: '1px solid rgba(48, 209, 88, 0.22)',
                borderRadius: 12,
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#30D158' }}>
                Anti-Cheat Safe Architecture
              </div>
              <div style={{ fontSize: 11.5, color: '#B4B4BC', lineHeight: 1.5 }}>
                100% external read-only overlay using standard Windows DWM timing, official nvidia-smi, OS performance counters, and TCP ping. Zero DLL injection, zero DirectX/Vulkan hooks, zero memory reading, and zero kernel drivers.
              </div>
            </div>
          </>
        )}

        {section === 'General' && (
          <>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>General</h2>

            <div style={cardStyle}>
              <div style={rowStyle}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Launch at Windows Startup</div>
                  <div style={{ fontSize: 11.5, color: '#8E8E93' }}>Start Kibo automatically when you sign in</div>
                </div>
                {toggleBtn(launchStartup, () => {
                  const next = !launchStartup;
                  setLaunchStartup(next);
                  localStorage.setItem('kibo_startup', String(next));
                  api?.setStartupSetting?.(next);
                })}
              </div>

              <div style={rowStyle}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Show Icon in Taskbar</div>
                  <div style={{ fontSize: 11.5, color: '#8E8E93' }}>Display Kibo on the Windows taskbar alongside the system tray</div>
                </div>
                {toggleBtn(showTaskbar, () => {
                  const next = !showTaskbar;
                  setShowTaskbar(next);
                  localStorage.setItem('kibo_show_taskbar', String(next));
                  api?.setShowTaskbar?.(next);
                  api?.saveStoredSettings?.({ kibo_show_taskbar: next });
                })}
              </div>

              <div style={rowStyle}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Auto-Tuck Notch When Inactive</div>
                  <div style={{ fontSize: 11.5, color: '#8E8E93' }}>Rest quietly at the top bezel when the cursor moves away</div>
                </div>
                {toggleBtn(autoTuck, () => {
                  const next = !autoTuck;
                  setAutoTuck(next);
                  localStorage.setItem('kibo_autotuck', String(next));
                  api?.saveStoredSettings?.({ kibo_autotuck: next });
                })}
              </div>

              <div style={rowStyle}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Auto-Hide in Fullscreen Apps</div>
                  <div style={{ fontSize: 11.5, color: '#8E8E93' }}>Hide notch on borderless fullscreen video or games (off by default)</div>
                </div>
                {toggleBtn(autoHideFs, () => {
                  const next = !autoHideFs;
                  setAutoHideFs(next);
                  localStorage.setItem('kibo_auto_hide_fullscreen', String(next));
                  api?.saveStoredSettings?.({ kibo_auto_hide_fullscreen: next });
                })}
              </div>

              <div style={rowStyle}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Sound Effects (SFX)</div>
                  <div style={{ fontSize: 11.5, color: '#8E8E93' }}>Subtle tactile audio cues on open and shortcuts</div>
                </div>
                {toggleBtn(sfxEnabled, () => {
                  const next = !sfxEnabled;
                  setSfxEnabled(next);
                  soundFX.setEnabled(next);
                  api?.saveStoredSettings?.({ kibo_sfx_enabled: next });
                })}
              </div>

              <div style={rowStyle}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Hardware Volume HUD Popup</div>
                  <div style={{ fontSize: 11.5, color: '#8E8E93' }}>Show a sleek frosted volume bar inside the notch when pressing volume keys</div>
                </div>
                {toggleBtn(volumeHudEnabled, () => {
                  const next = !volumeHudEnabled;
                  setVolumeHudEnabled(next);
                  localStorage.setItem('kibo_volume_hud_enabled', String(next));
                  api?.saveStoredSettings?.({ kibo_volume_hud_enabled: next });
                })}
              </div>

              <div style={rowStyle}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>What's New in Kibo</div>
                  <div style={{ fontSize: 11.5, color: '#8E8E93' }}>View release highlights and updates for v1.0.2 and newer builds</div>
                </div>
                <button
                  type="button"
                  onClick={() => api?.openUrl?.('https://kiboai.vercel.app/whats-new?v=1.0.2')}
                  style={{
                    height: 30,
                    padding: '0 12px',
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: '#2E2E34',
                    color: '#F4F4F5',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Open What's New
                </button>
              </div>

              <div style={{ ...rowStyle, borderBottom: 'none' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Replay Onboarding Setup</div>
                  <div style={{ fontSize: 11.5, color: '#8E8E93' }}>Walk through the initial Kibo setup guide again</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem('kibo_onboarded_v1');
                    api?.saveStoredSettings?.({ kibo_onboarded_v1: false });
                    api?.triggerReplayOnboarding?.();
                  }}
                  style={{
                    height: 30,
                    padding: '0 12px',
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: '#2E2E34',
                    color: '#F4F4F5',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Replay Setup
                </button>
              </div>
            </div>
          </>
        )}

        {section === 'Voice' && (
          <>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>Voice &amp; Audio</h2>

            <div style={cardStyle}>
              <div style={rowStyle}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>AI Voice Module</div>
                  <div style={{ fontSize: 11.5, color: '#8E8E93' }}>Choose Kibo's speaking voice (click play inside menu to preview)</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <KiboDropdown
                    value={voiceCardId}
                    width={195}
                    options={VOICE_OPTIONS}
                    onChange={selectVoice}
                    onPreview={previewVoice}
                  />
                  <button
                    type="button"
                    onClick={() => previewVoice(voiceCardId)}
                    style={{
                      height: 32,
                      padding: '0 12px',
                      borderRadius: 8,
                      border: '1px solid rgba(255,255,255,0.12)',
                      background: isTestingVoice ? 'rgba(10, 132, 255, 0.24)' : '#2E2E34',
                      color: '#FFFFFF',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {isTestingVoice ? 'Playing...' : 'Test Voice'}
                  </button>
                </div>
              </div>

              <div style={rowStyle}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>ElevenLabs Audio Engine</div>
                  <div style={{ fontSize: 11.5, color: '#8E8E93' }}>Turbo v2.5 balances natural warmth and low latency (44.1 kHz / 128 kbps)</div>
                </div>
                <KiboDropdown
                  value={elevenModel}
                  width={195}
                  options={[
                    { value: 'eleven_turbo_v2_5', label: 'Turbo v2.5', sublabel: 'Balanced speed & rich clarity' },
                    { value: 'eleven_multilingual_v2', label: 'Multilingual v2', sublabel: 'Highest studio warmth' },
                    { value: 'eleven_flash_v2_5', label: 'Flash v2.5', sublabel: 'Lowest latency' },
                  ]}
                  onChange={(val) => {
                    setElevenModel(val);
                    localStorage.setItem('kibo_elevenlabs_model', val);
                    api?.saveStoredSettings?.({ kibo_elevenlabs_model: val });
                  }}
                />
              </div>

              <div style={rowStyle}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Spoken Voice Responses</div>
                  <div style={{ fontSize: 11.5, color: '#8E8E93' }}>Speak Kibo replies aloud automatically</div>
                </div>
                {toggleBtn(voiceTts, () => {
                  const next = !voiceTts;
                  setVoiceTts(next);
                  localStorage.setItem('kibo_voice_tts', String(next));
                  api?.saveStoredSettings?.({ kibo_voice_tts: next });
                })}
              </div>

              <div style={rowStyle}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Speaker Output</div>
                  <div style={{ fontSize: 11.5, color: '#8E8E93' }}>Route Kibo's spoken voice to a specific device</div>
                </div>
                <KiboDropdown
                  value={speakerId}
                  width={230}
                  options={outputDevices.map((d) => ({ value: d.deviceId, label: d.label }))}
                  onChange={(val) => {
                    setSpeakerId(val);
                    localStorage.setItem('kibo_output_device_id', val);
                    voiceEngine.setOutputDevice(val);
                    api?.saveStoredSettings?.({ kibo_output_device_id: val });
                  }}
                />
              </div>

              <div style={{ ...rowStyle, borderBottom: 'none' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Microphone Input</div>
                  <div style={{ fontSize: 11.5, color: '#8E8E93' }}>Microphone used for voice commands and dictation</div>
                </div>
                <KiboDropdown
                  value={micId}
                  width={230}
                  options={inputDevices.map((d) => ({ value: d.deviceId, label: d.label }))}
                  onChange={(val) => {
                    setMicId(val);
                    localStorage.setItem('kibo_mic_device_id', val);
                    api?.saveStoredSettings?.({ kibo_mic_device_id: val });
                  }}
                />
              </div>
            </div>
          </>
        )}

        {section === 'Shortcuts' && (
          <>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>Shortcuts &amp; Safety</h2>

            {/* Gaming & Accidental Trigger Protection */}
            <div>
              <div style={groupLabelStyle}>Accidental trigger protection</div>
              <div style={cardStyle}>
                <div style={rowStyle}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Gaming Focus Shield</div>
                    <div style={{ fontSize: 11.5, color: '#8E8E93' }}>
                      Automatically pause all Kibo shortcuts whenever a game is in the foreground (100% read-only, anti-cheat safe)
                    </div>
                  </div>
                  {toggleBtn(shortcuts.gamingShield, () => {
                    persistShortcuts({ ...shortcuts, gamingShield: !shortcuts.gamingShield });
                  })}
                </div>

                <div style={rowStyle}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Hold Delay (Anti-Accidental Tap)</div>
                    <div style={{ fontSize: 11.5, color: '#8E8E93' }}>
                      Require holding the shortcut briefly before triggering; multi-key chords like Ctrl+Shift+T or Ctrl+Shift+V are always ignored
                    </div>
                  </div>
                  {segmentedControl(
                    String(shortcuts.holdDelayMs),
                    [
                      { value: '0', label: 'Off' },
                      { value: '150', label: '150ms' },
                      { value: '260', label: '260ms' },
                      { value: '400', label: '400ms' },
                    ],
                    (val) => {
                      persistShortcuts({ ...shortcuts, holdDelayMs: parseInt(val, 10) || 0 });
                    }
                  )}
                </div>

                <div style={{ ...rowStyle, borderBottom: 'none' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Pause All Shortcuts (Do Not Disturb)</div>
                    <div style={{ fontSize: 11.5, color: '#8E8E93' }}>
                      Temporarily disable all global hotkeys during focus work, exams, or competitive matches
                    </div>
                  </div>
                  {toggleBtn(shortcuts.pausedAll, () => {
                    persistShortcuts({ ...shortcuts, pausedAll: !shortcuts.pausedAll });
                  })}
                </div>
              </div>
            </div>

            {/* Individual Shortcuts + Presets */}
            <div>
              <div style={groupLabelStyle}>Global hotkeys</div>
              <div style={cardStyle}>
                <div style={rowStyle}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Ask &amp; Control</div>
                    <div style={{ fontSize: 11.5, color: '#8E8E93' }}>Hold, speak your command, release</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <KiboDropdown
                      value={shortcuts.ask}
                      width={150}
                      options={[
                        { value: 'Win + Alt', label: 'Win + Alt' },
                        { value: 'Alt + Space', label: 'Alt + Space' },
                        { value: 'Ctrl + Alt + A', label: 'Ctrl + Alt + A' },
                      ]}
                      onChange={(val) => persistShortcuts({ ...shortcuts, ask: val })}
                    />
                    {toggleBtn(shortcuts.askEnabled, () =>
                      persistShortcuts({ ...shortcuts, askEnabled: !shortcuts.askEnabled })
                    )}
                  </div>
                </div>

                <div style={rowStyle}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Circle to Ask (Screen Vision)</div>
                    <div style={{ fontSize: 11.5, color: '#8E8E93' }}>
                      Tip: switch to Ctrl + Alt + S if you use Ctrl + Shift frequently in games or editors
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <KiboDropdown
                      value={shortcuts.lasso}
                      width={150}
                      options={[
                        { value: 'Ctrl + Shift', label: 'Ctrl + Shift' },
                        { value: 'Ctrl + Alt + S', label: 'Ctrl + Alt + S' },
                        { value: 'Alt + Shift', label: 'Alt + Shift' },
                      ]}
                      onChange={(val) => persistShortcuts({ ...shortcuts, lasso: val })}
                    />
                    {toggleBtn(shortcuts.lassoEnabled, () =>
                      persistShortcuts({ ...shortcuts, lassoEnabled: !shortcuts.lassoEnabled })
                    )}
                  </div>
                </div>

                <div style={{ ...rowStyle, borderBottom: 'none' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Clean Dictation</div>
                    <div style={{ fontSize: 11.5, color: '#8E8E93' }}>Hold to speak, pastes polished text at cursor</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <KiboDropdown
                      value={shortcuts.dictate}
                      width={150}
                      options={[
                        { value: 'Ctrl + Win', label: 'Ctrl + Win' },
                        { value: 'Ctrl + Alt + D', label: 'Ctrl + Alt + D' },
                        { value: 'Alt + D', label: 'Alt + D' },
                      ]}
                      onChange={(val) => persistShortcuts({ ...shortcuts, dictate: val })}
                    />
                    {toggleBtn(shortcuts.dictateEnabled, () =>
                      persistShortcuts({ ...shortcuts, dictateEnabled: !shortcuts.dictateEnabled })
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {section === 'Account' && (
          <>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>Account &amp; Keys</h2>

            <div style={cardStyle}>
              <div style={rowStyle}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Your Name</div>
                  <div style={{ fontSize: 11.5, color: '#8E8E93' }}>Used by Kibo in greetings and persistent memory</div>
                </div>
                <input
                  type="text"
                  value={userName}
                  placeholder="Enter name"
                  onChange={(e) => {
                    const v = e.target.value;
                    setUserName(v);
                    localStorage.setItem('kibo_user_name', v);
                    api?.saveStoredSettings?.({ kibo_user_name: v });
                  }}
                  style={{
                    width: 180,
                    height: 32,
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: '#1A1A1D',
                    color: '#FFFFFF',
                    padding: '0 10px',
                    fontSize: 12.5,
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ ...rowStyle, flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Google Gemini API Key</span>
                  <button
                    type="button"
                    onClick={() => api?.openUrl?.('https://aistudio.google.com/app/apikey')}
                    style={{ background: 'none', border: 'none', color: '#0A84FF', fontSize: 12, cursor: 'pointer', padding: 0 }}
                  >
                    Get key
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="password"
                    value={geminiDraft}
                    onChange={(e) => setGeminiDraft(e.target.value)}
                    placeholder="AIzaSy..."
                    style={{
                      flex: 1,
                      height: 34,
                      borderRadius: 8,
                      border: '1px solid rgba(255,255,255,0.12)',
                      background: '#1A1A1D',
                      color: '#FFFFFF',
                      padding: '0 10px',
                      fontSize: 12.5,
                      outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const clean = geminiDraft.trim();
                      localStorage.setItem('kibo_gemini_key', clean);
                      api?.saveStoredSettings?.({ kibo_gemini_key: clean });
                      setGeminiSaved(true);
                      setTimeout(() => setGeminiSaved(false), 1800);
                    }}
                    style={{
                      minWidth: 74,
                      height: 34,
                      borderRadius: 8,
                      border: 'none',
                      background: geminiSaved ? '#30D158' : '#0A84FF',
                      color: '#FFFFFF',
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {geminiSaved ? 'Saved' : 'Save'}
                  </button>
                </div>
              </div>

              <div style={{ ...rowStyle, borderBottom: 'none', flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>ElevenLabs API Key</span>
                  <button
                    type="button"
                    onClick={() => api?.openUrl?.('https://elevenlabs.io/app/settings/api-keys')}
                    style={{ background: 'none', border: 'none', color: '#0A84FF', fontSize: 12, cursor: 'pointer', padding: 0 }}
                  >
                    Get key
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="password"
                    value={elevenDraft}
                    onChange={(e) => setElevenDraft(e.target.value)}
                    placeholder="sk_... (optional if set in .env.local)"
                    style={{
                      flex: 1,
                      height: 34,
                      borderRadius: 8,
                      border: '1px solid rgba(255,255,255,0.12)',
                      background: '#1A1A1D',
                      color: '#FFFFFF',
                      padding: '0 10px',
                      fontSize: 12.5,
                      outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const clean = elevenDraft.trim();
                      localStorage.setItem('kibo_elevenlabs_key', clean);
                      api?.saveStoredSettings?.({ kibo_elevenlabs_key: clean });
                      setElevenSaved(true);
                      setTimeout(() => setElevenSaved(false), 1800);
                    }}
                    style={{
                      minWidth: 74,
                      height: 34,
                      borderRadius: 8,
                      border: 'none',
                      background: elevenSaved ? '#30D158' : '#0A84FF',
                      color: '#FFFFFF',
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {elevenSaved ? 'Saved' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {section === 'About' && (
          <>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>About Kibo</h2>
            <div style={{ ...cardStyle, padding: 18, gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <KiboLogoIcon size={48} />
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>Kibo Desktop Companion</div>
                  <div style={{ fontSize: 12, color: '#8E8E93', marginTop: 2 }}>Version 1.0.2 - Native Rust + Tauri v2 Runtime</div>
                </div>
              </div>
              <div style={{ fontSize: 12.5, color: '#A1A1AA', lineHeight: 1.55 }}>
                Local-first ambient top-bezel assistant for Windows. All API keys, memory, clipboard history, and preferences stay strictly on your PC with zero cloud middleman servers.
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 6 }}>
                <button
                  type="button"
                  onClick={() => api?.openUrl?.('https://kiboai.vercel.app/whats-new?v=1.0.2')}
                  style={{
                    height: 32,
                    padding: '0 14px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#F4F4F5',
                    color: '#111114',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  What's New in v1.0.2
                </button>
                <button
                  type="button"
                  onClick={() => api?.openUrl?.('https://kiboai.vercel.app/contact')}
                  style={{
                    height: 32,
                    padding: '0 14px',
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.14)',
                    background: 'transparent',
                    color: '#E4E4E7',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Contact Support
                </button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};
