use std::path::PathBuf;
use log::{error, info, warn};
use std::sync::Mutex;
use tauri::{AppHandle, Runtime};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;
use tokio::time::{sleep, Duration};

pub struct WebServiceSidecar {
    port: u16,
    data_dir: PathBuf,
    child: Mutex<Option<CommandChild>>,
}

impl WebServiceSidecar {
    pub fn new(port: u16, data_dir: PathBuf) -> Self {
        Self {
            port,
            data_dir,
            child: Mutex::new(None),
        }
    }

    /// Start the web service sidecar
    pub async fn start<R: Runtime>(&self, app_handle: &AppHandle<R>) -> Result<u32, String> {
        info!("Starting web service sidecar on port {}", self.port);

        // Check if already running using health check
        if self.is_running().await {
            return Err("Web service sidecar is already running".to_string());
        }

        // Create sidecar command using Tauri v2 plugin API.
        // Note: this requires `.plugin(tauri_plugin_shell::init())` in the Tauri builder.
        let sidecar_command = app_handle
            .shell()
            .sidecar("web_service_standalone")
            .map_err(|e| format!("Failed to create sidecar command: {e}"))?;

        // Spawn process with logging
        let (mut rx, child) = sidecar_command
            .arg("--port")
            .arg(self.port.to_string())
            .arg("--data-dir")
            .arg(&self.data_dir)
            .spawn()
            .map_err(|e| {
                if e.to_string().contains("Address already in use") {
                    format!("Port {} is already in use. Is another instance running?", self.port)
                } else {
                    format!("Failed to spawn web service: {}", e)
                }
            })?;

        let pid = child.pid();
        info!("Web service sidecar process spawned (pid={})", pid);

        // Best-effort: keep the child handle so we can stop it (and clean up on drop).
        {
            let mut guard = self
                .child
                .lock()
                .map_err(|_| "Sidecar process lock poisoned".to_string())?;
            // If we had a stale handle, try to kill it before replacing.
            if let Some(old) = guard.take() {
                let _ = old.kill();
            }
            *guard = Some(child);
        }

        // Capture stdout/stderr in background
        tauri::async_runtime::spawn(async move {
            while let Some(event) = rx.recv().await {
                match event {
                    CommandEvent::Stdout(line) => {
                        info!("[sidecar stdout] {}", String::from_utf8_lossy(&line));
                    }
                    CommandEvent::Stderr(line) => {
                        warn!("[sidecar stderr] {}", String::from_utf8_lossy(&line));
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
    pub async fn stop(&self) -> Result<(), String> {
        let child = self
            .child
            .lock()
            .map_err(|_| "Sidecar process lock poisoned".to_string())?
            .take();

        if let Some(child) = child {
            info!("Stopping web service sidecar (pid={})", child.pid());
            child
                .kill()
                .map_err(|e| format!("Failed to kill web service sidecar: {e}"))?;
        } else if self.is_running().await {
            // We don't have a handle (e.g., started by another instance), so we can only log.
            info!("Web service sidecar stop requested, but no process handle is available");
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

impl Drop for WebServiceSidecar {
    fn drop(&mut self) {
        let Ok(child) = self.child.get_mut() else {
            // Poisoned mutex; nothing safe we can do here.
            return;
        };

        if let Some(child) = child.take() {
            if let Err(e) = child.kill() {
                // Logger might already be shut down during app exit; ignore if logging fails.
                log::warn!("Failed to kill web service sidecar on drop: {e}");
            }
        }
    }
}
