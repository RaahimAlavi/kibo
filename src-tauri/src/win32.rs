use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use image::{ImageBuffer, Rgb};
use serde::{Deserialize, Serialize};
use std::ffi::OsStr;
use std::io::Cursor;
use std::os::windows::ffi::OsStrExt;
use std::path::Path;

use windows::core::{Interface, PCWSTR, PWSTR};
use windows::Win32::Foundation::{CloseHandle, BOOL, HWND, POINT, RECT, S_OK};
use windows::Win32::Graphics::Dwm::{DwmGetCompositionTimingInfo, DWM_TIMING_INFO};
use windows::Win32::Graphics::Gdi::{
    BitBlt, CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject, GetDC, GetDIBits,
    GetMonitorInfoW, MonitorFromWindow, ReleaseDC, SelectObject, BITMAPINFO, BITMAPINFOHEADER,
    BI_RGB, DIB_RGB_COLORS, MONITORINFO, MONITOR_DEFAULTTONEAREST, SRCCOPY,
};
use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
use windows::Win32::Media::Audio::{
    eMultimedia, eRender, AudioSessionStateActive, IAudioSessionControl2, IAudioSessionManager2,
    IMMDeviceEnumerator, ISimpleAudioVolume, MMDeviceEnumerator,
};
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED,
};
use windows::Win32::System::Power::SetSuspendState;
use windows::Win32::System::Registry::{
    RegCloseKey, RegDeleteValueW, RegOpenKeyExW, RegQueryValueExW, RegSetValueExW,
    HKEY_CURRENT_USER, KEY_READ, KEY_WRITE, REG_DWORD, REG_SZ,
};
use windows::Win32::System::Shutdown::LockWorkStation;
use windows::Win32::System::Threading::{
    OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION,
};
use windows::Win32::UI::Input::KeyboardAndMouse::{
    GetAsyncKeyState, SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, INPUT_MOUSE, KEYBDINPUT,
    KEYEVENTF_KEYUP, MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP, MOUSEEVENTF_RIGHTDOWN,
    MOUSEEVENTF_RIGHTUP, MOUSEINPUT, VIRTUAL_KEY, VK_CONTROL, VK_LWIN, VK_MEDIA_NEXT_TRACK,
    VK_MEDIA_PLAY_PAUSE, VK_MEDIA_PREV_TRACK, VK_MENU, VK_RETURN, VK_RWIN, VK_SHIFT,
};
use windows::Win32::UI::Shell::{
    SHQueryUserNotificationState, QUNS_PRESENTATION_MODE, QUNS_RUNNING_D3D_FULL_SCREEN,
};
use windows::Win32::UI::WindowsAndMessaging::{
    GetClassNameW, GetCursorPos, GetForegroundWindow, GetSystemMetrics, GetWindowLongW,
    GetWindowRect, GetWindowTextW, GetWindowThreadProcessId, SetCursorPos, SetWindowPos,
    SystemParametersInfoW, GWL_STYLE, HWND_NOTOPMOST, HWND_TOPMOST, SM_CXSCREEN, SM_CYSCREEN,
    SPIF_SENDCHANGE, SPIF_UPDATEINIFILE, SPI_SETDESKWALLPAPER, SWP_NOACTIVATE, SWP_NOMOVE,
    SWP_NOSIZE, WS_CAPTION,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForegroundInfo {
    pub title: String,
    pub proc_name: String,
    pub class_name: String,
    pub fullscreen: bool,
}

fn to_wide(s: &str) -> Vec<u16> {
    OsStr::new(s).encode_wide().chain(std::iter::once(0)).collect()
}

pub fn get_cursor_pos() -> (i32, i32) {
    unsafe {
        let mut pt = POINT::default();
        if GetCursorPos(&mut pt).is_ok() {
            (pt.x, pt.y)
        } else {
            (0, 0)
        }
    }
}

pub fn get_primary_screen_size() -> (i32, i32) {
    unsafe {
        let w = GetSystemMetrics(SM_CXSCREEN).max(800);
        let h = GetSystemMetrics(SM_CYSCREEN).max(600);
        (w, h)
    }
}

/// 100% read-only Windows DWM composition timing snapshot (zero hooks, zero DLL injection, anti-cheat safe).
/// Returns (frames_completed, refresh_hz, frame_period_ms).
pub fn sample_dwm_timing() -> Option<(u64, f64, f64)> {
    unsafe {
        let mut info = DWM_TIMING_INFO {
            cbSize: std::mem::size_of::<DWM_TIMING_INFO>() as u32,
            ..Default::default()
        };
        if DwmGetCompositionTimingInfo(HWND::default(), &mut info).is_ok() {
            let hz = if info.rateRefresh.uiDenominator > 0 {
                (info.rateRefresh.uiNumerator as f64) / (info.rateRefresh.uiDenominator as f64)
            } else {
                60.0
            };
            let hz_clamped = hz.clamp(30.0, 540.0);
            let period_ms = 1000.0 / hz_clamped;
            let count = info.cFrameDisplayed.max(info.cFrameConfirmed).max(info.cFrameComplete);
            Some((count, hz_clamped, period_ms))
        } else {
            None
        }
    }
}

pub fn get_foreground_info() -> ForegroundInfo {
    unsafe {
        let hwnd: HWND = GetForegroundWindow();
        if hwnd.0.is_null() {
            return ForegroundInfo {
                title: String::new(),
                proc_name: String::new(),
                class_name: String::new(),
                fullscreen: false,
            };
        }

        let mut title_buf = [0u16; 512];
        let t_len = GetWindowTextW(hwnd, &mut title_buf);
        let title = if t_len > 0 {
            String::from_utf16_lossy(&title_buf[..t_len as usize])
        } else {
            String::new()
        };

        let mut cls_buf = [0u16; 128];
        let c_len = GetClassNameW(hwnd, &mut cls_buf);
        let class_name = if c_len > 0 {
            String::from_utf16_lossy(&cls_buf[..c_len as usize])
        } else {
            String::new()
        };

        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        let mut proc_name = String::new();
        if pid > 0 {
            if let Ok(handle) = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) {
                let mut path_buf = [0u16; 512];
                let mut size = path_buf.len() as u32;
                if QueryFullProcessImageNameW(
                    handle,
                    PROCESS_NAME_WIN32,
                    PWSTR(path_buf.as_mut_ptr()),
                    &mut size,
                )
                .is_ok()
                {
                    let full = String::from_utf16_lossy(&path_buf[..size as usize]);
                    if let Some(stem) = Path::new(&full).file_stem().and_then(|s| s.to_str()) {
                        proc_name = stem.to_string();
                    }
                }
                let _ = CloseHandle(handle);
            }
        }

        let fullscreen = is_true_fullscreen(hwnd, &proc_name, &class_name);

        ForegroundInfo {
            title,
            proc_name,
            class_name,
            fullscreen,
        }
    }
}

