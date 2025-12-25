use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct VerifyTokenResult {
    pub valid: bool,
    pub tier: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AnlasResult {
    pub success: bool,
    pub fixed: Option<i64>,
    pub purchased: Option<i64>,
    pub error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SubscriptionResponse {
    tier: Option<i32>,
    #[serde(rename = "trainingStepsLeft")]
    training_steps_left: Option<TrainingSteps>,
}

#[derive(Debug, Deserialize)]
struct TrainingSteps {
    #[serde(rename = "fixedTrainingStepsLeft")]
    fixed_training_steps_left: Option<i64>,
    #[serde(rename = "purchasedTrainingSteps")]
    purchased_training_steps: Option<i64>,
}

#[tauri::command]
async fn verify_token(token: String) -> VerifyTokenResult {
    let client = reqwest::Client::new();

    let result = client
        .get("https://api.novelai.net/user/subscription")
        .header("Authorization", format!("Bearer {}", token.trim()))
        .header("Content-Type", "application/json")
        .send()
        .await;

    match result {
        Ok(response) => {
            let status = response.status();
            if status.is_success() {
                match response.json::<SubscriptionResponse>().await {
                    Ok(data) => {
                        let tier_name = match data.tier {
                            Some(3) => Some("opus".to_string()),
                            Some(2) => Some("scroll".to_string()),
                            Some(1) => Some("tablet".to_string()),
                            _ => Some("paper".to_string()),
                        };
                        VerifyTokenResult {
                            valid: true,
                            tier: tier_name,
                            error: None,
                        }
                    }
                    Err(e) => VerifyTokenResult {
                        valid: false,
                        tier: None,
                        error: Some(format!("JSON 파싱 오류: {}", e)),
                    },
                }
            } else if status.as_u16() == 401 {
                VerifyTokenResult {
                    valid: false,
                    tier: None,
                    error: Some("유효하지 않은 API 토큰".to_string()),
                }
            } else {
                VerifyTokenResult {
                    valid: false,
                    tier: None,
                    error: Some(format!("API 오류: {}", status.as_u16())),
                }
            }
        }
        Err(e) => VerifyTokenResult {
            valid: false,
            tier: None,
            error: Some(format!("네트워크 오류: {}", e)),
        },
    }
}

#[tauri::command]
async fn get_anlas_balance(token: String) -> AnlasResult {
    let client = reqwest::Client::new();

    let result = client
        .get("https://api.novelai.net/user/subscription")
        .header("Authorization", format!("Bearer {}", token.trim()))
        .header("Content-Type", "application/json")
        .send()
        .await;

    match result {
        Ok(response) => {
            if response.status().is_success() {
                match response.json::<SubscriptionResponse>().await {
                    Ok(data) => {
                        let fixed = data
                            .training_steps_left
                            .as_ref()
                            .and_then(|t| t.fixed_training_steps_left);
                        let purchased = data
                            .training_steps_left
                            .as_ref()
                            .and_then(|t| t.purchased_training_steps);
                        AnlasResult {
                            success: true,
                            fixed,
                            purchased,
                            error: None,
                        }
                    }
                    Err(e) => AnlasResult {
                        success: false,
                        fixed: None,
                        purchased: None,
                        error: Some(format!("JSON 파싱 오류: {}", e)),
                    },
                }
            } else {
                AnlasResult {
                    success: false,
                    fixed: None,
                    purchased: None,
                    error: Some(format!("API 오류: {}", response.status().as_u16())),
                }
            }
        }
        Err(e) => AnlasResult {
            success: false,
            fixed: None,
            purchased: None,
            error: Some(format!("네트워크 오류: {}", e)),
        },
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpscaleResult {
    pub success: bool,
    pub image_data: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
struct UpscalePayload {
    image: String,
    width: i32,
    height: i32,
    scale: i32,
}

#[tauri::command]
async fn upscale_image(
    token: String,
    image: String,
    width: i32,
    height: i32,
    scale: i32,
) -> UpscaleResult {
    let client = reqwest::Client::new();

    let payload = UpscalePayload {
        image,
        width,
        height,
        scale,
    };

    let result = client
        .post("https://api.novelai.net/ai/upscale")
        .header("Authorization", format!("Bearer {}", token.trim()))
        .header("Content-Type", "application/json")
        .json(&payload)
        .send()
        .await;

    match result {
        Ok(response) => {
            if response.status().is_success() {
                // Response is a ZIP file containing the image
                match response.bytes().await {
                    Ok(bytes) => {
                        // Use zip crate to extract
                        match extract_image_from_zip(&bytes) {
                            Ok(base64_image) => UpscaleResult {
                                success: true,
                                image_data: Some(base64_image),
                                error: None,
                            },
                            Err(e) => UpscaleResult {
                                success: false,
                                image_data: None,
                                error: Some(format!("ZIP 처리 오류: {}", e)),
                            },
                        }
                    }
                    Err(e) => UpscaleResult {
                        success: false,
                        image_data: None,
                        error: Some(format!("응답 읽기 오류: {}", e)),
                    },
                }
            } else {
                let status = response.status().as_u16();
                let error_text = response.text().await.unwrap_or_default();
                UpscaleResult {
                    success: false,
                    image_data: None,
                    error: Some(format!("API 오류 {}: {}", status, error_text)),
                }
            }
        }
        Err(e) => UpscaleResult {
            success: false,
            image_data: None,
            error: Some(format!("네트워크 오류: {}", e)),
        },
    }
}

fn extract_image_from_zip(zip_bytes: &[u8]) -> Result<String, String> {
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    use std::io::{Cursor, Read};
    use zip::ZipArchive;

    let cursor = Cursor::new(zip_bytes);
    let mut archive = ZipArchive::new(cursor).map_err(|e| e.to_string())?;

    if archive.is_empty() {
        return Err("ZIP 파일이 비어있습니다".to_string());
    }

    let mut file = archive.by_index(0).map_err(|e| e.to_string())?;
    let mut contents = Vec::new();
    file.read_to_end(&mut contents).map_err(|e| e.to_string())?;

    Ok(STANDARD.encode(&contents))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RemoveBackgroundResult {
    pub success: bool,
    pub image_data: Option<String>,
    pub error: Option<String>,
}

#[tauri::command]
async fn remove_background(image_base64: String) -> RemoveBackgroundResult {
    use base64::{engine::general_purpose::STANDARD, Engine as _};

    // Decode base64 image
    let image_bytes = match STANDARD.decode(&image_base64) {
        Ok(bytes) => bytes,
        Err(e) => {
            return RemoveBackgroundResult {
                success: false,
                image_data: None,
                error: Some(format!("Base64 디코딩 오류: {}", e)),
            }
        }
    };

    let client = reqwest::Client::new();

    // Use Hugging Face Inference API (free tier available)
    // Note: For production, consider getting an HF API token
    let result = client
        .post("https://router.huggingface.co/hf-inference/models/briaai/RMBG-1.4")
        .header("Content-Type", "application/octet-stream")
        .body(image_bytes)
        .send()
        .await;

    match result {
        Ok(response) => {
            if response.status().is_success() {
                match response.bytes().await {
                    Ok(bytes) => {
                        let base64_result = STANDARD.encode(&bytes);
                        RemoveBackgroundResult {
                            success: true,
                            image_data: Some(format!("data:image/png;base64,{}", base64_result)),
                            error: None,
                        }
                    }
                    Err(e) => RemoveBackgroundResult {
                        success: false,
                        image_data: None,
                        error: Some(format!("응답 읽기 오류: {}", e)),
                    },
                }
            } else {
                let status = response.status().as_u16();
                let error_text = response.text().await.unwrap_or_default();
                RemoveBackgroundResult {
                    success: false,
                    image_data: None,
                    error: Some(format!("API 오류 {}: {}", status, error_text)),
                }
            }
        }
        Err(e) => RemoveBackgroundResult {
            success: false,
            image_data: None,
            error: Some(format!("네트워크 오류: {}", e)),
        },
    }
}

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, RunEvent, Url};
use tauri_plugin_shell::{process::CommandChild, ShellExt};

// Store for tracking tagger sidecar process
#[derive(Clone)]
pub struct TaggerState(pub Arc<Mutex<Option<CommandChild>>>);

// Store for tracking embedded webviews
struct EmbeddedWebviews {
    webviews: HashMap<String, bool>,
}

static EMBEDDED_WEBVIEWS: std::sync::LazyLock<Mutex<EmbeddedWebviews>> =
    std::sync::LazyLock::new(|| {
        Mutex::new(EmbeddedWebviews {
            webviews: HashMap::new(),
        })
    });

#[tauri::command]
async fn open_embedded_browser(
    app: AppHandle,
    url: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    // Close existing embedded browser if any
    let _ = close_embedded_browser(app.clone()).await;

    let parsed_url = Url::parse(&url).map_err(|e| format!("Invalid URL: {}", e))?;

    // Get the main window (not WebviewWindow, but Window for add_child)
    let window = app.get_window("main").ok_or("Main window not found")?;

    // Create a WebviewBuilder for the embedded browser
    let webview_builder = tauri::webview::WebviewBuilder::new(
        "embedded_browser",
        tauri::WebviewUrl::External(parsed_url),
    );

    // Add as child webview within the main window
    window
        .add_child(
            webview_builder,
            LogicalPosition::new(x, y),
            LogicalSize::new(width, height),
        )
        .map_err(|e| format!("Failed to create embedded webview: {}", e))?;

    // Track the webview
    if let Ok(mut store) = EMBEDDED_WEBVIEWS.lock() {
        store.webviews.insert("embedded_browser".to_string(), true);
    }

    Ok(())
}

#[tauri::command]
async fn close_embedded_browser(app: AppHandle) -> Result<(), String> {
    if let Some(webview) = app.get_webview("embedded_browser") {
        webview
            .close()
            .map_err(|e| format!("Failed to close: {}", e))?;
    }

    if let Ok(mut store) = EMBEDDED_WEBVIEWS.lock() {
        store.webviews.remove("embedded_browser");
    }

    Ok(())
}

#[tauri::command]
async fn navigate_embedded_browser(app: AppHandle, url: String) -> Result<(), String> {
    if let Some(webview) = app.get_webview("embedded_browser") {
        let parsed_url = Url::parse(&url).map_err(|e| format!("Invalid URL: {}", e))?;
        webview
            .navigate(parsed_url)
            .map_err(|e| format!("Navigation failed: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
async fn resize_embedded_browser(
    app: AppHandle,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    if let Some(webview) = app.get_webview("embedded_browser") {
        webview
            .set_position(LogicalPosition::new(x, y))
            .map_err(|e| format!("Position failed: {}", e))?;
        webview
            .set_size(LogicalSize::new(width, height))
            .map_err(|e| format!("Size failed: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
async fn show_embedded_browser(app: AppHandle) -> Result<(), String> {
    if let Some(webview) = app.get_webview("embedded_browser") {
        webview.show().map_err(|e| format!("Show failed: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
async fn hide_embedded_browser(app: AppHandle) -> Result<(), String> {
    if let Some(webview) = app.get_webview("embedded_browser") {
        webview.hide().map_err(|e| format!("Hide failed: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
async fn is_browser_open(app: AppHandle) -> bool {
    app.get_webview("embedded_browser").is_some()
}

#[tauri::command]
async fn check_tagger_binary() -> bool {
    // Check if tagger-server executable exists in the current working directory or adjacent to the executable
    let mut path = std::env::current_exe().unwrap_or_default();
    path.pop(); // Get directory

    #[cfg(target_os = "windows")]
    path.push("tagger-server.exe");
    #[cfg(not(target_os = "windows"))]
    path.push("tagger-server");

    if path.exists() {
        return true;
    }

    // Also check current working directory as fallback
    let mut cwd_path = std::env::current_dir().unwrap_or_default();
    #[cfg(target_os = "windows")]
    cwd_path.push("tagger-server.exe");
    #[cfg(not(target_os = "windows"))]
    cwd_path.push("tagger-server");

    cwd_path.exists()
}

fn spawn_tagger_sc(app: &AppHandle) -> Result<(), String> {
    let state = app.state::<TaggerState>();
    let mut child_guard = state.0.lock().map_err(|e| e.to_string())?;

    if child_guard.is_some() {
        return Ok(()); // Already running
    }

    // Resolve path to tagger-server
    // Prioritize adjacent to executable
    let mut path = std::env::current_exe().map_err(|e| e.to_string())?;
    path.pop();
    #[cfg(target_os = "windows")]
    path.push("tagger-server.exe");
    #[cfg(not(target_os = "windows"))]
    path.push("tagger-server");

    if !path.exists() {
        // Fallback to CWD
        let mut cwd = std::env::current_dir().map_err(|e| e.to_string())?;
        #[cfg(target_os = "windows")]
        cwd.push("tagger-server.exe");
        #[cfg(not(target_os = "windows"))]
        cwd.push("tagger-server");
        if cwd.exists() {
            path = cwd;
        } else {
            return Err("tagger-server not found".to_string());
        }
    }

    // We use standard Command here because we are running a loose binary
    // BUT tauri_plugin_shell restricts this.
    // If we use shell scope, we can use Command::new("absolute_path") if allowed?
    // Or just Command::new("tagger-server") if it's in path?
    // Because we're not using sidecar(), we lose the automatic architecture resolution (which we don't want anyway)

    // Actually, to use tauri's shell plugin for an arbitrary path, we need to be careful.
    // However, since we are in the backend (Rust), we can use std::process::Command directly!
    // We don't *have* to use the plugin's Command if we don't want to enforce the scope strictly
    // OR if we want to bypass it.
    // BUT the original code used `CommandChild` from the plugin which wraps shared child.
    // `state.0` is `Option<CommandChild>`. `CommandChild` is from `tauri_plugin_shell::process`.

    // If we use std::process::Command, we can't store it in `CommandChild` easily unless we map it.
    // `CommandChild` allows reading output asynchronously via events if using the JS API,
    // but here we are in Rust.

    // Wait, `CommandChild` is a wrapper around `SharedChild`.
    // Let's stick to `tauri_plugin_shell::ShellExt` IF it supports absolute paths.
    // `app.shell().command("path")`

    let path_str = path.to_string_lossy().to_string();

    // Note: for this to work with tauri permissions, the executable path must be allowed.
    // If we use std::process, we bypass Tauri's capability check (which is fine for backend logic,
    // but we lose the easy integration with `CommandChild` struct if it's specific).

    // Let's look at `TaggerState` definition: `pub struct TaggerState(pub Arc<Mutex<Option<CommandChild>>>);`
    // If we want to keep using TaggerState, we should try to use the shell plugin.

    let command = app.shell().command(&path_str).args(["--port", "8002"]);

    let (_, child) = command
        .spawn()
        .map_err(|e| format!("Failed to spawn sidecar at {}: {}", path_str, e))?;

    *child_guard = Some(child);
    Ok(())
}

#[tauri::command]
async fn start_tagger(app: AppHandle) -> Result<(), String> {
    spawn_tagger_sc(&app)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let tagger_state = TaggerState(Arc::new(Mutex::new(None)));
    let tagger_state_clone = tagger_state.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .manage(tagger_state)
        .invoke_handler(tauri::generate_handler![
            verify_token,
            get_anlas_balance,
            upscale_image,
            remove_background,
            open_embedded_browser,
            close_embedded_browser,
            navigate_embedded_browser,
            resize_embedded_browser,
            show_embedded_browser,
            hide_embedded_browser,
            is_browser_open,
            start_tagger,
            check_tagger_binary
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Auto-start tagger sidecar
            if let Err(e) = spawn_tagger_sc(app.handle()) {
                eprintln!("Failed to auto-start tagger: {}", e);
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(move |_app_handle, event| {
            if let RunEvent::Exit = event {
                if let Ok(mut child) = tagger_state_clone.0.lock() {
                    if let Some(child_process) = child.take() {
                        let _pid = child_process.pid();
                        #[cfg(target_os = "windows")]
                        {
                            println!("Attempting to kill process tree for PID: {}", _pid);
                            let _ = std::process::Command::new("taskkill")
                                .args(["/F", "/T", "/PID", &_pid.to_string()])
                                .output();
                            // We use output() to wait for it to finish before the app fully exits
                        }
                        #[cfg(not(target_os = "windows"))]
                        {
                            let _ = child_process.kill();
                        }
                    }
                }
            }
        });
}
