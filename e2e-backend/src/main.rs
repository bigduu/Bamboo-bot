//! Standalone web service binary for E2E testing
//!
//! This binary runs the bamboo-agent web service without Tauri for testing purposes.

use std::path::PathBuf;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Parse command line arguments
    let args: Vec<String> = std::env::args().collect();

    let port = if args.len() > 2 && args[1] == "--port" {
        args[2].parse::<u16>().expect("Invalid port number")
    } else {
        8080
    };

    let data_dir = if args.len() > 4 && args[3] == "--data-dir" {
        PathBuf::from(&args[4])
    } else {
        std::env::temp_dir().join("bamboo-test-data")
    };

    // Ensure data directory exists
    std::fs::create_dir_all(&data_dir)?;

    println!("Starting web service on port {}", port);
    println!("Data directory: {:?}", data_dir);

    // Run the web service
    bamboo_agent::web_service::server::run(data_dir, port).await?;

    Ok(())
}