unsafe fn is_true_fullscreen(hwnd: HWND, proc_name: &str, class_name: &str) -> bool {
    let p_lower = proc_name.to_lowercase();
    if matches!(
        p_lower.as_str(),
        "explorer"
            | "kibo"
            | "electron"
            | "searchhost"
            | "shellexperiencehost"
            | "startmenuexperiencehost"
            | "applicationframehost"
    ) {
        return false;
    }

    if matches!(
        class_name,
        "Progman"
            | "WorkerW"
            | "Shell_TrayWnd"
            | "Shell_SecondaryTrayWnd"
            | "NotifyIconOverflowWindow"
            | "TaskListThumbnailWnd"
            | "MultitaskingViewFrame"
            | "Windows.UI.Core.CoreWindow"
            | "ForegroundStaging"
            | "XamlExplorerHostIslandWindow"
    ) {
        return false;
    }

    let mut rect = RECT::default();
    if GetWindowRect(hwnd, &mut rect).is_err() {
        return false;
    }

    let hmon = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
    let mut mi = MONITORINFO {
        cbSize: std::mem::size_of::<MONITORINFO>() as u32,
        ..Default::default()
    };
    if !GetMonitorInfoW(hmon, &mut mi).as_bool() {
        return false;
    }

    let covers_monitor = rect.left <= mi.rcMonitor.left
        && rect.top <= mi.rcMonitor.top
        && rect.right >= mi.rcMonitor.right
        && rect.bottom >= mi.rcMonitor.bottom;
    if !covers_monitor {
        return false;
    }

    let style = GetWindowLongW(hwnd, GWL_STYLE) as u32;
    let has_caption = (style & WS_CAPTION.0) == WS_CAPTION.0;
    let quns_fs = SHQueryUserNotificationState()
        .map(|s| s == QUNS_RUNNING_D3D_FULL_SCREEN || s == QUNS_PRESENTATION_MODE)
        .unwrap_or(false);

    (!has_caption) || quns_fs
}

pub fn is_vk_down(vk: i32) -> bool {
    unsafe { (GetAsyncKeyState(vk) as u16 & 0x8000) != 0 }
}

