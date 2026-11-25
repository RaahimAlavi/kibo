use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use once_cell::sync::Lazy;
use serde::Deserialize;
use serde_json::{json, Map, Value};
use std::collections::HashMap;
use std::fs;
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;
use std::time::{Duration, Instant};

const CREATE_NO_WINDOW: u32 = 0x08000000;

static ENV_VARS: Lazy<HashMap<String, String>> = Lazy::new(load_env_local);
static BROWSER_CONTEXT: Lazy<Mutex<(String, String)>> =
    Lazy::new(|| Mutex::new((String::new(), String::new())));

fn load_env_local() -> HashMap<String, String> {
    let mut map = HashMap::new();
    let candidates = [
        PathBuf::from(".env.local"),
        PathBuf::from("..").join(".env.local"),
        std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|d| d.join(".env.local")))
            .unwrap_or_default(),
    ];
    for p in candidates {
        if let Ok(content) = fs::read_to_string(&p) {
            for line in content.lines() {
                let t = line.trim();
                if t.is_empty() || t.starts_with('#') {
                    continue;
                }
                if let Some((k, v)) = t.split_once('=') {
                    let clean_v = v.trim().trim_matches('"').trim_matches('\'').to_string();
                    map.insert(k.trim().to_string(), clean_v);
                }
            }
            break;
        }
    }
    map
}

pub fn get_env_var(name: &str) -> String {
    std::env::var(name)
        .ok()
        .filter(|s| !s.trim().is_empty())
        .or_else(|| ENV_VARS.get(name).cloned())
        .unwrap_or_default()
}

pub fn kibo_data_dir() -> PathBuf {
    let dir = dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("kibo");
    let _ = fs::create_dir_all(&dir);
    dir
}

pub fn settings_path() -> PathBuf {
    kibo_data_dir().join("kibo_settings.json")
}

pub fn read_settings() -> Map<String, Value> {
    let p = settings_path();
    if let Ok(raw) = fs::read_to_string(&p) {
        if let Ok(Value::Object(map)) = serde_json::from_str::<Value>(&raw) {
            return map;
        }
    }
    Map::new()
}

pub fn write_settings_patch(patch: Map<String, Value>) -> Map<String, Value> {
    let mut current = read_settings();
    for (k, v) in patch {
        current.insert(k, v);
    }
    let p = settings_path();
    if let Ok(serialized) = serde_json::to_string_pretty(&Value::Object(current.clone())) {
        let _ = fs::write(p, serialized);
    }
    current
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ElevenLabsRequest {
    pub text: Option<String>,
    pub voice_id: Option<String>,
    pub model_id: Option<String>,
    pub api_key: Option<String>,
}

pub async fn elevenlabs_speak(opts: ElevenLabsRequest) -> Option<Vec<u8>> {
    let settings = read_settings();
    let api_key = opts
        .api_key
        .filter(|s| !s.trim().is_empty())
        .or_else(|| {
            let e = get_env_var("ELEVENLABS_API_KEY");
            if e.is_empty() { None } else { Some(e) }
        })
        .or_else(|| {
            settings
                .get("kibo_elevenlabs_key")
                .and_then(|v| v.as_str())
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
        })?;

    let raw_text = opts.text.unwrap_or_default();
    let clean_text: String = raw_text
        .chars()
        .map(|c| match c {
            '*' | '_' | '#' | '`' | '~' | '[' | ']' => ' ',
            _ => c,
        })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    if clean_text.is_empty() {
        return None;
    }

    let voice_id = opts
        .voice_id
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "EXAVITQu4vr4xnSDxMaL".into());
    let model_id = opts
        .model_id
        .filter(|s| !s.trim().is_empty())
        .or_else(|| {
            settings
                .get("kibo_elevenlabs_model")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        })
        .unwrap_or_else(|| "eleven_turbo_v2_5".into());

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .ok()?;

    let call_rest = |vid: String, mid: String| {
        let client = client.clone();
        let api_key = api_key.clone();
        let clean_text = clean_text.clone();
        async move {
            let url = format!(
                "https://api.elevenlabs.io/v1/text-to-speech/{}?output_format=mp3_44100_128",
                vid
            );
            let res = client
                .post(&url)
                .header("xi-api-key", &api_key)
                .header("Accept", "audio/mpeg")
                .json(&json!({
                    "text": clean_text,
                    "model_id": mid,
                    "voice_settings": {
                        "stability": 0.55,
                        "similarity_boost": 0.78,
                        "style": 0.0,
                        "use_speaker_boost": true
                    }
                }))
                .send()
                .await
                .ok()?;
            if !res.status().is_success() {
                return None;
            }
            res.bytes().await.ok().map(|b| b.to_vec())
        }
    };

    if let Some(bytes) = call_rest(voice_id.clone(), model_id.clone()).await {
        return Some(bytes);
    }
    if voice_id != "EXAVITQu4vr4xnSDxMaL" {
        if let Some(bytes) = call_rest("EXAVITQu4vr4xnSDxMaL".into(), "eleven_turbo_v2_5".into()).await {
            return Some(bytes);
        }
    }
    if model_id != "eleven_flash_v2_5" {
        return call_rest(voice_id, "eleven_flash_v2_5".into()).await;
    }
    None
}

pub fn open_url_or_path(target: &str) -> bool {
    let trimmed = target.trim();
    if trimmed.is_empty() {
        return false;
    }
    Command::new("cmd")
        .args(["/C", "start", "", trimmed])
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .is_ok()
}

pub fn show_item_in_folder(file_path: &str) -> Value {
    let p = Path::new(file_path);
    if !file_path.is_empty() && p.exists() {
        let arg = format!("/select,\"{}\"", file_path.replace('/', "\\"));
        let _ = Command::new("explorer.exe").raw_arg(arg).spawn();
        json!({ "exists": true, "opened": true })
    } else {
        json!({ "exists": false, "opened": false })
    }
}

pub fn filter_existing_files(paths: Vec<String>) -> Vec<String> {
    paths
        .into_iter()
        .filter(|p| !p.is_empty() && Path::new(p).exists())
        .collect()
}

pub fn open_application(app_name: &str) -> Value {
    let q = app_name.trim();
    if q.is_empty() {
        return json!({ "success": false, "error": "Empty app name" });
    }
    let low = q.to_lowercase();

    // Direct URL or existing path
    if low.starts_with("http://") || low.starts_with("https://") || Path::new(q).exists() {
        let ok = open_url_or_path(q);
        return json!({ "success": ok, "app": q });
    }

    // Known fast Windows apps & URI protocols
    let direct_target: Option<&str> = match low.as_str() {
        "spotify" => Some("spotify:"),
        "chrome" | "google chrome" => Some("chrome"),
        "edge" | "microsoft edge" => Some("msedge"),
        "notepad" => Some("notepad"),
        "calculator" | "calc" => Some("calc"),
        "paint" => Some("mspaint"),
        "terminal" | "wt" => Some("wt"),
        "cmd" | "command prompt" => Some("cmd"),
        "explorer" | "file explorer" => Some("explorer"),
        "settings" | "windows settings" => Some("ms-settings:"),
        "vscode" | "vs code" | "visual studio code" | "code" => Some("code"),
        "discord" => Some("discord:"),
        "steam" => Some("steam://open/main"),
        "whatsapp" => Some("whatsapp:"),
        "youtube" => Some("https://www.youtube.com"),
        "gmail" => Some("https://mail.google.com"),
        "github" => Some("https://github.com"),
        "notion" => Some("https://www.notion.so"),
        "figma" => Some("https://www.figma.com"),
        _ => None,
    };

    if let Some(t) = direct_target {
        if open_url_or_path(t) {
            return json!({ "success": true, "app": q });
        }
    }

    // Search Desktop, Documents, Downloads for matching file
    if let Some(found) = find_user_file_by_name(q) {
        let ok = open_url_or_path(&found.to_string_lossy());
        return json!({ "success": ok, "app": found.to_string_lossy() });
    }

    // Fallback: let Windows shell launch Start Menu / PATH app
    let ok = open_url_or_path(q);
    json!({ "success": ok, "app": q })
}

