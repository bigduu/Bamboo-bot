//! Standalone web service binary for E2E testing
//!
//! This binary runs the bamboo-agent web service without Tauri for testing purposes.

use std::io;
use std::path::PathBuf;
use clap::Parser;

#[derive(Parser, Debug)]
#[command(name = "e2e-backend")]
#[command(about = "Standalone web service for E2E testing", long_about = None)]
struct Args {
    /// Port to run the web service on
    #[arg(long, default_value_t = 8080)]
    port: u16,

    /// Directory to store test data
    #[arg(long)]
    data_dir: Option<PathBuf>,

    /// Bind address (127.0.0.1 for local, 0.0.0.0 for Docker)
    #[arg(long, default_value = "127.0.0.1")]
    bind: String,

    /// Optional static dir to serve (dist/ or /app/static)
    #[arg(long)]
    static_dir: Option<PathBuf>,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Parse command line arguments using clap
    let args = Args::parse();

    let port = args.port;
    let data_dir = args
        .data_dir
        .unwrap_or_else(|| std::env::temp_dir().join("bamboo-test-data"));

    // Ensure data directory exists
    std::fs::create_dir_all(&data_dir)?;

    println!("Starting web service on port {}", port);
    println!("Data directory: {:?}", data_dir);
    println!("Bind: {}", args.bind);
    println!("Static dir: {:?}", args.static_dir);

    // Run the web service with bind and static file support
    bamboo_agent::web_service::server::run_with_bind_and_static(
        data_dir,
        port,
        &args.bind,
        args.static_dir,
    )
    .await
    .map_err(|e| io::Error::new(io::ErrorKind::Other, e))?;

    Ok(())
}