/// Returns true if the foreground window is a PC game (known game binary or exclusive D3D fullscreen app).
/// Completely read-only Win32 query (zero injection, zero hooks, 100% anti-cheat safe).
pub fn is_game_foreground(info: &ForegroundInfo) -> bool {
    let p = info.proc_name.to_lowercase();
    if p.is_empty() {
        return false;
    }

    // Never classify browsers, editors, shell, or productivity tools as games
    if matches!(
        p.as_str(),
        "explorer"
            | "kibo"
            | "electron"
            | "chrome"
            | "msedge"
            | "firefox"
            | "brave"
            | "opera"
            | "vivaldi"
            | "arc"
            | "code"
            | "cursor"
            | "devenv"
            | "idea64"
            | "webstorm64"
            | "pycharm64"
            | "spotify"
            | "discord"
            | "slack"
            | "notion"
            | "figma"
            | "vlc"
            | "mpv"
            | "obs64"
            | "windowsterminal"
            | "powershell"
            | "pwsh"
            | "cmd"
            | "taskmgr"
            | "applicationframehost"
    ) {
        return false;
    }

    // Known popular PC games & engines
    let known_game_tokens = [
        "valorant",
        "cs2",
        "csgo",
        "fortnite",
        "sekiro",
        "tekken",
        "roblox",
        "league of legends",
        "r5apex",
        "overwatch",
        "rainbowsix",
        "gta5",
        "gtav",
        "rdr2",
        "eldenring",
        "minecraft",
        "dota2",
        "tslgame",
        "cod",
        "warzone",
        "osu!",
        "genshinimpact",
        "starrail",
        "cyberpunk2077",
        "bg3",
        "helldivers",
        "marvel",
        "deadlock",
        "rocketleague",
        "eafc",
        "fc24",
        "fc25",
        "fc26",
        "muck",
        "ghostoftsushima",
        "gow",
        "godofwar",
        "aimlab",
        "heartopia",
        "wewerehere",
        "froggy",
        "witcher3",
        "pubg",
        "destiny2",
        "warframe",
        "palworld",
        "lethal company",
        "among us",
        "stardew",
        "hollow_knight",
        "hades",
        "win64-shipping",
    ];
    if known_game_tokens.iter().any(|tok| p.contains(tok)) {
        return true;
    }

    // Check D3D exclusive fullscreen notification state or borderless fullscreen non-productivity app
    let quns_d3d = unsafe {
        SHQueryUserNotificationState()
            .map(|s| s == QUNS_RUNNING_D3D_FULL_SCREEN)
            .unwrap_or(false)
    };
    quns_d3d || info.fullscreen
}

/// Checks if any OTHER key (outside the configured hotkey combo) is currently pressed,
/// preventing multi-key shortcuts like Ctrl+Shift+T, Ctrl+Shift+V, or Ctrl+Shift+W from falsely firing Kibo.
pub fn is_any_extra_key_down(combo: &str) -> bool {
    let parts: Vec<String> = combo
        .split('+')
        .map(|s| s.trim().to_lowercase())
        .filter(|s| !s.is_empty())
        .collect();

    let wants_win = parts.iter().any(|p| matches!(p.as_str(), "win" | "super" | "meta"));
    let wants_alt = parts.iter().any(|p| p == "alt");
    let wants_ctrl = parts.iter().any(|p| matches!(p.as_str(), "ctrl" | "control"));
    let wants_shift = parts.iter().any(|p| p == "shift");
    let wants_space = parts.iter().any(|p| p == "space");

    if !wants_win && (is_vk_down(VK_LWIN.0 as i32) || is_vk_down(VK_RWIN.0 as i32)) {
        return true;
    }
    if !wants_alt && is_vk_down(VK_MENU.0 as i32) {
        return true;
    }
    if !wants_ctrl && is_vk_down(VK_CONTROL.0 as i32) {
        return true;
    }
    if !wants_shift && is_vk_down(VK_SHIFT.0 as i32) {
        return true;
    }
    if !wants_space && is_vk_down(0x20) {
        return true;
    }

    let allowed_chars: Vec<i32> = parts
        .iter()
        .filter(|p| p.len() == 1)
        .map(|p| p.as_bytes()[0].to_ascii_uppercase() as i32)
        .collect();

    // Check A-Z, 0-9
    for vk in 0x30..=0x39 {
        if !allowed_chars.contains(&vk) && is_vk_down(vk) {
            return true;
        }
    }
    for vk in 0x41..=0x5A {
        if !allowed_chars.contains(&vk) && is_vk_down(vk) {
            return true;
        }
    }
    // Check common navigation/editing/function keys (Tab, Enter, Esc, Backspace, Delete, Arrows, F1-F12)
    let extra_vks = [
        0x08, 0x09, 0x0D, 0x1B, 0x25, 0x26, 0x27, 0x28, 0x2E, 0x70, 0x71, 0x72, 0x73, 0x74, 0x75,
        0x76, 0x77, 0x78, 0x79, 0x7A, 0x7B,
    ];
    for vk in extra_vks {
        if is_vk_down(vk) {
            return true;
        }
    }
    false
}

pub fn check_hotkey_combo(combo: &str) -> bool {
    let parts: Vec<String> = combo
        .split('+')
        .map(|s| s.trim().to_lowercase())
        .filter(|s| !s.is_empty())
        .collect();
    if parts.is_empty() {
        return false;
    }
    for part in parts {
        let down = match part.as_str() {
            "win" | "super" | "meta" => is_vk_down(VK_LWIN.0 as i32) || is_vk_down(VK_RWIN.0 as i32),
            "alt" => is_vk_down(VK_MENU.0 as i32),
            "ctrl" | "control" => is_vk_down(VK_CONTROL.0 as i32),
            "shift" => is_vk_down(VK_SHIFT.0 as i32),
            "space" => is_vk_down(0x20),
            s if s.len() == 1 => {
                let ch = s.as_bytes()[0].to_ascii_uppercase() as i32;
                is_vk_down(ch)
            }
            _ => false,
        };
        if !down {
            return false;
        }
    }
    true
}

