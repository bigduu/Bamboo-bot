use actix_http::Request;
use actix_web::{
    dev::{Service, ServiceResponse},
    test, web, App, Error,
};
use agent_llm::{LLMChunk, LLMError, LLMProvider, LLMStream};
use async_trait::async_trait;
use futures_util::stream;
use serde_json::{json, Value};
use std::sync::Arc;
use tokio::sync::RwLock;

use agent_server::state::AppState as AgentAppState;
use chat_core::{Config, ProviderConfigs};
use web_service::server::{app_config, AppState};

#[derive(Clone)]
struct MockProvider {
    models: Vec<String>,
    chunks: Vec<LLMChunk>,
}

#[async_trait]
impl LLMProvider for MockProvider {
    async fn chat_stream(
        &self,
        _messages: &[agent_core::Message],
        _tools: &[agent_core::tools::ToolSchema],
        _max_output_tokens: Option<u32>,
        _model: Option<&str>,
    ) -> Result<LLMStream, LLMError> {
        let items = self.chunks.clone().into_iter().map(Ok);
        Ok(Box::pin(stream::iter(items)))
    }

    async fn list_models(&self) -> Result<Vec<String>, LLMError> {
        Ok(self.models.clone())
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

    // The Anthropic controller handler requires AgentAppState extraction.
    let agent_state = web::Data::new(
        AgentAppState::new_with_config(
            "openai",
            "http://127.0.0.1:0/v1".to_string(),
            "gpt-4o-mini".to_string(),
            "sk-test".to_string(),
            Some(temp_dir.path().to_path_buf()),
            true,
        )
        .await,
    );

    let app = test::init_service(
        App::new()
            .app_data(app_state.clone())
            .app_data(agent_state.clone())
            .configure(app_config),
    )
    .await;
    (app, temp_dir)
}

#[actix_web::test]
async fn test_messages_non_streaming() {
    let provider: Arc<dyn LLMProvider> = Arc::new(MockProvider {
        models: vec![],
        chunks: vec![LLMChunk::Token("Hello there".to_string()), LLMChunk::Done],
    });
    let (app, _temp_dir) = setup_test_environment(provider).await;

    let req_body = json!({
        "model": "gpt-4",
        "max_tokens": 10,
        "messages": [
            {"role": "user", "content": "Hello"}
        ]
    });

    let req = test::TestRequest::post()
        .uri("/anthropic/v1/messages")
        .set_json(&req_body)
        .to_request();

    let resp: Value = test::call_and_read_body_json(&app, req).await;

    assert_eq!(resp["type"], "message");
    assert_eq!(resp["role"], "assistant");
    assert!(resp["id"].as_str().unwrap_or_default().starts_with("chatcmpl-"));
    assert_eq!(resp["model"], "gpt-4");
    assert_eq!(resp["stop_reason"], "end_turn");
    assert_eq!(resp["usage"]["input_tokens"], 0);
    assert_eq!(resp["usage"]["output_tokens"], 0);
    assert_eq!(resp["content"][0]["type"], "text");
    assert_eq!(resp["content"][0]["text"], "Hello there");
}

#[actix_web::test]
async fn test_messages_missing_mapping_falls_back() {
    let provider: Arc<dyn LLMProvider> = Arc::new(MockProvider {
        models: vec![],
        chunks: vec![LLMChunk::Token("Fallback response".to_string()), LLMChunk::Done],
    });
    let (app, _temp_dir) = setup_test_environment(provider).await;

    let req_body = json!({
        "model": "claude-3-5-sonnet",
        "max_tokens": 10,
        "messages": [
            {"role": "user", "content": "Hello"}
        ]
    });

    let req = test::TestRequest::post()
        .uri("/anthropic/v1/messages")
        .set_json(&req_body)
        .to_request();

    let resp: Value = test::call_and_read_body_json(&app, req).await;
    assert_eq!(resp["type"], "message");
    assert_eq!(resp["model"], "claude-3-5-sonnet");
    assert_eq!(resp["content"][0]["text"], "Fallback response");
}

#[actix_web::test]
async fn test_messages_reasoning_is_accepted() {
    let provider: Arc<dyn LLMProvider> = Arc::new(MockProvider {
        models: vec![],
        chunks: vec![LLMChunk::Token("OK".to_string()), LLMChunk::Done],
    });
    let (app, _temp_dir) = setup_test_environment(provider).await;

    // The Anthropic controller accepts a `reasoning` field and currently treats it as an extra
    // parameter (for future forwarding); this test ensures the request succeeds.
    let req_body = json!({
        "model": "claude-3-5-sonnet",
        "max_tokens": 10,
        "reasoning": "mid",
        "messages": [
            {"role": "user", "content": "Hello"}
        ]
    });

    let req = test::TestRequest::post()
        .uri("/anthropic/v1/messages")
        .set_json(&req_body)
        .to_request();

    let resp: Value = test::call_and_read_body_json(&app, req).await;
    assert_eq!(resp["type"], "message");
    assert_eq!(resp["content"][0]["text"], "OK");
}

#[actix_web::test]
async fn test_messages_streaming() {
    let provider: Arc<dyn LLMProvider> = Arc::new(MockProvider {
        models: vec![],
        chunks: vec![
            LLMChunk::Token("Hello".to_string()),
            LLMChunk::Token(" there!".to_string()),
            LLMChunk::Done,
        ],
    });
    let (app, _temp_dir) = setup_test_environment(provider).await;

    let req_body = json!({
        "model": "gpt-4",
        "max_tokens": 10,
        "stream": true,
        "messages": [
            {"role": "user", "content": "Hello"}
        ]
    });

    let req = test::TestRequest::post()
        .uri("/anthropic/v1/messages")
        .set_json(&req_body)
        .to_request();

    let res = test::call_service(&app, req).await;
    assert!(res.status().is_success());
    assert_eq!(
        res.headers().get("Content-Type").unwrap(),
        "text/event-stream"
    );

    let body_bytes = test::read_body(res).await;
    let body_str = String::from_utf8(body_bytes.to_vec()).unwrap();

    let events = parse_sse_events(&body_str);
    let event_names: Vec<String> = events.iter().map(|(name, _)| name.clone()).collect();

    assert_eq!(
        event_names,
        vec![
            "message_start",
            "content_block_start",
            "content_block_delta",
            "content_block_delta",
            "content_block_stop",
            "message_delta",
            "message_stop",
        ]
    );

    let message_start = &events[0].1;
    assert_eq!(message_start["message"]["role"], "assistant");
    assert_eq!(message_start["message"]["type"], "message");

    let text_delta = &events[2].1;
    assert_eq!(text_delta["delta"]["type"], "text_delta");
    assert_eq!(text_delta["delta"]["text"], "Hello");

    let stop_delta = &events[5].1;
    assert_eq!(stop_delta["delta"]["stop_reason"], "end_turn");

    assert!(body_str.contains("data: [DONE]"));
}

#[actix_web::test]
async fn test_messages_streaming_tool_use() {
    let tool_call = agent_core::tools::ToolCall {
        id: "tool_call_1".to_string(),
        tool_type: "function".to_string(),
        function: agent_core::tools::FunctionCall {
            name: "search".to_string(),
            arguments: "{\"query\":\"hello\"}".to_string(),
        },
    };

    let provider: Arc<dyn LLMProvider> = Arc::new(MockProvider {
        models: vec![],
        chunks: vec![LLMChunk::ToolCalls(vec![tool_call]), LLMChunk::Done],
    });
    let (app, _temp_dir) = setup_test_environment(provider).await;

    let req_body = json!({
        "model": "gpt-4",
        "max_tokens": 10,
        "stream": true,
        "messages": [
            {"role": "user", "content": "Use a tool"}
        ]
    });

    let req = test::TestRequest::post()
        .uri("/anthropic/v1/messages")
        .set_json(&req_body)
        .to_request();

    let res = test::call_service(&app, req).await;
    assert!(res.status().is_success());

    let body_bytes = test::read_body(res).await;
    let body_str = String::from_utf8(body_bytes.to_vec()).unwrap();

    let events = parse_sse_events(&body_str);
    let has_tool_start = events.iter().any(|(name, data)| {
        name == "content_block_start"
            && data["content_block"]["type"] == "tool_use"
            && data["content_block"]["name"] == "search"
            && data["content_block"]["id"] == "tool_call_1"
    });
    assert!(has_tool_start);

    let has_tool_delta = events.iter().any(|(name, data)| {
        name == "content_block_delta"
            && data["delta"]["type"] == "input_json_delta"
            && data["delta"]["partial_json"] == "{\"query\":\"hello\"}"
    });
    assert!(has_tool_delta);

    let has_tool_stop = events
        .iter()
        .any(|(name, data)| name == "content_block_stop" && data["index"].is_number());
    assert!(has_tool_stop);

    assert!(events.iter().any(|(name, _)| name == "message_delta"));
    assert!(body_str.contains("data: [DONE]"));
}

#[actix_web::test]
async fn test_messages_streaming_text_and_tool_use() {
    let tool_call = agent_core::tools::ToolCall {
        id: "tool_call_2".to_string(),
        tool_type: "function".to_string(),
        function: agent_core::tools::FunctionCall {
            name: "lookup".to_string(),
            arguments: "{\"id\":42}".to_string(),
        },
    };

    let provider: Arc<dyn LLMProvider> = Arc::new(MockProvider {
        models: vec![],
        chunks: vec![
            LLMChunk::Token("Starting".to_string()),
            LLMChunk::ToolCalls(vec![tool_call]),
            LLMChunk::Token(" done".to_string()),
            LLMChunk::Done,
        ],
    });
    let (app, _temp_dir) = setup_test_environment(provider).await;

    let req_body = json!({
        "model": "gpt-4",
        "max_tokens": 10,
        "stream": true,
        "messages": [
            {"role": "user", "content": "Mix text and tool"}
        ]
    });

    let req = test::TestRequest::post()
        .uri("/anthropic/v1/messages")
        .set_json(&req_body)
        .to_request();

    let res = test::call_service(&app, req).await;
    assert!(res.status().is_success());

    let body_bytes = test::read_body(res).await;
    let body_str = String::from_utf8(body_bytes.to_vec()).unwrap();

    let events = parse_sse_events(&body_str);
    let text_delta_count = events
        .iter()
        .filter(|(name, data)| name == "content_block_delta" && data["delta"]["type"] == "text_delta")
        .count();
    assert!(text_delta_count >= 1);

    let has_tool_use = events.iter().any(|(name, data)| {
        name == "content_block_start"
            && data["content_block"]["type"] == "tool_use"
            && data["content_block"]["name"] == "lookup"
    });
    assert!(has_tool_use);

    let has_tool_delta = events.iter().any(|(name, data)| {
        name == "content_block_delta"
            && data["delta"]["type"] == "input_json_delta"
            && data["delta"]["partial_json"] == "{\"id\":42}"
    });
    assert!(has_tool_delta);

    assert!(events.iter().any(|(name, _)| name == "message_stop"));
    assert!(body_str.contains("data: [DONE]"));
}

#[actix_web::test]
async fn test_complete_non_streaming() {
    let provider: Arc<dyn LLMProvider> = Arc::new(MockProvider {
        models: vec![],
        chunks: vec![LLMChunk::Token("Legacy response".to_string()), LLMChunk::Done],
    });
    let (app, _temp_dir) = setup_test_environment(provider).await;

    let req_body = json!({
        "model": "gpt-4",
        "prompt": "Hello",
        "max_tokens_to_sample": 10
    });

    let req = test::TestRequest::post()
        .uri("/anthropic/v1/complete")
        .set_json(&req_body)
        .to_request();

    let resp: Value = test::call_and_read_body_json(&app, req).await;

    let expected = json!({
        "type": "completion",
        "completion": "Legacy response",
        "model": "gpt-4",
        "stop_reason": "stop_sequence"
    });

    assert_eq!(resp, expected);
}

#[actix_web::test]
async fn test_complete_streaming() {
    let provider: Arc<dyn LLMProvider> = Arc::new(MockProvider {
        models: vec![],
        chunks: vec![
            LLMChunk::Token("Legacy".to_string()),
            LLMChunk::Token(" response".to_string()),
            LLMChunk::Done,
        ],
    });
    let (app, _temp_dir) = setup_test_environment(provider).await;

    let req_body = json!({
        "model": "gpt-4",
        "prompt": "Hello",
        "max_tokens_to_sample": 10,
        "stream": true
    });

    let req = test::TestRequest::post()
        .uri("/anthropic/v1/complete")
        .set_json(&req_body)
        .to_request();

    let res = test::call_service(&app, req).await;
    assert!(res.status().is_success());

    let body_bytes = test::read_body(res).await;
    let body_str = String::from_utf8(body_bytes.to_vec()).unwrap();

    let chunks = parse_sse_data(&body_str);
    assert!(chunks.iter().any(|chunk| chunk["completion"] == "Legacy"));
    assert!(chunks.iter().any(|chunk| chunk["completion"] == " response"));
    assert!(chunks
        .iter()
        .any(|chunk| chunk["stop_reason"] == "stop_sequence"));
    assert!(body_str.contains("data: [DONE]"));
}

#[actix_web::test]
async fn test_get_models() {
    let provider: Arc<dyn LLMProvider> = Arc::new(MockProvider {
        models: vec!["gpt-4".to_string(), "gpt-3.5-turbo".to_string()],
        chunks: vec![],
    });
    let (app, _temp_dir) = setup_test_environment(provider).await;

    let req = test::TestRequest::get().uri("/anthropic/v1/models").to_request();
    let resp: Value = test::call_and_read_body_json(&app, req).await;

    // Verify response structure matches Anthropic format
    assert!(resp["data"].is_array());
    assert_eq!(resp["has_more"], false);
    assert!(resp["first_id"].is_string());
    assert!(resp["last_id"].is_string());

    let models = resp["data"].as_array().unwrap();
    assert!(!models.is_empty());

    for model in models {
        assert_eq!(model["type"], "model");
        assert!(model["id"].is_string());
        assert!(model["display_name"].is_string());
        assert!(model["created_at"].is_string());
    }

    let model_ids: Vec<String> = models
        .iter()
        .map(|m| m["id"].as_str().unwrap().to_string())
        .collect();
    assert!(model_ids.contains(&"gpt-4".to_string()));
    assert!(model_ids.contains(&"gpt-3.5-turbo".to_string()));
}

fn parse_sse_events(body: &str) -> Vec<(String, Value)> {
    let mut events = Vec::new();

    for raw in body.trim().split("\n\n") {
        if raw.trim().is_empty() {
            continue;
        }
        if raw.trim() == "data: [DONE]" {
            continue;
        }

        let mut event_name = None;
        let mut data = None;

        for line in raw.lines() {
            if let Some(name) = line.strip_prefix("event: ") {
                event_name = Some(name.to_string());
            } else if let Some(value) = line.strip_prefix("data: ") {
                data = Some(serde_json::from_str::<Value>(value).unwrap());
            }
        }

        if let (Some(name), Some(data)) = (event_name, data) {
            events.push((name, data));
        }
    }

    events
}

fn parse_sse_data(body: &str) -> Vec<Value> {
    let mut events = Vec::new();

    for raw in body.trim().split("\n\n") {
        if raw.trim().is_empty() {
            continue;
        }
        if raw.trim() == "data: [DONE]" {
            continue;
        }

        for line in raw.lines() {
            if let Some(value) = line.strip_prefix("data: ") {
                events.push(serde_json::from_str::<Value>(value).unwrap());
            }
        }
    }

    events
}

