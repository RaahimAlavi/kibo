use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use windows::Media::Control::{
    GlobalSystemMediaTransportControlsSessionManager,
    GlobalSystemMediaTransportControlsSessionPlaybackStatus,
};
use windows::Storage::Streams::DataReader;
use windows::Win32::System::Com::{CoInitializeEx, COINIT_MULTITHREADED};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NowPlayingMedia {
    pub has_session: bool,
    pub playing: bool,
    pub title: String,
    pub artist: String,
    pub source: String,
    pub source_app_id: String,
    pub thumbnail: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub position_sec: Option<i64>,
    pub duration_sec: i64,
}

impl Default for NowPlayingMedia {
    fn default() -> Self {
        Self {
            has_session: false,
            playing: false,
            title: String::new(),
            artist: String::new(),
            source: String::new(),
            source_app_id: String::new(),
            thumbnail: String::new(),
            position_sec: None,
            duration_sec: 210,
        }
    }
}

struct CachedTrackThumb {
    key: String,
    thumbnail: String,
}

static LAST_THUMB: Lazy<Mutex<CachedTrackThumb>> = Lazy::new(|| {
    Mutex::new(CachedTrackThumb {
        key: String::new(),
        thumbnail: String::new(),
    })
});

fn clean_source_name(src_app: &str) -> String {
    let low = src_app.to_lowercase();
    if low.contains("spotify") {
        "Spotify".into()
    } else if low.contains("netflix") {
        "Netflix".into()
    } else if low.contains("chrome") {
        "Chrome".into()
    } else if low.contains("msedge") || low.contains("edge") {
        "Edge".into()
    } else if low.contains("brave") {
        "Brave".into()
    } else if low.contains("firefox") {
        "Firefox".into()
    } else if low.contains("opera") {
        "Opera".into()
    } else if low.contains("vivaldi") {
        "Vivaldi".into()
    } else if low.contains("arc") {
        "Arc".into()
    } else if low.contains("vlc") {
        "VLC".into()
    } else if low.contains("applemusic") || low.contains("itunes") {
        "Apple Music".into()
    } else if low.contains("tidal") {
        "TIDAL".into()
    } else if low.contains("foobar") {
        "foobar2000".into()
    } else if low.contains("musicbee") {
        "MusicBee".into()
    } else {
        "Media Player".into()
    }
}

pub fn get_now_playing_sync() -> NowPlayingMedia {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
    }

    let mgr = match GlobalSystemMediaTransportControlsSessionManager::RequestAsync()
        .and_then(|op| op.get())
    {
        Ok(m) => m,
        Err(_) => return NowPlayingMedia::default(),
    };

    let session = match mgr.GetCurrentSession() {
        Ok(s) => s,
        Err(_) => {
            if let Ok(mut cache) = LAST_THUMB.lock() {
                cache.key.clear();
                cache.thumbnail.clear();
            }
            return NowPlayingMedia::default();
        }
    };

    let playing = session
        .GetPlaybackInfo()
        .and_then(|info| info.PlaybackStatus())
        .map(|status| status == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing)
        .unwrap_or(false);

    let props = match session.TryGetMediaPropertiesAsync().and_then(|op| op.get()) {
        Ok(p) => p,
        Err(_) => return NowPlayingMedia::default(),
    };

    let title = props
        .Title()
        .map(|s| s.to_string().trim().to_string())
        .unwrap_or_default();
    if title.is_empty() {
        return NowPlayingMedia::default();
    }

    let src_app = session
        .SourceAppUserModelId()
        .map(|s| s.to_string())
        .unwrap_or_default();
    let source = clean_source_name(&src_app);

    let raw_artist = props
        .Artist()
        .map(|s| s.to_string().trim().to_string())
        .unwrap_or_default();
    let artist = if raw_artist.is_empty() {
        source.clone()
    } else {
        raw_artist
    };

    let (position_sec, duration_sec) = match session.GetTimelineProperties() {
        Ok(tl) => {
            let raw_pos_ticks = tl.Position().map(|t| t.Duration).unwrap_or(-1);
            let end_ticks = tl.EndTime().map(|t| t.Duration).unwrap_or(0);
            let dur = (end_ticks as f64 / 10_000_000.0).round() as i64;

            let adjusted_pos_ticks = if raw_pos_ticks >= 0 && playing {
                // Windows SMTC Position() is frozen at LastUpdatedTime(); add live elapsed time while playing!
                let last_upd = tl.LastUpdatedTime().map(|dt| dt.UniversalTime).unwrap_or(0);
                if last_upd > 0 {
                    let now_unix_100ns = std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .map(|d| (d.as_nanos() / 100) as i64)
                        .unwrap_or(0);
                    let now_win_ticks = now_unix_100ns + 116_444_736_000_000_000i64;
                    let elapsed = (now_win_ticks - last_upd).clamp(0, 6_000_000_000); // up to 10 min safety cap
                    let live = raw_pos_ticks + elapsed;
                    if end_ticks > 0 {
                        live.min(end_ticks)
                    } else {
                        live
                    }
                } else {
                    raw_pos_ticks
                }
            } else {
                raw_pos_ticks
            };

            let pos = if adjusted_pos_ticks >= 0 {
                Some((adjusted_pos_ticks as f64 / 10_000_000.0).round() as i64)
            } else {
                None
            };
            (pos, if dur > 5 { dur } else { 210 })
        }
        Err(_) => (None, 210),
    };

    let track_key = format!("{}|{}|{}", title, artist, source);
    let mut thumbnail = String::new();
    let mut needs_read = true;
    if let Ok(cache) = LAST_THUMB.lock() {
        if cache.key == track_key {
            thumbnail = cache.thumbnail.clone();
            needs_read = false;
        }
    }

    if needs_read {
        if let Ok(thumb_ref) = props.Thumbnail() {
            if let Ok(stream) = thumb_ref.OpenReadAsync().and_then(|op| op.get()) {
                if let Ok(size) = stream.Size() {
                    if size > 0 && size < 2_000_000 {
                        if let Ok(input) = stream.GetInputStreamAt(0) {
                            if let Ok(reader) = DataReader::CreateDataReader(&input) {
                                if reader.LoadAsync(size as u32).and_then(|op| op.get()).is_ok() {
                                    let mut bytes = vec![0u8; size as usize];
                                    if reader.ReadBytes(&mut bytes).is_ok() {
                                        thumbnail = format!(
                                            "data:image/jpeg;base64,{}",
                                            BASE64.encode(&bytes)
                                        );
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        if let Ok(mut cache) = LAST_THUMB.lock() {
            cache.key = track_key;
            cache.thumbnail = thumbnail.clone();
        }
    }

    NowPlayingMedia {
        has_session: true,
        playing,
        title,
        artist,
        source,
        source_app_id: src_app,
        thumbnail,
        position_sec,
        duration_sec,
    }
}

pub fn seek_media_sync(seconds: i64) -> bool {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
    }
    let mgr = match GlobalSystemMediaTransportControlsSessionManager::RequestAsync()
        .and_then(|op| op.get())
    {
        Ok(m) => m,
        Err(_) => return false,
    };
    let session = match mgr.GetCurrentSession() {
        Ok(s) => s,
        Err(_) => return false,
    };
    let ticks = seconds.max(0) * 10_000_000;
    session
        .TryChangePlaybackPositionAsync(ticks)
        .and_then(|op| op.get())
        .unwrap_or(false)
}
