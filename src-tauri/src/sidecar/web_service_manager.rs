use std::path::PathBuf;
use tauri::api::process::{Command, CommandEvent};
use tauri::{AppHandle, Manager};
use tokio::time::{sleep, Duration};
use log::{error, info, warn};

pub struct WebServiceSidecar {
    port: u16,
    data_dir: PathBuf,
}

impl WebServiceSidecar {
    pub fn new(port: u16, data_dir: PathBuf) -> Self {
        Self {
            port,
            data_dir,
        }
    }

    /// Start the web service sidecar
    pub async fn start(&self, app_handle: &AppHandle) -> Result<u32, String> {
        info!("Starting web service sidecar on port {}", self.port);

        // Check if already running using health check
        if self.is_running().await {
            return Err("Web service sidecar is already running".to_string());
        }

        // Create sidecar command using Tauri v2 API
        let sidecar_command = Command::new_sidecar("web_service_standalone")
            .map_err(|e| format!("Failed to create sidecar command: {}", e))?;

        // Spawn process with logging
        let (mut rx, _child) = sidecar_command
            .args([
                "--port", &self.port.to_string(),
                "--data-dir", &self.data_dir.to_string_lossy(),
            ])
            .spawn()
            .map_err(|e| {
                if e.to_string().contains("Address already in use") {
                    format!("Port {} is already in use. Is another instance running?", self.port)
                } else {
                    format!("Failed to spawn web service: {}", e)
                }
            })?;

        info!("Web service sidecar process spawned");

        // Capture stdout/stderr in background
        tauri::async_runtime::spawn(async move {
            while let Some(event) = rx.recv().await {
                match event {
                    CommandEvent::Stdout(line) => {
                        info!("[sidecar stdout] {}", line);
                    }
                    CommandEvent::Stderr(line) => {
                        warn!("[sidecar stderr] {}", line);
                    }
                    CommandEvent::Error(error) => {
                        error!("[sidecar error] {}", error);
                    }
                    CommandEvent::Terminated(payload) => {
                        info!("[sidecar terminated] code: {:?}", payload.code);
                        break;
                    }
                    _ => {}
                }
            }
        });

        // Wait for health check to pass
        self.wait_for_health().await?;

        info!("Web service sidecar is healthy and ready");

        // Return a dummy PID (0) since we're using health checks instead of PID tracking
        Ok(0)
    }

    /// Stop the web service sidecar
    /// Note: Tauri will handle killing the process when the app exits
    pub async fn stop(&self) -> Result<(), String> {
        if self.is_running().await {
            info!("Web service sidecar stop requested (Tauri will handle process cleanup)");
        }

        Ok(())
    }

    /// Wait for the web service to become healthy
    async fn wait_for_health(&self) -> Result<(), String> {
        let health_url = format!("http://127.0.0.1:{}/api/v1/health", self.port);
        let client = reqwest::Client::new();

        info!("Waiting for web service health check at {}", health_url);

        for attempt in 1..=10 {
            match client.get(&health_url).timeout(Duration::from_secs(2)).send().await {
                Ok(response) if response.status().is_success() => {
                    info!("Web service health check passed on attempt {}", attempt);
                    return Ok(());
                }
                Ok(response) => {
                    warn!(
                        "Health check returned status {} on attempt {}",
                        response.status(),
                        attempt
                    );
                }
                Err(e) => {
                    info!(
                        "Health check attempt {} failed: {}. Retrying in 500ms...",
                        attempt, e
                    );
                }
            }

            sleep(Duration::from_millis(500)).await;
        }

        Err("Web service failed health check after 10 attempts".to_string())
    }

    /// Check if sidecar is running by testing health endpoint
    pub async fn is_running(&self) -> bool {
        let health_url = format!("http://127.0.0.1:{}/api/v1/health", self.port);
        let client = reqwest::Client::new();

        match client
            .get(&health_url)
            .timeout(Duration::from_secs(2))
            .send()
            .await
        {
            Ok(response) => response.status().is_success(),
            Err(_) => false,
        }
    }
}