pub fn find_user_file_by_name(query: &str) -> Option<PathBuf> {
    let q_low = query.trim().to_lowercase();
    if q_low.is_empty() {
        return None;
    }
    let dirs_to_search: Vec<PathBuf> = [
        dirs::desktop_dir(),
        dirs::download_dir(),
        dirs::document_dir(),
        dirs::picture_dir(),
    ]
    .into_iter()
    .flatten()
    .collect();

    for dir in dirs_to_search {
        if let Ok(entries) = fs::read_dir(&dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                        let n_low = name.to_lowercase();
                        if n_low == q_low || n_low.contains(&q_low) {
                            return Some(path);
                        }
                    }
                }
            }
        }
    }
    None
}

pub fn get_installed_apps() -> Vec<Value> {
    let mut apps = Vec::new();
    let start_dirs = [
        dirs::data_dir().map(|d| d.join(r"Microsoft\Windows\Start Menu\Programs")),
        Some(PathBuf::from(r"C:\ProgramData\Microsoft\Windows\Start Menu\Programs")),
    ];
    let mut seen = std::collections::HashSet::new();

    for maybe_dir in start_dirs.into_iter().flatten() {
        collect_lnk_apps(&maybe_dir, 0, &mut seen, &mut apps);
        if apps.len() >= 80 {
            break;
        }
    }
    apps
}

fn collect_lnk_apps(
    dir: &Path,
    depth: usize,
    seen: &mut std::collections::HashSet<String>,
    out: &mut Vec<Value>,
) {
    if depth > 2 || out.len() >= 80 {
        return;
    }
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        if out.len() >= 80 {
            break;
        }
        let path = entry.path();
        if path.is_dir() {
            collect_lnk_apps(&path, depth + 1, seen, out);
        } else if path
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.eq_ignore_ascii_case("lnk"))
            .unwrap_or(false)
        {
            if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                let low = stem.to_lowercase();
                if low.contains("uninstall") || low.contains("readme") || low.contains("help") {
                    continue;
                }
                if seen.insert(low) {
                    out.push(json!({
                        "name": stem,
                        "path": path.to_string_lossy(),
                        "category": "Apps",
                        "isGame": false,
                    }));
                }
            }
        }
    }
}

fn escape_pdf_literal(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 8);
    for ch in s.chars() {
        match ch {
            '\\' => out.push_str("\\\\"),
            '(' => out.push_str("\\("),
            ')' => out.push_str("\\)"),
            '\t' => out.push_str("    "),
            '\u{2018}' | '\u{2019}' => out.push('\''),
            '\u{201C}' | '\u{201D}' => out.push('"'),
            '\u{2013}' | '\u{2014}' => out.push('-'),
            '\u{2022}' => out.push('*'),
            '\u{2026}' => out.push_str("..."),
            c if (c as u32) >= 32 && (c as u32) <= 126 => out.push(c),
            c if (c as u32) >= 160 && (c as u32) <= 255 => out.push(c),
            _ => out.push(' '),
        }
    }
    out
}

fn wrap_text_lines(text: &str, max_cols: usize) -> Vec<String> {
    let mut lines = Vec::new();
    for raw_line in text.replace("\r\n", "\n").replace('\r', "\n").split('\n') {
        if raw_line.is_empty() {
            lines.push(String::new());
            continue;
        }
        let mut current = String::new();
        for word in raw_line.split_inclusive(' ') {
            if !current.is_empty() && current.chars().count() + word.chars().count() > max_cols {
                lines.push(current.trim_end().to_string());
                current.clear();
            }
            if word.chars().count() > max_cols {
                let mut buf = String::new();
                for ch in word.chars() {
                    buf.push(ch);
                    if buf.chars().count() >= max_cols {
                        lines.push(buf.clone());
                        buf.clear();
                    }
                }
                current.push_str(&buf);
            } else {
                current.push_str(word);
            }
        }
        if !current.is_empty() {
            lines.push(current.trim_end().to_string());
        }
    }
    if lines.is_empty() {
        lines.push(String::new());
    }
    lines
}

