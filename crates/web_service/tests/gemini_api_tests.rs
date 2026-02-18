use actix_http::Request;
use actix_web::{
    dev::{Service, ServiceResponse},
    test, web, App, Error,
};
use agent_llm::protocol::gemini::{
    GeminiContent, GeminiFunctionDeclaration, GeminiPart, GeminiRequest, GeminiResponse, GeminiTool,
};
use agent_llm::{LLMChunk, LLMError, LLMProvider, LLMStream};
use async_trait::async_trait;
use futures_util::stream;
use serde_json::json;
use std::sync::Arc;
use tokio::sync::{Mutex, RwLock};

use chat_core::{Config, ProviderConfigs};
use web_service::server::{app_config, AppState};

#[derive(Clone)]
struct MockProvider {
    chunks: Vec<LLMChunk>,
    seen_tools: Arc<Mutex<Vec<agent_core::tools::ToolSchema>>>,
}

#[async_trait]
impl LLMProvider for MockProvider {
    async fn chat_stream(
        &self,
        _messages: &[agent_core::Message],
        tools: &[agent_core::tools::ToolSchema],
        _max_output_tokens: Option<u32>,
        _model: &str,
    ) -> Result<LLMStream, LLMError> {
        *self.seen_tools.lock().await = tools.to_vec();
        let items = self.chunks.clone().into_iter().map(Ok);
        Ok(Box::pin(stream::iter(items)))
    }
}

async fn setup_test_environment(
    provider: Arc<dyn LLMProvider>,
) -> (
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

    let app_state = web::Data::new(AppState {
        app_data_dir: temp_dir.path().to_path_buf(),
        provider: Arc::new(RwLock::new(provider)),
        config: Arc::new(RwLock::new(config)),
        metrics_bus: None,
    });

    let app = test::init_service(App::new().app_data(app_state.clone()).configure(app_config)).await;

    (app, temp_dir)
}

fn build_tool_request() -> GeminiRequest {
    GeminiRequest {
        contents: vec![GeminiContent {
            role: "user".to_string(),
            parts: vec![GeminiPart {
                text: Some("Hello".to_string()),
                function_call: None,
                function_response: None,
            }],
        }],
        system_instruction: None,
        tools: Some(vec![GeminiTool {
            function_declarations: vec![GeminiFunctionDeclaration {
                name: "search".to_string(),
                description: Some("Search the web".to_string()),
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "q": { "type": "string" }
                    },
                    "required": ["q"]
                }),
            }],
        }]),
        generation_config: None,
    }
}

#[actix_web::test]
async fn test_gemini_generate_content_includes_tool_calls_and_passes_tools() {
    let seen_tools: Arc<Mutex<Vec<agent_core::tools::ToolSchema>>> =
        Arc::new(Mutex::new(Vec::new()));

    let provider: Arc<dyn LLMProvider> = Arc::new(MockProvider {
        chunks: vec![
            LLMChunk::Token("Let me search for that".to_string()),
            LLMChunk::ToolCalls(vec![agent_core::tools::ToolCall {
                id: "call_1".to_string(),
                tool_type: "function".to_string(),
                function: agent_core::tools::FunctionCall {
                    name: "search".to_string(),
                    arguments: r#"{"q":"test"}"#.to_string(),
                },
            }]),
            LLMChunk::Done,
        ],
        seen_tools: seen_tools.clone(),
    });

    let (app, _temp_dir) = setup_test_environment(provider).await;

    let req_body = build_tool_request();
    let req = test::TestRequest::post()
        .uri("/gemini/v1beta/models/gemini-pro:generateContent")
        .set_json(&req_body)
        .to_request();

    let resp: GeminiResponse = test::call_and_read_body_json(&app, req).await;

    // Tools should be converted and passed to the provider.
    let tools = seen_tools.lock().await.clone();
    assert_eq!(tools.len(), 1);
    assert_eq!(tools[0].function.name, "search");

    // Response should include both text and a function_call part.
    assert_eq!(resp.candidates.len(), 1);
    let candidate = &resp.candidates[0];
    assert_eq!(candidate.finish_reason.as_deref(), Some("STOP"));
    assert_eq!(candidate.content.role, "model");
    assert_eq!(candidate.content.parts.len(), 2);
    assert_eq!(
        candidate.content.parts[0].text.as_deref(),
        Some("Let me search for that")
    );

    let call_part = &candidate.content.parts[1];
    let function_call = call_part
        .function_call
        .as_ref()
        .expect("expected function_call part");
    assert_eq!(function_call.name, "search");
    assert_eq!(function_call.args, json!({"q":"test"}));
}

#[actix_web::test]
async fn test_gemini_stream_generate_content_emits_tool_call_parts() {
    let provider: Arc<dyn LLMProvider> = Arc::new(MockProvider {
        chunks: vec![
            LLMChunk::Token("Hello".to_string()),
            LLMChunk::ToolCalls(vec![agent_core::tools::ToolCall {
                id: "call_1".to_string(),
                tool_type: "function".to_string(),
                function: agent_core::tools::FunctionCall {
                    name: "search".to_string(),
                    arguments: r#"{"q":"test"}"#.to_string(),
                },
            }]),
            LLMChunk::Done,
        ],
        seen_tools: Arc::new(Mutex::new(Vec::new())),
    });

    let (app, _temp_dir) = setup_test_environment(provider).await;

    let req_body = build_tool_request();
    let req = test::TestRequest::post()
        .uri("/gemini/v1beta/models/gemini-pro:streamGenerateContent")
        .set_json(&req_body)
        .to_request();

    let res = test::call_service(&app, req).await;

    assert!(res.status().is_success());
    assert_eq!(res.headers().get("Content-Type").unwrap(), "text/event-stream");

    let body_bytes = test::read_body(res).await;
    let body_str = String::from_utf8(body_bytes.to_vec()).expect("utf8");

    let events: Vec<GeminiResponse> = body_str
        .split("\n\n")
        .filter_map(|event| event.trim().strip_prefix("data: "))
        .filter(|data| !data.trim().is_empty())
        .map(|data| serde_json::from_str(data).expect("json"))
        .collect();

    assert!(
        events.iter().any(|evt| {
            evt.candidates.iter().any(|c| {
                c.content.parts.iter().any(|p| {
                    p.function_call
                        .as_ref()
                        .map(|fc| fc.name == "search" && fc.args == json!({"q":"test"}))
                        .unwrap_or(false)
                })
            })
        }),
        "expected at least one stream event containing the tool function_call"
    );
}