fn with_audio_endpoint<T, F: FnOnce(&IAudioEndpointVolume) -> Result<T, String>>(f: F) -> Result<T, String> {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        let enumerator: IMMDeviceEnumerator =
            CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL).map_err(|e| e.to_string())?;
        let device = enumerator
            .GetDefaultAudioEndpoint(eRender, eMultimedia)
            .map_err(|e| e.to_string())?;
        let vol: IAudioEndpointVolume = device
            .Activate(CLSCTX_ALL, None)
            .map_err(|e| e.to_string())?;
        f(&vol)
    }
}

pub fn get_system_volume_and_mute() -> (i32, bool) {
    with_audio_endpoint(|vol| unsafe {
        let scalar = vol.GetMasterVolumeLevelScalar().map_err(|e| e.to_string())?;
        let muted = vol.GetMute().map_err(|e| e.to_string())?.as_bool();
        Ok(((scalar * 100.0).round() as i32, muted))
    })
    .unwrap_or((50, false))
}

pub fn set_system_volume(level: i32) -> Result<i32, String> {
    let clamped = level.clamp(0, 100);
    with_audio_endpoint(|vol| unsafe {
        vol.SetMasterVolumeLevelScalar(clamped as f32 / 100.0, std::ptr::null())
            .map_err(|e| e.to_string())?;
        if clamped > 0 {
            let _ = vol.SetMute(BOOL(0), std::ptr::null());
        }
        Ok(clamped)
    })
}

pub fn set_system_mute(mute: bool) -> Result<bool, String> {
    with_audio_endpoint(|vol| unsafe {
        vol.SetMute(BOOL(if mute { 1 } else { 0 }), std::ptr::null())
            .map_err(|e| e.to_string())?;
        Ok(mute)
    })
}

/// Reliably elevates or demotes a Windows HWND via Win32 SetWindowPos(HWND_TOPMOST / HWND_NOTOPMOST).
pub fn force_window_topmost(hwnd_raw: isize, topmost: bool) {
    if hwnd_raw == 0 {
        return;
    }
    unsafe {
        let hwnd = HWND(hwnd_raw as *mut std::ffi::c_void);
        let z_after = if topmost { HWND_TOPMOST } else { HWND_NOTOPMOST };
        let _ = SetWindowPos(
            hwnd,
            z_after,
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
        );
    }
}

fn process_name_for_pid(pid: u32) -> String {
    if pid == 0 {
        return String::new();
    }
    unsafe {
        if let Ok(hproc) = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) {
            let mut path_buf = [0u16; 512];
            let mut path_len = path_buf.len() as u32;
            let name = if QueryFullProcessImageNameW(
                hproc,
                PROCESS_NAME_WIN32,
                PWSTR(path_buf.as_mut_ptr()),
                &mut path_len,
            )
            .is_ok()
            {
                let full = String::from_utf16_lossy(&path_buf[..path_len as usize]);
                Path::new(&full)
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("")
                    .to_lowercase()
            } else {
                String::new()
            };
            let _ = CloseHandle(hproc);
            name
        } else {
            String::new()
        }
    }
}

fn build_media_app_tokens(source_hint: &str) -> Vec<String> {
    let low = source_hint.trim().to_lowercase();
    let mut tokens: Vec<String> = Vec::new();
    if low.contains("spotify") {
        tokens.push("spotify".into());
    } else if low.contains("chrome") {
        tokens.push("chrome".into());
    } else if low.contains("msedge") || low.contains("edge") {
        tokens.push("msedge".into());
        tokens.push("edge".into());
    } else if low.contains("brave") {
        tokens.push("brave".into());
    } else if low.contains("firefox") {
        tokens.push("firefox".into());
    } else if low.contains("opera") {
        tokens.push("opera".into());
    } else if low.contains("vivaldi") {
        tokens.push("vivaldi".into());
    } else if low.contains("arc") {
        tokens.push("arc".into());
    } else if low.contains("vlc") {
        tokens.push("vlc".into());
    } else if low.contains("mpv") {
        tokens.push("mpv".into());
    } else if low.contains("zune") || low.contains("media.player") || low.contains("wmplayer") {
        tokens.push("microsoft.media.player".into());
        tokens.push("music.ui".into());
        tokens.push("wmplayer".into());
    } else if low.contains("apple") || low.contains("itunes") {
        tokens.push("applemusic".into());
        tokens.push("itunes".into());
    } else if low.contains("tidal") {
        tokens.push("tidal".into());
    } else if low.contains("foobar") {
        tokens.push("foobar2000".into());
    } else if low.contains("musicbee") {
        tokens.push("musicbee".into());
    } else if low.contains("netflix") {
        tokens.push("netflix".into());
        tokens.push("wwahost".into());
        tokens.push("msedge".into());
        tokens.push("chrome".into());
    } else if !low.is_empty() && low != "media player" {
        let stem = low
            .split(|c: char| c == '!' || c == '\\' || c == '/' || c == ' ' || c == '.')
            .find(|seg| seg.len() >= 3 && *seg != "exe" && *seg != "com")
            .unwrap_or(&low);
        tokens.push(stem.to_string());
    }
    tokens
}