fn build_pdf_document(objects: Vec<Vec<u8>>) -> Vec<u8> {
    let mut pdf = Vec::new();
    pdf.extend_from_slice(b"%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
    let mut offsets = Vec::with_capacity(objects.len() + 1);
    offsets.push(0usize);

    for (idx, body) in objects.iter().enumerate() {
        offsets.push(pdf.len());
        pdf.extend_from_slice(format!("{} 0 obj\n", idx + 1).as_bytes());
        pdf.extend_from_slice(body);
        if !body.ends_with(b"\n") {
            pdf.push(b'\n');
        }
        pdf.extend_from_slice(b"endobj\n");
    }

    let xref_offset = pdf.len();
    pdf.extend_from_slice(format!("xref\n0 {}\n", objects.len() + 1).as_bytes());
    pdf.extend_from_slice(b"0000000000 65535 f \n");
    for off in offsets.iter().skip(1) {
        pdf.extend_from_slice(format!("{:010} 00000 n \n", off).as_bytes());
    }
    pdf.extend_from_slice(
        format!(
            "trailer\n<< /Size {} /Root 1 0 R >>\nstartxref\n{}\n%%EOF\n",
            objects.len() + 1,
            xref_offset
        )
        .as_bytes(),
    );
    pdf
}

fn write_text_pdf(out_path: &Path, title: &str, text: &str) -> Result<(), String> {
    let wrapped = wrap_text_lines(text, 84);
    let lines_per_page = 46usize;
    let total_pages = ((wrapped.len() + lines_per_page - 1) / lines_per_page).max(1);

    // Obj 1: Catalog, Obj 2: Pages, Obj 3: Helvetica, Obj 4: Helvetica-Bold
    // For each page i: Obj (5 + 2*i) = Page, Obj (6 + 2*i) = Content stream
    let mut objects: Vec<Vec<u8>> = Vec::with_capacity(4 + total_pages * 2);
    objects.push(b"<< /Type /Catalog /Pages 2 0 R >>".to_vec());

    let mut kids = String::new();
    for i in 0..total_pages {
        let page_obj = 5 + i * 2;
        kids.push_str(&format!("{} 0 R ", page_obj));
    }
    objects.push(
        format!("<< /Type /Pages /Kids [ {}] /Count {} >>", kids, total_pages).into_bytes(),
    );
    objects.push(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>".to_vec());
    objects.push(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>".to_vec());

    for page_idx in 0..total_pages {
        let page_obj = 5 + page_idx * 2;
        let content_obj = page_obj + 1;
        objects.push(
            format!(
                "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents {} 0 R >>",
                content_obj
            )
            .into_bytes(),
        );

        let start = page_idx * lines_per_page;
        let end = (start + lines_per_page).min(wrapped.len());
        let mut stream = String::new();
        stream.push_str("BT\n");
        let mut y = 738i32;

        if page_idx == 0 && !title.trim().is_empty() {
            stream.push_str(&format!(
                "/F2 13 Tf\n1 0 0 1 54 {} Tm\n({}) Tj\n",
                y,
                escape_pdf_literal(title)
            ));
            y -= 24;
        }

        stream.push_str("/F1 10.5 Tf\n");
        for line in &wrapped[start..end] {
            if !line.is_empty() {
                stream.push_str(&format!(
                    "1 0 0 1 54 {} Tm\n({}) Tj\n",
                    y,
                    escape_pdf_literal(line)
                ));
            }
            y -= 14;
            if y < 48 {
                break;
            }
        }
        stream.push_str("ET\n");

        let stream_bytes = stream.into_bytes();
        let mut obj = format!("<< /Length {} >>\nstream\n", stream_bytes.len()).into_bytes();
        obj.extend_from_slice(&stream_bytes);
        obj.extend_from_slice(b"\nendstream");
        objects.push(obj);
    }

    let pdf_bytes = build_pdf_document(objects);
    fs::write(out_path, pdf_bytes).map_err(|e| e.to_string())
}

fn write_image_pdf(out_path: &Path, img: &image::DynamicImage) -> Result<(), String> {
    let rgb = img.to_rgb8();
    let img_w = rgb.width().max(1);
    let img_h = rgb.height().max(1);
    let mut jpg_bytes = Vec::new();
    {
        let mut enc = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut jpg_bytes, 90);
        enc.encode(
            rgb.as_raw(),
            img_w,
            img_h,
            image::ExtendedColorType::Rgb8,
        )
        .map_err(|e| e.to_string())?;
    }

    let (page_w, page_h) = if img_w > img_h { (842.0_f64, 595.0_f64) } else { (595.0_f64, 842.0_f64) };
    let margin = 24.0_f64;
    let avail_w = page_w - margin * 2.0;
    let avail_h = page_h - margin * 2.0;
    let scale = (avail_w / img_w as f64).min(avail_h / img_h as f64);
    let draw_w = img_w as f64 * scale;
    let draw_h = img_h as f64 * scale;
    let dx = (page_w - draw_w) * 0.5;
    let dy = (page_h - draw_h) * 0.5;

    let content = format!(
        "q\n{:.2} 0 0 {:.2} {:.2} {:.2} cm\n/Im0 Do\nQ\n",
        draw_w, draw_h, dx, dy
    );
    let content_bytes = content.into_bytes();

    let mut img_obj = format!(
        "<< /Type /XObject /Subtype /Image /Width {} /Height {} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length {} >>\nstream\n",
        img_w,
        img_h,
        jpg_bytes.len()
    )
    .into_bytes();
    img_obj.extend_from_slice(&jpg_bytes);
    img_obj.extend_from_slice(b"\nendstream");

    let mut content_obj = format!("<< /Length {} >>\nstream\n", content_bytes.len()).into_bytes();
    content_obj.extend_from_slice(&content_bytes);
    content_obj.extend_from_slice(b"\nendstream");

    let objects = vec![
        b"<< /Type /Catalog /Pages 2 0 R >>".to_vec(),
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>".to_vec(),
        format!(
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {:.0} {:.0}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>",
            page_w, page_h
        )
        .into_bytes(),
        img_obj,
        content_obj,
    ];

    let pdf_bytes = build_pdf_document(objects);
    fs::write(out_path, pdf_bytes).map_err(|e| e.to_string())
}

fn crc32_ieee(data: &[u8]) -> u32 {
    let mut crc: u32 = 0xFFFF_FFFF;
    for &b in data {
        crc ^= b as u32;
        for _ in 0..8 {
            if (crc & 1) != 0 {
                crc = (crc >> 1) ^ 0xEDB8_8320;
            } else {
                crc >>= 1;
            }
        }
    }
    !crc
}

fn build_store_zip(entries: &[(&str, &[u8])]) -> Vec<u8> {
    let mut out = Vec::new();
    let mut central = Vec::new();
    for (name, data) in entries {
        let name_bytes = name.as_bytes();
        let crc = crc32_ieee(data);
        let len = data.len() as u32;
        let local_offset = out.len() as u32;

        // Local file header (STORE method = 0)
        out.extend_from_slice(&0x0403_4B50u32.to_le_bytes());
        out.extend_from_slice(&20u16.to_le_bytes()); // version needed
        out.extend_from_slice(&0u16.to_le_bytes()); // flags
        out.extend_from_slice(&0u16.to_le_bytes()); // compression: store
        out.extend_from_slice(&0u16.to_le_bytes()); // mod time
        out.extend_from_slice(&0u16.to_le_bytes()); // mod date
        out.extend_from_slice(&crc.to_le_bytes());
        out.extend_from_slice(&len.to_le_bytes());
        out.extend_from_slice(&len.to_le_bytes());
        out.extend_from_slice(&(name_bytes.len() as u16).to_le_bytes());
        out.extend_from_slice(&0u16.to_le_bytes()); // extra len
        out.extend_from_slice(name_bytes);
        out.extend_from_slice(data);

        // Central directory header
        central.extend_from_slice(&0x0201_4B50u32.to_le_bytes());
        central.extend_from_slice(&20u16.to_le_bytes()); // version made by
        central.extend_from_slice(&20u16.to_le_bytes()); // version needed
        central.extend_from_slice(&0u16.to_le_bytes()); // flags
        central.extend_from_slice(&0u16.to_le_bytes()); // compression: store
        central.extend_from_slice(&0u16.to_le_bytes()); // mod time
        central.extend_from_slice(&0u16.to_le_bytes()); // mod date
        central.extend_from_slice(&crc.to_le_bytes());
        central.extend_from_slice(&len.to_le_bytes());
        central.extend_from_slice(&len.to_le_bytes());
        central.extend_from_slice(&(name_bytes.len() as u16).to_le_bytes());
        central.extend_from_slice(&0u16.to_le_bytes()); // extra len
        central.extend_from_slice(&0u16.to_le_bytes()); // comment len
        central.extend_from_slice(&0u16.to_le_bytes()); // disk start
        central.extend_from_slice(&0u16.to_le_bytes()); // internal attr
        central.extend_from_slice(&0u32.to_le_bytes()); // external attr
        central.extend_from_slice(&local_offset.to_le_bytes());
        central.extend_from_slice(name_bytes);
    }

    let cd_offset = out.len() as u32;
    let cd_size = central.len() as u32;
    let count = entries.len() as u16;
    out.extend_from_slice(&central);

    // End of central directory
    out.extend_from_slice(&0x0605_4B50u32.to_le_bytes());
    out.extend_from_slice(&0u16.to_le_bytes());
    out.extend_from_slice(&0u16.to_le_bytes());
    out.extend_from_slice(&count.to_le_bytes());
    out.extend_from_slice(&count.to_le_bytes());
    out.extend_from_slice(&cd_size.to_le_bytes());
    out.extend_from_slice(&cd_offset.to_le_bytes());
    out.extend_from_slice(&0u16.to_le_bytes());
    out
}

fn escape_xml(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 16);
    for ch in s.chars() {
        // Strip invalid XML 1.0 control characters so Microsoft Word never flags corrupt XML
        let code = ch as u32;
        if code < 0x20 && ch != '\t' && ch != '\n' && ch != '\r' {
            continue;
        }
        match ch {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&apos;"),
            _ => out.push(ch),
        }
    }
    out
}

fn is_rtl_char(ch: char) -> bool {
    let c = ch as u32;
    (0x0590..=0x05FF).contains(&c)
        || (0x0600..=0x06FF).contains(&c)
        || (0x0750..=0x077F).contains(&c)
        || (0x08A0..=0x08FF).contains(&c)
        || (0xFB50..=0xFDFF).contains(&c)
        || (0xFE70..=0xFEFF).contains(&c)
}

fn is_rtl_paragraph(line: &str) -> bool {
    let mut rtl = 0usize;
    let mut ltr = 0usize;
    for ch in line.chars() {
        if is_rtl_char(ch) {
            rtl += 1;
        } else if ch.is_ascii_alphabetic() {
            ltr += 1;
        }
    }
    rtl > 0 && rtl >= ltr
}

fn render_docx_runs(line: &str, rtl: bool, is_heading: bool, font_half_pts: u32) -> String {
    let mut xml = String::new();
    let segments: Vec<(&str, bool)> = if line.contains("**") {
        let mut res = Vec::new();
        let mut bold = false;
        for part in line.split("**") {
            if !part.is_empty() {
                res.push((part, bold));
            }
            bold = !bold;
        }
        res
    } else {
        vec![(line, false)]
    };

    for (seg, seg_bold) in segments {
        let bold_tag = if is_heading || seg_bold {
            "<w:b/><w:bCs/>"
        } else {
            ""
        };
        let rtl_tag = if rtl { "<w:rtl/>" } else { "" };
        let fonts = if rtl {
            r#"<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>"#
        } else {
            r#"<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Arial"/>"#
        };
        xml.push_str(&format!(
            "<w:r><w:rPr>{}{}{}<w:sz w:val=\"{}\"/><w:szCs w:val=\"{}\"/></w:rPr><w:t xml:space=\"preserve\">{}</w:t></w:r>",
            fonts,
            bold_tag,
            rtl_tag,
            font_half_pts,
            font_half_pts,
            escape_xml(seg)
        ));
    }
    xml
}

fn write_text_docx(out_path: &Path, text: &str) -> Result<(), String> {
    let content_types = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>"#;

    let rels = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>"#;

    let doc_rels = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>"#;

    let normalized = text.replace("\r\n", "\n").replace('\r', "\n");
    let doc_is_rtl = is_rtl_paragraph(&normalized);

    let mut body = String::new();
    for raw_line in normalized.split('\n') {
        let trimmed = raw_line.trim();
        if trimmed == "---" || trimmed == "___" {
            body.push_str("<w:p><w:r><w:br w:type=\"page\"/></w:r></w:p>");
            continue;
        }
        let (clean_line, is_heading, font_sz) = if let Some(rest) = trimmed.strip_prefix("### ") {
            (rest, true, 24u32)
        } else if let Some(rest) = trimmed.strip_prefix("## ") {
            (rest, true, 26u32)
        } else if let Some(rest) = trimmed.strip_prefix("# ") {
            (rest, true, 30u32)
        } else {
            (raw_line, false, 22u32)
        };

        let para_rtl = if clean_line.trim().is_empty() {
            doc_is_rtl
        } else {
            is_rtl_paragraph(clean_line)
        };
        let ppr = if para_rtl {
            "<w:pPr><w:bidi/><w:jc w:val=\"right\"/><w:spacing w:after=\"120\" w:line=\"276\" w:lineRule=\"auto\"/></w:pPr>"
        } else {
            "<w:pPr><w:spacing w:after=\"120\" w:line=\"276\" w:lineRule=\"auto\"/></w:pPr>"
        };

        body.push_str("<w:p>");
        body.push_str(ppr);
        if !clean_line.is_empty() {
            body.push_str(&render_docx_runs(clean_line, para_rtl, is_heading, font_sz));
        }
        body.push_str("</w:p>");
    }

    let sect_pr = if doc_is_rtl {
        "<w:sectPr><w:bidi/><w:pgSz w:w=\"12240\" w:h=\"15840\"/><w:pgMar w:top=\"1080\" w:right=\"1080\" w:bottom=\"1080\" w:left=\"1080\"/></w:sectPr>"
    } else {
        "<w:sectPr><w:pgSz w:w=\"12240\" w:h=\"15840\"/><w:pgMar w:top=\"1080\" w:right=\"1080\" w:bottom=\"1080\" w:left=\"1080\"/></w:sectPr>"
    };

    let document_xml = format!(
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>{}{}</w:body></w:document>"#,
        body, sect_pr
    );

    let zip_bytes = build_store_zip(&[
        ("[Content_Types].xml", content_types.as_bytes()),
        ("_rels/.rels", rels.as_bytes()),
        ("word/_rels/document.xml.rels", doc_rels.as_bytes()),
        ("word/document.xml", document_xml.as_bytes()),
    ]);
    fs::write(out_path, zip_bytes).map_err(|e| e.to_string())
}

fn write_image_pages_docx(out_path: &Path, pages: &[(Vec<u8>, u32, u32)]) -> Result<(), String> {
    if pages.is_empty() {
        return Err("No pages to embed into Word document.".into());
    }

    let content_types = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="jpg" ContentType="image/jpeg"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>"#;

    let rels = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>"#;

    let mut doc_rels = String::from(
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">"#,
    );
    let mut body = String::new();

    // Fit cleanly inside standard 7.5in x 9.8in printable page area (1 inch = 914400 EMU)
    let max_cx: f64 = 6_858_000.0;
    let max_cy: f64 = 8_961_120.0;

    for (idx, (_, w, h)) in pages.iter().enumerate() {
        let num = idx + 1;
        let rid = format!("rId{}", num);
        doc_rels.push_str(&format!(
            r#"<Relationship Id="{}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/page_{}.jpg"/>"#,
            rid, num
        ));

        let iw = (*w).max(1) as f64;
        let ih = (*h).max(1) as f64;
        let scale = (max_cx / iw).min(max_cy / ih);
        let cx = (iw * scale).round() as u64;
        let cy = (ih * scale).round() as u64;

        body.push_str(&format!(
            r#"<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="{cx}" cy="{cy}"/><wp:docPr id="{num}" name="Page {num}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="{num}" name="page_{num}.jpg"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="{rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="{cx}" cy="{cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>"#
        ));

        if num < pages.len() {
            body.push_str("<w:p><w:r><w:br w:type=\"page\"/></w:r></w:p>");
        }
    }
    doc_rels.push_str("</Relationships>");

    let document_xml = format!(
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>{}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="540" w:right="540" w:bottom="540" w:left="540"/></w:sectPr></w:body></w:document>"#,
        body
    );

    let mut owned_names: Vec<String> = Vec::with_capacity(pages.len());
    for idx in 0..pages.len() {
        owned_names.push(format!("word/media/page_{}.jpg", idx + 1));
    }

    let mut zip_entries: Vec<(&str, &[u8])> = vec![
        ("[Content_Types].xml", content_types.as_bytes()),
        ("_rels/.rels", rels.as_bytes()),
        ("word/_rels/document.xml.rels", doc_rels.as_bytes()),
        ("word/document.xml", document_xml.as_bytes()),
    ];
    for (idx, (jpg, _, _)) in pages.iter().enumerate() {
        zip_entries.push((owned_names[idx].as_str(), jpg.as_slice()));
    }

    let zip_bytes = build_store_zip(&zip_entries);
    fs::write(out_path, zip_bytes).map_err(|e| e.to_string())
}

fn strip_html_tags(raw: &str) -> String {
    let mut out = String::with_capacity(raw.len());
    let mut in_tag = false;
    for ch in raw.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => {
                in_tag = false;
                out.push(' ');
            }
            _ if !in_tag => out.push(ch),
            _ => {}
        }
    }
    out.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&nbsp;", " ")
}

