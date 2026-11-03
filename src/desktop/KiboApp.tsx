/// <reference types="vite/client" />
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { gsap } from 'gsap';
import { SOUL_SKINS, SoulConfig } from '../lib/soulMath';
import { SoulCanvas } from '../components/SoulCanvas';
import { LivingEmberIcon } from '../components/LivingEmberIcon';
import { queryGemini, cleanDictation, transcribeAudioWithGeminiAPI, askLassoWithGemini, savePersistentUserMemory } from '../lib/gemini';
import { soundFX } from '../lib/soundFX';
import { voiceEngine, KiboVoiceName } from '../lib/voiceEngine';
import { runFastComputerUseLoop, executeDirectComputerAction } from '../lib/fastComputerUse';
import { RoamingSoulPointer } from '../components/RoamingSoulPointer';
import { findTargetOnScreen, PointedTarget } from '../lib/screenPointerFinder';
import {
  multitaskAgent,
  AgentTask,
  DetectedAppConfig,
  APP_INTEGRATIONS,
} from '../lib/multitaskAgent';
import { ProactiveContextNotch } from '../components/ProactiveContextNotch';
import { AgentTopRightDock } from '../components/AgentTopRightDock';
import { AgentsNotchView } from '../components/AgentsNotchView';
import { KiboOnboardingExperience } from '../components/KiboOnboardingExperience';
// @ts-ignore - Allow side-effect CSS import across strict TS 5.6+ configs
import './desktop-companion.css';

declare global {
  interface Window {
    kiboAPI?: {
      setWindowMode: (mode: 'tucked' | 'collapsed' | 'listening' | 'media' | 'expanded', height?: number) => void;
      setWindowBounds: (width: number, height: number) => void;
      setAppWindowRect?: (rect: { x: number; y: number; width: number; height: number } | null) => void;
      setRoamingTargetRect?: (rect: any) => void;
      setRoamingActive?: (active: boolean) => void;
      setAgentDockActive?: (active: boolean | { active: boolean; isHovered?: boolean }, isHovered?: boolean) => void;
      onDesktopClickedOutside?: (callback: () => void) => () => void;
      onRoamingDismiss?: (callback: () => void) => () => void;
      onContextAppDetected?: (callback: (appId: any) => void) => () => void;
      openGeneratedPage?: (
        htmlContent: string,
        existingFilePath?: string
      ) => Promise<{ success: boolean; path?: string; error?: string }>;
      inspectWebsiteDesign?: (
        targetUrl: string
      ) => Promise<{ success: boolean; designSpec?: any; error?: string }>;
      playSpotify?: (
        query: string,
        targetType?: 'track_or_artist' | 'liked_songs'
      ) => Promise<{
        success: boolean;
        mode: 'app' | 'web';
        query: string;
        url?: string;
        autoClicked?: boolean;
      }>;
      setExpanded: (expanded: boolean, height?: number) => void;
      minimize: () => void;
      close: () => void;
      openApp: (appName: string) => Promise<{ success: boolean; app?: string; error?: string }>;
      getInstalledApps?: () => Promise<Array<InstalledAppItem>>;
      openUrl: (url: string) => Promise<{ success: boolean }>;
      typeText: (text: string) => Promise<{ success: boolean }>;
      captureScreen: () => Promise<{ success: boolean; image?: string; error?: string }>;
      getControlsState?: () => Promise<{
        wifiConnected: boolean;
        wifiSsid: string;
        bluetoothOn?: boolean;
        nightLightOn?: boolean;
        darkMode: boolean;
        volume?: number;
        muted?: boolean;
        audioDevices: string[];
      }>;
      setVolume?: (level: number) => Promise<{ success: boolean }>;
      setMute?: (mute: boolean) => Promise<{ success: boolean }>;
      readClipboardText?: () => string;
      readClipboardImage?: () => { dataUrl: string; width: number; height: number; mb: string } | null;
      writeClipboardText?: (text: string) => boolean;
      writeClipboardImage?: (dataUrl: string) => boolean;
      seekMedia?: (seconds: number) => Promise<{ success: boolean }>;
      toggleWifi?: (enable: boolean, ssidName?: string) => Promise<{ success: boolean; connected: boolean }>;
      getWifiNetworks?: () => Promise<Array<{ ssid: string; signal: number }>>;
      toggleBluetooth?: (enable: boolean) => Promise<{ success: boolean; enabled?: boolean }>;
      getBluetoothDevices?: () => Promise<Array<{ name: string; connected: boolean }>>;
      toggleNightLight?: (enable: boolean, strength?: number) => Promise<{ success: boolean; enabled?: boolean; strength?: number }>;
      toggleSystemDarkMode: (targetDark?: boolean) => Promise<{ success: boolean; darkMode?: boolean; isLight?: boolean }>;
      getNowPlaying?: () => Promise<{
        hasSession?: boolean;
        playing: boolean;
        title: string;
        artist: string;
        source?: string;
        thumbnail?: string;
        durationSec?: number;
        positionSec?: number;
      }>;
      mediaControl?: (action: 'playpause' | 'next' | 'prev') => Promise<{ success: boolean }>;
      getClipboardHistory?: () => Promise<ClipboardItem[]>;
      deleteClipboardItem?: (id: number) => Promise<{ success: boolean }>;
      togglePinClipboardItem?: (id: number) => Promise<{ success: boolean }>;
      clearClipboardHistory?: () => Promise<{ success: boolean }>;
      powerAction: (action: 'lock' | 'sleep' | 'restart' | 'shutdown') => Promise<{ success: boolean; error?: string }>;
      getSystemStats: () => Promise<any>;
      runSpeedTest?: () => Promise<{ success: boolean; downloadMbps: number; uploadMbps: number }>;
      setWallpaper: (imagePath: string) => Promise<{ success: boolean; localPath?: string; error?: string }>;
      getWallpaperDataUrl?: (urlOrPath: string) => Promise<string>;
      pickWallpaperFiles?: () => Promise<{ success: boolean; files?: Array<{ title: string; url: string; filePath: string }> }>;
      getStartupSetting?: () => Promise<boolean>;
      setStartupSetting?: (enabled: boolean) => Promise<boolean>;
      updateTrayColor?: (hexColor: string) => Promise<boolean>;
      quitApp?: () => Promise<boolean>;
      updateShortcuts?: (shortcuts: { ask?: string; circle?: string; dictate?: string }) => Promise<{ success: boolean; shortcuts: any }>;
      getShortcuts?: () => Promise<{ ask: string; circle: string; dictate: string }>;
      setLassoActive?: (active: boolean) => Promise<{ success: boolean }>;
      scanUIElements?: () => Promise<{ ok: boolean; elements?: any[]; error?: string }>;
      executeUIAction?: (payload: {
        action: 'click' | 'double_click' | 'right_click' | 'type' | 'type_direct';
        x?: number;
        y?: number;
        text?: string;
        pressEnter?: boolean;
      }) => Promise<{ ok: boolean; aborted?: boolean; error?: string }>;
      onTriggerLasso: (cb: () => void) => () => void;
      onTriggerDictation: (cb: () => void) => () => void;
      onTriggerAsk?: (cb: () => void) => () => void;
      onOpenSettings?: (cb: (section?: string) => void) => () => void;
      onClipboardItemAdded?: (cb: (item: ClipboardItem) => void) => () => void;
      syncEmbersState?: (data: { count: number; isWaiting: boolean }) => Promise<{ success: boolean }>;
      onClaimDailyEmber?: (callback: () => void) => () => void;
      onGrantCreatorEmbers?: (callback: (amount: number) => void) => () => void;
      getStoredSettings?: () => Promise<Record<string, any>>;
      saveStoredSettings?: (patch: Record<string, any>) => Promise<any>;
      convertFile?: (payload: {
        filePath?: string;
        fileNameQuery?: string;
        targetFormat: string;
      }) => Promise<{
        success: boolean;
        sourcePath?: string;
        outputPath?: string;
        outputFileName?: string;
        error?: string;
      }>;
      pickFileForConvert?: () => Promise<{
        success: boolean;
        filePath?: string;
        fileName?: string;
        ext?: string;
        sizeBytes?: number;
      }>;
      showItemInFolder?: (filePath: string) => Promise<{ success: boolean }>;
      exportChromeExtension?: (opts?: { revealInExplorer?: boolean }) => Promise<{ success: boolean; extDir?: string; folderPath?: string; error?: string }>;
      openChromeExtensionsPage?: () => Promise<{ success: boolean }>;
      startExtensionDrag?: () => void;
      getFilePath?: (file: any) => string;
      pickSkillMdFile?: () => Promise<{
        success: boolean;
        name?: string;
        description?: string;
        content?: string;
        filePath?: string;
        error?: string;
      }>;
      composioGetStatus?: (customKey?: string) => Promise<{
        success: boolean;
        connected: boolean;
        apiKey?: string;
        maskedKey?: string;
        accountsCount?: number;
        accounts?: Array<{ id: string; slug: string; status: string; createdAt?: string }>;
        error?: string;
      }>;
      composioConnectApp?: (toolkitSlug: string, customKey?: string) => Promise<{
        success: boolean;
        redirectUrl?: string;
        connectionId?: string;
        status?: string;
        error?: string;
      }>;
      composioGetConnectedAccounts?: (customKey?: string) => Promise<{
        success: boolean;
        accounts: Array<{ id: string; slug: string; status: string; createdAt?: string }>;
        error?: string;
      }>;
      composioDisconnectAccount?: (accountId: string, customKey?: string) => Promise<{
        success: boolean;
        error?: string;
      }>;
    };
  }
}

type NavTab = 'Chat' | 'Agents' | 'Convert' | 'Focus' | 'Skills' | 'Media' | 'Controls' | 'Today' | 'Clipboard' | 'Apps' | 'Wallpaper' | 'Power' | 'Settings';
type CompanionSection = 'Kibo' | 'Shortcuts' | 'Behavior' | 'System' | 'API keys' | 'Your data' | 'Privacy';
type LoadoutSlotType = 'Soul' | 'Voice' | 'Personality' | 'Abilities';
type ControlDropdownType = 'wifi' | 'bluetooth' | 'audio' | 'nightlight' | null;

interface ChatMessageItem {
  id: string;
  role: 'user' | 'kibo';
  text: string;
  subText?: string;
  time: string;
  actionFilePath?: string;
  actionLabel?: string;
}

interface ConvertedFileRecord {
  id: string;
  sourceName: string;
  sourcePath: string;
  outputFileName: string;
  outputPath: string;
  targetFormat: string;
  timestamp: string;
}

interface KiboSkillItem {
  id: string;
  name: string;
  description: string;
  content: string;
  enabled: boolean;
  builtIn?: boolean;
}

interface CustomIntegrationItem {
  id: string;
  name: string;
  category: string;
  endpointOrId: string;
  connected: boolean;
}

interface AgentPermissionState {
  filesAndFolders: boolean;
  documents: boolean;
  pictures: boolean;
  contacts: boolean;
  calendar: boolean;
  microphone: boolean;
  camera: boolean;
  location: boolean;
}

interface InstalledAppItem {
  id: string;
  name: string;
  appId?: string;
  exePath?: string;
  iconUrl?: string;
  key: string;
  tag: string;
  category: string;
  starred?: boolean;
  highlighted?: boolean;
}

interface ClipboardItem {
  id: number;
  category: 'Text' | 'Images' | 'Links';
  preview: string;
  imageDataUrl?: string;
  label: string;
  time: string;
  type: string;
  size: string;
  copied: string;
  iconType: 'text' | 'link' | 'code' | 'image' | 'pin';
  isToday?: boolean;
  isPinned?: boolean;
}

interface ContextNotificationCard {
  header: string;
  title: string;
  subtitle?: string;
  domain?: string;
  badgeType?: 'youtube' | 'gmail' | 'google' | 'amazon' | 'app';
}

interface WallpaperTheme {
  id: number;
  title: string;
  url: string;
  filePath?: string;
  thumb: string;
  accent: string;
  accentSecondary: string;
  pillBg: string;
  rowBg: string;
  darkText: string;
  darkSubText: string;
}

interface LoadoutCardItem {
  id: string;
  slot: LoadoutSlotType;
  name: string;
  rarity?: string;
  description: string;
  cost: number;
  notForSale?: boolean;
  skinKey?: string;
  cardTint: string;
  iconKind: 'soul' | 'void' | 'wave' | 'lock' | 'plus' | 'chad' | 'collapse_eye' | 'sidearm_bullet';
}

interface ScheduledRoutine {
  id: number;
  title: string;
  timeLabel: string;
  command: string;
}

// Maps any media app or streaming platform to its official brand logo color & gradient when cover art is unavailable
function getMediaAppBrandPalette(source?: string, artist?: string, title?: string): {
  accent: string;
  rgb: string;
  gradient: string;
} {
  const combined = `${source || ''} ${artist || ''} ${title || ''}`.toLowerCase();

  if (combined.includes('netflix')) {
    return {
      accent: '#E50914',
      rgb: '229, 9, 20',
      gradient: 'linear-gradient(135deg, #240406 0%, #83070D 50%, #E50914 100%)',
    };
  }
  if (combined.includes('youtube')) {
    return {
      accent: '#FF0033',
      rgb: '255, 0, 51',
      gradient: 'linear-gradient(135deg, #29040B 0%, #99041F 50%, #FF0033 100%)',
    };
  }
  if (combined.includes('spotify')) {
    return {
      accent: '#1DB954',
      rgb: '29, 185, 84',
      gradient: 'linear-gradient(135deg, #06210F 0%, #106F32 50%, #1DB954 100%)',
    };
  }
  if (combined.includes('crunchyroll')) {
    return {
      accent: '#F47521',
      rgb: '244, 117, 33',
      gradient: 'linear-gradient(135deg, #291103 0%, #94410A 50%, #F47521 100%)',
    };
  }
  if (combined.includes('twitch')) {
    return {
      accent: '#9146FF',
      rgb: '145, 70, 255',
      gradient: 'linear-gradient(135deg, #180930 0%, #52209E 50%, #9146FF 100%)',
    };
  }
  if (combined.includes('soundcloud')) {
    return {
      accent: '#FF5500',
      rgb: '255, 85, 0',
      gradient: 'linear-gradient(135deg, #2B0E02 0%, #993300 50%, #FF5500 100%)',
    };
  }
  if (combined.includes('apple') || combined.includes('itunes')) {
    return {
      accent: '#FA243C',
      rgb: '250, 36, 60',
      gradient: 'linear-gradient(135deg, #2B060B 0%, #961222 50%, #FA243C 100%)',
    };
  }
  if (combined.includes('prime') || combined.includes('amazon')) {
    return {
      accent: '#00A8E1',
      rgb: '0, 168, 225',
      gradient: 'linear-gradient(135deg, #041B26 0%, #026082 50%, #00A8E1 100%)',
    };
  }
  if (combined.includes('disney')) {
    return {
      accent: '#0063E5',
      rgb: '0, 99, 229',
      gradient: 'linear-gradient(135deg, #041029 0%, #043885 50%, #0063E5 100%)',
    };
  }
  if (combined.includes('vlc')) {
    return {
      accent: '#FF8800',
      rgb: '255, 136, 0',
      gradient: 'linear-gradient(135deg, #2B1702 0%, #944F00 50%, #FF8800 100%)',
    };
  }

  return {
    accent: '#5CB8FF',
    rgb: '92, 184, 255',
    gradient: 'linear-gradient(135deg, #0B1929 0%, #1B4975 50%, #5CB8FF 100%)',
  };
}

// Offscreen Canvas Dynamic Color Extractor
function extractPaletteFromImageElement(img: HTMLImageElement): {
  accent: string;
  accentSecondary: string;
  pillBg: string;
  rowBg: string;
  darkText: string;
  darkSubText: string;
} | null {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    canvas.width = 48;
    canvas.height = 48;
    ctx.drawImage(img, 0, 0, 48, 48);
    const data = ctx.getImageData(0, 0, 48, 48).data;

    let rSum = 0;
    let gSum = 0;
    let bSum = 0;
    let weightSum = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const lum = (max + min) / 2;
      const sat = max === min ? 0 : (max - min) / (255 - Math.abs(max + min - 255));

      if (lum > 35 && lum < 235) {
        const w = 0.25 + sat * 2.8 + (lum / 255) * 0.5;
        rSum += r * w;
        gSum += g * w;
        bSum += b * w;
        weightSum += w;
      }
    }

    if (weightSum <= 0) return null;

    let r = Math.round(rSum / weightSum);
    let g = Math.round(gSum / weightSum);
    let b = Math.round(bSum / weightSum);

    const maxC = Math.max(r, g, b);
    if (maxC < 175 && maxC > 0) {
      const boost = 195 / maxC;
      r = Math.min(248, Math.round(r * boost));
      g = Math.min(248, Math.round(g * boost));
      b = Math.min(248, Math.round(b * boost));
    }

    const toHex = (n: number) => n.toString(16).padStart(2, '0');
    const accentHex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    const secR = Math.min(255, Math.round(r * 1.06));
    const secG = Math.min(255, Math.round(g * 0.95));
    const secB = Math.max(20, Math.round(b * 0.78));
    const secondaryHex = `#${toHex(secR)}${toHex(secG)}${toHex(secB)}`;

    return {
      accent: accentHex,
      accentSecondary: secondaryHex,
      pillBg: `rgba(${r}, ${g}, ${b}, 0.22)`,
      rowBg: `rgba(${r}, ${g}, ${b}, 0.16)`,
      darkText: '#14110E',
      darkSubText: 'rgba(20, 17, 14, 0.72)',
    };
  } catch (_) {
    return null;
  }
}

// Crisp Vector SVG Icon Library (Includes Mathematically Centered Media Controls)
const SvgIcon: React.FC<{ name: string; size?: number; color?: string }> = ({
  name,
  size = 14,
  color = 'currentColor',
}) => {
  switch (name) {
    case 'ember':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2C12 2 15.5 6.5 15.5 10C15.5 11.2 15 12.2 14.2 13C15.4 13.5 16.5 14.8 16.5 16.5C16.5 19 14.5 21 12 21C9.5 21 7.5 19 7.5 16.5C7.5 14.5 8.8 13.2 10.2 12.5C9.2 11.8 8.8 10.5 8.8 9.5C8.8 6.5 12 2 12 2Z"
            fill={color === 'currentColor' ? 'url(#ember-gradient)' : color}
          />
          <path
            d="M12 14.5C11.2 14.5 10.5 15.2 10.5 16C10.5 16.8 11.2 17.5 12 17.5C12.8 17.5 13.5 16.8 13.5 16C13.5 15.2 12.8 14.5 12 14.5Z"
            fill="#FFF5C2"
          />
          <defs>
            <linearGradient id="ember-gradient" x1="12" y1="2" x2="12" y2="21" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFA94D" />
              <stop offset="60%" stopColor="#FF6B35" />
              <stop offset="100%" stopColor="#E03131" />
            </linearGradient>
          </defs>
        </svg>
      );
    case 'wifi':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.55a11 11 0 0 1 14.08 0" />
          <path d="M1.42 9a16 16 0 0 1 21.16 0" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <line x1="12" y1="20" x2="12.01" y2="20" />
        </svg>
      );
    case 'bluetooth':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5" />
        </svg>
      );
    case 'speaker':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill={color} />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        </svg>
      );
    case 'mute':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill={color} />
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </svg>
      );
    case 'moon':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      );
    case 'contrast':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3a9 9 0 0 0 0 18z" fill={color} />
        </svg>
      );
    case 'sun':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" fill={color} />
          <line x1="12" y1="2" x2="12" y2="4" />
          <line x1="12" y1="20" x2="12" y2="22" />
          <line x1="4.93" y1="4.93" x2="6.34" y2="6.34" />
          <line x1="17.66" y1="17.66" x2="19.07" y2="19.07" />
          <line x1="2" y1="12" x2="4" y2="12" />
          <line x1="20" y1="12" x2="22" y2="12" />
          <line x1="4.93" y1="19.07" x2="6.34" y2="17.66" />
          <line x1="17.66" y1="6.34" x2="19.07" y2="4.93" />
        </svg>
      );
    case 'search':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      );
    case 'dots':
    case 'more':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
          <circle cx="12" cy="12" r="2.2" />
          <circle cx="19" cy="12" r="2.2" />
          <circle cx="5" cy="12" r="2.2" />
        </svg>
      );
    case 'copy':
    case 'clipboard':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      );
    case 'trash':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      );
    case 'pin':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="17" x2="12" y2="22" />
          <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
        </svg>
      );
    case 'link':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      );
    case 'image':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      );
    case 'folder':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
      );
    case 'bolt':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      );
    case 'star':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      );
    case 'settings':
    case 'gear':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );
    case 'sparkles':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
          <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" />
        </svg>
      );
    case 'rocket':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
          <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
        </svg>
      );
    case 'smile':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M8 14s1.5 2 4 2 4-2 4-2" />
          <line x1="9" y1="9" x2="9.01" y2="9" />
          <line x1="15" y1="9" x2="15.01" y2="9" />
        </svg>
      );
    case 'waveform':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round">
          <line x1="4" y1="10" x2="4" y2="14" />
          <line x1="8" y1="6" x2="8" y2="18" />
          <line x1="12" y1="3" x2="12" y2="21" />
          <line x1="16" y1="7" x2="16" y2="17" />
          <line x1="20" y1="10" x2="20" y2="14" />
        </svg>
      );
    case 'padlock':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      );
    case 'user':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case 'keyboard':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <line x1="6" y1="8" x2="6" y2="8" />
          <line x1="10" y1="8" x2="10" y2="8" />
          <line x1="14" y1="8" x2="14" y2="8" />
          <line x1="18" y1="8" x2="18" y2="8" />
          <line x1="8" y1="16" x2="16" y2="16" />
        </svg>
      );
    case 'sliders':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="21" x2="4" y2="14" />
          <line x1="4" y1="10" x2="4" y2="3" />
          <line x1="12" y1="21" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12" y2="3" />
          <line x1="20" y1="21" x2="20" y2="16" />
          <line x1="20" y1="12" x2="20" y2="3" />
        </svg>
      );
    case 'key':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="7.5" cy="15.5" r="5.5" />
          <path d="m21 2-9.6 9.6" />
          <path d="m15.5 7.5 3 3L22 7l-3-3" />
        </svg>
      );
    case 'database':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
        </svg>
      );
    case 'shield':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    case 'prev':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
          <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
        </svg>
      );
    case 'next':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
          <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
        </svg>
      );
    case 'play':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ marginLeft: '1.5px' }}>
          <path d="M8 5v14l11-7z" />
        </svg>
      );
    case 'pause':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
        </svg>
      );
    case 'chat':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case 'convert':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 2.1l4 4-4 4" />
          <path d="M3 12.2v-2a4 4 0 0 1 4-4h12.8M7 21.9l-4-4 4-4" />
          <path d="M21 11.8v2a4 4 0 0 1-4 4H4.2" />
        </svg>
      );
    case 'timer':
    case 'stopwatch':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="13" r="8" />
          <path d="M12 9v4l2.5 2.5" />
          <path d="M10 2h4" />
          <path d="M12 2v3" />
        </svg>
      );
    case 'skill':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
      );
    case 'music':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      );
    case 'mic':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="22" />
          <line x1="8" y1="22" x2="16" y2="22" />
        </svg>
      );
    case 'captions':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="4" width="20" height="16" rx="3" />
          <path d="M10 10.5a2.5 2.5 0 1 0 0 3" />
          <path d="M17 10.5a2.5 2.5 0 1 0 0 3" />
        </svg>
      );
    case 'grid':
    case 'apps':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill={color} style={{ display: 'inline-block', verticalAlign: 'middle' }}>
          <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.5" />
          <rect x="9" y="1.5" width="5.5" height="5.5" rx="1.5" />
          <rect x="1.5" y="9" width="5.5" height="5.5" rx="1.5" />
          <rect x="9" y="9" width="5.5" height="5.5" rx="1.5" />
        </svg>
      );
    case 'integrations':
    case 'plug':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22v-5" />
          <path d="M9 8V2" />
          <path d="M15 8V2" />
          <path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" />
        </svg>
      );
    case 'bell':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      );
    case 'chrome':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="4" />
          <line x1="21.17" y1="8" x2="12" y2="8" />
          <line x1="3.95" y1="6.06" x2="8.54" y2="14" />
          <line x1="10.88" y1="21.94" x2="15.46" y2="14" />
        </svg>
      );
    case 'file':
    case 'doc':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      );
    case 'camera':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
          <circle cx="12" cy="13" r="3" />
        </svg>
      );
    case 'location':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      );
    case 'contacts':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case 'calendar':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
    case 'upload':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      );
    case 'external':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      );
    case 'note':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15.5 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z" />
          <polyline points="14 3 14 9 21 9" />
        </svg>
      );
    case 'gmail':
    case 'github':
    case 'notion':
    case 'figma':
    case 'vscode':
    case 'meta':
    case 'linear':
    case 'slack':
    case 'discord':
    case 'googlecalendar':
    case 'googlesheets':
    case 'spotify':
    case 'jira':
    case 'twitter':
    case 'asana':
    case 'trello':
    case 'hubspot':
    case 'supabase':
    case 'composio':
      return (
        <img
          src={`./logos/${name}.png`}
          width={size}
          height={size}
          alt={name}
          style={{ objectFit: 'contain', display: 'inline-block', verticalAlign: 'middle' }}
          onError={(e) => {
            (e.currentTarget as HTMLElement).style.display = 'none';
          }}
        />
      );
    default:
      return null;
  }
};

const DEFAULT_WALLPAPERS: WallpaperTheme[] = [
  {
    id: 1,
    title: 'Cyberpunk Neon',
    url: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=2560&q=90',
    thumb: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=600&q=80',
    accent: '#38BDF8',
    accentSecondary: '#818CF8',
    pillBg: 'rgba(56, 189, 248, 0.22)',
    rowBg: 'rgba(56, 189, 248, 0.14)',
    darkText: '#06131D',
    darkSubText: 'rgba(6, 19, 29, 0.72)',
  },
  {
    id: 2,
    title: 'Cosmic Nebula',
    url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=2560&q=90',
    thumb: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=600&q=80',
    accent: '#C084FC',
    accentSecondary: '#F472B6',
    pillBg: 'rgba(192, 132, 252, 0.22)',
    rowBg: 'rgba(192, 132, 252, 0.14)',
    darkText: '#180B24',
    darkSubText: 'rgba(24, 11, 36, 0.72)',
  },
  {
    id: 3,
    title: 'Aurora Borealis',
    url: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?auto=format&fit=crop&w=2560&q=90',
    thumb: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?auto=format&fit=crop&w=600&q=80',
    accent: '#34D399',
    accentSecondary: '#38BDF8',
    pillBg: 'rgba(52, 211, 153, 0.22)',
    rowBg: 'rgba(52, 211, 153, 0.14)',
    darkText: '#061A13',
    darkSubText: 'rgba(6, 26, 19, 0.72)',
  },
  {
    id: 4,
    title: 'Radiant Sunset',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2560&q=90',
    thumb: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80',
    accent: '#FB923C',
    accentSecondary: '#F43F5E',
    pillBg: 'rgba(251, 146, 60, 0.22)',
    rowBg: 'rgba(251, 146, 60, 0.14)',
    darkText: '#220D04',
    darkSubText: 'rgba(34, 13, 4, 0.72)',
  },
  {
    id: 5,
    title: 'Tokyo Twilight',
    url: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=2560&q=90',
    thumb: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=600&q=80',
    accent: '#E879F9',
    accentSecondary: '#60A5FA',
    pillBg: 'rgba(232, 121, 249, 0.22)',
    rowBg: 'rgba(232, 121, 249, 0.14)',
    darkText: '#1C0B20',
    darkSubText: 'rgba(28, 11, 32, 0.72)',
  },
  {
    id: 6,
    title: 'Emerald Peak',
    url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=2560&q=90',
    thumb: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=600&q=80',
    accent: '#4ADE80',
    accentSecondary: '#2DD4BF',
    pillBg: 'rgba(74, 222, 128, 0.22)',
    rowBg: 'rgba(74, 222, 128, 0.14)',
    darkText: '#06170C',
    darkSubText: 'rgba(6, 23, 12, 0.72)',
  },
  {
    id: 7,
    title: 'Cherry Horizon',
    url: 'https://images.unsplash.com/photo-1522383225653-ed111181a951?auto=format&fit=crop&w=2560&q=90',
    thumb: 'https://images.unsplash.com/photo-1522383225653-ed111181a951?auto=format&fit=crop&w=600&q=80',
    accent: '#F472B6',
    accentSecondary: '#FB7185',
    pillBg: 'rgba(244, 114, 182, 0.22)',
    rowBg: 'rgba(244, 114, 182, 0.14)',
    darkText: '#210815',
    darkSubText: 'rgba(33, 8, 21, 0.72)',
  },
  {
    id: 8,
    title: 'Autumn Glade',
    url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=2560&q=90',
    thumb: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=600&q=80',
    accent: '#F59E0B',
    accentSecondary: '#EF4444',
    pillBg: 'rgba(245, 158, 11, 0.22)',
    rowBg: 'rgba(245, 158, 11, 0.14)',
    darkText: '#201303',
    darkSubText: 'rgba(32, 19, 3, 0.72)',
  },
  {
    id: 9,
    title: 'Solar Flare',
    url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=2560&q=90',
    thumb: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80',
    accent: '#F97316',
    accentSecondary: '#E11D48',
    pillBg: 'rgba(249, 115, 22, 0.22)',
    rowBg: 'rgba(249, 115, 22, 0.14)',
    darkText: '#220803',
    darkSubText: 'rgba(34, 8, 3, 0.72)',
  },
  {
    id: 10,
    title: 'Bioluminescent Reef',
    url: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=2560&q=90',
    thumb: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=600&q=80',
    accent: '#06B6D4',
    accentSecondary: '#8B5CF6',
    pillBg: 'rgba(6, 182, 212, 0.22)',
    rowBg: 'rgba(6, 182, 212, 0.14)',
    darkText: '#04181D',
    darkSubText: 'rgba(4, 24, 29, 0.72)',
  },
  {
    id: 11,
    title: 'Neon Tokyo Alley',
    url: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=2560&q=90',
    thumb: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=600&q=80',
    accent: '#D946EF',
    accentSecondary: '#06B6D4',
    pillBg: 'rgba(217, 70, 239, 0.22)',
    rowBg: 'rgba(217, 70, 239, 0.14)',
    darkText: '#1F0624',
    darkSubText: 'rgba(31, 6, 36, 0.72)',
  },
  {
    id: 12,
    title: 'Starlight Glacier',
    url: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=2560&q=90',
    thumb: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=600&q=80',
    accent: '#38BDF8',
    accentSecondary: '#6366F1',
    pillBg: 'rgba(56, 189, 248, 0.22)',
    rowBg: 'rgba(56, 189, 248, 0.14)',
    darkText: '#06131D',
    darkSubText: 'rgba(6, 19, 29, 0.72)',
  },
  {
    id: 13,
    title: 'Prismatic Mirage',
    url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=2560&q=90',
    thumb: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=600&q=80',
    accent: '#EC4899',
    accentSecondary: '#8B5CF6',
    pillBg: 'rgba(236, 72, 153, 0.22)',
    rowBg: 'rgba(236, 72, 153, 0.14)',
    darkText: '#24061A',
    darkSubText: 'rgba(36, 6, 26, 0.72)',
  },
  {
    id: 14,
    title: 'Electric Cyber Lake',
    url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=2560&q=90',
    thumb: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80',
    accent: '#06B6D4',
    accentSecondary: '#10B981',
    pillBg: 'rgba(6, 182, 212, 0.22)',
    rowBg: 'rgba(6, 182, 212, 0.14)',
    darkText: '#04171A',
    darkSubText: 'rgba(4, 23, 26, 0.72)',
  },
  {
    id: 15,
    title: 'Magma Flare',
    url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=2560&q=90',
    thumb: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&q=80',
    accent: '#EF4444',
    accentSecondary: '#F59E0B',
    pillBg: 'rgba(239, 68, 68, 0.22)',
    rowBg: 'rgba(239, 68, 68, 0.14)',
    darkText: '#220404',
    darkSubText: 'rgba(34, 4, 4, 0.72)',
  },
  {
    id: 16,
    title: 'Violet Dreamscape',
    url: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=2560&q=90',
    thumb: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=600&q=80',
    accent: '#8B5CF6',
    accentSecondary: '#F43F5E',
    pillBg: 'rgba(139, 92, 246, 0.22)',
    rowBg: 'rgba(139, 92, 246, 0.14)',
    darkText: '#130626',
    darkSubText: 'rgba(19, 6, 38, 0.72)',
  },
];


const LOADOUT_CARDS: LoadoutCardItem[] = [
  {
    id: 'soul_kibo_mk1',
    slot: 'Soul',
    name: 'MK-I Cobalt',
    rarity: 'STANDARD',
    description: 'Factory-calibrated titanium droid core with dual-axis gyroscope and cyan LED optics.',
    cost: 0,
    skinKey: SOUL_SKINS[0]?.key || 'kibo_mk1_cobalt',
    cardTint: 'linear-gradient(165deg, #3A4B5C 0%, #28333E 55%, #1D2228 100%)',
    iconKind: 'soul',
  },
  {
    id: 'soul_kitsune',
    slot: 'Soul',
    name: 'Sakura Mochi',
    rarity: 'RARE',
    description: 'Soft pastel rose chassis with warm cherry-blossom optics and playful blush glow.',
    cost: 120,
    skinKey: SOUL_SKINS[1]?.key || SOUL_SKINS[0]?.key,
    cardTint: 'linear-gradient(165deg, #5C2844 0%, #3E1C2F 60%, #26121E 100%)',
    iconKind: 'soul',
  },
  {
    id: 'soul_kodama',
    slot: 'Soul',
    name: 'Matcha Mint',
    rarity: 'RARE',
    description: 'Crisp botanical mint telemetry core crafted for calm, deep focus sessions.',
    cost: 220,
    skinKey: SOUL_SKINS[2]?.key || SOUL_SKINS[0]?.key,
    cardTint: 'linear-gradient(165deg, #2E4E42 0%, #213830 60%, #172621 100%)',
    iconKind: 'soul',
  },
  {
    id: 'soul_raijin',
    slot: 'Soul',
    name: 'Crimson Nova',
    rarity: 'EPIC',
    description: 'High-energy ruby thruster shell with fiery coral visor optics.',
    cost: 400,
    skinKey: SOUL_SKINS[3]?.key || SOUL_SKINS[0]?.key,
    cardTint: 'linear-gradient(165deg, #682832 0%, #491C24 60%, #301218 100%)',
    iconKind: 'soul',
  },
  {
    id: 'soul_amaterasu',
    slot: 'Soul',
    name: 'Mango Sunburst',
    rarity: 'EPIC',
    description: 'Bright golden-mango anodized pod radiating warm citrus sunshine.',
    cost: 650,
    skinKey: SOUL_SKINS[4]?.key || SOUL_SKINS[0]?.key,
    cardTint: 'linear-gradient(165deg, #5A4B30 0%, #403522 60%, #2B2418 100%)',
    iconKind: 'soul',
  },
  {
    id: 'soul_void',
    slot: 'Soul',
    name: 'Cyber Grape',
    rarity: 'PROTOTYPE',
    description: 'Ultraviolet neon synth core. Unlocks the zero-point Gravity Well module automatically.',
    cost: 1000,
    skinKey: SOUL_SKINS[SOUL_SKINS.length - 1]?.key || 'flame_void',
    cardTint: 'linear-gradient(165deg, #463A59 0%, #31283F 55%, #211B2B 100%)',
    iconKind: 'void',
  },
  {
    id: 'voice_charon',
    slot: 'Voice',
    name: 'Charon',
    description: 'Standard tactical synth voice module',
    cost: 0,
    cardTint: 'linear-gradient(165deg, #46575E 0%, #3B4547 55%, #3C3935 100%)',
    iconKind: 'wave',
  },
  {
    id: 'voice_aoede',
    slot: 'Voice',
    name: 'Aoede',
    description: 'Warm, articulate studio cadence',
    cost: 60,
    cardTint: 'linear-gradient(165deg, #43545A 0%, #354145 60%, #2E3436 100%)',
    iconKind: 'wave',
  },
  {
    id: 'voice_fenrir',
    slot: 'Voice',
    name: 'Fenrir',
    description: 'Deep, low-frequency sub-bass resonator',
    cost: 100,
    cardTint: 'linear-gradient(165deg, #3F4E54 0%, #333E42 60%, #2A3133 100%)',
    iconKind: 'lock',
  },
  {
    id: 'voice_puck',
    slot: 'Voice',
    name: 'Puck',
    description: 'Fast, kinetic high-energy operator',
    cost: 130,
    cardTint: 'linear-gradient(165deg, #445359 0%, #364145 60%, #2D3436 100%)',
    iconKind: 'lock',
  },
  {
    id: 'pers_true_chad',
    slot: 'Personality',
    name: 'Prime Operator',
    rarity: 'MODULE',
    description: 'Concise, sharp, zero filler. Executes commands and reports telemetry cleanly.',
    cost: 0,
    cardTint: 'linear-gradient(165deg, #5A4736 0%, #48392C 55%, #3D3127 100%)',
    iconKind: 'chad',
  },
  {
    id: 'pers_new',
    slot: 'Personality',
    name: 'Custom Logic',
    rarity: 'MODULE',
    description: 'Install a custom behavioral prompt matrix.',
    cost: 100,
    cardTint: 'linear-gradient(165deg, #594635 0%, #4A3B2D 55%, #41352A 100%)',
    iconKind: 'plus',
  },
  {
    id: 'abil_collapse',
    slot: 'Abilities',
    name: 'Gravity Well',
    description: 'Bundled exclusively with the MK-0 Singularity chassis.',
    cost: 0,
    notForSale: true,
    cardTint: 'linear-gradient(165deg, #594D3C 0%, #483E30 55%, #3D3529 100%)',
    iconKind: 'collapse_eye',
  },
  {
    id: 'abil_sidearm',
    slot: 'Abilities',
    name: 'Pulse Emitter',
    description: 'Projects a kinetic target pulse onto your active desktop.',
    cost: 400,
    cardTint: 'linear-gradient(165deg, #594D3C 0%, #483E30 55%, #3D3529 100%)',
    iconKind: 'sidearm_bullet',
  },
];

const NAV_TABS: ReadonlyArray<{
  id: NavTab;
  label: string;
  icon: string;
  width: number;
}> = [
  { id: 'Chat', label: 'Chat', icon: 'chat', width: 62 },
  { id: 'Agents', label: 'Agents', icon: 'bolt', width: 72 },
  { id: 'Convert', label: 'Convert', icon: 'convert', width: 76 },
  { id: 'Focus', label: 'Focus', icon: 'timer', width: 66 },
  { id: 'Skills', label: 'Skills', icon: 'skill', width: 64 },
  { id: 'Media', label: 'Media', icon: 'music', width: 66 },
  { id: 'Apps', label: 'Apps +', icon: 'apps', width: 78 },
];

const DEFAULT_KIBO_SKILLS: KiboSkillItem[] = [
  {
    id: 'skill_frontend_taste',
    name: 'design-taste-frontend (SKILL.md)',
    description: 'High-craft agency web design system: Figtree typography, editorial bento grids, hardware-accelerated motion, and zero generic AI slop when building websites.',
    content: `# Frontend Design Taste Skill\n- Use Figtree typography, crisp 1px borders, balanced whitespace, and dark obsidian or warm ivory editorial palettes.\n- Avoid generic gradients, cluttered nested cards, or placeholder text.\n- Include interactive micro-states, responsive bento layouts, and complete production-ready HTML/CSS/JS.`,
    enabled: true,
    builtIn: true,
  },
  {
    id: 'skill_full_output',
    name: 'full-output-enforcement (SKILL.md)',
    description: 'Enforces complete, unabridged code and document generation with zero placeholders or truncated sections.',
    enabled: true,
    builtIn: true,
    content: `# Full Output Enforcement Skill\n- Never truncate code or leave "// TODO" placeholders.\n- Deliver complete, self-contained, immediately runnable implementations.`,
  },
  {
    id: 'skill_file_converter',
    name: 'universal-document-converter (SKILL.md)',
    description: 'Non-destructive local document conversion (PDF to Word .docx, Word to PDF, Markdown/HTML/CSV/JSON/Images) while preserving original source files.',
    enabled: true,
    builtIn: true,
    content: `# Universal Document Converter Skill\n- Always preserve the user's original source file when converting.\n- Support voice commands like "Convert my resume.pdf to Word" using the convert_file tool.`,
  },
  {
    id: 'skill_desktop_operator',
    name: 'precision-desktop-operator (SKILL.md)',
    description: 'Direct concise voice responses and fast UI automation across Chrome, Notion, GitHub, VS Code, and Windows.',
    enabled: false,
    builtIn: true,
    content: `# Precision Desktop Operator Skill\n- Keep spoken responses under 2 sentences.\n- Prioritize direct execution over lengthy explanations.`,
  },
];

const APP_WIN_W = 880;
const APP_WIN_H = 550;

const STAGE_CENTER_X = 440;
const STAGE_CENTER_Y = 215;
const PORTAL_OUTER_R = 57;

const ORBIT_SLOTS: ReadonlyArray<{
  slot: LoadoutSlotType;
  baseAngle: number;
  radiusX: number;
  radiusY: number;
  icon: string;
  iconColor: string;
}> = [
  { slot: 'Soul', baseAngle: -Math.PI / 2, radiusX: 154, radiusY: 118, icon: 'sparkles', iconColor: '#A78BFA' },
  { slot: 'Personality', baseAngle: 0, radiusX: 196, radiusY: 118, icon: 'smile', iconColor: '#FB923C' },
  { slot: 'Voice', baseAngle: Math.PI / 2, radiusX: 154, radiusY: 118, icon: 'waveform', iconColor: '#38BDF8' },
  { slot: 'Abilities', baseAngle: Math.PI, radiusX: 204, radiusY: 118, icon: 'rocket', iconColor: '#4ADE80' },
];



interface IntegrationAppItem {
  id: string;
  slug: string;
  name: string;
  category: 'Productivity' | 'Developer' | 'Communication' | 'Media';
  description: string;
  logo: string;
  viaComposio?: boolean;
}

const INTEGRATION_APPS: IntegrationAppItem[] = [
  {
    id: 'gmail',
    slug: 'gmail',
    name: 'Gmail',
    category: 'Productivity',
    description: 'Read & send emails, search threads, draft executive replies and organize inbox.',
    logo: './logos/gmail.png',
    viaComposio: true,
  },
  {
    id: 'github',
    slug: 'github',
    name: 'GitHub',
    category: 'Developer',
    description: 'Manage repositories, pull requests, issue workflows, branches, and CI actions.',
    logo: './logos/github.png',
    viaComposio: true,
  },
  {
    id: 'notion',
    slug: 'notion',
    name: 'Notion',
    category: 'Productivity',
    description: 'Query, read, and append to databases, design docs, wikis, and sprint trackers.',
    logo: './logos/notion.png',
    viaComposio: true,
  },
  {
    id: 'googlecalendar',
    slug: 'googlecalendar',
    name: 'Google Calendar',
    category: 'Productivity',
    description: 'Schedule meetings, check upcoming agenda, create event invites and focus blocks.',
    logo: './logos/googlecalendar.png',
    viaComposio: true,
  },
  {
    id: 'googlesheets',
    slug: 'googlesheets',
    name: 'Google Sheets',
    category: 'Productivity',
    description: 'Read, populate, and analyze spreadsheet rows, format columns, and export data.',
    logo: './logos/googlesheets.png',
    viaComposio: true,
  },
  {
    id: 'slack',
    slug: 'slack',
    name: 'Slack',
    category: 'Communication',
    description: 'Send direct messages, post channel updates, monitor unread discussions and alerts.',
    logo: './logos/slack.png',
    viaComposio: true,
  },
  {
    id: 'discord',
    slug: 'discord',
    name: 'Discord',
    category: 'Communication',
    description: 'Trigger community bots, post notifications to servers, manage webhooks.',
    logo: './logos/discord.png',
    viaComposio: true,
  },
  {
    id: 'linear',
    slug: 'linear',
    name: 'Linear',
    category: 'Developer',
    description: 'Sync issue tracking, sprint cycles, roadmap milestones, and team backlogs.',
    logo: './logos/linear.png',
    viaComposio: true,
  },
  {
    id: 'figma',
    slug: 'figma',
    name: 'Figma',
    category: 'Developer',
    description: 'Inspect design frames, extract color palettes, export SVGs and generate React UI.',
    logo: './logos/figma.png',
    viaComposio: true,
  },
  {
    id: 'vscode',
    slug: 'vscode',
    name: 'Visual Studio Code',
    category: 'Developer',
    description: 'Live active editor context, open workspace folders, and execute file modifications.',
    logo: './logos/vscode.png',
    viaComposio: false,
  },
  {
    id: 'chrome',
    slug: 'chrome',
    name: 'Google Chrome',
    category: 'Developer',
    description: 'Read foreground web tab URL & DOM, automate browser tasks with Dev Mode bridge.',
    logo: './logos/chrome.png',
    viaComposio: false,
  },
  {
    id: 'spotify',
    slug: 'spotify',
    name: 'Spotify',
    category: 'Media',
    description: 'Windows SMTC media playback, playlist controls, and dynamic album color glass.',
    logo: './logos/spotify.png',
    viaComposio: false,
  },
  {
    id: 'jira',
    slug: 'jira',
    name: 'Jira Software',
    category: 'Productivity',
    description: 'Enterprise ticket workflows, agile Kanban boards, and issue lifecycle updates.',
    logo: './logos/jira.png',
    viaComposio: true,
  },
  {
    id: 'twitter',
    slug: 'twitter',
    name: 'Twitter / X',
    category: 'Media',
    description: 'Post threads, monitor brand keywords, fetch tweets, and track social engagement.',
    logo: './logos/twitter.png',
    viaComposio: true,
  },
  {
    id: 'meta',
    slug: 'meta',
    name: 'Meta Ads Manager',
    category: 'Media',
    description: 'Telemetry queries across Facebook & Instagram ad campaigns, budgets, and CTR.',
    logo: './logos/meta.png',
    viaComposio: true,
  },
  {
    id: 'supabase',
    slug: 'supabase',
    name: 'Supabase',
    category: 'Developer',
    description: 'Execute Postgres queries, manage user authentication tables and storage buckets.',
    logo: './logos/supabase.png',
    viaComposio: true,
  },
  {
    id: 'asana',
    slug: 'asana',
    name: 'Asana',
    category: 'Productivity',
    description: 'Manage cross-functional team projects, assign deadlines, and update task boards.',
    logo: './logos/asana.png',
    viaComposio: true,
  },
  {
    id: 'trello',
    slug: 'trello',
    name: 'Trello',
    category: 'Productivity',
    description: 'Organize cards, lists, checklists, and project workflows visually.',
    logo: './logos/trello.png',
    viaComposio: true,
  },
  {
    id: 'hubspot',
    slug: 'hubspot',
    name: 'HubSpot CRM',
    category: 'Productivity',
    description: 'Manage sales pipelines, log customer interactions, and synchronize contact leads.',
    logo: './logos/hubspot.png',
    viaComposio: true,
  },
];

export const KiboApp: React.FC = () => {
  const isElectron = typeof window !== 'undefined' && Boolean(window.kiboAPI);

  const [apiKey, setApiKey] = useState<string>(() => {
    const saved = localStorage.getItem('kibo_gemini_key');
    if (saved && saved.trim()) return saved.trim();
    return '';
  });
  const [geminiDraftKey, setGeminiDraftKey] = useState<string>(() => {
    const saved = localStorage.getItem('kibo_gemini_key');
    if (saved && saved.trim()) return saved.trim();
    return '';
  });
  const [tavilyKey, setTavilyKey] = useState<string>(() => localStorage.getItem('kibo_tavily_key') || '');
  const [tavilyDraftKey, setTavilyDraftKey] = useState<string>(() => localStorage.getItem('kibo_tavily_key') || '');
  const [composioApiKey, setComposioApiKey] = useState<string>(() => {
    const stored = localStorage.getItem('kibo_composio_key');
    if (!stored || stored === 'ak_WRHAv3a87hZMLRtQwcRK') {
      localStorage.removeItem('kibo_composio_key');
      return '';
    }
    return stored;
  });
  const [composioDraftKey, setComposioDraftKey] = useState<string>(() => {
    const stored = localStorage.getItem('kibo_composio_key');
    if (!stored || stored === 'ak_WRHAv3a87hZMLRtQwcRK') {
      return '';
    }
    return stored;
  });
  const [composioKeySavedAlert, setComposioKeySavedAlert] = useState<string | null>(null);
  const [composioStatus, setComposioStatus] = useState<{
    connected: boolean;
    maskedKey?: string;
    accountsCount: number;
    accounts: Array<{
      id: string;
      slug: string;
      status: string;
      profileName?: string;
      workspaceName?: string;
      avatarUrl?: string;
      email?: string;
      createdAt?: string;
    }>;
  }>({
    connected: true,
    maskedKey: 'ak_WRHA...wcRK',
    accountsCount: 0,
    accounts: [],
  });
  const [composioConnectingSlug, setComposioConnectingSlug] = useState<string | null>(null);
  const composioPollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (composioPollTimerRef.current) {
        clearInterval(composioPollTimerRef.current);
      }
    };
  }, []);
  const [integrationsCategoryFilter, setIntegrationsCategoryFilter] = useState<'All' | 'Productivity' | 'Developer' | 'Communication' | 'Media'>('All');
  const [integrationsSearch, setIntegrationsSearch] = useState<string>('');
  const [showConnectModal, setShowConnectModal] = useState<boolean>(false);
  const [notchApiAlert, setNotchApiAlert] = useState<{ type: 'missing_key' | 'rate_limit'; text: string } | null>(null);
  const CURRENT_APP_VERSION = '1.0.1';
  const [availableUpdate, setAvailableUpdate] = useState<{
    version: string;
    downloadUrl: string;
    title?: string;
    notes?: string;
  } | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [settingsCategory, setSettingsCategory] = useState<'Account' | 'General' | 'Core' | 'Voice' | 'Integrations' | 'Agents' | 'Shortcuts' | 'System'>('Account');
  const [updateCheckStatus, setUpdateCheckStatus] = useState<string | null>(null);

  const checkForAppUpdates = useCallback(async (manual = false) => {
    setIsCheckingUpdate(true);
    if (manual) setUpdateCheckStatus('Checking for updates...');
    try {
      const res = await fetch(`https://kiboai.vercel.app/version.json?_t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.version && data.version !== CURRENT_APP_VERSION) {
          setAvailableUpdate(data);
          setUpdateCheckStatus(`New version v${data.version} available!`);
          if (manual) soundFX.playSuccessChime();
          return;
        }
      }
      setAvailableUpdate(null);
      setUpdateCheckStatus(`You're on the latest version · v${CURRENT_APP_VERSION}`);
    } catch {
      if (manual) {
        setUpdateCheckStatus(`You're on version ${CURRENT_APP_VERSION}.`);
      }
    } finally {
      setIsCheckingUpdate(false);
    }
  }, []);
  const [isBooting, setIsBooting] = useState<boolean>(true);
  const [bootPhase, setBootPhase] = useState<'sleeping' | 'awakening' | 'tucking' | 'ready'>('sleeping');
  const [bootExpression, setBootExpression] = useState<'NORMAL' | 'HAPPY' | 'EXCITED'>('HAPPY');

  // Cinematic startup sequence:
  // 1. Starts as small flush bezel sliver ('sleeping')
  // 2. Notch fluidly blossoms open, chime rings, and Kibo awakens with smiling eyes ('awakening')
  // 3. Kibo gently tucks/hides into the notch, and notch slenders into resting tucked state ('tucking')
  // 4. Settles ready for interaction ('ready')
  useEffect(() => {
    const wakeTimer = setTimeout(() => {
      setBootPhase('awakening');
      setBootExpression('HAPPY');
    }, 120);

    const chimeTimer = setTimeout(() => {
      soundFX.playSoulPulse();
    }, 320);

    const gazeTimer = setTimeout(() => {
      setBootExpression('NORMAL');
    }, 950);

    const tuckTimer = setTimeout(() => {
      setBootPhase('tucking');
      setIsTucked(true);
    }, 1650);

    const readyTimer = setTimeout(() => {
      setBootPhase('ready');
      setIsBooting(false);
    }, 2250);

    return () => {
      clearTimeout(wakeTimer);
      clearTimeout(chimeTimer);
      clearTimeout(gazeTimer);
      clearTimeout(tuckTimer);
      clearTimeout(readyTimer);
    };
  }, []);

  // Synchronize keys, user name, and memory with persistent disk storage in userData
  useEffect(() => {
    const api = (window as any).kiboAPI;
    if (!api?.getStoredSettings) return;
    api.getStoredSettings().then((stored: Record<string, any>) => {
      if (!stored || typeof stored !== 'object') return;
      if (stored.kibo_gemini_key && typeof stored.kibo_gemini_key === 'string') {
        const val = stored.kibo_gemini_key.trim();
        setApiKey(val);
        setGeminiDraftKey(val);
        localStorage.setItem('kibo_gemini_key', val);
      }
      if (stored.kibo_tavily_key && typeof stored.kibo_tavily_key === 'string') {
        const val = stored.kibo_tavily_key.trim();
        setTavilyKey(val);
        setTavilyDraftKey(val);
        localStorage.setItem('kibo_tavily_key', val);
      }
      if (stored.kibo_user_name && typeof stored.kibo_user_name === 'string') {
        const cleanName = stored.kibo_user_name.trim();
        localStorage.setItem('kibo_user_name', cleanName);
        setUserName(cleanName);
      }
      if (stored.kibo_user_memory && typeof stored.kibo_user_memory === 'string') {
        localStorage.setItem('kibo_user_memory', stored.kibo_user_memory);
      }
      if (stored.kibo_composio_key && typeof stored.kibo_composio_key === 'string') {
        const val = stored.kibo_composio_key.trim();
        if (val === 'ak_WRHAv3a87hZMLRtQwcRK') {
          api?.saveStoredSettings?.({ kibo_composio_key: '' });
          localStorage.removeItem('kibo_composio_key');
          setComposioApiKey('');
          setComposioDraftKey('');
        } else {
          setComposioApiKey(val);
          setComposioDraftKey(val);
          localStorage.setItem('kibo_composio_key', val);
        }
      }
    }).catch(() => {});
  }, []);

  const refreshComposioStatus = useCallback(async (keyOverride?: string) => {
    const api = (window as any).kiboAPI;
    if (!api?.composioGetStatus) return;
    try {
      const res = await api.composioGetStatus(keyOverride || composioApiKey);
      if (res && res.success) {
        setComposioStatus({
          connected: true,
          maskedKey: res.maskedKey,
          accountsCount: res.accountsCount || (res.accounts?.length || 0),
          accounts: res.accounts || [],
        });
      }
    } catch (_) {}
  }, [composioApiKey]);

  useEffect(() => {
    refreshComposioStatus();
  }, [refreshComposioStatus]);

  // Extract dynamic color theme from active Windows desktop wallpaper (deferred past startup animation)
  useEffect(() => {
    const timer = setTimeout(() => {
      const api = (window as any).kiboAPI;
      if (api?.getCurrentWallpaperTheme) {
        api.getCurrentWallpaperTheme().then((theme: any) => {
          if (theme && theme.accent) {
            const safeUrl = theme.wallpaperUrl || (theme.wallpaperPath ? `http://127.0.0.1:51742/api/wallpaper?path=${encodeURIComponent(theme.wallpaperPath)}` : '');
            setAdaptiveWallpaperTheme({
              id: 9999,
              title: 'Current Desktop Wallpaper',
              url: safeUrl,
              thumb: safeUrl,
              accent: theme.accent,
              accentSecondary: theme.accentSecondary,
              pillBg: theme.pillBg,
              rowBg: theme.rowBg,
              darkText: theme.darkText || '#F8FAFC',
              darkSubText: theme.darkSubText || '#94A3B8',
            });
          }
        }).catch(() => {});
      }
    }, 2400);
    return () => clearTimeout(timer);
  }, []);

  const [onboardingStep, setOnboardingStep] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null;
    const completed = localStorage.getItem('kibo_onboarded_v1');
    return completed === 'true' ? null : 0;
  });
  const [lastHotkeyAction, setLastHotkeyAction] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      checkForAppUpdates(false);
    }, 2800);
    return () => clearTimeout(timer);
  }, [checkForAppUpdates]);

  const completeOnboarding = useCallback(() => {
    const api = (window as any).kiboAPI;
    if (geminiDraftKey.trim()) {
      const val = geminiDraftKey.trim();
      setApiKey(val);
      localStorage.setItem('kibo_gemini_key', val);
      api?.saveStoredSettings?.({ kibo_gemini_key: val });
      setNotchApiAlert(null);
    }
    if (tavilyDraftKey.trim()) {
      const val = tavilyDraftKey.trim();
      setTavilyKey(val);
      localStorage.setItem('kibo_tavily_key', val);
      api?.saveStoredSettings?.({ kibo_tavily_key: val });
    }
    localStorage.setItem('kibo_onboarded_v1', 'true');
    api?.setAlwaysOnTop?.(true);
    setOnboardingStep(null);
  }, [geminiDraftKey, tavilyDraftKey]);

  const [autoTuckEnabled, setAutoTuckEnabled] = useState<boolean>(() => localStorage.getItem('kibo_autotuck') !== 'false');
  const [voiceFeedbackEnabled, setVoiceFeedbackEnabled] = useState<boolean>(() => localStorage.getItem('kibo_voice_tts') !== 'false');
  const [launchAtStartup, setLaunchAtStartup] = useState<boolean>(() => localStorage.getItem('kibo_startup') !== 'false');
  const [sfxEnabled, setSfxEnabled] = useState<boolean>(() => soundFX.isEnabled());

  useEffect(() => {
    window.kiboAPI?.getStartupSetting?.().then((enabled: boolean) => {
      if (typeof enabled === 'boolean') {
        setLaunchAtStartup(enabled);
        localStorage.setItem('kibo_startup', String(enabled));
      }
    }).catch(() => {});
  }, []);

  // Embers Economy
  const [embers, setEmbers] = useState<number>(() => {
    const saved = localStorage.getItem('kibo_watts');
    return saved ? parseInt(saved, 10) : 67;
  });
  const [dailyEmberClaimedDate, setDailyEmberClaimedDate] = useState<string>(() => {
    return localStorage.getItem('kibo_daily_watt_date') || '';
  });
  const [rewardedTaskIds, setRewardedTaskIds] = useState<number[]>(() => {
    const todayKey = new Date().toDateString();
    const savedDate = localStorage.getItem('kibo_watt_date');
    if (savedDate !== todayKey) {
      localStorage.setItem('kibo_watt_date', todayKey);
      localStorage.setItem('kibo_rewarded_tasks', '[]');
      return [];
    }
    const saved = localStorage.getItem('kibo_rewarded_tasks');
    return saved ? JSON.parse(saved) : [];
  });

  const [hasEarnedEmberToday, setHasEarnedEmberToday] = useState<boolean>(() => {
    return localStorage.getItem('kibo_last_watt_earned_day') === new Date().toDateString();
  });
  const isSoulDull = !hasEarnedEmberToday && rewardedTaskIds.length === 0;

  const [unlockedCardIds, setUnlockedCardIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('kibo_unlocked_cards');
    return saved ? JSON.parse(saved) : ['soul_kibo_mk1', 'voice_charon', 'pers_true_chad'];
  });
  const [equippedCards, setEquippedCards] = useState<Record<LoadoutSlotType, string>>(() => {
    const saved = localStorage.getItem('kibo_equipped_cards');
    return saved
      ? JSON.parse(saved)
      : {
          Soul: 'soul_kibo_mk1',
          Voice: 'voice_charon',
          Personality: 'pers_true_chad',
          Abilities: 'none',
        };
  });
  const [activeDeckSlot, setActiveDeckSlot] = useState<LoadoutSlotType | null>(null);
  const [deckCardIndex, setDeckCardIndex] = useState<number>(0);

  const [abilityTriggerKey, setAbilityTriggerKey] = useState<string>(
    () => localStorage.getItem('kibo_ability_trigger') || 'M1'
  );
  const [isBindingTrigger, setIsBindingTrigger] = useState<boolean>(false);

  const addEmbers = useCallback((amount: number) => {
    if (amount <= 0) return;
    const todayKey = new Date().toDateString();
    localStorage.setItem('kibo_last_watt_earned_day', todayKey);
    setHasEarnedEmberToday(true);
    setEmbers((prev) => {
      const next = prev + amount;
      localStorage.setItem('kibo_watts', String(next));
      const api = (window as any).kiboAPI;
      api?.syncEmbersState?.({ count: next, isWaiting: false });
      api?.setEmbersCount?.(next);
      return next;
    });
  }, []);

  // Orbit & Spring-Physics Lasso State
  const [orbitRenderTick, setOrbitRenderTick] = useState<number>(0);
  const orbitAngleRef = useRef<number>(0);
  const draggingNodeSlotRef = useRef<LoadoutSlotType | null>(null);
  const [draggingNodeSlot, setDraggingNodeSlot] = useState<LoadoutSlotType | null>(null);

  const nodePhysicsRef = useRef<
    Record<
      LoadoutSlotType,
      { x: number; y: number; vx: number; vy: number; bendX: number; bendY: number; bvx: number; bvy: number }
    >
  >({
    Soul: { x: 0, y: 0, vx: 0, vy: 0, bendX: STAGE_CENTER_X, bendY: STAGE_CENTER_Y - 60, bvx: 0, bvy: 0 },
    Personality: { x: 0, y: 0, vx: 0, vy: 0, bendX: STAGE_CENTER_X + 80, bendY: STAGE_CENTER_Y, bvx: 0, bvy: 0 },
    Voice: { x: 0, y: 0, vx: 0, vy: 0, bendX: STAGE_CENTER_X, bendY: STAGE_CENTER_Y + 60, bvx: 0, bvy: 0 },
    Abilities: { x: 0, y: 0, vx: 0, vy: 0, bendX: STAGE_CENTER_X - 80, bendY: STAGE_CENTER_Y, bvx: 0, bvy: 0 },
  });

  const nodeDragStartRef = useRef<{ startX: number; startY: number; origX: number; origY: number; moved: boolean }>({
    startX: 0,
    startY: 0,
    origX: 0,
    origY: 0,
    moved: false,
  });

  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const initialExpanded = urlParams?.get('expanded') === 'true';
  const initialTab =
    urlParams?.get('settings') === 'true' || urlParams?.get('loadout') === 'true'
      ? 'Settings'
      : (urlParams?.get('tab') as NavTab) || 'Chat';

  const [showCompanionWindow, setShowCompanionWindow] = useState<boolean>(false);
  const [companionDockTab, setCompanionDockTab] = useState<'soul' | 'settings'>(
    () => (urlParams?.get('loadout') === 'true' ? 'soul' : 'settings')
  );
  const [settingsSection, setSettingsSection] = useState<CompanionSection>('API keys');
  const [settingsSearch, setSettingsSearch] = useState<string>('');

  const [appWindowPos, setAppWindowPos] = useState<{ x: number; y: number }>(() => ({
    x: typeof window !== 'undefined' ? Math.max(20, Math.round((window.innerWidth - APP_WIN_W) / 2)) : 260,
    y: 78,
  }));
  const [isDraggingAppWin, setIsDraggingAppWin] = useState(false);
  const dragOffsetRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  const [selectedSkinKey, setSelectedSkinKey] = useState<string>(
    () => localStorage.getItem('kibo_chassis') || (SOUL_SKINS[0]?.key ?? 'kibo_mk1_cobalt')
  );

  const [isTucked, setIsTucked] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(initialExpanded);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [showMediaNotch, setShowMediaNotch] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<NavTab>(initialTab);
  const [soulMode, setSoulMode] = useState<'LISTENING' | 'THINKING' | 'TALKING' | 'MUTED' | 'DANCING'>('LISTENING');
  const [isKiboDancing, setIsKiboDancing] = useState<boolean>(false);
  const danceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [soulAnnoyance, setSoulAnnoyance] = useState<number>(0);
  const [soulIsHit, setSoulIsHit] = useState<boolean>(false);
  const [isBreathingRelief, setIsBreathingRelief] = useState<boolean>(false);
  const hitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const annoyanceDecayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const annoyanceDecayIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reliefBreathTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // =========================================================================
  // NEW STATE: USER MEMORY, CHAT HISTORY, FILE CONVERTER, STOPWATCH, SKILLS, AUDIO & INTEGRATIONS
  // =========================================================================
  const [userName, setUserName] = useState<string>(() => localStorage.getItem('kibo_user_name') || '');

  useEffect(() => {
    const onMemoryUpdated = (e: any) => {
      const updatedName = e?.detail?.userName || localStorage.getItem('kibo_user_name') || '';
      if (updatedName) setUserName(updatedName);
    };
    window.addEventListener('kibo-user-memory-updated', onMemoryUpdated);
    return () => window.removeEventListener('kibo-user-memory-updated', onMemoryUpdated);
  }, []);

  const [chatMessages, setChatMessages] = useState<ChatMessageItem[]>(() => {
    try {
      const saved = localStorage.getItem('kibo_chat_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    const savedName = localStorage.getItem('kibo_user_name') || '';
    return [
      {
        id: 'welcome_1',
        role: 'kibo',
        text: savedName
          ? `Welcome back, ${savedName}. Hold Win + Alt to talk, drag any file to the notch to convert, or ask me to run tasks.`
          : "I'm Kibo, your desktop operator. Hold Win + Alt to talk, drag any file to the notch to convert, or ask me to build websites, run commands, or control your PC.",
        time: 'Ready',
      },
    ];
  });
  const [chatInputText, setChatInputText] = useState<string>('');
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const appendChatMessage = useCallback((msg: Omit<ChatMessageItem, 'id' | 'time'>) => {
    const nowStr = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const entry: ChatMessageItem = {
      ...msg,
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      time: nowStr,
    };
    setChatMessages((prev) => {
      const next = [...prev, entry].slice(-80);
      try {
        localStorage.setItem('kibo_chat_history', JSON.stringify(next));
      } catch (_) {}
      return next;
    });
  }, []);

  useEffect(() => {
    if (activeTab === 'Chat' && isExpanded && chatScrollRef.current) {
      const raf = requestAnimationFrame(() => {
        if (chatScrollRef.current) {
          chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [chatMessages, activeTab, isExpanded]);

  // Universal Non-Destructive File Converter State & Smart Notch Storage Drop Box
  const [convertSourceFile, setConvertSourceFile] = useState<{
    filePath: string;
    fileName: string;
    ext: string;
    sizeBytes?: number;
  } | null>(null);
  const [convertTargetFormat, setConvertTargetFormat] = useState<string>('docx');
  const [isConvertingFile, setIsConvertingFile] = useState<boolean>(false);
  const [convertStatusMsg, setConvertStatusMsg] = useState<{ type: 'ok' | 'err' | 'info'; text: string; outputPath?: string } | null>(null);
  const [isConvertDragOver, setIsConvertDragOver] = useState<boolean>(false);
  const [isFileDraggingOverNotch, setIsFileDraggingOverNotch] = useState<boolean>(false);
  const fileDragLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isNativeDialogOpenRef = useRef<boolean>(false);
  const skillFileInputRef = useRef<HTMLInputElement | null>(null);

  const ingestDroppedFileForConvert = useCallback((f: any) => {
    if (!f) return;
    const resolvedPath = window.kiboAPI?.getFilePath?.(f) || f.path || f.name || '';
    const fileName = f.name || resolvedPath.split(/[\\/]/).pop() || 'File';
    const ext = (fileName.split('.').pop() || '').toLowerCase();
    setConvertSourceFile({
      filePath: resolvedPath,
      fileName,
      ext,
      sizeBytes: f.size,
    });
    if (ext === 'pdf') setConvertTargetFormat('docx');
    else if (ext === 'docx' || ext === 'doc') setConvertTargetFormat('pdf');
    else if (ext === 'csv') setConvertTargetFormat('json');
    else if (ext === 'json') setConvertTargetFormat('csv');
    else if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) setConvertTargetFormat('pdf');
    else if (ext === 'md' || ext === 'txt') setConvertTargetFormat('pdf');
    setConvertStatusMsg(null);
    setIsFileDraggingOverNotch(false);
    setIsConvertDragOver(false);
    setIsTucked(false);
    setShowMediaNotch(false);
    setActiveTab('Convert');
    setIsExpanded(true);
    soundFX.playExpand();
  }, []);

  const [recentConversions, setRecentConversions] = useState<ConvertedFileRecord[]>(() => {
    try {
      const saved = localStorage.getItem('kibo_recent_conversions');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return [];
  });

  // Focus Timer + Stopwatch + Sticky Notes + Kibo Dance State
  const [focusSubMode, setFocusSubMode] = useState<'timer' | 'stopwatch'>('timer');
  const [stopwatchMs, setStopwatchMs] = useState<number>(0);
  const [stopwatchRunning, setStopwatchRunning] = useState<boolean>(false);
  const [stopwatchLaps, setStopwatchLaps] = useState<number[]>([]);
  const stopwatchStartRef = useRef<number>(0);

  const [stickyNotes, setStickyNotes] = useState<
    Array<{
      id: string;
      title: string;
      accent: string;
      bgTint: string;
      borderTint: string;
      body: string;
      tasks: Array<{ id: string; text: string; done: boolean }>;
    }>
  >(() => {
    try {
      const saved = localStorage.getItem('kibo_sticky_notes');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return [
      {
        id: 'note_1',
        title: 'Today’s Focus Sprint',
        accent: '#FACC15',
        bgTint: 'rgba(250, 204, 21, 0.08)',
        borderTint: 'rgba(250, 204, 21, 0.28)',
        body: 'Ship UI polish, test voice file converter, and review GitHub release.',
        tasks: [
          { id: 't1', text: 'Polish top notch animations', done: true },
          { id: 't2', text: 'Test PDF to Word conversion', done: false },
        ],
      },
      {
        id: 'note_2',
        title: 'Quick Ideas & Scratchpad',
        accent: '#38BDF8',
        bgTint: 'rgba(56, 189, 248, 0.08)',
        borderTint: 'rgba(56, 189, 248, 0.28)',
        body: 'Remember to connect Chrome Bridge and Notion workspace in Settings.',
        tasks: [
          { id: 't3', text: 'Import custom SKILL.md pack', done: false },
        ],
      },
      {
        id: 'note_3',
        title: 'Reading & Links',
        accent: '#FF6B9D',
        bgTint: 'rgba(255, 107, 157, 0.08)',
        borderTint: 'rgba(255, 107, 157, 0.28)',
        body: 'Ask Kibo with Ctrl + Shift on any article or chart to summarize key metrics.',
        tasks: [],
      },
      {
        id: 'note_4',
        title: 'Wrap-Up Checklist',
        accent: '#10B981',
        bgTint: 'rgba(16, 185, 129, 0.08)',
        borderTint: 'rgba(16, 185, 129, 0.28)',
        body: 'Clean desktop downloads and push latest commits before logging off.',
        tasks: [
          { id: 't4', text: 'Push changes to main repo', done: false },
        ],
      },
    ];
  });
  const [expandedStickyId, setExpandedStickyId] = useState<string | null>(null);
  const [hoveredStickyId, setHoveredStickyId] = useState<string | null>(null);
  const [newStickyTaskInput, setNewStickyTaskInput] = useState<string>('');

  const updateStickyNotes = useCallback(
    (
      updater: (
        prev: typeof stickyNotes
      ) => typeof stickyNotes
    ) => {
      setStickyNotes((prev) => {
        const next = updater(prev);
        try {
          localStorage.setItem('kibo_sticky_notes', JSON.stringify(next));
        } catch (_) {}
        return next;
      });
    },
    []
  );

  useEffect(() => {
    if (!stopwatchRunning) return;
    stopwatchStartRef.current = performance.now() - stopwatchMs;
    const interval = setInterval(() => {
      setStopwatchMs(Math.floor(performance.now() - stopwatchStartRef.current));
    }, 35);
    return () => clearInterval(interval);
  }, [stopwatchRunning]);

  const triggerKiboCelebrationDance = useCallback((durationMs = 5200) => {
    if (danceTimeoutRef.current) clearTimeout(danceTimeoutRef.current);
    setIsKiboDancing(true);
    setSoulMode('DANCING');
    soundFX.playDanceMelody();
    danceTimeoutRef.current = setTimeout(() => {
      setIsKiboDancing(false);
      setSoulMode((curr) => (curr === 'DANCING' ? 'LISTENING' : curr));
    }, durationMs);
  }, []);

  // Skills (SKILL.md) Manager State
  const [skillsList, setSkillsList] = useState<KiboSkillItem[]>(() => {
    try {
      const saved = localStorage.getItem('kibo_skills_list');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    localStorage.setItem('kibo_skills_list', JSON.stringify(DEFAULT_KIBO_SKILLS));
    return DEFAULT_KIBO_SKILLS;
  });
  const [isAddingSkill, setIsAddingSkill] = useState<boolean>(false);
  const [newSkillName, setNewSkillName] = useState<string>('');
  const [newSkillDesc, setNewSkillDesc] = useState<string>('');
  const [newSkillContent, setNewSkillContent] = useState<string>('');

  const updateSkillsList = useCallback((updater: (prev: KiboSkillItem[]) => KiboSkillItem[]) => {
    setSkillsList((prev) => {
      const next = updater(prev);
      try {
        localStorage.setItem('kibo_skills_list', JSON.stringify(next));
      } catch (_) {}
      return next;
    });
  }, []);

  // Voice Captions & Audio Input/Output + Mic Test State
  const [captionsEnabled, setCaptionsEnabled] = useState<boolean>(
    () => localStorage.getItem('kibo_captions_enabled') !== 'false'
  );
  const [audioInputDevices, setAudioInputDevices] = useState<Array<{ deviceId: string; label: string }>>([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState<Array<{ deviceId: string; label: string }>>([]);
  const [selectedMicDeviceId, setSelectedMicDeviceId] = useState<string>(
    () => localStorage.getItem('kibo_mic_device_id') || 'default'
  );
  const [selectedSpeakerDeviceId, setSelectedSpeakerDeviceId] = useState<string>(
    () => localStorage.getItem('kibo_output_device_id') || 'default'
  );
  const [isTestingMic, setIsTestingMic] = useState<boolean>(false);
  const [micTestLevel, setMicTestLevel] = useState<number>(0);
  const micTestStreamRef = useRef<MediaStream | null>(null);
  const micTestRafRef = useRef<number | null>(null);
  const micTestAudioCtxRef = useRef<AudioContext | null>(null);

  const refreshAudioDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      const inputs = list
        .filter((d) => d.kind === 'audioinput')
        .map((d, idx) => ({
          deviceId: d.deviceId || `mic_${idx}`,
          label: d.label || `Microphone ${idx + 1}`,
        }));
      const outputs = list
        .filter((d) => d.kind === 'audiooutput')
        .map((d, idx) => ({
          deviceId: d.deviceId || `spk_${idx}`,
          label: d.label || `Speaker / Headphones ${idx + 1}`,
        }));
      setAudioInputDevices(inputs.length > 0 ? inputs : [{ deviceId: 'default', label: 'System Default Microphone' }]);
      setAudioOutputDevices(outputs.length > 0 ? outputs : [{ deviceId: 'default', label: 'System Default Output' }]);
    } catch (_) {}
  }, []);

  useEffect(() => {
    refreshAudioDevices();
  }, [refreshAudioDevices]);

  const toggleMicTest = useCallback(async () => {
    if (isTestingMic) {
      if (micTestRafRef.current) cancelAnimationFrame(micTestRafRef.current);
      micTestStreamRef.current?.getTracks().forEach((t) => t.stop());
      micTestAudioCtxRef.current?.close().catch(() => {});
      micTestStreamRef.current = null;
      micTestAudioCtxRef.current = null;
      setIsTestingMic(false);
      setMicTestLevel(0);
      return;
    }
    try {
      const constraints: MediaStreamConstraints = {
        audio: selectedMicDeviceId && selectedMicDeviceId !== 'default'
          ? { deviceId: { exact: selectedMicDeviceId } }
          : true,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      micTestStreamRef.current = stream;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx: AudioContext = new AudioCtx();
      micTestAudioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      setIsTestingMic(true);
      refreshAudioDevices();

      const updateMeter = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;
        const pct = Math.min(100, Math.round((avg / 95) * 100));
        setMicTestLevel(pct);
        micTestRafRef.current = requestAnimationFrame(updateMeter);
      };
      micTestRafRef.current = requestAnimationFrame(updateMeter);
    } catch (_) {
      setIsTestingMic(false);
    }
  }, [isTestingMic, selectedMicDeviceId, refreshAudioDevices]);

  useEffect(() => {
    return () => {
      if (micTestRafRef.current) cancelAnimationFrame(micTestRafRef.current);
      micTestStreamRef.current?.getTracks().forEach((t) => t.stop());
      micTestAudioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  // Chrome Extension & Custom Connections (Meta Ads, etc.) State
  const [chromeExtStatus, setChromeExtStatus] = useState<string | null>(null);
  const [customIntegrations, setCustomIntegrations] = useState<CustomIntegrationItem[]>(() => {
    try {
      const saved = localStorage.getItem('kibo_custom_integrations');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return [
      {
        id: 'conn_meta_ads',
        name: 'Meta Ads Manager',
        category: 'Marketing & Ad Telemetry',
        endpointOrId: 'graph.facebook.com/v19.0/act_kibo',
        connected: true,
      },
      {
        id: 'conn_linear',
        name: 'Linear Issue Tracker',
        category: 'Product & Sprint Sync',
        endpointOrId: 'api.linear.app/graphql',
        connected: false,
      },
    ];
  });
  const [newConnName, setNewConnName] = useState<string>('');
  const [newConnCategory, setNewConnCategory] = useState<string>('');
  const [newConnEndpoint, setNewConnEndpoint] = useState<string>('');

  // Agent Reach & Granular OS Permissions State
  const [agentPermissions, setAgentPermissions] = useState<AgentPermissionState>(() => {
    try {
      const saved = localStorage.getItem('kibo_agent_permissions');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return {
      filesAndFolders: true,
      documents: true,
      pictures: true,
      contacts: false,
      calendar: true,
      microphone: true,
      camera: false,
      location: false,
    };
  });

  const toggleAgentPermission = useCallback((key: keyof AgentPermissionState) => {
    setAgentPermissions((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem('kibo_agent_permissions', JSON.stringify(next));
      } catch (_) {}
      soundFX.playToggle(next[key]);
      return next;
    });
  }, []);

  // Sync SoulCanvas speaking animation with voiceEngine speech state
  useEffect(() => {
    const unsub = voiceEngine.onSpeakingStateChange((isTalking) => {
      if (isTalking) {
        setSoulMode('TALKING');
      } else {
        setSoulMode((curr) => (curr === 'DANCING' ? 'DANCING' : 'LISTENING'));
      }
    });
    return unsub;
  }, []);

  const speakAsKibo = useCallback(
    (text: string, onEnd?: () => void) => {
      if (!voiceFeedbackEnabled || !sfxEnabled) {
        onEnd?.();
        return;
      }
      const voiceCard = LOADOUT_CARDS.find((c) => c.id === equippedCards.Voice);
      const currentVoice = (voiceCard?.name || 'Charon') as KiboVoiceName;
      const persCard = LOADOUT_CARDS.find((c) => c.id === equippedCards.Personality);
      const currentPersonality = persCard?.name || 'Prime Operator';
      voiceEngine.speak(text, {
        voice: currentVoice,
        personality: currentPersonality,
        onEnd,
      });
    },
    [equippedCards, voiceFeedbackEnabled, sfxEnabled]
  );

  const replyDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showReplyWithSpeech = useCallback(
    (text: string, boldHeader?: string, actionFilePath?: string, actionLabel?: string) => {
      setAskNotchPhase('idle');
      setSoulMode('TALKING');
      setKiboReply({ bold: boldHeader || text, rest: boldHeader ? text : undefined });
      appendChatMessage({
        role: 'kibo',
        text: boldHeader ? `${boldHeader} :  ${text}` : text,
        actionFilePath,
        actionLabel,
      });

      // Guarantee lasso lock is released so user can multitask freely across apps
      setLassoActive(false);
      window.kiboAPI?.setLassoActive?.(false);

      if (replyDismissTimerRef.current) {
        clearTimeout(replyDismissTimerRef.current);
        replyDismissTimerRef.current = null;
      }

      let speechFinished = false;

      const scheduleDismiss = (delayMs = 4500) => {
        if (replyDismissTimerRef.current) clearTimeout(replyDismissTimerRef.current);
        replyDismissTimerRef.current = setTimeout(() => {
          if (!voiceEngine.isSpeaking()) {
            setSoulMode((curr) => (curr === 'DANCING' ? 'DANCING' : 'LISTENING'));
            setKiboReply(null);
            setUserBubbleText(null);
          } else {
            scheduleDismiss(2000);
          }
        }, delayMs);
      };

      speakAsKibo(text, () => {
        speechFinished = true;
        scheduleDismiss(4500);
      });

      // Generous fallback in case speech doesn't fire onEnd
      const words = text.split(/\s+/).length;
      const expectedDurationMs = Math.max(12000, words * 380 + 6000);
      setTimeout(() => {
        if (!speechFinished && !voiceEngine.isSpeaking()) {
          scheduleDismiss(3000);
        }
      }, expectedDurationMs);
    },
    [speakAsKibo, appendChatMessage]
  );

  const handleKiboPoke = useCallback(() => {
    if (leaveCollapseTimerRef.current) {
      clearTimeout(leaveCollapseTimerRef.current);
      leaveCollapseTimerRef.current = null;
    }

    if (isTucked) {
      setIsTucked(false);
      return;
    }

    // Cancel active relief breath if poked again
    setIsBreathingRelief(false);
    if (reliefBreathTimerRef.current) {
      clearTimeout(reliefBreathTimerRef.current);
      reliefBreathTimerRef.current = null;
    }

    // Play tactile squish/pulse SFX
    soundFX.playSoulPulse();

    // Trigger hit flinch
    setSoulIsHit(true);
    if (hitTimeoutRef.current) clearTimeout(hitTimeoutRef.current);
    hitTimeoutRef.current = setTimeout(() => {
      setSoulIsHit(false);
    }, 280);

    // Cancel existing annoyance decay
    if (annoyanceDecayIntervalRef.current) {
      clearInterval(annoyanceDecayIntervalRef.current);
      annoyanceDecayIntervalRef.current = null;
    }

    // Step annoyance up progressively: +0.28 per click, up to 1.0 (enraged fiery red)
    setSoulAnnoyance((prev) => Math.min(1.0, prev + 0.28));

    // Reset idle decay: after 2.4s of quiet, smoothly step annoyance back down to 0
    if (annoyanceDecayTimerRef.current) clearTimeout(annoyanceDecayTimerRef.current);
    annoyanceDecayTimerRef.current = setTimeout(() => {
      annoyanceDecayIntervalRef.current = setInterval(() => {
        setSoulAnnoyance((curr) => {
          if (curr <= 0.04) {
            if (annoyanceDecayIntervalRef.current) {
              clearInterval(annoyanceDecayIntervalRef.current);
              annoyanceDecayIntervalRef.current = null;
            }
            // Once annoyance returns to 0 (calm blue), take a deep breath of relief!
            setIsBreathingRelief(true);
            soundFX.playReliefBreath();
            if (reliefBreathTimerRef.current) clearTimeout(reliefBreathTimerRef.current);
            reliefBreathTimerRef.current = setTimeout(() => {
              setIsBreathingRelief(false);
              // Once Kibo has fully sighed and cooled back down, if mouse is outside, tuck smoothly
              if (autoTuckEnabled) {
                leaveCollapseTimerRef.current = setTimeout(() => {
                  setIsTucked(true);
                }, 1400);
              }
            }, 2600);
            return 0;
          }
          return Math.max(0, curr - 0.08);
        });
      }, 70);
    }, 2400);
  }, [isTucked]);

  const [askNotchPhase, setAskNotchPhase] = useState<'idle' | 'waking' | 'speaking' | 'thinking'>('idle');
  const [askWords, setAskWords] = useState<string[]>([]);

  const [contextCard, setContextCard] = useState<ContextNotificationCard | null>(null);
  const [userBubbleText, setUserBubbleText] = useState<string | null>(null);
  const [kiboReply, setKiboReply] = useState<{ bold?: string; rest?: string } | null>(null);

  // Dynamic Island macOS-Style Integration Notifications (Discord, Calendar, Tasks)
  const [activeNotchNotification, setActiveNotchNotification] = useState<{
    id: string;
    appSlug: string;
    appName: string;
    title: string;
    message: string;
    logo?: string;
  } | null>(null);

  useEffect(() => {
    if (!activeNotchNotification) return;
    const timer = setTimeout(() => {
      setActiveNotchNotification(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [activeNotchNotification]);

  useEffect(() => {
    const unreg = (window as any).kiboAPI?.onIntegrationNotification?.((payload: any) => {
      if (payload?.title && payload?.message) {
        setActiveNotchNotification({
          id: `notif_${Date.now()}`,
          appSlug: payload.appSlug || '',
          appName: payload.appName || 'Notification',
          title: payload.title,
          message: payload.message,
          logo: payload.logo,
        });
        soundFX.playPop();
      }
    });
    return () => unreg?.();
  }, []);

  // Auto-dismiss context card (e.g. "Opening YouTube") after 3.8 seconds
  useEffect(() => {
    if (!contextCard) return;
    if (contextCard.header?.includes('Ember Waiting')) return;
    const timer = setTimeout(() => {
      setContextCard(null);
    }, 3800);
    return () => clearTimeout(timer);
  }, [contextCard]);

  const handleConnectComposioApp = useCallback(
    async (slug: string) => {
      const api = (window as any).kiboAPI;
      if (!api?.composioConnectApp) return;
      if (slug === 'spotify') {
        api?.openApp?.('spotify');
        soundFX.playSuccessChime();
        setComposioConnectingSlug(null);
        return;
      }
      if (composioPollTimerRef.current) {
        clearInterval(composioPollTimerRef.current);
        composioPollTimerRef.current = null;
      }
      setComposioConnectingSlug(slug);
      try {
        const res = await api.composioConnectApp(slug, composioApiKey);
        if (res && res.success) {
          soundFX.playSuccessChime();
          let pollAttempts = 0;
          composioPollTimerRef.current = setInterval(async () => {
            pollAttempts++;
            try {
              const statusRes = await api.composioGetStatus(composioApiKey);
              if (statusRes?.success) {
                setComposioStatus({
                  connected: true,
                  maskedKey: statusRes.maskedKey,
                  accountsCount: statusRes.accountsCount || (statusRes.accounts?.length || 0),
                  accounts: statusRes.accounts || [],
                });
                const isNowConnected = (statusRes.accounts || []).some(
                  (a: any) => a.slug?.toLowerCase() === slug.toLowerCase() && a.status === 'ACTIVE'
                );
                if (isNowConnected) {
                  if (composioPollTimerRef.current) clearInterval(composioPollTimerRef.current);
                  composioPollTimerRef.current = null;
                  setComposioConnectingSlug(null);
                  soundFX.playSuccessChime();
                  const matchedApp = INTEGRATION_APPS.find((a) => a.slug.toLowerCase() === slug.toLowerCase());
                  const appName = matchedApp?.name || (slug.charAt(0).toUpperCase() + slug.slice(1));
                  setActiveNotchNotification({
                    id: `conn_${Date.now()}`,
                    appSlug: slug,
                    appName,
                    title: `${appName} Connected`,
                    message: 'Account linked and ready for voice commands.',
                    logo: matchedApp?.logo || `./logos/${slug}.png`,
                  });
                  return;
                }
              }
            } catch (_) {}

            if (pollAttempts >= 24) {
              if (composioPollTimerRef.current) clearInterval(composioPollTimerRef.current);
              composioPollTimerRef.current = null;
              setComposioConnectingSlug(null);
            }
          }, 2500);
        } else {
          setComposioConnectingSlug(null);
          if (res?.error) {
            showReplyWithSpeech(res.error, 'Integration Notice');
          }
        }
      } catch (err: any) {
        setComposioConnectingSlug(null);
        if (err?.message) {
          showReplyWithSpeech(err.message, 'Integration Notice');
        }
      }
    },
    [composioApiKey, showReplyWithSpeech]
  );

  const handleDisconnectComposioAccount = useCallback(
    async (accountId: string, slug?: string) => {
      const api = (window as any).kiboAPI;
      if (!api?.composioDisconnectAccount) return;
      try {
        await api.composioDisconnectAccount(accountId, composioApiKey);
        if (slug) {
          multitaskAgent.unlinkApp(slug);
        }
        soundFX.playToggle(false);
        await refreshComposioStatus();
      } catch (_) {}
    },
    [composioApiKey, refreshComposioStatus]
  );

  const [dictationState, setDictationState] = useState<'idle' | 'recording' | 'done'>('idle');
  const [dictationText, setDictationText] = useState('');

  const [lassoActive, setLassoActive] = useState(false);
  const [lassoPoints, setLassoPoints] = useState<Array<{ x: number; y: number }>>([]);
  const lassoPointsRef = useRef<Array<{ x: number; y: number }>>([]);
  const capturedScreenRef = useRef<string | null>(null);
  const [isDrawingLasso, setIsDrawingLasso] = useState(false);
  const [lassoQuery, setLassoQuery] = useState('');
  const lassoQueryRef = useRef<string>('');
  const liveSpeechRef = useRef<string>('');
  const speechRecognitionRef = useRef<any>(null);

  // Roaming Screen Pointer ("Peek, Fly & Point") State
  const [roamingStage, setRoamingStage] = useState<'PEEKING' | 'FLYING' | 'POINTING' | 'RETURNING' | 'IDLE'>('IDLE');
  const [roamingQuery, setRoamingQuery] = useState<string>('');
  const [pointedTarget, setPointedTarget] = useState<PointedTarget | null>(null);

  // Concurrent Multi-Tasking Agent Workers & Proactive Context State
  const [agentTasks, setAgentTasks] = useState<AgentTask[]>([]);
  const [detectedAppId, setDetectedAppId] = useState<DetectedAppConfig['id'] | null>(null);
  const [agentPromptInput, setAgentPromptInput] = useState('');

  // Subscribe to concurrent background agent tasks & trigger voice alerts on completion
  const prevCompletedTasksRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    return multitaskAgent.subscribe((tasks) => {
      setAgentTasks(tasks);

      const completedNow = tasks.filter((t) => t.status === 'COMPLETED');
      for (const t of completedNow) {
        if (!prevCompletedTasksRef.current.has(t.id)) {
          // If created recently (within last 3 minutes), announce completion
          if (Date.now() - t.createdAt < 180000) {
            soundFX.playSuccessChime();
            const label = t.kind === 'BUILD_PAGE' ? 'landing page' : 'task';
            speakAsKibo(`Your ${label} is ready!`);
            addEmbers(5);
          }
        }
      }
      prevCompletedTasksRef.current = new Set(completedNow.map((t) => t.id));
    });
  }, [speakAsKibo]);

  const appBannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Listen for automatic OS app detection (GitHub, Notion, VS Code, Figma, Gmail)
  useEffect(() => {
    const api = (window as any).kiboAPI;
    if (!api?.onContextAppDetected) return;

    return api.onContextAppDetected((appId: DetectedAppConfig['id'] | null) => {
      // Ignore transient null ticks so the banner never disappears after 1 second!
      if (!appId) return;

      if (!multitaskAgent.shouldPromptForApp(appId)) return;

      setIsTucked(false);
      setDetectedAppId(appId);

      if (appBannerTimerRef.current) {
        clearTimeout(appBannerTimerRef.current);
        appBannerTimerRef.current = null;
      }

      // If already connected, show the "Connected" banner + suggestions for 9 seconds then gently tuck
      const isAlreadyConn = composioStatus.accounts.some(
        (a) => a.slug?.toLowerCase() === appId.toLowerCase() && a.status === 'ACTIVE'
      ) || (appId === 'vscode' && multitaskAgent.isAppConnected(appId));

      if (isAlreadyConn) {
        appBannerTimerRef.current = setTimeout(() => {
          setDetectedAppId((curr) => (curr === appId ? null : curr));
        }, 9000);
      }
    });
  }, []);

  const activeRunningTasks = useMemo(
    () => agentTasks.filter((t) => t.status === 'RUNNING' || t.status === 'WAITING'),
    [agentTasks]
  );


  const handleFindAndPoint = useCallback(
    async (queryText: string) => {
      if (!queryText || !queryText.trim()) return;
      const q = queryText.trim();
      setIsTucked(false);
      setIsExpanded(false);
      setAskNotchPhase('idle');
      setKiboReply(null);
      setUserBubbleText(null);
      setRoamingQuery(q);
      setPointedTarget(null);
      setRoamingStage('PEEKING');
      soundFX.playWisp();

      try {
        let shotImg: string | undefined = undefined;
        if (window.kiboAPI?.captureScreen) {
          const shot = await window.kiboAPI.captureScreen();
          if (shot?.success && shot.image) {
            shotImg = shot.image;
          }
        }
        if (!shotImg && capturedScreenRef.current) {
          shotImg = capturedScreenRef.current;
        }
        const target = await findTargetOnScreen(q, apiKey, shotImg);

        if (target) {
          setPointedTarget(target);
          setRoamingStage('FLYING');
          soundFX.playWisp();

          setTimeout(() => {
            setRoamingStage('POINTING');
            soundFX.playTaskSuccess();
            if (target.spokenHint) {
              speakAsKibo(target.spokenHint);
            }
          }, 860);
        } else {
          soundFX.playToggle(false);
          speakAsKibo(`I scanned your screen, but couldn't spot "${q}".`);
          setTimeout(() => {
            setRoamingStage('RETURNING');
          }, 1800);
        }
      } catch (err) {
        console.error('Find and point error:', err);
        setRoamingStage('RETURNING');
      }
    },
    [apiKey, speakAsKibo]
  );

  // Real System Media Session + Pause Persistence + Accurate Per-Song Duration
  const [isPlayingLofi, setIsPlayingLofi] = useState(false);
  const [osMedia, setOsMedia] = useState<{
    hasSession: boolean;
    playing: boolean;
    title: string;
    artist: string;
    source?: string;
    thumbnail?: string;
    durationSec?: number;
  }>({
    hasSession: false,
    playing: false,
    title: '',
    artist: '',
    thumbnail: '',
    durationSec: 210,
  });
  const [mediaArtPalette, setMediaArtPalette] = useState<{
    accent: string;
    rgb: string;
    gradient: string;
  }>({
    accent: '#5CB8FF',
    rgb: '92, 184, 255',
    gradient: 'linear-gradient(135deg, #0B1929 0%, #1B4975 50%, #5CB8FF 100%)',
  });

    const hasMediaSession = Boolean(osMedia.hasSession && osMedia.title);
  const isPlayingMedia = Boolean(osMedia.hasSession && osMedia.playing);
  const activeMediaTitle = osMedia.title || '';
  const activeMediaArtist = osMedia.artist || osMedia.source || '';
  const activeMediaArtwork = osMedia.thumbnail || '';

  const [mediaProgress, setMediaProgress] = useState(0);
  const totalMediaDuration = osMedia.hasSession && osMedia.durationSec ? osMedia.durationSec : 210;
  const lastTrackTitleRef = useRef<string>('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isDraggingMediaScrub, setIsDraggingMediaScrub] = useState(false);
  const isDraggingMediaScrubRef = useRef<boolean>(false);
  const notchScrubRef = useRef<HTMLDivElement>(null);
  const controlsScrubRef = useRef<HTMLDivElement>(null);
  const activeScrubRef = useRef<HTMLDivElement | null>(null);

  const updateMediaScrubFromClientX = useCallback(
    (clientX: number, commitSeek = false) => {
      const trackEl = activeScrubRef.current;
      if (!trackEl) return;
      const rect = trackEl.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const targetSec = Math.round(pct * totalMediaDuration);
      setMediaProgress(targetSec);
      if (commitSeek) {
        window.kiboAPI?.seekMedia?.(targetSec);
      }
    },
    [totalMediaDuration]
  );

  // Reset song progress to 0:00 whenever a new song starts!
  useEffect(() => {
    if (activeMediaTitle && activeMediaTitle !== lastTrackTitleRef.current) {
      lastTrackTitleRef.current = activeMediaTitle;
      setMediaProgress(0);
    }
  }, [activeMediaTitle]);

  // Extract dominant color from the song cover image
    // Extract dominant color from the song cover image, or use the app's brand logo color when no cover exists
  useEffect(() => {
    const brandFallback = getMediaAppBrandPalette(
      osMedia.source,
      activeMediaArtist,
      activeMediaTitle
    );

    if (!activeMediaArtwork) {
      setMediaArtPalette(brandFallback);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const pal = extractPaletteFromImageElement(img);
      if (pal) {
        const hex = pal.accent.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16) || 92;
        const g = parseInt(hex.substring(2, 4), 16) || 184;
        const b = parseInt(hex.substring(4, 6), 16) || 255;
        setMediaArtPalette({
          accent: pal.accent,
          rgb: `${r}, ${g}, ${b}`,
          gradient: `linear-gradient(135deg, rgba(${r}, ${g}, ${b}, 0.45) 0%, ${pal.accent} 100%)`,
        });
      } else {
        setMediaArtPalette(brandFallback);
      }
    };
    img.onerror = () => {
      setMediaArtPalette(brandFallback);
    };
    img.src = activeMediaArtwork;
  }, [activeMediaArtwork, osMedia.source, activeMediaArtist, activeMediaTitle]);

  // Real PC Controls & Scrollable Dropdown Menus State
  const [activeControlDropdown, setActiveControlDropdown] = useState<ControlDropdownType>(null);
  const [wifiEnabled, setWifiEnabled] = useState(true);
  const [wifiSsid, setWifiSsid] = useState('Home 5G');
  const [wifiNetworksList, setWifiNetworksList] = useState<Array<{ ssid: string; signal: number }>>([]);
  const [bluetoothEnabled, setBluetoothEnabled] = useState(false);
  const [bluetoothDevicesList, setBluetoothDevicesList] = useState<Array<{ name: string; connected: boolean }>>([]);
  const [audioDevicesList, setAudioDevicesList] = useState<string[]>(['Speakers', 'Headphones']);
  const [audioDeviceIndex, setAudioDeviceIndex] = useState(0);
  const audioOutput = audioDevicesList[audioDeviceIndex] || 'Speakers';
  const [nightLight, setNightLight] = useState(false);
  const [nightLightStrength, setNightLightStrength] = useState<number>(65);
  const [systemDarkMode, setSystemDarkMode] = useState(true);
  const [volumeLevel, setVolumeLevel] = useState<number>(50);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isDraggingVolume, setIsDraggingVolume] = useState<boolean>(false);
  const isDraggingVolumeRef = useRef<boolean>(false);
  const notchShellRef = useRef<HTMLDivElement>(null);
  const leaveCollapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isHoverHoldActive, setIsHoverHoldActive] = useState<boolean>(false);
  const [hoverHoldProgress, setHoverHoldProgress] = useState<number>(0);
  const hoverHoldRafRef = useRef<number | null>(null);

  const soulAnnoyanceRef = useRef<number>(soulAnnoyance);
  useEffect(() => {
    soulAnnoyanceRef.current = soulAnnoyance;
  }, [soulAnnoyance]);

  const isBreathingReliefRef = useRef<boolean>(isBreathingRelief);
  useEffect(() => {
    isBreathingReliefRef.current = isBreathingRelief;
  }, [isBreathingRelief]);

  // Today View, Focus Timer Notch Countdown & Alarm Celebration State
  const [now, setNow] = useState(() => new Date());
  const [timerSeconds, setTimerSeconds] = useState(1500);
  const [timerTotalSeconds, setTimerTotalSeconds] = useState(1500);
  const [timerPreset, setTimerPreset] = useState<'1m' | '5m' | '10m' | '15m' | '20m' | '25m' | '45m'>('25m');
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isTimerSessionActive, setIsTimerSessionActive] = useState(false);
  const [timerAlarmRinging, setTimerAlarmRinging] = useState(false);
  const alarmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleIslandMouseEnter = useCallback(() => {
    setIsHovered(true);
    if (leaveCollapseTimerRef.current) clearTimeout(leaveCollapseTimerRef.current);

    // Hold-hovering is strictly for waking Kibo when the holding hover bar (isTuckedSliver) is visible!
    // Never play hover-hold SFX when music, timer, stopwatch, ask bar, or expanded tabs are active.
    const canShowHoverHoldBar =
      isTucked &&
      bootPhase === 'ready' &&
      !isExpanded &&
      !detectedAppId &&
      !showMediaNotch &&
      !isTimerRunning &&
      !isTimerSessionActive &&
      timerSeconds === timerTotalSeconds &&
      !timerAlarmRinging &&
      !stopwatchRunning &&
      stopwatchMs === 0 &&
      askNotchPhase === 'idle' &&
      !hasMediaSession &&
      !notchApiAlert &&
      !isFileDraggingOverNotch;

    if (canShowHoverHoldBar) {
      // Snappy 420ms hold-hover to wake Kibo and drop the notch
      setIsHoverHoldActive(true);
      setHoverHoldProgress(0);
      const startTime = performance.now();
      const holdDuration = 420;

      const step = (now: number) => {
        const elapsed = now - startTime;
        const p = Math.min(1, elapsed / holdDuration);
        setHoverHoldProgress(p);

        if (p < 1) {
          hoverHoldRafRef.current = requestAnimationFrame(step);
        } else {
          setIsHoverHoldActive(false);
          setHoverHoldProgress(0);
          setIsTucked(false);
          soundFX.playSoulPulse();
          hoverHoldRafRef.current = null;
        }
      };

      if (hoverHoldRafRef.current) cancelAnimationFrame(hoverHoldRafRef.current);
      hoverHoldRafRef.current = requestAnimationFrame(step);
    }
  }, [
    isTucked,
    bootPhase,
    isExpanded,
    detectedAppId,
    showMediaNotch,
    isTimerRunning,
    timerAlarmRinging,
    stopwatchRunning,
    stopwatchMs,
    askNotchPhase,
    hasMediaSession,
    notchApiAlert,
    isFileDraggingOverNotch,
  ]);

  const handleIslandMouseLeave = useCallback(() => {
    setIsHovered(false);
    if (leaveCollapseTimerRef.current) clearTimeout(leaveCollapseTimerRef.current);

    // Cancel hover-hold charging if user leaves before hold completes
    if (hoverHoldRafRef.current) {
      cancelAnimationFrame(hoverHoldRafRef.current);
      hoverHoldRafRef.current = null;
    }
    setIsHoverHoldActive(false);
    setHoverHoldProgress(0);

    if (isDraggingVolumeRef.current || isDraggingMediaScrubRef.current || isNativeDialogOpenRef.current) {
      return;
    }

    // Do NOT tuck if Kibo is annoyed or actively doing his "phewww" cooldown sigh!
    if (soulAnnoyanceRef.current > 0.05 || isBreathingReliefRef.current) {
      return;
    }

    if (isExpanded || showMediaNotch) {
      const collapseDelay = 320;
      leaveCollapseTimerRef.current = setTimeout(() => {
        if (isDraggingVolumeRef.current || isDraggingMediaScrubRef.current || isNativeDialogOpenRef.current) return;
        if (soulAnnoyanceRef.current > 0.05 || isBreathingReliefRef.current) return;
        setActiveControlDropdown(null);
        setShowMediaNotch(false);
        setIsExpanded(false);
        setPendingPowerAction(null);
        if (autoTuckEnabled) setIsTucked(true);
      }, collapseDelay);
    } else if (autoTuckEnabled) {
      leaveCollapseTimerRef.current = setTimeout(() => {
        if (isDraggingVolumeRef.current || isDraggingMediaScrubRef.current || isNativeDialogOpenRef.current) return;
        if (soulAnnoyanceRef.current > 0.05 || isBreathingReliefRef.current) return;
        setIsTucked(true);
      }, 1500);
    }
  }, [isExpanded, showMediaNotch, autoTuckEnabled]);

  // Collapse expanded notch immediately when clicking outside into another desktop window
  useEffect(() => {
    if (!isExpanded && !showMediaNotch) return;
    const collapseOutside = () => {
      if (isNativeDialogOpenRef.current || isDraggingVolumeRef.current || isDraggingMediaScrubRef.current) return;
      setActiveControlDropdown(null);
      setShowMediaNotch(false);
      setIsExpanded(false);
      if (autoTuckEnabled) setIsTucked(true);
    };
    window.addEventListener('blur', collapseOutside);
    const unregIpc = window.kiboAPI?.onDesktopClickedOutside?.(() => {
      collapseOutside();
    });
    return () => {
      window.removeEventListener('blur', collapseOutside);
      unregIpc?.();
    };
  }, [isExpanded, showMediaNotch, autoTuckEnabled]);

  useEffect(() => {
    if (!isDraggingMediaScrub) return;
    const onMove = (e: PointerEvent) => updateMediaScrubFromClientX(e.clientX, false);
    const onUp = (e: PointerEvent) => {
      updateMediaScrubFromClientX(e.clientX, true);
      isDraggingMediaScrubRef.current = false;
      setIsDraggingMediaScrub(false);

      if (notchShellRef.current) {
        const rect = notchShellRef.current.getBoundingClientRect();
        const isStillInside =
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom;
        if (!isStillInside) {
          handleIslandMouseLeave();
        }
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [isDraggingMediaScrub, updateMediaScrubFromClientX, handleIslandMouseLeave]);

  const isFirstRenderRef = useRef<boolean>(true);

  // 1. Play liquid expand / collapse sound when island opens or closes
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    if (isExpanded) {
      soundFX.playExpand();
    } else {
      soundFX.playCollapse();
    }
  }, [isExpanded]);

  // 2. Play crisp glass detent when switching tabs
  useEffect(() => {
    if (isExpanded) {
      soundFX.playTabSwitch();
    }
  }, [activeTab]);

  // 3. Play mystical chord when opening Chassis Bay or cycling Soul skins
  useEffect(() => {
    if (showCompanionWindow && companionDockTab === 'soul') {
      soundFX.playSoulPulse();
    }
  }, [showCompanionWindow, companionDockTab, selectedSkinKey]);

  // 4. Play pitched detent ticks when dragging or scrolling the volume slider
  useEffect(() => {
    if (isExpanded && activeTab === 'Controls') {
      soundFX.playSliderTick(volumeLevel);
    }
  }, [volumeLevel, isExpanded, activeTab]);

  // 5. Global Event Delegation for Hovers, Toggles, and Action Buttons
  useEffect(() => {
    let lastHoveredElement: Element | null = null;
    const handleMouseOver = (e: MouseEvent) => {
      if (lastHoveredElement && lastHoveredElement.contains(e.target as Node)) {
        return;
      }
      const target = (e.target as HTMLElement)?.closest(
        'button, .companion-control-tile, .companion-list-row, .companion-wallpaper-card, .companion-day-col, .companion-adaptive-tile, .companion-nav-btn'
      );
      if (target && target !== lastHoveredElement) {
        lastHoveredElement = target;
        soundFX.playHover();
      } else if (!target) {
        lastHoveredElement = null;
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.companion-todo-row, .companion-todo-submit, .companion-kbd-btn, .companion-todo-checkbox, .companion-clip-btn')) {
        soundFX.playSuccessChime();
      } else if (target.closest('.companion-control-tile, .companion-filter-pill, .companion-preset-chip, .companion-adaptive-tile, .companion-toggle-pill')) {
        soundFX.playToggle(true);
      }
    };

    window.addEventListener('mouseover', handleMouseOver, { passive: true });
    window.addEventListener('mousedown', handleMouseDown, { passive: true });
    return () => {
      window.removeEventListener('mouseover', handleMouseOver);
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (window.kiboAPI?.getControlsState) {
        window.kiboAPI.getControlsState().then((st) => {
          if (!st) return;
          setWifiEnabled(Boolean(st.wifiConnected));
          setWifiSsid(st.wifiSsid || (st.wifiConnected ? 'Connected' : 'Off'));
          if (typeof st.bluetoothOn === 'boolean') setBluetoothEnabled(st.bluetoothOn);
          if (typeof st.nightLightOn === 'boolean') setNightLight(st.nightLightOn);
          setSystemDarkMode(Boolean(st.darkMode));
          if (typeof st.volume === 'number') setVolumeLevel(st.volume);
          if (typeof st.muted === 'boolean') setIsMuted(st.muted);
          if (Array.isArray(st.audioDevices) && st.audioDevices.length > 0) {
            setAudioDevicesList(st.audioDevices);
          }
        });
      }
    }, 2400);
    return () => clearTimeout(timer);
  }, []);

  // Poll Real PC Now Playing Media Session every 1.5s (deferred past startup animation)
  useEffect(() => {
    if (!window.kiboAPI?.getNowPlaying) return;
    const checkMedia = async () => {
      try {
        const info: any = await window.kiboAPI?.getNowPlaying?.();
        if (info) {
          setOsMedia({
            hasSession: Boolean(info.hasSession ?? info.playing),
            playing: Boolean(info.playing),
            title: info.title || '',
            artist: info.artist || '',
            source: info.source,
            thumbnail: info.thumbnail || '',
            durationSec: info.durationSec || 210,
          });
          if (typeof info.positionSec === 'number' && info.positionSec >= 0 && !isDraggingMediaScrubRef.current) {
            setMediaProgress(info.positionSec);
          }
        }
      } catch (_) {}
    };
    const startTimer = setTimeout(checkMedia, 2350);
    const interval = setInterval(checkMedia, 1500);
    return () => {
      clearTimeout(startTimer);
      clearInterval(interval);
    };
  }, []);

  // Smooth 1-second progress advancement while playing
  useEffect(() => {
    if (!isPlayingMedia || isDraggingMediaScrub) return;
    const timer = setInterval(() => {
      setMediaProgress((prev) => Math.min(totalMediaDuration, prev + 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [isPlayingMedia, isDraggingMediaScrub, totalMediaDuration]);

  useEffect(() => {
    const audio = new Audio('https://stream.nightride.fm/chillsynth.mp3');
    audio.loop = true;
    audio.volume = 0.5;
    audioRef.current = audio;
    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  const applyUserVolumeChange = useCallback((nextVol: number) => {
    const clamped = Math.min(100, Math.max(0, Math.round(nextVol)));
    setVolumeLevel(clamped);
    if (clamped > 0) setIsMuted(false);
    if (audioRef.current) {
      audioRef.current.volume = clamped / 100;
    }
    window.kiboAPI?.setVolume?.(clamped);
  }, []);

  const toggleMediaPlayback = useCallback(async () => {
    if (window.kiboAPI?.mediaControl) {
      await window.kiboAPI.mediaControl('playpause');
      if (osMedia.hasSession) {
        setOsMedia((prev) => ({ ...prev, playing: !prev.playing }));
        return;
      }
      const check: any = await window.kiboAPI.getNowPlaying?.();
      if (check && check.hasSession) {
        setOsMedia({
          hasSession: true,
          playing: Boolean(check.playing),
          title: check.title || '',
          artist: check.artist || '',
          source: check.source,
          thumbnail: check.thumbnail || '',
          durationSec: check.durationSec || 210,
        });
        if (typeof check.positionSec === 'number' && !isDraggingMediaScrubRef.current) {
          setMediaProgress(check.positionSec);
        }
        return;
      }
    }
    setIsPlayingLofi((prev) => {
      const next = !prev;
      if (audioRef.current) {
        if (next) audioRef.current.play().catch(() => {});
        else audioRef.current.pause();
      }
      return next;
    });
  }, [osMedia.hasSession]);

  const handleMediaPrev = useCallback(async () => {
    if (window.kiboAPI?.mediaControl) {
      await window.kiboAPI.mediaControl('prev');
    }
    setMediaProgress(0);
  }, []);

  const handleMediaNext = useCallback(async () => {
    if (window.kiboAPI?.mediaControl) {
      await window.kiboAPI.mediaControl('next');
    }
    setMediaProgress(0);
  }, []);

  const handleToggleControlDropdown = useCallback(
    async (menu: ControlDropdownType, e: React.MouseEvent) => {
      e.stopPropagation();
      const next = activeControlDropdown === menu ? null : menu;
      setActiveControlDropdown(next);
      if (next === 'wifi' && window.kiboAPI?.getWifiNetworks) {
        const nets = await window.kiboAPI.getWifiNetworks();
        if (Array.isArray(nets)) setWifiNetworksList(nets);
      } else if (next === 'bluetooth' && window.kiboAPI?.getBluetoothDevices) {
        const devs = await window.kiboAPI.getBluetoothDevices();
        if (Array.isArray(devs)) setBluetoothDevicesList(devs);
      }
    },
    [activeControlDropdown]
  );

  const [routines, setRoutines] = useState<ScheduledRoutine[]>(() => {
    const saved = localStorage.getItem('kibo_routines');
    return saved ? JSON.parse(saved) : [];
  });

  const [todos, setTodos] = useState<Array<{ id: number; text: string; completed: boolean }>>(() => {
    const saved = localStorage.getItem('kibo_todos');
    return saved ? JSON.parse(saved) : [{ id: 1, text: 'Calibrate Kibo core', completed: true }];
  });
  const [sparkleBurstId, setSparkleBurstId] = useState<number | null>(null);
  const [sparkleAnimKey, setSparkleAnimKey] = useState<number>(0);
  const sparkleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [newTodoInput, setNewTodoInput] = useState('');
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDate());

  useEffect(() => {
    localStorage.setItem('kibo_todos', JSON.stringify(todos));
  }, [todos]);

  useEffect(() => {
    localStorage.setItem('kibo_routines', JSON.stringify(routines));
  }, [routines]);

  // Embers Forge Status: Daily Flame Bonus & Waiting Status
  const isDailyEmberWaiting = dailyEmberClaimedDate !== new Date().toDateString();
  const isEmberWaiting = isDailyEmberWaiting || (rewardedTaskIds.length < 5 && todos.some((t) => !t.completed));

  const handleClaimWaitingEmber = useCallback(() => {
    const today = new Date().toDateString();
    localStorage.setItem('kibo_daily_watt_date', today);
    setDailyEmberClaimedDate(today);

    addEmbers(15);
    soundFX.playFanfare();

    setKiboReply({
      bold: 'Daily Ember Stoked!',
      rest: '+15 Embers added to your soul forge',
    });
    speakAsKibo('Your daily ember has been stoked. 15 embers added to your soul forge.');
    setContextCard(null);
  }, [addEmbers, speakAsKibo]);

  const handleGrantCreatorEmbers = useCallback(
    (amount = 5000) => {
      addEmbers(amount);
      soundFX.playFanfare();
    },
    [addEmbers]
  );

  // Sync embers state to Electron Windows System Tray
  useEffect(() => {
    const api = (window as any).kiboAPI;
    if (api?.syncEmbersState) {
      api.syncEmbersState({ count: embers, isWaiting: isEmberWaiting });
    }
  }, [embers, isEmberWaiting]);

  // Listen for Tray actions (Claim daily ember / Creator testing stoke)
  useEffect(() => {
    const api = (window as any).kiboAPI;
    if (!api) return;

    const unClaim = api.onClaimDailyEmber?.(() => {
      handleClaimWaitingEmber();
    });
    const unGrant = api.onGrantCreatorEmbers?.((amt: number) => {
      handleGrantCreatorEmbers(amt || 5000);
    });

    return () => {
      unClaim?.();
      unGrant?.();
    };
  }, [handleClaimWaitingEmber, handleGrantCreatorEmbers]);

  // Initial sync of embers to tray
  useEffect(() => {
    const api = (window as any).kiboAPI;
    api?.syncEmbersState?.({ count: embers, isWaiting: isEmberWaiting });
    api?.setEmbersCount?.(embers);
  }, []);

  // Real Live Clipboard History (with LocalStorage Persistence & Universal Sync)
  const [clipboardCategory, setClipboardCategory] = useState<'All' | 'Text' | 'Images' | 'Links'>('All');
  const [clipboardItems, setClipboardItems] = useState<ClipboardItem[]>(() => {
    try {
      const saved = localStorage.getItem('kibo_clip_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return [];
  });
  const [selectedClipboardId, setSelectedClipboardId] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem('kibo_clip_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed[0].id;
      }
    } catch (_) {}
    return null;
  });
  const [clipboardSearch, setClipboardSearch] = useState('');
  const [clipboardToast, setClipboardToast] = useState<string | null>(null);
  const [openMenuClipId, setOpenMenuClipId] = useState<number | null>(null);
  const lastSeenClipTextRef = useRef<string>('');
  const lastSeenClipImgRef = useRef<string>('');

  // Close clipboard 3-dot dropdown when clicking outside
  useEffect(() => {
    if (openMenuClipId === null) return;
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('.clipboard-row-dropdown') || target?.closest('.clipboard-row-dots-btn')) {
        return;
      }
      setOpenMenuClipId(null);
    };
    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [openMenuClipId]);

  // Global Shortcuts State & Dynamic Key Recording
  const [customShortcuts, setCustomShortcuts] = useState<{ ask: string; circle: string; dictate: string }>(() => {
    try {
      const saved = localStorage.getItem('kibo_custom_shortcuts');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ask: parsed.ask || 'Win + Alt',
          circle: parsed.circle || 'Ctrl + Shift',
          dictate: parsed.dictate || 'Ctrl + Win',
        };
      }
    } catch (_) {}
    return {
      ask: 'Win + Alt',
      circle: 'Ctrl + Shift',
      dictate: 'Ctrl + Win',
    };
  });
  const [bindingShortcutKey, setBindingShortcutKey] = useState<'ask' | 'circle' | 'dictate' | null>(null);

  // Sync shortcuts to Electron on startup
  useEffect(() => {
    window.kiboAPI?.updateShortcuts?.(customShortcuts);
  }, []);

  // Listen to key combinations when recording a shortcut
  useEffect(() => {
    if (!bindingShortcutKey) return;
    const handleKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape') {
        setBindingShortcutKey(null);
        return;
      }

      const parts: string[] = [];
      if (e.ctrlKey) parts.push('Ctrl');
      if (e.metaKey) parts.push('Win');
      if (e.altKey) parts.push('Alt');
      if (e.shiftKey) parts.push('Shift');

      const isModifierOnly = ['Control', 'Shift', 'Alt', 'Meta'].includes(e.key);
      if (!isModifierOnly) {
        let keyName = e.key;
        if (e.code === 'Space') keyName = 'Space';
        else if (keyName.length === 1) keyName = keyName.toUpperCase();
        if (!parts.includes(keyName)) {
          parts.push(keyName);
        }
      }

      if (parts.length > 0 && (!isModifierOnly || parts.length >= 2)) {
        const comboStr = parts.join(' + ');
        setCustomShortcuts((prev) => {
          const updated = { ...prev, [bindingShortcutKey]: comboStr };
          try {
            localStorage.setItem('kibo_custom_shortcuts', JSON.stringify(updated));
            window.kiboAPI?.updateShortcuts?.(updated);
          } catch (_) {}
          return updated;
        });
        setBindingShortcutKey(null);
      }
    };

    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [bindingShortcutKey]);

  // Persist clipboard items to localStorage
  useEffect(() => {
    try {
      if (clipboardItems.length > 0) {
        localStorage.setItem('kibo_clip_history', JSON.stringify(clipboardItems.slice(0, 50)));
      }
    } catch (_) {}
  }, [clipboardItems]);

  // Helper to merge incoming clipboard items while strictly preserving user pins and deletions
  const mergeClipboardSafely = useCallback((incoming: ClipboardItem[], prevList: ClipboardItem[]) => {
    const pinMap = new Map<string, boolean>();
    for (const p of prevList) {
      if (p.isPinned) {
        if (p.preview) pinMap.set(p.preview, true);
        if (p.imageDataUrl) pinMap.set(p.imageDataUrl, true);
      }
    }
    return incoming.map((item) => {
      const isPinned = Boolean(
        item.isPinned ||
        (item.preview ? pinMap.get(item.preview) : false) ||
        (item.imageDataUrl ? pinMap.get(item.imageDataUrl) : false)
      );
      return isPinned ? { ...item, isPinned: true, isToday: false } : item;
    }).slice(0, 50);
  }, []);

  useEffect(() => {
    // 1. Initial Load from background watcher on startup
    window.kiboAPI?.getClipboardHistory?.().then((items) => {
      if (Array.isArray(items) && items.length > 0) {
        setClipboardItems((prev) => mergeClipboardSafely(items, prev));
        setSelectedClipboardId((curr) => curr || items[0].id);
      }
    });

    // 2. Subscribe to new text & screenshot copies emitted by background Electron watcher
    const unreg = window.kiboAPI?.onClipboardItemAdded
      ? window.kiboAPI.onClipboardItemAdded((newItem) => {
          setClipboardItems((prev) => {
            const filtered = prev.filter((i) =>
              newItem.category === 'Images' && newItem.imageDataUrl && i.imageDataUrl
                ? i.imageDataUrl !== newItem.imageDataUrl
                : i.preview !== newItem.preview
            );
            return [newItem, ...filtered].slice(0, 50);
          });
          setSelectedClipboardId(newItem.id);
        })
      : () => {};

    // 3. Subscribe to tray menu & Chrome extension "open-settings" commands (Chat, Account, Shortcuts, Core)
    const unregSettings = window.kiboAPI?.onOpenSettings
      ? window.kiboAPI.onOpenSettings((section) => {
          setIsTucked(false);
          setShowMediaNotch(false);
          setShowCompanionWindow(false);
          setIsExpanded(true);
          if (section === 'Chat') {
            setActiveTab('Chat');
            return;
          }
          setActiveTab('Settings');
          if (section === 'Core' || section === 'soul') {
            setSettingsCategory('Core');
          } else if (section === 'Voice') {
            setSettingsCategory('Voice');
          } else if (section === 'Shortcuts') {
            setSettingsCategory('Shortcuts');
          } else if (section === 'System') {
            setSettingsCategory('System');
          } else {
            setSettingsCategory('Account');
          }
        })
      : () => {};

    // 4. Subscribe to outside desktop click / blur to immediately collapse expanded notch
    const unregOutsideClick = window.kiboAPI?.onDesktopClickedOutside
      ? window.kiboAPI.onDesktopClickedOutside(() => {
          if (isNativeDialogOpenRef.current || isDraggingVolumeRef.current || isDraggingMediaScrubRef.current) return;
          setActiveControlDropdown(null);
          setShowMediaNotch(false);
          setIsExpanded(false);
          if (autoTuckEnabled) setIsTucked(true);
        })
      : () => {};

    // 5. Focus/Sync reader (supports both Electron direct readers and Browser navigator.clipboard)
    const syncActiveClipboard = async () => {
      if (window.kiboAPI?.getClipboardHistory) {
        try {
          const items = await window.kiboAPI.getClipboardHistory();
          if (Array.isArray(items) && items.length > 0) {
            setClipboardItems((prev) => mergeClipboardSafely(items, prev));
            setSelectedClipboardId((curr) => curr || items[0].id);
          }
        } catch (_) {}
      } else if (navigator.clipboard?.readText) {
        try {
          const text = await navigator.clipboard.readText();
          if (text && text.trim() && text !== lastSeenClipTextRef.current) {
            lastSeenClipTextRef.current = text;
            const isUrl = /^https?:\/\/[^\s]+$/i.test(text.trim());
            const isCode = /[{};()\[\]<>=]/.test(text) && text.includes('\n');
            const chars = text.length;
            const words = text.trim().split(/\s+/).filter(Boolean).length;
            const lines = text.split(/\r?\n/).length;
            const nowStr = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            const item: ClipboardItem = {
              id: Date.now() + Math.floor(Math.random() * 1000),
              category: isUrl ? 'Links' : 'Text',
              preview: text,
              label: text.replace(/\s+/g, ' ').slice(0, 42) + (text.length > 42 ? '...' : ''),
              time: 'now',
              type: isUrl ? 'Link' : isCode ? 'Code Snippet' : 'Text',
              size: `${chars} characters · ${words} words · ${lines} ${lines === 1 ? 'line' : 'lines'}`,
              copied: `Today, ${nowStr}`,
              iconType: isUrl ? 'link' : isCode ? 'code' : 'text',
              isToday: true,
              isPinned: false,
            };
            setClipboardItems((prev) => [item, ...prev.filter((i) => i.preview !== text)].slice(0, 50));
            setSelectedClipboardId((curr) => curr || item.id);
          }
        } catch (_) {}
      }
    };

    window.addEventListener('focus', syncActiveClipboard);

    return () => {
      window.removeEventListener('focus', syncActiveClipboard);
      unreg();
      unregSettings();
      unregOutsideClick();
    };
  }, [mergeClipboardSafely]);

  // Sync latest clipboard history whenever user navigates to the Clipboard tab
  useEffect(() => {
    if (activeTab === 'Clipboard') {
      window.kiboAPI?.getClipboardHistory?.().then((items) => {
        if (Array.isArray(items) && items.length > 0) {
          setClipboardItems((prev) => mergeClipboardSafely(items, prev));
          setSelectedClipboardId((curr) => curr || items[0].id);
        }
      });
    }
  }, [activeTab, mergeClipboardSafely]);

  // Official Wallpapers, Dynamic Canvas Color Extraction & Zero-Skip GSAP Iris Reveal
  const [adaptiveWallpaperTheme, setAdaptiveWallpaperTheme] = useState<WallpaperTheme | null>(null);
  const [wallpapersList, setWallpapersList] = useState<WallpaperTheme[]>(DEFAULT_WALLPAPERS);
  const [wallpaperSourceTab, setWallpaperSourceTab] = useState<'Recent' | 'My folder'>('Recent');
  const [focusedWallpaperIndex, setFocusedWallpaperIndex] = useState<number>(2);
  const [appliedWallpaperIndex, setAppliedWallpaperIndex] = useState<number>(2);
  const [prevAppliedWallpaperIndex, setPrevAppliedWallpaperIndex] = useState<number>(2);
  const [isWallpaperRippling, setIsWallpaperRippling] = useState<boolean>(false);
  const [ripplingWallpaperUrl, setRipplingWallpaperUrl] = useState<string>('');
  const [isApplyingWallpaper, setIsApplyingWallpaper] = useState<boolean>(false);
  const irisOverlayRef = useRef<HTMLDivElement>(null);

  const resolveWallpaperDisplayUrl = useCallback((rawUrl: string) => {
    if (!rawUrl) return '';
    if (rawUrl.startsWith('data:') || rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
      return rawUrl;
    }
    const clean = rawUrl.replace(/^file:\/\/\/?/i, '');
    return `http://127.0.0.1:51742/api/wallpaper?path=${encodeURIComponent(clean)}`;
  }, []);

  const extractAndApplyPaletteForIndex = useCallback(
    async (index: number, listToUse: WallpaperTheme[]) => {
      const target = listToUse[index];
      if (!target) return;
      try {
        let srcToLoad = target.url;
        if (window.kiboAPI?.getWallpaperDataUrl) {
          srcToLoad = await window.kiboAPI.getWallpaperDataUrl(target.filePath || target.url);
        }
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        await new Promise<void>((res) => {
          img.onload = () => res();
          img.onerror = () => res();
          img.src = srcToLoad;
        });
        const extracted = extractPaletteFromImageElement(img);
        if (extracted) {
          setWallpapersList((prev) =>
            prev.map((wp, idx) => (idx === index ? { ...wp, ...extracted } : wp))
          );
          setAdaptiveWallpaperTheme({
            id: target.id || 9999,
            title: target.title || 'Current Desktop Wallpaper',
            url: target.url,
            thumb: target.thumb || target.url,
            accent: extracted.accent,
            accentSecondary: extracted.accentSecondary,
            pillBg: extracted.pillBg,
            rowBg: extracted.rowBg,
            darkText: '#FFFFFF',
            darkSubText: '#94A3B8',
          });
        }
      } catch (_) {}
    },
    []
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      extractAndApplyPaletteForIndex(appliedWallpaperIndex, wallpapersList);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  const [fullScreenDims, setFullScreenDims] = useState<{ w: number; h: number }>(() => ({
    w: typeof window !== 'undefined' ? window.screen.width : 1920,
    h: typeof window !== 'undefined' ? window.screen.height : 1080,
  }));

  useEffect(() => {
    const updateDims = () => {
      setFullScreenDims({
        w: window.screen.width || window.innerWidth,
        h: window.screen.height || window.innerHeight,
      });
    };
    window.addEventListener('resize', updateDims);
    return () => window.removeEventListener('resize', updateDims);
  }, []);

  const activeTheme = adaptiveWallpaperTheme || wallpapersList[appliedWallpaperIndex] || wallpapersList[2] || DEFAULT_WALLPAPERS[2];
  const prevTheme = wallpapersList[prevAppliedWallpaperIndex] || wallpapersList[2] || DEFAULT_WALLPAPERS[2];

  // Real Installed PC Apps & Games with Persistent Starring
  const [appSearchQuery, setAppSearchQuery] = useState('');
  const [appFilterTab, setAppFilterTab] = useState<'All' | 'Starred' | 'Games' | 'Apps'>('All');
  const [starredAppNames, setStarredAppNames] = useState<string[]>(() => {
    const saved = localStorage.getItem('kibo_starred_apps');
    return saved ? JSON.parse(saved) : [];
  });
  const [appsList, setAppsList] = useState<InstalledAppItem[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (window.kiboAPI?.getInstalledApps) {
        window.kiboAPI.getInstalledApps().then((list) => {
          if (Array.isArray(list) && list.length > 0) {
            setAppsList(list);
          }
        });
      }
    }, 2600);
    return () => clearTimeout(timer);
  }, []);

  const toggleStarApp = (appName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const key = appName.toLowerCase();
    setStarredAppNames((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      localStorage.setItem('kibo_starred_apps', JSON.stringify(next));
      return next;
    });
  };

  const [isSpeedTesting, setIsSpeedTesting] = useState(false);
  const [speedDownload, setSpeedDownload] = useState<number | null>(null);
  const [speedUpload, setSpeedUpload] = useState<number | null>(null);
  const [speedLastTested, setSpeedLastTested] = useState<string>('Not tested yet');
  const [appsSortBy, setAppsSortBy] = useState<'RAM' | 'CPU'>('RAM');

  const [pendingPowerAction, setPendingPowerAction] = useState<'lock' | 'sleep' | 'restart' | 'shutdown' | null>(null);
  const [powerFeedback, setPowerFeedback] = useState<string | null>(null);

  const [systemStats, setSystemStats] = useState<any>({
    cpu: { percent: 18, model: 'Loading Processor...', speed: ':  GHz', processes: 0 },
    gpu: { percent: 8, name: 'Detecting Graphics...', model: 'Detecting Graphics...', vramUsed: '0.0', vramTotal: '0.0' },
    ram: { percent: 45, usedGb: '0.0', totalGb: '0.0', freeGb: '0.0' },
    disk: { usedGb: 0, totalGb: 0 },
    network: { down: '0 B/s', up: '0 B/s' },
    uptime: '0 h 0 m',
    topApps: [],
  });

  const tabContentRef = useRef<HTMLDivElement>(null);
  const volumeTrackRef = useRef<HTMLDivElement>(null);
  const idleTuckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boundsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wheelLockRef = useRef<number>(0);
  const prevWindowBoundsRef = useRef<{ w: number; h: number }>({ w: 190, h: 18 });

  const currentSoul: SoulConfig = useMemo(
    () => SOUL_SKINS.find((s) => s.key === selectedSkinKey) || SOUL_SKINS[0],
    [selectedSkinKey]
  );

  // Synchronize system tray icon color with equipped core skin or wallpaper accent
  useEffect(() => {
    const targetColor = activeTheme?.accent || currentSoul?.primaryColor || '#38BDF8';
    window.kiboAPI?.updateTrayColor?.(targetColor);
  }, [selectedSkinKey, activeTheme?.accent, currentSoul?.primaryColor]);

  const isVoidEquipped = useMemo(
    () => currentSoul.key === 'flame_void' || equippedCards.Soul === 'soul_void' || selectedSkinKey === 'flame_void',
    [currentSoul.key, equippedCards.Soul, selectedSkinKey]
  );

  // Delta-Time Orbit + Spring-Physics Lasso Simulation Loop
  useEffect(() => {
    if (!showCompanionWindow || companionDockTab !== 'soul' || activeDeckSlot) return;

    let rafId: number;
    let lastTime = performance.now();

    const stepPhysics = (nowTime: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (nowTime - lastTime) / 1000));
      lastTime = nowTime;

      if (!draggingNodeSlotRef.current) {
        orbitAngleRef.current = (orbitAngleRef.current + 0.042 * dt) % (Math.PI * 2);
      }

      const phys = nodePhysicsRef.current;
      const timeScale = dt * 60;

      for (const def of ORBIT_SLOTS) {
        const s = phys[def.slot];

        if (draggingNodeSlotRef.current !== def.slot) {
          const kNode = 0.14;
          const dampNode = Math.pow(0.76, timeScale);
          s.vx = (s.vx - s.x * kNode * timeScale) * dampNode;
          s.vy = (s.vy - s.y * kNode * timeScale) * dampNode;
          s.x += s.vx * timeScale;
          s.y += s.vy * timeScale;
          if (Math.abs(s.x) < 0.05 && Math.abs(s.vx) < 0.05) {
            s.x = 0;
            s.vx = 0;
          }
          if (Math.abs(s.y) < 0.05 && Math.abs(s.vy) < 0.05) {
            s.y = 0;
            s.vy = 0;
          }
        }

        const angle = def.baseAngle + orbitAngleRef.current;
        const nodeX = STAGE_CENTER_X + Math.cos(angle) * def.radiusX + s.x;
        const nodeY = STAGE_CENTER_Y + Math.sin(angle) * def.radiusY + s.y;

        const dx = nodeX - STAGE_CENTER_X;
        const dy = nodeY - STAGE_CENTER_Y;
        const dist = Math.max(1, Math.hypot(dx, dy));
        const ux = dx / dist;
        const uy = dy / dist;

        const px = -uy;
        const py = ux;
        const tensionRatio = Math.max(0.18, Math.min(1.1, 175 / dist));
        const slackBend = Math.min(44, dist * 0.24) * tensionRatio;

        const targetBendX = STAGE_CENTER_X + dx * 0.48 + px * slackBend;
        const targetBendY = STAGE_CENTER_Y + dy * 0.48 + py * slackBend;

        const kBend = 0.18;
        const dampBend = Math.pow(0.74, timeScale);
        s.bvx = (s.bvx + (targetBendX - s.bendX) * kBend * timeScale) * dampBend;
        s.bvy = (s.bvy + (targetBendY - s.bendY) * kBend * timeScale) * dampBend;
        s.bendX += s.bvx * timeScale;
        s.bendY += s.bvy * timeScale;
      }

      setOrbitRenderTick((t) => (t + 1) % 1000000);
      rafId = requestAnimationFrame(stepPhysics);
    };

    rafId = requestAnimationFrame(stepPhysics);
    return () => cancelAnimationFrame(rafId);
  }, [showCompanionWindow, companionDockTab, activeDeckSlot]);

  const openLoadoutCardDeck = useCallback(
    (slot: LoadoutSlotType) => {
      const slotCards = LOADOUT_CARDS.filter((c) => c.slot === slot);
      const equippedId = equippedCards[slot];
      const idx = Math.max(0, slotCards.findIndex((c) => c.id === equippedId));
      setDeckCardIndex(idx);
      setActiveDeckSlot(slot);
    },
    [equippedCards]
  );

  useEffect(() => {
    if (!draggingNodeSlot) return;
    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - nodeDragStartRef.current.startX;
      const dy = e.clientY - nodeDragStartRef.current.startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        nodeDragStartRef.current.moved = true;
      }
      const p = nodePhysicsRef.current[draggingNodeSlot];
      const nextX = nodeDragStartRef.current.origX + dx;
      const nextY = nodeDragStartRef.current.origY + dy;
      p.vx = (nextX - p.x) * 0.5;
      p.vy = (nextY - p.y) * 0.5;
      p.x = nextX;
      p.y = nextY;
    };
    const onUp = () => {
      const slot = draggingNodeSlot;
      const wasMoved = nodeDragStartRef.current.moved;
      draggingNodeSlotRef.current = null;
      setDraggingNodeSlot(null);
      if (!wasMoved && slot) {
        openLoadoutCardDeck(slot);
        if (slot === 'Voice') {
          const voiceCard = LOADOUT_CARDS.find((c) => c.id === equippedCards.Voice);
          const currentVoice = (voiceCard?.name || 'Charon') as KiboVoiceName;
          voiceEngine.speak(`I am ${currentVoice}. Kibo voice module online. Systems calibrated.`, {
            voice: currentVoice,
          });
        }
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [draggingNodeSlot, openLoadoutCardDeck]);

  useEffect(() => {
    if (!isBindingTrigger) return;
    const handleKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') {
        setIsBindingTrigger(false);
        return;
      }
      const keyName = e.key.length === 1 ? e.key.toUpperCase() : e.key;
      setAbilityTriggerKey(keyName);
      localStorage.setItem('kibo_ability_trigger', keyName);
      setIsBindingTrigger(false);
    };
    const handleMouse = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const btnName = e.button === 0 ? 'M1' : e.button === 2 ? 'M2' : `M${e.button + 1}`;
      setAbilityTriggerKey(btnName);
      localStorage.setItem('kibo_ability_trigger', btnName);
      setIsBindingTrigger(false);
    };
    window.addEventListener('keydown', handleKey, true);
    window.addEventListener('mousedown', handleMouse, true);
    return () => {
      window.removeEventListener('keydown', handleKey, true);
      window.removeEventListener('mousedown', handleMouse, true);
    };
  }, [isBindingTrigger]);

  const playAlarmChime = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      [587.33, 880, 1174.66].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.001, ctx.currentTime + idx * 0.11);
        gain.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + idx * 0.11 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + idx * 0.11 + 0.45);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.11);
        osc.stop(ctx.currentTime + idx * 0.11 + 0.48);
      });
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (timerAlarmRinging) {
      playAlarmChime();
      alarmIntervalRef.current = setInterval(playAlarmChime, 1500);
    } else if (alarmIntervalRef.current) {
      clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = null;
    }
    return () => {
      if (alarmIntervalRef.current) clearInterval(alarmIntervalRef.current);
    };
  }, [timerAlarmRinging, playAlarmChime]);

  const triggerSparklePop = useCallback((todoId: number) => {
    if (sparkleTimerRef.current) clearTimeout(sparkleTimerRef.current);
    setSparkleBurstId(todoId);
    setSparkleAnimKey((k) => k + 1);
    sparkleTimerRef.current = setTimeout(() => {
      setSparkleBurstId((curr) => (curr === todoId ? null : curr));
    }, 1650);
  }, []);

  const openCompanionApp = useCallback(
    (tab: 'soul' | 'settings' | string, openKeyModal = false) => {
      setIsExpanded(true);
      setActiveTab('Settings');
      setShowMediaNotch(false);
      setShowCompanionWindow(false);
      if (tab === 'soul' || tab === 'Core') {
        setSettingsCategory('Core');
      } else if (tab === 'shortcuts' || tab === 'Shortcuts') {
        setSettingsCategory('Shortcuts');
      } else if (tab === 'general' || tab === 'General') {
        setSettingsCategory('General');
      } else if (tab === 'system' || tab === 'System') {
        setSettingsCategory('System');
      } else {
        setSettingsCategory('Account');
      }
    },
    []
  );



  useEffect(() => {
    if (!window.kiboAPI?.setAppWindowRect) return;
    if (showCompanionWindow) {
      window.kiboAPI.setAppWindowRect({
        x: appWindowPos.x,
        y: appWindowPos.y,
        width: APP_WIN_W,
        height: APP_WIN_H,
      });
    } else {
      window.kiboAPI.setAppWindowRect(null);
    }
  }, [showCompanionWindow, appWindowPos]);

  useEffect(() => {
    if (!isDraggingAppWin) return;
    const handleMove = (e: PointerEvent) => {
      const maxX = Math.max(0, window.innerWidth - APP_WIN_W);
      const maxY = Math.max(0, window.innerHeight - 60);
      const nextX = Math.min(maxX, Math.max(0, Math.round(e.clientX - dragOffsetRef.current.dx)));
      const nextY = Math.min(maxY, Math.max(0, Math.round(e.clientY - dragOffsetRef.current.dy)));
      setAppWindowPos({ x: nextX, y: nextY });
    };
    const handleUp = () => setIsDraggingAppWin(false);
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [isDraggingAppWin]);

  // Only hide the media notch when the media app (e.g. Spotify) is actually closed!
  useEffect(() => {
    if (!hasMediaSession && showMediaNotch) {
      setShowMediaNotch(false);
    }
  }, [hasMediaSession, showMediaNotch]);

  useEffect(() => {
    if (idleTuckTimerRef.current) clearTimeout(idleTuckTimerRef.current);

    const isBusy =
      !autoTuckEnabled ||
      onboardingStep !== null ||
      Boolean(notchApiAlert) ||
      isExpanded ||
      showMediaNotch ||
      isTimerRunning ||
      isTimerSessionActive ||
      timerSeconds < timerTotalSeconds ||
      timerAlarmRinging ||
      stopwatchRunning ||
      stopwatchMs > 0 ||
      askNotchPhase !== 'idle' ||
      Boolean(contextCard) ||
      Boolean(userBubbleText) ||
      Boolean(kiboReply) ||
      dictationState !== 'idle' ||
      lassoActive ||
      soulAnnoyance > 0 ||
      soulIsHit ||
      isBreathingRelief ||
      isDraggingVolume ||
      isDraggingMediaScrub;

    if (!isBusy && !isTucked) {
      idleTuckTimerRef.current = setTimeout(() => {
        setIsTucked(true);
      }, 4500);
    }

    return () => {
      if (idleTuckTimerRef.current) clearTimeout(idleTuckTimerRef.current);
    };
  }, [
    autoTuckEnabled,
    onboardingStep,
    notchApiAlert,
    isExpanded,
    showMediaNotch,
    isTimerRunning,
    isTimerSessionActive,
    timerSeconds,
    timerTotalSeconds,
    timerAlarmRinging,
    stopwatchRunning,
    stopwatchMs,
    askNotchPhase,
    contextCard,
    userBubbleText,
    kiboReply,
    dictationState,
    lassoActive,
    soulAnnoyance,
    soulIsHit,
    isBreathingRelief,
    isDraggingVolume,
    isDraggingMediaScrub,
    isTucked,
  ]);

  const currentTabDimensions = useMemo(() => {
    if (activeTab === 'Controls') {
      return { w: 708, h: hasMediaSession ? 396 : 268 };
    }
    const dims: Record<NavTab, { w: number; h: number }> = {
      Chat:      { w: 720, h: 460 },
      Agents:    { w: 860, h: 440 },
      Convert:   { w: 780, h: 468 },
      Focus:     expandedStickyId ? { w: 880, h: 520 } : { w: 820, h: 460 },
      Skills:    { w: 820, h: 460 },
      Media:     { w: 664, h: 248 },
      Controls:  { w: 708, h: 396 },
      Today:     { w: 860, h: 440 },
      Clipboard: { w: 860, h: 444 },
      Apps:      { w: 860, h: 500 },
      Wallpaper: { w: 680, h: 168 },
      Power:     { w: 708, h: 168 },
      Settings:  { w: 880, h: 540 },
    };
    return dims[activeTab] || { w: 740, h: 450 };
  }, [activeTab, hasMediaSession, expandedStickyId]);

  const handleRunFileConversion = useCallback(
    async (opts: { filePath?: string; fileNameQuery?: string; targetFormat: string }) => {
      if (!window.kiboAPI?.convertFile) {
        setConvertStatusMsg({
          type: 'err',
          text: 'Desktop file converter requires running inside the Kibo Electron app.',
        });
        return null;
      }
      setIsConvertingFile(true);
      setConvertStatusMsg({
        type: 'info',
        text: `Converting to .${opts.targetFormat.toUpperCase()} (original file will not be deleted)...`,
      });
      try {
        const res = await window.kiboAPI.convertFile(opts);
        setIsConvertingFile(false);
        if (res?.success && res.outputPath) {
          const srcName = (res.sourcePath || opts.filePath || opts.fileNameQuery || 'File').split(/[\\/]/).pop() || 'File';
          const outName = res.outputFileName || res.outputPath.split(/[\\/]/).pop() || 'Converted';
          const record: ConvertedFileRecord = {
            id: `${Date.now()}`,
            sourceName: srcName,
            sourcePath: res.sourcePath || opts.filePath || '',
            outputFileName: outName,
            outputPath: res.outputPath,
            targetFormat: opts.targetFormat.toUpperCase(),
            timestamp: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
          };
          setRecentConversions((prev) => {
            const next = [record, ...prev].slice(0, 20);
            try {
              localStorage.setItem('kibo_recent_conversions', JSON.stringify(next));
            } catch (_) {}
            return next;
          });
          setConvertStatusMsg({
            type: 'ok',
            text: `Converted to ${outName} · Original file preserved untouched`,
            outputPath: res.outputPath,
          });
          soundFX.playTaskSuccess();
          addEmbers(4);
          return res;
        } else {
          setConvertStatusMsg({
            type: 'err',
            text: res?.error || 'Could not convert file.',
          });
          return res;
        }
      } catch (err: any) {
        setIsConvertingFile(false);
        setConvertStatusMsg({
          type: 'err',
          text: String(err?.message || 'Conversion failed'),
        });
        return null;
      }
    },
    [addEmbers]
  );

  const showProactiveBanner = !isExpanded && !showCompanionWindow && Boolean(detectedAppId);
  const showNotchNotification = !isExpanded && !showCompanionWindow && !showProactiveBanner && !showMediaNotch && !isFileDraggingOverNotch && Boolean(activeNotchNotification);
  const isCompactAskBar = !showProactiveBanner && !showNotchNotification && (askNotchPhase === 'speaking' || askNotchPhase === 'thinking');
  const isStopwatchNotchActive = !isExpanded && !showProactiveBanner && !showNotchNotification && !showMediaNotch && !isCompactAskBar && (stopwatchRunning || stopwatchMs > 0);
  const isTimerNotchActive = !isExpanded && !showProactiveBanner && !showNotchNotification && !showMediaNotch && !isCompactAskBar && (isTimerRunning || isTimerSessionActive || timerSeconds < timerTotalSeconds || timerAlarmRinging || isStopwatchNotchActive);
  const isMiniMediaPill = (bootPhase === 'ready' || bootPhase === 'tucking') && !isExpanded && !showProactiveBanner && !showNotchNotification && !showMediaNotch && !isCompactAskBar && !isTimerNotchActive && !notchApiAlert && !isFileDraggingOverNotch && hasMediaSession;
  const isTuckedSliver = (isTucked || bootPhase === 'sleeping' || (bootPhase === 'tucking' && !hasMediaSession)) && !isExpanded && !showProactiveBanner && !showNotchNotification && !showMediaNotch && !isTimerNotchActive && !isCompactAskBar && !isMiniMediaPill && !notchApiAlert && !isFileDraggingOverNotch;

  const archSize = (isTuckedSliver || bootPhase === 'sleeping') ? 9 : showProactiveBanner || isFileDraggingOverNotch || showNotchNotification ? 20 : isMiniMediaPill || isCompactAskBar || isTimerNotchActive || notchApiAlert ? 16 : 22;

  const notchShellWidth = isExpanded
    ? currentTabDimensions.w - archSize * 2
    : isFileDraggingOverNotch
    ? 336
    : showProactiveBanner
    ? 580 - archSize * 2
    : showNotchNotification
    ? 368 - archSize * 2
    : showMediaNotch
    ? 320
    : notchApiAlert
    ? 294
    : timerAlarmRinging
    ? 256
    : isMiniMediaPill
    ? 204
    : isTimerNotchActive
    ? 212
    : isCompactAskBar
    ? 192
    : bootPhase === 'sleeping'
    ? 88
    : (isTucked || bootPhase === 'tucking')
    ? 190
    : 196;

  const notchShellHeight = isExpanded
    ? currentTabDimensions.h
    : isFileDraggingOverNotch
    ? 108
    : showProactiveBanner
    ? 106
    : showNotchNotification
    ? 52
    : showMediaNotch
    ? 124
    : notchApiAlert
    ? 40
    : timerAlarmRinging
    ? 68
    : isMiniMediaPill
    ? 34
    : isTimerNotchActive
    ? 42
    : isCompactAskBar
    ? 44
    : bootPhase === 'sleeping'
    ? 14
    : (isTucked || bootPhase === 'tucking')
    ? 18
    : 72;

  const bottomRadius = (isTuckedSliver || bootPhase === 'sleeping')
    ? 9
    : showProactiveBanner || isFileDraggingOverNotch || showNotchNotification
    ? 20
    : isMiniMediaPill || isCompactAskBar || isTimerNotchActive || notchApiAlert
    ? 15
    : showMediaNotch
    ? 20
    : isExpanded
    ? 22
    : 18;

  const activeHitboxWidth =
    lassoActive || onboardingStep !== null
      ? window.innerWidth || 1920
      : dictationState !== 'idle'
      ? Math.max(notchShellWidth + archSize * 2, 704)
      : isExpanded
      ? notchShellWidth + archSize * 2
      : notchShellWidth;

  const activeHitboxHeight =
    lassoActive || onboardingStep !== null
      ? window.innerHeight || 1080
      : dictationState !== 'idle'
      ? 240
      : contextCard
      ? Math.max(notchShellHeight + 125, 220)
      : showProactiveBanner
      ? 110
      : showMediaNotch
      ? 128
      : isExpanded
      ? notchShellHeight + 4
      : notchShellHeight;

  useEffect(() => {
    if (!window.kiboAPI?.setWindowBounds) return;

    if (boundsTimeoutRef.current) {
      clearTimeout(boundsTimeoutRef.current);
      boundsTimeoutRef.current = null;
    }

    const prev = prevWindowBoundsRef.current;
    if (activeHitboxWidth !== prev.w || activeHitboxHeight !== prev.h) {
      window.kiboAPI.setWindowBounds(activeHitboxWidth, activeHitboxHeight);
      prevWindowBoundsRef.current = { w: activeHitboxWidth, h: activeHitboxHeight };
    }

    return () => {
      if (boundsTimeoutRef.current) clearTimeout(boundsTimeoutRef.current);
    };
  }, [activeHitboxWidth, activeHitboxHeight]);

  // =========================================================================
  // UNIVERSAL GEMINI FUNCTION-CALLING COMMAND EXECUTOR (Zero Hardcoded Keywords!)
  // =========================================================================
  const executeVoiceCommand = useCallback(
    async (rawSpeech: string, optionalImage?: string) => {
      const text = rawSpeech.trim();
      if (!text) return;

      appendChatMessage({ role: 'user', text });

      setIsTucked(false);
      setAskNotchPhase('thinking');
      setSoulMode('THINKING');
      setAskWords(text.split(/\s+/));

      let fc: any = null;
      let speech = 'Done.';

      // Strip assistant wake words and punctuation so patterns like "Kibo, open notes.docx" resolve cleanly
      const cleanCommand = text
        .replace(/^(?:kibo|hey\s+kibo|hi\s+kibo|yo\s+kibo|ok\s+kibo|okay\s+kibo)[,\s:]+/i, '')
        .trim();
      const lower = (cleanCommand || text).toLowerCase().trim();

      if (apiKey && apiKey.trim()) {
        try {
          const res = await queryGemini(cleanCommand || text, apiKey, optionalImage);
          fc = res.functionCall;
          speech = res.speech || 'Done.';
        } catch (err: any) {
          const msg = String(err?.message || '');
          const isRateLimit = msg.includes('429');
          setNotchApiAlert({
            type: 'rate_limit',
            text: isRateLimit
              ? 'Gemini API rate limit reached · Click to check key'
              : 'Gemini API error · Click to check Settings',
          });
          if (!speech || speech === 'Done.') {
            speech = isRateLimit
              ? 'Rate limit reached. Please wait a moment.'
              : 'Could not connect to Gemini. Check your API key in Settings.';
          }
        }
      } else {
        setNotchApiAlert({
          type: 'missing_key',
          text: 'Connect Gemini API key · Click to setup',
        });
        if (!speech || speech === 'Done.') {
          speech = 'Please connect your free Gemini API key in Settings.';
        }
      }

      // 00. Persistent User Name & Memory ("I'm Raahim", "My name is Raahim", or Gemini's remember_user_fact tool)
      const nameQuickMatch = text.match(/\b(?:i\s+am|i'm|im|my\s+name\s+is|call\s+me)\s+([A-Z][a-zA-Z0-9_-]{1,22})\b/i);
      if (nameQuickMatch?.[1]) {
        const cleanName = nameQuickMatch[1].trim();
        const banned = ['kibo', 'ready', 'back', 'here', 'working', 'trying', 'going', 'looking', 'asking', 'talking', 'good', 'fine', 'okay', 'tired', 'happy'];
        if (!banned.includes(cleanName.toLowerCase())) {
          setUserName(cleanName);
          savePersistentUserMemory({ userName: cleanName });
        }
      }
      if (fc?.name === 'remember_user_fact') {
        const learnedName = fc.args?.userName ? String(fc.args.userName).trim() : '';
        const learnedFact = fc.args?.fact ? String(fc.args.fact).trim() : '';
        if (learnedName) {
          setUserName(learnedName);
        }
        savePersistentUserMemory({
          userName: learnedName || undefined,
          fact: learnedFact || undefined,
        });
        showReplyWithSpeech(
          speech && speech !== 'Done.'
            ? speech
            : learnedName
            ? `Got it, ${learnedName}! I'll remember your name and preferences whenever you start Kibo.`
            : `Got it! I've saved that to my memory.`,
          learnedName ? `Remembered: ${learnedName}` : 'Saved to Memory'
        );
        return;
      }

      // 0A. Voice-Triggered Non-Destructive File Conversion ("Convert resume.pdf to Word", "Convert the kibo.text file to pdf")
      const convertRegexMatch = text.match(
        /\bconvert\s+(?:my\s+|the\s+|a\s+|file\s+)?["']?([^"']+?)["']?(?:\s+file|\s+document)?\s+(?:to|into)\s+(pdf|word|docx|doc|txt|text|md|markdown|html|json|csv|png|jpg|jpeg|webp)\b/i
      );
      if (fc?.name === 'convert_file' || convertRegexMatch) {
        const rawSourceInput = String(
          fc?.args?.sourceFileName || (convertRegexMatch ? convertRegexMatch[1] : '') || ''
        ).trim();
        const cleanedSource = rawSourceInput
          .replace(/^["']+|["']+$/g, '')
          .replace(/\s+dot\s+/gi, '.')
          .replace(/\b(the|my|a|an|this|that|file|document|doc|named|called)\b/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .replace(/\.text$/i, '.txt')
          .replace(/\.word$/i, '.docx')
          .replace(/\.markdown$/i, '.md');

        let rawTarget = String(fc?.args?.targetFormat || (convertRegexMatch ? convertRegexMatch[2] : 'pdf'))
          .toLowerCase()
          .trim();
        if (rawTarget === 'word' || rawTarget === 'doc') rawTarget = 'docx';
        if (rawTarget === 'text') rawTarget = 'txt';
        if (rawTarget === 'markdown') rawTarget = 'md';

        const effectiveQuery = cleanedSource || convertSourceFile?.fileName || '';
        const effectivePath = !cleanedSource && convertSourceFile?.filePath ? convertSourceFile.filePath : undefined;

        if (!effectiveQuery && !effectivePath) {
          showReplyWithSpeech(
            'Please tell me the exact filename to convert, or drop the file into the Convert tab.',
            'Which File to Convert?'
          );
          return;
        }

        setAskNotchPhase('idle');
        setKiboReply({
          bold: `Converting ${effectiveQuery} to .${rawTarget.toUpperCase()}...`,
          rest: 'Original file will be preserved',
        });

        const convRes = await handleRunFileConversion({
          filePath: effectivePath,
          fileNameQuery: effectiveQuery,
          targetFormat: rawTarget,
        });

        if (convRes?.success && convRes.outputPath) {
          const msg = `Converted ${effectiveQuery} to ${convRes.outputFileName || rawTarget.toUpperCase()} without deleting the original.`;
          showReplyWithSpeech(msg, 'Conversion Complete', convRes.outputPath, 'Show in Folder');
        } else {
          showReplyWithSpeech(
            convRes?.error || `I couldn't locate "${effectiveQuery}" in your Desktop, Downloads, or Documents.`
          );
        }
        return;
      }

      // 0B. Voice-Triggered Focus Timer or Stopwatch ("Set a focus timer for 20 minutes", "Start stopwatch")
      const timerRegexMatch = lower.match(/\b(?:set|start)\s+(?:a\s+)?(?:focus\s+)?timer\s+(?:for\s+)?(\d+)\s*(minute|min|second|sec)/i);
      if (fc?.name === 'start_focus_timer' || timerRegexMatch || /\bstart\s+(?:the\s+)?stopwatch\b/i.test(lower)) {
        if (fc?.args?.mode === 'stopwatch' || lower.includes('stopwatch')) {
          setFocusSubMode('stopwatch');
          setStopwatchMs(0);
          setStopwatchLaps([]);
          setStopwatchRunning(true);
          setIsExpanded(true);
          setActiveTab('Focus');
          showReplyWithSpeech('Stopwatch started.', 'Stopwatch Running');
          return;
        }
        const mins = fc?.args?.minutes
          ? Number(fc.args.minutes)
          : timerRegexMatch
          ? timerRegexMatch[2].startsWith('sec')
            ? Math.max(0.2, Number(timerRegexMatch[1]) / 60)
            : Number(timerRegexMatch[1])
          : 25;
        const totalSecs = Math.max(5, Math.round(mins * 60));
        setFocusSubMode('timer');
        setTimerTotalSeconds(totalSecs);
        setTimerSeconds(totalSecs);
        setTimerAlarmRinging(false);
        setIsTimerSessionActive(true);
        setIsTimerRunning(true);
        showReplyWithSpeech(
          `Focus timer started for ${mins >= 1 ? `${Math.round(mins)} minutes` : `${totalSecs} seconds`}. I'll dance when time is up!`,
          'Focus Session Active'
        );
        return;
      }

      // 1. Check Notion Database / Workspace Task FIRST so "create a database in Notion with websites" or "I want websites to be in the database" never triggers BUILD_PAGE!
      const isNotionDatabaseTask =
        lower.includes('websites in the database') ||
        lower.includes('websites to be in the database') ||
        lower.includes('put websites in') ||
        ((lower.includes('notion') || lower.includes('database')) &&
          (lower.includes('create') ||
            lower.includes('make') ||
            lower.includes('build') ||
            lower.includes('add') ||
            lower.includes('save') ||
            lower.includes('store') ||
            lower.includes('curate') ||
            lower.includes('websites') ||
            lower.includes('awards')));

      const isClonePage =
        !isNotionDatabaseTask &&
        (lower.includes('like this landing page') ||
          lower.includes('like this website') ||
          lower.includes('make the exact same') ||
          lower.includes('exact same website') ||
          lower.includes('same landing page') ||
          lower.includes('clone this') ||
          lower.includes('replicate this'));

      const isSaveInspo =
        !isNotionDatabaseTask &&
        (lower.includes('save this landing page') ||
          lower.includes('save this website') ||
          lower.includes('save to inspo') ||
          lower.includes('add to inspiration'));

      const isBuildWebsite =
        !isNotionDatabaseTask &&
        !isClonePage &&
        !isSaveInspo &&
        !lower.includes('database') &&
        !lower.includes('in the database') &&
        !lower.includes('table') &&
        !lower.includes('store') &&
        !lower.includes('save') &&
        !lower.includes('in notion') &&
        (fc?.name === 'build_website' ||
          /\b(make|create|build|generate|design|code)\s+(me\s+)?(a\s+|an\s+|the\s+)?([a-z0-9_-]+\s+)*(website|webpage|landing\s*page|site|portfolio|saas)\b/i.test(
            lower
          ));

      // 1B. Voice-Triggered Email Compose via Gmail Integration
      const isComposeEmail =
        fc?.name === 'compose_email' ||
        ((lower.includes('email') || lower.includes('gmail') || lower.includes('mail')) &&
          (lower.includes('compose') ||
            lower.includes('send') ||
            lower.includes('draft') ||
            lower.includes('write an email') ||
            lower.includes('mail to')));

      if (isComposeEmail) {
        multitaskAgent.spawnTask(text, 'gmail', { kind: 'EMAIL_COMPOSE' });
        showReplyWithSpeech(
          'Composing your email and preparing it with your connected Gmail.',
          'Drafting email...'
        );
        return;
      }

      if (isNotionDatabaseTask) {
        multitaskAgent.spawnTask(text, 'notion', { kind: 'NOTION_DATABASE' });
        showReplyWithSpeech(
          'Curating those websites and building your Notion database now.',
          'Building Notion database in background...'
        );
        return;
      }

      const hasGeneratedWebsite = Boolean(multitaskAgent.getLatestGeneratedPageTask());
      const isEditPage =
        !isNotionDatabaseTask &&
        !isClonePage &&
        !isSaveInspo &&
        hasGeneratedWebsite &&
        /\b(change|edit|update|modify|replace|remove|add\s+a|add\s+an|make\s+the|in\s+the\s+website|on\s+the\s+website|on\s+the\s+page|to\s+the\s+page|to\s+the\s+landing\s+page|previous\s+page|that\s+website)\b/i.test(
          lower
        ) &&
        !lower.includes('night light') &&
        !lower.includes('dark mode') &&
        !lower.includes('volume');

      if (isEditPage) {
        multitaskAgent.spawnTask(text, undefined, { kind: 'EDIT_PAGE' });
        showReplyWithSpeech(
          'Updating your website with those changes right now.',
          'Updating your website file...'
        );
        return;
      }

      if (isClonePage) {
        multitaskAgent.spawnTask(text, undefined, { kind: 'CLONE_PAGE' });
        showReplyWithSpeech(
          'Scanning the website on your screen and building an exact replica.',
          'Cloning active website in background...'
        );
        return;
      }

      if (isSaveInspo) {
        multitaskAgent.spawnTask(text, undefined, { kind: 'SAVE_INSPO' });
        showReplyWithSpeech(
          'Saving design to your inspiration database.',
          'Saving to Inspiration DB...'
        );
        return;
      }

      if (isBuildWebsite) {
        multitaskAgent.spawnTask(text, undefined, { kind: 'BUILD_PAGE' });
        showReplyWithSpeech(
          'Building your website in the background using your active design skills.',
          'Building website in background...'
        );
        return;
      }

      // Dedicated Spotify Playback Handler (Desktop App Priority #1 -> Web Fallback #2)
      const isSpotifyPlayIntent =
        fc?.name === 'play_spotify' ||
        (fc?.name === 'search_web' && String(fc?.args?.platform || '').toLowerCase() === 'spotify') ||
        (lower.includes('spotify') &&
          !lower.startsWith('close ') &&
          !lower.startsWith('quit ') &&
          !/^(open|launch)\s+spotify$/i.test(lower)) ||
        /\bplay\s+(my\s+)?liked\s+songs\b/i.test(lower);

      if (isSpotifyPlayIntent) {
        let rawTarget =
          fc?.args?.query ||
          (fc?.name === 'computer_action' ? fc?.args?.target || fc?.args?.task : '') ||
          text;

        const cleanSpotifyQuery = String(rawTarget)
          .replace(/^(can\s+you\s+|could\s+you\s+|please\s+|kibo\s+|hey\s+kibo\s+|yo\s+)+/i, '')
          .replace(/^(play|put\s+on|listen\s+to|start|search\s+for|search|open)\s+/i, '')
          .replace(/\s+(on|in)\s+spotify.*$/i, '')
          .replace(/\s+for\s+me$/i, '')
          .replace(/[?.!]+$/g, '')
          .trim();

        const isLiked =
          fc?.args?.targetType === 'liked_songs' ||
          /^(my\s+)?liked\s+songs?$/i.test(cleanSpotifyQuery) ||
          lower.includes('liked songs');

        const displayTarget = isLiked ? 'Liked Songs' : cleanSpotifyQuery || 'Spotify';

        setAskNotchPhase('idle');
        setAskWords([]);
        setSoulMode('TALKING');
        setKiboReply({
          bold: `Playing ${displayTarget} on Spotify...`,
        });
        speakAsKibo(`Playing ${displayTarget} on Spotify.`);

        if (window.kiboAPI?.playSpotify) {
          const spRes = await window.kiboAPI.playSpotify(
            displayTarget,
            isLiked ? 'liked_songs' : 'track_or_artist'
          );

          setContextCard({
            header: spRes?.mode === 'app' ? 'Playing in Spotify App' : 'Opened · open.spotify.com',
            title: displayTarget,
            subtitle: spRes?.mode === 'app' ? 'Spotify Desktop' : 'Spotify Web Player',
            domain: 'open.spotify.com',
          });

          // If UIAutomation didn't find the play button directly, use our Vision + Jev clicker to click Play
          if (spRes && !spRes.autoClicked && apiKey) {
            await executeDirectComputerAction(
              {
                actionType: 'click',
                target: isLiked
                  ? 'green Play button for Liked Songs'
                  : `green Play button or first song result for ${displayTarget}`,
              },
              apiKey,
              (status) => setKiboReply({ bold: status })
            );
          }
        } else {
          const fallbackUrl = isLiked
            ? 'https://open.spotify.com/collection/tracks'
            : `https://open.spotify.com/search/${encodeURIComponent(displayTarget)}`;
          window.kiboAPI?.openUrl(fallbackUrl);
        }

        setTimeout(() => {
          setSoulMode('LISTENING');
          setUserBubbleText(null);
          setKiboReply(null);
          setContextCard(null);
        }, 3800);
        return;
      }

      const isFindOrPoint =
        fc?.name === 'find_and_point' ||
        (fc?.name === 'computer_action' && /find|where|point|locate|show|spot|search/i.test(fc?.args?.task || '')) ||
        /\b(find|where\s+is|where's|point\s+to|point\s+at|point\s+out|point|locate|show\s+me|spot|look\s+for|search\s+for)\b/i.test(lower);

      if (isFindOrPoint) {
        let queryTarget = fc?.args?.target || (fc?.name === 'computer_action' ? fc?.args?.task : '') || '';
        if (!queryTarget) {
          queryTarget = text
            .replace(/^(can\s+you\s+|could\s+you\s+|please\s+|kibo\s+|hey\s+kibo\s+|help\s+me\s+)+/i, '')
            .replace(/^(find|where\s+is|where's|point\s+to|point\s+at|point\s+out|point|locate|show\s+me\s+where|show\s+me\s+the|show\s+me|spot|look\s+for|search\s+for)\s+/i, '')
            .replace(/^(the|a|an)\s+/i, '')
            .replace(/[?.!]+$/g, '')
            .trim();
        }
        if (!queryTarget) queryTarget = text;

        setAskNotchPhase('idle');
        setSoulMode('LISTENING');
        setKiboReply(null);
        setUserBubbleText(null);
        handleFindAndPoint(queryTarget.trim());
        return;
      }

      // Universal Click / Play / Select / Write / Type Detection
      const isDirectWriteOnly =
        /^(write|type|enter|input|paste)\s+/i.test(lower) &&
        !lower.includes(' in ') &&
        !lower.includes(' into ') &&
        !lower.includes(' on ');

      const isComputerAction =
        !isFindOrPoint &&
        (fc?.name === 'computer_action' ||
          isDirectWriteOnly ||
          /\b(click|double\s*click|right\s*click|press|tap|select|choose|hit)\b/i.test(lower) ||
          /\b(play|open|watch)\s+(the\s+)?(first|second|third|1st|2nd|3rd|top|next|this)\s+(video|result|song|track|link|item|post|reel|short)/i.test(lower) ||
          /\b(write|type|enter)\s+.+\s+(in|into|on)\s+/i.test(lower));

      if (isComputerAction && apiKey) {
        let actionType: 'click' | 'double_click' | 'right_click' | 'type' =
          fc?.args?.actionType || 'click';
        let targetDesc: string = fc?.args?.target || '';
        let textToType: string = fc?.args?.textToType || '';
        let pressEnter: boolean = Boolean(fc?.args?.pressEnter);

        if (!fc || fc.name !== 'computer_action') {
          if (isDirectWriteOnly) {
            actionType = 'type';
            targetDesc = '';
            textToType = text.replace(/^(write|type|enter|input|paste)\s+/i, '').trim();
          } else {
            const writeInMatch = text.match(/^(?:click\s+(.+?)\s+and\s+)?(?:write|type|enter)\s+["']?(.+?)["']?\s+(?:in|into|on)\s+(.+)$/i);
            if (writeInMatch) {
              actionType = 'type';
              textToType = writeInMatch[2].trim();
              targetDesc = (writeInMatch[1] || writeInMatch[3] || '').trim();
              pressEnter = /search|chat|message|prompt/i.test(targetDesc);
            } else if (/^double\s*click\b/i.test(lower)) {
              actionType = 'double_click';
              targetDesc = text.replace(/^double\s*click\s+(on\s+|the\s+)?/i, '').trim();
            } else if (/^right\s*click\b/i.test(lower)) {
              actionType = 'right_click';
              targetDesc = text.replace(/^right\s*click\s+(on\s+|the\s+)?/i, '').trim();
            } else {
              actionType = 'click';
              targetDesc = text
                .replace(/^(can\s+you\s+|please\s+|kibo\s+)+/i, '')
                .replace(/^(click|press|tap|select|choose|hit|play|watch|open)\s+(on\s+)?/i, '')
                .trim();
            }
          }
        }

        setAskNotchPhase('idle');
        setAskWords([]);
        setKiboReply({ bold: actionType === 'type' ? 'Typing...' : `Locating ${targetDesc || 'target'}...` });

        const actionRes = await executeDirectComputerAction(
          {
            actionType,
            target: targetDesc,
            textToType,
            pressEnter,
          },
          apiKey,
          (status) => setKiboReply({ bold: status }),
          (rect) => {
            // Briefly show the glowing reticle on the clicked element
            setPointedTarget({
              ...rect,
              spokenHint: '',
              confidence: 0.95,
            });
            setRoamingStage('POINTING');
            setTimeout(() => {
              setRoamingStage('IDLE');
              setPointedTarget(null);
            }, 1400);
          }
        );

        const replyMsg = actionRes.summary;
        showReplyWithSpeech(replyMsg);
        return;
      }

      const isAskingForScheduled =
        fc?.name === 'get_scheduled_tasks' ||
        lower.includes('scheduled task') ||
        lower.includes('what are my tasks') ||
        lower.includes('show tasks') ||
        lower.includes('show my tasks') ||
        lower.includes('list tasks') ||
        lower.includes('show routines') ||
        lower.includes('what are my routines') ||
        lower.includes('my routines') ||
        lower.includes('check schedule') ||
        lower.includes('view schedule') ||
        lower.includes('what is scheduled') ||
        lower.includes('what is on my schedule') ||
        lower.includes('my schedule');

      if (isAskingForScheduled) {
        fc = { name: 'get_scheduled_tasks', args: {} };
        if (routines.length > 0) {
          const routineList = routines.slice(0, 3).map((r) => r.title).join(', ');
          speech = `You have ${routines.length} scheduled task${routines.length > 1 ? 's' : ''}: ${routineList}.`;
        } else {
          speech = 'You have no scheduled tasks yet.';
        }
      } else if (!fc) {
        if (lower.includes('night light') || lower.includes('nightlight') || lower.includes('blue light')) {
          const wantOn = !lower.includes('off');
          fc = { name: 'system_action', args: { action: 'night_light', value: wantOn ? 'on' : 'off' } };
          speech = `Night light turned ${wantOn ? 'on' : 'off'}.`;
        } else if (lower.includes('dark mode') || lower.includes('light mode') || lower.includes('eyes are hurting')) {
          const wantDark = !lower.includes('light mode');
          fc = { name: 'system_action', args: { action: 'dark_mode', value: wantDark ? 'on' : 'off' } };
          speech = `${wantDark ? 'Dark' : 'Light'} mode enabled.`;
        } else if (lower.includes('mute') || lower.includes('unmute')) {
          const wantMute = !lower.includes('unmute');
          fc = { name: 'system_action', args: { action: 'mute', value: wantMute ? 'on' : 'off' } };
          speech = wantMute ? 'Muted.' : 'Unmuted.';
        } else if (lower.includes('lock pc') || lower.includes('lock screen') || lower.includes('lock workstation')) {
          fc = { name: 'system_action', args: { action: 'lock' } };
          speech = 'Locking workstation.';
        } else if (lower.includes('sleep pc') || lower.includes('go to sleep')) {
          fc = { name: 'system_action', args: { action: 'sleep' } };
          speech = 'Putting PC to sleep.';
        } else if (lower.includes('volume') || lower.includes('louder') || lower.includes('quieter')) {
          const matchNum = lower.match(/\b(\d{1,3})\b/);
          const vol = matchNum ? matchNum[1] : lower.includes('louder') ? '80' : '30';
          fc = { name: 'system_action', args: { action: 'volume', value: vol } };
          speech = `Volume set to ${vol}%.`;
        } else if (lower.startsWith('open ') || lower.startsWith('launch ')) {
          const app = (cleanCommand || text).replace(/^(open|launch)\s+/i, '').trim();
          fc = { name: 'open_application', args: { appName: app } };
          speech = `Opening ${app}.`;
        } else if (lower.includes('youtube') || lower.includes('spotify') || lower.includes('amazon') || lower.includes('github') || lower.includes('reddit') || lower.includes('wikipedia') || lower.includes('search')) {
          const platform = lower.includes('youtube') ? 'youtube'
            : lower.includes('spotify') ? 'spotify'
            : lower.includes('amazon') ? 'amazon'
            : lower.includes('github') ? 'github'
            : lower.includes('reddit') ? 'reddit'
            : lower.includes('wikipedia') ? 'wikipedia'
            : 'google';
          const query = lower
            .replace(/^search( for)?\s*/i, '')
            .replace(new RegExp(`\\s*(on|in)?\\s*${platform}$`, 'i'), '')
            .trim() || text;
          fc = { name: 'search_web', args: { query, platform } };
          speech = `Searching ${platform} for ${query}.`;
        } else if (lower.includes('every morning') || (lower.includes('schedule') && !lower.startsWith('what') && !lower.startsWith('show') && !lower.startsWith('list')) || /\bat\s+\d+/i.test(lower)) {
          fc = { name: 'schedule_routine', args: { title: text, timeLabel: 'Scheduled · Autopilot' } };
          speech = "Scheduled routine. I'll run it on time.";
        } else if (lower.startsWith('remind me') || lower.startsWith('todo ') || lower.startsWith('add task')) {
          const task = text.replace(/^(remind me to|todo|add task)\s+/i, '');
          fc = { name: 'add_todo', args: { task } };
          speech = 'Added task to your list.';
        }
      }

      setAskNotchPhase('idle');
      setAskWords([]);
      setSoulMode('TALKING');
      setKiboReply({ bold: speech });

      if (fc) {
        if (fc.name === 'get_scheduled_tasks') {
          setShowCompanionWindow(true);
          setCompanionDockTab('settings');
          setSettingsSection('Your data');
          setContextCard({
            header: 'Today · Scheduled Routines',
            title: `${routines.length} Scheduled Task${routines.length !== 1 ? 's' : ''}`,
            subtitle: routines.length > 0 ? routines.map((r) => r.title).join(' · ') : 'No scheduled tasks yet',
            domain: 'Kibo Today',
          });
        } else if (fc.name === 'open_application') {
          const appName = String(fc.args.appName || '').trim();
          if (
            appName.toLowerCase() === 'gmail' &&
            (lower.includes('compose') || lower.includes('send') || lower.includes('draft') || lower.includes('write') || lower.includes('mail to'))
          ) {
            multitaskAgent.spawnTask(text, 'gmail', { kind: 'EMAIL_COMPOSE' });
            showReplyWithSpeech('Composing email draft in your connected Gmail.', 'Drafting email...');
            return;
          }
          const domainMap: Record<string, string> = {
            gmail: 'mail.google.com',
            youtube: 'youtube.com',
            spotify: 'open.spotify.com',
            discord: 'discord.com',
            github: 'github.com',
          };
          const matchedDomain = domainMap[appName.toLowerCase()];
          const isFile = /\.(docx?|pdf|txt|xlsx?|pptx?|csv|png|jpe?g|webp|md|json|html)$/i.test(appName);
          setContextCard({
            header: isFile ? 'Opened Document' : matchedDomain ? `Opened · ${matchedDomain}` : 'Launched Application',
            title: appName,
            subtitle: isFile ? 'Opened on Windows' : matchedDomain ? `https://${matchedDomain}` : 'Running on Windows',
            domain: matchedDomain,
            badgeType: 'app',
          });
          window.kiboAPI?.openApp(appName);
        } else if (fc.name === 'search_web') {
          const query = String(fc.args.query || text).trim();
          const platform = String(fc.args.platform || 'google').toLowerCase();
          const platformConfig: Record<string, { url: string; domain: string }> = {
            youtube: {
              url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
              domain: 'youtube.com',
            },
            amazon: {
              url: `https://www.amazon.com/s?k=${encodeURIComponent(query)}`,
              domain: 'amazon.com',
            },
            github: {
              url: `https://github.com/search?q=${encodeURIComponent(query)}`,
              domain: 'github.com',
            },
            reddit: {
              url: `https://www.reddit.com/search/?q=${encodeURIComponent(query)}`,
              domain: 'reddit.com',
            },
            wikipedia: {
              url: `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(query)}`,
              domain: 'wikipedia.org',
            },
            spotify: {
              url: `https://open.spotify.com/search/${encodeURIComponent(query)}`,
              domain: 'open.spotify.com',
            },
            google: {
              url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
              domain: 'google.com',
            },
          };
          const target = platformConfig[platform] || platformConfig.google;
          setContextCard({
            header: `Opened · ${target.domain}`,
            title: query,
            subtitle: target.url.replace(/^https?:\/\/(www\.)?/, ''),
            domain: target.domain,
          });
          window.kiboAPI?.openUrl(target.url);
        } else if (fc.name === 'system_action') {
          const act = String(fc.args.action || '').toLowerCase();
          const val = String(fc.args.value || '').toLowerCase();
          if (act === 'dark_mode' || act === 'light_mode') {
            const wantDark = act === 'dark_mode' ? val !== 'off' : val === 'off';
            setSystemDarkMode(wantDark);
            window.kiboAPI?.toggleSystemDarkMode(wantDark).catch(() => {});
          } else if (act === 'night_light') {
            const wantOn = val !== 'off';
            setNightLight(wantOn);
            window.kiboAPI?.toggleNightLight?.(wantOn, nightLightStrength).catch(() => {});
          } else if (act === 'volume') {
            const num = parseInt(val, 10);
            if (!isNaN(num)) applyUserVolumeChange(num);
          } else if (act === 'mute') {
            const wantMute = val !== 'off';
            setIsMuted(wantMute);
            window.kiboAPI?.setMute?.(wantMute).catch(() => {});
          } else if (act === 'lock' || act === 'sleep') {
            window.kiboAPI?.powerAction(act as 'lock' | 'sleep').catch(() => {});
          }
        } else if (fc.name === 'schedule_routine') {
          const title = String(fc.args.title || text);
          const timeLabel = String(fc.args.timeLabel || 'Scheduled · Autopilot');
          setRoutines((prev) => [
            {
              id: Date.now(),
              title,
              timeLabel,
              command: text,
            },
            ...prev,
          ]);
          setShowCompanionWindow(true);
          setCompanionDockTab('settings');
          setSettingsSection('Your data');
          setContextCard({
            header: 'Scheduled · Added to Routines',
            title,
            subtitle: timeLabel,
            domain: 'Kibo Today',
          });
        } else if (fc.name === 'add_todo') {
          setTodos((prev) => [
            ...prev,
            { id: Date.now(), text: String(fc.args.task || text), completed: false },
          ]);
        }
      }

      setAskNotchPhase('idle');
      setAskWords([]);

      if (speech && speech.trim()) {
        showReplyWithSpeech(speech);
      } else {
        showReplyWithSpeech('Done.');
      }
    },
    [apiKey, nightLightStrength, applyUserVolumeChange, routines, speakAsKibo]
  );

  const startLiveVoiceAsk = useCallback(() => {
    setIsExpanded(false);
    setShowMediaNotch(false);
    setIsTucked(false);
    setContextCard(null);
    setKiboReply(null);

    if (!apiKey) {
      setNotchApiAlert({
        type: 'missing_key',
        text: 'Connect Gemini API key · Click to setup',
      });
    }

    if (askNotchPhase !== 'idle') {
      setAskNotchPhase('idle');
      setAskWords([]);
      return;
    }

    setAskNotchPhase('waking');
    setTimeout(() => {
      setAskNotchPhase('speaking');
      setAskWords([]);
    }, 220);
  }, [apiKey, askNotchPhase]);

  const triggerCleanDictationFlow = useCallback(() => {
    setIsExpanded(false);
    setShowMediaNotch(false);
    if (!apiKey) {
      setIsTucked(false);
      setNotchApiAlert({
        type: 'missing_key',
        text: 'Connect Gemini API key for Clean Dictation',
      });
      return;
    }
    setIsTucked(true);
    setDictationState('recording');
    setDictationText('');
  }, [apiKey]);

  const cropScreenToLasso = async (
    base64OrDataUrl: string | undefined,
    points: Array<{ x: number; y: number }>
  ): Promise<string> => {
    if (!base64OrDataUrl) return '';
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          if (!points || points.length < 3) {
            return resolve(
              base64OrDataUrl.startsWith('data:')
                ? base64OrDataUrl
                : `data:image/png;base64,${base64OrDataUrl}`
            );
          }

          let minX = Infinity;
          let minY = Infinity;
          let maxX = -Infinity;
          let maxY = -Infinity;

          for (const p of points) {
            if (p.x < minX) minX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.x > maxX) maxX = p.x;
            if (p.y > maxY) maxY = p.y;
          }

          const screenW = window.innerWidth || 1920;
          const screenH = window.innerHeight || 1080;
          const scaleX = img.naturalWidth / screenW;
          const scaleY = img.naturalHeight / screenH;

          const pad = 24;
          const cropX = Math.max(0, Math.floor((minX - pad) * scaleX));
          const cropY = Math.max(0, Math.floor((minY - pad) * scaleY));
          const cropW = Math.min(img.naturalWidth - cropX, Math.ceil((maxX - minX + pad * 2) * scaleX));
          const cropH = Math.min(img.naturalHeight - cropY, Math.ceil((maxY - minY + pad * 2) * scaleY));

          if (cropW <= 10 || cropH <= 10) {
            return resolve(
              base64OrDataUrl.startsWith('data:')
                ? base64OrDataUrl
                : `data:image/png;base64,${base64OrDataUrl}`
            );
          }

          const canvas = document.createElement('canvas');
          canvas.width = cropW;
          canvas.height = cropH;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(base64OrDataUrl);

          ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
          resolve(canvas.toDataURL('image/png'));
        } catch (_) {
          resolve(base64OrDataUrl);
        }
      };
      img.onerror = () => resolve(base64OrDataUrl);
      img.src = base64OrDataUrl.startsWith('data:')
        ? base64OrDataUrl
        : `data:image/png;base64,${base64OrDataUrl}`;
    });
  };

  const triggerLassoFlow = useCallback(async () => {
    setIsExpanded(false);
    setShowMediaNotch(false);
    setIsTucked(true);
    setLassoActive(true);
    window.kiboAPI?.setLassoActive?.(true);
    // Clear all previous speech state so old questions never appear!
    setLassoQuery('');
    lassoQueryRef.current = '';
    liveSpeechRef.current = '';
    setAskWords([]);
    setUserBubbleText(null);
    setKiboReply(null);
    setLassoPoints([]);
    lassoPointsRef.current = [];
    capturedScreenRef.current = null;
    window.kiboAPI?.captureScreen().then((res) => {
      if (res?.success && res.image) {
        capturedScreenRef.current = res.image;
      }
    });
  }, []);

  useEffect(() => {
    if (tabContentRef.current && isExpanded) {
      setActiveControlDropdown(null);
      gsap.killTweensOf(tabContentRef.current);
      gsap.fromTo(
        tabContentRef.current,
        { opacity: 0, y: -5 },
        { opacity: 1, y: 0, duration: 0.16, ease: 'cubic-bezier(0.33, 1, 0.68, 1)', clearProps: 'transform' }
      );
    }
  }, [activeTab, isExpanded]);

  const activeNavMetrics = useMemo(() => {
    if (activeTab === 'Settings') {
      return { left: 0, width: 0, opacity: 0 };
    }
    let offsetLeft = 0;
    const gap = 4;
    for (const item of NAV_TABS) {
      if (item.id === activeTab) {
        return { left: offsetLeft, width: item.width, opacity: 1 };
      }
      offsetLeft += item.width + gap;
    }
    return { left: 0, width: 68, opacity: 1 };
  }, [activeTab]);

  useEffect(() => {
    if (isElectron) {
      document.documentElement.style.backgroundColor = 'transparent';
      document.body.style.backgroundColor = 'transparent';
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      document.body.style.margin = '0';
      document.body.style.padding = '0';
      document.body.classList.add('desktop-mode');
    }
  }, [isElectron]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isTimerRunning || timerSeconds <= 0) return;
    const interval = setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev <= 1) {
          setIsTimerRunning(false);
          setIsTucked(false);
          setTimerAlarmRinging(true);
          triggerKiboCelebrationDance(8500);
          addEmbers(5);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning, timerSeconds, addEmbers, triggerKiboCelebrationDance]);

  // Only advance media timer while song is actively playing (pauses when song is paused!)
  useEffect(() => {
    if (!isPlayingMedia) return;
    const interval = setInterval(() => {
      setMediaProgress((prev) => (prev >= totalMediaDuration ? 0 : prev + 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlayingMedia, totalMediaDuration]);

  useEffect(() => {
    if (window.kiboAPI?.getSystemStats) {
      window.kiboAPI.getSystemStats().then((data) => {
        if (data) setSystemStats(data);
      });
      const interval = setInterval(async () => {
        try {
          const data = await window.kiboAPI?.getSystemStats();
          if (data) setSystemStats(data);
        } catch (_) {}
      }, 2500);
      return () => clearInterval(interval);
    }
  }, [isElectron]);

  const updateVolumeFromClientX = useCallback(
    (clientX: number) => {
      if (!volumeTrackRef.current) return;
      const rect = volumeTrackRef.current.getBoundingClientRect();
      const pct = Math.round(((clientX - rect.left) / rect.width) * 100);
      applyUserVolumeChange(pct);
    },
    [applyUserVolumeChange]
  );

  useEffect(() => {
    if (!isDraggingVolume) return;
    const onMove = (e: PointerEvent) => updateVolumeFromClientX(e.clientX);
    const onUp = (e: PointerEvent) => {
      isDraggingVolumeRef.current = false;
      setIsDraggingVolume(false);

      if (notchShellRef.current) {
        const rect = notchShellRef.current.getBoundingClientRect();
        const isStillInside =
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom;
        if (!isStillInside) {
          handleIslandMouseLeave();
        }
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [isDraggingVolume, updateVolumeFromClientX, handleIslandMouseLeave]);

  const confirmAndExecutePowerAction = async () => {
    if (!pendingPowerAction) return;
    const action = pendingPowerAction;
    setPendingPowerAction(null);
    setPowerFeedback(`Executing ${action}...`);
    if (window.kiboAPI?.powerAction) {
      await window.kiboAPI.powerAction(action);
    }
    setTimeout(() => setPowerFeedback(null), 2500);
  };

  const handleRunSpeedTest = async () => {
    if (isSpeedTesting) return;
    setIsSpeedTesting(true);
    if (window.kiboAPI?.runSpeedTest) {
      const res = await window.kiboAPI.runSpeedTest();
      if (res?.success) {
        setSpeedDownload(res.downloadMbps);
        setSpeedUpload(res.uploadMbps);
        setSpeedLastTested('Just now');
      }
      setIsSpeedTesting(false);
    } else {
      setTimeout(() => {
        setSpeedDownload(85);
        setSpeedUpload(42);
        setSpeedLastTested('Just now');
        setIsSpeedTesting(false);
      }, 1200);
    }
  };

  const handleLaunchApp = async (nameOrId: string) => {
    if (window.kiboAPI?.openApp) {
      await window.kiboAPI.openApp(nameOrId);
    }
  };

  const handleAddTodo = () => {
    const text = newTodoInput.trim();
    if (!text) return;

    if (/\bat\s+\d+/i.test(text) || /^every\s+/i.test(text)) {
      setRoutines((prev) => [
        {
          id: Date.now(),
          title: text,
          timeLabel: 'Scheduled · Autopilot',
          command: text,
        },
        ...prev,
      ]);
    }

    const newId = Date.now();
    setTodos((prev) => [...prev, { id: newId, text, completed: false }]);
    setNewTodoInput('');
  };

  const handleToggleTodo = (id: number) => {
    const target = todos.find((t) => t.id === id);
    if (!target) return;
    const willComplete = !target.completed;

    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: willComplete } : t))
    );

    if (willComplete && !rewardedTaskIds.includes(id) && rewardedTaskIds.length < 5) {
      const nextRewarded = [...rewardedTaskIds, id];
      setRewardedTaskIds(nextRewarded);
      localStorage.setItem('kibo_rewarded_tasks', JSON.stringify(nextRewarded));

      const rewardAmount = nextRewarded.length === 5 ? 9 : 4;
      addEmbers(rewardAmount);
      triggerSparklePop(id);
    }
  };

  const handleDeleteTodo = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    soundFX.playToggle(false);
    setTodos((prev) => prev.filter((t) => t.id !== id));
  };

  const triggerClipboardToast = (msg: string) => {
    setClipboardToast(msg);
    setTimeout(() => setClipboardToast(null), 1600);
  };

  const handleTogglePinClip = useCallback((id: number) => {
    setClipboardItems((prev) => {
      const target = prev.find((item) => item.id === id);
      const willPin = target ? !target.isPinned : false;
      triggerClipboardToast(willPin ? 'Pinned' : 'Unpinned');
      const updated = prev.map((item) =>
        item.id === id
          ? { ...item, isPinned: willPin, isToday: willPin ? false : true }
          : item
      );
      try {
        localStorage.setItem('kibo_clip_history', JSON.stringify(updated.slice(0, 50)));
      } catch (_) {}
      return updated;
    });
    window.kiboAPI?.togglePinClipboardItem?.(id);
  }, []);

  const handleDeleteClip = useCallback((id: number) => {
    setClipboardItems((prev) => {
      const remaining = prev.filter((item) => item.id !== id);
      setSelectedClipboardId((curr) => (curr === id ? (remaining.length > 0 ? remaining[0].id : null) : curr));
      try {
        localStorage.setItem('kibo_clip_history', JSON.stringify(remaining.slice(0, 50)));
      } catch (_) {}
      return remaining;
    });
    window.kiboAPI?.deleteClipboardItem?.(id);
    triggerClipboardToast('Removed');
  }, []);

  const handleCopyClip = useCallback((clip: ClipboardItem) => {
    if (!clip) return;
    if (clip.preview) {
      navigator.clipboard?.writeText(clip.preview).catch(() => {});
      window.kiboAPI?.writeClipboardText?.(clip.preview);
    }
    if (clip.imageDataUrl) {
      window.kiboAPI?.writeClipboardImage?.(clip.imageDataUrl);
    }
    triggerClipboardToast('Copied!');
  }, []);

  const applyWallpaperByIndex = useCallback(
    async (index: number) => {
      const targetWp = wallpapersList[index];
      if (!targetWp) return;

      // Start shockwave transition immediately with pre-cached thumbnail
      const immediateSrc = targetWp.thumb || targetWp.url;
      setRipplingWallpaperUrl(immediateSrc);
      setPrevAppliedWallpaperIndex(appliedWallpaperIndex);
      setAppliedWallpaperIndex(index);
      setFocusedWallpaperIndex(index);
      setAdaptiveWallpaperTheme(targetWp);
      setIsWallpaperRippling(true);
      localStorage.setItem('kibo_wallpaper_idx', String(index));
      extractAndApplyPaletteForIndex(index, wallpapersList);
      soundFX.playToggle(true);

      const sourcePathOrUrl = targetWp.filePath || targetWp.url;
      if (window.kiboAPI?.setWallpaper) {
        try {
          window.kiboAPI.setWallpaper(sourcePathOrUrl);
        } catch (_) {}
      }
      if (targetWp.accent) {
        window.kiboAPI?.updateTrayColor?.(targetWp.accent);
      }

      // Automatically complete shockwave fade after animation finishes
      setTimeout(() => {
        setIsWallpaperRippling(false);
        setRipplingWallpaperUrl('');
      }, 980);
    },
    [wallpapersList, appliedWallpaperIndex, extractAndApplyPaletteForIndex]
  );

  const handleWallpaperStripClick = useCallback(
    (index: number) => {
      if (index !== focusedWallpaperIndex) {
        setFocusedWallpaperIndex(index);
      } else {
        applyWallpaperByIndex(index);
      }
    },
    [focusedWallpaperIndex, applyWallpaperByIndex]
  );

  const wallpaperTrackRef = useRef<HTMLDivElement>(null);

  const handleWallpaperWheel = useCallback(
    (e: React.WheelEvent) => {
      e.stopPropagation();
      const nowMs = performance.now();
      if (nowMs - wheelLockRef.current < 140) return;
      wheelLockRef.current = nowMs;

      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (delta === 0) return;

      const dir = delta > 0 ? 1 : -1;
      setFocusedWallpaperIndex((i) => (i + dir + wallpapersList.length) % wallpapersList.length);
      soundFX.playSliderTick(50);

      if (wallpaperTrackRef.current) {
        gsap.killTweensOf(wallpaperTrackRef.current);
        gsap.fromTo(
          wallpaperTrackRef.current,
          { x: dir * 56, opacity: 0.88 },
          {
            x: 0,
            opacity: 1,
            duration: 0.36,
            ease: 'cubic-bezier(0.22, 1, 0.36, 1)',
            clearProps: 'transform,opacity',
          }
        );
      }
    },
    [wallpapersList.length]
  );

  const handlePickLocalWallpapers = useCallback(async () => {
    setWallpaperSourceTab('My folder');
    if (!window.kiboAPI?.pickWallpaperFiles) return;
    const res = await window.kiboAPI.pickWallpaperFiles();
    if (res?.success && res.files && res.files.length > 0) {
      const newThemes: WallpaperTheme[] = await Promise.all(
        res.files.map(async (f, i) => {
          const img = new Image();
          await new Promise<void>((r) => {
            img.onload = () => r();
            img.onerror = () => r();
            img.src = f.url;
          });
          const pal = extractPaletteFromImageElement(img) || {
            accent: '#F68C58',
            accentSecondary: '#EE9B27',
            pillBg: 'rgba(246, 140, 88, 0.22)',
            rowBg: 'rgba(246, 140, 88, 0.16)',
            darkText: '#1E110A',
            darkSubText: 'rgba(30, 17, 10, 0.72)',
          };
          return {
            id: Date.now() + i,
            title: f.title,
            url: f.url,
            filePath: f.filePath,
            thumb: f.url,
            ...pal,
          };
        })
      );
      setWallpapersList((prev) => [...newThemes, ...prev]);
      setFocusedWallpaperIndex(0);
    }
  }, []);

  const trackWallpapers = useMemo(() => {
    const total = wallpapersList.length;
    if (total === 0) return [];
    const offsets = [-2, -1, 0, 1, 2];
    return offsets.map((offset) => {
      const originalIndex = (focusedWallpaperIndex + offset + total * 10) % total;
      return {
        slotKey: offset,
        wp: wallpapersList[originalIndex],
        originalIndex,
        isCenter: offset === 0,
        isApplied: originalIndex === appliedWallpaperIndex,
      };
    });
  }, [wallpapersList, focusedWallpaperIndex, appliedWallpaperIndex]);

  const trackTranslateX = 0;

  const currentSlotCards = useMemo(
    () => (activeDeckSlot ? LOADOUT_CARDS.filter((c) => c.slot === activeDeckSlot) : []),
    [activeDeckSlot]
  );

  const handleEquipOrUnlockCard = (card: LoadoutCardItem) => {
    const isVoidUnlocked = unlockedCardIds.includes('soul_void');
    const isUnlocked =
      unlockedCardIds.includes(card.id) ||
      card.cost === 0 ||
      (card.id === 'abil_collapse' && isVoidUnlocked);

    if (card.notForSale && !isVoidUnlocked) {
      return;
    }

    if (isUnlocked && !card.notForSale) {
      const nextEquipped = { ...equippedCards, [card.slot]: card.id };
      setEquippedCards(nextEquipped);
      localStorage.setItem('kibo_equipped_cards', JSON.stringify(nextEquipped));
      if (card.slot === 'Soul' && card.skinKey) {
        setSelectedSkinKey(card.skinKey);
        localStorage.setItem('kibo_chassis', card.skinKey);
      }
      if (card.slot === 'Voice') {
        const voiceName = (card.name || 'Charon') as KiboVoiceName;
        voiceEngine.speak(`Voice switched to ${voiceName}. Kibo voice module online. Systems calibrated.`, {
          voice: voiceName,
        });
      }
    } else if (isUnlocked && card.id === 'abil_collapse') {
      const nextEquipped = { ...equippedCards, Abilities: card.id };
      setEquippedCards(nextEquipped);
      localStorage.setItem('kibo_equipped_cards', JSON.stringify(nextEquipped));
    } else if (embers >= card.cost && !card.notForSale) {
      const nextEmbers = embers - card.cost;
      setEmbers(nextEmbers);
      localStorage.setItem('kibo_watts', String(nextEmbers));

      const extraUnlocks = card.id === 'soul_void' ? ['soul_void', 'abil_collapse'] : [card.id];
      const nextUnlocked = Array.from(new Set([...unlockedCardIds, ...extraUnlocks]));
      setUnlockedCardIds(nextUnlocked);
      localStorage.setItem('kibo_unlocked_cards', JSON.stringify(nextUnlocked));

      const nextEquipped = { ...equippedCards, [card.slot]: card.id };
      setEquippedCards(nextEquipped);
      localStorage.setItem('kibo_equipped_cards', JSON.stringify(nextEquipped));
      if (card.slot === 'Soul' && card.skinKey) {
        setSelectedSkinKey(card.skinKey);
        localStorage.setItem('kibo_chassis', card.skinKey);
      }
      if (card.slot === 'Voice') {
        const voiceName = (card.name || 'Charon') as KiboVoiceName;
        voiceEngine.speak(`Voice unlocked: ${voiceName}. Kibo voice module online. Systems calibrated.`, {
          voice: voiceName,
        });
      }
    }
  };

  const handleSaveGeminiKey = () => {
    const trimmed = geminiDraftKey.trim();
    setApiKey(trimmed);
    const api = (window as any).kiboAPI;
    if (trimmed) {
      localStorage.setItem('kibo_gemini_key', trimmed);
      api?.saveStoredSettings?.({ kibo_gemini_key: trimmed });
      setNotchApiAlert(null);
      setSoulMode('LISTENING');
    } else {
      localStorage.removeItem('kibo_gemini_key');
      api?.saveStoredSettings?.({ kibo_gemini_key: '' });
    }
    setShowConnectModal(false);
  };

  const handleForgetGeminiKey = () => {
    setApiKey('');
    setGeminiDraftKey('');
    localStorage.removeItem('kibo_gemini_key');
    const api = (window as any).kiboAPI;
    api?.saveStoredSettings?.({ kibo_gemini_key: '' });
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const filteredClipboardItems = useMemo(() => {
    return clipboardItems.filter((item) => {
      const matchesCat = clipboardCategory === 'All' || item.category === clipboardCategory;
      const matchesQuery =
        !clipboardSearch.trim() ||
        item.preview.toLowerCase().includes(clipboardSearch.toLowerCase()) ||
        item.type.toLowerCase().includes(clipboardSearch.toLowerCase());
      return matchesCat && matchesQuery;
    });
  }, [clipboardItems, clipboardCategory, clipboardSearch]);

  const selectedClip = useMemo(
    () =>
      filteredClipboardItems.find((c) => c.id === selectedClipboardId) ||
      filteredClipboardItems[0] ||
      null,
    [filteredClipboardItems, selectedClipboardId]
  );

  const processedApps = useMemo(() => {
    const q = appSearchQuery.trim().toLowerCase();
    return appsList
      .map((a) => ({
        ...a,
        starred: starredAppNames.includes(a.name.toLowerCase()),
      }))
      .filter((a) => {
        if (q && !a.name.toLowerCase().includes(q) && !a.tag.toLowerCase().includes(q)) {
          return false;
        }
        if (appFilterTab === 'Starred') return a.starred;
        if (appFilterTab === 'Games') return a.tag === 'Game';
        if (appFilterTab === 'Apps') return a.tag !== 'Game';
        return true;
      });
  }, [appsList, starredAppNames, appSearchQuery, appFilterTab]);

  const alphabeticalAppGroups = useMemo(() => {
    const map = new Map<string, InstalledAppItem[]>();
    for (const app of processedApps) {
      const firstChar = app.name.trim().charAt(0).toUpperCase();
      const letter = /[A-Z]/.test(firstChar) ? firstChar : '#';
      if (!map.has(letter)) map.set(letter, []);
      map.get(letter)!.push(app);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [processedApps]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showConnectModal) setShowConnectModal(false);
        else if (activeControlDropdown) setActiveControlDropdown(null);
        else if (activeDeckSlot) setActiveDeckSlot(null);
        else if (showCompanionWindow) {
          setShowCompanionWindow(false);
          setIsTucked(true);
        } else if (notchApiAlert) {
          setNotchApiAlert(null);
        } else if (askNotchPhase !== 'idle') {
          setAskNotchPhase('idle');
          setAskWords([]);
        } else if (lassoActive) setLassoActive(false);
        else if (dictationState !== 'idle') setDictationState('idle');
        else if (isExpanded) {
          setIsExpanded(false);
          setIsTucked(true);
        } else if (showMediaNotch) {
          setShowMediaNotch(false);
          setIsTucked(true);
        } else if (contextCard) setContextCard(null);
      } else if (activeDeckSlot) {
        if (e.key === 'ArrowRight') {
          setDeckCardIndex((i) => Math.min(currentSlotCards.length - 1, i + 1));
        } else if (e.key === 'ArrowLeft') {
          setDeckCardIndex((i) => Math.max(0, i - 1));
        }
      } else if (e.altKey && (e.key === 'w' || e.key === 'W' || e.code === 'Space')) {
        e.preventDefault();
        startLiveVoiceAsk();
      } else if (isExpanded && activeTab === 'Clipboard') {
        const isInput = document.activeElement?.tagName === 'INPUT';
        if (isInput) {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            (document.activeElement as HTMLElement)?.blur();
            if (filteredClipboardItems.length > 0) {
              setSelectedClipboardId(filteredClipboardItems[0].id);
            }
          } else if (e.key === 'Enter' && selectedClip) {
            e.preventDefault();
            if (selectedClip.preview) {
              navigator.clipboard?.writeText(selectedClip.preview).catch(() => {});
              window.kiboAPI?.typeText?.(selectedClip.preview);
            }
            triggerClipboardToast('Pasted!');
          }
          return;
        }

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          const idx = filteredClipboardItems.findIndex((i) => i.id === selectedClip?.id);
          if (idx >= 0 && idx < filteredClipboardItems.length - 1) {
            setSelectedClipboardId(filteredClipboardItems[idx + 1].id);
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          const idx = filteredClipboardItems.findIndex((i) => i.id === selectedClip?.id);
          if (idx > 0) {
            setSelectedClipboardId(filteredClipboardItems[idx - 1].id);
          }
        } else if (e.key === 'Enter' && selectedClip) {
          e.preventDefault();
          if (selectedClip.preview) {
            navigator.clipboard?.writeText(selectedClip.preview).catch(() => {});
            window.kiboAPI?.typeText?.(selectedClip.preview);
          }
          triggerClipboardToast('Pasted!');
        } else if ((e.key === 'c' || e.key === 'C') && (e.ctrlKey || e.metaKey) && selectedClip) {
          e.preventDefault();
          handleCopyClip(selectedClip);
        } else if ((e.key === 'p' || e.key === 'P') && selectedClip) {
          e.preventDefault();
          handleTogglePinClip(selectedClip.id);
        } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedClip) {
          e.preventDefault();
          handleDeleteClip(selectedClip.id);
        }
      } else if (isExpanded && activeTab === 'Wallpaper') {
        if (e.key === 'ArrowRight') {
          setFocusedWallpaperIndex((i) => (i + 1) % wallpapersList.length);
        } else if (e.key === 'ArrowLeft') {
          setFocusedWallpaperIndex((i) => (i - 1 + wallpapersList.length) % wallpapersList.length);
        } else if (e.key === 'Enter') {
          applyWallpaperByIndex(focusedWallpaperIndex);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    showConnectModal,
    activeControlDropdown,
    activeDeckSlot,
    currentSlotCards.length,
    showCompanionWindow,
    notchApiAlert,
    askNotchPhase,
    lassoActive,
    dictationState,
    isExpanded,
    showMediaNotch,
    contextCard,
    activeTab,
    filteredClipboardItems,
    selectedClip,
    wallpapersList.length,
    focusedWallpaperIndex,
    applyWallpaperByIndex,
    startLiveVoiceAsk,
    handleCopyClip,
    handleTogglePinClip,
    handleDeleteClip,
  ]);

  // Hold-to-Speak Microphone Recorder with 100ms Timeslicing (`recorder.start(100)`)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const activeHoldModeRef = useRef<'ASK' | 'DICTATE' | 'LASSO' | null>(null);

  const startHoldRecording = useCallback(
    async (mode: 'ASK' | 'DICTATE' | 'LASSO') => {
      if (activeHoldModeRef.current) return;
      activeHoldModeRef.current = mode;

      if (!apiKey) {
        setIsTucked(false);
        setNotchApiAlert({
          type: 'missing_key',
          text: 'Connect Gemini API key · Click to setup',
        });
        return;
      }

      if (mode === 'ASK') {
        setIsExpanded(false);
        setShowMediaNotch(false);
        setIsTucked(false);
        setContextCard(null);
        setKiboReply(null);
        setAskNotchPhase('speaking');
        setAskWords([]);
      } else if (mode === 'DICTATE') {
        setIsExpanded(false);
        setShowMediaNotch(false);
        setIsTucked(true);
        setDictationState('recording');
        setDictationText('');
      } else if (mode === 'LASSO') {
        setIsExpanded(false);
        setShowMediaNotch(false);
        setIsTucked(true);
        setLassoActive(true);
        window.kiboAPI?.setLassoActive?.(true);
        // Clear all previous speech state so old questions never appear!
        setLassoQuery('');
        lassoQueryRef.current = '';
        liveSpeechRef.current = '';
        setAskWords([]);
        setUserBubbleText(null);
        setKiboReply(null);
        setLassoPoints([]);
        lassoPointsRef.current = [];
        capturedScreenRef.current = null;
        window.kiboAPI?.captureScreen().then((res) => {
          if (res?.success && res.image) {
            capturedScreenRef.current = res.image;
          }
        });
      }

      soundFX.playWakeListening();
      liveSpeechRef.current = '';

      // Live Speech Recognition: Catch spoken words continuously in real time as user talks!
      const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRec) {
        try {
          const rec = new SpeechRec();
          rec.continuous = true;
          rec.interimResults = true;
          rec.lang = 'en-US';

          rec.onresult = (event: any) => {
            let combined = '';
            for (let i = 0; i < event.results.length; ++i) {
              combined += event.results[i][0].transcript;
            }
            const trimmed = combined.trim();
            if (!trimmed) return;
            liveSpeechRef.current = trimmed;
            if (mode === 'ASK') {
              setAskWords(trimmed.split(/\s+/).filter(Boolean));
            } else if (mode === 'DICTATE') {
              setDictationText(trimmed);
            } else if (mode === 'LASSO') {
              setLassoQuery(trimmed);
              lassoQueryRef.current = trimmed;
            }
          };

          rec.onerror = () => {};
          rec.onend = () => {};
          rec.start();
          speechRecognitionRef.current = rec;
        } catch (_) {}
      }

      try {
        const micConstraints: MediaStreamConstraints = {
          audio: selectedMicDeviceId && selectedMicDeviceId !== 'default'
            ? { deviceId: { exact: selectedMicDeviceId } }
            : true,
        };
        const stream = await navigator.mediaDevices.getUserMedia(micConstraints);
        audioChunksRef.current = [];
        const recorder = new MediaRecorder(stream);

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        recorder.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          const blob = new Blob(audioChunksRef.current, {
            type: recorder.mimeType || 'audio/webm',
          });
          if (blob.size < 100 && !liveSpeechRef.current.trim()) {
            setAskNotchPhase('idle');
            setDictationState('idle');
            setLassoActive(false);
            return;
          }

          const reader = new FileReader();
          reader.onloadend = async () => {
            const dataUrl = String(reader.result || '');
            const base64Audio = dataUrl.split(',')[1] || '';

            try {
              if (mode === 'ASK') {
                setAskNotchPhase('thinking');
                setSoulMode('THINKING');
                const browserDraft = liveSpeechRef.current.trim();
                let transcript = browserDraft;
                if (base64Audio && base64Audio.length > 400) {
                  try {
                    const geminiTranscript = await transcribeAudioWithGeminiAPI(
                      base64Audio,
                      blob.type,
                      'ASK',
                      apiKey,
                      undefined,
                      browserDraft
                    );
                    if (geminiTranscript && !geminiTranscript.includes('<noise>') && !geminiTranscript.includes('(silence)')) {
                      transcript = geminiTranscript.trim();
                    }
                  } catch (_) {}
                }
                if (transcript) {
                  // Domain vocabulary normalization so "keyboard.txt" / "keyboard file" resolves to "kibo.txt"
                  transcript = transcript
                    .replace(/\b(?:keyboard|keybo|keebo|kilo)\.(txt|text|pdf|docx|doc|md|markdown|json|csv|html)\b/gi, 'kibo.$1')
                    .replace(/\b(?:keyboard|keybo|keebo)\s+dot\s+(txt|text|pdf|docx|doc|md|markdown)\b/gi, 'kibo.$1');
                }
                if (transcript && !transcript.includes('<noise>') && !transcript.includes('(silence)')) {
                  setUserBubbleText(transcript);
                  const lower = transcript.toLowerCase();
                  let screenImage: string | undefined = undefined;
                  if (
                    lower.includes('screen') ||
                    lower.includes('look at') ||
                    lower.includes('this error') ||
                    lower.includes('what is this') ||
                    lower.includes('code') ||
                    lower.includes('read')
                  ) {
                    let shotImage = capturedScreenRef.current;
                    if (!shotImage) {
                      const shot = await window.kiboAPI?.captureScreen();
                      shotImage = shot?.image;
                    }
                    screenImage = shotImage;
                  }
                  await executeVoiceCommand(transcript, screenImage);
                } else {
                  setAskNotchPhase('idle');
                  setSoulMode('LISTENING');
                  setKiboReply({ bold: "I didn't catch that. Hold and speak clearly." });
                  setTimeout(() => setKiboReply(null), 3500);
                }
              } else if (mode === 'DICTATE') {
                let cleaned = liveSpeechRef.current.trim();
                if (!cleaned && base64Audio) {
                  cleaned = await transcribeAudioWithGeminiAPI(
                    base64Audio,
                    blob.type,
                    'DICTATE',
                    apiKey
                  );
                } else if (cleaned) {
                  try {
                    const refined = await cleanDictation(cleaned, apiKey);
                    if (refined && refined.trim()) cleaned = refined.trim();
                  } catch (_) {}
                }
                if (cleaned && !cleaned.includes('<noise>') && !cleaned.includes('(silence)')) {
                  setDictationText(cleaned);
                  setDictationState('done');
                  await window.kiboAPI?.typeText(cleaned);
                  addEmbers(2);
                  setTimeout(() => setDictationState('idle'), 1400);
                } else {
                  setDictationState('idle');
                  setKiboReply({ bold: "No speech detected to dictate." });
                  setTimeout(() => setKiboReply(null), 3000);
                }
              } else if (mode === 'LASSO') {
                const points = [...lassoPointsRef.current];
                setLassoActive(false);
                window.kiboAPI?.setLassoActive?.(false);
                setAskNotchPhase('thinking');
                setSoulMode('THINKING');

                // 1. Get spoken words from live speech OR transcribe the recorded audio with Gemini
                let q = liveSpeechRef.current.trim() || lassoQueryRef.current.trim();
                if (!q && base64Audio) {
                  try {
                    q = await transcribeAudioWithGeminiAPI(
                      base64Audio,
                      blob.type,
                      'ASK',
                      apiKey
                    );
                  } catch (_) {}
                }

                // 2. Immediately display the actual spoken words in the HUD (replacing any old question)
                const cleanQ =
                  q && !q.includes('<noise>') && !q.includes('(silence)')
                    ? q.trim()
                    : '';
                if (cleanQ) {
                  setLassoQuery(cleanQ);
                  setUserBubbleText(cleanQ);
                  setAskWords(cleanQ.split(/\s+/));
                  appendChatMessage({ role: 'user', text: `[Screen Vision] ${cleanQ}` });
                } else {
                  setUserBubbleText('Analyzing circled area...');
                  setAskWords(['Analyzing', 'circled', 'area...']);
                  appendChatMessage({ role: 'user', text: '[Screen Vision] Analyzing circled area...' });
                }

                let shotImage = capturedScreenRef.current;
                if (!shotImage) {
                  const shot = await window.kiboAPI?.captureScreen();
                  shotImage = shot?.image || '';
                }
                const cropped = await cropScreenToLasso(shotImage, points);
                const answer = await askLassoWithGemini(
                  cleanQ,
                  cropped || shotImage || '',
                  apiKey,
                  !cleanQ && base64Audio ? base64Audio : undefined,
                  !cleanQ && blob.type ? blob.type : undefined
                );
                capturedScreenRef.current = null;
                setAskNotchPhase('idle');
                setAskWords([]);
                setSoulMode('TALKING');
                if (answer) {
                  addEmbers(2);
                  showReplyWithSpeech(answer);
                }
              }
            } catch (err: any) {
              console.error('Voice transcription error:', err);
              setAskNotchPhase('idle');
              setDictationState('idle');
              setLassoActive(false);
              window.kiboAPI?.setLassoActive?.(false);
              const errMsg = String(err?.message || '');
              const userMsg = errMsg.includes('429')
                ? 'Rate limit reached · Please wait a moment'
                : 'Could not process audio · Check connection';
              setKiboReply({ bold: userMsg });
              setTimeout(() => setKiboReply(null), 4000);
              setNotchApiAlert({
                type: 'rate_limit',
                text: errMsg.includes('429')
                  ? 'Gemini API rate limit reached · Click to check key'
                  : 'Voice transcription error · Click to check Gemini key',
              });
            }
          };
          reader.readAsDataURL(blob);
        };

        mediaRecorderRef.current = recorder;
        // 100ms timeslice so audio chunks buffer continuously even on quick holds!
        recorder.start(100);
      } catch (_) {}
    },
    [apiKey, executeVoiceCommand]
  );

  const stopHoldRecording = useCallback(() => {
    activeHoldModeRef.current = null;
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch (_) {}
      speechRecognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (_) {}
    }
    mediaRecorderRef.current = null;
  }, []);

  useEffect(() => {
    const api = window.kiboAPI as any;
    if (!api) return;

    const unregHotkey = api.onHotkeyEvent
      ? api.onHotkeyEvent((action: string) => {
          setLastHotkeyAction(action);
          if (action === 'ASK_DOWN') startHoldRecording('ASK');
          else if (action === 'ASK_UP') stopHoldRecording();
          else if (action === 'DICTATE_DOWN') startHoldRecording('DICTATE');
          else if (action === 'DICTATE_UP') stopHoldRecording();
          else if (action === 'LASSO_DOWN') startHoldRecording('LASSO');
          else if (action === 'LASSO_UP') stopHoldRecording();
        })
      : () => {};

    const unregLasso = api.onTriggerLasso
      ? api.onTriggerLasso(() => {
          triggerLassoFlow();
        })
      : () => {};

    const unregDictate = api.onTriggerDictation
      ? api.onTriggerDictation(() => {
          triggerCleanDictationFlow();
        })
      : () => {};

    const unregExpand = api.onExpandIsland
      ? api.onExpandIsland(() => {
          setIsTucked(false);
          setIsExpanded(true);
          setActiveTab('Chat');
        })
      : () => {};



    const unregAsk = api.onTriggerAsk
      ? api.onTriggerAsk(() => {
          startLiveVoiceAsk();
        })
      : () => {};

    return () => {
      unregHotkey();
      unregLasso();
      unregDictate();
      unregExpand();
      unregAsk();
    };
  }, [startHoldRecording, stopHoldRecording, triggerLassoFlow, triggerCleanDictationFlow, startLiveVoiceAsk]);

  const renderCircleGauge = (
    pct: number,
    color: string,
    title: string,
    subtitle: string,
    badges: string[]
  ) => {
    const size = 90;
    const strokeWidth = 7;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (pct / 100) * circumference;

    return (
      <div className="companion-stat-gauge-card">
        <div style={{ position: 'relative', width: `${size}px`, height: `${size}px` }}>
          <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="rgba(255, 255, 255, 0.06)"
              strokeWidth={strokeWidth}
              fill="transparent"
            />
            <circle
              className="companion-gauge-circle"
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
            />
          </svg>
          <div className="companion-gauge-value">{pct}%</div>
        </div>
        <div style={{ marginTop: '8px', fontSize: '12.5px', fontWeight: 700, color: '#ffffff' }}>{title}</div>
        <div className="companion-truncate" style={{ fontSize: '10.5px', color: '#71717A', marginTop: '1px', maxWidth: '100%' }}>
          {subtitle}
        </div>
        <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
          {badges.map((b, i) => (
            <span key={i} className="companion-stat-badge">{b}</span>
          ))}
        </div>
      </div>
    );
  };

  const timerRingSize = 76;
  const timerStroke = 4.5;
  const timerRadius = (timerRingSize - timerStroke * 2) / 2;
  const timerCircumference = 2 * Math.PI * timerRadius;
  const timerFraction = timerTotalSeconds > 0 ? timerSeconds / timerTotalSeconds : 0;
  const timerDashoffset = timerCircumference * (1 - timerFraction);

  const completedTodosCount = todos.filter((t) => t.completed).length;
  const totalTodosCount = Math.max(1, todos.length);
  const todoRingSize = 28;
  const todoRingStroke = 2.8;
  const todoRingRadius = (todoRingSize - todoRingStroke * 2) / 2;
  const todoRingCircumference = 2 * Math.PI * todoRingRadius;
  const todoRingDashoffset =
    todoRingCircumference * (1 - completedTodosCount / totalTodosCount);

  const hoursStr = String(now.getHours() % 12 || 12).padStart(2, '0');
  const minsStr = String(now.getMinutes()).padStart(2, '0');
  const ampmStr = now.getHours() >= 12 ? 'PM' : 'AM';
  const dayShortStr = now.toLocaleDateString('en-US', { weekday: 'short' });

  const lassoPathString = useMemo(() => {
    if (lassoPoints.length < 2) return '';
    return lassoPoints.map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ');
  }, [lassoPoints]);

  const accentRgb = useMemo(() => {
    try {
      const clean = (activeTheme.accent || '#38BDF8').replace('#', '');
      const hex = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
      const num = parseInt(hex, 16);
      if (isNaN(num)) return '56, 189, 248';
      return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
    } catch (_) {
      return '56, 189, 248';
    }
  }, [activeTheme.accent]);

  const adaptiveVars = {
    '--adaptive-accent': activeTheme.accent,
    '--adaptive-accent-rgb': accentRgb,
    '--adaptive-secondary': activeTheme.accentSecondary,
    '--adaptive-pill-bg': activeTheme.pillBg,
    '--adaptive-row-bg': activeTheme.rowBg,
    '--adaptive-dark-text': activeTheme.darkText,
    '--adaptive-dark-sub': activeTheme.darkSubText,
  } as React.CSSProperties;

  const orbitingNodes = useMemo(() => {
    const angleNow = orbitAngleRef.current;
    const phys = nodePhysicsRef.current;

    return ORBIT_SLOTS.map((d) => {
      const angle = d.baseAngle + angleNow;
      const p = phys[d.slot];

      const cx = STAGE_CENTER_X + Math.cos(angle) * d.radiusX + p.x;
      const cy = STAGE_CENTER_Y + Math.sin(angle) * d.radiusY + p.y;

      const toCenterDx = STAGE_CENTER_X - cx;
      const toCenterDy = STAGE_CENTER_Y - cy;

      const boxHalfW = 56;
      const boxHalfH = 21;
      const scaleX = boxHalfW / Math.max(0.001, Math.abs(toCenterDx));
      const scaleY = boxHalfH / Math.max(0.001, Math.abs(toCenterDy));
      const edgeScale = Math.min(1, Math.min(scaleX, scaleY));

      const boxEdgeX = cx + toCenterDx * edgeScale;
      const boxEdgeY = cy + toCenterDy * edgeScale;

      const fromPortalDx = p.bendX - STAGE_CENTER_X;
      const fromPortalDy = p.bendY - STAGE_CENTER_Y;
      const portalDist = Math.max(1, Math.hypot(fromPortalDx, fromPortalDy));
      const pux = fromPortalDx / portalDist;
      const puy = fromPortalDy / portalDist;

      const startX = STAGE_CENTER_X + pux * PORTAL_OUTER_R;
      const startY = STAGE_CENTER_Y + puy * PORTAL_OUTER_R;

      const cp1X = startX + pux * Math.min(55, portalDist * 0.45);
      const cp1Y = startY + puy * Math.min(55, portalDist * 0.45);
      const cp2X = p.bendX;
      const cp2Y = p.bendY;

      const pathD = `M ${startX.toFixed(1)} ${startY.toFixed(1)} C ${cp1X.toFixed(1)} ${cp1Y.toFixed(1)}, ${cp2X.toFixed(1)} ${cp2Y.toFixed(1)}, ${boxEdgeX.toFixed(1)} ${boxEdgeY.toFixed(1)}`;

      const t = 0.35;
      const mt = 1 - t;
      const dotX =
        mt * mt * mt * startX +
        3 * mt * mt * t * cp1X +
        3 * mt * t * t * cp2X +
        t * t * t * boxEdgeX;
      const dotY =
        mt * mt * mt * startY +
        3 * mt * t * t * cp1Y +
        3 * mt * t * t * cp2Y +
        t * t * t * boxEdgeY;

      return {
        ...d,
        cx,
        cy,
        boxEdgeX,
        boxEdgeY,
        pathD,
        dotX,
        dotY,
      };
    });
  }, [orbitRenderTick]);

  const getEquippedCardName = (slot: LoadoutSlotType) => {
    if (slot === 'Abilities' && equippedCards.Abilities === 'none') return ': ';
    const card = LOADOUT_CARDS.find((c) => c.id === equippedCards[slot]);
    return card ? card.name : ': ';
  };


  const handleNotchWheel = (e: React.WheelEvent) => {
    if (e.deltaY <= 4) return;
    const nowMs = performance.now();
    if (nowMs - wheelLockRef.current < 220) return;
    wheelLockRef.current = nowMs;

    if (timerAlarmRinging) {
      setTimerAlarmRinging(false);
      setIsKiboDancing(false);
      setSoulMode('LISTENING');
      return;
    }

    // When the music player is showing:
    // When it is the compact mini pill (!showMediaNotch), it is only clickable.
    // When it gets bigger (showMediaNotch is true), scrolling down expands directly to the navs!
    if (hasMediaSession) {
      if (showMediaNotch) {
        setActiveTab('Media');
        setShowMediaNotch(false);
        setIsExpanded(true);
      }
      return;
    }

    // Scroll down MUST NOT wake or expand when the notch is small and Kibo is hidden
    if (isTucked) return;

    if (!isExpanded) {
      setActiveTab('Chat');
      setShowMediaNotch(false);
      setIsExpanded(true);
    }
  };

  const renderIntegrationsContent = () => (
    <>
      <div>
        <h2 className="kibo-settings-header-title">Integrations</h2>
        <p className="kibo-settings-header-sub">
          Connect your apps, services, and developer tools.
        </p>
      </div>

      {/* Composio API Key Card */}
      <div className="kibo-settings-card">
        <div className="kibo-settings-row">
          <div>
            <div className="kibo-settings-row-label">
              Composio Project API Key{' '}
              <span style={{ fontSize: 11, fontWeight: 500, color: '#94A3B8' }}>(Optional)</span>
            </div>
            <div className="kibo-settings-row-desc">
              Only needed for external tools (Gmail, Notion, GitHub, Calendar). Core Kibo only requires your free Gemini API key.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <input
              type="password"
              value={composioDraftKey}
              onChange={(e) => setComposioDraftKey(e.target.value)}
              placeholder="ak_..."
              style={{
                width: 200,
                height: 32,
                background: '#141519',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 8,
                padding: '0 10px',
                fontSize: 12,
                color: '#F8FAFC',
                fontFamily: 'var(--kibo-font-mono)',
                outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={async () => {
                const cleanKey = composioDraftKey.trim();
                if (!cleanKey) return;
                setComposioApiKey(cleanKey);
                localStorage.setItem('kibo_composio_key', cleanKey);
                window.kiboAPI?.saveStoredSettings?.({ kibo_composio_key: cleanKey });
                await refreshComposioStatus(cleanKey);
                setComposioKeySavedAlert('Saved');
                soundFX.playSuccessChime();
                setTimeout(() => setComposioKeySavedAlert(null), 3000);
              }}
              className="config-pill-btn"
              style={{
                height: 32,
                padding: '0 14px',
                borderRadius: 8,
                background: '#38BDF8',
                color: '#0A0E17',
                fontSize: 12,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Verify & Save
            </button>
          </div>
        </div>
        {composioKeySavedAlert && (
          <div style={{ fontSize: 11, fontWeight: 700, color: '#34D399', textAlign: 'right' }}>
            {composioKeySavedAlert}
          </div>
        )}
      </div>

      {/* Dedicated Connected Accounts Box (Above scrollable directory) */}
      {(() => {
        const activeList = composioStatus.accounts.filter((a) => a.status === 'ACTIVE');
        return (
          <div className="kibo-settings-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: activeList.length > 0 ? 12 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF' }}>Connected Accounts</span>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: activeList.length > 0 ? 'rgba(52, 211, 153, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                    color: activeList.length > 0 ? '#34D399' : '#94A3B8',
                    border: activeList.length > 0 ? '1px solid rgba(52, 211, 153, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                >
                  {activeList.length} active
                </span>
              </div>
              <button
                type="button"
                onClick={async () => {
                  soundFX.playClick();
                  await refreshComposioStatus();
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '4px 10px',
                  borderRadius: 7,
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#94A3B8',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                title="Fetch realtime connection status from Composio"
              >
                <SvgIcon name="refresh" size={11} color="#94A3B8" />
                <span>Sync</span>
              </button>
            </div>

            {activeList.length === 0 ? (
              <div style={{ fontSize: 11.5, color: '#64748B', paddingTop: 6 }}>
                No accounts connected yet. Choose any app below to connect via 1-click OAuth.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
                {activeList.map((acc) => {
                  const matchedApp = INTEGRATION_APPS.find((a) => a.slug.toLowerCase() === acc.slug.toLowerCase());
                  const logoSrc = matchedApp?.logo || `./logos/${acc.slug}.png`;
                  const appName = matchedApp?.name || (acc.slug.charAt(0).toUpperCase() + acc.slug.slice(1));
                  return (
                    <div
                      key={acc.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '9px 12px',
                        borderRadius: 8,
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.07)',
                        gap: 12,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            background: 'rgba(255, 255, 255, 0.06)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            flexShrink: 0,
                          }}
                        >
                          {acc.avatarUrl ? (
                            <img src={acc.avatarUrl} width="32" height="32" alt={appName} style={{ objectFit: 'cover' }} />
                          ) : (
                            <img
                              src={logoSrc}
                              width="22"
                              height="22"
                              alt={appName}
                              style={{ objectFit: 'contain' }}
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = 'none';
                              }}
                            />
                          )}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF' }}>{appName}</span>
                            {acc.profileName && (
                              <span
                                style={{
                                  fontSize: 11.5,
                                  fontWeight: 600,
                                  color: '#38BDF8',
                                  background: 'rgba(56, 189, 248, 0.12)',
                                  border: '1px solid rgba(56, 189, 248, 0.28)',
                                  padding: '1px 7px',
                                  borderRadius: 5,
                                }}
                              >
                                {acc.profileName}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                            {acc.workspaceName ? `${acc.workspaceName} · ` : ''}Realtime OAuth Active
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                        <span style={{ fontSize: 11, color: '#34D399', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34D399' }} />
                          Connected
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDisconnectComposioAccount(acc.id, acc.slug)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 7,
                            background: 'rgba(239, 68, 68, 0.12)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: '#F87171',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          Disconnect
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* App Directory Filters & Search */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {(['All', 'Productivity', 'Developer', 'Communication', 'Media'] as const).map((cat) => {
            const isActive = integrationsCategoryFilter === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setIntegrationsCategoryFilter(cat)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 8,
                  fontSize: 11.5,
                  fontWeight: 700,
                  background: isActive ? '#38BDF8' : 'rgba(255, 255, 255, 0.05)',
                  color: isActive ? '#09111E' : '#94A3B8',
                  border: isActive ? '1px solid #38BDF8' : '1px solid rgba(255, 255, 255, 0.08)',
                  cursor: 'pointer',
                  transition: 'all 0.16s ease',
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>
        <div style={{ position: 'relative', width: 200 }}>
          <input
            type="text"
            value={integrationsSearch}
            onChange={(e) => setIntegrationsSearch(e.target.value)}
            placeholder="Search apps..."
            style={{
              width: '100%',
              height: 32,
              background: '#141519',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 8,
              padding: '0 10px 0 28px',
              fontSize: 11.5,
              color: '#F8FAFC',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
            <SvgIcon name="search" size={11} color="#64748B" />
          </span>
          {integrationsSearch && (
            <button
              type="button"
              onClick={() => setIntegrationsSearch('')}
              style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: '#94A3B8',
                cursor: 'pointer',
                fontSize: 13,
                padding: 0,
              }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* App Directory with Official Logo PNGs */}
      <div className="kibo-settings-card">
        {INTEGRATION_APPS.filter((app) => {
          const matchesCat = integrationsCategoryFilter === 'All' || app.category === integrationsCategoryFilter;
          const matchesQuery =
            !integrationsSearch.trim() ||
            app.name.toLowerCase().includes(integrationsSearch.toLowerCase()) ||
            app.description.toLowerCase().includes(integrationsSearch.toLowerCase()) ||
            app.slug.toLowerCase().includes(integrationsSearch.toLowerCase());
          return matchesCat && matchesQuery;
        }).map((app) => {
          const composioAcc = composioStatus.accounts.find(
            (a) => a.slug?.toLowerCase() === app.slug.toLowerCase() && a.status === 'ACTIVE'
          );
          const isComposioConn = Boolean(composioAcc);
          const isLocalConn = !app.viaComposio && multitaskAgent.isAppConnected(app.id as any);
          const isConnected = isComposioConn || isLocalConn;
          const isConnecting = composioConnectingSlug === app.slug;

          return (
            <div key={app.id} className="kibo-settings-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    flexShrink: 0,
                  }}
                >
                  <img
                    src={app.logo}
                    width={22}
                    height={22}
                    alt={app.name}
                    style={{ objectFit: 'contain' }}
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF' }}>{app.name}</span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: '#94A3B8',
                        padding: '1px 6px',
                        borderRadius: 4,
                        background: 'rgba(255, 255, 255, 0.06)',
                      }}
                    >
                      {app.category}
                    </span>
                  </div>
                  <div
                    className="companion-truncate"
                    style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}
                  >
                    {app.description}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {app.id === 'chrome' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {chromeExtStatus && (
                      <button
                        type="button"
                        onClick={() => {
                          window.kiboAPI?.exportChromeExtension?.({ revealInExplorer: true });
                        }}
                        style={{
                          padding: '4px 8px',
                          borderRadius: 6,
                          background: 'rgba(255, 255, 255, 0.06)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          color: '#94A3B8',
                          fontSize: 11,
                          cursor: 'pointer',
                        }}
                      >
                        Show Folder
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        const res = await window.kiboAPI?.exportChromeExtension?.({ revealInExplorer: false });
                        await window.kiboAPI?.openChromeExtensionsPage?.();
                        if (res?.success && res.extDir) {
                          setChromeExtStatus(res.extDir);
                          soundFX.playSuccessChime();
                        } else {
                          setChromeExtStatus('Kibo-Chrome-Extension');
                        }
                      }}
                      className="config-pill-btn"
                      style={{
                        height: 30,
                        padding: '0 12px',
                        borderRadius: 8,
                        background: chromeExtStatus ? 'rgba(56, 189, 248, 0.15)' : '#1E293B',
                        color: chromeExtStatus ? '#38BDF8' : '#F8FAFC',
                        border: chromeExtStatus ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid rgba(255, 255, 255, 0.12)',
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {chromeExtStatus ? 'Open chrome://extensions/' : 'Install Extension'}
                    </button>
                  </div>
                ) : app.id === 'vscode' ? (
                  <span style={{ fontSize: 11, color: '#34D399', fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: 'rgba(52, 211, 153, 0.12)' }}>
                    Active
                  </span>
                ) : isConnected ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {composioAcc?.profileName && (
                      <span
                        style={{
                          fontSize: 11,
                          color: '#94A3B8',
                          background: 'rgba(255, 255, 255, 0.06)',
                          padding: '2px 7px',
                          borderRadius: 5,
                        }}
                      >
                        {composioAcc.profileName}
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: '#34D399', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34D399' }} />
                      Connected
                    </span>
                    {composioAcc && (
                      <button
                        type="button"
                        onClick={() => handleDisconnectComposioAccount(composioAcc.id, app.slug)}
                        style={{
                          padding: '3px 8px',
                          borderRadius: 6,
                          background: 'transparent',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          color: '#94A3B8',
                          fontSize: 10.5,
                          cursor: 'pointer',
                        }}
                      >
                        Disconnect
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={isConnecting}
                    onClick={() => handleConnectComposioApp(app.slug)}
                    className="config-pill-btn"
                    style={{
                      height: 30,
                      padding: '0 14px',
                      borderRadius: 8,
                      background: isConnecting ? 'rgba(56, 189, 248, 0.25)' : '#1E293B',
                      color: isConnecting ? '#38BDF8' : '#F8FAFC',
                      border: isConnecting ? '1px solid #38BDF8' : '1px solid rgba(255, 255, 255, 0.12)',
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: isConnecting ? 'wait' : 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {isConnecting ? 'Opening...' : 'Connect'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Custom Connections (Meta Ads, Webhooks, APIs) */}
      <div className="kibo-settings-card" style={{ marginTop: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div>
            <div className="kibo-settings-row-label">Custom Endpoints & Private Webhooks</div>
            <div className="kibo-settings-row-desc">Add private webhooks, custom endpoints, or proprietary ad telemetry</div>
          </div>
        </div>

        {customIntegrations.map((conn) => {
          const lowerConn = conn.name.toLowerCase();
          const customLogo = lowerConn.includes('meta')
            ? './logos/meta.png'
            : lowerConn.includes('linear')
            ? './logos/linear.png'
            : lowerConn.includes('github')
            ? './logos/github.png'
            : lowerConn.includes('gmail')
            ? './logos/gmail.png'
            : null;

          return (
            <div key={conn.id} className="kibo-settings-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                  {customLogo ? (
                    <img src={customLogo} width="20" height="20" alt={conn.name} style={{ objectFit: 'contain' }} />
                  ) : (
                    <SvgIcon name="plug" size={14} color={conn.connected ? '#38BDF8' : '#94A3B8'} />
                  )}
                </div>
                <div>
                  <div className="kibo-settings-row-label">{conn.name}</div>
                  <div className="kibo-settings-row-desc">
                    {conn.category} · <span style={{ fontFamily: 'var(--kibo-font-mono)', fontSize: 10.5 }}>{conn.endpointOrId}</span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  type="button"
                  onClick={() => {
                    setCustomIntegrations((prev) => {
                      const next = prev.map((c) => (c.id === conn.id ? { ...c, connected: !c.connected } : c));
                      localStorage.setItem('kibo_custom_integrations', JSON.stringify(next));
                      return next;
                    });
                  }}
                  style={{
                    background: conn.connected ? 'rgba(56, 189, 248, 0.15)' : '#1E293B',
                    color: conn.connected ? '#38BDF8' : '#94A3B8',
                    border: conn.connected ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 7,
                    padding: '4px 10px',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {conn.connected ? 'Active' : 'Enable'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCustomIntegrations((prev) => {
                      const next = prev.filter((c) => c.id !== conn.id);
                      localStorage.setItem('kibo_custom_integrations', JSON.stringify(next));
                      return next;
                    });
                  }}
                  style={{
                    background: 'transparent',
                    color: '#64748B',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 7,
                    padding: '4px 8px',
                    fontSize: 11,
                    cursor: 'pointer',
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr auto', gap: 6, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <input
            type="text"
            value={newConnName}
            onChange={(e) => setNewConnName(e.target.value)}
            placeholder="Name (e.g. Meta Ads)"
            style={{ background: '#141519', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, padding: '6px 9px', color: '#F8FAFC', fontSize: 11.5 }}
          />
          <input
            type="text"
            value={newConnCategory}
            onChange={(e) => setNewConnCategory(e.target.value)}
            placeholder="Role (e.g. Ad Analytics)"
            style={{ background: '#141519', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, padding: '6px 9px', color: '#F8FAFC', fontSize: 11.5 }}
          />
          <input
            type="text"
            value={newConnEndpoint}
            onChange={(e) => setNewConnEndpoint(e.target.value)}
            placeholder="Account ID / API Endpoint"
            style={{ background: '#141519', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, padding: '6px 9px', color: '#F8FAFC', fontSize: 11.5 }}
          />
          <button
            type="button"
            onClick={() => {
              if (!newConnName.trim()) return;
              const item: CustomIntegrationItem = {
                id: `conn_${Date.now()}`,
                name: newConnName.trim(),
                category: newConnCategory.trim() || 'Custom Integration',
                endpointOrId: newConnEndpoint.trim() || 'local-bridge',
                connected: true,
              };
              setCustomIntegrations((prev) => {
                const next = [...prev, item];
                localStorage.setItem('kibo_custom_integrations', JSON.stringify(next));
                return next;
              });
              setNewConnName('');
              setNewConnCategory('');
              setNewConnEndpoint('');
              soundFX.playSuccessChime();
            }}
            style={{
              background: '#38BDF8',
              color: '#0A0E17',
              border: 'none',
              borderRadius: 7,
              padding: '6px 12px',
              fontSize: 11.5,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Add
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div
      className="kibo-companion-root"
      style={{
        ...adaptiveVars,
        background: isElectron
          ? 'transparent'
          : `url("${resolveWallpaperDisplayUrl(isWallpaperRippling ? prevTheme.url : activeTheme.url)}") center/cover no-repeat`,
        filter: nightLight && !isElectron ? `sepia(${Math.round(nightLightStrength * 0.45)}%) saturate(${1 + nightLightStrength * 0.0015})` : undefined,
        transition: 'filter 0.3s ease',
      }}
      
    >
      {/* Shockwave Wallpaper Transition (Emerging smoothly from Top Notch) */}
      {isWallpaperRippling && ripplingWallpaperUrl && (
        <>
          <div
            className="wallpaper-radial-iris-overlay is-shockwave"
            style={{
              position: 'fixed',
              inset: 0,
              width: '100vw',
              height: '100vh',
              backgroundImage: `url("${resolveWallpaperDisplayUrl(ripplingWallpaperUrl)}")`,
              backgroundSize: 'cover',
              backgroundPosition: 'center center',
              pointerEvents: 'none',
              zIndex: 1,
            }}
          />
          <div
            className="wallpaper-shockwave-glow-ring"
            style={{
              borderColor: activeTheme?.accent || '#38BDF8',
            }}
          />
        </>
      )}

      {/* Glowing Blue Desktop Border ONLY when Kibo is actively working / controlling the PC */}
      <div
        className={`kibo-screen-edge-glow ${
          askNotchPhase === 'thinking' || Boolean(contextCard) || Boolean(kiboReply)
            ? 'is-active'
            : ''
        }`}
      />

      {/* =====================================================================
          TOP HARDWARE NOTCH SHELL
          ===================================================================== */}
      <div
        ref={notchShellRef}
        className={`kibo-bezel-shell ${isExpanded ? 'is-expanded' : ''} ${isTuckedSliver ? 'is-tucked' : ''} ${isBooting ? 'is-booting' : ''}`}
        style={{
          width: `${notchShellWidth}px`,
          height: `${notchShellHeight}px`,
          borderBottomLeftRadius: `${bottomRadius}px`,
          borderBottomRightRadius: `${bottomRadius}px`,
          zIndex: onboardingStep !== null ? 9999 : undefined,
        }}
        onMouseEnter={handleIslandMouseEnter}
        onMouseLeave={handleIslandMouseLeave}
        onWheel={handleNotchWheel}
        onDragEnter={(e) => {
          if (e.dataTransfer?.types?.includes('Files')) {
            e.preventDefault();
            if (leaveCollapseTimerRef.current) {
              clearTimeout(leaveCollapseTimerRef.current);
              leaveCollapseTimerRef.current = null;
            }
            if (idleTuckTimerRef.current) {
              clearTimeout(idleTuckTimerRef.current);
              idleTuckTimerRef.current = null;
            }
            setIsTucked(false);
            setIsFileDraggingOverNotch(true);
          }
        }}
        onDragOver={(e) => {
          if (e.dataTransfer?.types?.includes('Files')) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            if (!isFileDraggingOverNotch) {
              setIsTucked(false);
              setIsFileDraggingOverNotch(true);
            }
          }
        }}
        onDragLeave={(e) => {
          const related = e.relatedTarget as Node | null;
          if (!related || !notchShellRef.current?.contains(related)) {
            setIsFileDraggingOverNotch(false);
          }
        }}
        onDrop={(e) => {
          const droppedFile = e.dataTransfer?.files?.[0];
          if (droppedFile) {
            e.preventDefault();
            e.stopPropagation();
            setIsFileDraggingOverNotch(false);
            setIsConvertDragOver(false);
            const nameLower = (droppedFile.name || '').toLowerCase();
            if (isExpanded && activeTab === 'Skills' && (nameLower.endsWith('.md') || nameLower.endsWith('.markdown') || nameLower.endsWith('.txt'))) {
              const reader = new FileReader();
              reader.onload = () => {
                const content = String(reader.result || '');
                if (content.trim()) {
                  const baseName = droppedFile.name.replace(/\.(md|markdown|txt)$/i, '');
                  const newSkill: KiboSkillItem = {
                    id: `skill_${Date.now()}`,
                    name: `${baseName} (SKILL.md)`,
                    description: 'Imported SKILL.md instruction module.',
                    content,
                    enabled: true,
                  };
                  updateSkillsList((prev) => [newSkill, ...prev]);
                  soundFX.playTaskSuccess();
                }
              };
              reader.readAsText(droppedFile);
              return;
            }
            ingestDroppedFileForConvert(droppedFile);
          }
        }}
      >
        {isTuckedSliver && bootPhase !== 'sleeping' && (
          <div className="tucked-hover-dock">
            <div className={`tucked-hold-pill ${isHoverHoldActive ? 'charging' : ''}`}>
              <div
                className="tucked-hold-fill"
                style={{
                  width: `${Math.round(hoverHoldProgress * 100)}%`,
                  background: 'var(--adaptive-accent, #38BDF8)',
                  height: '100%',
                  borderRadius: '999px',
                  boxShadow: '0 0 10px var(--adaptive-accent, #38BDF8)',
                  transition: isHoverHoldActive ? 'none' : 'width 0.15s ease-out',
                }}
              />
            </div>
          </div>
        )}
        <svg
          className="kibo-svg-arch left"
          viewBox="0 0 24 24"
          style={{
            left: `-${archSize}px`,
            width: `${archSize + 1}px`,
            height: `${archSize}px`,
          }}
          preserveAspectRatio="none"
        >
          <path
            d="M 0 0 L 24 0 L 24 24 L 23 24 C 23 10 13.5 0 0 0 Z"
            fill="#0C0C0E"
          />
        </svg>

        <svg
          className="kibo-svg-arch right"
          viewBox="0 0 24 24"
          style={{
            right: `-${archSize}px`,
            width: `${archSize + 1}px`,
            height: `${archSize}px`,
          }}
          preserveAspectRatio="none"
        >
          <path
            d="M 24 0 L 0 0 L 0 24 L 1 24 C 1 10 10.5 0 24 0 Z"
            fill="#0C0C0E"
          />
        </svg>

        <div
          className="kibo-bezel-inner"
          style={{
            borderBottomLeftRadius: `${bottomRadius}px`,
            borderBottomRightRadius: `${bottomRadius}px`,
            background:
              isExpanded && activeTab === 'Media'
                ? `radial-gradient(110% 85% at 50% 105%, rgba(${mediaArtPalette.rgb}, 0.42) 0%, rgba(${mediaArtPalette.rgb}, 0.14) 50%, rgba(12, 12, 14, 0) 82%), #0C0C0E`
                : undefined,
            transition: 'background 0.45s ease',
          }}
        >
          {/* STATE 00: SMART FILE DRAG-INTO-NOTCH STORAGE DROP CHAMBER */}
          {!isExpanded && isFileDraggingOverNotch && (
            <div
              style={{
                width: '100%',
                height: '100%',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                boxSizing: 'border-box',
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: 'rgba(56, 189, 248, 0.14)',
                  border: '1.5px dashed rgba(56, 189, 248, 0.65)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <SvgIcon name="upload" size={20} color="#38BDF8" />
              </div>
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.01em' }}>
                  Drop into Kibo Storage Box
                </div>
                <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                  Release file to open Universal Converter (Original stays safe)
                </div>
              </div>
            </div>
          )}

          {/* STATE 0: PROACTIVE CONTEXT APP NOTCH ("Connect Notion/GitHub to Kibo?") */}
          {!isFileDraggingOverNotch && showProactiveBanner && detectedAppId && (() => {
            const composioAcc = composioStatus.accounts.find(
              (a) => a.slug?.toLowerCase() === detectedAppId.toLowerCase() && a.status === 'ACTIVE'
            );
            const isConn = Boolean(composioAcc) || (detectedAppId === 'vscode' && multitaskAgent.isAppConnected(detectedAppId));
            const isConnLoading = composioConnectingSlug === detectedAppId;

            return (
              <ProactiveContextNotch
                appId={detectedAppId}
                soul={currentSoul}
                isConnected={isConn}
                isConnecting={isConnLoading}
                profileName={composioAcc?.profileName}
                onConnect={() => {
                  if (detectedAppId === 'vscode') {
                    multitaskAgent.connectApp('vscode');
                    soundFX.playSuccessChime();
                    if (appBannerTimerRef.current) clearTimeout(appBannerTimerRef.current);
                    appBannerTimerRef.current = setTimeout(() => {
                      setDetectedAppId(null);
                    }, 6000);
                  } else {
                    handleConnectComposioApp(detectedAppId);
                  }
                }}
                onUnlink={() => {
                  if (composioAcc) {
                    handleDisconnectComposioAccount(composioAcc.id, detectedAppId);
                  } else {
                    multitaskAgent.unlinkApp(detectedAppId);
                  }
                }}
                onDismiss={(mode) => {
                  multitaskAgent.dismissApp(detectedAppId, mode);
                  setDetectedAppId(null);
                }}
                onRunSuggestion={(suggestionText) => {
                  multitaskAgent.spawnTask(suggestionText, detectedAppId);
                  setDetectedAppId(null);
                  setIsExpanded(true);
                  setActiveTab('Agents');
                }}
              />
            );
          })()}

          {!isExpanded && !isFileDraggingOverNotch && !showProactiveBanner && !showMediaNotch && notchApiAlert && (
            <div
              className="kibo-notch-api-alert"
              onClick={() => {
                setNotchApiAlert(null);
                openCompanionApp('settings', true);
              }}
            >
              <span className="api-alert-dot" />
              <span className="api-alert-text">{notchApiAlert.text}</span>
            </div>
          )}

          {!isExpanded && !isFileDraggingOverNotch && !showProactiveBanner && !showMediaNotch && !notchApiAlert && isCompactAskBar && (
            <div className="kibo-notch-ask-compact" onClick={() => setAskNotchPhase('idle')}>
              <div className="ask-mini-soul-left">
                <SoulCanvas
                  soul={currentSoul}
                  width={62}
                  height={42}
                  scale={0.96}
                  isDull={isSoulDull}
                  interactive={true}
                  mode={askNotchPhase === 'thinking' ? 'THINKING' : soulMode === 'TALKING' ? 'TALKING' : 'LISTENING'}
                />
              </div>

              {askNotchPhase === 'speaking' ? (
                <div className="ask-waveform-right">
                  {[0.45, 0.85, 1.0, 0.75, 0.95, 0.65, 0.4].map((h, i) => (
                    <span
                      key={i}
                      className="companion-wave-bar"
                      style={{
                        height: `${Math.round(h * 14)}px`,
                        animationDuration: `${0.38 + (i % 3) * 0.12}s`,
                        animationDelay: `${i * 0.06}s`,
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="ask-waveform-right thinking">
                  {[0.4, 0.75, 1.0, 0.65, 0.45].map((h, i) => (
                    <span
                      key={i}
                      className="companion-wave-bar"
                      style={{
                        height: `${Math.round(h * 12)}px`,
                        animationDuration: `${0.45 + (i % 2) * 0.14}s`,
                        animationDelay: `${i * 0.08}s`,
                        opacity: 0.85,
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {showNotchNotification && activeNotchNotification && (
            <div
              className="kibo-notch-dynamic-notification"
              onClick={() => {
                if (activeNotchNotification.appSlug) {
                  multitaskAgent.openApp(activeNotchNotification.appSlug as any);
                }
                setActiveNotchNotification(null);
              }}
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 12px',
                gap: '10px',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    overflow: 'hidden',
                  }}
                >
                  {activeNotchNotification.logo ? (
                    <img src={activeNotchNotification.logo} width="18" height="18" alt={activeNotchNotification.appName} style={{ objectFit: 'contain' }} />
                  ) : (
                    <SvgIcon name="bell" size={14} color="#38BDF8" />
                  )}
                </div>
                <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#FFFFFF', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {activeNotchNotification.title || activeNotchNotification.appName}
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#94A3B8', lineHeight: 1.2, marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {activeNotchNotification.message}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveNotchNotification(null);
                }}
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '999px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#94A3B8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 0,
                  fontSize: '13px',
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>
          )}

          {!isExpanded && !isFileDraggingOverNotch && !showProactiveBanner && !showMediaNotch && !notchApiAlert && !isCompactAskBar && isTimerNotchActive && (
            <div
              className={`kibo-notch-timer-bar ${timerAlarmRinging ? 'is-ringing' : ''}`}
              title={
                timerAlarmRinging
                  ? 'Click to stop celebration'
                  : isStopwatchNotchActive && !isTimerRunning
                  ? stopwatchRunning
                    ? 'Click anywhere to pause stopwatch · Red button resets · Double-click opens Focus'
                    : 'Click anywhere to resume stopwatch · Red button resets · Double-click opens Focus'
                  : isTimerRunning
                  ? 'Click anywhere to pause timer · Red button resets · Double-click opens Focus'
                  : 'Click anywhere to resume timer'
              }
              onDoubleClick={() => {
                setFocusSubMode(isStopwatchNotchActive && !isTimerRunning ? 'stopwatch' : 'timer');
                setActiveTab('Focus');
                setIsExpanded(true);
              }}
              onClick={() => {
                if (timerAlarmRinging) {
                  setTimerAlarmRinging(false);
                  setIsKiboDancing(false);
                  setTimerSeconds(timerTotalSeconds);
                  setSoulMode('LISTENING');
                } else if (isStopwatchNotchActive && !isTimerRunning) {
                  setStopwatchRunning((r) => {
                    soundFX.playToggle(!r);
                    return !r;
                  });
                } else {
                  setIsTimerRunning((r) => {
                    soundFX.playToggle(!r);
                    return !r;
                  });
                }
              }}
            >
              <div className={timerAlarmRinging ? 'alarm-dancing-soul' : 'ask-mini-soul-left'}>
                <SoulCanvas
                  soul={currentSoul}
                  width={timerAlarmRinging ? 60 : 54}
                  height={timerAlarmRinging ? 48 : 42}
                  scale={timerAlarmRinging ? 1.0 : 0.94}
                  isDull={isSoulDull}
                  interactive={true}
                  mode={timerAlarmRinging ? 'DANCING' : 'LISTENING'}
                  expression={
                    timerAlarmRinging
                      ? 'DANCING'
                      : isStopwatchNotchActive && !isTimerRunning && !isTimerSessionActive
                      ? stopwatchRunning
                        ? 'STOPWATCH'
                        : 'PEEKING'
                      : isTimerRunning
                      ? 'FOCUSING'
                      : 'PEEKING'
                  }
                />
              </div>
              {timerAlarmRinging ? (
                <div className="alarm-ringing-copy">
                  <span className="alarm-title">Time's up! Kibo Dance!</span>
                  <span className="alarm-sub">Click to stop celebration</span>
                </div>
              ) : isStopwatchNotchActive && !isTimerRunning && !isTimerSessionActive ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    className="notch-timer-digits"
                    style={{
                      opacity: stopwatchRunning ? 1 : 0.62,
                      color: stopwatchRunning ? '#FFFFFF' : '#94A3B8',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {String(Math.floor(stopwatchMs / 60000)).padStart(2, '0')}:
                    {String(Math.floor((stopwatchMs % 60000) / 1000)).padStart(2, '0')}.
                    {String(Math.floor((stopwatchMs % 1000) / 10)).padStart(2, '0')}
                  </span>
                  <button
                    type="button"
                    title="Reset & Stop Stopwatch"
                    onClick={(e) => {
                      e.stopPropagation();
                      setStopwatchRunning(false);
                      setStopwatchMs(0);
                      setStopwatchLaps([]);
                      soundFX.playToggle(false);
                    }}
                    style={{
                      width: '21px',
                      height: '21px',
                      borderRadius: '999px',
                      border: '1px solid rgba(239, 68, 68, 0.55)',
                      background: 'rgba(239, 68, 68, 0.2)',
                      color: '#F87171',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      padding: 0,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span
                      style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '1.5px',
                        background: '#F87171',
                        display: 'block',
                      }}
                    />
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    className="notch-timer-digits"
                    style={{
                      opacity: isTimerRunning ? 1 : 0.68,
                      color: isTimerRunning ? '#38BDF8' : '#94A3B8',
                    }}
                  >
                    {String(Math.floor(timerSeconds / 60)).padStart(2, '0')}:
                    {String(timerSeconds % 60).padStart(2, '0')}
                  </span>
                  <button
                    type="button"
                    title="Reset & Stop Focus Timer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsTimerRunning(false);
                      setIsTimerSessionActive(false);
                      setTimerAlarmRinging(false);
                      setIsKiboDancing(false);
                      setTimerSeconds(timerTotalSeconds);
                      soundFX.playToggle(false);
                    }}
                    style={{
                      width: '21px',
                      height: '21px',
                      borderRadius: '999px',
                      border: '1px solid rgba(239, 68, 68, 0.55)',
                      background: 'rgba(239, 68, 68, 0.2)',
                      color: '#F87171',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      padding: 0,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span
                      style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '1.5px',
                        background: '#F87171',
                        display: 'block',
                      }}
                    />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STATE 1C: APPLE DYNAMIC ISLAND MINI MEDIA NOTCH (Synth freezes when paused) */}
          {!isExpanded && !isFileDraggingOverNotch && !showProactiveBanner && !showMediaNotch && !notchApiAlert && !isCompactAskBar && !isTimerNotchActive && isMiniMediaPill && (
            <div
              className="kibo-notch-mini-media"
              onClick={() => {
                setIsTucked(false);
                setShowMediaNotch(true);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <div
                className="mini-media-album-thumb"
                style={
                  activeMediaArtwork
                    ? {
                        backgroundImage: `url("${activeMediaArtwork}")`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }
                    : {
                        background: mediaArtPalette.gradient,
                      }
                }
              />
              <div style={{ flex: 1 }} />
              <div className="mini-media-eq-bars">
                {[0.28, 0.35, 0.62, 0.72, 0.85, 1.0].map((h, i) => (
                  <span
                    key={i}
                    className={`mini-eq-bar ${!isPlayingMedia ? 'is-paused' : ''}`}
                    style={{
                      height: isPlayingMedia ? `${Math.round(h * 14)}px` : '4px',
                      background: mediaArtPalette.accent,
                      boxShadow: isPlayingMedia ? `0 0 6px rgba(${mediaArtPalette.rgb}, 0.55)` : 'none',
                      animationDuration: `${0.42 + (i % 3) * 0.14}s`,
                      animationDelay: `${i * 0.07}s`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* STATE 1E: AWAKE OR TUCKED SOUL NOTCH (Right-click ONLY works directly on visible Kibo!) */}
          {!isExpanded && !isFileDraggingOverNotch && !showProactiveBanner && !showMediaNotch && !notchApiAlert && !isCompactAskBar && !isTimerNotchActive && !isMiniMediaPill && (
            <div
              className={`kibo-notch-soul ${soulIsHit ? 'is-hit' : ''}`}
              style={{
                opacity: roamingStage !== 'IDLE' || onboardingStep !== null ? 0 : 1,
                pointerEvents: roamingStage !== 'IDLE' || onboardingStep !== null ? 'none' : 'auto',
                transition: 'opacity 0.22s ease',
              }}
              onClick={handleKiboPoke}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <div
                className="kibo-soul-underglow"
                style={{
                  opacity: (isTucked || bootPhase === 'sleeping' || bootPhase === 'tucking') ? 0 : isSoulDull ? 0.35 : 1,
                  background:
                    isSoulDull
                      ? 'radial-gradient(circle, rgba(100, 116, 139, 0.28) 0%, transparent 72%)'
                      : soulAnnoyance > 0.35
                      ? 'radial-gradient(circle, rgba(239, 68, 68, 0.48) 0%, transparent 72%)'
                      : isBreathingRelief
                      ? (isVoidEquipped ? 'radial-gradient(circle, rgba(196, 181, 253, 0.52) 0%, transparent 72%)' : 'radial-gradient(circle, rgba(92, 184, 255, 0.52) 0%, transparent 72%)')
                      : (isVoidEquipped ? 'radial-gradient(circle, rgba(167, 139, 250, 0.46) 0%, transparent 72%)' : 'radial-gradient(circle, rgba(92, 184, 255, 0.36) 0%, transparent 72%)'),
                  transition: 'opacity 0.45s ease, background 0.3s ease',
                }}
              />
              <div
                className="kibo-idle-soul-wrap"
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!isTucked && bootPhase === 'ready') {
                    openCompanionApp('soul', false);
                  }
                }}
                style={{
                  opacity: (isTucked || bootPhase === 'sleeping' || bootPhase === 'tucking') ? 0 : 1,
                  transform: (isTucked || bootPhase === 'sleeping' || bootPhase === 'tucking')
                    ? 'translateY(-38px) scale(0.52)'
                    : isHovered
                    ? 'scale(1.06)'
                    : 'scale(1)',
                  pointerEvents: (isTucked || bootPhase === 'sleeping' || bootPhase === 'tucking') ? 'none' : 'auto',
                  transition: 'transform 0.48s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.38s ease',
                }}
              >
                <SoulCanvas
                  soul={currentSoul}
                  width={90}
                  height={68}
                  scale={1.22}
                  mode={soulMode}
                  expression={isBooting ? bootExpression : undefined}
                  isDull={isSoulDull}
                  interactive={true}
                  annoyance={soulAnnoyance}
                  isHit={soulIsHit}
                  isBreathingRelief={isBreathingRelief}
                  onClick={handleKiboPoke}
                />
              </div>
            </div>
          )}

          {/* STATE 2: COMPACT MEDIA PLAYER NOTCH (Bottom-anchored glow keeps top-left & top-right #0C0C0E seamless!) */}
          {!isExpanded && !isFileDraggingOverNotch && showMediaNotch && (
            <div
              className="kibo-notch-media-v2"
              style={{
                background: `radial-gradient(circle at 50% 95%, rgba(${mediaArtPalette.rgb}, 0.28) 0%, rgba(12, 12, 14, 0) 68%), #0C0C0E`,
              }}
              onClick={() => {
                setActiveTab('Media');
                setShowMediaNotch(false);
                setIsExpanded(true);
              }}
            >
              <div className="companion-media-top-row">
                <div
                  className="companion-album-art compact"
                  style={
                    activeMediaArtwork
                      ? {
                          backgroundImage: `url("${activeMediaArtwork}")`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                        }
                      : {
                          background: mediaArtPalette.gradient,
                        }
                  }
                />
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                  <div className="companion-truncate" style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
                    {activeMediaTitle}
                  </div>
                  <div className="companion-truncate" style={{ fontSize: '11px', color: '#D4D4D8', marginTop: '2px' }}>
                    {activeMediaArtist}
                  </div>
                </div>
              </div>

              <div className="companion-media-scrub-row" onClick={(e) => e.stopPropagation()}>
                <span className="companion-mono-tiny" style={{ color: '#8A8F9E' }}>
                  {formatTime(mediaProgress)}
                </span>
                <div
                  ref={notchScrubRef}
                  className="companion-scrub-track"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    if (leaveCollapseTimerRef.current) {
                      clearTimeout(leaveCollapseTimerRef.current);
                    }
                    activeScrubRef.current = notchScrubRef.current;
                    isDraggingMediaScrubRef.current = true;
                    setIsDraggingMediaScrub(true);
                    updateMediaScrubFromClientX(e.clientX, true);
                  }}
                >
                  <div
                    className="companion-scrub-fill white"
                    style={{
                      width: `${Math.min(100, (mediaProgress / totalMediaDuration) * 100)}%`,
                      background: mediaArtPalette.accent,
                    }}
                  >
                    <div className="companion-scrub-thumb" style={{ background: '#ffffff' }} />
                  </div>
                </div>
                <span className="companion-mono-tiny" style={{ color: '#8A8F9E' }}>
                  {formatTime(totalMediaDuration)}
                </span>
              </div>

              <div className="companion-media-controls-row" onClick={(e) => e.stopPropagation()}>
                <button onClick={handleMediaPrev} className="companion-media-btn">
                  <SvgIcon name="prev" size={16} color="#FFFFFF" />
                </button>
                <button onClick={toggleMediaPlayback} className="companion-media-btn play">
                  <SvgIcon name={isPlayingMedia ? 'pause' : 'play'} size={18} color="#FFFFFF" />
                </button>
                <button onClick={handleMediaNext} className="companion-media-btn">
                  <SvgIcon name="next" size={16} color="#FFFFFF" />
                </button>
              </div>
            </div>
          )}

          {/* STATE 4: FULL EXPANDED DYNAMIC ISLAND */}
          {isExpanded && (
            <div className="kibo-expanded-inner">
              <div className="companion-nav-header">

                <div className="companion-nav-track">

                  <div

                    className="companion-nav-glider"

                    style={{
                      width: `${activeNavMetrics.width}px`,
                      transform: `translate3d(${activeNavMetrics.left}px, 0, 0)`,
                      opacity: (activeNavMetrics as any).opacity ?? 1,
                    }}

                  />

                  {NAV_TABS.map(({ id: tab, label, icon, width }) => {
                    const isActive = activeTab === tab;
                    return (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`companion-nav-btn ${isActive ? 'active' : ''}`}
                        style={{ width: `${width}px`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                      >
                        <SvgIcon name={icon} size={11} color={isActive ? '#FFFFFF' : '#94A3B8'} />
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="companion-header-actions">
                  {activeTab === 'Chat' && chatMessages.length > 1 && (
                    <button
                      onClick={() => {
                        const initial: ChatMessageItem[] = [
                          {
                            id: 'welcome_reset',
                            role: 'kibo',
                            text: "Chat history cleared. Hold Win + Alt to talk or type below.",
                            time: 'Now',
                          },
                        ];
                        setChatMessages(initial);
                        localStorage.setItem('kibo_chat_history', JSON.stringify(initial));
                      }}
                      className="companion-header-circle"
                      title="Clear chat history"
                    >
                      <SvgIcon name="trash" size={11} />
                    </button>
                  )}

                  {availableUpdate && (
                    <button
                      type="button"
                      onClick={() => {
                        setSettingsCategory('General');
                        setActiveTab('Settings');
                      }}
                      className="companion-header-circle"
                      title={`Update v${availableUpdate.version} available! Click to open General settings.`}
                      style={{
                        width: 'auto',
                        padding: '0 8px',
                        borderRadius: 999,
                        background: 'rgba(56, 189, 248, 0.18)',
                        border: '1px solid rgba(56, 189, 248, 0.45)',
                        color: '#38BDF8',
                        fontSize: 10.5,
                        fontWeight: 700,
                        gap: 5,
                        display: 'flex',
                        alignItems: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#38BDF8', boxShadow: '0 0 6px #38BDF8' }} />
                      <span>v{availableUpdate.version}</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      if (activeTab === 'Settings') {
                        setActiveTab('Chat');
                      } else {
                        setSettingsCategory('Account');
                        setActiveTab('Settings');
                      }
                    }}
                    className={`companion-header-circle ${activeTab === 'Settings' ? 'active' : ''}`}
                    title={activeTab === 'Settings' ? 'Return to Chat' : 'Settings & Preferences'}
                    style={activeTab === 'Settings' ? { background: 'rgba(56, 189, 248, 0.22)', color: '#38BDF8' } : undefined}
                  >
                    <SvgIcon name="gear" size={12} />
                  </button>

                  <button
                    onClick={() => {
                      const next = !sfxEnabled;
                      setSfxEnabled(next);
                      soundFX.setEnabled(next);
                    }}
                    title={sfxEnabled ? 'Sound Effects: On' : 'Sound Effects: Muted'}
                    className="companion-header-circle"
                  >
                    <SvgIcon name={sfxEnabled ? 'speaker' : 'mute'} size={12} />
                  </button>
                </div>
              </div>

              <div ref={tabContentRef} className="companion-tab-body">
                {/* =========================================================
                    TAB 1: CHAT (Dotted-Grid Speech Bubble History + Hold to Talk + Ask Kibo)
                    ========================================================= */}
                {activeTab === 'Chat' && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      flex: 1,
                      minHeight: 0,
                      width: '100%',
                      borderRadius: '16px',
                      backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.13) 1px, transparent 1px)',
                      backgroundSize: '18px 18px',
                      backgroundPosition: 'center center',
                      padding: '8px 6px 4px',
                      position: 'relative',
                      justifyContent: 'space-between',
                      gap: '10px',
                    }}
                  >
                    <div
                      ref={chatScrollRef}
                      style={{
                        flex: 1,
                        minHeight: 0,
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        padding: '6px 8px 8px',
                        contain: 'content',
                      }}
                    >
                      {chatMessages.slice(-25).map((msg) => {
                        const isUser = msg.role === 'user';
                        return (
                          <div
                            key={msg.id}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: isUser ? 'flex-end' : 'flex-start',
                              width: '100%',
                            }}
                          >
                            <div
                              style={
                                isUser
                                  ? {
                                      maxWidth: '78%',
                                      padding: '10px 16px',
                                      borderRadius: '16px 16px 4px 16px',
                                      background: '#1E293B',
                                      border: '1px solid rgba(56, 189, 248, 0.32)',
                                      color: '#F8FAFC',
                                      fontSize: '13px',
                                      fontWeight: 600,
                                      lineHeight: 1.42,
                                      wordBreak: 'break-word',
                                    }
                                  : {
                                      maxWidth: '82%',
                                      padding: '11px 16px',
                                      borderRadius: '16px 16px 16px 4px',
                                      background: '#26272B',
                                      border: '1px solid rgba(255, 255, 255, 0.08)',
                                      color: '#F4F4F5',
                                      fontSize: '13px',
                                      fontWeight: 500,
                                      lineHeight: 1.46,
                                      wordBreak: 'break-word',
                                    }
                              }
                            >
                              <div>{msg.text}</div>
                              {msg.actionFilePath && (
                                <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                                  <button
                                    onClick={() => window.kiboAPI?.showItemInFolder?.(msg.actionFilePath!)}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '5px',
                                      padding: '4px 10px',
                                      borderRadius: '8px',
                                      background: 'rgba(56, 189, 248, 0.16)',
                                      border: '1px solid rgba(56, 189, 248, 0.35)',
                                      color: '#BAE6FD',
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <SvgIcon name="folder" size={11} color="#38BDF8" />
                                    <span>{msg.actionLabel || 'Show in Folder'}</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {askNotchPhase === 'thinking' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '6px' }}>
                          <div
                            style={{
                              padding: '9px 14px',
                              borderRadius: '16px 16px 16px 4px',
                              background: '#26272B',
                              border: '1px solid rgba(56, 189, 248, 0.28)',
                              color: '#BAE6FD',
                              fontSize: '12px',
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '8px',
                            }}
                          >
                            <SoulCanvas soul={currentSoul} width={24} height={20} scale={0.62} mode="THINKING" />
                            <span>Kibo is thinking...</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Bottom Action Bar matching screenshot: Hold to talk button + Ask Kibo input */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1.35fr 1fr',
                        gap: '10px',
                        alignItems: 'center',
                        paddingTop: '4px',
                        flexShrink: 0,
                      }}
                    >
                      <button
                        type="button"
                        onPointerDown={() => startHoldRecording('ASK')}
                        onPointerUp={() => stopHoldRecording()}
                        onClick={() => {
                          if (askNotchPhase === 'idle' && !activeHoldModeRef.current) {
                            startLiveVoiceAsk();
                          }
                        }}
                        style={{
                          height: '42px',
                          borderRadius: '999px',
                          border:
                            askNotchPhase === 'speaking'
                              ? '1px solid rgba(255, 255, 255, 0.65)'
                              : '1px solid rgba(255, 255, 255, 0.45)',
                          background:
                            askNotchPhase === 'speaking'
                              ? 'linear-gradient(180deg, #BAE6FD 0%, #38BDF8 100%)'
                              : 'linear-gradient(180deg, #BAE6FD 0%, #7DD3FC 100%)',
                          color: '#0A1120',
                          fontWeight: 700,
                          fontSize: '13px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          cursor: 'pointer',
                          boxShadow:
                            askNotchPhase === 'speaking'
                              ? 'inset 0 1px 1px #FFFFFF, 0 0 18px rgba(56, 189, 248, 0.65)'
                              : 'inset 0 1px 1.5px rgba(255, 255, 255, 0.85), 0 3px 12px rgba(56, 189, 248, 0.3)',
                          transition: 'all 0.16s ease',
                        }}
                      >
                        <SvgIcon name="mic" size={14} color="#0A1120" />
                        <span>
                          {askNotchPhase === 'speaking'
                            ? 'Listening... Release to send'
                            : `Hold ${customShortcuts.ask} to talk`}
                        </span>
                      </button>

                      <div
                        style={{
                          height: '42px',
                          borderRadius: '999px',
                          background: '#1C1D22',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          display: 'flex',
                          alignItems: 'center',
                          padding: '0 16px',
                          gap: '8px',
                        }}
                      >
                        <input
                          type="text"
                          value={chatInputText}
                          onChange={(e) => setChatInputText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && chatInputText.trim()) {
                              const q = chatInputText.trim();
                              setChatInputText('');
                              setUserBubbleText(q);
                              executeVoiceCommand(q);
                            }
                          }}
                          placeholder="Ask Kibo..."
                          style={{
                            flex: 1,
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            color: '#F8FAFC',
                            fontSize: '13px',
                            fontWeight: 500,
                            fontFamily: 'inherit',
                          }}
                        />
                        {chatInputText.trim() && (
                          <button
                            type="button"
                            onClick={() => {
                              const q = chatInputText.trim();
                              if (!q) return;
                              setChatInputText('');
                              setUserBubbleText(q);
                              executeVoiceCommand(q);
                            }}
                            style={{
                              background: '#38BDF8',
                              color: '#09111E',
                              border: 'none',
                              borderRadius: '999px',
                              width: '24px',
                              height: '24px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              fontWeight: 800,
                              fontSize: '12px',
                            }}
                          >
                            →
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* =========================================================
                    TAB 2: CONVERT (Non-Destructive Universal File Converter)
                    ========================================================= */}
                {activeTab === 'Convert' && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.15fr 0.85fr',
                      gap: '14px',
                      flex: 1,
                      minHeight: 0,
                      width: '100%',
                    }}
                  >
                    {/* Left Column: Dropzone + Target Format Matrix */}
                    <div
                      className="companion-glass-card"
                      style={{
                        padding: '15px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '10px',
                        minWidth: 0,
                        overflow: 'hidden',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <SvgIcon name="convert" size={15} color="#38BDF8" />
                          <span style={{ fontSize: '13.5px', fontWeight: 800, color: '#FFFFFF' }}>
                            Universal File Converter
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '999px',
                            background: 'rgba(16, 185, 129, 0.14)',
                            color: '#34D399',
                            border: '1px solid rgba(16, 185, 129, 0.28)',
                          }}
                        >
                          Original File Safe
                        </span>
                      </div>

                      {/* Drag & Drop or Browse Box */}
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsConvertDragOver(true);
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsConvertDragOver(false);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsConvertDragOver(false);
                          const f = e.dataTransfer?.files?.[0];
                          if (f) {
                            ingestDroppedFileForConvert(f);
                          }
                        }}
                        onClick={async () => {
                          if (!window.kiboAPI?.pickFileForConvert) return;
                          isNativeDialogOpenRef.current = true;
                          try {
                            const picked = await window.kiboAPI.pickFileForConvert();
                            if (picked?.success && picked.filePath) {
                              const ext = (picked.ext || '').toLowerCase();
                              setConvertSourceFile({
                                filePath: picked.filePath,
                                fileName: picked.fileName || picked.filePath.split(/[\\/]/).pop() || 'File',
                                ext,
                                sizeBytes: picked.sizeBytes,
                              });
                              if (ext === 'pdf') setConvertTargetFormat('docx');
                              else if (ext === 'docx' || ext === 'doc') setConvertTargetFormat('pdf');
                              else if (ext === 'csv') setConvertTargetFormat('json');
                              else if (ext === 'json') setConvertTargetFormat('csv');
                              else if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) setConvertTargetFormat('pdf');
                              setConvertStatusMsg(null);
                            }
                          } finally {
                            setTimeout(() => {
                              isNativeDialogOpenRef.current = false;
                            }, 350);
                          }
                        }}
                        style={{
                          position: 'relative',
                          border: isConvertDragOver
                            ? '1.5px dashed #38BDF8'
                            : convertSourceFile
                            ? '1.5px solid rgba(56, 189, 248, 0.45)'
                            : '1.5px dashed rgba(255, 255, 255, 0.16)',
                          borderRadius: '14px',
                          background: isConvertDragOver
                            ? 'rgba(56, 189, 248, 0.1)'
                            : 'rgba(255, 255, 255, 0.025)',
                          padding: '16px 32px 16px 14px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          cursor: 'pointer',
                          textAlign: 'center',
                          transition: 'all 0.18s ease',
                          minHeight: '96px',
                        }}
                      >
                        {convertSourceFile && (
                          <button
                            type="button"
                            title="Clear selected file"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConvertSourceFile(null);
                              setConvertStatusMsg(null);
                              soundFX.playToggle(false);
                            }}
                            style={{
                              position: 'absolute',
                              top: '8px',
                              right: '8px',
                              width: '22px',
                              height: '22px',
                              borderRadius: '999px',
                              border: '1px solid rgba(255, 255, 255, 0.14)',
                              background: 'rgba(255, 255, 255, 0.08)',
                              color: '#E2E8F0',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: 800,
                              lineHeight: 1,
                              padding: 0,
                              transition: 'all 0.14s ease',
                            }}
                          >
                            ×
                          </button>
                        )}
                        <SvgIcon
                          name={convertSourceFile ? 'file' : 'upload'}
                          size={22}
                          color={convertSourceFile ? '#38BDF8' : '#94A3B8'}
                        />
                        {convertSourceFile ? (
                          <>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#FFFFFF', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {convertSourceFile.fileName}
                            </div>
                            <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                              Source: .{(convertSourceFile.ext || 'file').toUpperCase()} · Click or drop another file to change
                            </div>
                          </>
                        ) : (
                          <>
                            <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#E2E8F0' }}>
                              Drop any file here or click to browse
                            </div>
                            <div style={{ fontSize: '11px', color: '#71717A' }}>
                              PDF ↔ Word (.docx) · Markdown · HTML · CSV ↔ JSON · PNG / JPG / WEBP
                            </div>
                          </>
                        )}
                      </div>

                      {/* Target Format Selector */}
                      <div>
                        <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#94A3B8', marginBottom: '6px', letterSpacing: '0.04em' }}>
                          CONVERT TO FORMAT
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                          {(
                            [
                              { id: 'docx', label: 'Word (.docx)' },
                              { id: 'pdf', label: 'PDF (.pdf)' },
                              { id: 'txt', label: 'Text (.txt)' },
                              { id: 'md', label: 'Markdown (.md)' },
                              { id: 'html', label: 'HTML (.html)' },
                              { id: 'json', label: 'JSON (.json)' },
                              { id: 'csv', label: 'CSV (.csv)' },
                              { id: 'png', label: 'PNG' },
                              { id: 'jpg', label: 'JPG' },
                              { id: 'webp', label: 'WEBP' },
                            ] as const
                          ).map((fmt) => {
                            const isSelected = convertTargetFormat === fmt.id;
                            return (
                              <button
                                key={fmt.id}
                                type="button"
                                onClick={() => setConvertTargetFormat(fmt.id)}
                                style={{
                                  padding: '5px 10px',
                                  borderRadius: '8px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  border: isSelected
                                    ? '1px solid #38BDF8'
                                    : '1px solid rgba(255, 255, 255, 0.08)',
                                  background: isSelected
                                    ? 'rgba(56, 189, 248, 0.2)'
                                    : 'rgba(255, 255, 255, 0.04)',
                                  color: isSelected ? '#FFFFFF' : '#A1A1AA',
                                  transition: 'all 0.14s ease',
                                }}
                              >
                                {fmt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Convert Action Button + Status */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <button
                          type="button"
                          disabled={!convertSourceFile || isConvertingFile}
                          onClick={() => {
                            if (!convertSourceFile) return;
                            handleRunFileConversion({
                              filePath: convertSourceFile.filePath,
                              targetFormat: convertTargetFormat,
                            });
                          }}
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            borderRadius: '10px',
                            border: convertSourceFile ? '1px solid rgba(56, 189, 248, 0.45)' : '1px solid rgba(255, 255, 255, 0.06)',
                            background: convertSourceFile
                              ? '#38BDF8'
                              : 'rgba(255, 255, 255, 0.06)',
                            color: convertSourceFile ? '#09111E' : '#71717A',
                            fontWeight: 800,
                            fontSize: '12.5px',
                            cursor: convertSourceFile ? 'pointer' : 'not-allowed',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                          }}
                        >
                          <SvgIcon name="convert" size={14} color={convertSourceFile ? '#09111E' : '#71717A'} />
                          <span>
                            {isConvertingFile
                              ? 'Converting...'
                              : convertSourceFile
                              ? `Convert to .${convertTargetFormat.toUpperCase()} (Keep Original)`
                              : 'Select or Drop a File Above'}
                          </span>
                        </button>

                        {convertStatusMsg && (
                          <div
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              color:
                                convertStatusMsg.type === 'ok'
                                  ? '#34D399'
                                  : convertStatusMsg.type === 'err'
                                  ? '#F87171'
                                  : '#BAE6FD',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '8px',
                            }}
                          >
                            <span className="companion-truncate">{convertStatusMsg.text}</span>
                            {convertStatusMsg.outputPath && (
                              <button
                                type="button"
                                onClick={() => window.kiboAPI?.showItemInFolder?.(convertStatusMsg.outputPath!)}
                                style={{
                                  background: 'rgba(56, 189, 248, 0.16)',
                                  border: '1px solid rgba(56, 189, 248, 0.35)',
                                  color: '#BAE6FD',
                                  borderRadius: '6px',
                                  padding: '2px 8px',
                                  fontSize: '10.5px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  flexShrink: 0,
                                }}
                              >
                                Reveal File
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Column: Voice Conversion Tip + Recent Conversions */}
                    <div
                      className="companion-glass-card"
                      style={{
                        padding: '15px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        minHeight: 0,
                        minWidth: 0,
                        overflow: 'hidden',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', paddingRight: '2px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 800, color: '#FFFFFF', letterSpacing: '0.02em' }}>
                          Recent Conversions
                        </span>
                        <span className="companion-mono-tiny" style={{ color: '#94A3B8', flexShrink: 0 }}>
                          {recentConversions.length} {recentConversions.length === 1 ? 'file' : 'files'}
                        </span>
                      </div>

                      <div
                        style={{
                          padding: '9px 11px',
                          borderRadius: '10px',
                          background: 'rgba(56, 189, 248, 0.08)',
                          border: '1px solid rgba(56, 189, 248, 0.2)',
                          fontSize: '11px',
                          color: '#BAE6FD',
                          lineHeight: 1.4,
                        }}
                      >
                        <strong>Voice Command:</strong> Say{' '}
                        <em>"Convert my report.pdf to Word"</em> or{' '}
                        <em>"Convert notes.docx to PDF"</em> :  Kibo locates the file and creates the converted copy alongside it.
                      </div>

                      <div
                        style={{
                          flex: 1,
                          minHeight: 0,
                          overflowY: 'auto',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                        }}
                      >
                        {recentConversions.length === 0 ? (
                          <div
                            style={{
                              flex: 1,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#71717A',
                              fontSize: '11.5px',
                              textAlign: 'center',
                            }}
                          >
                            No converted files yet.
                          </div>
                        ) : (
                          recentConversions.map((item) => (
                            <div
                              key={item.id}
                              style={{
                                padding: '8px 10px',
                                borderRadius: '10px',
                                background: 'rgba(255, 255, 255, 0.04)',
                                border: '1px solid rgba(255, 255, 255, 0.06)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '8px',
                              }}
                            >
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div className="companion-truncate" style={{ fontSize: '12px', fontWeight: 700, color: '#FFFFFF' }}>
                                  {item.outputFileName}
                                </div>
                                <div className="companion-truncate" style={{ fontSize: '10.5px', color: '#94A3B8' }}>
                                  From {item.sourceName} · {item.timestamp}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => window.kiboAPI?.showItemInFolder?.(item.outputPath)}
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: '7px',
                                  background: 'rgba(255, 255, 255, 0.07)',
                                  border: '1px solid rgba(255, 255, 255, 0.1)',
                                  color: '#E2E8F0',
                                  fontSize: '10.5px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  flexShrink: 0,
                                }}
                              >
                                Folder
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* =========================================================
                    TAB 3: FOCUS (Focus Timer + Stopwatch + Kibo Dance Celebration)
                    ========================================================= */}
                {activeTab === 'Focus' && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 1fr)',
                      gap: '14px',
                      flex: 1,
                      minHeight: 0,
                      minWidth: 0,
                      width: '100%',
                    }}
                  >
                    {/* Left Card: Focus Timer OR Precision Stopwatch */}
                    <div
                      className="companion-glass-card"
                      style={{
                        padding: '16px 20px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => setFocusSubMode('timer')}
                            className={`companion-filter-pill ${focusSubMode === 'timer' ? 'active' : ''}`}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                          >
                            <SvgIcon name="timer" size={12} />
                            <span>Focus Timer</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setFocusSubMode('stopwatch')}
                            className={`companion-filter-pill ${focusSubMode === 'stopwatch' ? 'active' : ''}`}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                          >
                            <SvgIcon name="stopwatch" size={12} />
                            <span>Stopwatch</span>
                          </button>
                        </div>

                        <span className="companion-mono-tiny" style={{ color: isTimerRunning || stopwatchRunning ? '#38BDF8' : '#71717A' }}>
                          {focusSubMode === 'timer'
                            ? isTimerRunning
                              ? 'Focus active'
                              : timerAlarmRinging
                              ? 'Completed!'
                              : 'Ready'
                            : stopwatchRunning
                            ? 'Counting'
                            : 'Ready'}
                        </span>
                      </div>

                      {focusSubMode === 'timer' ? (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px', margin: '4px 0' }}>
                            <div style={{ position: 'relative', width: '112px', height: '112px', flexShrink: 0 }}>
                              <svg width={112} height={112} style={{ transform: 'rotate(-90deg)' }}>
                                <circle
                                  cx={56}
                                  cy={56}
                                  r={48}
                                  stroke="rgba(255, 255, 255, 0.08)"
                                  strokeWidth={6}
                                  fill="transparent"
                                />
                                <circle
                                  cx={56}
                                  cy={56}
                                  r={48}
                                  stroke="var(--adaptive-accent, #38BDF8)"
                                  strokeWidth={6}
                                  strokeDasharray={2 * Math.PI * 48}
                                  strokeDashoffset={2 * Math.PI * 48 * (1 - (timerTotalSeconds > 0 ? timerSeconds / timerTotalSeconds : 0))}
                                  strokeLinecap="round"
                                  fill="transparent"
                                  style={{ transition: 'stroke-dashoffset 0.5s linear' }}
                                />
                              </svg>
                              <div className="companion-timer-readout" style={{ fontSize: '22px', fontWeight: 800 }}>
                                {String(Math.floor(timerSeconds / 60)).padStart(2, '0')}:
                                {String(timerSeconds % 60).padStart(2, '0')}
                              </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '5px' }}>
                                {(['1m', '5m', '15m', '25m', '45m'] as const).map((p) => {
                                  const isActive = timerPreset === p;
                                  return (
                                    <button
                                      key={p}
                                      onClick={() => {
                                        setTimerPreset(p);
                                        const secs = parseInt(p, 10) * 60;
                                        setTimerSeconds(secs);
                                        setTimerTotalSeconds(secs);
                                        setIsTimerRunning(false);
                                        setIsTimerSessionActive(false);
                                        setTimerAlarmRinging(false);
                                      }}
                                      className={`companion-preset-chip ${isActive ? 'active' : ''}`}
                                      style={{ padding: '5px 0', fontSize: '11px', textAlign: 'center' }}
                                    >
                                      {p}
                                    </button>
                                  );
                                })}
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                <button
                                  onClick={() => {
                                    if (isTimerRunning) {
                                      setIsTimerRunning(false);
                                      soundFX.playToggle(false);
                                    } else {
                                      setTimerAlarmRinging(false);
                                      setIsKiboDancing(false);
                                      setIsTimerSessionActive(true);
                                      setIsTimerRunning(true);
                                      soundFX.playToggle(true);
                                    }
                                  }}
                                  className="timer-start-btn"
                                  style={{ padding: '9px 0', fontSize: '12.5px' }}
                                >
                                  {isTimerRunning ? 'Stop' : isTimerSessionActive ? 'Resume' : 'Start Focus'}
                                </button>
                                <button
                                  onClick={() => {
                                    setIsTimerRunning(false);
                                    setIsTimerSessionActive(false);
                                    setTimerAlarmRinging(false);
                                    setIsKiboDancing(false);
                                    setSoulMode('LISTENING');
                                    setTimerSeconds(timerTotalSeconds);
                                  }}
                                  className="timer-reset-btn"
                                  style={{ padding: '9px 0', fontSize: '12.5px' }}
                                >
                                  Reset
                                </button>
                              </div>
                            </div>
                          </div>

                          <div style={{ fontSize: '11px', color: '#94A3B8', textAlign: 'center' }}>
                            When the timer stops or completes, Kibo celebrates with a victory dance and +5 Sparks.
                          </div>
                        </>
                      ) : (
                        <>
                          {/* Stopwatch View */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', margin: '4px 0' }}>
                            <div
                              style={{
                                fontSize: '36px',
                                fontWeight: 800,
                                color: '#FFFFFF',
                                fontVariantNumeric: 'tabular-nums',
                                letterSpacing: '-0.02em',
                              }}
                            >
                              {String(Math.floor(stopwatchMs / 60000)).padStart(2, '0')}:
                              {String(Math.floor((stopwatchMs % 60000) / 1000)).padStart(2, '0')}.
                              <span style={{ fontSize: '22px', color: '#38BDF8' }}>
                                {String(Math.floor((stopwatchMs % 1000) / 10)).padStart(2, '0')}
                              </span>
                            </div>

                            <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  if (stopwatchRunning) {
                                    setStopwatchRunning(false);
                                    if (stopwatchMs > 1000) triggerKiboCelebrationDance(4500);
                                  } else {
                                    setStopwatchRunning(true);
                                  }
                                }}
                                className="timer-start-btn"
                                style={{ flex: 1, padding: '9px 0', fontSize: '12.5px' }}
                              >
                                {stopwatchRunning ? 'Stop' : stopwatchMs > 0 ? 'Resume' : 'Start'}
                              </button>
                              <button
                                type="button"
                                disabled={!stopwatchRunning && stopwatchMs === 0}
                                onClick={() => {
                                  if (stopwatchRunning) {
                                    setStopwatchLaps((prev) => [stopwatchMs, ...prev]);
                                  } else {
                                    setStopwatchMs(0);
                                    setStopwatchLaps([]);
                                  }
                                }}
                                className="timer-reset-btn"
                                style={{ flex: 1, padding: '9px 0', fontSize: '12.5px' }}
                              >
                                {stopwatchRunning ? 'Lap' : 'Reset'}
                              </button>
                            </div>

                            {stopwatchLaps.length > 0 && (
                              <div
                                style={{
                                  width: '100%',
                                  maxHeight: '76px',
                                  overflowY: 'auto',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '4px',
                                  padding: '4px 6px',
                                  background: 'rgba(255,255,255,0.03)',
                                  borderRadius: '8px',
                                }}
                              >
                                {stopwatchLaps.map((lapMs, idx) => (
                                  <div
                                    key={idx}
                                    style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      fontSize: '11px',
                                      color: '#D4D4D8',
                                    }}
                                  >
                                    <span>Lap {stopwatchLaps.length - idx}</span>
                                    <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                                      {String(Math.floor(lapMs / 60000)).padStart(2, '0')}:
                                      {String(Math.floor((lapMs % 60000) / 1000)).padStart(2, '0')}.
                                      {String(Math.floor((lapMs % 1000) / 10)).padStart(2, '0')}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Right Card: Interactive Focus Sticky Notes & Tasks Board (Tilts on hover, enlarges with paper sound on click) */}
                    <div
                      className="companion-glass-card"
                      style={{
                        padding: '15px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '10px',
                        minHeight: 0,
                        minWidth: 0,
                        overflow: 'hidden',
                      }}
                    >
                      {(() => {
                        const activeSticky = stickyNotes.find((n) => n.id === expandedStickyId) || null;
                        if (activeSticky) {
                          return (
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '10px',
                                flex: 1,
                                minHeight: 0,
                                background: activeSticky.bgTint,
                                border: `1px solid ${activeSticky.borderTint}`,
                                borderRadius: '14px',
                                padding: '14px',
                                position: 'relative',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flex: 1, minWidth: 0 }}>
                                  <span
                                    style={{
                                      width: '9px',
                                      height: '9px',
                                      borderRadius: '999px',
                                      background: activeSticky.accent,
                                      flexShrink: 0,
                                    }}
                                  />
                                  <input
                                    type="text"
                                    value={activeSticky.title}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      updateStickyNotes((prev) =>
                                        prev.map((n) => (n.id === activeSticky.id ? { ...n, title: val } : n))
                                      );
                                    }}
                                    style={{
                                      background: 'transparent',
                                      border: 'none',
                                      outline: 'none',
                                      color: '#FFFFFF',
                                      fontSize: '13.5px',
                                      fontWeight: 800,
                                      width: '100%',
                                    }}
                                    placeholder="Sticky Note Title..."
                                  />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      updateStickyNotes((prev) => prev.filter((n) => n.id !== activeSticky.id));
                                      soundFX.playPaperRustle(false);
                                      setExpandedStickyId(null);
                                    }}
                                    title="Delete Sticky Note"
                                    style={{
                                      padding: '4px 9px',
                                      borderRadius: '8px',
                                      background: 'rgba(239, 68, 68, 0.14)',
                                      border: '1px solid rgba(239, 68, 68, 0.34)',
                                      color: '#FCA5A5',
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    Delete
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      soundFX.playPaperRustle(false);
                                      setExpandedStickyId(null);
                                    }}
                                    style={{
                                      padding: '4px 10px',
                                      borderRadius: '8px',
                                      background: 'rgba(255, 255, 255, 0.08)',
                                      border: '1px solid rgba(255, 255, 255, 0.14)',
                                      color: '#F8FAFC',
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      flexShrink: 0,
                                    }}
                                  >
                                    ← All Notes
                                  </button>
                                </div>
                              </div>

                              <textarea
                                value={activeSticky.body}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  updateStickyNotes((prev) =>
                                    prev.map((n) => (n.id === activeSticky.id ? { ...n, body: val } : n))
                                  );
                                }}
                                placeholder="Write quick thoughts, session goals, or reminders..."
                                style={{
                                  width: '100%',
                                  minHeight: '78px',
                                  resize: 'none',
                                  background: 'rgba(0, 0, 0, 0.22)',
                                  border: '1px solid rgba(255, 255, 255, 0.08)',
                                  borderRadius: '10px',
                                  padding: '9px 11px',
                                  color: '#E2E8F0',
                                  fontSize: '12px',
                                  lineHeight: 1.48,
                                  fontFamily: 'inherit',
                                  outline: 'none',
                                }}
                              />

                              {/* Checklist inside enlarged sticky note */}
                              <div
                                style={{
                                  flex: 1,
                                  minHeight: 0,
                                  overflowY: 'auto',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '5px',
                                }}
                              >
                                {activeSticky.tasks.map((task) => (
                                  <div
                                    key={task.id}
                                    onClick={() => {
                                      updateStickyNotes((prev) =>
                                        prev.map((n) =>
                                          n.id === activeSticky.id
                                            ? {
                                                ...n,
                                                tasks: n.tasks.map((t) =>
                                                  t.id === task.id ? { ...t, done: !t.done } : t
                                                ),
                                              }
                                            : n
                                        )
                                      );
                                      soundFX.playToggle(!task.done);
                                    }}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      gap: '8px',
                                      padding: '6px 9px',
                                      borderRadius: '8px',
                                      background: 'rgba(255, 255, 255, 0.04)',
                                      border: '1px solid rgba(255, 255, 255, 0.06)',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                                      <span
                                        style={{
                                          width: '14px',
                                          height: '14px',
                                          borderRadius: '4px',
                                          border: task.done
                                            ? `1px solid ${activeSticky.accent}`
                                            : '1px solid rgba(255,255,255,0.28)',
                                          background: task.done ? activeSticky.accent : 'transparent',
                                          color: '#09111E',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          fontSize: '10px',
                                          fontWeight: 900,
                                          flexShrink: 0,
                                        }}
                                      >
                                        {task.done ? '✓' : ''}
                                      </span>
                                      <span
                                        className="companion-truncate"
                                        style={{
                                          fontSize: '11.5px',
                                          color: task.done ? '#71717A' : '#F8FAFC',
                                          textDecoration: task.done ? 'line-through' : 'none',
                                        }}
                                      >
                                        {task.text}
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        updateStickyNotes((prev) =>
                                          prev.map((n) =>
                                            n.id === activeSticky.id
                                              ? { ...n, tasks: n.tasks.filter((t) => t.id !== task.id) }
                                              : n
                                          )
                                        );
                                      }}
                                      style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#71717A',
                                        cursor: 'pointer',
                                        fontSize: '12px',
                                        padding: '0 2px',
                                      }}
                                    >
                                      ×
                                    </button>
                                  </div>
                                ))}
                              </div>

                              <div style={{ display: 'flex', gap: '6px' }}>
                                <input
                                  type="text"
                                  value={newStickyTaskInput}
                                  onChange={(e) => setNewStickyTaskInput(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && newStickyTaskInput.trim()) {
                                      const text = newStickyTaskInput.trim();
                                      updateStickyNotes((prev) =>
                                        prev.map((n) =>
                                          n.id === activeSticky.id
                                            ? {
                                                ...n,
                                                tasks: [...n.tasks, { id: `st_${Date.now()}`, text, done: false }],
                                              }
                                            : n
                                        )
                                      );
                                      setNewStickyTaskInput('');
                                      soundFX.playClick();
                                    }
                                  }}
                                  placeholder="Add checklist item + Enter..."
                                  style={{
                                    flex: 1,
                                    background: 'rgba(0, 0, 0, 0.28)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    borderRadius: '8px',
                                    padding: '6px 10px',
                                    color: '#FFFFFF',
                                    fontSize: '11.5px',
                                    outline: 'none',
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!newStickyTaskInput.trim()) return;
                                    const text = newStickyTaskInput.trim();
                                    updateStickyNotes((prev) =>
                                      prev.map((n) =>
                                        n.id === activeSticky.id
                                          ? {
                                              ...n,
                                              tasks: [...n.tasks, { id: `st_${Date.now()}`, text, done: false }],
                                            }
                                          : n
                                      )
                                    );
                                    setNewStickyTaskInput('');
                                    soundFX.playClick();
                                  }}
                                  style={{
                                    padding: '6px 12px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: activeSticky.accent,
                                    color: '#09111E',
                                    fontWeight: 800,
                                    fontSize: '11.5px',
                                    cursor: 'pointer',
                                  }}
                                >
                                  Add
                                </button>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                                <SvgIcon name="note" size={14} color="#FACC15" />
                                <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#FFFFFF' }}>
                                  Focus Sticky Notes
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const palette = [
                                    { accent: '#FACC15', bgTint: 'rgba(250, 204, 21, 0.08)', borderTint: 'rgba(250, 204, 21, 0.28)' },
                                    { accent: '#38BDF8', bgTint: 'rgba(56, 189, 248, 0.08)', borderTint: 'rgba(56, 189, 248, 0.28)' },
                                    { accent: '#FF6B9D', bgTint: 'rgba(255, 107, 157, 0.08)', borderTint: 'rgba(255, 107, 157, 0.28)' },
                                    { accent: '#10B981', bgTint: 'rgba(16, 185, 129, 0.08)', borderTint: 'rgba(16, 185, 129, 0.28)' },
                                  ];
                                  const pick = palette[stickyNotes.length % palette.length];
                                  const newId = `note_${Date.now()}`;
                                  updateStickyNotes((prev) => [
                                    {
                                      id: newId,
                                      title: `Note ${prev.length + 1}`,
                                      ...pick,
                                      body: '',
                                      tasks: [],
                                    },
                                    ...prev,
                                  ]);
                                  soundFX.playPaperRustle(true);
                                  setExpandedStickyId(newId);
                                }}
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: '8px',
                                  background: 'rgba(250, 204, 21, 0.14)',
                                  border: '1px solid rgba(250, 204, 21, 0.32)',
                                  color: '#FEF08A',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                + New Sticky
                              </button>
                            </div>

                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                                gridAutoRows: 'max-content',
                                gap: '9px',
                                flex: 1,
                                minHeight: 0,
                                minWidth: 0,
                                width: '100%',
                                overflowY: 'auto',
                                overflowX: 'hidden',
                                padding: '4px 3px',
                                boxSizing: 'border-box',
                              }}
                            >
                              {stickyNotes.map((note, idx) => {
                                const isNoteHovered = hoveredStickyId === note.id;
                                const tiltDeg = idx % 2 === 0 ? -1.4 : 1.4;
                                const doneCount = note.tasks.filter((t) => t.done).length;
                                return (
                                  <div
                                    key={note.id}
                                    onMouseEnter={() => setHoveredStickyId(note.id)}
                                    onMouseLeave={() => setHoveredStickyId((curr) => (curr === note.id ? null : curr))}
                                    onClick={() => {
                                      soundFX.playPaperRustle(true);
                                      setExpandedStickyId(note.id);
                                    }}
                                    style={{
                                      background: note.bgTint,
                                      border: `1px solid ${note.borderTint}`,
                                      borderRadius: '12px',
                                      padding: '10px 11px',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      justifyContent: 'space-between',
                                      gap: '6px',
                                      cursor: 'pointer',
                                      position: 'relative',
                                      minWidth: 0,
                                      maxWidth: '100%',
                                      overflow: 'hidden',
                                      boxSizing: 'border-box',
                                      transform: isNoteHovered
                                        ? `translateY(-2px) rotate(${tiltDeg}deg)`
                                        : 'translateY(0) rotate(0deg)',
                                      boxShadow: isNoteHovered
                                        ? '0 10px 22px rgba(0, 0, 0, 0.34)'
                                        : '0 4px 10px rgba(0, 0, 0, 0.16)',
                                      transition: 'transform 0.22s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.22s ease',
                                    }}
                                  >
                                    <div style={{ minWidth: 0 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', marginBottom: '4px', minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0, flex: 1 }}>
                                          <span
                                            style={{
                                              width: '6.5px',
                                              height: '6.5px',
                                              borderRadius: '999px',
                                              background: note.accent,
                                              flexShrink: 0,
                                            }}
                                          />
                                          <span
                                            className="companion-truncate"
                                            style={{ fontSize: '11.5px', fontWeight: 800, color: '#FFFFFF', minWidth: 0 }}
                                          >
                                            {note.title}
                                          </span>
                                        </div>
                                        <button
                                          type="button"
                                          title="Delete sticky note"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            updateStickyNotes((prev) => prev.filter((n) => n.id !== note.id));
                                            if (expandedStickyId === note.id) setExpandedStickyId(null);
                                            soundFX.playPaperRustle(false);
                                          }}
                                          style={{
                                            width: '18px',
                                            height: '18px',
                                            borderRadius: '6px',
                                            background: 'rgba(255, 255, 255, 0.07)',
                                            border: '1px solid rgba(255, 255, 255, 0.12)',
                                            color: '#CBD5E1',
                                            fontSize: '12px',
                                            lineHeight: 1,
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            cursor: 'pointer',
                                            flexShrink: 0,
                                            padding: 0,
                                          }}
                                        >
                                          ×
                                        </button>
                                      </div>
                                      <div
                                        style={{
                                          fontSize: '10.5px',
                                          color: '#CBD5E1',
                                          lineHeight: 1.38,
                                          display: '-webkit-box',
                                          WebkitLineClamp: 3,
                                          WebkitBoxOrient: 'vertical',
                                          overflow: 'hidden',
                                          wordBreak: 'break-word',
                                        }}
                                      >
                                        {note.body || (note.tasks[0]?.text ? `• ${note.tasks[0].text}` : 'Click to open note & tasks...')}
                                      </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '9.5px', color: '#94A3B8', minWidth: 0 }}>
                                      <span className="companion-truncate">
                                        {note.tasks.length > 0 ? `${doneCount}/${note.tasks.length} tasks` : 'Sticky Note'}
                                      </span>
                                      <span style={{ color: note.accent, fontWeight: 700, flexShrink: 0 }}>Expand ↗</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* =========================================================
                    TAB 4: SKILLS (SKILL.md Modular Capability Manager)
                    ========================================================= */}
                {activeTab === 'Skills' && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      flex: 1,
                      minHeight: 0,
                      width: '100%',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '7px' }}>
                          <SvgIcon name="skill" size={14} color="#38BDF8" />
                          <span>Equipped Skills (SKILL.md)</span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                          Active skills are automatically injected into Kibo when building websites, converting files, or executing tasks.
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          ref={skillFileInputRef}
                          type="file"
                          accept=".md,.markdown,.txt"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            const reader = new FileReader();
                            reader.onload = () => {
                              const content = String(reader.result || '');
                              if (content.trim()) {
                                const baseName = f.name.replace(/\.(md|markdown|txt)$/i, '');
                                const newSkill: KiboSkillItem = {
                                  id: `skill_${Date.now()}`,
                                  name: `${baseName} (SKILL.md)`,
                                  description: 'Imported custom SKILL.md instruction pack.',
                                  content,
                                  enabled: true,
                                };
                                updateSkillsList((prev) => [newSkill, ...prev]);
                                soundFX.playTaskSuccess();
                              }
                            };
                            reader.readAsText(f);
                            e.target.value = '';
                          }}
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            if (window.kiboAPI?.pickSkillMdFile) {
                              isNativeDialogOpenRef.current = true;
                              try {
                                const picked = await window.kiboAPI.pickSkillMdFile();
                                if (picked?.success && picked.content) {
                                  const newSkill: KiboSkillItem = {
                                    id: `skill_${Date.now()}`,
                                    name: `${picked.name || 'custom-skill'} (SKILL.md)`,
                                    description: picked.description || 'Imported custom SKILL.md instruction pack.',
                                    content: picked.content,
                                    enabled: true,
                                  };
                                  updateSkillsList((prev) => [newSkill, ...prev]);
                                  soundFX.playTaskSuccess();
                                }
                              } finally {
                                setTimeout(() => {
                                  isNativeDialogOpenRef.current = false;
                                }, 350);
                              }
                            } else {
                              skillFileInputRef.current?.click();
                            }
                          }}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '9px',
                            background: 'rgba(56, 189, 248, 0.14)',
                            border: '1px solid rgba(56, 189, 248, 0.32)',
                            color: '#BAE6FD',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <SvgIcon name="upload" size={12} color="#38BDF8" />
                          <span>Import SKILL.md</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsAddingSkill((v) => !v)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '9px',
                            background: 'rgba(255, 255, 255, 0.07)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            color: '#FFFFFF',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {isAddingSkill ? 'Cancel' : '+ New Skill'}
                        </button>
                      </div>
                    </div>

                    {isAddingSkill && (
                      <div
                        className="companion-glass-card"
                        style={{
                          padding: '12px 14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                        }}
                      >
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '8px' }}>
                          <input
                            type="text"
                            placeholder="Skill name (e.g. gsap-motion-taste)"
                            value={newSkillName}
                            onChange={(e) => setNewSkillName(e.target.value)}
                            style={{
                              background: '#141519',
                              border: '1px solid rgba(255,255,255,0.12)',
                              borderRadius: '8px',
                              padding: '7px 10px',
                              color: '#FFFFFF',
                              fontSize: '12px',
                            }}
                          />
                          <input
                            type="text"
                            placeholder="Short description of when Kibo should use this skill..."
                            value={newSkillDesc}
                            onChange={(e) => setNewSkillDesc(e.target.value)}
                            style={{
                              background: '#141519',
                              border: '1px solid rgba(255,255,255,0.12)',
                              borderRadius: '8px',
                              padding: '7px 10px',
                              color: '#FFFFFF',
                              fontSize: '12px',
                            }}
                          />
                        </div>
                        <textarea
                          rows={3}
                          placeholder="Paste SKILL.md rules, design tokens, or coding instructions..."
                          value={newSkillContent}
                          onChange={(e) => setNewSkillContent(e.target.value)}
                          style={{
                            background: '#141519',
                            border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: '8px',
                            padding: '8px 10px',
                            color: '#FFFFFF',
                            fontSize: '11.5px',
                            fontFamily: 'var(--kibo-font-mono)',
                            resize: 'none',
                          }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            onClick={() => {
                              if (!newSkillName.trim() || !newSkillContent.trim()) return;
                              const created: KiboSkillItem = {
                                id: `skill_${Date.now()}`,
                                name: newSkillName.trim().endsWith('(SKILL.md)')
                                  ? newSkillName.trim()
                                  : `${newSkillName.trim()} (SKILL.md)`,
                                description: newSkillDesc.trim() || 'Custom user skill module.',
                                content: newSkillContent.trim(),
                                enabled: true,
                              };
                              updateSkillsList((prev) => [created, ...prev]);
                              setNewSkillName('');
                              setNewSkillDesc('');
                              setNewSkillContent('');
                              setIsAddingSkill(false);
                              soundFX.playTaskSuccess();
                            }}
                            style={{
                              padding: '6px 14px',
                              borderRadius: '8px',
                              background: '#38BDF8',
                              color: '#09111E',
                              border: 'none',
                              fontWeight: 800,
                              fontSize: '12px',
                              cursor: 'pointer',
                            }}
                          >
                            Save & Equip Skill
                          </button>
                        </div>
                      </div>
                    )}

                    <div
                      style={{
                        flex: 1,
                        minHeight: 0,
                        overflowY: 'auto',
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '10px',
                        paddingRight: '4px',
                      }}
                    >
                      {skillsList.map((sk) => (
                        <div
                          key={sk.id}
                          style={{
                            padding: '12px 14px',
                            borderRadius: '13px',
                            background: sk.enabled ? 'rgba(56, 189, 248, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                            border: sk.enabled
                              ? '1px solid rgba(56, 189, 248, 0.32)'
                              : '1px solid rgba(255, 255, 255, 0.07)',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            gap: '8px',
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                              <span className="companion-truncate" style={{ fontSize: '12.5px', fontWeight: 800, color: '#FFFFFF' }}>
                                {sk.name}
                              </span>
                              <button
                                type="button"
                                className={`kibo-switch ${sk.enabled ? 'is-on' : ''}`}
                                onClick={() => {
                                  updateSkillsList((prev) =>
                                    prev.map((item) => (item.id === sk.id ? { ...item, enabled: !item.enabled } : item))
                                  );
                                }}
                              >
                                <span className="kibo-switch-knob" />
                              </button>
                            </div>
                            <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px', lineHeight: 1.4 }}>
                              {sk.description}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: sk.enabled ? '#38BDF8' : '#71717A' }}>
                              {sk.enabled ? 'ACTIVE IN PROMPT' : 'DISABLED'}
                            </span>
                            {!sk.builtIn && (
                              <button
                                type="button"
                                onClick={() => updateSkillsList((prev) => prev.filter((i) => i.id !== sk.id))}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: '#F87171',
                                  fontSize: '10.5px',
                                  cursor: 'pointer',
                                }}
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* =========================================================
                    TAB 5: MEDIA (Compact Full-Notch Album Cover Glass Gradient + Single-Line Volume)
                    ========================================================= */}
                {activeTab === 'Media' && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '10px',
                      flex: 1,
                      minHeight: 0,
                      width: '100%',
                      padding: '4px 8px 4px',
                      boxSizing: 'border-box',
                    }}
                  >
                    {/* Top Row: Source Label + Live Equalizer */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span
                        style={{
                          fontSize: '10.5px',
                          fontWeight: 800,
                          color: mediaArtPalette.accent || '#BAE6FD',
                          letterSpacing: '0.06em',
                        }}
                      >
                        {hasMediaSession
                          ? (osMedia.source || 'SPOTIFY').toUpperCase()
                          : isPlayingLofi
                          ? 'KIBO SYNTH STREAM'
                          : 'MEDIA PLAYER'}
                      </span>
                      <div className="mini-media-eq-bars">
                        {[0.35, 0.7, 1.0, 0.65, 0.85, 0.5].map((h, i) => (
                          <span
                            key={i}
                            className={`mini-eq-bar ${!(isPlayingMedia || isPlayingLofi) ? 'is-paused' : ''}`}
                            style={{
                              height: isPlayingMedia || isPlayingLofi ? `${Math.round(h * 12)}px` : '4px',
                              background: mediaArtPalette.accent,
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Middle Row: Album Art + Track Metadata + Transport Controls */}
                    <div className="media-middle-row" style={{ gap: '14px', margin: '2px 0' }}>
                      <div
                        className="companion-album-art"
                        style={{
                          width: '62px',
                          height: '62px',
                          borderRadius: '14px',
                          boxShadow: `0 10px 22px rgba(0, 0, 0, 0.42), 0 0 18px rgba(${mediaArtPalette.rgb}, 0.22)`,
                          ...(activeMediaArtwork
                            ? {
                                backgroundImage: `url("${activeMediaArtwork}")`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                              }
                            : {
                                background: mediaArtPalette.gradient,
                              }),
                        }}
                      />

                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0, textAlign: 'left' }}>
                        <div className="companion-truncate" style={{ fontSize: '16px', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.015em' }}>
                          {hasMediaSession ? activeMediaTitle : isPlayingLofi ? 'Nightride Chillsynth Radio' : 'No Track Playing'}
                        </div>
                        <div className="companion-truncate" style={{ fontSize: '12px', fontWeight: 500, color: 'rgba(255, 255, 255, 0.72)' }}>
                          {hasMediaSession ? activeMediaArtist : isPlayingLofi ? 'Ambient Focus Stream' : 'Play music in Spotify, YouTube, or start Focus Stream'}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button onClick={handleMediaPrev} className="media-circle-btn">
                          <SvgIcon name="prev" size={14} color="#E4E4E7" />
                        </button>
                        <button onClick={toggleMediaPlayback} className="media-ivory-play-btn" style={{ width: '40px', height: '40px' }}>
                          <SvgIcon name={isPlayingMedia || isPlayingLofi ? 'pause' : 'play'} size={16} color="#1C1917" />
                        </button>
                        <button onClick={handleMediaNext} className="media-circle-btn">
                          <SvgIcon name="next" size={14} color="#E4E4E7" />
                        </button>
                      </div>
                    </div>

                    {/* Bottom Row: Track Scrubber + Inline Single-Line Smooth Volume Control */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '18px', width: '100%' }}>
                      <div className="media-bottom-scrub" style={{ flex: 1, margin: 0 }}>
                        <span className="companion-mono-tiny">{formatTime(mediaProgress)}</span>
                        <div
                          ref={controlsScrubRef}
                          className="companion-scrub-track"
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            if (leaveCollapseTimerRef.current) {
                              clearTimeout(leaveCollapseTimerRef.current);
                            }
                            activeScrubRef.current = controlsScrubRef.current;
                            isDraggingMediaScrubRef.current = true;
                            setIsDraggingMediaScrub(true);
                            updateMediaScrubFromClientX(e.clientX, true);
                          }}
                        >
                          <div
                            className="companion-scrub-fill adaptive"
                            style={{
                              width: `${Math.min(100, (mediaProgress / Math.max(1, totalMediaDuration)) * 100)}%`,
                              background: mediaArtPalette.accent,
                            }}
                          >
                            <div
                              className="companion-scrub-thumb adaptive"
                              style={{ background: mediaArtPalette.accent }}
                            />
                          </div>
                        </div>
                        <span className="companion-mono-tiny">{formatTime(totalMediaDuration)}</span>
                      </div>

                      {/* Single-line inline smooth volume adjuster */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          width: '148px',
                          flexShrink: 0,
                        }}
                        onWheel={(e) => {
                          const delta = e.deltaY < 0 ? 4 : -4;
                          applyUserVolumeChange(volumeLevel + delta);
                        }}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const nextMute = !isMuted;
                            setIsMuted(nextMute);
                            window.kiboAPI?.setMute?.(nextMute);
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            padding: '2px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: isMuted ? '#71717A' : '#E4E4E7',
                          }}
                          title={isMuted ? 'Unmute' : `Volume ${volumeLevel}%`}
                        >
                          <SvgIcon name={isMuted ? 'mute' : 'speaker'} size={14} color={isMuted ? '#71717A' : '#E4E4E7'} />
                        </button>

                        <div
                          ref={volumeTrackRef}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            if (leaveCollapseTimerRef.current) {
                              clearTimeout(leaveCollapseTimerRef.current);
                            }
                            isDraggingVolumeRef.current = true;
                            setIsDraggingVolume(true);
                            updateVolumeFromClientX(e.clientX);
                          }}
                          style={{
                            flex: 1,
                            height: '4px',
                            borderRadius: '999px',
                            background: 'rgba(255, 255, 255, 0.16)',
                            position: 'relative',
                            cursor: 'pointer',
                          }}
                        >
                          <div
                            style={{
                              width: `${isMuted ? 0 : Math.max(0, Math.min(100, volumeLevel))}%`,
                              height: '100%',
                              borderRadius: '999px',
                              background: mediaArtPalette.accent || '#FFFFFF',
                              position: 'relative',
                              transition: isDraggingVolume ? 'none' : 'width 0.14s cubic-bezier(0.16, 1, 0.3, 1)',
                            }}
                          >
                            <div
                              style={{
                                position: 'absolute',
                                right: '-5px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                width: '10px',
                                height: '10px',
                                borderRadius: '999px',
                                background: '#FFFFFF',
                                boxShadow: '0 1px 4px rgba(0,0,0,0.45)',
                              }}
                            />
                          </div>
                        </div>

                        <span className="companion-mono-tiny" style={{ minWidth: '28px', textAlign: 'right' }}>
                          {isMuted ? '0%' : `${volumeLevel}%`}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'Agents' && (
                  <AgentsNotchView
                    tasks={agentTasks}
                    onOpenGeneratedPage={(html, filePath) => {
                      (window as any).kiboAPI?.openGeneratedPage?.(html, filePath);
                    }}
                  />
                )}

                {/* =========================================================
                    TAB 6: APPS & INTEGRATIONS (Direct 1-Click Apps + Ecosystem)
                    ========================================================= */}
                {activeTab === 'Apps' && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      flex: 1,
                      minHeight: 0,
                      width: '100%',
                      overflowY: 'auto',
                      paddingRight: '6px',
                    }}
                  >
                    {renderIntegrationsContent()}
                  </div>
                )}

                {activeTab === 'Settings' && (
                  <div className="kibo-notch-settings-panel">
                    {/* Left Sidebar */}
                    <div className="kibo-settings-sidebar">
                      <div className="kibo-settings-nav-list">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 6px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: '8px' }}>
                          <SoulCanvas soul={currentSoul} width={28} height={24} scale={0.72} mode="LISTENING" />
                          <span style={{ fontSize: '14px', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.02em' }}>Preferences</span>
                        </div>

                        {[
                          {
                            items: [
                              { id: 'Account', label: 'Account & Keys' },
                              { id: 'General', label: 'General' },
                            ],
                          },
                          {
                            title: 'Kibo',
                            items: [
                              { id: 'Core', label: 'Core & Skins' },
                              { id: 'Voice', label: 'Voice & Audio' },
                              { id: 'Shortcuts', label: 'Shortcuts' },
                            ],
                          },
                          {
                            title: 'Work',
                            items: [
                              { id: 'Integrations', label: 'Integrations' },
                              { id: 'Agents', label: 'Agents & Access' },
                            ],
                          },
                        ].map((group, gIdx) => (
                          <div key={gIdx} style={{ marginBottom: gIdx < 2 ? 8 : 0 }}>
                            {group.title && (
                              <div
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.08em',
                                  color: '#64748B',
                                  padding: '8px 8px 4px',
                                }}
                              >
                                {group.title}
                              </div>
                            )}
                            {group.items.map((item) => {
                              const isActive = settingsCategory === item.id;
                              return (
                                <button
                                  key={item.id}
                                  onClick={() => setSettingsCategory(item.id as any)}
                                  className={`kibo-settings-nav-item ${isActive ? 'active' : ''}`}
                                >
                                  <span>{item.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        ))}
                      </div>

                      <div className="kibo-settings-sidebar-bottom">
                        <div className="kibo-settings-version">Kibo v1.0.0 (Win32)</div>
                        <button
                          onClick={() => {
                            if (window.kiboAPI?.quitApp) {
                              window.kiboAPI.quitApp();
                            } else {
                              window.close();
                            }
                          }}
                          className="kibo-settings-quit-btn"
                          title="Quit Kibo completely"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
                            <line x1="12" y1="2" x2="12" y2="12" />
                          </svg>
                          <span>Quit Kibo</span>
                        </button>
                      </div>
                    </div>

                    {/* Right Content Area */}
                    <div className="kibo-settings-content">
                      {settingsCategory === 'Account' && (
                        <>
                          <div>
                            <h2 className="kibo-settings-header-title">Account & Keys</h2>
                            <p className="kibo-settings-header-sub">Manage your local API credentials and energy balance.</p>
                          </div>

                          <div className="kibo-settings-card">
                            <div className="kibo-settings-row">
                              <div>
                                <div className="kibo-settings-row-label">Sparks Balance</div>
                                <div className="kibo-settings-row-desc">Read-only companion energy pool</div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#141519', padding: '6px 14px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.08)' }}>
                                <LivingEmberIcon size={14} isDull={isSoulDull} />
                                <strong style={{ fontSize: '13px', color: '#F8FAFC' }}>{embers.toLocaleString()} Sparks</strong>
                              </div>
                            </div>

                            <div className="kibo-settings-row">
                              <div>
                                <div className="kibo-settings-row-label">Local-First Storage</div>
                                <div className="kibo-settings-row-desc">No external accounts or telemetry required</div>
                              </div>
                              <span style={{ fontSize: '12px', color: '#10B981', fontWeight: 600 }}>Active</span>
                            </div>

                            <div className="kibo-settings-row">
                              <div>
                                <div className="kibo-settings-row-label">Your Name (Persistent Memory)</div>
                                <div className="kibo-settings-row-desc">Kibo remembers your name and preferences across restarts</div>
                              </div>
                              <input
                                type="text"
                                value={userName}
                                placeholder="e.g. Raahim"
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setUserName(val);
                                  savePersistentUserMemory({ userName: val });
                                }}
                                style={{
                                  width: '150px',
                                  height: '32px',
                                  boxSizing: 'border-box',
                                  background: '#141519',
                                  border: '1px solid rgba(255,255,255,0.12)',
                                  borderRadius: 8,
                                  padding: '0 10px',
                                  color: '#F8FAFC',
                                  fontSize: 12.5,
                                  outline: 'none',
                                }}
                              />
                            </div>
                          </div>

                          <div className="kibo-settings-card">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <label className="kibo-settings-row-label">Google Gemini API Key</label>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const url = 'https://aistudio.google.com/app/apikey';
                                    const api = (window as any).kiboAPI;
                                    if (api?.openUrl) {
                                      api.openUrl(url);
                                    } else {
                                      window.open(url, '_blank');
                                    }
                                  }}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    padding: 0,
                                    color: '#38BDF8',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    textDecoration: 'underline',
                                  }}
                                >
                                  <span>Get key on Google AI Studio</span>
                                  <span style={{ fontSize: 13 }}>&#x2197;</span>
                                </button>
                              </div>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <input
                                  type="password"
                                  value={geminiDraftKey}
                                  onChange={(e) => setGeminiDraftKey(e.target.value)}
                                  placeholder="Paste AI Studio API key (AIzaSy...)"
                                  style={{
                                    flex: 1,
                                    background: '#141519',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: 8,
                                    padding: '8px 12px',
                                    color: '#F8FAFC',
                                    fontSize: 13,
                                    fontFamily: 'var(--kibo-font-mono)',
                                  }}
                                />
                                <button
                                  onClick={handleSaveGeminiKey}
                                  className="config-pill-btn"
                                  style={{ background: '#38BDF8', color: '#0A0E17', fontWeight: 700, padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer' }}
                                >
                                  Save
                                </button>
                              </div>
                              <span style={{ fontSize: 11, color: '#64748B' }}>
                                Used for Voice Assistant, Screen Vision, and Clean Dictation.
                              </span>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                              <label className="kibo-settings-row-label">Tavily Search API Key (Optional)</label>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <input
                                  type="password"
                                  value={tavilyDraftKey}
                                  onChange={(e) => setTavilyDraftKey(e.target.value)}
                                  placeholder="Paste Tavily key (tvly-...)"
                                  style={{
                                    flex: 1,
                                    background: '#141519',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: 8,
                                    padding: '8px 12px',
                                    color: '#F8FAFC',
                                    fontSize: 13,
                                    fontFamily: 'var(--kibo-font-mono)',
                                  }}
                                />
                                <button
                                  onClick={() => {
                                    const trimmed = tavilyDraftKey.trim();
                                    setTavilyKey(trimmed);
                                    const api = (window as any).kiboAPI;
                                    if (trimmed) {
                                      localStorage.setItem('kibo_tavily_key', trimmed);
                                      api?.saveStoredSettings?.({ kibo_tavily_key: trimmed });
                                    } else {
                                      localStorage.removeItem('kibo_tavily_key');
                                      api?.saveStoredSettings?.({ kibo_tavily_key: '' });
                                    }
                                  }}
                                  className="config-pill-btn"
                                  style={{ background: '#38BDF8', color: '#0A0E17', fontWeight: 700, padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer' }}
                                >
                                  Save
                                </button>
                              </div>
                              <span style={{ fontSize: 11, color: '#64748B' }}>
                                Powers autonomous web research in the background Agents tab.
                              </span>
                            </div>
                          </div>
                        </>
                      )}

                      {settingsCategory === 'General' && (
                        <>
                          <div>
                            <h2 className="kibo-settings-header-title">General Preferences</h2>
                            <p className="kibo-settings-header-sub">Software updates, startup behavior, and system settings.</p>
                          </div>

                          {/* App Updates Section (Matching Clicky/HeyClicky Style) */}
                          <div style={{ marginBottom: 18 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: '#94A3B8', textTransform: 'uppercase', marginBottom: 8 }}>
                              UPDATES
                            </div>
                            <div className="kibo-settings-card" style={{ padding: '4px 0' }}>
                              {/* App updates row */}
                              <div className="kibo-settings-row" style={{ padding: '14px 18px' }}>
                                <div>
                                  <div className="kibo-settings-row-label">App updates</div>
                                  <div
                                    className="kibo-settings-row-desc"
                                    style={availableUpdate ? { color: '#38BDF8', fontWeight: 600 } : undefined}
                                  >
                                    {availableUpdate
                                      ? `Update available: v${availableUpdate.version}${availableUpdate.title ? ` (${availableUpdate.title})` : ''}`
                                      : (updateCheckStatus || `You're on version ${CURRENT_APP_VERSION}.`)}
                                  </div>
                                </div>
                                {availableUpdate ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const url = availableUpdate.downloadUrl;
                                      const api = (window as any).kiboAPI;
                                      if (api?.openUrl) {
                                        api.openUrl(url);
                                      } else {
                                        window.open(url, '_blank');
                                      }
                                    }}
                                    style={{
                                      background: '#38BDF8',
                                      color: '#0A0E17',
                                      border: 'none',
                                      borderRadius: 999,
                                      padding: '8px 20px',
                                      fontSize: 13,
                                      fontWeight: 800,
                                      cursor: 'pointer',
                                      boxShadow: '0 2px 10px rgba(56, 189, 248, 0.35)',
                                      transition: 'opacity 0.2s',
                                      flexShrink: 0,
                                    }}
                                  >
                                    Download Update (v{availableUpdate.version})
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => checkForAppUpdates(true)}
                                    disabled={isCheckingUpdate}
                                    style={{
                                      background: '#F1F5F9',
                                      color: '#0F172A',
                                      border: 'none',
                                      borderRadius: 999,
                                      padding: '7px 18px',
                                      fontSize: 13,
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
                                      transition: 'opacity 0.2s',
                                      flexShrink: 0,
                                    }}
                                  >
                                    {isCheckingUpdate ? 'Checking...' : 'Check for updates'}
                                  </button>
                                )}
                              </div>

                              {/* Divider */}
                              <div style={{ height: 1, background: 'rgba(255, 255, 255, 0.06)', margin: '0 18px' }} />

                              {/* What's new row */}
                              <div
                                onClick={() => {
                                  if (window.kiboAPI?.openUrl) {
                                    window.kiboAPI.openUrl('https://kiboai.vercel.app');
                                  }
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '14px 18px',
                                  cursor: 'pointer',
                                }}
                              >
                                <div>
                                  <div className="kibo-settings-row-label">What's new</div>
                                  <div className="kibo-settings-row-desc">The changelog of everything shipping in Kibo.</div>
                                </div>
                                <span style={{ color: '#94A3B8', fontSize: 16 }}>&#x2197;</span>
                              </div>
                            </div>
                          </div>

                          <div className="kibo-settings-card">
                            <div className="kibo-settings-row">
                              <div>
                                <div className="kibo-settings-row-label">Launch Kibo on Windows Startup</div>
                                <div className="kibo-settings-row-desc">Automatically launch into top bezel when logging in</div>
                              </div>
                              <button
                                type="button"
                                className={`kibo-switch ${launchAtStartup ? 'is-on' : ''}`}
                                onClick={async () => {
                                  const next = !launchAtStartup;
                                  setLaunchAtStartup(next);
                                  localStorage.setItem('kibo_startup', String(next));
                                  if (window.kiboAPI?.setStartupSetting) {
                                    await window.kiboAPI.setStartupSetting(next);
                                  }
                                }}
                              >
                                <span className="kibo-switch-knob" />
                              </button>
                            </div>

                            <div className="kibo-settings-row">
                              <div>
                                <div className="kibo-settings-row-label">Auto-Tuck Notch When Inactive</div>
                                <div className="kibo-settings-row-desc">Glides smoothly up into the top bezel when you move your mouse away</div>
                              </div>
                              <button
                                type="button"
                                className={`kibo-switch ${autoTuckEnabled ? 'is-on' : ''}`}
                                onClick={() => {
                                  const next = !autoTuckEnabled;
                                  setAutoTuckEnabled(next);
                                  localStorage.setItem('kibo_autotuck', next ? 'true' : 'false');
                                }}
                              >
                                <span className="kibo-switch-knob" />
                              </button>
                            </div>

                            <div className="kibo-settings-row">
                              <div>
                                <div className="kibo-settings-row-label">Sound Effects (SFX)</div>
                                <div className="kibo-settings-row-desc">Play gentle feedback pulses on mode transitions and hotkeys</div>
                              </div>
                              <button
                                type="button"
                                className={`kibo-switch ${sfxEnabled ? 'is-on' : ''}`}
                                onClick={() => {
                                  const next = !sfxEnabled;
                                  setSfxEnabled(next);
                                  soundFX.setEnabled(next);
                                }}
                              >
                                <span className="kibo-switch-knob" />
                              </button>
                            </div>

                            <div className="kibo-settings-row">
                              <div>
                                <div className="kibo-settings-row-label">Feedback &amp; Bug Reporting</div>
                                <div className="kibo-settings-row-desc">Submit issues or request new companion features</div>
                              </div>
                              <button
                                onClick={() => {
                                  if (window.kiboAPI?.openUrl) {
                                    window.kiboAPI.openUrl('https://github.com/RaahimAlavi/kibo/issues');
                                  }
                                }}
                                className="config-pill-btn"
                                style={{ background: '#1E293B', color: '#F8FAFC', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12.5 }}
                              >
                                Report a bug...
                              </button>
                            </div>
                          </div>
                        </>
                      )}

                      {settingsCategory === 'Core' && (
                        <>
                          <div>
                            <h2 className="kibo-settings-header-title">Core & Skins</h2>
                            <p className="kibo-settings-header-sub">Choose your droid chassis skin and taskbar tray tint.</p>
                          </div>

                          <div className="kibo-settings-card" style={{ padding: '16px' }}>
                            <div className="kibo-settings-row-label" style={{ marginBottom: 12 }}>Select Droid Chassis</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                              {SOUL_SKINS.map((skin) => {
                                const isSelected = skin.key === selectedSkinKey;
                                return (
                                  <button
                                    key={skin.key}
                                    onClick={() => {
                                      setSelectedSkinKey(skin.key);
                                      localStorage.setItem('kibo_soul_skin', skin.key);
                                      window.kiboAPI?.updateTrayColor?.(skin.primaryColor);
                                    }}
                                    className={`kibo-core-model-card ${isSelected ? 'selected' : ''}`}
                                    style={{
                                      display: 'flex',
                                      flexDirection: 'column',
                                      alignItems: 'flex-start',
                                      padding: '14px 14px 12px',
                                      borderRadius: 14,
                                      background: isSelected ? 'rgba(255, 255, 255, 0.07)' : '#141519',
                                      border: isSelected ? `1.5px solid ${skin.primaryColor}` : '1px solid rgba(255,255,255,0.08)',
                                      cursor: 'pointer',
                                      textAlign: 'left',
                                      position: 'relative',
                                      transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                                      boxShadow: isSelected ? `0 6px 20px ${skin.primaryColor}22` : 'none',
                                    }}
                                  >
                                    <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                      <SoulCanvas soul={skin} width={42} height={34} scale={0.78} mode="LISTENING" />
                                      <span
                                        style={{
                                          fontSize: 10.5,
                                          fontWeight: 700,
                                          padding: '2px 8px',
                                          borderRadius: 999,
                                          background: isSelected ? skin.primaryColor : 'rgba(255,255,255,0.06)',
                                          color: isSelected ? '#0A0E17' : '#94A3B8',
                                        }}
                                      >
                                        {isSelected ? 'Equipped' : 'Equip'}
                                      </span>
                                    </div>
                                    <div style={{ fontSize: 13.5, fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.01em', marginBottom: 2 }}>
                                      {skin.name}
                                    </div>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: skin.primaryColor, marginBottom: 4 }}>
                                      {skin.primaryColor}
                                    </div>
                                    <div style={{ fontSize: 11, color: '#71717A', lineHeight: 1.4 }}>
                                      {skin.blurb || 'Chassis module calibrated for desktop telemetry.'}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="kibo-settings-card">
                            <div className="kibo-settings-row">
                              <div>
                                <div className="kibo-settings-row-label">Adaptive Wallpaper Palette</div>
                                <div className="kibo-settings-row-desc">Automatically tint Kibo accents to match your current desktop wallpaper</div>
                              </div>
                              <span style={{ fontSize: 12, color: '#38BDF8', fontWeight: 600 }}>Enabled</span>
                            </div>
                          </div>
                        </>
                      )}

                      {settingsCategory === 'Voice' && (
                        <>
                          <div>
                            <h2 className="kibo-settings-header-title">Voice, Captions & Audio Devices</h2>
                            <p className="kibo-settings-header-sub">Configure Google Gemini neural voice synthesis, live captions, speaker output, and microphone input.</p>
                          </div>

                          <div className="kibo-settings-card">
                            <div className="kibo-settings-row" style={{ flexWrap: 'wrap', gap: '8px' }}>
                              <div style={{ flex: '1 1 180px', minWidth: 0, paddingRight: 6 }}>
                                <div className="kibo-settings-row-label">Google Gemini Neural Voice</div>
                                <div className="kibo-settings-row-desc">Unlimited-quota Gemini Live & TTS neural voice used when Kibo speaks</div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, flexWrap: 'nowrap' }}>
                                <select
                                  value={equippedCards.Voice || 'voice_charon'}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setEquippedCards((prev) => ({ ...prev, Voice: val as any }));
                                    localStorage.setItem('kibo_loadout_voice', val);
                                  }}
                                  style={{
                                    height: '32px',
                                    maxWidth: '160px',
                                    boxSizing: 'border-box',
                                    background: '#141519',
                                    color: '#F8FAFC',
                                    border: '1px solid rgba(255,255,255,0.12)',
                                    borderRadius: 8,
                                    padding: '0 6px',
                                    fontSize: 11.5,
                                    outline: 'none',
                                  }}
                                >
                                  <option value="voice_charon">Charon (Deep & Calming)</option>
                                  <option value="voice_aoede">Aoede (Warm & Expressive)</option>
                                  <option value="voice_fenrir">Fenrir (Crisp & Direct)</option>
                                  <option value="voice_puck">Puck (Kinetic & Friendly)</option>
                                </select>
                                <button
                                  type="button"
                                  onClick={() => {
                                    speakAsKibo('Hello! I am Kibo, speaking with my Google Gemini neural voice.');
                                  }}
                                  className="config-pill-btn"
                                  style={{
                                    height: '32px',
                                    boxSizing: 'border-box',
                                    background: '#18191E',
                                    color: '#38BDF8',
                                    border: '1px solid rgba(56, 189, 248, 0.32)',
                                    padding: '0 10px',
                                    borderRadius: 8,
                                    fontSize: 11.5,
                                    fontWeight: 700,
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                  }}
                                >
                                  Test Voice
                                </button>
                              </div>
                            </div>

                            <div className="kibo-settings-row">
                              <div>
                                <div className="kibo-settings-row-label">Spoken Voice Responses</div>
                                <div className="kibo-settings-row-desc">Play synthesized Google neural audio when Kibo replies to queries</div>
                              </div>
                              <button
                                type="button"
                                className={`kibo-switch ${voiceFeedbackEnabled ? 'is-on' : ''}`}
                                onClick={() => {
                                  const next = !voiceFeedbackEnabled;
                                  setVoiceFeedbackEnabled(next);
                                  localStorage.setItem('kibo_voice_tts', next ? 'true' : 'false');
                                }}
                              >
                                <span className="kibo-switch-knob" />
                              </button>
                            </div>

                            <div className="kibo-settings-row">
                              <div>
                                <div className="kibo-settings-row-label">On-Screen Live Captions</div>
                                <div className="kibo-settings-row-desc">Display floating speech & reply caption bubbles below the notch (full history always stays in Chat)</div>
                              </div>
                              <button
                                type="button"
                                className={`kibo-switch ${captionsEnabled ? 'is-on' : ''}`}
                                onClick={() => {
                                  const next = !captionsEnabled;
                                  setCaptionsEnabled(next);
                                  localStorage.setItem('kibo_captions_enabled', next ? 'true' : 'false');
                                }}
                              >
                                <span className="kibo-switch-knob" />
                              </button>
                            </div>

                            <div className="kibo-settings-row">
                              <div>
                                <div className="kibo-settings-row-label">Output Device (Speaker / Headphones)</div>
                                <div className="kibo-settings-row-desc">Route Kibo's spoken voice and chimes to a specific audio output</div>
                              </div>
                              <select
                                value={selectedSpeakerDeviceId}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setSelectedSpeakerDeviceId(val);
                                  localStorage.setItem('kibo_output_device_id', val);
                                  voiceEngine.setOutputDevice(val);
                                }}
                                style={{
                                  maxWidth: 230,
                                  background: '#141519',
                                  color: '#F8FAFC',
                                  border: '1px solid rgba(255,255,255,0.12)',
                                  borderRadius: 8,
                                  padding: '6px 10px',
                                  fontSize: 12,
                                  outline: 'none',
                                }}
                              >
                                {audioOutputDevices.map((d) => (
                                  <option key={d.deviceId} value={d.deviceId}>
                                    {d.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="kibo-settings-card">
                            <div className="kibo-settings-row">
                              <div>
                                <div className="kibo-settings-row-label">Microphone Input Device</div>
                                <div className="kibo-settings-row-desc">Select which microphone Kibo listens to for voice commands and dictation</div>
                              </div>
                              <select
                                value={selectedMicDeviceId}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setSelectedMicDeviceId(val);
                                  localStorage.setItem('kibo_mic_device_id', val);
                                }}
                                style={{
                                  maxWidth: 230,
                                  background: '#141519',
                                  color: '#F8FAFC',
                                  border: '1px solid rgba(255,255,255,0.12)',
                                  borderRadius: 8,
                                  padding: '6px 10px',
                                  fontSize: 12,
                                  outline: 'none',
                                }}
                              >
                                {audioInputDevices.map((d) => (
                                  <option key={d.deviceId} value={d.deviceId}>
                                    {d.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="kibo-settings-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div>
                                  <div className="kibo-settings-row-label">Microphone Signal Test</div>
                                  <div className="kibo-settings-row-desc">Speak normally to verify input sensitivity and hardware routing</div>
                                </div>
                                <button
                                  type="button"
                                  onClick={toggleMicTest}
                                  className="config-pill-btn"
                                  style={{
                                    background: isTestingMic ? 'rgba(239, 68, 68, 0.16)' : '#1E293B',
                                    color: isTestingMic ? '#F87171' : '#F8FAFC',
                                    border: isTestingMic ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(255,255,255,0.1)',
                                    padding: '6px 14px',
                                    borderRadius: 8,
                                    fontSize: 12,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                  }}
                                >
                                  <SvgIcon name="mic" size={12} color={isTestingMic ? '#F87171' : '#38BDF8'} />
                                  <span>{isTestingMic ? 'Stop Mic Test' : 'Test Microphone'}</span>
                                </button>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div
                                  style={{
                                    flex: 1,
                                    height: 8,
                                    borderRadius: 999,
                                    background: '#141519',
                                    border: '1px solid rgba(255,255,255,0.07)',
                                    overflow: 'hidden',
                                  }}
                                >
                                  <div
                                    style={{
                                      width: `${isTestingMic ? Math.max(4, micTestLevel) : 0}%`,
                                      height: '100%',
                                      borderRadius: 999,
                                      background: '#38BDF8',
                                      transition: 'width 0.08s ease-out',
                                    }}
                                  />
                                </div>
                                <span style={{ fontSize: 11, fontFamily: 'var(--kibo-font-mono)', color: '#94A3B8', minWidth: 38, textAlign: 'right' }}>
                                  {isTestingMic ? `${micTestLevel}%` : 'Idle'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </>
                      )}

                      {settingsCategory === 'Integrations' && (
                        renderIntegrationsContent()
                      )}

                      {settingsCategory === 'Agents' && (
                        <>
                          <div>
                            <h2 className="kibo-settings-header-title">Agent Reach & OS Permissions</h2>
                            <p className="kibo-settings-header-sub">Control which local folders, hardware sensors, and personal records Kibo agents are allowed to access.</p>
                          </div>

                          <div className="kibo-settings-card">
                            {(
                              [
                                {
                                  key: 'filesAndFolders',
                                  label: 'Files & Folders',
                                  desc: 'Allow Kibo to locate, read, and non-destructively convert files in Desktop & Downloads',
                                  icon: 'folder',
                                },
                                {
                                  key: 'documents',
                                  label: 'Documents',
                                  desc: 'Access PDFs, Word documents (.docx), Markdown notes, and spreadsheets',
                                  icon: 'doc',
                                },
                                {
                                  key: 'pictures',
                                  label: 'Pictures & Screenshots',
                                  desc: 'Read local images, Circle-to-Ask screen captures, and export converted graphics',
                                  icon: 'image',
                                },
                                {
                                  key: 'contacts',
                                  label: 'Contacts & People',
                                  desc: 'Resolve recipient names when drafting emails or scheduling workspace invites',
                                  icon: 'contacts',
                                },
                                {
                                  key: 'calendar',
                                  label: 'Calendar & Reminders',
                                  desc: 'Read upcoming schedule blocks and trigger timed voice routines',
                                  icon: 'calendar',
                                },
                                {
                                  key: 'microphone',
                                  label: 'Microphone',
                                  desc: 'Required for Push-to-Talk voice commands (Win + Alt) and Clean Dictation',
                                  icon: 'mic',
                                },
                                {
                                  key: 'camera',
                                  label: 'Camera',
                                  desc: 'Allow visual presence or hardware camera queries when explicitly requested',
                                  icon: 'camera',
                                },
                                {
                                  key: 'location',
                                  label: 'Location & Timezone',
                                  desc: 'Use regional context for local weather, commute, and search queries',
                                  icon: 'location',
                                },
                              ] as ReadonlyArray<{
                                key: keyof AgentPermissionState;
                                label: string;
                                desc: string;
                                icon: string;
                              }>
                            ).map((perm) => {
                              const isAllowed = Boolean(agentPermissions[perm.key]);
                              return (
                                <div key={perm.key} className="kibo-settings-row">
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div
                                      style={{
                                        width: 30,
                                        height: 30,
                                        borderRadius: 8,
                                        background: isAllowed ? 'rgba(56, 189, 248, 0.14)' : 'rgba(255,255,255,0.04)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                      }}
                                    >
                                      <SvgIcon name={perm.icon} size={14} color={isAllowed ? '#38BDF8' : '#64748B'} />
                                    </div>
                                    <div>
                                      <div className="kibo-settings-row-label">{perm.label}</div>
                                      <div className="kibo-settings-row-desc">{perm.desc}</div>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    className={`kibo-switch ${isAllowed ? 'is-on' : ''}`}
                                    onClick={() => toggleAgentPermission(perm.key)}
                                  >
                                    <span className="kibo-switch-knob" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}

                      {settingsCategory === 'Shortcuts' && (
                        <>
                          <div>
                            <h2 className="kibo-settings-header-title">Shortcuts & Gestures</h2>
                            <p className="kibo-settings-header-sub">Hardware hotkeys that work over any running Windows application.</p>
                          </div>

                          <div className="kibo-settings-card">
                            <div className="kibo-settings-row">
                              <div>
                                <div className="kibo-settings-row-label">Ask & Control</div>
                                <div className="kibo-settings-row-desc">Hold, speak your command, release</div>
                              </div>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <kbd className="kibo-kbd" style={{ background: '#141519', color: '#F8FAFC', border: '1px solid rgba(255,255,255,0.15)', padding: '4px 8px', borderRadius: 6, fontSize: 12 }}>Win</kbd>
                                <span style={{ color: '#64748B' }}>+</span>
                                <kbd className="kibo-kbd" style={{ background: '#141519', color: '#F8FAFC', border: '1px solid rgba(255,255,255,0.15)', padding: '4px 8px', borderRadius: 6, fontSize: 12 }}>Alt</kbd>
                              </div>
                            </div>

                            <div className="kibo-settings-row">
                              <div>
                                <div className="kibo-settings-row-label">Circle to Ask (Screen Vision)</div>
                                <div className="kibo-settings-row-desc">Draw a lasso around any screen region</div>
                              </div>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <kbd className="kibo-kbd" style={{ background: '#141519', color: '#F8FAFC', border: '1px solid rgba(255,255,255,0.15)', padding: '4px 8px', borderRadius: 6, fontSize: 12 }}>Ctrl</kbd>
                                <span style={{ color: '#64748B' }}>+</span>
                                <kbd className="kibo-kbd" style={{ background: '#141519', color: '#F8FAFC', border: '1px solid rgba(255,255,255,0.15)', padding: '4px 8px', borderRadius: 6, fontSize: 12 }}>Shift</kbd>
                              </div>
                            </div>

                            <div className="kibo-settings-row">
                              <div>
                                <div className="kibo-settings-row-label">Clean Dictation</div>
                                <div className="kibo-settings-row-desc">Hold to speak, types clean text into cursor</div>
                              </div>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <kbd className="kibo-kbd" style={{ background: '#141519', color: '#F8FAFC', border: '1px solid rgba(255,255,255,0.15)', padding: '4px 8px', borderRadius: 6, fontSize: 12 }}>Ctrl</kbd>
                                <span style={{ color: '#64748B' }}>+</span>
                                <kbd className="kibo-kbd" style={{ background: '#141519', color: '#F8FAFC', border: '1px solid rgba(255,255,255,0.15)', padding: '4px 8px', borderRadius: 6, fontSize: 12 }}>Win</kbd>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* =====================================================================
          FIRST-LAUNCH GAMIFIED WAKING SOUL ONBOARDING WITH EMBER REWARDS
          ===================================================================== */}
      {onboardingStep !== null && (
        <KiboOnboardingExperience
          soul={currentSoul}
          customShortcuts={customShortcuts}
          lastTriggeredHotkey={lastHotkeyAction}
          liveSpeechText={liveSpeechRef.current || askWords.join(' ')}
          isIslandExpanded={isExpanded}
          geminiDraftKey={geminiDraftKey}
          tavilyDraftKey={tavilyDraftKey}
          onChangeGeminiKey={setGeminiDraftKey}
          onChangeTavilyKey={setTavilyDraftKey}
          onAwardEmbers={addEmbers}
          onSpeak={speakAsKibo}
          onPreviewExpandIsland={(expand) => {
            setIsTucked(!expand);
            setIsExpanded(expand);
            if (expand) setActiveTab('Chat');
          }}
          onComplete={completeOnboarding}
        />
      )}

      {/* =====================================================================
          FREELY DRAGGABLE KIBO CONFIGURATION, ORBITING LOADOUT & CARD DECK WINDOW
          ===================================================================== */}
      {showCompanionWindow && (
        <div
          className={`kibo-config-app-window ${companionDockTab === 'soul' ? 'loadout-theme' : 'settings-theme'}`}
          style={{
            position: 'fixed',
            left: `${appWindowPos.x}px`,
            top: `${appWindowPos.y}px`,
            margin: 0,
          }}
        >
          <div
            className="config-app-topbar"
            style={{ cursor: isDraggingAppWin ? 'grabbing' : 'grab' }}
            onPointerDown={(e) => {
              if ((e.target as HTMLElement).closest('button')) return;
              dragOffsetRef.current = {
                dx: e.clientX - appWindowPos.x,
                dy: e.clientY - appWindowPos.y,
              };
              setIsDraggingAppWin(true);
            }}
          >
            {activeDeckSlot ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  onClick={() => setActiveDeckSlot(null)}
                  className="companion-header-circle"
                  title="Back"
                >
                  ‹
                </button>
                <span style={{ fontSize: '18px', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.02em' }}>
                  {activeDeckSlot === 'Soul' ? 'Core' : activeDeckSlot}
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', pointerEvents: 'none' }}>
                <div className="topbar-soul-avatar">
                  <SoulCanvas soul={currentSoul} width={48} height={42} scale={0.92} mode="LISTENING" />
                </div>
                <span style={{ fontSize: '15px', fontWeight: 800, color: '#F8FAFC', letterSpacing: '-0.01em' }}>
                  Kibo
                </span>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                className="macos-sparks-pill"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                <LivingEmberIcon size={14} isDull={isSoulDull} />
                <span>{embers.toLocaleString()} Sparks</span>
              </div>
              <button
                onClick={() => {
                  const next = !sfxEnabled;
                  setSfxEnabled(next);
                  soundFX.setEnabled(next);
                }}
                title={sfxEnabled ? 'Sound Effects: On' : 'Sound Effects: Muted'}
                className="companion-header-circle"
              >
                <SvgIcon name={sfxEnabled ? 'speaker' : 'mute'} size={12} />
              </button>
              <button
                onClick={() => {
                  if (activeDeckSlot) {
                    setActiveDeckSlot(null);
                  } else {
                    setShowCompanionWindow(false);
                    setShowConnectModal(false);
                  }
                }}
                className="config-app-close-btn"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {activeDeckSlot && currentSlotCards.length > 0 ? (
            <div
              className="loadout-fanned-deck-stage"
              onWheel={(e) => {
                const nowMs = performance.now();
                if (nowMs - wheelLockRef.current < 140) return;
                wheelLockRef.current = nowMs;
                if (e.deltaY > 0 || e.deltaX > 0) {
                  setDeckCardIndex((i) => Math.min(currentSlotCards.length - 1, i + 1));
                } else if (e.deltaY < 0 || e.deltaX < 0) {
                  setDeckCardIndex((i) => Math.max(0, i - 1));
                }
              }}
            >
              <div className="fanned-cards-stack">
                {currentSlotCards.map((card, idx) => {
                  const diff = idx - deckCardIndex;
                  if (Math.abs(diff) > 3) return null;

                  const isActiveCard = diff === 0;
                  const isVoidUnlocked = unlockedCardIds.includes('soul_void');
                  const isUnlocked =
                    unlockedCardIds.includes(card.id) ||
                    card.cost === 0 ||
                    (card.id === 'abil_collapse' && isVoidUnlocked);
                  const isEquipped = equippedCards[card.slot] === card.id;
                  const moreToGo = Math.max(0, card.cost - embers);

                  const translateX = diff * 36;
                  const translateY = Math.abs(diff) * 8;
                  const rotateDeg = diff * 4.5;
                  const scaleVal = 1 - Math.abs(diff) * 0.045;
                  const zIndexVal = 20 - Math.abs(diff);

                  return (
                    <div
                      key={card.id}
                      onClick={() => {
                        if (!isActiveCard) setDeckCardIndex(idx);
                      }}
                      className={`collectible-loadout-card ${isActiveCard ? 'is-front' : 'is-fanned'}`}
                      style={{
                        background: card.cardTint,
                        transform: `translate3d(${translateX}px, ${translateY}px, 0) rotate(${rotateDeg}deg) scale(${scaleVal})`,
                        zIndex: zIndexVal,
                        opacity: isActiveCard ? 1 : Math.max(0.32, 0.72 - Math.abs(diff) * 0.18),
                      }}
                    >
                      {isActiveCard && (
                        <>
                          <div className="card-visual-center">
                            {card.iconKind === 'wave' && (
                              <div
                                className="card-cyan-waveform"
                                style={{ cursor: 'pointer' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const vName = (card.name || 'Charon') as KiboVoiceName;
                                  voiceEngine.speak(`I am ${vName}. Kibo voice module online. Systems calibrated.`, {
                                    voice: vName,
                                  });
                                }}
                                title="Click to hear voice preview"
                              >
                                {[0.4, 0.75, 1.0, 0.65, 0.38].map((barH, bIdx) => (
                                  <span key={bIdx} style={{ height: `${Math.round(barH * 42)}px` }} />
                                ))}
                              </div>
                            )}
                            {card.iconKind === 'soul' && (
                              <div style={{ width: '88px', height: '74px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <SoulCanvas
                                  soul={SOUL_SKINS.find((s) => s.key === card.skinKey) || currentSoul}
                                  width={84}
                                  height={68}
                                  scale={1.0}
                                  mode="LISTENING"
                                />
                              </div>
                            )}
                            {card.iconKind === 'void' && (
                              <div className="card-void-soul-wrap">
                                <SoulCanvas
                                  soul={SOUL_SKINS.find((s) => s.key === 'flame_void') || currentSoul}
                                  width={84}
                                  height={68}
                                  scale={1.0}
                                  mode="LISTENING"
                                />
                              </div>
                            )}
                            {card.iconKind === 'collapse_eye' && (
                              <div className="card-padlock-large">
                                <svg width="64" height="44" viewBox="0 0 64 44" fill="none">
                                  <ellipse cx="32" cy="22" rx="24" ry="13" stroke="#E2BA78" strokeWidth="4.5" />
                                  <circle cx="32" cy="22" r="11" fill="#1C1915" stroke="#E2BA78" strokeWidth="4.5" />
                                </svg>
                              </div>
                            )}
                            {card.iconKind === 'sidearm_bullet' && (
                              <div className="card-padlock-large">
                                <svg width="44" height="58" viewBox="0 0 44 58" fill="none">
                                  <path
                                    d="M13 24C13 13 22 5 22 5C22 5 31 13 31 24V48C31 50.2 29.2 52 27 52H17C14.8 52 13 50.2 13 48V24Z"
                                    stroke="#E2BA78"
                                    strokeWidth="4.2"
                                    strokeLinejoin="round"
                                  />
                                  <line x1="13" y1="26" x2="31" y2="26" stroke="#E2BA78" strokeWidth="4" />
                                  <line x1="13" y1="40" x2="31" y2="40" stroke="#E2BA78" strokeWidth="4" />
                                </svg>
                              </div>
                            )}
                            {card.iconKind === 'lock' && (
                              <div className="card-padlock-large">
                                <SvgIcon name="padlock" size={62} color="rgba(255,255,255,0.28)" />
                              </div>
                            )}
                            {card.iconKind === 'plus' && (
                              <div className="card-plus-large">+</div>
                            )}
                            {card.iconKind === 'chad' && (
                              <div className="card-padlock-large">
                                <SvgIcon name="smile" size={54} color="#FB923C" />
                              </div>
                            )}

                            <div className="card-title-text">{card.name}</div>

                            {card.rarity && (
                              <span className="card-rarity-pill">{card.rarity}</span>
                            )}

                            {card.description && (
                              <p className="card-lore-desc">{card.description}</p>
                            )}
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEquipOrUnlockCard(card);
                            }}
                            className={`card-bottom-action-btn ${isEquipped ? 'equipped' : isUnlocked && !card.notForSale ? 'unlocked' : embers >= card.cost && !card.notForSale ? 'can-afford' : 'locked'}`}
                          >
                            {card.notForSale && !isVoidUnlocked
                              ? 'Not for sale'
                              : isEquipped
                              ? card.slot === 'Soul'
                                ? 'Equipped'
                                : 'Active'
                              : isUnlocked
                              ? card.slot === 'Soul'
                                ? 'Equip Core'
                                : 'Activate'
                              : moreToGo === 0
                              ? `Unlock for ${card.cost.toLocaleString()} Sparks`
                              : `${card.cost.toLocaleString()} Sparks · ${moreToGo.toLocaleString()} more needed`}
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="deck-pagination-bar">
                <button
                  onClick={() => setDeckCardIndex((i) => Math.max(0, i - 1))}
                  disabled={deckCardIndex === 0}
                  className="deck-page-circle-btn"
                >
                  ‹
                </button>
                <span className="deck-page-counter">
                  {deckCardIndex + 1} of {currentSlotCards.length}
                </span>
                <button
                  onClick={() => setDeckCardIndex((i) => Math.min(currentSlotCards.length - 1, i + 1))}
                  disabled={deckCardIndex === currentSlotCards.length - 1}
                  className="deck-page-circle-btn"
                >
                  ›
                </button>
              </div>

              {activeDeckSlot === 'Abilities' && (
                <div className="abilities-trigger-footer">
                  <div className="trigger-copy-left">
                    <div className="trigger-title">Trigger button</div>
                    <div className="trigger-sub">
                      Click, then press any key or mouse button. Esc cancels.
                    </div>
                  </div>
                  <button
                    onClick={() => setIsBindingTrigger(true)}
                    className={`trigger-keybind-btn ${isBindingTrigger ? 'binding' : ''}`}
                  >
                    {isBindingTrigger ? 'Press key...' : abilityTriggerKey}
                  </button>
                </div>
              )}
            </div>
          ) : companionDockTab === 'settings' ? (
            <div className="config-app-body">
              <div className="config-sidebar">
                <div className="config-sidebar-title">Settings</div>
                <div className="config-sidebar-search">
                  <SvgIcon name="search" size={12} color="#64748B" />
                  <input
                    type="text"
                    placeholder="Search settings"
                    value={settingsSearch}
                    onChange={(e) => setSettingsSearch(e.target.value)}
                  />
                </div>

                <div className="config-sidebar-nav">
                  {(
                    [
                      { id: 'Kibo', icon: 'user' },
                      { id: 'Shortcuts', icon: 'keyboard' },
                      { id: 'Behavior', icon: 'sliders' },
                      { id: 'System', icon: 'gear' },
                      { id: 'API keys', icon: 'key' },
                      { id: 'Your data', icon: 'database' },
                      { id: 'Privacy', icon: 'shield' },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setSettingsSection(item.id)}
                      className={`config-sidebar-item ${settingsSection === item.id ? 'active' : ''}`}
                    >
                      <span className="sidebar-item-icon">
                        <SvgIcon name={item.icon} size={13} />
                      </span>
                      <span>{item.id}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="config-main-panel">
                {settingsSection === 'API keys' && (
                  <>
                    <h2 className="config-panel-heading">API keys</h2>
                    <p className="config-panel-sub">
                      Your Gemini key, and a free Tavily key for web search.
                    </p>

                    <div className="config-group-label">Gemini</div>
                    <div className="config-card-group">
                      <div className="config-card-row">
                        <div className="config-row-copy">
                          <div className="config-row-title">Gemini API key</div>
                          <div className="config-row-desc">
                            {apiKey
                              ? 'Stored encrypted on this PC, never shown again once saved'
                              : 'No Gemini key saved yet :  click Change to add your key'}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setGeminiDraftKey(apiKey);
                            setShowConnectModal(true);
                          }}
                          className="config-pill-btn"
                        >
                          Change
                        </button>
                      </div>

                      <div className="config-card-row">
                        <div className="config-row-copy">
                          <div className="config-row-title">Forget my API key</div>
                          <div className="config-row-desc">
                            Erases your Gemini key from this PC; Kibo asks for one again
                          </div>
                        </div>
                        <button onClick={handleForgetGeminiKey} className="config-pill-btn">
                          Forget...
                        </button>
                      </div>
                    </div>

                    <div className="config-group-label" style={{ marginTop: '18px' }}>
                      Web search
                    </div>
                    <div className="config-card-group">
                      <div className="config-card-row">
                        <div className="config-row-copy">
                          <div className="config-row-title">Tavily API key</div>
                          <div className={`config-row-desc ${tavilyKey ? 'connected-green' : ''}`}>
                            {tavilyKey
                              ? 'Connected · Live web search enabled'
                              : 'Not connected · Add a free Tavily key below for live web search'}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <input
                            type="password"
                            placeholder="tvly-..."
                            value={tavilyDraftKey}
                            onChange={(e) => setTavilyDraftKey(e.target.value)}
                            style={{
                              background: 'rgba(255,255,255,0.05)',
                              border: '1px solid rgba(255,255,255,0.1)',
                              borderRadius: '7px',
                              padding: '5px 10px',
                              color: '#F1F5F9',
                              fontSize: '11.5px',
                              width: '130px',
                              outline: 'none',
                            }}
                          />
                          <button
                            onClick={() => {
                              const api = (window as any).kiboAPI;
                              if (tavilyDraftKey.trim()) {
                                const val = tavilyDraftKey.trim();
                                setTavilyKey(val);
                                localStorage.setItem('kibo_tavily_key', val);
                                api?.saveStoredSettings?.({ kibo_tavily_key: val });
                              } else {
                                setTavilyKey('');
                                localStorage.removeItem('kibo_tavily_key');
                                api?.saveStoredSettings?.({ kibo_tavily_key: '' });
                              }
                            }}
                            className="config-pill-btn"
                          >
                            {tavilyKey ? 'Update' : 'Save'}
                          </button>
                        </div>
                      </div>

                      <div className="config-card-row">
                        <div className="config-row-copy">
                          <div className="config-row-title">Get a free Tavily key</div>
                          <div className="config-row-desc">
                            1,000 free credits a month, no card. Sign up, copy the key, paste it above
                          </div>
                        </div>
                        <button
                          onClick={() => window.kiboAPI?.openUrl('https://tavily.com')}
                          className="config-pill-btn"
                        >
                          Get one
                        </button>
                      </div>

                      <div className="config-card-row">
                        <div className="config-row-copy">
                          <div className="config-row-title">What it sends</div>
                          <div className="config-row-desc" style={{ lineHeight: 1.45 }}>
                            Only your research question goes to Tavily, from this PC under your own account. Tavily may use searches to improve its AI :  don't research passwords, ID numbers or health details. Deep research only when you ask for it (about 7 credits)
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="config-group-label" style={{ marginTop: '18px' }}>
                      Connected Apps & Integrations
                    </div>
                    <div className="config-card-group">
                      {(['notion', 'github', 'vscode', 'figma', 'gmail'] as const).map((appKey) => {
                        const composioAcc = composioStatus.accounts.find(
                          (a) => a.slug?.toLowerCase() === appKey.toLowerCase() && a.status === 'ACTIVE'
                        );
                        const linked = Boolean(composioAcc) || (appKey === 'vscode' && multitaskAgent.isAppConnected(appKey));
                        const isConnLoading = composioConnectingSlug === appKey;
                        const labelMap = {
                          notion: 'Notion Workspace',
                          github: 'GitHub Repositories',
                          vscode: 'Visual Studio Code',
                          figma: 'Figma Design Canvas',
                          gmail: 'Google Mail',
                        };
                        return (
                          <div key={appKey} className="config-card-row">
                            <div className="config-row-copy">
                              <div className="config-row-title">
                                {labelMap[appKey]}
                                {composioAcc?.profileName && (
                                  <span style={{ fontSize: 11, fontWeight: 600, color: '#38BDF8', marginLeft: 8 }}>
                                    ({composioAcc.profileName})
                                  </span>
                                )}
                              </div>
                              <div className={`config-row-desc ${linked ? 'connected-green' : ''}`}>
                                {linked ? 'Connected · Proactive suggestions & agent actions enabled' : 'Not linked'}
                              </div>
                            </div>
                            <button
                              disabled={isConnLoading}
                              onClick={() => {
                                if (linked) {
                                  if (composioAcc) {
                                    handleDisconnectComposioAccount(composioAcc.id, appKey);
                                  } else {
                                    multitaskAgent.unlinkApp(appKey);
                                  }
                                } else {
                                  if (appKey === 'vscode') {
                                    multitaskAgent.connectApp('vscode');
                                  } else {
                                    handleConnectComposioApp(appKey);
                                  }
                                }
                                setDetectedAppId((prev) => (prev === appKey ? null : prev));
                              }}
                              className="config-pill-btn"
                              style={
                                linked
                                  ? { borderColor: 'rgba(239, 68, 68, 0.35)', color: '#FCA5A5' }
                                  : { borderColor: 'rgba(92, 184, 255, 0.35)', color: '#BAE6FD' }
                              }
                            >
                              {isConnLoading ? 'Connecting...' : linked ? 'Unlink' : 'Connect'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {settingsSection === 'Kibo' && (
                  <>
                    <h2 className="config-panel-heading">Kibo</h2>
                    <p className="config-panel-sub">Your droid's core finish, voice module, and interactive tour.</p>
                    <div className="config-card-group">
                      <div className="config-card-row">
                        <div className="config-row-copy">
                          <div className="config-row-title">Active Droid Core</div>
                          <div className="config-row-desc">
                            Core: {getEquippedCardName('Soul')} · Voice: {getEquippedCardName('Voice')} · Personality: {getEquippedCardName('Personality')}
                          </div>
                        </div>
                        <button onClick={() => setCompanionDockTab('soul')} className="config-pill-btn">
                          Open Kibo Studio
                        </button>
                      </div>
                      <div className="config-card-row">
                        <div className="config-row-copy">
                          <div className="config-row-title">Sparks Balance</div>
                          <div className="config-row-desc">
                            {embers.toLocaleString()} Sparks available · {rewardedTaskIds.length}/5 daily task rewards claimed today
                          </div>
                        </div>
                        <div
                          className="embers-currency-pill"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '7px',
                            pointerEvents: 'none',
                            userSelect: 'none',
                          }}
                        >
                          <LivingEmberIcon size={15} isDull={isSoulDull} />
                          <span>{embers.toLocaleString()} Sparks</span>
                        </div>
                      </div>
                      <div className="config-card-row">
                        <div className="config-row-copy">
                          <div className="config-row-title">Interactive Onboarding Tour</div>
                          <div className="config-row-desc">Replay the 4-step walkthrough and API setup guide</div>
                        </div>
                        <button
                          onClick={() => {
                            setShowCompanionWindow(false);
                            setIsTucked(false);
                            setOnboardingStep(0);
                          }}
                          className="config-pill-btn"
                        >
                          Replay Tour
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {settingsSection === 'Shortcuts' && (
                  <>
                    <h2 className="config-panel-heading">Shortcuts</h2>
                    <p className="config-panel-sub">Global Windows hotkeys for voice commands, dictation, and vision.</p>
                    <div className="config-card-group">
                      <div className="config-card-row">
                        <div className="config-row-copy">
                          <div className="config-row-title">Ask Kibo</div>
                          <div className="config-row-desc">Wake Kibo to run commands, toggle dark mode, or search YouTube & Google</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setBindingShortcutKey(bindingShortcutKey === 'ask' ? null : 'ask')}
                          className={`config-pill-btn ${bindingShortcutKey === 'ask' ? 'binding' : ''}`}
                        >
                          {bindingShortcutKey === 'ask' ? 'Press keys... (Esc)' : customShortcuts.ask}
                        </button>
                      </div>
                      <div className="config-card-row">
                        <div className="config-row-copy">
                          <div className="config-row-title">Circle to Ask</div>
                          <div className="config-row-desc">Circle any region on screen and ask about it out loud</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setBindingShortcutKey(bindingShortcutKey === 'circle' ? null : 'circle')}
                          className={`config-pill-btn ${bindingShortcutKey === 'circle' ? 'binding' : ''}`}
                        >
                          {bindingShortcutKey === 'circle' ? 'Press keys... (Esc)' : customShortcuts.circle}
                        </button>
                      </div>
                      <div className="config-card-row">
                        <div className="config-row-copy">
                          <div className="config-row-title">Clean Dictation</div>
                          <div className="config-row-desc">Talk badly with false starts and paste finished text into any window</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setBindingShortcutKey(bindingShortcutKey === 'dictate' ? null : 'dictate')}
                          className={`config-pill-btn ${bindingShortcutKey === 'dictate' ? 'binding' : ''}`}
                        >
                          {bindingShortcutKey === 'dictate' ? 'Press keys... (Esc)' : customShortcuts.dictate}
                        </button>
                      </div>
                      <div className="config-card-row">
                        <div className="config-row-copy">
                          <div className="config-row-title">Ability Trigger Button</div>
                          <div className="config-row-desc">Key or mouse button used to fire equipped Abilities like Collapse or Sidearm</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsBindingTrigger((prev) => !prev)}
                          className={`config-pill-btn ${isBindingTrigger ? 'binding' : ''}`}
                        >
                          {isBindingTrigger ? 'Press key...' : abilityTriggerKey}
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {settingsSection === 'Behavior' && (
                  <>
                    <h2 className="config-panel-heading">Behavior</h2>
                    <p className="config-panel-sub">Control how the top notch and voice feedback behave while you work.</p>
                    <div className="config-card-group">
                      <div className="config-card-row">
                        <div className="config-row-copy">
                          <div className="config-row-title">Auto-tuck into top bezel when idle</div>
                          <div className="config-row-desc">Retracts into a 18px sliver after 4.5s so top browser tabs are never blocked</div>
                        </div>
                        <button
                          onClick={() => {
                            const next = !autoTuckEnabled;
                            setAutoTuckEnabled(next);
                            localStorage.setItem('kibo_autotuck', String(next));
                          }}
                          className="config-pill-btn"
                        >
                          {autoTuckEnabled ? 'Enabled' : 'Disabled'}
                        </button>
                      </div>
                      <div className="config-card-row">
                        <div className="config-row-copy">
                          <div className="config-row-title">Spoken voice responses ({getEquippedCardName('Voice')})</div>
                          <div className="config-row-desc">Read Kibo's replies out loud alongside the on-screen pill</div>
                        </div>
                        <button
                          onClick={() => {
                            const next = !voiceFeedbackEnabled;
                            setVoiceFeedbackEnabled(next);
                            localStorage.setItem('kibo_voice_tts', String(next));
                          }}
                          className="config-pill-btn"
                        >
                          {voiceFeedbackEnabled ? 'On' : 'Muted'}
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {settingsSection === 'System' && (
                  <>
                    <h2 className="config-panel-heading">System</h2>
                    <p className="config-panel-sub">Windows integration, startup behavior, and hardware telemetry.</p>
                    <div className="config-card-group">
                      <div className="config-card-row">
                        <div className="config-row-copy">
                          <div className="config-row-title">Launch Kibo at Windows startup</div>
                          <div className="config-row-desc">Start minimized in your top monitor bezel and system tray</div>
                        </div>
                        <button
                          onClick={() => {
                            const next = !launchAtStartup;
                            setLaunchAtStartup(next);
                            localStorage.setItem('kibo_startup', String(next));
                            window.kiboAPI?.setStartupSetting?.(next);
                          }}
                          className="config-pill-btn"
                        >
                          {launchAtStartup ? 'Active' : 'Off'}
                        </button>
                      </div>
                      <div className="config-card-row">
                        <div className="config-row-copy">
                          <div className="config-row-title">Detected Graphics Hardware</div>
                          <div className="config-row-desc">{systemStats.gpu.name || systemStats.gpu.model} ({systemStats.gpu.vramTotal} GB VRAM)</div>
                        </div>
                        <span className="config-pill-btn">Active</span>
                      </div>
                    </div>
                  </>
                )}

                {settingsSection === 'Your data' && (
                  <>
                    <h2 className="config-panel-heading">Your data</h2>
                    <p className="config-panel-sub">Manage local clipboard history, To-Do tasks, and scheduled routines.</p>
                    <div className="config-card-group">
                      <div className="config-card-row">
                        <div className="config-row-copy">
                          <div className="config-row-title">Clear Clipboard History ({clipboardItems.length} items)</div>
                          <div className="config-row-desc">Removes all unpinned items from Kibo's local clipboard list</div>
                        </div>
                        <button
                          onClick={() => {
                            setClipboardItems((prev) => {
                              const remaining = prev.filter((i) => i.isPinned);
                              try {
                                localStorage.setItem('kibo_clip_history', JSON.stringify(remaining));
                              } catch (_) {}
                              return remaining;
                            });
                            window.kiboAPI?.clearClipboardHistory?.();
                          }}
                          className="config-pill-btn"
                        >
                          Clear Unpinned
                        </button>
                      </div>
                      <div className="config-card-row">
                        <div className="config-row-copy">
                          <div className="config-row-title">Reset To-Do & Routine List</div>
                          <div className="config-row-desc">Clears all completed tasks and scheduled routines</div>
                        </div>
                        <button
                          onClick={() => {
                            setTodos([]);
                            setRoutines([]);
                          }}
                          className="config-pill-btn"
                        >
                          Clear Tasks
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {settingsSection === 'Privacy' && (
                  <>
                    <h2 className="config-panel-heading">Privacy</h2>
                    <p className="config-panel-sub">100% local storage. Your keys and screen captures never touch a middleman server.</p>
                    <div className="config-card-group">
                      <div className="config-card-row">
                        <div className="config-row-copy">
                          <div className="config-row-title">Direct-to-Provider Architecture</div>
                          <div className="config-row-desc" style={{ lineHeight: 1.5 }}>
                            Kibo runs directly on your PC. Voice, screen lasso captures, and search prompts go straight from your machine to Google Gemini and Tavily using your own keys.
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="loadout-compass-stage">
              <div className="loadout-heading-label">Loadout</div>

              <svg
                className="loadout-compass-svg"
                width="880"
                height="492"
                viewBox="0 0 880 492"
              >
                {orbitingNodes.map((n) => (
                  <g key={n.slot}>
                    <path
                      d={n.pathD}
                      stroke={draggingNodeSlot === n.slot ? 'rgba(125, 211, 252, 0.85)' : 'rgba(148, 163, 184, 0.46)'}
                      strokeWidth={draggingNodeSlot === n.slot ? '2.1' : '1.6'}
                      strokeLinecap="round"
                      fill="none"
                    />
                    <circle
                      cx={n.boxEdgeX}
                      cy={n.boxEdgeY}
                      r="2.2"
                      fill={draggingNodeSlot === n.slot ? '#7DD3FC' : 'rgba(148, 163, 184, 0.65)'}
                    />
                    {n.slot === 'Soul' && (
                      <circle
                        cx={n.dotX}
                        cy={n.dotY}
                        r="3.2"
                        fill={isVoidEquipped ? "#C4B5FD" : "#7DD3FC"}
                        style={{ filter: isVoidEquipped ? 'drop-shadow(0 0 6px #A78BFA)' : 'drop-shadow(0 0 6px #38BDF8)' }}
                      />
                    )}
                  </g>
                ))}
              </svg>

              <div
                className="loadout-center-portal-outer breathing"
                style={{
                  position: 'absolute',
                  left: `${STAGE_CENTER_X}px`,
                  top: `${STAGE_CENTER_Y}px`,
                  transform: 'translate(-50%, -50%)',
                  boxShadow: isVoidEquipped ? '0 0 34px rgba(167, 139, 250, 0.42)' : undefined,
                  borderColor: isVoidEquipped ? 'rgba(196, 181, 253, 0.35)' : undefined,
                }}
              >
                <div className="loadout-center-portal-inner">
                  <SoulCanvas soul={currentSoul} width={64} height={54} scale={0.92} mode="LISTENING" />
                </div>
              </div>

              {orbitingNodes.map((n) => (
                <button
                  key={n.slot}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    const p = nodePhysicsRef.current[n.slot];
                    nodeDragStartRef.current = {
                      startX: e.clientX,
                      startY: e.clientY,
                      origX: p.x,
                      origY: p.y,
                      moved: false,
                    };
                    draggingNodeSlotRef.current = n.slot;
                    setDraggingNodeSlot(n.slot);
                  }}
                  className={`loadout-compass-node ${draggingNodeSlot === n.slot ? 'is-dragging' : ''}`}
                  style={{
                    left: `${n.cx}px`,
                    top: `${n.cy}px`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  <span className="node-icon">
                    <SvgIcon name={n.icon} size={13} color={n.iconColor} />
                  </span>
                  <div className="node-copy">
                    <div className="node-title">{getEquippedCardName(n.slot)}</div>
                    <div className="node-sub">{n.slot === 'Soul' ? 'Core' : n.slot}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!activeDeckSlot && (
            <div className="config-bottom-dock-wrap">
              <div className="config-bottom-dock">
                <button
                  onClick={() => {
                    setShowCompanionWindow(false);
                    setIsTucked(false);
                    setIsExpanded(true);
                    setActiveTab('Chat');
                  }}
                  className="dock-icon-btn"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                </button>

                <button
                  onClick={() => {
                    setShowCompanionWindow(false);
                    setIsTucked(false);
                    setIsExpanded(true);
                    setActiveTab('Convert');
                  }}
                  className="dock-icon-btn"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="9" cy="12" r="5" />
                    <circle cx="15" cy="12" r="5" />
                  </svg>
                </button>

                <button
                  onClick={() => setCompanionDockTab('soul')}
                  className={`dock-icon-btn ${companionDockTab === 'soul' ? 'active-pill' : ''}`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="6" width="16" height="12" rx="6" /><circle cx="9.5" cy="12" r="1.5" fill="currentColor" /><circle cx="14.5" cy="12" r="1.5" fill="currentColor" />
                  </svg>
                  {companionDockTab === 'soul' && <span>Loadout</span>}
                </button>

                <button
                  onClick={triggerCleanDictationFlow}
                  className="dock-icon-btn"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 7h16" />
                    <path d="M9 20h6" />
                    <path d="M12 7v13" />
                  </svg>
                </button>

                <button
                  onClick={() => setCompanionDockTab('settings')}
                  className={`dock-icon-btn ${companionDockTab === 'settings' ? 'active-pill' : ''}`}
                >
                  <SvgIcon name="gear" size={15} />
                  {companionDockTab === 'settings' && <span>Settings</span>}
                </button>
              </div>
            </div>
          )}

          {showConnectModal && (
            <div className="connect-modal-backdrop" onClick={() => setShowConnectModal(false)}>
              <div className="connect-modal-card" onClick={(e) => e.stopPropagation()}>
                <h3 className="connect-modal-title">Connect Kibo</h3>
                <p className="connect-modal-p">
                  Watch the full video to learn how to create your Gemini API key and add it to Kibo.
                </p>
                <p className="connect-modal-p secondary">
                  The key belongs to your own Google account, and Google's Gemini API terms apply. On a free key Google may use what you send to improve its products, and people may review it, so use a billing-enabled key for anything private. Google's terms require one for apps used in the European Economic Area, the UK and Switzerland. Kibo is not affiliated with Google.
                </p>

                <input
                  type="password"
                  placeholder="Paste Gemini API key"
                  value={geminiDraftKey}
                  onChange={(e) => setGeminiDraftKey(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveGeminiKey()}
                  className="connect-modal-input"
                  autoFocus
                />

                <button onClick={handleSaveGeminiKey} className="connect-modal-save-btn">
                  Save and start
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {!isExpanded && !showCompanionWindow && contextCard && (
        <div
          className="kibo-context-drop-card"
          onClick={() => {
            if (contextCard.header.includes('Ember Waiting')) {
              handleClaimWaitingEmber();
            } else {
              setContextCard(null);
            }
          }}
        >
          <div className="kibo-context-header">{contextCard.header}</div>
          <div className="kibo-context-main">
            {contextCard.domain ? (
              <img
                src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(contextCard.domain)}&sz=32`}
                alt=""
                style={{ width: '20px', height: '20px', borderRadius: '5px', flexShrink: 0 }}
              />
            ) : (
              <div className="kibo-badge-icon app">
                <SvgIcon name="bolt" size={12} />
              </div>
            )}
            <span className="kibo-context-title">{contextCard.title}</span>
          </div>
          {contextCard.subtitle && <div className="kibo-context-sub">{contextCard.subtitle}</div>}
        </div>
      )}

      {!isExpanded && !showCompanionWindow && askNotchPhase !== 'idle' && (
        <div className="kibo-ask-stage-hud">
          <div className="kibo-voice-pill user-white ask-wide-pill">
            <span className="pill-tag">YOU</span>
            <input
              type="text"
              value={askWords.join(' ')}
              onChange={(e) => {
                const w = e.target.value.split(/\s+/);
                setAskWords(w);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  executeVoiceCommand(askWords.join(' '));
                }
              }}
              placeholder="Ask Kibo..."
              className="kibo-lasso-input"
              style={{ width: '400px' }}
              autoFocus
            />
          </div>
        </div>
      )}

      {captionsEnabled && !isExpanded && askNotchPhase === 'idle' && dictationState === 'idle' && !lassoActive && (userBubbleText || kiboReply) && (
        <div className="kibo-floating-hud-stack">
          {userBubbleText && (
            <div className="kibo-voice-pill user-white">
              <span className="pill-tag">YOU</span>
              <span className="pill-text">{userBubbleText}</span>
            </div>
          )}
          {kiboReply && (
            <div className="kibo-voice-pill kibo-dark">
              <span className="pill-tag">KIBO</span>
              <span className="pill-text">
                {kiboReply.bold && <strong>{kiboReply.bold} </strong>}
                {kiboReply.rest && <span className="muted">{kiboReply.rest}</span>}
              </span>
            </div>
          )}
        </div>
      )}

      {dictationState !== 'idle' && (
        <div className="kibo-dictation-stage">
          {dictationState === 'recording' && (
            <div className="kibo-dictation-card">
              <span className="pill-tag">YOU</span>
              <input
                type="text"
                value={dictationText}
                onChange={(e) => setDictationText(e.target.value)}
                placeholder="Speak or type..."
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' && dictationText.trim()) {
                    let finalClean = dictationText.trim();
                    if (apiKey) {
                      try {
                        const cleaned = await cleanDictation(finalClean, apiKey);
                        if (cleaned && cleaned.trim()) finalClean = cleaned.trim();
                      } catch (_) {}
                    }
                    setDictationText(finalClean);
                    setDictationState('done');
                    await window.kiboAPI?.typeText(finalClean);
                    addEmbers(2);
                    setTimeout(() => setDictationState('idle'), 1400);
                  }
                }}
                className="kibo-lasso-input"
                style={{ width: '480px' }}
                autoFocus
              />
            </div>
          )}

          <div className="kibo-dictation-status-pill" onClick={() => setDictationState('idle')}>
            {dictationState === 'recording' ? (
              <div className="kibo-blue-bars">
                {[0.55, 0.95, 1.0, 0.85, 0.55].map((s, idx) => (
                  <span
                    key={idx}
                    className="companion-wave-bar"
                    style={{
                      height: `${Math.round(s * 14)}px`,
                      background: '#5CB8FF',
                      animationDuration: `${0.4 + idx * 0.1}s`,
                    }}
                  />
                ))}
              </div>
            ) : (
              <span className="kibo-dictation-check">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
            )}
          </div>
        </div>
      )}

      {lassoActive && (
        <div
          className="kibo-lasso-overlay"
          onPointerDown={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setIsDrawingLasso(true);
            const pt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
            setLassoPoints([pt]);
            lassoPointsRef.current = [pt];
          }}
          onPointerMove={(e) => {
            if (!isDrawingLasso) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const pt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
            setLassoPoints((prev) => {
              const updated = [...prev, pt];
              lassoPointsRef.current = updated;
              return updated;
            });
          }}
          onPointerUp={() => setIsDrawingLasso(false)}
        >
          <svg className="kibo-lasso-svg" width="100%" height="100%">
            {lassoPathString && (
              <>
                <path
                  d={lassoPathString}
                  fill="none"
                  stroke="rgba(92, 184, 255, 0.35)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d={lassoPathString}
                  fill="none"
                  stroke="#7CC4FA"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </>
            )}
          </svg>

          <div className="kibo-lasso-hud" onPointerDown={(e) => e.stopPropagation()}>
            <div className="kibo-voice-pill user-white">
              <span className="pill-tag">YOU</span>
              <input
                type="text"
                value={lassoQuery}
                onChange={(e) => {
                  setLassoQuery(e.target.value);
                  lassoQueryRef.current = e.target.value;
                }}
                placeholder="Circle and ask..."
                onKeyDown={async (e) => {
                  if (e.key === 'Enter') {
                    const q = lassoQuery.trim() || 'What is this circled item?';
                    const points = [...lassoPointsRef.current];
                    setLassoActive(false);
                    window.kiboAPI?.setLassoActive?.(false);
                    setAskNotchPhase('thinking');
                    setSoulMode('THINKING');
                    setUserBubbleText(q);
                    try {
                      let shotImage = capturedScreenRef.current;
                      if (!shotImage) {
                        const shot = await window.kiboAPI?.captureScreen();
                        shotImage = shot?.image || '';
                      }
                      const cropped = await cropScreenToLasso(shotImage, points);
                      const answer = await askLassoWithGemini(
                        q,
                        cropped || shotImage || '',
                        apiKey
                      );
                      capturedScreenRef.current = null;
                      setAskNotchPhase('idle');
                      setSoulMode('TALKING');
                      if (answer) {
                  addEmbers(2);
                  showReplyWithSpeech(answer);
                      }
                    } catch (err: any) {
                      setAskNotchPhase('idle');
                      setSoulMode('LISTENING');
                      const errMsg = String(err?.message || '');
                      setKiboReply({ bold: errMsg.includes('429') ? 'Rate limit reached · Please wait a moment' : 'Could not analyze circled region.' });
                      setTimeout(() => setKiboReply(null), 3500);
                    }
                  }
                }}
                className="kibo-lasso-input"
                autoFocus
              />
            </div>
          </div>
        </div>
      )}

      {/* 5. KIBO ROAMING SCREEN POINTER ("PEEK, FLY & POINT") */}
      <RoamingSoulPointer
        soul={currentSoul}
        target={pointedTarget}
        query={roamingQuery}
        stage={roamingStage}
        isVoid={isVoidEquipped}
        onDismiss={() => {
          setRoamingStage('RETURNING');
          soundFX.playSliderTick(50);
        }}
        onTargetClick={() => {
          soundFX.playClick();
        }}
        onReturningDone={() => {
          setRoamingStage('IDLE');
          setPointedTarget(null);
        }}
      />

      

      {/* 6. FLOATING TOP-RIGHT KIBO AGENT SQUIRCLE + HOVER TOAST */}
      <AgentTopRightDock
        tasks={agentTasks}
        soul={currentSoul}
        onOpenAgentsView={() => {
          setIsExpanded(true);
          setActiveTab('Agents');
        }}
        onDockActiveChange={(active, isHovered) => {
          window.kiboAPI?.setAgentDockActive?.({ active, isHovered });
        }}
      />
    </div>
  );
};

