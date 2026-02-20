use std::path::PathBuf;
use std::sync::Arc;
use tauri::api::process::{Command, CommandEvent};
use tauri::{AppHandle, Manager};
use tokio::sync::RwLock;
use tokio::time::{sleep, Duration};
use log::{error, info, warn};

pub struct WebServiceSidecar {
    port: u16,
    data_dir: PathBuf,
    pid: Arc<RwLock<Option<u32>>>,
}

impl WebServiceSidecar {
    pub fn new(port: u16, data_dir: PathBuf) -> Self {
        Self {
            port,
            data_dir,
            pid: Arc::new(RwLock::new(None)),
        }
    }

    /// Start the web service sidecar
    pub async fn start(&self, app_handle: &AppHandle) -> Result<u32, String> {
        info!("Starting web service sidecar on port {}", self.port);

        // Check if already running
        {
            let pid = self.pid.read().await;
            if pid.is_some() {
                return Err("Web service sidecar is already running".to_string());
            }
        }

        // Check if port is available
        if !self.is_port_available().await {
            return Err(format!("Port {} is already in use", self.port));
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
            .map_err(|e| format!("Failed to spawn web service: {}", e))?;

        // Get the PID (we'll track it ourselves since Tauri manages the child)
        // For now, we'll use a placeholder - in production we'd extract from child
        let pid = 0u32; // Placeholder

        info!("Web service sidecar started");

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

        // Store PID
        {
            let mut pid_guard = self.pid.write().await;
            *pid_guard = Some(pid);
        }

        info!("Web service sidecar is healthy and ready");

        Ok(pid)
    }

    /// Stop the web service sidecar
    pub async fn stop(&self) -> Result<(), String> {
        let mut pid_guard = self.pid.write().await;
        if let Some(_pid) = *pid_guard {
            info!("Stopping web service sidecar");
            // Tauri will handle killing the process when the app exits
            *pid_guard = None;
            info!("Web service sidecar stopped");
        }

        Ok(())
    }

    /// Check if the port is available
    async fn is_port_available(&self) -> bool {
        use tokio::net::TcpListener;

        let addr = format!("127.0.0.1:{}", self.port);
        match TcpListener::bind(&addr).await {
            Ok(_) => true,
            Err(_) => false,
        }
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

    /// Check if sidecar is running
    pub async fn is_running(&self) -> bool {
        let pid = self.pid.read().await;
        pid.is_some()
    }
}