fn extract_docx_text(src: &Path) -> Option<String> {
    let path_str = src.to_string_lossy().replace('\'', "''");
    let script = format!(
        "Add-Type -AssemblyName System.IO.Compression.FileSystem; $z = [System.IO.Compression.ZipFile]::OpenRead('{}'); try {{ $e = $z.GetEntry('word/document.xml'); if ($e) {{ $sr = New-Object System.IO.StreamReader($e.Open(), [System.Text.Encoding]::UTF8); $xml = $sr.ReadToEnd(); $sr.Close(); $xml = $xml -replace '</w:p>', \"`n\" -replace '<[^>]+>', ''; [System.Net.WebUtility]::HtmlDecode($xml) }} }} finally {{ $z.Dispose() }}",
        path_str
    );
    let output = Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", &script])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .ok()?;
    if output.status.success() {
        let s = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !s.is_empty() {
            return Some(s);
        }
    }
    None
}

fn is_meaningful_document_text(text: &str) -> bool {
    let mut alnum = 0usize;
    let mut bad = 0usize;
    for ch in text.chars() {
        let code = ch as u32;
        if ch == '\u{FFFD}' || (0xE000..=0xF8FF).contains(&code) {
            bad += 1;
        } else if ch.is_alphabetic() || ch.is_numeric() {
            alnum += 1;
        }
    }
    if alnum < 20 {
        return false;
    }
    // Reject PDFs with broken/unmapped custom glyph tables (common in scanned or legacy Arabic PDFs)
    bad * 8 <= alnum
}

fn clean_extracted_text(raw: &str) -> String {
    let mut lines: Vec<String> = Vec::new();
    let mut prev_blank = false;
    for line in raw.replace("\r\n", "\n").replace('\r', "\n").split('\n') {
        let trimmed_end = line.trim_end();
        if trimmed_end.trim().is_empty() {
            if !prev_blank && !lines.is_empty() {
                lines.push(String::new());
                prev_blank = true;
            }
        } else {
            lines.push(trimmed_end.to_string());
            prev_blank = false;
        }
    }
    let out = lines.join("\n").trim().to_string();
    // Strip accidental markdown code fences if an OCR model wraps output
    if out.starts_with("```") {
        let mut inner = out.lines().skip(1).collect::<Vec<_>>();
        if inner.last().map(|l| l.trim() == "```").unwrap_or(false) {
            inner.pop();
        }
        return inner.join("\n").trim().to_string();
    }
    out
}

fn extract_pdf_text_native(src: &Path) -> Option<String> {
    let path_owned = src.to_path_buf();
    let extracted = std::panic::catch_unwind(move || pdf_extract::extract_text(&path_owned))
        .ok()
        .and_then(|res| res.ok())?;
    let cleaned = clean_extracted_text(&extracted);
    if is_meaningful_document_text(&cleaned) {
        Some(cleaned)
    } else {
        None
    }
}