fn pretty_app_label(proc_low: &str) -> String {
    match proc_low {
        "spotify" => "Spotify".into(),
        "chrome" => "Chrome".into(),
        "msedge" => "Edge".into(),
        "brave" => "Brave".into(),
        "firefox" => "Firefox".into(),
        "opera" => "Opera".into(),
        "vivaldi" => "Vivaldi".into(),
        "arc" => "Arc".into(),
        "vlc" => "VLC".into(),
        "applemusic" => "Apple Music".into(),
        "itunes" => "iTunes".into(),
        "tidal" => "TIDAL".into(),
        other if !other.is_empty() => {
            let mut c = other.chars();
            match c.next() {
                None => "Media".into(),
                Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
            }
        }
        _ => "Media".into(),
    }
}

fn find_matching_media_sessions(source_hint: &str) -> Vec<(ISimpleAudioVolume, String, bool)> {
    let tokens = build_media_app_tokens(source_hint);
    let mut name_matches: Vec<(ISimpleAudioVolume, String, bool)> = Vec::new();
    let mut active_fallback: Vec<(ISimpleAudioVolume, String, String)> = Vec::new();

    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        let Ok(enumerator): Result<IMMDeviceEnumerator, _> =
            CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
        else {
            return Vec::new();
        };
        let Ok(device) = enumerator.GetDefaultAudioEndpoint(eRender, eMultimedia) else {
            return Vec::new();
        };
        let Ok(mgr): Result<IAudioSessionManager2, _> = device.Activate(CLSCTX_ALL, None) else {
            return Vec::new();
        };
        let Ok(session_enum) = mgr.GetSessionEnumerator() else {
            return Vec::new();
        };
        let Ok(count) = session_enum.GetCount() else {
            return Vec::new();
        };

        for idx in 0..count {
            let Ok(ctrl) = session_enum.GetSession(idx) else {
                continue;
            };
            let Ok(ctrl2) = ctrl.cast::<IAudioSessionControl2>() else {
                continue;
            };
            if ctrl2.IsSystemSoundsSession() == S_OK {
                continue;
            }
            let pid = ctrl2.GetProcessId().unwrap_or(0);
            if pid == 0 {
                continue;
            }
            let proc_name = process_name_for_pid(pid);
            if proc_name.is_empty() || proc_name == "kibo" {
                continue;
            }
            let is_active = ctrl.GetState().map(|s| s == AudioSessionStateActive).unwrap_or(false);
            let Ok(vol) = ctrl.cast::<ISimpleAudioVolume>() else {
                continue;
            };

            let matched_hint = !tokens.is_empty()
                && tokens.iter().any(|tok| proc_name.contains(tok.as_str()));

            if matched_hint {
                name_matches.push((vol, pretty_app_label(&proc_name), is_active));
            } else if is_active
                && !matches!(
                    proc_name.as_str(),
                    "discord" | "teams" | "ms-teams" | "zoom" | "slack" | "obs64"
                )
            {
                active_fallback.push((vol, pretty_app_label(&proc_name), proc_name));
            }
        }
    }

    if !name_matches.is_empty() {
        name_matches
    } else if let Some((_, _, first_proc)) = active_fallback.first() {
        let target_proc = first_proc.clone();
        active_fallback
            .into_iter()
            .filter(|(_, _, p)| *p == target_proc)
            .map(|(vol, label, _)| (vol, label, true))
            .collect()
    } else {
        Vec::new()
    }
}

/// Reads the per-application volume & mute state for the currently playing media app (Spotify, Chrome, Edge, etc.).
pub fn get_app_media_volume(source_hint: &str) -> Option<(i32, bool, String)> {
    let sessions = find_matching_media_sessions(source_hint);
    let chosen = sessions
        .iter()
        .find(|(_, _, active)| *active)
        .or_else(|| sessions.first())?;
    unsafe {
        let scalar = chosen.0.GetMasterVolume().ok()?;
        let muted = chosen.0.GetMute().ok()?.as_bool();
        Some(((scalar * 100.0).round() as i32, muted, chosen.1.clone()))
    }
}

/// Sets per-application volume ONLY on the playing media app (leaves games, Discord, and system volume untouched).
pub fn set_app_media_volume(source_hint: &str, level: i32) -> Result<(i32, String), String> {
    let clamped = level.clamp(0, 100);
    let sessions = find_matching_media_sessions(source_hint);
    if sessions.is_empty() {
        return Err("No active media audio session found".into());
    }
    let label = sessions[0].1.clone();
    unsafe {
        for (vol, _, _) in &sessions {
            let _ = vol.SetMasterVolume(clamped as f32 / 100.0, std::ptr::null());
            if clamped > 0 {
                let _ = vol.SetMute(BOOL(0), std::ptr::null());
            }
        }
    }
    Ok((clamped, label))
}

