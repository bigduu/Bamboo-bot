use clap::Parser;
use std::path::PathBuf;

#[derive(Parser)]
#[command(name = "bamboo-web-service")]
#[command(about = "Bamboo AI Chat Web Service")]
struct Args {
    /// Port to listen on
    #[arg(short, long, default_value = "8080")]
    port: u16,

    /// Data directory path
    #[arg(short, long, default_value = "/data")]
    data_dir: PathBuf,

    /// Bind address (0.0.0.0 for Docker, 127.0.0.1 for local)
    #[arg(long, default_value = "0.0.0.0")]
    bind: String,
}

#[tokio::main]
async fn main() -> Result<(), String> {
    env_logger::init();

    let args = Args::parse();

    log::info!("Starting Bamboo Web Service");
    log::info!("Port: {}", args.port);
    log::info!("Data directory: {:?}", args.data_dir);
    log::info!("Bind address: {}", args.bind);

    // Ensure data directory exists
    std::fs::create_dir_all(&args.data_dir)
        .map_err(|e| format!("Failed to create data directory: {}", e))?;

    // Run the server
    web_service::server::run_with_bind(args.data_dir, args.port, &args.bind).await
}