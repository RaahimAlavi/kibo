use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use chrono::Local;
use image::{ImageBuffer, Rgba};
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::io::{BufRead, BufReader, Cursor};
use std::os::windows::process::CommandExt;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use sysinfo::{Disks, Networks, System};

const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GpuStats {
    pub name: String,
    pub percent: i32,
    pub vram_used: String,
    pub vram_total: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temp_c: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub power_w: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub clock_mhz: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameTelemetrySnapshot {
    pub fps: i32,
    pub low_1_fps: i32,
    pub frametime_ms: f64,
    pub refresh_hz: i32,
    pub cpu_percent: i32,
    pub gpu_percent: i32,
    pub gpu_name: String,
    pub gpu_temp_c: Option<i32>,
    pub gpu_power_w: Option<i32>,
    pub gpu_clock_mhz: Option<i32>,
    pub vram_used_gb: String,
    pub vram_total_gb: String,
    pub ram_used_gb: String,
    pub ram_total_gb: String,
    pub ram_percent: i32,
    pub ping_ms: Option<i32>,
    pub history_ms: Vec<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipboardItem {
    pub id: u64,
    pub category: String,
    pub preview: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image_data_url: Option<String>,
    pub label: String,
    pub time: String,
    #[serde(rename = "type")]
    pub item_type: String,
    pub size: String,
    pub copied: String,
    pub icon_type: String,
    pub is_today: bool,
    pub is_pinned: bool,
}

static SYS_STATE: Lazy<Mutex<(System, Networks, Instant, u64, u64)>> = Lazy::new(|| {
    let mut sys = System::new_all();
    sys.refresh_all();
    let nets = Networks::new_with_refreshed_list();
    Mutex::new((sys, nets, Instant::now(), 0, 0))
});

static LATEST_GPU: Lazy<Mutex<Option<GpuStats>>> = Lazy::new(|| Mutex::new(None));
static NVIDIA_STARTED: Lazy<Mutex<bool>> = Lazy::new(|| Mutex::new(false));
static PING_STARTED: Lazy<Mutex<bool>> = Lazy::new(|| Mutex::new(false));
static LATEST_PING_MS: Lazy<Mutex<Option<i32>>> = Lazy::new(|| Mutex::new(None));
static DWM_TRACKER: Lazy<Mutex<(u64, Instant, Vec<f64>, Vec<i32>)>> =
    Lazy::new(|| Mutex::new((0, Instant::now(), Vec::new(), Vec::new())));
static CLIPBOARD_STORE: Lazy<Mutex<Vec<ClipboardItem>>> = Lazy::new(|| Mutex::new(Vec::new()));
static LAST_CLIP_STATE: Lazy<Mutex<(String, u64)>> = Lazy::new(|| Mutex::new((String::new(), 0)));

pub fn start_ping_watcher_once() {
    let mut started = match PING_STARTED.lock() {
        Ok(g) => g,
        Err(_) => return,
    };
    if *started {
        return;
    }
    *started = true;
    drop(started);

    std::thread::spawn(|| {
        use std::net::{SocketAddr, TcpStream};
        let targets: [SocketAddr; 2] = [
            "1.1.1.1:443".parse().unwrap(),
            "8.8.8.8:443".parse().unwrap(),
        ];
        loop {
            let mut measured: Option<i32> = None;
            for addr in &targets {
                let t0 = Instant::now();
                if TcpStream::connect_timeout(addr, Duration::from_millis(900)).is_ok() {
                    measured = Some(t0.elapsed().as_millis().clamp(1, 999) as i32);
                    break;
                }
            }
            if let Ok(mut slot) = LATEST_PING_MS.lock() {
                *slot = measured;
            }
            std::thread::sleep(Duration::from_secs(3));
        }
    });
}

pub fn start_nvidia_watcher_once() {
    let mut started = match NVIDIA_STARTED.lock() {
        Ok(g) => g,
        Err(_) => return,
    };
    if *started {
        return;
    }
    *started = true;
    drop(started);

    std::thread::spawn(|| {
        let child = Command::new("nvidia-smi")
            .args([
                "--query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw,clocks.gr",
                "--format=csv,noheader,nounits",
                "-l",
                "1",
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn();

        if let Ok(mut proc) = child {
            if let Some(stdout) = proc.stdout.take() {
                let reader = BufReader::new(stdout);
                for line in reader.lines().map_while(Result::ok) {
                    let parts: Vec<&str> = line.split(',').map(|s| s.trim()).collect();
                    if parts.len() >= 4 {
                        let name = parts[0].to_string();
                        let percent = parts[1].parse::<i32>().unwrap_or(1).clamp(0, 100);
                        let used = parts[2].parse::<f64>().unwrap_or(0.0) / 1024.0;
                        let total = parts[3].parse::<f64>().unwrap_or(8192.0) / 1024.0;
                        let temp = parts.get(4).and_then(|s| s.parse::<f64>().ok()).map(|v| v.round() as i32);
                        let power = parts.get(5).and_then(|s| s.parse::<f64>().ok()).map(|v| v.round() as i32);
                        let clock = parts.get(6).and_then(|s| s.parse::<f64>().ok()).map(|v| v.round() as i32);
                        if let Ok(mut slot) = LATEST_GPU.lock() {
                            *slot = Some(GpuStats {
                                name,
                                percent,
                                vram_used: format!("{:.1}", used),
                                vram_total: format!("{:.1}", total),
                                temp_c: temp,
                                power_w: power,
                                clock_mhz: clock,
                            });
                        }
                    }
                }
            }
            let _ = proc.kill();
        }
    });
}

/// Fast (~1ms) read-only Game Stats HUD telemetry snapshot (zero hooks, zero DLL injection, 100% anti-cheat safe).
pub fn get_game_stats_snapshot(
    dwm_sample: Option<(u64, f64, f64)>,
    dxgi_fps: Option<(i32, i32, f64)>,
) -> GameTelemetrySnapshot {
    start_nvidia_watcher_once();
    start_ping_watcher_once();

    let (cpu_pct, used_mem, total_mem, mem_pct) = {
        let mut guard = SYS_STATE.lock().unwrap();
        let (sys, _, _, _, _) = &mut *guard;
        sys.refresh_cpu_all();
        sys.refresh_memory();
        let cpu = sys.global_cpu_usage().round().clamp(0.0, 100.0) as i32;
        let tot = sys.total_memory().max(1);
        let used = sys.used_memory();
        let pct = ((used as f64 / tot as f64) * 100.0).round() as i32;
        (cpu, used, tot, pct)
    };

    let (fps, low_1_fps, frametime_ms, refresh_hz, history_ms) = {
        let mut tr = DWM_TRACKER.lock().unwrap();
        let (prev_count, prev_ts, hist_ms, hist_fps) = &mut *tr;
        let hz = dwm_sample.map(|(_, h, _)| h).unwrap_or(60.0);
        let period_ms = dwm_sample.map(|(_, _, p)| p).unwrap_or(1000.0 / hz.max(30.0));

        let (cur_fps, cur_low1, cur_ms) = if let Some((real_fps, real_low1, real_ms)) = dxgi_fps {
            // Live DXGI Output Duplication measured frame rate (works for DirectFlip/MPO games like Fortnite!)
            (real_fps.max(1), real_low1.max(1), real_ms.max(0.5))
        } else if let Some((count, dwm_hz, _)) = dwm_sample {
            let dt = prev_ts.elapsed().as_secs_f64();
            let raw = if *prev_count > 0 && count > *prev_count && dt >= 0.25 && dt < 5.0 {
                ((count - *prev_count) as f64 / dt).clamp(0.0, dwm_hz.max(240.0))
            } else {
                0.0
            };
            *prev_count = count;
            *prev_ts = Instant::now();
            if raw >= 5.0 {
                let r_fps = raw.round() as i32;
                let r_ms = ((1000.0 / raw) * 10.0).round() / 10.0;
                (r_fps, r_fps, r_ms)
            } else {
                // Static desktop or non-presenting frame: report 0 (rendered as --) instead of misleading "1 FPS 1000.0ms"
                (0, 0, (period_ms * 10.0).round() / 10.0)
            }
        } else {
            (0, 0, (period_ms * 10.0).round() / 10.0)
        };

        if cur_fps > 0 {
            hist_ms.push(cur_ms);
            if hist_ms.len() > 24 {
                hist_ms.remove(0);
            }
            hist_fps.push(cur_fps);
            if hist_fps.len() > 30 {
                hist_fps.remove(0);
            }
        }
        let mut sorted_fps = hist_fps.clone();
        sorted_fps.sort_unstable();
        let low1 = if cur_low1 > 0 {
            cur_low1
        } else {
            sorted_fps.first().copied().unwrap_or(cur_fps)
        };
        (cur_fps, low1, cur_ms, hz.round() as i32, hist_ms.clone())
    };

    let gpu = LATEST_GPU
        .lock()
        .ok()
        .and_then(|g| g.clone())
        .unwrap_or(GpuStats {
            name: "GPU".into(),
            percent: ((cpu_pct as f64 * 0.4).round() as i32).clamp(0, 100),
            vram_used: "0.0".into(),
            vram_total: "8.0".into(),
            temp_c: None,
            power_w: None,
            clock_mhz: None,
        });

    let ping_ms = LATEST_PING_MS.lock().ok().and_then(|p| *p);

    GameTelemetrySnapshot {
        fps,
        low_1_fps,
        frametime_ms,
        refresh_hz,
        cpu_percent: cpu_pct,
        gpu_percent: gpu.percent,
        gpu_name: gpu.name,
        gpu_temp_c: gpu.temp_c,
        gpu_power_w: gpu.power_w,
        gpu_clock_mhz: gpu.clock_mhz,
        vram_used_gb: gpu.vram_used,
        vram_total_gb: gpu.vram_total,
        ram_used_gb: format!("{:.1}", used_mem as f64 / 1_073_741_824.0),
        ram_total_gb: format!("{:.0}", total_mem as f64 / 1_073_741_824.0),
        ram_percent: mem_pct,
        ping_ms,
        history_ms,
    }
}

fn format_rate(bps: f64) -> String {
    if bps < 1024.0 {
        format!("{} B/s", bps.max(0.0).round() as u64)
    } else if bps < 1024.0 * 1024.0 {
        format!("{:.0} KB/s", bps / 1024.0)
    } else {
        format!("{:.1} MB/s", bps / (1024.0 * 1024.0))
    }
}

pub fn get_system_stats() -> serde_json::Value {
    start_nvidia_watcher_once();

    let mut guard = SYS_STATE.lock().unwrap();
    let (sys, nets, last_ts, prev_rx, prev_tx) = &mut *guard;

    sys.refresh_cpu_all();
    sys.refresh_memory();
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);
    nets.refresh(true);

    let cpu_pct = sys.global_cpu_usage().round().clamp(1.0, 100.0) as i32;
    let cpu_model = sys
        .cpus()
        .first()
        .map(|c| c.brand().trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "Processor".into());
    let cpu_speed = sys
        .cpus()
        .first()
        .map(|c| format!("{:.1} GHz", c.frequency() as f64 / 1000.0))
        .unwrap_or_else(|| "3.8 GHz".into());

    let total_mem = sys.total_memory().max(1);
    let used_mem = sys.used_memory();
    let free_mem = total_mem.saturating_sub(used_mem);
    let mem_pct = ((used_mem as f64 / total_mem as f64) * 100.0).round() as i32;

    let disks = Disks::new_with_refreshed_list();
    let (disk_used_gb, disk_total_gb) = disks
        .iter()
        .find(|d| d.mount_point().to_string_lossy().to_uppercase().starts_with("C:"))
        .or_else(|| disks.first())
        .map(|d| {
            let total = (d.total_space() as f64 / 1_073_741_824.0).round() as u64;
            let avail = (d.available_space() as f64 / 1_073_741_824.0).round() as u64;
            (total.saturating_sub(avail), total)
        })
        .unwrap_or((250, 512));

    let mut rx_total: u64 = 0;
    let mut tx_total: u64 = 0;
    for (_, data) in nets.iter() {
        rx_total = rx_total.saturating_add(data.total_received());
        tx_total = tx_total.saturating_add(data.total_transmitted());
    }
    let dt = last_ts.elapsed().as_secs_f64().max(0.5);
    let down_str = if *prev_rx > 0 && rx_total >= *prev_rx {
        format_rate((rx_total - *prev_rx) as f64 / dt)
    } else {
        "0 B/s".into()
    };
    let up_str = if *prev_tx > 0 && tx_total >= *prev_tx {
        format_rate((tx_total - *prev_tx) as f64 / dt)
    } else {
        "0 B/s".into()
    };
    *prev_rx = rx_total;
    *prev_tx = tx_total;
    *last_ts = Instant::now();

    let proc_count = sys.processes().len();
    let mut proc_list: Vec<(String, u64, f32)> = sys
        .processes()
        .values()
        .map(|p| {
            (
                p.name().to_string_lossy().to_string(),
                p.memory() / (1024 * 1024),
                p.cpu_usage(),
            )
        })
        .collect();
    proc_list.sort_by(|a, b| b.1.cmp(&a.1));

    let top_apps: Vec<serde_json::Value> = proc_list
        .into_iter()
        .take(4)
        .map(|(name, mb, cpu)| {
            let usage = if mb >= 1024 {
                format!("{:.1} GB", mb as f64 / 1024.0)
            } else {
                format!("{} MB", mb)
            };
            let width_pct = ((mb as f64 / 2048.0) * 100.0).round().clamp(14.0, 95.0) as i32;
            let icon = name
                .chars()
                .next()
                .map(|c| c.to_ascii_uppercase().to_string())
                .unwrap_or_else(|| "A".into());
            serde_json::json!({
                "name": name,
                "icon": icon,
                "usage": usage,
                "cpuUsage": format!("{:.1}%", cpu),
                "width": format!("{}%", width_pct),
            })
        })
        .collect();

    let uptime_secs = System::uptime();
    let up_h = uptime_secs / 3600;
    let up_m = (uptime_secs % 3600) / 60;

    let gpu = LATEST_GPU
        .lock()
        .ok()
        .and_then(|g| g.clone())
        .unwrap_or(GpuStats {
            name: "Graphics Processor".into(),
            percent: ((cpu_pct as f64 * 0.45).round() as i32).clamp(4, 95),
            vram_used: "1.8".into(),
            vram_total: "8.0".into(),
            temp_c: None,
            power_w: None,
            clock_mhz: None,
        });

    serde_json::json!({
        "cpu": {
            "percent": cpu_pct,
            "model": cpu_model,
            "speed": cpu_speed,
            "processes": proc_count,
        },
        "gpu": gpu,
        "ram": {
            "percent": mem_pct,
            "usedGb": format!("{:.1}", used_mem as f64 / 1_073_741_824.0),
            "totalGb": format!("{:.1}", total_mem as f64 / 1_073_741_824.0),
            "freeGb": format!("{:.1}", free_mem as f64 / 1_073_741_824.0),
        },
        "disk": {
            "usedGb": disk_used_gb,
            "totalGb": disk_total_gb,
        },
        "network": {
            "down": down_str,
            "up": up_str,
        },
        "uptime": format!("{} h {} m", up_h, up_m),
        "topApps": top_apps,
    })
}

fn clipboard_store_path() -> PathBuf {
    let dir = dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("kibo");
    let _ = std::fs::create_dir_all(&dir);
    dir.join("kibo_clipboard_history.json")
}

pub fn load_clipboard_store() {
    let path = clipboard_store_path();
    if let Ok(raw) = std::fs::read_to_string(&path) {
        if let Ok(mut items) = serde_json::from_str::<Vec<ClipboardItem>>(&raw) {
            let mut img_count = 0usize;
            items.retain(|item| {
                if item.category == "Images" {
                    img_count += 1;
                    img_count <= 10
                } else {
                    true
                }
            });
            items.truncate(40);
            if let Ok(mut store) = CLIPBOARD_STORE.lock() {
                *store = items;
            }
        }
    }
}

fn save_clipboard_store_async() {
    let snapshot = match CLIPBOARD_STORE.lock() {
        Ok(mut store) => {
            let mut img_count = 0usize;
            store.retain(|item| {
                if item.category == "Images" {
                    img_count += 1;
                    img_count <= 10
                } else {
                    true
                }
            });
            store.truncate(40);
            store.clone()
        }
        Err(_) => return,
    };
    let path = clipboard_store_path();
    std::thread::spawn(move || {
        if let Ok(json) = serde_json::to_string(&snapshot) {
            let _ = std::fs::write(path, json);
        }
    });
}

pub fn poll_clipboard_once() -> Option<ClipboardItem> {
    let mut cb = arboard::Clipboard::new().ok()?;
    let now_str = Local::now().format("%I:%M %p").to_string();

    if let Ok(text) = cb.get_text() {
        let trimmed = text.trim().to_string();
        if !trimmed.is_empty() {
            let mut last = LAST_CLIP_STATE.lock().ok()?;
            if last.0 != trimmed {
                last.0 = trimmed.clone();
                last.1 = 0;
                drop(last);

                let is_url = trimmed.starts_with("http://") || trimmed.starts_with("https://");
                let is_code = trimmed.contains('\n')
                    && (trimmed.contains('{') || trimmed.contains("function ") || trimmed.contains("const "));
                let chars = trimmed.chars().count();
                let words = trimmed.split_whitespace().count();
                let lines = trimmed.lines().count().max(1);
                let flat: String = trimmed.split_whitespace().collect::<Vec<_>>().join(" ");
                let label = if flat.chars().count() > 42 {
                    format!("{}...", flat.chars().take(42).collect::<String>())
                } else {
                    flat
                };

                let item = ClipboardItem {
                    id: chrono::Utc::now().timestamp_millis() as u64,
                    category: if is_url { "Links".into() } else { "Text".into() },
                    preview: trimmed.clone(),
                    image_data_url: None,
                    label,
                    time: "now".into(),
                    item_type: if is_url {
                        "Link".into()
                    } else if is_code {
                        "Code Snippet".into()
                    } else {
                        "Text".into()
                    },
                    size: format!(
                        "{} characters · {} words · {} {}",
                        chars,
                        words,
                        lines,
                        if lines == 1 { "line" } else { "lines" }
                    ),
                    copied: format!("Today, {}", now_str),
                    icon_type: if is_url {
                        "link".into()
                    } else if is_code {
                        "code".into()
                    } else {
                        "text".into()
                    },
                    is_today: true,
                    is_pinned: false,
                };

                if let Ok(mut store) = CLIPBOARD_STORE.lock() {
                    store.retain(|i| i.preview != trimmed);
                    store.insert(0, item.clone());
                }
                save_clipboard_store_async();
                return Some(item);
            }
            return None;
        }
    }

    if let Ok(img) = cb.get_image() {
        let len = img.bytes.len();
        if len > 0 && img.width > 0 && img.height > 0 {
            let mut hasher = DefaultHasher::new();
            img.width.hash(&mut hasher);
            img.height.hash(&mut hasher);
            let step = (len / 256).max(1);
            for i in (0..len).step_by(step).take(256) {
                img.bytes[i].hash(&mut hasher);
            }
            let h = hasher.finish();

            let mut last = LAST_CLIP_STATE.lock().ok()?;
            if last.1 != h {
                last.1 = h;
                last.0.clear();
                drop(last);

                let rgba: ImageBuffer<Rgba<u8>, Vec<u8>> =
                    ImageBuffer::from_raw(img.width as u32, img.height as u32, img.bytes.into_owned())?;
                let dyn_img = image::DynamicImage::ImageRgba8(rgba);
                let resized = if img.width > 900 {
                    let new_h = ((img.height as f64) * (900.0 / img.width as f64)).round() as u32;
                    dyn_img.resize(900, new_h, image::imageops::FilterType::Triangle)
                } else {
                    dyn_img
                };
                let rgb = resized.to_rgb8();
                let mut buf = Cursor::new(Vec::new());
                let mut enc = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buf, 72);
                enc.encode(
                    rgb.as_raw(),
                    rgb.width(),
                    rgb.height(),
                    image::ExtendedColorType::Rgb8,
                )
                .ok()?;
                let jpg = buf.into_inner();
                let mb = format!("{:.2}", jpg.len() as f64 / (1024.0 * 1024.0));
                let data_url = format!("data:image/jpeg;base64,{}", BASE64.encode(&jpg));

                let item = ClipboardItem {
                    id: chrono::Utc::now().timestamp_millis() as u64,
                    category: "Images".into(),
                    preview: format!("Screenshot · {}", now_str),
                    image_data_url: Some(data_url.clone()),
                    label: format!("Screenshot · {} MB", mb),
                    time: "now".into(),
                    item_type: "Image JPEG".into(),
                    size: format!("{} MB", mb),
                    copied: format!("Today, {}", now_str),
                    icon_type: "image".into(),
                    is_today: true,
                    is_pinned: false,
                };

                if let Ok(mut store) = CLIPBOARD_STORE.lock() {
                    store.retain(|i| i.image_data_url.as_deref() != Some(data_url.as_str()));
                    store.insert(0, item.clone());
                }
                save_clipboard_store_async();
                return Some(item);
            }
        }
    }

    None
}

pub fn get_clipboard_history() -> Vec<ClipboardItem> {
    let _ = poll_clipboard_once();
    CLIPBOARD_STORE
        .lock()
        .map(|s| s.clone())
        .unwrap_or_default()
}

pub fn delete_clipboard_item(id: u64) {
    if let Ok(mut store) = CLIPBOARD_STORE.lock() {
        store.retain(|i| i.id != id);
    }
    save_clipboard_store_async();
}

pub fn toggle_pin_clipboard_item(id: u64) {
    if let Ok(mut store) = CLIPBOARD_STORE.lock() {
        for item in store.iter_mut() {
            if item.id == id {
                item.is_pinned = !item.is_pinned;
                item.is_today = !item.is_pinned;
            }
        }
    }
    save_clipboard_store_async();
}

pub fn clear_clipboard_history() {
    if let Ok(mut store) = CLIPBOARD_STORE.lock() {
        store.retain(|i| i.is_pinned);
    }
    save_clipboard_store_async();
}

pub fn write_clipboard_text(text: &str) -> bool {
    arboard::Clipboard::new()
        .and_then(|mut cb| cb.set_text(text.to_string()))
        .is_ok()
}

pub fn read_clipboard_text() -> String {
    arboard::Clipboard::new()
        .and_then(|mut cb| cb.get_text())
        .unwrap_or_default()
}

pub fn sleep_ms(ms: u64) {
    std::thread::sleep(Duration::from_millis(ms));
}
