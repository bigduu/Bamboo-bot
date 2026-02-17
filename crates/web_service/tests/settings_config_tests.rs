use actix_http::Request;
use actix_web::{
    dev::{Service, ServiceResponse},
    test, App, Error,
};
use agent_llm::{LLMChunk, LLMError, LLMProvider, LLMStream};
use async_trait::async_trait;
use chat_core::{Config, ProviderConfigs};
use futures_util::stream;
use serde_json::{json, Value};
use std::{
    ffi::OsString,
    sync::{Arc, Mutex, OnceLock},
};
use tokio::sync::RwLock;
use web_service::server::{app_config, AppState};

struct HomeGuard {
    previous: Option<OsString>,
}

impl HomeGuard {
    fn new(path: &std::path::Path) -> Self {
        let previous = std::env::var_os("HOME");
        std::env::set_var("HOME", path);
        Self { previous }
    }
}

impl Drop for HomeGuard {
    fn drop(&mut self) {
        match &self.previous {
            Some(value) => std::env::set_var("HOME", value),
            None => std::env::remove_var("HOME"),
        }
    }
}

fn home_lock() -> &'static Mutex<()> {
    static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| Mutex::new(()))
}

#[derive(Clone)]
struct MockProvider;

#[async_trait]
impl LLMProvider for MockProvider {
    async fn chat_stream(
        &self,
        _messages: &[agent_core::Message],
        _tools: &[agent_core::tools::ToolSchema],
        _max_output_tokens: Option<u32>,
        _model: Option<&str>,
    ) -> Result<LLMStream, LLMError> {
        let items = Vec::<LLMChunk>::new().into_iter().map(Ok);
        Ok(Box::pin(stream::iter(items)))
    }
}

async fn setup_test_environment() -> (
    impl Service<Request, Response = ServiceResponse, Error = Error>,
    tempfile::TempDir,
) {
    let temp_dir = tempfile::tempdir().expect("tempdir");

    let config = Config {
        provider: "copilot".to_string(),
        providers: ProviderConfigs::default(),
        http_proxy: String::new(),
        https_proxy: String::new(),
        proxy_auth: None,
        model: None,
        headless_auth: false,
    };

    let provider: Arc<dyn LLMProvider> = Arc::new(MockProvider);

    let app_state = actix_web::web::Data::new(AppState {
        app_data_dir: temp_dir.path().to_path_buf(),
        provider: Arc::new(RwLock::new(provider)),
        config: Arc::new(RwLock::new(config)),
        metrics_bus: None,
    });

    let app = test::init_service(App::new().app_data(app_state.clone()).configure(app_config)).await;
    (app, temp_dir)
}

#[actix_web::test]
async fn test_bamboo_config_strips_proxy_auth() {
    let _lock = home_lock().lock().unwrap();
    let temp_home = tempfile::TempDir::new().expect("tempdir");
    let _guard = HomeGuard::new(temp_home.path());

    let (app, _app_data_dir) = setup_test_environment().await;

    let payload = json!({
        "http_proxy": "http://proxy.example.com:8080",
        "https_proxy": "http://proxy.example.com:8080",
        "proxy_auth": { "username": "user", "password": "pass" },
        "model": "gpt-4",
        "headless_auth": false
    });

    let req = test::TestRequest::post()
        .uri("/v1/bamboo/config")
        .set_json(&payload)
        .to_request();
    let resp: Value = test::call_and_read_body_json(&app, req).await;

    // proxy_auth should be stripped from response
    assert!(
        resp.get("proxy_auth").is_none(),
        "proxy_auth should be stripped from POST response"
    );
    assert!(
        resp.get("proxy_auth_encrypted").is_none(),
        "proxy_auth_encrypted should not exist in POST response"
    );

    // Verify stored config exists and doesn't have plain proxy_auth
    let config_path = temp_home.path().join(".bamboo").join("config.json");
    assert!(
        config_path.exists(),
        "config.json should be created at {:?}",
        config_path
    );

    let content = std::fs::read_to_string(&config_path).expect("config.json");
    let stored: Value = serde_json::from_str(&content).expect("stored json");
    assert!(
        stored.get("proxy_auth").is_none(),
        "stored config should not have plain proxy_auth"
    );

    let req = test::TestRequest::get().uri("/v1/bamboo/config").to_request();
    let resp: Value = test::call_and_read_body_json(&app, req).await;
    // proxy_auth should still be stripped when reading
    assert!(
        resp.get("proxy_auth").is_none(),
        "GET response should not have proxy_auth"
    );
    assert!(
        resp.get("proxy_auth_encrypted").is_none(),
        "GET response should not have proxy_auth_encrypted"
    );
}

#[actix_web::test]
async fn test_proxy_auth_endpoint_updates_config() {
    let _lock = home_lock().lock().unwrap();
    let temp_home = tempfile::TempDir::new().expect("tempdir");
    let _guard = HomeGuard::new(temp_home.path());

    let (app, _app_data_dir) = setup_test_environment().await;

    let payload = json!({
        "username": "user",
        "password": "pass"
    });
    let req = test::TestRequest::post()
        .uri("/v1/bamboo/proxy-auth")
        .set_json(&payload)
        .to_request();
    let resp: Value = test::call_and_read_body_json(&app, req).await;
    assert_eq!(resp, json!({ "success": true }));

    let config_path = temp_home.path().join(".bamboo").join("config.json");
    let content = std::fs::read_to_string(&config_path).expect("config.json");
    let stored: Value = serde_json::from_str(&content).expect("stored json");
    assert!(
        stored.get("proxy_auth").is_none(),
        "stored config should not have plain proxy_auth"
    );
    assert!(
        stored
            .get("proxy_auth_encrypted")
            .and_then(|v| v.as_str())
            .is_some(),
        "stored config should contain proxy_auth_encrypted"
    );

    // Clearing auth should remove it.
    let payload = json!({
        "username": "",
        "password": ""
    });
    let req = test::TestRequest::post()
        .uri("/v1/bamboo/proxy-auth")
        .set_json(&payload)
        .to_request();
    let resp: Value = test::call_and_read_body_json(&app, req).await;
    assert_eq!(resp, json!({ "success": true }));

    let content = std::fs::read_to_string(&config_path).expect("config.json");
    let stored: Value = serde_json::from_str(&content).expect("stored json");
    assert!(
        stored.get("proxy_auth_encrypted").is_none(),
        "stored config should not contain proxy_auth_encrypted after clearing"
    );
}

