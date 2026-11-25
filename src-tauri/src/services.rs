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
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
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

    let mut body = String::new();
    for line in text.replace("\r\n", "\n").replace('\r', "\n").split('\n') {
        body.push_str("<w:p><w:r><w:t xml:space=\"preserve\">");
        body.push_str(&escape_xml(line));
        body.push_str("</w:t></w:r></w:p>");
    }

    let document_xml = format!(
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>{}<w:sectPr/></w:body></w:document>"#,
        body
    );

    let zip_bytes = build_store_zip(&[
        ("[Content_Types].xml", content_types.as_bytes()),
        ("_rels/.rels", rels.as_bytes()),
        ("word/_rels/document.xml.rels", doc_rels.as_bytes()),
        ("word/document.xml", document_xml.as_bytes()),
    ]);
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

fn extract_pdf_text(src: &Path) -> Option<String> {
    let bytes = fs::read(src).ok()?;
    let raw = String::from_utf8_lossy(&bytes);
    let mut out = String::new();
    let chars: Vec<char> = raw.chars().collect();
    let mut i = 0usize;
    while i < chars.len() {
        if chars[i] == '(' {
            let mut depth = 1i32;
            let mut buf = String::new();
            i += 1;
            while i < chars.len() && depth > 0 {
                let c = chars[i];
                if c == '\\' && i + 1 < chars.len() {
                    i += 1;
                    match chars[i] {
                        'n' => buf.push('\n'),
                        'r' => buf.push('\r'),
                        't' => buf.push('\t'),
                        other => buf.push(other),
                    }
                } else if c == '(' {
                    depth += 1;
                    buf.push(c);
                } else if c == ')' {
                    depth -= 1;
                    if depth > 0 {
                        buf.push(c);
                    }
                } else if c.is_ascii_graphic() || c == ' ' {
                    buf.push(c);
                }
                i += 1;
            }
            // Keep literal strings followed closely by Tj/TJ operators
            let lookahead: String = chars[i..chars.len().min(i + 12)].iter().collect();
            if lookahead.contains("Tj") || lookahead.contains("TJ") || lookahead.contains("'") {
                if !buf.trim().is_empty() {
                    out.push_str(&buf);
                    out.push('\n');
                }
            }
        } else {
            i += 1;
        }
    }
    let trimmed = out.trim().to_string();
    if !trimmed.is_empty() {
        Some(trimmed)
    } else {
        Some(format!(
            "[Converted from PDF: {}]\n\nNote: This PDF uses compressed or scanned streams; open in a PDF reader for full visual layout.",
            src.file_name().and_then(|n| n.to_str()).unwrap_or("document.pdf")
        ))
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

pub fn convert_file(payload: Value) -> Value {
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
        .unwrap_or("converted");
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

    let ok_json = |p: &Path| {
        json!({
            "success": true,
            "sourcePath": src.to_string_lossy(),
            "outputPath": p.to_string_lossy(),
            "outputFileName": p.file_name().and_then(|n| n.to_str()).unwrap_or(""),
            "sourceName": src.file_name().and_then(|n| n.to_str()).unwrap_or(""),
        })
    };

    // 1. Image -> Image or Image -> PDF
    let img_exts = ["png", "jpg", "jpeg", "webp", "bmp"];
    if img_exts.contains(&src_ext.as_str()) {
        if target_fmt == "pdf" {
            match image::open(&src) {
                Ok(img) => match write_image_pdf(&out_path, &img) {
                    Ok(_) => return ok_json(&out_path),
                    Err(e) => return json!({ "success": false, "error": e }),
                },
                Err(e) => return json!({ "success": false, "error": e.to_string() }),
            }
        }
        if img_exts.contains(&target_fmt.as_str()) {
            match image::open(&src) {
                Ok(img) => {
                    let res = if target_fmt == "jpg" || target_fmt == "jpeg" {
                        img.to_rgb8().save(&out_path)
                    } else {
                        img.save(&out_path)
                    };
                    return match res {
                        Ok(_) => ok_json(&out_path),
                        Err(e) => json!({ "success": false, "error": e.to_string() }),
                    };
                }
                Err(e) => return json!({ "success": false, "error": e.to_string() }),
            }
        }
    }

    // 2. Universal Document / Text / Data Conversion (txt, md, html, json, csv, docx, pdf -> pdf, docx, txt, md, html, json, csv)
    let extracted_text: Option<String> = match src_ext.as_str() {
        "docx" => extract_docx_text(&src),
        "pdf" => extract_pdf_text(&src),
        "html" | "htm" => fs::read(&src)
            .ok()
            .map(|b| strip_html_tags(&String::from_utf8_lossy(&b))),
        _ => fs::read(&src)
            .ok()
            .map(|b| String::from_utf8_lossy(&b).to_string()),
    };

    if let Some(content) = extracted_text {
        match target_fmt.as_str() {
            "pdf" => {
                return match write_text_pdf(&out_path, stem, &content) {
                    Ok(_) => ok_json(&out_path),
                    Err(e) => json!({ "success": false, "error": e }),
                };
            }
            "docx" => {
                return match write_text_docx(&out_path, &content) {
                    Ok(_) => ok_json(&out_path),
                    Err(e) => json!({ "success": false, "error": e }),
                };
            }
            "html" => {
                let escaped = content
                    .replace('&', "&amp;")
                    .replace('<', "&lt;")
                    .replace('>', "&gt;");
                let html_doc = format!(
                    "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"utf-8\"><title>{}</title><style>body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:780px;margin:40px auto;padding:0 24px;line-height:1.65;color:#111827;}}pre{{white-space:pre-wrap;font-family:inherit;margin:0;}}</style></head><body><h1>{}</h1><pre>{}</pre></body></html>",
                    escape_xml(stem),
                    escape_xml(stem),
                    escaped
                );
                return match fs::write(&out_path, html_doc) {
                    Ok(_) => ok_json(&out_path),
                    Err(e) => json!({ "success": false, "error": e.to_string() }),
                };
            }
            "json" => {
                let out_str = if src_ext == "csv" {
                    csv_to_json_string(&content)
                } else if src_ext == "json" {
                    serde_json::from_str::<Value>(&content)
                        .and_then(|v| serde_json::to_string_pretty(&v))
                        .unwrap_or(content)
                } else {
                    let lines: Vec<&str> = content.lines().collect();
                    serde_json::to_string_pretty(&json!({
                        "source": stem,
                        "lines": lines,
                        "content": content,
                    }))
                    .unwrap_or(content)
                };
                return match fs::write(&out_path, out_str) {
                    Ok(_) => ok_json(&out_path),
                    Err(e) => json!({ "success": false, "error": e.to_string() }),
                };
            }
            "csv" => {
                let out_str = if src_ext == "json" {
                    json_to_csv_string(&content)
                } else {
                    let mut buf = String::from("line,content\n");
                    for (idx, line) in content.replace("\r\n", "\n").split('\n').enumerate() {
                        buf.push_str(&format!("{},\"{}\"\n", idx + 1, line.replace('"', "\"\"")));
                    }
                    buf
                };
                return match fs::write(&out_path, out_str) {
                    Ok(_) => ok_json(&out_path),
                    Err(e) => json!({ "success": false, "error": e.to_string() }),
                };
            }
            "txt" | "md" => {
                return match fs::write(&out_path, content) {
                    Ok(_) => ok_json(&out_path),
                    Err(e) => json!({ "success": false, "error": e.to_string() }),
                };
            }
            _ => {}
        }
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
