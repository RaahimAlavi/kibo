mod media;
mod services;
mod telemetry;
mod win32;

use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use std::sync::Mutex;
use std::time::Duration;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

#[derive(Debug, Clone, Default)]
struct HitboxState {
    notch_w: i32,
    notch_h: i32,
    lasso_active: bool,
    agent_dock_active: bool,
    agent_dock_hovered: bool,
    fullscreen_active: bool,
    game_passthrough: bool,
    app_win_rect: Option<RectF>,
    roaming_rects: Vec<RectF>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
struct RectF {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

fn default_true() -> bool {
    true
}
fn default_hold_delay_ms() -> u64 {
    260
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ShortcutsConfig {
    #[serde(default = "default_ask")]
    ask: String,
    #[serde(default = "default_dictate")]
    dictate: String,
    #[serde(default = "default_lasso")]
    lasso: String,
    #[serde(default = "default_true")]
    ask_enabled: bool,
    #[serde(default = "default_true")]
    dictate_enabled: bool,
    #[serde(default = "default_true")]
    lasso_enabled: bool,
    #[serde(default = "default_true")]
    gaming_shield: bool,
    #[serde(default = "default_hold_delay_ms")]
    hold_delay_ms: u64,
    #[serde(default)]
    paused_all: bool,
}

fn default_ask() -> String {
    "Win + Alt".into()
}
fn default_dictate() -> String {
    "Ctrl + Win".into()
}
fn default_lasso() -> String {
    "Ctrl + Shift".into()
}

impl Default for ShortcutsConfig {
    fn default() -> Self {
        Self {
            ask: default_ask(),
            dictate: default_dictate(),
            lasso: default_lasso(),
            ask_enabled: true,
            dictate_enabled: true,
            lasso_enabled: true,
            gaming_shield: true,
            hold_delay_ms: 260,
            paused_all: false,
        }
    }
}

static GAME_ACTIVE: Lazy<Mutex<Option<String>>> = Lazy::new(|| Mutex::new(None));

static HITBOX: Lazy<Mutex<HitboxState>> = Lazy::new(|| {
    Mutex::new(HitboxState {
        notch_w: 190,
        notch_h: 18,
        ..Default::default()
    })
});

static SHORTCUTS: Lazy<Mutex<ShortcutsConfig>> =
    Lazy::new(|| Mutex::new(ShortcutsConfig::default()));

fn auto_grant_webview_permissions(win: &tauri::WebviewWindow) {
    #[cfg(windows)]
    {
        use webview2_com::Microsoft::Web::WebView2::Win32::{
            COREWEBVIEW2_PERMISSION_KIND, COREWEBVIEW2_PERMISSION_KIND_CAMERA,
            COREWEBVIEW2_PERMISSION_KIND_CLIPBOARD_READ, COREWEBVIEW2_PERMISSION_KIND_MICROPHONE,
            COREWEBVIEW2_PERMISSION_STATE_ALLOW,
        };
        use webview2_com::PermissionRequestedEventHandler;

        let _ = win.with_webview(|wv| unsafe {
            if let Ok(core) = wv.controller().CoreWebView2() {
                let mut token = Default::default();
                let _ = core.add_PermissionRequested(
                    &PermissionRequestedEventHandler::create(Box::new(|_, args| {
                        let Some(args) = args else {
                            return Ok(());
                        };
                        let mut kind = COREWEBVIEW2_PERMISSION_KIND::default();
                        if args.PermissionKind(&mut kind).is_ok()
                            && (kind == COREWEBVIEW2_PERMISSION_KIND_MICROPHONE
                                || kind == COREWEBVIEW2_PERMISSION_KIND_CAMERA
                                || kind == COREWEBVIEW2_PERMISSION_KIND_CLIPBOARD_READ)
                        {
                            let _ = args.SetState(COREWEBVIEW2_PERMISSION_STATE_ALLOW);
                        }
                        Ok(())
                    })),
                    &mut token,
                );
            }
        });
    }
}

fn open_or_focus_settings_window(app: &AppHandle, section: &str) {
    // Immediately clear any lingering center hitbox on the main overlay so the screen stays clickable
    if let Ok(mut hb) = HITBOX.lock() {
        if !hb.lasso_active {
            hb.notch_w = 190;
            hb.notch_h = 18;
            hb.app_win_rect = None;
            hb.roaming_rects.clear();
        }
    }
    if let Some(main_win) = app.get_webview_window("main") {
        let _ = main_win.set_ignore_cursor_events(true);
    }
    let _ = app.emit("desktop-clicked-outside", ());

    if let Some(win) = app.get_webview_window("settings") {
        let _ = win.unminimize();
        let _ = win.show();
        let _ = win.set_focus();
        let _ = win.emit("settings-navigate", section.to_string());
        return;
    }

    let url = if cfg!(debug_assertions) {
        WebviewUrl::External("http://localhost:5173/".parse().unwrap())
    } else {
        WebviewUrl::App("index.html".into())
    };

    let safe_section = serde_json::to_string(section).unwrap_or_else(|_| "\"Account\"".to_string());
    let init_js = format!(
        "window.__KIBO_WINDOW_MODE__ = 'settings'; window.__KIBO_SETTINGS_SECTION__ = {};",
        safe_section
    );

    if let Ok(settings_win) = WebviewWindowBuilder::new(app, "settings", url)
        .title("Kibo Settings")
        .inner_size(860.0, 600.0)
        .min_inner_size(740.0, 500.0)
        .center()
        .background_color(tauri::window::Color(18, 18, 20, 255))
        .initialization_script(&init_js)
        .decorations(true)
        .transparent(false)
        .always_on_top(false)
        .resizable(true)
        .visible(true)
        .build()
    {
        auto_grant_webview_permissions(&settings_win);
    }
}

// ============================================================================
// TAURI COMMANDS (1:1 parity with window.kiboAPI)
// ============================================================================

#[tauri::command]
fn set_window_bounds(width: f64, height: f64) {
    if let Ok(mut hb) = HITBOX.lock() {
        hb.notch_w = (width.round() as i32).max(10);
        hb.notch_h = (height.round() as i32).max(10);
    }
}

#[tauri::command]
fn set_window_mode(mode: String, width: Option<f64>, height: Option<f64>) {
    let (w, h) = match mode.as_str() {
        "tucked" => (190, 18),
        "collapsed" => (220, 72),
        "listening" => (200, 42),
        "expanded" => (
            width.unwrap_or(640.0).round() as i32,
            height.unwrap_or(390.0).round() as i32,
        ),
        _ => (190, 18),
    };
    if let Ok(mut hb) = HITBOX.lock() {
        hb.notch_w = w.max(10);
        hb.notch_h = h.max(10);
    }
}

#[tauri::command]
fn set_app_window_rect(rect: Option<RectF>) {
    if let Ok(mut hb) = HITBOX.lock() {
        hb.app_win_rect = rect;
    }
}

#[tauri::command]
fn set_roaming_target_rect(rects: Option<Vec<RectF>>) {
    if let Ok(mut hb) = HITBOX.lock() {
        hb.roaming_rects = rects.unwrap_or_default();
    }
}

#[tauri::command]
fn set_lasso_active(app: AppHandle, active: bool) -> bool {
    if let Ok(mut hb) = HITBOX.lock() {
        hb.lasso_active = active;
        if !active && (hb.notch_w >= 1000 || hb.notch_h >= 700) {
            hb.notch_w = 190;
            hb.notch_h = 18;
        }
    }
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.set_ignore_cursor_events(!active);
    }
    true
}

#[tauri::command]
fn set_agent_dock_active(active: bool, is_hovered: Option<bool>) {
    if let Ok(mut hb) = HITBOX.lock() {
        hb.agent_dock_active = active;
        hb.agent_dock_hovered = is_hovered.unwrap_or(false);
    }
}

#[tauri::command]
fn set_show_taskbar(app: AppHandle, show: bool) -> bool {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.set_skip_taskbar(!show);
    }
    show
}

#[tauri::command]
fn set_always_on_top(app: AppHandle, flag: bool) -> bool {
    if let Some(win) = app.get_webview_window("main") {
        if flag {
            let _ = win.unminimize();
            let _ = win.show();
        }
        let _ = win.set_always_on_top(flag);
        if let Ok(hwnd) = win.hwnd() {
            win32::force_window_topmost(hwnd.0 as isize, flag);
        }
    }
    flag
}

#[tauri::command]
async fn open_settings_window(app: AppHandle, section: Option<String>) -> Value {
    let sec = section.unwrap_or_else(|| "Account".to_string());
    // Must be async on Windows WebView2 so creating a new WebviewWindow never deadlocks the UI thread
    open_or_focus_settings_window(&app, &sec);
    json!({ "success": true })
}

#[tauri::command]
fn minimize_main_window(app: AppHandle) -> Value {
    // Keep notch_w/notch_h intact so restoring onboarding from taskbar stays clickable;
    // start_background_watchers skips hit-testing whenever the window is minimized.
    if let Ok(mut hb) = HITBOX.lock() {
        hb.lasso_active = false;
    }
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.set_always_on_top(false);
        if let Ok(hwnd) = win.hwnd() {
            win32::force_window_topmost(hwnd.0 as isize, false);
        }
        let _ = win.set_skip_taskbar(false);
        let _ = win.set_ignore_cursor_events(true);
        let _ = win.minimize();
    }
    json!({ "success": true })
}

