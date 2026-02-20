#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Map Rust target triples to sidecar binary names
const TARGET_MAP = {
  'x86_64-apple-darwin': 'web_service_standalone-x86_64-apple-darwin',
  'aarch64-apple-darwin': 'web_service_standalone-aarch64-apple-darwin',
  'x86_64-pc-windows-msvc': 'web_service_standalone-x86_64-pc-windows-msvc.exe',
  'x86_64-unknown-linux-gnu': 'web_service_standalone-x86_64-unknown-linux-gnu',
};

// Get the target from environment or default to current platform
const target = process.env.TARGET || process.env.CARGO_BUILD_TARGET || getDefaultTarget();

function getDefaultTarget() {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === 'darwin') {
    return arch === 'arm64' ? 'aarch64-apple-darwin' : 'x86_64-apple-darwin';
  } else if (platform === 'win32') {
    return 'x86_64-pc-windows-msvc';
  } else if (platform === 'linux') {
    return 'x86_64-unknown-linux-gnu';
  }

  throw new Error(`Unsupported platform: ${platform} ${arch}`);
}

function copyBinary() {
  const binaryName = TARGET_MAP[target];
  if (!binaryName) {
    throw new Error(`Unknown target: ${target}`);
  }

  const sourcePath = path.join(__dirname, '..', 'target', 'release', getBinaryName());
  const destPath = path.join(__dirname, '..', 'src-tauri', 'binaries', binaryName);

  console.log(`Copying sidecar binary:`);
  console.log(`  From: ${sourcePath}`);
  console.log(`  To: ${destPath}`);

  if (!fs.existsSync(sourcePath)) {
    console.error(`Error: Binary not found at ${sourcePath}`);
    console.error(`Make sure to build the web_service_standalone crate first:`);
    console.error(`  cargo build --release -p web_service_standalone`);
    process.exit(1);
  }

  // Ensure binaries directory exists
  const binariesDir = path.dirname(destPath);
  if (!fs.existsSync(binariesDir)) {
    fs.mkdirSync(binariesDir, { recursive: true });
  }

  // Copy the binary
  fs.copyFileSync(sourcePath, destPath);

  // Make executable on Unix-like systems
  if (process.platform !== 'win32') {
    fs.chmodSync(destPath, 0o755);
  }

  console.log(`✓ Sidecar binary copied successfully`);
}

function getBinaryName() {
  return process.platform === 'win32' ? 'web_service_standalone.exe' : 'web_service_standalone';
}

// Run the copy
try {
  copyBinary();
} catch (error) {
  console.error(`Error copying sidecar binary: ${error.message}`);
  process.exit(1);
}