fn resolve_gemini_api_key(payload: &Value) -> Option<String> {
    if let Some(k) = payload
        .get("apiKey")
        .and_then(|v| v.as_str())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
    {
        return Some(k);
    }
    let settings = read_settings();
    if let Some(k) = settings
        .get("kibo_gemini_key")
        .and_then(|v| v.as_str())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
    {
        return Some(k);
    }
    for env_name in ["GEMINI_API_KEY", "VITE_GEMINI_API_KEY"] {
        let e = get_env_var(env_name);
        if !e.trim().is_empty() {
            return Some(e.trim().to_string());
        }
    }
    None
}

async fn gemini_ocr_parts(api_key: &str, inline_parts: Vec<(&str, Vec<u8>)>) -> Option<String> {
    if api_key.trim().is_empty() || inline_parts.is_empty() {
        return None;
    }
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(60))
        .build()
        .ok()?;

    let mut parts: Vec<Value> = Vec::with_capacity(inline_parts.len() + 1);
    parts.push(json!({
        "text": "Transcribe ALL visible text from this document verbatim, page by page, in the exact original language (keep Arabic in Arabic, Urdu in Urdu, English in English, etc. Do NOT translate, summarize, or add any explanation). Preserve titles, headings, numbered clauses, bullet lists, and line breaks cleanly. Separate distinct pages with a line containing only ---. Output ONLY the extracted text with no markdown code fences."
    }));
    for (mime, bytes) in inline_parts {
        parts.push(json!({
            "inlineData": {
                "mimeType": mime,
                "data": BASE64.encode(bytes)
            }
        }));
    }

    let body = json!({
        "contents": [{
            "role": "user",
            "parts": parts
        }],
        "generationConfig": {
            "temperature": 0.0,
            "maxOutputTokens": 8192
        }
    });

    for model in ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"] {
        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
            model, api_key
        );
        let Ok(resp) = client.post(&url).json(&body).send().await else {
            continue;
        };
        if !resp.status().is_success() {
            continue;
        }
        let Ok(val) = resp.json::<Value>().await else {
            continue;
        };
        let text = val
            .pointer("/candidates/0/content/parts")
            .and_then(|p| p.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|part| part.get("text").and_then(|t| t.as_str()))
                    .collect::<Vec<_>>()
                    .join("\n")
            })
            .unwrap_or_default();
        let cleaned = clean_extracted_text(&text);
        if is_meaningful_document_text(&cleaned) {
            return Some(cleaned);
        }
    }
    None
}

fn normalize_winrt_path(src: &Path) -> String {
    let abs = fs::canonicalize(src).unwrap_or_else(|_| src.to_path_buf());
    let s = abs.to_string_lossy().to_string();
    s.strip_prefix(r"\\?\").unwrap_or(&s).replace('/', "\\")
}

#[cfg(windows)]
fn read_winrt_stream_bytes(
    stream: &windows::Storage::Streams::InMemoryRandomAccessStream,
) -> Option<Vec<u8>> {
    use windows::Storage::Streams::DataReader;

    let size = stream.Size().ok()? as usize;
    if size == 0 || size > 64 * 1024 * 1024 {
        return None;
    }
    stream.Seek(0).ok()?;
    let input = stream.GetInputStreamAt(0).ok()?;
    let reader = DataReader::CreateDataReader(&input).ok()?;
    let loaded = reader.LoadAsync(size as u32).ok()?.get().ok()? as usize;
    let mut buf = vec![0u8; loaded];
    reader.ReadBytes(&mut buf).ok()?;
    Some(buf)
}

#[cfg(windows)]
fn run_winrt_ocr_on_bitmap(bitmap: &windows::Graphics::Imaging::SoftwareBitmap) -> Option<String> {
    use windows::Media::Ocr::OcrEngine;

    let mut engines: Vec<OcrEngine> = Vec::new();
    if let Ok(eng) = OcrEngine::TryCreateFromUserProfileLanguages() {
        engines.push(eng);
    }
    if let Ok(langs) = OcrEngine::AvailableRecognizerLanguages() {
        let count = langs.Size().unwrap_or(0);
        for i in 0..count {
            if let Ok(lang) = langs.GetAt(i) {
                let tag = lang
                    .LanguageTag()
                    .map(|t| t.to_string().to_lowercase())
                    .unwrap_or_default();
                if tag.starts_with("ar") || tag.starts_with("en") {
                    if let Ok(eng) = OcrEngine::TryCreateFromLanguage(&lang) {
                        engines.push(eng);
                    }
                }
            }
        }
    }

    let mut best_text = String::new();
    let mut best_score = 0usize;
    for engine in engines {
        if let Ok(op) = engine.RecognizeAsync(bitmap) {
            if let Ok(res) = op.get() {
                let mut page_lines = Vec::new();
                if let Ok(lines) = res.Lines() {
                    let lc = lines.Size().unwrap_or(0);
                    for j in 0..lc {
                        if let Ok(line) = lines.GetAt(j) {
                            if let Ok(txt) = line.Text() {
                                let s = txt.to_string();
                                if !s.trim().is_empty() {
                                    page_lines.push(s);
                                }
                            }
                        }
                    }
                }
                let joined = page_lines.join("\n");
                let score = joined.chars().filter(|c| c.is_alphabetic() || c.is_numeric()).count();
                if score > best_score {
                    best_score = score;
                    best_text = joined;
                }
            }
        }
    }

    if best_score >= 8 {
        Some(best_text)
    } else {
        None
    }
}

/// Uses Windows 10/11 built-in Direct2D PdfDocument + OcrEngine to render PDF pages cleanly
/// (0 extra installer MB!) returning crisp JPEG page buffers and optional offline OCR text.
#[cfg(windows)]
fn render_and_ocr_pdf_winrt(
    src: &Path,
    max_pages: u32,
    run_ocr: bool,
) -> (Vec<(Vec<u8>, u32, u32)>, Option<String>) {
    use windows::core::HSTRING;
    use windows::Data::Pdf::{PdfDocument, PdfPageRenderOptions};
    use windows::Graphics::Imaging::BitmapDecoder;
    use windows::Storage::StorageFile;
    use windows::Storage::Streams::InMemoryRandomAccessStream;

    let mut rendered_pages: Vec<(Vec<u8>, u32, u32)> = Vec::new();
    let mut ocr_pages: Vec<String> = Vec::new();

    let win_path = normalize_winrt_path(src);
    let Ok(file_op) = StorageFile::GetFileFromPathAsync(&HSTRING::from(win_path)) else {
        return (rendered_pages, None);
    };
    let Ok(file) = file_op.get() else {
        return (rendered_pages, None);
    };
    let Ok(doc_op) = PdfDocument::LoadFromFileAsync(&file) else {
        return (rendered_pages, None);
    };
    let Ok(doc) = doc_op.get() else {
        return (rendered_pages, None);
    };

    let page_count = doc.PageCount().unwrap_or(0).min(max_pages);
    for idx in 0..page_count {
        let Ok(page) = doc.GetPage(idx) else {
            continue;
        };
        let Ok(size) = page.Size() else {
            continue;
        };
        let Ok(stream) = InMemoryRandomAccessStream::new() else {
            continue;
        };
        let Ok(opts) = PdfPageRenderOptions::new() else {
            continue;
        };
        let base_w = (size.Width as f64).max(1.0);
        let base_h = (size.Height as f64).max(1.0);
        let scale = (1500.0 / base_w).clamp(1.25, 2.5);
        let out_w = (base_w * scale).round().clamp(400.0, 2200.0) as u32;
        let out_h = (base_h * scale).round().clamp(400.0, 3200.0) as u32;
        let _ = opts.SetDestinationWidth(out_w);
        let _ = opts.SetDestinationHeight(out_h);

        let Ok(render_op) = page.RenderWithOptionsToStreamAsync(&stream, &opts) else {
            continue;
        };
        if render_op.get().is_err() {
            continue;
        }

        if run_ocr {
            let _ = stream.Seek(0);
            if let Ok(dec_op) = BitmapDecoder::CreateAsync(&stream) {
                if let Ok(dec) = dec_op.get() {
                    if let Ok(bmp_op) = dec.GetSoftwareBitmapAsync() {
                        if let Ok(bmp) = bmp_op.get() {
                            if let Some(txt) = run_winrt_ocr_on_bitmap(&bmp) {
                                ocr_pages.push(txt);
                            }
                        }
                    }
                }
            }
        }

        if let Some(png_bytes) = read_winrt_stream_bytes(&stream) {
            if let Ok(dyn_img) = image::load_from_memory(&png_bytes) {
                let rgb = dyn_img.to_rgb8();
                let (w, h) = (rgb.width(), rgb.height());
                let mut jpg = Vec::new();
                let mut enc = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut jpg, 88);
                if enc
                    .encode(rgb.as_raw(), w, h, image::ExtendedColorType::Rgb8)
                    .is_ok()
                {
                    rendered_pages.push((jpg, w, h));
                }
            }
        }
    }

    let combined_ocr = clean_extracted_text(&ocr_pages.join("\n\n---\n\n"));
    let ocr_opt = if is_meaningful_document_text(&combined_ocr) {
        Some(combined_ocr)
    } else {
        None
    };
    (rendered_pages, ocr_opt)
}