#[tauri::command]
fn close_settings_window(app: AppHandle) -> Value {
    if let Some(win) = app.get_webview_window("settings") {
        let _ = win.close();
    }
    json!({ "success": true })
}

#[tauri::command]
fn trigger_replay_onboarding(app: AppHandle) -> Value {
    if let Some(win) = app.get_webview_window("settings") {
        let _ = win.close();
    }
    let _ = app.emit("reset-onboarding", ());
    json!({ "success": true })
}

#[tauri::command]
fn get_stored_settings() -> Map<String, Value> {
    services::read_settings()
}

#[tauri::command]
fn save_stored_settings(app: AppHandle, patch: Map<String, Value>) -> Map<String, Value> {
    let saved = services::write_settings_patch(patch.clone());
    let _ = app.emit("settings-synced", Value::Object(patch));
    saved
}

#[tauri::command]
async fn elevenlabs_speak(opts: services::ElevenLabsRequest) -> Option<Vec<u8>> {
    services::elevenlabs_speak(opts).await
}

#[tauri::command]
fn elevenlabs_check_status() -> Value {
    let settings = services::read_settings();
    let has_env = !services::get_env_var("ELEVENLABS_API_KEY").is_empty();
    let has_saved = settings
        .get("kibo_elevenlabs_key")
        .and_then(|v| v.as_str())
        .map(|s| !s.trim().is_empty())
        .unwrap_or(false);
    json!({ "hasKey": has_env || has_saved })
}

#[tauri::command]
async fn get_now_playing() -> media::NowPlayingMedia {
    tokio::task::spawn_blocking(media::get_now_playing_sync)
        .await
        .unwrap_or_default()
}

#[tauri::command]
fn media_control(action: String) -> Value {
    win32::send_media_key(&action);
    json!({ "success": true })
}

#[tauri::command]
async fn seek_media(seconds: i64) -> Value {
    let ok = tokio::task::spawn_blocking(move || media::seek_media_sync(seconds))
        .await
        .unwrap_or(false);
    json!({ "success": ok, "seconds": seconds })
}

