use std::collections::HashMap;
use crate::types::{HealthCheckResult, ProjectType};

pub fn run_health_check(
    project_type: &ProjectType,
    path: &str,
    port: u16,
    project_id: &str,
) -> HealthCheckResult {
    let mut checks: HashMap<String, bool> = HashMap::new();

    // Per-type checks
    match project_type {
        ProjectType::Expo => {
            checks.insert("node_installed".into(), cmd_exists("node"));
            checks.insert("npm_installed".into(), cmd_exists("npm"));
            checks.insert("expo_cli_installed".into(), cmd_exists("npx"));
            checks.insert("package_json_exists".into(), file_exists(path, "package.json"));
            checks.insert("dependencies_installed".into(), file_exists(path, "node_modules"));
        }
        ProjectType::NextJS | ProjectType::NodeAPI => {
            checks.insert("node_installed".into(), cmd_exists("node"));
            checks.insert("npm_installed".into(), cmd_exists("npm"));
            checks.insert("package_json_exists".into(), file_exists(path, "package.json"));
            checks.insert("dependencies_installed".into(), file_exists(path, "node_modules"));
        }
        ProjectType::Python => {
            checks.insert("python_installed".into(), cmd_exists("python3") || cmd_exists("python"));
            checks.insert(
                "requirements_exist".into(),
                file_exists(path, "requirements.txt") || file_exists(path, "pyproject.toml"),
            );
        }
        ProjectType::Service => {
            checks.insert("docker_installed".into(), cmd_exists("docker"));
        }
        ProjectType::Custom => {}
    }

    // Port check for all types with a non-zero port
    let (port_free, port_conflict) = if port > 0 {
        check_port(port)
    } else {
        (true, None)
    };
    if port > 0 {
        checks.insert("port_free".into(), port_free);
    }

    let passed = checks.values().all(|&v| v);

    HealthCheckResult {
        timestamp: now_iso8601(),
        project_id: project_id.to_string(),
        checks,
        port_conflict,
        passed,
    }
}

fn cmd_exists(cmd: &str) -> bool {
    // Use zsh with explicit PATH so GUI context finds Homebrew tools
    std::process::Command::new("zsh")
        .args(["-c", &format!("which {}", cmd)])
        .env(
            "PATH",
            format!(
                "/usr/local/bin:/opt/homebrew/bin:{}",
                std::env::var("PATH").unwrap_or_default()
            ),
        )
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

fn file_exists(base: &str, relative: &str) -> bool {
    std::path::Path::new(base).join(relative).exists()
}

fn check_port(port: u16) -> (bool, Option<(u16, u32)>) {
    match std::net::TcpListener::bind(format!("127.0.0.1:{}", port)) {
        Ok(_) => (true, None),
        Err(_) => {
            // Try to identify the PID blocking the port
            let pid = std::process::Command::new("sh")
                .args(["-c", &format!("lsof -ti :{}", port)])
                .output()
                .ok()
                .and_then(|o| {
                    String::from_utf8(o.stdout)
                        .ok()
                        .and_then(|s| s.trim().parse::<u32>().ok())
                });
            (false, pid.map(|p| (port, p)))
        }
    }
}

fn now_iso8601() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    // Simple ISO-8601 approximation without chrono
    let (y, mo, d, h, mi, s) = epoch_to_parts(secs);
    format!("{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z", y, mo, d, h, mi, s)
}

fn epoch_to_parts(secs: u64) -> (u64, u64, u64, u64, u64, u64) {
    let s = secs % 60;
    let m = (secs / 60) % 60;
    let h = (secs / 3600) % 24;
    let days = secs / 86400;
    // Rough Gregorian calculation
    let year = 1970 + days / 365;
    let month = ((days % 365) / 30) + 1;
    let day = (days % 30) + 1;
    (year, month.min(12), day.min(31), h, m, s)
}
