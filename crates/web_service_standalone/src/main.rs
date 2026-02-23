use chat_core::paths::bamboo_dir;
use clap::{Parser, Subcommand};
use std::env;
use std::path::PathBuf;
use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

#[derive(Parser, Debug)]
#[command(name = "copilot-server")]
#[command(about = "Copilot Chat Server", long_about = None)]
struct Cli {
    /// Enable headless mode (do not open browser; print user code to stdout)
    #[arg(long)]
    headless: bool,

    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Subcommand, Debug)]
enum Commands {
    /// Start the web server (default)
    Serve {
        /// Port to listen on
        #[arg(short, long, default_value = "8080")]
        port: u16,

        /// Application data directory
        #[arg(short, long)]
        data_dir: Option<PathBuf>,

        /// Bind address (default: 127.0.0.1, use 0.0.0.0 for Docker)
        #[arg(short, long, default_value = "127.0.0.1")]
        bind: String,

        /// Static files directory for frontend (for production/Docker)
        ///
        /// When provided, the server will serve both API endpoints and static frontend files.
        /// This is required for:
        /// - Docker deployment (frontend must be built and served)
        /// - Standalone production mode (no Vite dev server)
        ///
        /// Not needed for:
        /// - Tauri desktop mode (Tauri webview serves frontend)
        /// - Development mode (Vite dev server on port 1420)
        #[arg(short, long)]
        static_dir: Option<PathBuf>,
    },
}

fn env_headless_enabled() -> bool {
    match env::var("COPILOT_CHAT_HEADLESS") {
        Ok(value) => matches!(
            value.trim().to_ascii_lowercase().as_str(),
            "1" | "true" | "yes" | "y" | "on"
        ),
        Err(_) => false,
    }
}

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    let cli = Cli::parse();
    if cli.headless || env_headless_enabled() {
        env::set_var("COPILOT_CHAT_HEADLESS", "1");
    }

    match cli.command {
        Some(Commands::Serve {
            port,
            data_dir,
            bind,
            static_dir,
        }) => {
            // Initialize tracing subscriber with DEBUG level by default for standalone mode
            tracing_subscriber::registry()
                .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("debug")))
                .with(
                    fmt::layer()
                        .with_target(true)
                        .with_thread_ids(false)
                        .with_line_number(true)
                        .with_file(false),
                )
                .init();

            tracing::info!("Starting standalone web service...");

            // Start the server
            let app_data_dir = data_dir.unwrap_or_else(bamboo_dir);

            // Priority: run_with_bind_and_static > run_with_bind > run
            let result = if let Some(dir) = static_dir {
                tracing::info!("Serving static files from: {:?}", dir);
                web_service::server::run_with_bind_and_static(
                    app_data_dir,
                    port,
                    &bind,
                    Some(dir),
                ).await
            } else if bind == "127.0.0.1" {
                web_service::server::run(app_data_dir, port).await
            } else {
                web_service::server::run_with_bind(app_data_dir, port, &bind).await
            };

            if let Err(e) = result {
                tracing::error!("Failed to run web service: {}", e);
                std::process::exit(1);
            }
        }
        None => {
            // Initialize tracing subscriber with DEBUG level by default for standalone mode
            tracing_subscriber::registry()
                .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("debug")))
                .with(
                    fmt::layer()
                        .with_target(true)
                        .with_thread_ids(false)
                        .with_line_number(true)
                        .with_file(false),
                )
                .init();

            tracing::info!("Starting standalone web service...");

            // Get port from environment variable or use default
            let port = env::var("APP_PORT")
                .ok()
                .and_then(|s| s.parse::<u16>().ok())
                .unwrap_or(8080);

            let app_data_dir = bamboo_dir();

            // Start the server
            if let Err(e) = web_service::server::run(app_data_dir, port).await {
                tracing::error!("Failed to run web service: {}", e);
                std::process::exit(1);
            }
        }
    }
}