#[tauri::command]
fn get_controls_state() -> Value {
    let (vol, muted) = win32::get_system_volume_and_mute();
    let dark = win32::get_dark_mode_enabled();
    json!({
        "wifiConnected": true,
        "wifiSsid": "Wi-Fi",
        "bluetoothEnabled": true,
        "bluetoothDevices": [],
        "nightLightEnabled": false,
        "darkMode": dark,
        "volume": vol,
        "muted": muted,
        "audioDevices": ["System Default"],
    })
}

#[tauri::command]
fn set_volume(level: i32) -> Value {
    match win32::set_system_volume(level) {
        Ok(v) => json!({ "success": true, "volume": v }),
        Err(e) => json!({ "success": false, "error": e }),
    }
}

#[tauri::command]
fn set_mute(mute: bool) -> Value {
    match win32::set_system_mute(mute) {
        Ok(m) => json!({ "success": true, "muted": m }),
        Err(e) => json!({ "success": false, "error": e }),
    }
}

#[tauri::command]
fn get_media_app_volume(source_hint: Option<String>) -> Value {
    let hint = source_hint.unwrap_or_default();
    if let Some((vol, muted, app_name)) = win32::get_app_media_volume(&hint) {
        json!({
            "found": true,
            "volume": vol,
            "muted": muted,
            "appName": app_name,
        })
    } else {
        json!({ "found": false })
    }
}

#[tauri::command]
fn set_media_app_volume(source_hint: Option<String>, level: i32) -> Value {
    let hint = source_hint.unwrap_or_default();
    match win32::set_app_media_volume(&hint, level) {
        Ok((v, app_name)) => json!({
            "success": true,
            "volume": v,
            "appName": app_name,
            "isPerApp": true,
        }),
        Err(_) => match win32::set_system_volume(level) {
            Ok(v) => json!({
                "success": true,
                "volume": v,
                "appName": "System",
                "isPerApp": false,
            }),
            Err(e) => json!({ "success": false, "error": e }),
        },
    }
}

#[tauri::command]
fn set_media_app_mute(source_hint: Option<String>, mute: bool) -> Value {
    let hint = source_hint.unwrap_or_default();
    match win32::set_app_media_mute(&hint, mute) {
        Ok((m, app_name)) => json!({
            "success": true,
            "muted": m,
            "appName": app_name,
            "isPerApp": true,
        }),
        Err(_) => match win32::set_system_mute(mute) {
            Ok(m) => json!({
                "success": true,
                "muted": m,
                "appName": "System",
                "isPerApp": false,
            }),
            Err(e) => json!({ "success": false, "error": e }),
        },
    }
}

#[tauri::command]
fn toggle_system_dark_mode(target_dark: bool) -> Value {
    match win32::set_dark_mode_enabled(target_dark) {
        Ok(_) => json!({ "success": true, "darkMode": target_dark }),
        Err(e) => json!({ "success": false, "error": e }),
    }
}

#[tauri::command]
fn set_game_hud_passthrough(enabled: bool) -> bool {
    if let Ok(mut hb) = HITBOX.lock() {
        hb.game_passthrough = enabled;
    }
    enabled
}

#[tauri::command]
async fn get_game_stats() -> telemetry::GameTelemetrySnapshot {
    tokio::task::spawn_blocking(|| {
        let dwm = win32::sample_dwm_timing();
        telemetry::get_game_stats_snapshot(dwm)
    })
    .await
    .unwrap_or_else(|_| telemetry::get_game_stats_snapshot(None))
}

#[tauri::command]
async fn get_system_stats() -> Value {
    tokio::task::spawn_blocking(telemetry::get_system_stats)
        .await
        .unwrap_or_else(|_| json!({}))
}

#[tauri::command]
async fn run_speed_test() -> Value {
    services::run_speed_test().await
}

#[tauri::command]
fn get_clipboard_history() -> Vec<telemetry::ClipboardItem> {
    telemetry::get_clipboard_history()
}

#[tauri::command]
fn delete_clipboard_item(id: u64) -> Value {
    telemetry::delete_clipboard_item(id);
    json!({ "success": true })
}

#[tauri::command]
fn toggle_pin_clipboard_item(id: u64) -> Value {
    telemetry::toggle_pin_clipboard_item(id);
    json!({ "success": true })
}

#[tauri::command]
fn clear_clipboard_history() -> Value {
    telemetry::clear_clipboard_history();
    json!({ "success": true })
}

#[tauri::command]
fn read_clipboard_text() -> String {
    telemetry::read_clipboard_text()
}

#[tauri::command]
fn write_clipboard_text(text: String) -> bool {
    telemetry::write_clipboard_text(&text)
}

#[tauri::command]
async fn capture_screen() -> Value {
    match tokio::task::spawn_blocking(win32::capture_primary_screen_jpeg_data_url).await {
        Ok(Ok(data_url)) => json!({ "success": true, "image": data_url }),
        Ok(Err(e)) => json!({ "success": false, "error": e }),
        Err(e) => json!({ "success": false, "error": e.to_string() }),
    }
}

#[tauri::command]
async fn capture_glass_backdrop(app: AppHandle, width: Option<i32>, height: Option<i32>) -> Value {
    let scale = app
        .get_webview_window("main")
        .and_then(|w| w.scale_factor().ok())
        .unwrap_or(1.0);
    let w = width.unwrap_or(860);
    let h = height.unwrap_or(480);
    match tokio::task::spawn_blocking(move || win32::capture_notch_glass_backdrop(w, h, scale)).await
    {
        Ok(Ok(data_url)) => json!({ "success": true, "image": data_url }),
        Ok(Err(e)) => json!({ "success": false, "error": e }),
        Err(e) => json!({ "success": false, "error": e.to_string() }),
    }
}

#[tauri::command]
fn type_text(text: String) -> Value {
    if telemetry::write_clipboard_text(&text) {
        telemetry::sleep_ms(35);
        win32::send_ctrl_v(false);
        json!({ "success": true })
    } else {
        json!({ "success": false })
    }
}