/// Sets per-application mute ONLY on the playing media app.
pub fn set_app_media_mute(source_hint: &str, mute: bool) -> Result<(bool, String), String> {
    let sessions = find_matching_media_sessions(source_hint);
    if sessions.is_empty() {
        return Err("No active media audio session found".into());
    }
    let label = sessions[0].1.clone();
    unsafe {
        for (vol, _, _) in &sessions {
            let _ = vol.SetMute(BOOL(if mute { 1 } else { 0 }), std::ptr::null());
        }
    }
    Ok((mute, label))
}

fn send_vk_tap(vk: VIRTUAL_KEY) {
    unsafe {
        let inputs = [
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: vk,
                        ..Default::default()
                    },
                },
            },
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: vk,
                        dwFlags: KEYEVENTF_KEYUP,
                        ..Default::default()
                    },
                },
            },
        ];
        SendInput(&inputs, std::mem::size_of::<INPUT>() as i32);
    }
}

pub fn send_media_key(action: &str) {
    match action.to_lowercase().as_str() {
        "playpause" | "play" | "pause" | "toggle" => send_vk_tap(VK_MEDIA_PLAY_PAUSE),
        "next" => send_vk_tap(VK_MEDIA_NEXT_TRACK),
        "prev" | "previous" => send_vk_tap(VK_MEDIA_PREV_TRACK),
        _ => {}
    }
}

pub fn send_ctrl_v(press_enter: bool) {
    unsafe {
        let vk_v = VIRTUAL_KEY(0x56);
        let inputs = [
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: VK_CONTROL,
                        ..Default::default()
                    },
                },
            },
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: vk_v,
                        ..Default::default()
                    },
                },
            },
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: vk_v,
                        dwFlags: KEYEVENTF_KEYUP,
                        ..Default::default()
                    },
                },
            },
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: VK_CONTROL,
                        dwFlags: KEYEVENTF_KEYUP,
                        ..Default::default()
                    },
                },
            },
        ];
        SendInput(&inputs, std::mem::size_of::<INPUT>() as i32);
        if press_enter {
            std::thread::sleep(std::time::Duration::from_millis(55));
            send_vk_tap(VK_RETURN);
        }
    }
}

pub fn mouse_click(x: i32, y: i32, double_click: bool, right_click: bool) {
    unsafe {
        let _ = SetCursorPos(x, y);
        let (down_flag, up_flag) = if right_click {
            (MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP)
        } else {
            (MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP)
        };
        let click_once = || {
            let inputs = [
                INPUT {
                    r#type: INPUT_MOUSE,
                    Anonymous: INPUT_0 {
                        mi: MOUSEINPUT {
                            dwFlags: down_flag,
                            ..Default::default()
                        },
                    },
                },
                INPUT {
                    r#type: INPUT_MOUSE,
                    Anonymous: INPUT_0 {
                        mi: MOUSEINPUT {
                            dwFlags: up_flag,
                            ..Default::default()
                        },
                    },
                },
            ];
            SendInput(&inputs, std::mem::size_of::<INPUT>() as i32);
        };
        click_once();
        if double_click {
            std::thread::sleep(std::time::Duration::from_millis(65));
            click_once();
        }
    }
}

pub fn capture_primary_screen_jpeg_data_url() -> Result<String, String> {
    unsafe {
        let width = GetSystemMetrics(SM_CXSCREEN);
        let height = GetSystemMetrics(SM_CYSCREEN);
        if width <= 0 || height <= 0 {
            return Err("Invalid screen dimensions".into());
        }

        let hdc_screen = GetDC(HWND::default());
        if hdc_screen.is_invalid() {
            return Err("GetDC failed".into());
        }
        let hdc_mem = CreateCompatibleDC(hdc_screen);
        let hbm = CreateCompatibleBitmap(hdc_screen, width, height);
        let old_obj = SelectObject(hdc_mem, hbm);

        let blt_ok = BitBlt(hdc_mem, 0, 0, width, height, hdc_screen, 0, 0, SRCCOPY).is_ok();

        let mut bmi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: width,
                biHeight: -height, // top-down DIB
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0,
                ..Default::default()
            },
            ..Default::default()
        };

        let mut bgra = vec![0u8; (width * height * 4) as usize];
        let rows = if blt_ok {
            GetDIBits(
                hdc_mem,
                hbm,
                0,
                height as u32,
                Some(bgra.as_mut_ptr() as *mut _),
                &mut bmi,
                DIB_RGB_COLORS,
            )
        } else {
            0
        };

        SelectObject(hdc_mem, old_obj);
        let _ = DeleteObject(hbm);
        let _ = DeleteDC(hdc_mem);
        ReleaseDC(HWND::default(), hdc_screen);

        if rows == 0 {
            return Err("BitBlt/GetDIBits failed".into());
        }

        let mut rgb_bytes = Vec::with_capacity((width * height * 3) as usize);
        for chunk in bgra.chunks_exact(4) {
            rgb_bytes.push(chunk[2]);
            rgb_bytes.push(chunk[1]);
            rgb_bytes.push(chunk[0]);
        }

        let img: ImageBuffer<Rgb<u8>, Vec<u8>> =
            ImageBuffer::from_raw(width as u32, height as u32, rgb_bytes)
                .ok_or_else(|| "Failed to build RGB buffer".to_string())?;

        // Downscale wide displays slightly to keep vision payloads fast (<250 KB)
        let final_img = if width > 1440 {
            let new_h = ((height as f64) * (1440.0 / width as f64)).round() as u32;
            image::imageops::resize(&img, 1440, new_h, image::imageops::FilterType::Triangle)
        } else {
            img
        };

        let mut out = Cursor::new(Vec::new());
        let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut out, 78);
        encoder
            .encode(
                final_img.as_raw(),
                final_img.width(),
                final_img.height(),
                image::ExtendedColorType::Rgb8,
            )
            .map_err(|e| e.to_string())?;

        Ok(format!(
            "data:image/jpeg;base64,{}",
            BASE64.encode(out.into_inner())
        ))
    }
}

