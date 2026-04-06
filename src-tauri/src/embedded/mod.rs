//! Embedded web service module
//!
//! This module manages the embedded bamboo-agent HTTP server running within the Tauri app.
//! Instead of using a sidecar process, we run the HTTP server directly in the app process.

use crate::app_settings;
use bamboo_agent::server::services::frontend_package;
use log::{info, warn};
use std::path::{Path, PathBuf};
use std::sync::Arc;

// Import the server module from bamboo-agent
use bamboo_agent::server::WebService;

/// Embedded web service manager
///
/// Manages the lifecycle of the embedded HTTP server
pub struct EmbeddedWebService {
    port: u16,
    bind_addr: String,
    static_dir: Option<PathBuf>,
    web_service: Arc<tokio::sync::Mutex<WebService>>,
}

fn resolve_embedded_bind_addr() -> String {
    let config_path = app_settings::config_json_path();
    let default_bind = "127.0.0.1".to_string();

    let config = match app_settings::load_config_json(&config_path) {
        Ok(value) => value,
        Err(error) => {
            log::warn!(
                "Failed to read config.json for embedded bind ({}); falling back to {}",
                error,
                default_bind
            );
            return default_bind;
        }
    };

    config
        .get("server")
        .and_then(|server| server.get("bind"))
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("127.0.0.1")
        .to_string()
}

fn resolve_configured_static_dir() -> Option<PathBuf> {
    let config_path = app_settings::config_json_path();
    let config = match app_settings::load_config_json(&config_path) {
        Ok(value) => value,
        Err(error) => {
            warn!(
                "Failed to read config.json for embedded static dir ({}); falling back to auto-discovery",
                error
            );
            return None;
        }
    };

    config
        .get("server")
        .and_then(|server| server.get("static_dir"))
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
}

fn is_valid_frontend_dist(path: &Path) -> bool {
    path.is_dir() && path.join("index.html").is_file()
}

fn candidate_embedded_static_dirs() -> Vec<PathBuf> {
    let mut candidates = Vec::new();

    if let Ok(explicit) = std::env::var("BODHI_FRONTEND_DIST") {
        let explicit = explicit.trim();
        if !explicit.is_empty() {
            candidates.push(PathBuf::from(explicit));
        }
    }

    if let Some(configured) = resolve_configured_static_dir() {
        candidates.push(configured);
    }

    if let Ok(current_dir) = std::env::current_dir() {
        candidates.push(current_dir.join(".lotus-dist"));
        candidates.push(current_dir.join("../.lotus-dist"));
    }

    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(exe_dir) = current_exe.parent() {
            candidates.push(exe_dir.join(".lotus-dist"));
            candidates.push(exe_dir.join("../.lotus-dist"));
            // macOS app bundle layout: Contents/MacOS/<binary> -> Contents/Resources
            candidates.push(exe_dir.join("../Resources/.lotus-dist"));
        }
    }

    candidates
}

fn resolve_embedded_static_dir() -> Option<PathBuf> {
    match frontend_package::ensure_current_frontend_dir(None) {
        Ok(status) => {
            if status.frontend_dir.join(&status.bundled_manifest.entry).is_file() {
                info!(
                    "Resolved Bamboo-owned duplicate frontend at {:?} (refreshed={})",
                    status.frontend_dir, status.refreshed
                );
                return Some(status.frontend_dir);
            }
            warn!(
                "Duplicate frontend package prepared {:?} but entry {} is missing; falling back to legacy probing",
                status.frontend_dir,
                status.bundled_manifest.entry
            );
        }
        Err(error) => {
            warn!(
                "Failed to prepare Bamboo-owned duplicate frontend package: {}. Falling back to legacy probing.",
                error
            );
        }
    }

    for candidate in candidate_embedded_static_dirs() {
        let canonicalized = match candidate.canonicalize() {
            Ok(path) => path,
            Err(_) => continue,
        };

        if is_valid_frontend_dist(&canonicalized) {
            info!("Resolved embedded frontend dist at {:?}", canonicalized);
            return Some(canonicalized);
        }
    }

    info!(
        "No embedded frontend dist directory resolved; embedded server will start in API-only mode"
    );
    None
}

fn loopback_probe_host(bind_addr: &str) -> &str {
    if bind_addr == "0.0.0.0" {
        "127.0.0.1"
    } else {
        bind_addr
    }
}

