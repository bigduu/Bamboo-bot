use std::path::{Path, PathBuf};

/// Get Bamboo config directory (~/.bamboo)
pub fn bamboo_dir() -> PathBuf {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
        .unwrap_or_else(|| std::env::temp_dir())
        .join(".bamboo")
}

/// Get config.json path
pub fn config_json_path() -> PathBuf {
    bamboo_dir().join("config.json")
}

/// Get keyword_masking.json path
pub fn keyword_masking_json_path() -> PathBuf {
    bamboo_dir().join("keyword_masking.json")
}

/// Get workflows directory
pub fn workflows_dir() -> PathBuf {
    bamboo_dir().join("workflows")
}

/// Get anthropic-model-mapping.json path
pub fn anthropic_model_mapping_path() -> PathBuf {
    bamboo_dir().join("anthropic-model-mapping.json")
}

/// Get gemini-model-mapping.json path
pub fn gemini_model_mapping_path() -> PathBuf {
    bamboo_dir().join("gemini-model-mapping.json")
}

/// Ensure bamboo directory exists
pub fn ensure_bamboo_dir() -> std::io::Result<PathBuf> {
    let dir = bamboo_dir();
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}

/// Get sessions directory (~/.bamboo/sessions)
pub fn sessions_dir() -> PathBuf {
    bamboo_dir().join("sessions")
}

/// Migrate session files from ~/.bamboo to ~/.bamboo/sessions/
/// This is a one-time migration for backwards compatibility
pub fn migrate_session_files() -> std::io::Result<()> {
    let bamboo_path = bamboo_dir();
    let sessions_path = sessions_dir();

    // Create sessions directory if it doesn't exist
    std::fs::create_dir_all(&sessions_path)?;

    // Look for session files (*.json and *.jsonl) in the root bamboo directory
    let entries = match std::fs::read_dir(&bamboo_path) {
        Ok(entries) => entries,
        Err(e) => {
            // If we can't read the directory, just log and continue
            eprintln!("Warning: Could not read bamboo directory for migration: {}", e);
            return Ok(());
        }
    };

    for entry in entries.flatten() {
        let path = entry.path();
        let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

        // Check if it's a session file (*.json or *.jsonl, excluding config files)
        let is_session_file = (file_name.ends_with(".json") || file_name.ends_with(".jsonl"))
            && !file_name.starts_with("config")
            && !file_name.starts_with("keyword")
            && !file_name.contains("model-mapping")
            && !file_name.starts_with("mcp");

        if is_session_file {
            let dest_path = sessions_path.join(file_name);
            // Only move if destination doesn't exist
            if !dest_path.exists() {
                if let Err(e) = std::fs::rename(&path, &dest_path) {
                    eprintln!(
                        "Warning: Could not migrate session file {:?}: {}",
                        path, e
                    );
                } else {
                    println!("Migrated session file: {}", file_name);
                }
            }
        }
    }

    Ok(())
}

/// Load JSON config file
pub fn load_config_json<T: serde::de::DeserializeOwned>(path: &Path) -> Result<T, String> {
    if !path.exists() {
        return Err(format!("Config file not found: {}", path.display()));
    }
    let content =
        std::fs::read_to_string(path).map_err(|e| format!("Failed to read config: {e}"))?;
    serde_json::from_str(&content).map_err(|e| format!("Failed to parse config: {e}"))
}

/// Save JSON config file
pub fn save_config_json<T: serde::Serialize>(path: &Path, value: &T) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {e}"))?;
    }
    let content = serde_json::to_string_pretty(value)
        .map_err(|e| format!("Failed to serialize config: {e}"))?;
    std::fs::write(path, content).map_err(|e| format!("Failed to write config: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::io::Write;
    use tempfile::tempdir;

    #[test]
    fn test_sessions_dir_returns_bamboo_sessions() {
        let sessions = sessions_dir();
        assert!(sessions.to_str().unwrap().ends_with(".bamboo/sessions"));
    }

    #[test]
    fn test_migrate_session_files_moves_session_files() {
        let temp_dir = tempdir().expect("Failed to create temp dir");
        let bamboo_path = temp_dir.path().join(".bamboo");
        fs::create_dir_all(&bamboo_path).expect("Failed to create bamboo dir");

        // Create some test files
        fs::File::create(bamboo_path.join("session-1.json"))
            .expect("Failed to create test file")
            .write_all(b"{}")
            .expect("Failed to write test file");
        fs::File::create(bamboo_path.join("session-1.jsonl"))
            .expect("Failed to create test file")
            .write_all(b"{}")
            .expect("Failed to write test file");
        fs::File::create(bamboo_path.join("config.json"))
            .expect("Failed to create config file")
            .write_all(b"{}")
            .expect("Failed to write config file");

        // Mock the bamboo_dir for testing
        let original_home = std::env::var_os("HOME");
        std::env::set_var("HOME", temp_dir.path());

        // Run migration
        migrate_session_files().expect("Migration failed");

        // Check that session files were moved
        let sessions_dir = bamboo_path.join("sessions");
        assert!(sessions_dir.exists());
        assert!(sessions_dir.join("session-1.json").exists());
        assert!(sessions_dir.join("session-1.jsonl").exists());

        // Check that config file was NOT moved
        assert!(bamboo_path.join("config.json").exists());
        assert!(!sessions_dir.join("config.json").exists());

        // Check that original files were removed
        assert!(!bamboo_path.join("session-1.json").exists());
        assert!(!bamboo_path.join("session-1.jsonl").exists());

        // Restore original HOME
        if let Some(home) = original_home {
            std::env::set_var("HOME", home);
        } else {
            std::env::remove_var("HOME");
        }
    }
}