#[cfg(windows)]
fn ocr_image_winrt(src: &Path) -> Option<String> {
    use windows::core::HSTRING;
    use windows::Graphics::Imaging::BitmapDecoder;
    use windows::Storage::{FileAccessMode, StorageFile};

    let win_path = normalize_winrt_path(src);
    let file = StorageFile::GetFileFromPathAsync(&HSTRING::from(win_path))
        .ok()?
        .get()
        .ok()?;
    let stream = file.OpenAsync(FileAccessMode::Read).ok()?.get().ok()?;
    let dec = BitmapDecoder::CreateAsync(&stream).ok()?.get().ok()?;
    let bmp = dec.GetSoftwareBitmapAsync().ok()?.get().ok()?;
    let text = run_winrt_ocr_on_bitmap(&bmp)?;
    let cleaned = clean_extracted_text(&text);
    if is_meaningful_document_text(&cleaned) {
        Some(cleaned)
    } else {
        None
    }
}

fn csv_to_json_string(csv: &str) -> String {
    let mut lines = csv
        .replace("\r\n", "\n")
        .split('\n')
        .map(|l| l.trim().to_string())
        .filter(|l| !l.is_empty())
        .collect::<Vec<_>>();
    if lines.is_empty() {
        return "[]".to_string();
    }
    let headers: Vec<String> = lines
        .remove(0)
        .split(',')
        .map(|s| s.trim().trim_matches('"').to_string())
        .collect();
    let rows: Vec<Value> = lines
        .into_iter()
        .map(|line| {
            let cols: Vec<String> = line
                .split(',')
                .map(|s| s.trim().trim_matches('"').to_string())
                .collect();
            let mut obj = Map::new();
            for (idx, h) in headers.iter().enumerate() {
                obj.insert(
                    h.clone(),
                    Value::String(cols.get(idx).cloned().unwrap_or_default()),
                );
            }
            Value::Object(obj)
        })
        .collect();
    serde_json::to_string_pretty(&rows).unwrap_or_else(|_| "[]".to_string())
}

fn json_to_csv_string(raw: &str) -> String {
    if let Ok(Value::Array(arr)) = serde_json::from_str::<Value>(raw) {
        let mut keys: Vec<String> = Vec::new();
        for item in &arr {
            if let Some(obj) = item.as_object() {
                for k in obj.keys() {
                    if !keys.contains(k) {
                        keys.push(k.clone());
                    }
                }
            }
        }
        if !keys.is_empty() {
            let mut out = String::new();
            out.push_str(&keys.join(","));
            out.push('\n');
            for item in &arr {
                if let Some(obj) = item.as_object() {
                    let row: Vec<String> = keys
                        .iter()
                        .map(|k| {
                            let v = match obj.get(k) {
                                Some(Value::String(s)) => s.clone(),
                                Some(other) => other.to_string(),
                                None => String::new(),
                            };
                            format!("\"{}\"", v.replace('"', "\"\""))
                        })
                        .collect();
                    out.push_str(&row.join(","));
                    out.push('\n');
                }
            }
            return out;
        }
    }
    let mut out = String::from("line,content\n");
    for (idx, line) in raw.replace("\r\n", "\n").split('\n').enumerate() {
        out.push_str(&format!("{},\"{}\"\n", idx + 1, line.replace('"', "\"\"")));
    }
    out
}