impl EmbeddedWebService {
    /// Create a new embedded web service manager
    pub fn new(port: u16, data_dir: PathBuf) -> Self {
        Self {
            port,
            bind_addr: resolve_embedded_bind_addr(),
            static_dir: resolve_embedded_static_dir(),
            web_service: Arc::new(tokio::sync::Mutex::new(WebService::new(data_dir))),
        }
    }

    /// Start the embedded HTTP server
    ///
    /// This uses bamboo-agent's managed WebService lifecycle to avoid Send constraints.
    pub async fn start(&self) -> Result<(), String> {
        info!(
            "Starting embedded web service on {}:{}",
            self.bind_addr,
            self.port
        );

        // Check if already running and start managed service
        {
            let mut service = self.web_service.lock().await;
            if service.is_running() {
                info!("Embedded web service is already running");
                return Ok(());
            }

            if let Some(static_dir) = self.static_dir.clone() {
                match service
                    .start_with_bind_and_static(self.port, &self.bind_addr, static_dir.clone())
                    .await
                {
                    Ok(()) => {
                        info!(
                            "Embedded web service started with static frontend from {:?}",
                            static_dir
                        );
                    }
                    Err(error) => {
                        warn!(
                            "Failed to start embedded web service with static frontend from {:?}: {}. Falling back to API-only startup.",
                            static_dir,
                            error
                        );
                        service
                            .start_with_bind(self.port, &self.bind_addr)
                            .await
                            .map_err(|fallback_error| {
                                format!(
                                    "Failed to start embedded web service with static frontend ({}) and API-only fallback ({})",
                                    error, fallback_error
                                )
                            })?;
                    }
                }
            } else {
                service
                    .start_with_bind(self.port, &self.bind_addr)
                    .await
                    .map_err(|e| format!("Failed to start embedded web service: {}", e))?;
            }
        }

        // Wait a bit for server to start
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

        // Check if server is healthy
        self.wait_for_health().await?;

        info!(
            "Embedded web service is healthy and ready on {}:{}",
            self.bind_addr,
            self.port
        );
        Ok(())
    }

    /// Stop the embedded HTTP server
    pub async fn stop(&self) -> Result<(), String> {
        info!("Stopping embedded web service");

        let mut service = self.web_service.lock().await;

        if service.is_running() {
            service
                .stop()
                .await
                .map_err(|e| format!("Failed to stop embedded web service: {}", e))?;
            info!("Embedded web service stopped");
        } else {
            info!("No running server to stop");
        }

        Ok(())
    }

    /// Wait for the web service to become healthy
    async fn wait_for_health(&self) -> Result<(), String> {
        let probe_host = loopback_probe_host(&self.bind_addr);
        let health_url = format!("http://{}:{}/api/v1/health", probe_host, self.port);
        let client = reqwest::Client::new();

        info!(
            "Waiting for embedded service health check at {}",
            health_url
        );

        for attempt in 1..=10 {
            match client
                .get(&health_url)
                .timeout(tokio::time::Duration::from_secs(2))
                .send()
                .await
            {
                Ok(response) if response.status().is_success() => {
                    info!(
                        "Embedded service health check passed on attempt {}",
                        attempt
                    );
                    return Ok(());
                }
                Ok(response) => {
                    info!(
                        "Health check returned status {} on attempt {}",
                        response.status(),
                        attempt
                    );
                }
                Err(e) => {
                    info!(
                        "Health check attempt {} failed: {}. Retrying in 200ms...",
                        attempt, e
                    );
                }
            }

            tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
        }

        Err("Embedded service failed health check after 10 attempts".to_string())
    }

    /// Check if service is running by testing health endpoint
    pub async fn is_running(&self) -> bool {
        let probe_host = loopback_probe_host(&self.bind_addr);
        let health_url = format!("http://{}:{}/api/v1/health", probe_host, self.port);
        let client = reqwest::Client::new();

        match client
            .get(&health_url)
            .timeout(tokio::time::Duration::from_secs(2))
            .send()
            .await
        {
            Ok(response) => response.status().is_success(),
            Err(_) => false,
        }
    }
}

impl Drop for EmbeddedWebService {
    fn drop(&mut self) {
        // Note: We can't await in Drop, so we just log
        // The process exit will terminate any remaining background tasks.
        log::info!("EmbeddedWebService being dropped");
    }
}
