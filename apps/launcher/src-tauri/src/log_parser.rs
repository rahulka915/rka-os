use regex::Regex;
use std::net::UdpSocket;
use std::time::{SystemTime, UNIX_EPOCH};
use crate::types::{DevState, LogEntry, LogLevel};

pub struct LogParser {
    port: u16,
    url_re: Regex,
    bundling_re: Regex,
    bundled_re: Regex,
    metro_ready_re: Regex,
    error_re: Regex,
    warn_re: Regex,
    device_connect_re: Regex,
}

/// Get local LAN IP by connecting a UDP socket (doesn't actually send anything)
fn local_ip() -> Option<String> {
    let socket = UdpSocket::bind("0.0.0.0:0").ok()?;
    socket.connect("8.8.8.8:80").ok()?;
    let addr = socket.local_addr().ok()?;
    Some(addr.ip().to_string())
}

impl LogParser {
    pub fn new(port: u16) -> Self {
        Self {
            port,
            url_re: Regex::new(r"exp://[\w.\-:/]+").unwrap(),
            bundling_re: Regex::new(r"(?i)bundling").unwrap(),
            bundled_re: Regex::new(r"(?i)bundled\s+\d+").unwrap(),
            metro_ready_re: Regex::new(
                r"(?i)(metro.*wait|waiting.*metro|metro.*ready|ready on|started server|web is running|waiting on http)",
            )
            .unwrap(),
            error_re: Regex::new(r"(?i)(error|failed|exception|cannot|unable to|input is required|skipping dev server)").unwrap(),
            warn_re: Regex::new(r"(?i)\bwarn(ing)?\b").unwrap(),
            device_connect_re: Regex::new(r"(?i)(GET.*index\.bundle|handshake|client connected|device connected)").unwrap(),
        }
    }

    pub fn is_device_connected(&self, raw: &str) -> bool {
        self.device_connect_re.is_match(raw)
    }

    /// Returns (detected DevState change, LogEntry, detected or constructed Expo URL)
    pub fn parse_line(&self, raw: &str) -> (Option<DevState>, LogEntry, Option<String>) {
        let ts = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;

        // Try to find an exp:// URL in the output first
        let detected_url = self.url_re.find(raw).map(|m| m.as_str().to_string());

        let dev_state = if self.metro_ready_re.is_match(raw) {
            Some(DevState::MetroReady)
        } else if self.bundled_re.is_match(raw) {
            Some(DevState::MetroReady)
        } else if self.bundling_re.is_match(raw) {
            Some(DevState::Bundling)
        } else {
            None
        };

        // If Metro is ready and no URL was found in output, construct one from local IP
        let expo_url = detected_url.or_else(|| {
            if dev_state == Some(DevState::MetroReady) {
                let ip = local_ip().unwrap_or_else(|| "localhost".to_string());
                Some(format!("exp://{}:{}", ip, self.port))
            } else {
                None
            }
        });

        let level = if self.error_re.is_match(raw) {
            LogLevel::Error
        } else if self.warn_re.is_match(raw) {
            LogLevel::Warn
        } else {
            LogLevel::Info
        };

        let entry = LogEntry {
            level,
            message: raw.trim().to_string(),
            timestamp: ts,
            raw: raw.to_string(),
        };

        (dev_state, entry, expo_url)
    }
}
