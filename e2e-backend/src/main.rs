//! Standalone web service binary for E2E testing
//!
//! This binary runs the bamboo-agent web service without Tauri for testing purposes.

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

    // Run the web service
    bamboo_agent::web_service::server::run(data_dir, port).await?;

    Ok(())
}
