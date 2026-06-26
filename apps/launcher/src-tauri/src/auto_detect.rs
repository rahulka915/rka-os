use std::path::Path;
use crate::types::{Editor, ProjectCommands, ProjectProfile, ProjectType};

pub fn detect_project_type(path: &str) -> ProjectType {
    let dir = Path::new(path);

    // Expo: app.json + "expo" in package.json
    if dir.join("app.json").exists() && has_in_package_json(path, "\"expo\"") {
        return ProjectType::Expo;
    }

    // Next.js: next.config.js/ts or "next" dep in package.json
    if dir.join("next.config.js").exists()
        || dir.join("next.config.ts").exists()
        || has_in_package_json(path, "\"next\"")
    {
        return ProjectType::NextJS;
    }

    // Python: requirements.txt or pyproject.toml
    if dir.join("requirements.txt").exists() || dir.join("pyproject.toml").exists() {
        return ProjectType::Python;
    }

    // Docker/Service: Dockerfile or docker-compose
    if dir.join("Dockerfile").exists()
        || dir.join("docker-compose.yml").exists()
        || dir.join("docker-compose.yaml").exists()
        || dir.join("compose.yaml").exists()
    {
        return ProjectType::Service;
    }

    // Node API: plain package.json (no framework detected above)
    if dir.join("package.json").exists() {
        return ProjectType::NodeAPI;
    }

    ProjectType::Custom
}

fn has_in_package_json(path: &str, keyword: &str) -> bool {
    let pkg = Path::new(path).join("package.json");
    std::fs::read_to_string(pkg)
        .map(|c| c.contains(keyword))
        .unwrap_or(false)
}

pub fn default_port(project_type: &ProjectType) -> u16 {
    match project_type {
        ProjectType::Expo => 8081,
        ProjectType::NextJS => 3000,
        ProjectType::NodeAPI => 3001,
        ProjectType::Python => 8000,
        ProjectType::Service | ProjectType::Custom => 0,
    }
}

pub fn default_commands(project_type: &ProjectType) -> ProjectCommands {
    match project_type {
        ProjectType::Expo => ProjectCommands {
            start: "npx expo start --go".into(),
            start_clean: "npx expo start --go --clear".into(),
            install: "npm install".into(),
            doctor: "npx expo-doctor".into(),
        },
        ProjectType::NextJS => ProjectCommands {
            start: "npm run dev".into(),
            start_clean: "npm run dev".into(),
            install: "npm install".into(),
            doctor: "npm run lint".into(),
        },
        ProjectType::NodeAPI => ProjectCommands {
            start: "npm start".into(),
            start_clean: "npm start".into(),
            install: "npm install".into(),
            doctor: "npm test".into(),
        },
        ProjectType::Python => ProjectCommands {
            start: "python main.py".into(),
            start_clean: "python main.py".into(),
            install: "pip install -r requirements.txt".into(),
            doctor: "pip check".into(),
        },
        ProjectType::Service => ProjectCommands {
            start: "docker compose up".into(),
            start_clean: "docker compose up --build".into(),
            install: "docker compose pull".into(),
            doctor: "docker compose ps".into(),
        },
        ProjectType::Custom => ProjectCommands {
            start: String::new(),
            start_clean: String::new(),
            install: String::new(),
            doctor: String::new(),
        },
    }
}

pub fn make_profile(path: String) -> ProjectProfile {
    let project_type = detect_project_type(&path);
    let name = Path::new(&path)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    let port = default_port(&project_type);
    let qr = matches!(project_type, ProjectType::Expo);

    ProjectProfile {
        id: uuid::Uuid::new_v4().to_string(),
        name,
        commands: default_commands(&project_type),
        port,
        dependencies: Vec::new(),
        auto_start: false,
        qr_support: qr,
        show_qr_on_ready: qr,
        auto_hide_after_connect: qr,
        preferred_editor: Editor::Cursor,
        project_type,
        path,
    }
}