#[tauri::command]
fn execute_ui_action(
    action: String,
    x: Option<i32>,
    y: Option<i32>,
    text: Option<String>,
    press_enter: Option<bool>,
) -> Value {
    match action.as_str() {
        "click" => {
            if let (Some(cx), Some(cy)) = (x, y) {
                win32::mouse_click(cx, cy, false, false);
            }
            json!({ "ok": true })
        }
        "double_click" => {
            if let (Some(cx), Some(cy)) = (x, y) {
                win32::mouse_click(cx, cy, true, false);
            }
            json!({ "ok": true })
        }
        "right_click" => {
            if let (Some(cx), Some(cy)) = (x, y) {
                win32::mouse_click(cx, cy, false, true);
            }
            json!({ "ok": true })
        }
        "type" | "type_direct" => {
            if let (Some(cx), Some(cy)) = (x, y) {
                win32::mouse_click(cx, cy, false, false);
                telemetry::sleep_ms(90);
            }
            if let Some(t) = text {
                if telemetry::write_clipboard_text(&t) {
                    telemetry::sleep_ms(35);
                    win32::send_ctrl_v(press_enter.unwrap_or(false));
                }
            }
            json!({ "ok": true })
        }
        _ => json!({ "ok": false }),
    }
}

#[tauri::command]
fn open_app(app_name: String) -> Value {
    services::open_application(&app_name)
}

#[tauri::command]
async fn get_installed_apps() -> Vec<Value> {
    tokio::task::spawn_blocking(services::get_installed_apps)
        .await
        .unwrap_or_default()
}

#[tauri::command]
fn open_url(url: String) -> Value {
    json!({ "success": services::open_url_or_path(&url) })
}

#[tauri::command]
fn show_item_in_folder(file_path: String) -> Value {
    services::show_item_in_folder(&file_path)
}

#[tauri::command]
fn filter_existing_files(file_paths: Vec<String>) -> Vec<String> {
    services::filter_existing_files(file_paths)
}

#[tauri::command]
async fn convert_file(payload: Value) -> Value {
    tokio::task::spawn_blocking(move || services::convert_file(payload))
        .await
        .unwrap_or_else(|_| json!({ "success": false, "error": "Conversion task failed" }))
}

#[tauri::command]
async fn pick_file_for_convert() -> Value {
    tokio::task::spawn_blocking(|| {
        let picked = rfd::FileDialog::new()
            .set_title("Select Files to Convert with Kibo")
            .pick_files();
        if let Some(paths) = picked {
            let files: Vec<Value> = paths
                .iter()
                .filter(|p| p.is_file())
                .map(|p| {
                    let size = std::fs::metadata(p).map(|m| m.len()).unwrap_or(0);
                    let name = p
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("")
                        .to_string();
                    let ext = p
                        .extension()
                        .and_then(|e| e.to_str())
                        .unwrap_or("")
                        .to_lowercase();
                    json!({
                        "filePath": p.to_string_lossy(),
                        "fileName": name,
                        "sizeBytes": size,
                        "ext": ext,
                    })
                })
                .collect();
            if let Some(first) = files.first() {
                return json!({
                    "success": true,
                    "canceled": false,
                    "filePath": first["filePath"],
                    "fileName": first["fileName"],
                    "sizeBytes": first["sizeBytes"],
                    "ext": first["ext"],
                    "files": files,
                });
            }
        }
        json!({ "success": false, "canceled": true, "files": [] })
    })
    .await
    .unwrap_or_else(|_| json!({ "success": false, "canceled": true, "files": [] }))
}

#[tauri::command]
async fn pick_skill_md_file() -> Value {
    tokio::task::spawn_blocking(|| {
        let picked = rfd::FileDialog::new()
            .set_title("Import SKILL.md")
            .add_filter("Markdown", &["md", "txt"])
            .pick_file();
        if let Some(p) = picked {
            if let Ok(content) = std::fs::read_to_string(&p) {
                let file_name = p
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("SKILL.md")
                    .to_string();
                return json!({
                    "canceled": false,
                    "fileName": file_name,
                    "content": content,
                });
            }
        }
        json!({ "canceled": true })
    })
    .await
    .unwrap_or_else(|_| json!({ "canceled": true }))
}

#[tauri::command]
async fn pick_wallpaper_files() -> Vec<String> {
    tokio::task::spawn_blocking(|| {
        rfd::FileDialog::new()
            .set_title("Select Wallpapers for Kibo")
            .add_filter("Images", &["png", "jpg", "jpeg", "webp"])
            .pick_files()
            .unwrap_or_default()
            .into_iter()
            .map(|p| p.to_string_lossy().to_string())
            .collect()
    })
    .await
    .unwrap_or_default()
}

#[tauri::command]
fn set_wallpaper(image_path: String) -> Value {
    match win32::set_desktop_wallpaper(&image_path) {
        Ok(_) => json!({ "success": true }),
        Err(e) => json!({ "success": false, "error": e }),
    }
}

#[tauri::command]
fn get_wallpaper_data_url(url_or_path: String) -> Option<String> {
    services::get_wallpaper_data_url(&url_or_path)
}

#[tauri::command]
fn get_startup_setting() -> bool {
    win32::get_startup_enabled()
}

#[tauri::command]
fn set_startup_setting(enabled: bool) -> bool {
    win32::set_startup_enabled(enabled)
}

#[tauri::command]
fn power_action(action: String) -> Value {
    match win32::power_action(&action) {
        Ok(_) => json!({ "success": true }),
        Err(e) => json!({ "success": false, "error": e }),
    }
}

#[tauri::command]
fn get_shortcuts() -> ShortcutsConfig {
    SHORTCUTS.lock().map(|s| s.clone()).unwrap_or_default()
}

