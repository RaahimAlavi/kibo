// src/lib/tauriBridge.ts
// Maps the existing window.kiboAPI interface seamlessly onto native Tauri v2 Rust commands & events.
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';

export function isTauriRuntime(): boolean {
  return (
    typeof window !== 'undefined' &&
    Boolean((window as any).__TAURI_INTERNALS__ || (window as any).__TAURI__)
  );
}

function makeEventSub<T = any>(eventName: string) {
  return (callback: (payload: T) => void) => {
    let unlisten: UnlistenFn | null = null;
    let disposed = false;
    listen<T>(eventName, (event) => {
      if (!disposed) callback(event.payload);
    })
      .then((fn) => {
        if (disposed) {
          fn();
        } else {
          unlisten = fn;
        }
      })
      .catch(() => {});

    return () => {
      disposed = true;
      if (unlisten) {
        try {
          unlisten();
        } catch (_) {}
      }
    };
  };
}

export function initTauriBridge(): void {
  if (!isTauriRuntime()) return;
  if ((window as any).kiboAPI) return; // Keep Electron preload if present

  const api = {
    // Window State & Native Win32 Hitbox Control
    setWindowMode: (mode: string, height?: number) => {
      invoke('set_window_mode', { mode, height }).catch(() => {});
    },
    setWindowBounds: (arg1: any, arg2?: number) => {
      const width = typeof arg1 === 'object' && arg1 !== null ? arg1.width : arg1;
      const height = typeof arg1 === 'object' && arg1 !== null ? arg1.height : arg2;
      invoke('set_window_bounds', { width: Number(width) || 190, height: Number(height) || 18 }).catch(() => {});
    },
    setAppWindowRect: (rect: any) => {
      invoke('set_app_window_rect', { rect: rect || null }).catch(() => {});
    },
    setRoamingTargetRect: (rectOrRects: any) => {
      const rects = !rectOrRects ? null : Array.isArray(rectOrRects) ? rectOrRects : [rectOrRects];
      invoke('set_roaming_target_rect', { rects }).catch(() => {});
    },
    setRoamingActive: (_active: boolean) => {},
    setAgentDockActive: (active: any, isHovered?: boolean) => {
      const payload =
        typeof active === 'object' && active !== null
          ? { active: Boolean(active.active), isHovered: Boolean(active.isHovered) }
          : { active: Boolean(active), isHovered: Boolean(isHovered) };
      invoke('set_agent_dock_active', payload).catch(() => {});
    },
    setExpanded: (_expanded: boolean, _height?: number) => {},
    minimize: () => {
      invoke('minimize_main_window').catch(() => {
        getCurrentWindow().minimize().catch(() => {});
      });
    },
    close: () => {
      getCurrentWindow().close().catch(() => {});
    },
    setShowTaskbar: (show: boolean) => invoke('set_show_taskbar', { show: Boolean(show) }),
    setAlwaysOnTop: (flag: boolean) => invoke('set_always_on_top', { flag: Boolean(flag) }),

    // Dedicated Settings Window & Sync
    openSettingsWindow: (section?: string) => invoke('open_settings_window', { section: section || 'Account' }),
    closeSettingsWindow: () => invoke('close_settings_window'),
    triggerReplayOnboarding: () => invoke('trigger_replay_onboarding'),
    getStoredSettings: () => invoke('get_stored_settings'),
    saveStoredSettings: (patch: Record<string, any>) => invoke('save_stored_settings', { patch }),

    // ElevenLabs Native Async Rust Fetch TTS (returns Uint8Array directly)
    elevenlabsSpeak: async (opts: any) => {
      const bytes = await invoke<number[] | Uint8Array | null>('elevenlabs_speak', { opts: opts || {} });
      if (!bytes) return null;
      if (bytes instanceof Uint8Array) return bytes;
      if (Array.isArray(bytes) && bytes.length > 0) return new Uint8Array(bytes);
      return null;
    },
    elevenlabsCheckStatus: () => invoke('elevenlabs_check_status'),

    // Native WinRT Media & Audio Controls
    getNowPlaying: () => invoke('get_now_playing'),
    mediaControl: (action: string) => invoke('media_control', { action }),
    seekMedia: (seconds: number) => invoke('seek_media', { seconds: Math.max(0, Math.round(seconds || 0)) }),
    getControlsState: () => invoke('get_controls_state'),
    setVolume: (level: number) => invoke('set_volume', { level: Math.round(level) }),
    setMute: (mute: boolean) => invoke('set_mute', { mute: Boolean(mute) }),
    toggleSystemDarkMode: (targetDark: boolean) => invoke('toggle_system_dark_mode', { targetDark: Boolean(targetDark) }),
    toggleWifi: async () => ({ success: false }),
    getWifiNetworks: async () => [],
    toggleBluetooth: async () => ({ success: false }),
    getBluetoothDevices: async () => [],
    toggleNightLight: async () => ({ success: false }),

    // Native Telemetry, Game Stats HUD, Clipboard & Screen Vision
    getSystemStats: () => invoke('get_system_stats'),
    getGameStats: () => invoke('get_game_stats'),
    setGameHudPassthrough: (enabled: boolean) =>
      invoke('set_game_hud_passthrough', { enabled: Boolean(enabled) }),
    runSpeedTest: () => invoke('run_speed_test'),
    getClipboardHistory: () => invoke('get_clipboard_history'),
    deleteClipboardItem: (id: number) => invoke('delete_clipboard_item', { id }),
    togglePinClipboardItem: (id: number) => invoke('toggle_pin_clipboard_item', { id }),
    clearClipboardHistory: () => invoke('clear_clipboard_history'),
    readClipboardText: () => invoke<string>('read_clipboard_text'),
    writeClipboardText: (text: string) => invoke<boolean>('write_clipboard_text', { text: String(text || '') }),
    readClipboardImage: async () => null,
    writeClipboardImage: () => false,
    captureScreen: () => invoke('capture_screen'),
    captureGlassBackdrop: (width = 860, height = 480) =>
      invoke('capture_glass_backdrop', { width, height }),

    // Native Desktop Actions & File Conversion
    openApp: (appName: string) => invoke('open_app', { appName }),
    getInstalledApps: () => invoke('get_installed_apps'),
    openUrl: (url: string) => invoke('open_url', { url }),
    typeText: (text: string) => invoke('type_text', { text }),
    setLassoActive: (active: boolean) => invoke('set_lasso_active', { active: Boolean(active) }),
    scanUIElements: async () => ({ ok: true, elements: [] }),
    executeUIAction: (payload: any) => invoke('execute_ui_action', payload || {}),
    showItemInFolder: (filePath: string) => invoke('show_item_in_folder', { filePath }),
    filterExistingFiles: (filePaths: string[]) => invoke<string[]>('filter_existing_files', { filePaths }),
    convertFile: (payload: any) => invoke('convert_file', { payload: payload || {} }),
    pickFileForConvert: () => invoke('pick_file_for_convert'),
    pickSkillMdFile: () => invoke('pick_skill_md_file'),
    pickWallpaperFiles: () => invoke('pick_wallpaper_files'),
    setWallpaper: (imagePath: string) => invoke('set_wallpaper', { imagePath }),
    getWallpaperDataUrl: (urlOrPath: string) => invoke('get_wallpaper_data_url', { urlOrPath }),
    getCurrentWallpaperTheme: async () => null,
    getStartupSetting: () => invoke<boolean>('get_startup_setting'),
    setStartupSetting: (enabled: boolean) => invoke<boolean>('set_startup_setting', { enabled: Boolean(enabled) }),
    updateTrayColor: async () => ({ success: true }),
    powerAction: (action: string) => invoke('power_action', { action }),
    getShortcuts: () => invoke('get_shortcuts'),
    updateShortcuts: (shortcuts: any) => invoke('update_shortcuts', { shortcuts }),
    getActivePageContext: () => invoke('get_active_page_context'),
    playSpotify: (query: string, targetType?: string) => invoke('play_spotify', { query, targetType }),
    openGeneratedPage: (htmlContent: string, existingFilePath?: string) =>
      invoke('open_generated_page', { htmlContent, existingFilePath }),
    quitApp: () => invoke('quit_app'),
    getFilePath: (file: any) => file?.path || '',

    // Economy / Integrations safe no-op or REST shims
    syncEmbersState: async () => ({ success: true }),
    setEmbersCount: () => {},
    syncWattsState: async () => ({ success: true }),
    setWattsCount: () => {},
    exportChromeExtension: async () => ({ success: false }),
    openChromeExtensionsPage: () => invoke('open_url', { url: 'chrome://extensions' }),
    startExtensionDrag: () => {},
    inspectWebsiteDesign: async () => ({ success: false }),
    syncToNotion: async () => ({ success: false }),
    composioGetStatus: async () => ({ connected: false, accountsCount: 0, accounts: [] }),
    composioConnectApp: async () => ({ success: false }),
    composioGetConnectedAccounts: async () => [],
    composioDisconnectAccount: async () => ({ success: false }),
    composioGetCalendarEvents: async () => ({ success: false, events: [] }),

    // Event Subscriptions (Tauri native events)
    onHotkeyEvent: makeEventSub<string>('hotkey-event'),
    onTriggerLasso: makeEventSub('trigger-lasso'),
    onTriggerDictation: makeEventSub('trigger-dictation'),
    onExpandIsland: makeEventSub('expand-island'),
    onTriggerAsk: makeEventSub('trigger-ask'),
    onOpenSettings: makeEventSub<string>('open-settings'),
    onOpenCompanionTab: makeEventSub<string>('open-companion-tab'),
    onResetOnboarding: makeEventSub('reset-onboarding'),
    onTaskbarSettingChanged: makeEventSub<boolean>('taskbar-setting-changed'),
    onClipboardItemAdded: makeEventSub('clipboard-item-added'),
    onDesktopClickedOutside: makeEventSub('desktop-clicked-outside'),
    onIntegrationNotification: makeEventSub('integration-notification'),
    onRoamingDismiss: makeEventSub('roaming-dismiss'),
    onContextAppDetected: makeEventSub<string | null>('context-app-detected'),
    onFullscreenChanged: makeEventSub<boolean>('context-fullscreen-changed'),
    onCinemaPeek: makeEventSub<boolean>('cinema-peek'),
    onSettingsSynced: makeEventSub<Record<string, any>>('settings-synced'),
    onSettingsNavigate: makeEventSub<string>('settings-navigate'),
    onGamingShieldState: makeEventSub<{ active: boolean; gameName?: string | null }>('gaming-shield-state'),
    onSystemVolumeChanged: makeEventSub<{ volume: number; muted: boolean }>('system-volume-changed'),
    onFileDrag: makeEventSub<{
      kind: 'enter' | 'over' | 'leave' | 'drop';
      filePath?: string;
      fileName?: string;
      ext?: string;
      sizeBytes?: number;
      textContent?: string | null;
    }>('kibo-file-drag'),
    onClaimDailyEmber: makeEventSub('claim-daily-ember'),
    onGrantCreatorEmbers: makeEventSub<number>('grant-creator-embers'),
    onClaimDailyWatt: makeEventSub('claim-daily-ember'),
    onGrantCreatorWatts: makeEventSub<number>('grant-creator-embers'),
  };

  (window as any).kiboAPI = api;
}