pub async fn convert_file(payload: Value) -> Value {
    let target_fmt = payload
        .get("targetFormat")
        .and_then(|v| v.as_str())
        .unwrap_or("pdf")
        .trim_start_matches('.')
        .to_lowercase();

    let src_path = payload
        .get("filePath")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .map(PathBuf::from)
        .or_else(|| {
            payload
                .get("fileNameQuery")
                .and_then(|v| v.as_str())
                .and_then(find_user_file_by_name)
        });

    let Some(src) = src_path else {
        return json!({ "success": false, "error": "Source file not found." });
    };
    if !src.exists() {
        return json!({ "success": false, "error": "Source file does not exist." });
    }

    let parent = src.parent().unwrap_or_else(|| Path::new("."));
    let stem = src
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("converted")
        .to_string();
    let src_ext = src
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_lowercase();

    let out_path = if src_ext == target_fmt {
        parent.join(format!("{}_converted.{}", stem, target_fmt))
    } else {
        parent.join(format!("{}.{}", stem, target_fmt))
    };

    let gemini_key = resolve_gemini_api_key(&payload);

    let ok_json = |p: &Path| {
        json!({
            "success": true,
            "sourcePath": src.to_string_lossy(),
            "outputPath": p.to_string_lossy(),
            "outputFileName": p.file_name().and_then(|n| n.to_str()).unwrap_or(""),
            "sourceName": src.file_name().and_then(|n| n.to_str()).unwrap_or(""),
        })
    };

    // 1. Image -> Image, Image -> PDF, or Image -> Word/Text (via OCR + embedded image fallback)
    let img_exts = ["png", "jpg", "jpeg", "webp", "bmp"];
    if img_exts.contains(&src_ext.as_str()) {
        if target_fmt == "pdf" {
            let src_c = src.clone();
            let out_c = out_path.clone();
            let res = tokio::task::spawn_blocking(move || {
                let img = image::open(&src_c).map_err(|e| e.to_string())?;
                write_image_pdf(&out_c, &img)
            })
            .await
            .unwrap_or_else(|e| Err(e.to_string()));
            return match res {
                Ok(_) => ok_json(&out_path),
                Err(e) => json!({ "success": false, "error": e }),
            };
        }
        if img_exts.contains(&target_fmt.as_str()) {
            let src_c = src.clone();
            let out_c = out_path.clone();
            let fmt_c = target_fmt.clone();
            let res = tokio::task::spawn_blocking(move || {
                let img = image::open(&src_c).map_err(|e| e.to_string())?;
                if fmt_c == "jpg" || fmt_c == "jpeg" {
                    img.to_rgb8().save(&out_c).map_err(|e| e.to_string())
                } else {
                    img.save(&out_c).map_err(|e| e.to_string())
                }
            })
            .await
            .unwrap_or_else(|e| Err(e.to_string()));
            return match res {
                Ok(_) => ok_json(&out_path),
                Err(e) => json!({ "success": false, "error": e }),
            };
        }

        // Image -> DOCX / TXT / MD / HTML (OCR first so screenshots become editable Word text!)
        let mut ocr_text: Option<String> = None;
        if let Some(ref key) = gemini_key {
            if let Ok(bytes) = fs::read(&src) {
                let mime = match src_ext.as_str() {
                    "png" => "image/png",
                    "webp" => "image/webp",
                    "bmp" => "image/bmp",
                    _ => "image/jpeg",
                };
                ocr_text = gemini_ocr_parts(key, vec![(mime, bytes)]).await;
            }
        }
        #[cfg(windows)]
        if ocr_text.is_none() {
            let src_c = src.clone();
            ocr_text = tokio::task::spawn_blocking(move || ocr_image_winrt(&src_c))
                .await
                .ok()
                .flatten();
        }

        if target_fmt == "docx" {
            if let Some(text) = ocr_text {
                let out_c = out_path.clone();
                let res = tokio::task::spawn_blocking(move || write_text_docx(&out_c, &text))
                    .await
                    .unwrap_or_else(|e| Err(e.to_string()));
                return match res {
                    Ok(_) => ok_json(&out_path),
                    Err(e) => json!({ "success": false, "error": e }),
                };
            }
            // Visual fallback: embed crisp image directly into Word document
            let src_c = src.clone();
            let out_c = out_path.clone();
            let res = tokio::task::spawn_blocking(move || {
                let img = image::open(&src_c).map_err(|e| e.to_string())?;
                let rgb = img.to_rgb8();
                let (w, h) = (rgb.width(), rgb.height());
                let mut jpg = Vec::new();
                let mut enc = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut jpg, 90);
                enc.encode(rgb.as_raw(), w, h, image::ExtendedColorType::Rgb8)
                    .map_err(|e| e.to_string())?;
                write_image_pages_docx(&out_c, &[(jpg, w, h)])
            })
            .await
            .unwrap_or_else(|e| Err(e.to_string()));
            return match res {
                Ok(_) => ok_json(&out_path),
                Err(e) => json!({ "success": false, "error": e }),
            };
        }

        if let Some(text) = ocr_text {
            if target_fmt == "txt" || target_fmt == "md" {
                return match fs::write(&out_path, text) {
                    Ok(_) => ok_json(&out_path),
                    Err(e) => json!({ "success": false, "error": e.to_string() }),
                };
            }
        }
        return json!({
            "success": false,
            "error": format!("Conversion from .{} to .{} is not supported.", src_ext, target_fmt)
        });
    }

    // 2. PDF -> Image (PNG/JPG/WEBP) OR PDF -> DOCX / TXT / MD / HTML / JSON / CSV
    if src_ext == "pdf" {
        #[cfg(windows)]
        if img_exts.contains(&target_fmt.as_str()) {
            let src_c = src.clone();
            let out_c = out_path.clone();
            let fmt_c = target_fmt.clone();
            let res = tokio::task::spawn_blocking(move || {
                let (pages, _) = render_and_ocr_pdf_winrt(&src_c, 1, false);
                let Some((jpg_bytes, _, _)) = pages.into_iter().next() else {
                    return Err("Could not render PDF page to image.".to_string());
                };
                if fmt_c == "jpg" || fmt_c == "jpeg" {
                    fs::write(&out_c, jpg_bytes).map_err(|e| e.to_string())
                } else {
                    let img = image::load_from_memory(&jpg_bytes).map_err(|e| e.to_string())?;
                    img.save(&out_c).map_err(|e| e.to_string())
                }
            })
            .await
            .unwrap_or_else(|e| Err(e.to_string()));
            return match res {
                Ok(_) => ok_json(&out_path),
                Err(e) => json!({ "success": false, "error": e }),
            };
        }

        // Stage 1: Fast pure-Rust text extraction (FlateDecode, ToUnicode CMap, UTF-8/Arabic selectable PDFs)
        let src_c = src.clone();
        let mut extracted_text = tokio::task::spawn_blocking(move || extract_pdf_text_native(&src_c))
            .await
            .ok()
            .flatten();

        let mut rendered_pages: Vec<(Vec<u8>, u32, u32)> = Vec::new();

        // Stage 2 & 3: Scanned / image-only / broken-encoding PDF -> Gemini native PDF OCR -> WinRT page render + offline OCR
        if extracted_text.is_none() {
            if let Some(ref key) = gemini_key {
                if let Ok(pdf_bytes) = fs::read(&src) {
                    if pdf_bytes.len() <= 14 * 1024 * 1024 {
                        extracted_text =
                            gemini_ocr_parts(key, vec![("application/pdf", pdf_bytes)]).await;
                    }
                }
            }

            #[cfg(windows)]
            if extracted_text.is_none() {
                let src_c = src.clone();
                let need_offline_ocr = gemini_key.is_none();
                let (pages, winrt_ocr) = tokio::task::spawn_blocking(move || {
                    render_and_ocr_pdf_winrt(&src_c, 20, need_offline_ocr)
                })
                .await
                .unwrap_or_default();
                rendered_pages = pages;

                if let Some(ref key) = gemini_key {
                    if !rendered_pages.is_empty() {
                        // Send rendered JPEG pages in batches of 4 to Gemini Vision OCR (handles >14MB scanned PDFs)
                        let mut batch_texts = Vec::new();
                        for chunk in rendered_pages.chunks(4) {
                            let parts: Vec<(&str, Vec<u8>)> = chunk
                                .iter()
                                .map(|(jpg, _, _)| ("image/jpeg", jpg.clone()))
                                .collect();
                            if let Some(t) = gemini_ocr_parts(key, parts).await {
                                batch_texts.push(t);
                            }
                        }
                        let joined = clean_extracted_text(&batch_texts.join("\n\n---\n\n"));
                        if is_meaningful_document_text(&joined) {
                            extracted_text = Some(joined);
                        }
                    }
                }

                if extracted_text.is_none() {
                    if let Some(t) = winrt_ocr {
                        extracted_text = Some(t);
                    } else if !need_offline_ocr {
                        // Gemini call failed (e.g. offline/rate-limit) - try offline Windows OCR now
                        let src_c2 = src.clone();
                        let (_, fallback_ocr) = tokio::task::spawn_blocking(move || {
                            render_and_ocr_pdf_winrt(&src_c2, 20, true)
                        })
                        .await
                        .unwrap_or_default();
                        extracted_text = fallback_ocr;
                    }
                }
            }
        }

        // Stage 4: If target is DOCX and no text could be OCR'd (e.g. pure visual scan offline),
        // embed the crisp rendered PDF pages directly as full-page images inside the Word document!
        if extracted_text.is_none() && target_fmt == "docx" {
            #[cfg(windows)]
            if rendered_pages.is_empty() {
                let src_c = src.clone();
                let (pages, _) =
                    tokio::task::spawn_blocking(move || render_and_ocr_pdf_winrt(&src_c, 20, false))
                        .await
                        .unwrap_or_default();
                rendered_pages = pages;
            }
            if !rendered_pages.is_empty() {
                let out_c = out_path.clone();
                let res =
                    tokio::task::spawn_blocking(move || write_image_pages_docx(&out_c, &rendered_pages))
                        .await
                        .unwrap_or_else(|e| Err(e.to_string()));
                return match res {
                    Ok(_) => ok_json(&out_path),
                    Err(e) => json!({ "success": false, "error": e }),
                };
            }
            return json!({
                "success": false,
                "error": "Could not extract text or render pages from this scanned PDF. Add a Gemini API key in Settings for AI OCR."
            });
        }

        if let Some(content) = extracted_text {
            let out_c = out_path.clone();
            let stem_c = stem.clone();
            let target_c = target_fmt.clone();
            let res = tokio::task::spawn_blocking(move || match target_c.as_str() {
                "docx" => write_text_docx(&out_c, &content),
                "pdf" => write_text_pdf(&out_c, &stem_c, &content),
                "html" => {
                    let dir = if is_rtl_paragraph(&content) { "rtl" } else { "ltr" };
                    let escaped = escape_xml(&content);
                    let html_doc = format!(
                        "<!DOCTYPE html><html dir=\"{}\"><head><meta charset=\"utf-8\"><title>{}</title><style>body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;max-width:780px;margin:40px auto;padding:0 24px;line-height:1.75;color:#111827;}}pre{{white-space:pre-wrap;font-family:inherit;margin:0;}}</style></head><body><h1>{}</h1><pre>{}</pre></body></html>",
                        dir,
                        escape_xml(&stem_c),
                        escape_xml(&stem_c),
                        escaped
                    );
                    fs::write(&out_c, html_doc).map_err(|e| e.to_string())
                }
                "json" => {
                    let lines: Vec<&str> = content.lines().collect();
                    let out_str = serde_json::to_string_pretty(&json!({
                        "source": stem_c,
                        "lines": lines,
                        "content": content,
                    }))
                    .unwrap_or(content);
                    fs::write(&out_c, out_str).map_err(|e| e.to_string())
                }
                "csv" => {
                    let mut buf = String::from("line,content\n");
                    for (idx, line) in content.replace("\r\n", "\n").split('\n').enumerate() {
                        buf.push_str(&format!("{},\"{}\"\n", idx + 1, line.replace('"', "\"\"")));
                    }
                    fs::write(&out_c, buf).map_err(|e| e.to_string())
                }
                "txt" | "md" => fs::write(&out_c, content).map_err(|e| e.to_string()),
                _ => Err(format!("Conversion from .pdf to .{} is not supported.", target_c)),
            })
            .await
            .unwrap_or_else(|e| Err(e.to_string()));
            return match res {
                Ok(_) => ok_json(&out_path),
                Err(e) => json!({ "success": false, "error": e }),
            };
        }

        return json!({
            "success": false,
            "error": "This PDF contains scanned images with no selectable text. Add your Gemini API key in Settings to extract editable text."
        });
    }

    // 3. Universal Document / Text / Data Conversion (txt, md, html, json, csv, docx -> pdf, docx, txt, md, html, json, csv)
    let src_c = src.clone();
    let src_ext_c = src_ext.clone();
    let extracted_text: Option<String> = tokio::task::spawn_blocking(move || match src_ext_c.as_str() {
        "docx" => extract_docx_text(&src_c),
        "html" | "htm" => fs::read(&src_c)
            .ok()
            .map(|b| strip_html_tags(&String::from_utf8_lossy(&b))),
        _ => fs::read(&src_c)
            .ok()
            .map(|b| String::from_utf8_lossy(&b).to_string()),
    })
    .await
    .ok()
    .flatten();

    if let Some(content) = extracted_text {
        let out_c = out_path.clone();
        let stem_c = stem.clone();
        let src_ext_c = src_ext.clone();
        let target_c = target_fmt.clone();
        let res = tokio::task::spawn_blocking(move || match target_c.as_str() {
            "pdf" => write_text_pdf(&out_c, &stem_c, &content),
            "docx" => write_text_docx(&out_c, &content),
            "html" => {
                let dir = if is_rtl_paragraph(&content) { "rtl" } else { "ltr" };
                let escaped = escape_xml(&content);
                let html_doc = format!(
                    "<!DOCTYPE html><html dir=\"{}\"><head><meta charset=\"utf-8\"><title>{}</title><style>body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;max-width:780px;margin:40px auto;padding:0 24px;line-height:1.75;color:#111827;}}pre{{white-space:pre-wrap;font-family:inherit;margin:0;}}</style></head><body><h1>{}</h1><pre>{}</pre></body></html>",
                    dir,
                    escape_xml(&stem_c),
                    escape_xml(&stem_c),
                    escaped
                );
                fs::write(&out_c, html_doc).map_err(|e| e.to_string())
            }
            "json" => {
                let out_str = if src_ext_c == "csv" {
                    csv_to_json_string(&content)
                } else if src_ext_c == "json" {
                    serde_json::from_str::<Value>(&content)
                        .and_then(|v| serde_json::to_string_pretty(&v))
                        .unwrap_or(content)
                } else {
                    let lines: Vec<&str> = content.lines().collect();
                    serde_json::to_string_pretty(&json!({
                        "source": stem_c,
                        "lines": lines,
                        "content": content,
                    }))
                    .unwrap_or(content)
                };
                fs::write(&out_c, out_str).map_err(|e| e.to_string())
            }
            "csv" => {
                let out_str = if src_ext_c == "json" {
                    json_to_csv_string(&content)
                } else {
                    let mut buf = String::from("line,content\n");
                    for (idx, line) in content.replace("\r\n", "\n").split('\n').enumerate() {
                        buf.push_str(&format!("{},\"{}\"\n", idx + 1, line.replace('"', "\"\"")));
                    }
                    buf
                };
                fs::write(&out_c, out_str).map_err(|e| e.to_string())
            }
            "txt" | "md" => fs::write(&out_c, content).map_err(|e| e.to_string()),
            _ => Err(format!(
                "Conversion from .{} to .{} is not supported.",
                src_ext_c, target_c
            )),
        })
        .await
        .unwrap_or_else(|e| Err(e.to_string()));
        return match res {
            Ok(_) => ok_json(&out_path),
            Err(e) => json!({ "success": false, "error": e }),
        };
    }

    json!({
        "success": false,
        "error": format!("Conversion from .{} to .{} is not supported.", src_ext, target_fmt)
    })
}