/// Ultra-fast (<4ms) capture of only the top-center desktop strip behind Kibo's notch,
/// downscaled & Gaussian-blurred natively in Rust to power genuine real-time frosted glass
/// inside curved Classic & Floating notch shapes (while remaining 100% visible in screenshots).
pub fn capture_notch_glass_backdrop(logical_w: i32, logical_h: i32, scale: f64) -> Result<String, String> {
    unsafe {
        let screen_w = GetSystemMetrics(SM_CXSCREEN);
        let screen_h = GetSystemMetrics(SM_CYSCREEN);
        if screen_w <= 0 || screen_h <= 0 {
            return Err("Invalid screen dimensions".into());
        }

        let cap_w = ((logical_w as f64) * scale).round().clamp(240.0, screen_w as f64) as i32;
        let cap_h = ((logical_h as f64) * scale).round().clamp(120.0, screen_h as f64) as i32;
        let src_x = ((screen_w - cap_w) / 2).max(0);

        let hdc_screen = GetDC(HWND::default());
        if hdc_screen.is_invalid() {
            return Err("GetDC failed".into());
        }
        let hdc_mem = CreateCompatibleDC(hdc_screen);
        let hbm = CreateCompatibleBitmap(hdc_screen, cap_w, cap_h);
        let old_obj = SelectObject(hdc_mem, hbm);

        let blt_ok = BitBlt(hdc_mem, 0, 0, cap_w, cap_h, hdc_screen, src_x, 0, SRCCOPY).is_ok();

        let mut bmi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: cap_w,
                biHeight: -cap_h,
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0,
                ..Default::default()
            },
            ..Default::default()
        };

        let mut bgra = vec![0u8; (cap_w * cap_h * 4) as usize];
        let rows = if blt_ok {
            GetDIBits(
                hdc_mem,
                hbm,
                0,
                cap_h as u32,
                Some(bgra.as_mut_ptr() as *mut _),
                &mut bmi,
                DIB_RGB_COLORS,
            )
        } else {
            0
        };

        SelectObject(hdc_mem, old_obj);
        let _ = DeleteObject(hbm);
        let _ = DeleteDC(hdc_mem);
        ReleaseDC(HWND::default(), hdc_screen);

        if rows == 0 {
            return Err("BitBlt/GetDIBits failed".into());
        }

        // Smoothly replace the tiny tucked-pill band at the very top center with clean pixels right below it
        // so the tucked notch never leaves a dark smudge inside the frosted glass when expanding.
        let clean_row_y = ((34.0 * scale).round() as usize).min((cap_h as usize).saturating_sub(1));
        let pill_half_w = ((115.0 * scale).round() as usize).min((cap_w as usize) / 2);
        let center_x = (cap_w as usize) / 2;
        let x_start = center_x.saturating_sub(pill_half_w);
        let x_end = (center_x + pill_half_w).min(cap_w as usize);
        let stride = (cap_w as usize) * 4;
        for y in 0..clean_row_y {
            let dst_off = y * stride;
            let src_off = clean_row_y * stride;
            for x in x_start..x_end {
                let di = dst_off + x * 4;
                let si = src_off + x * 4;
                bgra[di] = bgra[si];
                bgra[di + 1] = bgra[si + 1];
                bgra[di + 2] = bgra[si + 2];
                bgra[di + 3] = bgra[si + 3];
            }
        }

        let mut rgb_bytes = Vec::with_capacity((cap_w * cap_h * 3) as usize);
        for chunk in bgra.chunks_exact(4) {
            rgb_bytes.push(chunk[2]);
            rgb_bytes.push(chunk[1]);
            rgb_bytes.push(chunk[0]);
        }

        let img: ImageBuffer<Rgb<u8>, Vec<u8>> =
            ImageBuffer::from_raw(cap_w as u32, cap_h as u32, rgb_bytes)
                .ok_or_else(|| "Failed to build strip RGB buffer".to_string())?;

        // Downscale to compact 160px wide + creamy native Gaussian blur (7.2 sigma) so CSS needs zero blur filter
        // and Classic concave SVG clip-paths stay 100% razor-sharp!
        let small_w = 160u32;
        let small_h = (((cap_h as f64) * (small_w as f64 / cap_w as f64)).round() as u32).max(40);
        let small = image::imageops::resize(&img, small_w, small_h, image::imageops::FilterType::Triangle);
        let blurred = image::imageops::blur(&small, 7.2);

        let mut out = Cursor::new(Vec::new());
        let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut out, 82);
        encoder
            .encode(
                blurred.as_raw(),
                blurred.width(),
                blurred.height(),
                image::ExtendedColorType::Rgb8,
            )
            .map_err(|e| e.to_string())?;

        Ok(format!(
            "data:image/jpeg;base64,{}",
            BASE64.encode(out.into_inner())
        ))
    }
}