#[tauri::command]
fn update_shortcuts(app: AppHandle, shortcuts: ShortcutsConfig) -> ShortcutsConfig {
    if let Ok(mut s) = SHORTCUTS.lock() {
        *s = shortcuts.clone();
    }
    let mut patch = Map::new();
    if let Ok(val) = serde_json::to_value(&shortcuts) {
        patch.insert("kibo_shortcuts_config".to_string(), val);
        services::write_settings_patch(patch.clone());
        let _ = app.emit("settings-synced", Value::Object(patch));
    }
    shortcuts
}

#[tauri::command]
fn get_active_page_context() -> Value {
    let fg = win32::get_foreground_info();
    let (b_title, b_url) = services::get_active_browser_context();
    json!({
        "title": if !b_title.is_empty() { b_title } else { fg.title },
        "url": b_url,
        "process": fg.proc_name,
    })
}

#[tauri::command]
fn play_spotify(query: String, target_type: Option<String>) -> Value {
    let is_liked = target_type.as_deref() == Some("liked_songs");
    let uri = if is_liked {
        "spotify:collection:tracks".to_string()
    } else {
        format!("spotify:search:{}", query.trim().replace(' ', "%20"))
    };
    let ok = services::open_url_or_path(&uri);
    json!({
        "success": ok,
        "mode": "app",
        "query": query,
    })
}

#[tauri::command]
fn open_generated_page(html_content: String, existing_file_path: Option<String>) -> Value {
    let out_path = existing_file_path
        .filter(|p| p.ends_with(".html"))
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|| {
            std::env::temp_dir().join(format!(
                "kibo_page_{}.html",
                chrono::Utc::now().timestamp_millis()
            ))
        });
    match std::fs::write(&out_path, html_content) {
        Ok(_) => {
            let p_str = out_path.to_string_lossy().to_string();
            services::open_url_or_path(&p_str);
            json!({ "success": true, "path": p_str })
        }
        Err(e) => json!({ "success": false, "error": e.to_string() }),
    }
}

#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

// ============================================================================
// BACKGROUND NATIVE WIN32 WATCHERS (ZERO POWERSHELL!)
// ============================================================================