pub async fn run_speed_test() -> Value {
    let client = match reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .build()
    {
        Ok(c) => c,
        Err(_) => return json!({ "downloadMbps": 0, "pingMs": 0 }),
    };

    let t_ping = Instant::now();
    let _ = client.head("https://speed.cloudflare.com/__down?bytes=0").send().await;
    let ping_ms = t_ping.elapsed().as_millis() as i64;

    let t0 = Instant::now();
    let bytes_len = match client
        .get("https://speed.cloudflare.com/__down?bytes=5000000")
        .send()
        .await
    {
        Ok(r) => r.bytes().await.map(|b| b.len()).unwrap_or(0),
        Err(_) => 0,
    };
    let secs = t0.elapsed().as_secs_f64().max(0.05);
    let mbps = ((bytes_len as f64 * 8.0) / (secs * 1_000_000.0) * 10.0).round() / 10.0;

    json!({
        "downloadMbps": mbps,
        "pingMs": ping_ms,
    })
}

pub fn get_wallpaper_data_url(url_or_path: &str) -> Option<String> {
    let p = Path::new(url_or_path);
    if !p.exists() {
        return None;
    }
    let bytes = fs::read(p).ok()?;
    let mime = match p
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("jpg")
        .to_lowercase()
        .as_str()
    {
        "png" => "image/png",
        "webp" => "image/webp",
        _ => "image/jpeg",
    };
    Some(format!("data:{};base64,{}", mime, BASE64.encode(bytes)))
}

pub fn start_chrome_bridge_server(app_handle: tauri::AppHandle) {
    use tauri::Emitter;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    tauri::async_runtime::spawn(async move {
        let Ok(listener) = TcpListener::bind("127.0.0.1:51742").await else {
            return;
        };
        loop {
            let Ok((mut socket, _)) = listener.accept().await else {
                continue;
            };
            let handle = app_handle.clone();
            tauri::async_runtime::spawn(async move {
                let mut buf = vec![0u8; 8192];
                let Ok(n) = socket.read(&mut buf).await else {
                    return;
                };
                let req = String::from_utf8_lossy(&buf[..n]);
                let first_line = req.lines().next().unwrap_or("");

                let (status, body) = if first_line.starts_with("OPTIONS ") {
                    ("204 No Content", String::new())
                } else if first_line.contains("/api/ping") || first_line.contains("/api/status") {
                    ("200 OK", r#"{"ok":true,"app":"Kibo","runtime":"tauri"}"#.to_string())
                } else if first_line.contains("/api/open-kibo") {
                    let _ = handle.emit("expand-island", ());
                    ("200 OK", r#"{"ok":true}"#.to_string())
                } else if first_line.contains("/api/browser-context") {
                    if let Some((_, payload)) = req.split_once("\r\n\r\n") {
                        if let Ok(v) = serde_json::from_str::<Value>(payload.trim()) {
                            let title = v.get("title").and_then(|x| x.as_str()).unwrap_or("").to_string();
                            let url = v.get("url").and_then(|x| x.as_str()).unwrap_or("").to_string();
                            if let Ok(mut ctx) = BROWSER_CONTEXT.lock() {
                                *ctx = (title, url);
                            }
                        }
                    }
                    ("200 OK", r#"{"ok":true}"#.to_string())
                } else {
                    ("404 Not Found", r#"{"ok":false}"#.to_string())
                };

                let resp = format!(
                    "HTTP/1.1 {}\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    status,
                    body.len(),
                    body
                );
                let _ = socket.write_all(resp.as_bytes()).await;
            });
        }
    });
}

pub fn get_active_browser_context() -> (String, String) {
    BROWSER_CONTEXT
        .lock()
        .map(|g| g.clone())
        .unwrap_or_default()
}