pub fn set_desktop_wallpaper(image_path: &str) -> Result<(), String> {
    let wide = to_wide(image_path);
    unsafe {
        SystemParametersInfoW(
            SPI_SETDESKWALLPAPER,
            0,
            Some(wide.as_ptr() as *mut _),
            SPIF_UPDATEINIFILE | SPIF_SENDCHANGE,
        )
        .map_err(|e| e.to_string())
    }
}

pub fn get_dark_mode_enabled() -> bool {
    unsafe {
        let subkey = to_wide(r"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize");
        let val_name = to_wide("AppsUseLightTheme");
        let mut hkey = Default::default();
        if RegOpenKeyExW(HKEY_CURRENT_USER, PCWSTR(subkey.as_ptr()), 0, KEY_READ, &mut hkey).is_ok() {
            let mut data: u32 = 0;
            let mut size = std::mem::size_of::<u32>() as u32;
            let res = RegQueryValueExW(
                hkey,
                PCWSTR(val_name.as_ptr()),
                None,
                None,
                Some(&mut data as *mut u32 as *mut u8),
                Some(&mut size),
            );
            let _ = RegCloseKey(hkey);
            if res.is_ok() {
                return data == 0;
            }
        }
        true
    }
}

pub fn set_dark_mode_enabled(dark: bool) -> Result<(), String> {
    unsafe {
        let subkey = to_wide(r"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize");
        let mut hkey = Default::default();
        RegOpenKeyExW(HKEY_CURRENT_USER, PCWSTR(subkey.as_ptr()), 0, KEY_WRITE, &mut hkey)
            .ok()
            .map_err(|e| e.to_string())?;

        let val: u32 = if dark { 0 } else { 1 };
        let bytes = val.to_le_bytes();
        for name in ["AppsUseLightTheme", "SystemUsesLightTheme"] {
            let wname = to_wide(name);
            let _ = RegSetValueExW(hkey, PCWSTR(wname.as_ptr()), 0, REG_DWORD, Some(&bytes));
        }
        let _ = RegCloseKey(hkey);
        Ok(())
    }
}

pub fn get_startup_enabled() -> bool {
    unsafe {
        let subkey = to_wide(r"Software\Microsoft\Windows\CurrentVersion\Run");
        let val_name = to_wide("Kibo");
        let mut hkey = Default::default();
        if RegOpenKeyExW(HKEY_CURRENT_USER, PCWSTR(subkey.as_ptr()), 0, KEY_READ, &mut hkey).is_ok() {
            let mut size: u32 = 0;
            let exists = RegQueryValueExW(
                hkey,
                PCWSTR(val_name.as_ptr()),
                None,
                None,
                None,
                Some(&mut size),
            )
            .is_ok();
            let _ = RegCloseKey(hkey);
            return exists && size > 0;
        }
        false
    }
}

pub fn set_startup_enabled(enabled: bool) -> bool {
    unsafe {
        let subkey = to_wide(r"Software\Microsoft\Windows\CurrentVersion\Run");
        let val_name = to_wide("Kibo");
        let mut hkey = Default::default();
        if RegOpenKeyExW(HKEY_CURRENT_USER, PCWSTR(subkey.as_ptr()), 0, KEY_WRITE, &mut hkey).is_ok() {
            if enabled {
                if let Ok(exe) = std::env::current_exe() {
                    let cmd = format!("\"{}\" --hidden", exe.display());
                    let wide = to_wide(&cmd);
                    let bytes: &[u8] =
                        std::slice::from_raw_parts(wide.as_ptr() as *const u8, wide.len() * 2);
                    let _ = RegSetValueExW(hkey, PCWSTR(val_name.as_ptr()), 0, REG_SZ, Some(bytes));
                }
            } else {
                let _ = RegDeleteValueW(hkey, PCWSTR(val_name.as_ptr()));
            }
            let _ = RegCloseKey(hkey);
        }
    }
    get_startup_enabled()
}

pub fn power_action(action: &str) -> Result<(), String> {
    match action.to_lowercase().as_str() {
        "lock" => unsafe { LockWorkStation().map_err(|e| e.to_string()) },
        "sleep" => unsafe {
            let _ = SetSuspendState(false, false, false);
            Ok(())
        },
        "shutdown" => {
            let _ = std::process::Command::new("shutdown")
                .args(["/s", "/t", "0"])
                .spawn();
            Ok(())
        }
        "restart" => {
            let _ = std::process::Command::new("shutdown")
                .args(["/r", "/t", "0"])
                .spawn();
            Ok(())
        }
        _ => Ok(()),
    }
}