fn start_background_watchers(app: AppHandle) {
    // 1. Tight 20ms Native Win32 Cursor Hit-Test Loop (Chrome tabs 100% click-through!)
    {
        let handle = app.clone();
        std::thread::spawn(move || {
            let mut last_x = -99999;
            let mut last_y = -99999;
            let mut last_ignoring: Option<bool> = None;
            let mut last_peeking = false;
            let mut last_sig = String::new();

            loop {
                std::thread::sleep(Duration::from_millis(20));
                let Some(win) = handle.get_webview_window("main") else {
                    continue;
                };

                let is_minimized = win.is_minimized().unwrap_or(false) || !win.is_visible().unwrap_or(true);

                if is_minimized {
                    if last_ignoring != Some(true) {
                        last_ignoring = Some(true);
                        let _ = win.set_ignore_cursor_events(true);
                    }
                    last_sig.clear();
                    continue;
                }

                let (cx, cy) = win32::get_cursor_pos();
                let hb = match HITBOX.lock() {
                    Ok(g) => g.clone(),
                    Err(_) => continue,
                };

                let sig = format!(
                    "{}x{}:{}:{}:{}:{}:{}:{}:{}",
                    hb.notch_w,
                    hb.notch_h,
                    hb.lasso_active,
                    hb.agent_dock_active,
                    hb.agent_dock_hovered,
                    hb.fullscreen_active,
                    hb.game_passthrough,
                    hb.app_win_rect.is_some(),
                    hb.roaming_rects.len()
                );
                if cx == last_x && cy == last_y && sig == last_sig {
                    continue;
                }
                last_x = cx;
                last_y = cy;
                last_sig = sig;

                let (screen_w, _screen_h) = win32::get_primary_screen_size();
                let scale = win.scale_factor().unwrap_or(1.0);
                let center_x = screen_w / 2;

                if hb.fullscreen_active {
                    let near_top = cy <= (8.0 * scale) as i32 && (cx - center_x).abs() <= (220.0 * scale) as i32;
                    if near_top && !last_peeking {
                        last_peeking = true;
                        let _ = win.emit("cinema-peek", true);
                    } else if cy > (68.0 * scale) as i32 && last_peeking {
                        last_peeking = false;
                        let _ = win.emit("cinema-peek", false);
                    }
                } else if last_peeking {
                    last_peeking = false;
                    let _ = win.emit("cinema-peek", false);
                }

                // Scale CSS logical bounds into physical screen pixels so hitboxes align exactly at 100%-200% DPI
                let phys_w = (hb.notch_w as f64 * scale).round() as i32;
                let phys_h = (hb.notch_h as f64 * scale).round() as i32;
                let half_w = (phys_w / 2 + (4.0 * scale) as i32).max((38.0 * scale) as i32);
                let hit_h = (phys_h + (2.0 * scale) as i32).max((16.0 * scale) as i32);
                let inside_notch = (cx - center_x).abs() <= half_w && cy >= 0 && cy <= hit_h;

                let inside_app_win = hb.app_win_rect.as_ref().map_or(false, |r| {
                    let rx = r.x * scale;
                    let ry = r.y * scale;
                    let rw = r.width * scale;
                    let rh = r.height * scale;
                    (cx as f64) >= rx
                        && (cx as f64) <= rx + rw
                        && (cy as f64) >= ry
                        && (cy as f64) <= ry + rh
                });

                let inside_roaming = hb.roaming_rects.iter().any(|r| {
                    let rx = r.x * scale;
                    let ry = r.y * scale;
                    let rw = r.width * scale;
                    let rh = r.height * scale;
                    (cx as f64) >= rx
                        && (cx as f64) <= rx + rw
                        && (cy as f64) >= ry
                        && (cy as f64) <= ry + rh
                });

                let inside_dock = if hb.agent_dock_active {
                    let left = if hb.agent_dock_hovered {
                        screen_w - (340.0 * scale) as i32
                    } else {
                        screen_w - (92.0 * scale) as i32
                    };
                    let right = screen_w - (18.0 * scale) as i32;
                    let top = (58.0 * scale) as i32;
                    let bottom = if hb.agent_dock_hovered {
                        (360.0 * scale) as i32
                    } else {
                        (132.0 * scale) as i32
                    };
                    cx >= left && cx <= right && cy >= top && cy <= bottom
                } else {
                    false
                };

                // Expand drop-catch zone gently when left mouse button is held near top center (dragging a file from Explorer!)
                let in_game_now = GAME_ACTIVE.lock().map(|g| g.is_some()).unwrap_or(false);
                let dragging_file_near_top = !in_game_now
                    && win32::is_vk_down(0x01)
                    && cy >= 0
                    && cy <= (72.0 * scale) as i32
                    && (cx - center_x).abs() <= (230.0 * scale) as i32;

                // When Game HUD click-through is active over a running game, force 100% click-through
                // so mouse flicks near the top edge NEVER pull focus or block clicks in-game.
                let should_ignore = if hb.game_passthrough && in_game_now && !hb.lasso_active {
                    true
                } else {
                    !hb.lasso_active
                        && !(inside_notch
                            || inside_app_win
                            || inside_roaming
                            || inside_dock
                            || dragging_file_near_top)
                };

                if last_ignoring != Some(should_ignore) {
                    last_ignoring = Some(should_ignore);
                    let _ = win.set_ignore_cursor_events(should_ignore);
                }
            }
        });
    }

    // 2. Native Win32 Global Hold-to-Speak Hotkey Watcher
    //    Includes Gaming Focus Shield (auto-pauses hotkeys in games), Hold Delay (prevents accidental taps),
    //    and Smart Chord Filter (ignores Ctrl+Shift+T / Ctrl+Shift+V / Ctrl+Shift+W etc.!).
    {
        let handle = app.clone();
        std::thread::spawn(move || {
            use std::time::Instant;

            let mut ask_held = false;
            let mut ask_press_start: Option<Instant> = None;
            let mut ask_poisoned = false;

            let mut dictate_held = false;
            let mut dictate_press_start: Option<Instant> = None;
            let mut dictate_poisoned = false;

            let mut lasso_held = false;
            let mut lasso_press_start: Option<Instant> = None;
            let mut lasso_poisoned = false;

            loop {
                std::thread::sleep(Duration::from_millis(25));
                let cfg = SHORTCUTS.lock().map(|s| s.clone()).unwrap_or_default();
                let in_game = GAME_ACTIVE.lock().map(|g| g.is_some()).unwrap_or(false);
                let blocked_globally = cfg.paused_all || (cfg.gaming_shield && in_game);
                let hold_threshold = Duration::from_millis(cfg.hold_delay_ms);

                // --- ASK ---
                let ask_raw = !blocked_globally && cfg.ask_enabled && win32::check_hotkey_combo(&cfg.ask);
                if ask_raw {
                    if !ask_held {
                        if win32::is_any_extra_key_down(&cfg.ask) {
                            ask_poisoned = true;
                            ask_press_start = None;
                        } else if !ask_poisoned {
                            let start = *ask_press_start.get_or_insert_with(Instant::now);
                            if start.elapsed() >= hold_threshold {
                                ask_held = true;
                                let _ = handle.emit("hotkey-event", "ASK_DOWN");
                            }
                        }
                    }
                } else {
                    if ask_held {
                        ask_held = false;
                        let _ = handle.emit("hotkey-event", "ASK_UP");
                    }
                    ask_press_start = None;
                    ask_poisoned = false;
                }

                // --- DICTATE ---
                let dict_raw = !blocked_globally && cfg.dictate_enabled && win32::check_hotkey_combo(&cfg.dictate);
                if dict_raw {
                    if !dictate_held {
                        if win32::is_any_extra_key_down(&cfg.dictate) {
                            dictate_poisoned = true;
                            dictate_press_start = None;
                        } else if !dictate_poisoned {
                            let start = *dictate_press_start.get_or_insert_with(Instant::now);
                            if start.elapsed() >= hold_threshold {
                                dictate_held = true;
                                let _ = handle.emit("hotkey-event", "DICTATE_DOWN");
                            }
                        }
                    }
                } else {
                    if dictate_held {
                        dictate_held = false;
                        let _ = handle.emit("hotkey-event", "DICTATE_UP");
                    }
                    dictate_press_start = None;
                    dictate_poisoned = false;
                }

                // --- LASSO (Circle to Ask) ---
                let lasso_raw = !blocked_globally && cfg.lasso_enabled && win32::check_hotkey_combo(&cfg.lasso);
                if lasso_raw {
                    if !lasso_held {
                        if win32::is_any_extra_key_down(&cfg.lasso) {
                            lasso_poisoned = true;
                            lasso_press_start = None;
                        } else if !lasso_poisoned {
                            let start = *lasso_press_start.get_or_insert_with(Instant::now);
                            if start.elapsed() >= hold_threshold {
                                lasso_held = true;
                                if let Ok(mut hb) = HITBOX.lock() {
                                    hb.lasso_active = true;
                                }
                                if let Some(win) = handle.get_webview_window("main") {
                                    let _ = win.set_ignore_cursor_events(false);
                                }
                                let _ = handle.emit("hotkey-event", "LASSO_DOWN");
                            }
                        }
                    }
                } else {
                    if lasso_held {
                        lasso_held = false;
                        if let Ok(mut hb) = HITBOX.lock() {
                            hb.lasso_active = false;
                            // Prevent stale 1920x1080 lasso bounds from locking the notch or screen
                            if hb.notch_w >= 1000 || hb.notch_h >= 700 {
                                hb.notch_w = 190;
                                hb.notch_h = 18;
                            }
                        }
                        if let Some(win) = handle.get_webview_window("main") {
                            let _ = win.set_ignore_cursor_events(true);
                        }
                        let _ = handle.emit("hotkey-event", "LASSO_UP");
                    }
                    lasso_press_start = None;
                    lasso_poisoned = false;
                }
            }
        });
    }

    // 3. Native Foreground App, Fullscreen & Gaming Focus Shield Detector (1.2s interval, zero PowerShell!)
    {
        let handle = app.clone();
        std::thread::spawn(move || {
            let mut last_fs = false;
            let mut last_app: Option<String> = None;
            let mut last_game: Option<String> = None;

            loop {
                std::thread::sleep(Duration::from_millis(1200));
                let info = win32::get_foreground_info();
                let proc_low = info.proc_name.to_lowercase();
                let title_low = info.title.to_lowercase();

                if proc_low == "kibo" || title_low.contains("kibo settings") {
                    continue;
                }

                let current_game = if win32::is_game_foreground(&info) {
                    Some(if !info.title.trim().is_empty() {
                        info.title.clone()
                    } else {
                        info.proc_name.clone()
                    })
                } else {
                    None
                };

                if current_game != last_game {
                    last_game = current_game.clone();
                    if let Ok(mut g) = GAME_ACTIVE.lock() {
                        *g = current_game.clone();
                    }
                    let _ = handle.emit(
                        "gaming-shield-state",
                        json!({
                            "active": current_game.is_some(),
                            "gameName": current_game,
                        }),
                    );
                }

                if info.fullscreen != last_fs {
                    last_fs = info.fullscreen;
                    if let Ok(mut hb) = HITBOX.lock() {
                        hb.fullscreen_active = last_fs;
                    }
                    let _ = handle.emit("context-fullscreen-changed", last_fs);
                }

                let detected = if proc_low == "notion" {
                    Some("notion".to_string())
                } else if matches!(proc_low.as_str(), "code" | "cursor" | "devenv") {
                    Some("vscode".to_string())
                } else if proc_low == "figma" {
                    Some("figma".to_string())
                } else if proc_low == "githubdesktop" {
                    Some("github".to_string())
                } else {
                    None
                };

                if detected != last_app {
                    last_app = detected.clone();
                    let _ = handle.emit("context-app-detected", detected);
                }
            }
        });
    }

    // 4. Native Async Clipboard Watcher (2.5s interval, JPEG compressed)
    {
        let handle = app.clone();
        std::thread::spawn(move || {
            telemetry::load_clipboard_store();
            loop {
                std::thread::sleep(Duration::from_millis(2500));
                if let Some(item) = telemetry::poll_clipboard_once() {
                    let _ = handle.emit("clipboard-item-added", item);
                }
            }
        });
    }

    // 5. Native Windows Core Audio Hardware Volume Watcher (180ms, ~0% CPU) for clean Notch Volume HUD popup
    {
        let handle = app.clone();
        std::thread::spawn(move || {
            let (mut last_vol, mut last_muted) = win32::get_system_volume_and_mute();
            loop {
                std::thread::sleep(Duration::from_millis(180));
                let (vol, muted) = win32::get_system_volume_and_mute();
                if vol != last_vol || muted != last_muted {
                    last_vol = vol;
                    last_muted = muted;
                    let _ = handle.emit(
                        "system-volume-changed",
                        json!({ "volume": vol, "muted": muted }),
                    );
                }
            }
        });
    }
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle().clone();

            // Size transparent overlay window to primary monitor (height - 2 avoids DWM fullscreen blackout)
            if let Some(win) = app.get_webview_window("main") {
                let (sw, sh) = win32::get_primary_screen_size();
                let _ = win.set_position(tauri::PhysicalPosition::new(0, 0));
                let _ = win.set_size(tauri::PhysicalSize::new(sw as u32, (sh - 2).max(600) as u32));
                let _ = win.set_always_on_top(true);
                if let Ok(hwnd) = win.hwnd() {
                    win32::force_window_topmost(hwnd.0 as isize, true);
                }
                let _ = win.set_ignore_cursor_events(true);
                auto_grant_webview_permissions(&win);

                // Emit desktop-clicked-outside on focus loss AND forward native Windows OLE DragDrop events with real file paths
                let win_handle = handle.clone();
                win.on_window_event(move |event| match event {
                    tauri::WindowEvent::Focused(true) => {
                        if let Some(main_win) = win_handle.get_webview_window("main") {
                            if !main_win.is_minimized().unwrap_or(false) {
                                let _ = main_win.set_always_on_top(true);
                                if let Ok(hwnd) = main_win.hwnd() {
                                    win32::force_window_topmost(hwnd.0 as isize, true);
                                }
                            }
                        }
                    }
                    tauri::WindowEvent::Focused(false) => {
                        let _ = win_handle.emit("desktop-clicked-outside", ());
                    }
                    tauri::WindowEvent::DragDrop(dd) => match dd {
                        tauri::DragDropEvent::Enter { paths, .. } => {
                            if !paths.is_empty() {
                                if let Ok(mut hb) = HITBOX.lock() {
                                    if hb.notch_w < 340 {
                                        hb.notch_w = 340;
                                    }
                                    if hb.notch_h < 112 {
                                        hb.notch_h = 112;
                                    }
                                }
                                let _ = win_handle.emit(
                                    "kibo-file-drag",
                                    json!({
                                        "kind": "enter",
                                        "count": paths.len(),
                                    }),
                                );
                            }
                        }
                        tauri::DragDropEvent::Over { .. } => {}
                        tauri::DragDropEvent::Leave => {
                            let _ = win_handle.emit("kibo-file-drag", json!({ "kind": "leave" }));
                        }
                        tauri::DragDropEvent::Drop { paths, .. } => {
                            let files: Vec<Value> = paths
                                .iter()
                                .filter(|p| p.is_file())
                                .map(|p| {
                                    let file_path = p.to_string_lossy().to_string();
                                    let file_name = p
                                        .file_name()
                                        .and_then(|n| n.to_str())
                                        .unwrap_or("File")
                                        .to_string();
                                    let ext = p
                                        .extension()
                                        .and_then(|e| e.to_str())
                                        .unwrap_or("")
                                        .to_lowercase();
                                    let size_bytes = std::fs::metadata(p).map(|m| m.len()).unwrap_or(0);
                                    let text_content = if matches!(ext.as_str(), "md" | "markdown" | "txt")
                                        && size_bytes > 0
                                        && size_bytes <= 262_144
                                    {
                                        std::fs::read_to_string(p).ok()
                                    } else {
                                        None
                                    };
                                    json!({
                                        "filePath": file_path,
                                        "fileName": file_name,
                                        "ext": ext,
                                        "sizeBytes": size_bytes,
                                        "textContent": text_content,
                                    })
                                })
                                .collect();
                            if let Some(first) = files.first() {
                                let _ = win_handle.emit(
                                    "kibo-file-drag",
                                    json!({
                                        "kind": "drop",
                                        "count": files.len(),
                                        "files": files,
                                        "filePath": first["filePath"],
                                        "fileName": first["fileName"],
                                        "ext": first["ext"],
                                        "sizeBytes": first["sizeBytes"],
                                        "textContent": first["textContent"],
                                    }),
                                );
                            } else {
                                let _ = win_handle.emit("kibo-file-drag", json!({ "kind": "leave" }));
                            }
                        }
                        _ => {}
                    },
                    _ => {}
                });
            }

            // Hydrate saved shortcuts & Gaming Focus Shield settings from disk
            let saved_settings = services::read_settings();
            if let Some(sc_val) = saved_settings.get("kibo_shortcuts_config") {
                if let Ok(parsed) = serde_json::from_value::<ShortcutsConfig>(sc_val.clone()) {
                    if let Ok(mut s) = SHORTCUTS.lock() {
                        *s = parsed;
                    }
                }
            }

            // Native System Tray Icon
            let open_settings_i = MenuItem::with_id(app, "settings", "Open Settings", true, None::<&str>)?;
            let expand_i = MenuItem::with_id(app, "expand", "Open Kibo Notch", true, None::<&str>)?;
            let pause_i = MenuItem::with_id(app, "toggle_pause", "Pause / Resume Shortcuts (DND)", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit Kibo", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&expand_i, &open_settings_i, &pause_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Kibo Desktop Companion")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "settings" => {
                        let handle = app.clone();
                        tauri::async_runtime::spawn(async move {
                            open_or_focus_settings_window(&handle, "Appearance");
                        });
                    }
                    "expand" => {
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.unminimize();
                            let _ = win.show();
                            let _ = win.set_always_on_top(true);
                            if let Ok(hwnd) = win.hwnd() {
                                win32::force_window_topmost(hwnd.0 as isize, true);
                            }
                        }
                        let _ = app.emit("open-companion-tab", "Chat");
                    }
                    "toggle_pause" => {
                        let next_cfg = if let Ok(mut s) = SHORTCUTS.lock() {
                            s.paused_all = !s.paused_all;
                            Some(s.clone())
                        } else {
                            None
                        };
                        if let Some(cfg) = next_cfg {
                            let mut patch = Map::new();
                            if let Ok(val) = serde_json::to_value(&cfg) {
                                patch.insert("kibo_shortcuts_config".to_string(), val);
                                services::write_settings_patch(patch.clone());
                                let _ = app.emit("settings-synced", Value::Object(patch));
                            }
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        if let Some(win) = tray.app_handle().get_webview_window("main") {
                            let _ = win.unminimize();
                            let _ = win.show();
                            let _ = win.set_always_on_top(true);
                            if let Ok(hwnd) = win.hwnd() {
                                win32::force_window_topmost(hwnd.0 as isize, true);
                            }
                        }
                        let _ = tray.app_handle().emit("open-companion-tab", "Chat");
                    }
                })
                .build(app)?;

            services::start_chrome_bridge_server(handle.clone());
            start_background_watchers(handle);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            set_window_bounds,
            set_window_mode,
            set_app_window_rect,
            set_roaming_target_rect,
            set_lasso_active,
            set_agent_dock_active,
            set_show_taskbar,
            set_always_on_top,
            open_settings_window,
            close_settings_window,
            minimize_main_window,
            trigger_replay_onboarding,
            get_stored_settings,
            save_stored_settings,
            elevenlabs_speak,
            elevenlabs_check_status,
            get_now_playing,
            media_control,
            seek_media,
            get_controls_state,
            set_volume,
            set_mute,
            get_media_app_volume,
            set_media_app_volume,
            set_media_app_mute,
            toggle_system_dark_mode,
            get_system_stats,
            get_game_stats,
            set_game_hud_passthrough,
            run_speed_test,
            get_clipboard_history,
            delete_clipboard_item,
            toggle_pin_clipboard_item,
            clear_clipboard_history,
            read_clipboard_text,
            write_clipboard_text,
            capture_screen,
            capture_glass_backdrop,
            type_text,
            execute_ui_action,
            open_app,
            get_installed_apps,
            open_url,
            show_item_in_folder,
            filter_existing_files,
            convert_file,
            pick_file_for_convert,
            pick_skill_md_file,
            pick_wallpaper_files,
            set_wallpaper,
            get_wallpaper_data_url,
            get_startup_setting,
            set_startup_setting,
            power_action,
            get_shortcuts,
            update_shortcuts,
            get_active_page_context,
            play_spotify,
            open_generated_page,
            quit_app,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Kibo Tauri application");
}
