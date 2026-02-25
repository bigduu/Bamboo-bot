//! Embedded web service module
//!
//! This module manages the embedded bamboo-agent HTTP server running within the Tauri app.
//! Instead of using a sidecar process, we run the HTTP server directly in the app process.

use log::{error, info};
use std::sync::Arc;
use std::{io::Error, path::PathBuf};
use tokio::task::JoinHandle;

// Import the server module from bamboo-agent
use bamboo_agent::server;

/// Embedded web service manager
///
/// Manages the lifecycle of the embedded HTTP server
pub struct EmbeddedWebService {
    port: u16,
    data_dir: PathBuf,
    server_handle: Arc<
        tokio::sync::Mutex<
            Option<JoinHandle<Result<(), Box<dyn std::error::Error + Send + Sync>>>>,
        >,
    >,
}

impl EmbeddedWebService {
    /// Create a new embedded web service manager
    pub fn new(port: u16, data_dir: PathBuf) -> Self {
        Self {
            port,
            data_dir,
            server_handle: Arc::new(tokio::sync::Mutex::new(None)),
        }
    }

    /// Start the embedded HTTP server
    ///
    /// This spawns the bamboo-agent HTTP server in a tokio async task
    pub async fn start(&self) -> Result<(), String> {
        info!("Starting embedded web service on port {}", self.port);

        // Check if already running
        {
            let handle = self.server_handle.lock().await;
            if handle.is_some() {
                info!("Embedded web service is already running");
                return Ok(());
            }
        }

        // Prepare configuration
        let port = self.port;
        let data_dir = self.data_dir.clone();
        let server_handle = self.server_handle.clone();

        // Spawn the HTTP server in a background task
        let handle = tokio::spawn(async move {
            info!("Embedded HTTP server task started");

            // Run the bamboo-agent HTTP server
            let result = server::run(data_dir, port).await;

            match result {
                Ok(_) => {
                    info!("Embedded HTTP server stopped gracefully");
                    Ok(())
                }
                Err(e) => {
                    error!("Embedded HTTP server error: {}", e);
                    Err(Box::new(Error::other(format!("Server error: {}", e)))
                        as Box<dyn std::error::Error + Send + Sync>)
                }
            }
        });

        // Store the handle
        {
            let mut server = server_handle.lock().await;
            *server = Some(handle);
        }

        // Wait a bit for server to start
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

        // Check if server is healthy
        self.wait_for_health().await?;

        info!("Embedded web service is healthy and ready on port {}", port);
        Ok(())
    }

    /// Stop the embedded HTTP server
    pub async fn stop(&self) -> Result<(), String> {
        info!("Stopping embedded web service");

        let handle = {
            let mut server = self.server_handle.lock().await;
            server.take()
        };

        if let Some(handle) = handle {
            // Abort the server task
            handle.abort();
            info!("Embedded web service stopped");
        } else {
            info!("No running server to stop");
        }

        Ok(())
    }

    /// Wait for the web service to become healthy
    async fn wait_for_health(&self) -> Result<(), String> {
        let health_url = format!("http://127.0.0.1:{}/api/v1/health", self.port);
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
        let health_url = format!("http://127.0.0.1:{}/api/v1/health", self.port);
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
        // The tokio runtime will clean up the task when the app shuts down
        log::info!("EmbeddedWebService being dropped");
    }
}
