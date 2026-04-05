# Zenith 架构流程图

## 1. 整体架构流程

```mermaid
graph TB
    subgraph "用户层"
        U[👤 用户]
    end
    
    subgraph "前端应用层"
        L[Lotus Web UI<br/>React + TypeScript]
        B[Bodhi Desktop<br/>Tauri Shell]
        P[Pavilion<br/>文档站点]
    end
    
    subgraph "服务层"
        AS[AgentService<br/>执行代理]
        SS[SkillService<br/>技能管理]
        TS[ToolService<br/>工具执行]
        MS[McpService<br/>MCP管理]
        WS[WorkspaceService<br/>工作区]
    end
    
    subgraph "API网关层"
        API[统一 API Client<br/>错误处理 + 认证]
    end
    
    subgraph "后端服务层 Bamboo"
        subgraph "核心路由 /api/v1/*"
            CH[Chat Handler]
            EX[Execute Handler]
            EV[Events SSE]
            SE[Sessions]
            SC[Schedules]
        end
        
        subgraph "配置路由 /v1/*"
            CFG[Config]
            PR[Provider]
            MCP[MCP Servers]
            WK[Workspace]
        end
        
        subgraph "提供商转发"
            OAI[/openai/v1/*]
            ANT[/anthropic/v1/*]
            GEM[/gemini/v1/*]
        end
    end
    
    subgraph "数据层"
        DB[(SQLite<br/>会话存储)]
        FS[文件系统<br/>工作区]
    end
    
    subgraph "外部服务"
        LLM[LLM 提供商<br/>OpenAI/Anthropic/Gemini]
        MCPS[MCP Servers<br/>外部工具]
    end
    
    U -->|访问| L
    U -->|桌面应用| B
    B -.->|嵌入| L
    U -->|查看文档| P
    
    L --> AS
    L --> SS
    L --> TS
    L --> MS
    L --> WS
    
    AS --> API
    SS --> API
    TS --> API
    MS --> API
    WS --> API
    
    API -->|POST /api/v1/chat| CH
    API -->|POST /api/v1/execute| EX
    API -->|GET /api/v1/events| EV
    API -->|CRUD /api/v1/sessions| SE
    API -->|CRUD /api/v1/schedules| SC
    
    API -->|GET/POST /v1/bamboo/config| CFG
    API -->|GET/POST /v1/bamboo/provider| PR
    API -->|CRUD /api/v1/mcp/*| MCP
    API -->|POST /v1/workspace/*| WK
    
    EX -->|流式调用| OAI
    EX -->|流式调用| ANT
    EX -->|流式调用| GEM
    
    OAI --> LLM
    ANT --> LLM
    GEM --> LLM
    
    CH --> DB
    EX --> DB
    SE --> DB
    SC --> DB
    
    MCP --> MCPS
    WK --> FS
    
    EV -.->|SSE 实时推送| AS
    
    style U fill:#e1f5ff
    style L fill:#fff4e1
    style B fill:#fff4e1
    style API fill:#ffe1f5
    style CH fill:#e1ffe1
    style EX fill:#e1ffe1
    style LLM fill:#ffe1e1
```

## 2. 核心聊天执行流程

```mermaid
sequenceDiagram
    autonumber
    participant User as 👤 用户
    participant Chat as ChatPage<br/>前端组件
    participant AS as AgentService<br/>服务层
    participant API as API Client<br/>HTTP 客户端
    participant Exec as /execute<br/>后端路由
    participant Handler as Execute<br/>Handler
    participant SSE as /events<br/>SSE 流
    participant LLM as LLM<br/>提供商
    participant DB as SQLite<br/>数据库
    
    User->>Chat: 输入消息并发送
    Chat->>AS: executeAgent(sessionId, prompt)
    AS->>API: POST /api/v1/execute/{sessionId}
    API->>Exec: HTTP 请求
    Exec->>Handler: 路由到处理器
    
    Handler->>DB: 创建/更新会话
    DB-->>Handler: 会话已保存
    
    Handler->>LLM: 流式补全请求
    LLM-->>Handler: 流式返回 tokens
    
    Handler->>DB: 保存消息历史
    
    par 实时事件推送
        Handler->>SSE: 推送事件到 SSE 队列
        SSE-->>API: Server-Sent Events
        API-->>AS: EventSource 消息
        AS-->>Chat: 更新状态
        Chat-->>User: 渲染响应
    end
    
    Handler-->>Exec: 执行完成
    Exec-->>API: HTTP 200 OK
    API-->>AS: Promise resolved
    AS-->>Chat: 执行完成
    Chat-->>User: 显示完成状态
```

## 3. 会话管理流程

```mermaid
stateDiagram-v2
    [*] --> 创建会话: 用户开始新对话
    
    创建会话 --> 活跃: POST /api/v1/sessions
    
    活跃 --> 执行中: POST /api/v1/execute
    
    执行中 --> 等待输入: Agent 请求用户确认
    等待输入 --> 执行中: POST /api/v1/respond
    
    执行中 --> 活跃: 执行完成
    
    活跃 --> 暂停: 用户暂停
    暂停 --> 活跃: 用户恢复
    
    活跃 --> 清空: POST /sessions/{id}/clear
    清空 --> 活跃: 继续使用
    
    活跃 --> 已删除: DELETE /api/v1/sessions/{id}
    执行中 --> 已删除: DELETE /api/v1/sessions/{id}
    
    已删除 --> [*]
    
    note right of 活跃
        会话状态保存在:
        - SQLite 数据库
        - Zustand Store
    end note
    
    note right of 执行中
        实时更新通过:
        - SSE /api/v1/events
        - EventSource
    end note
```

## 4. MCP 服务器集成流程

```mermaid
graph LR
    subgraph "用户操作"
        A[点击添加 MCP 服务器]
    end
    
    subgraph "前端处理"
        B[McpService.addServer]
        C[验证配置]
    end
    
    subgraph "后端处理"
        D[POST /api/v1/mcp/servers]
        E[保存到配置]
        F[启动 MCP 进程]
        G[协议握手]
    end
    
    subgraph "MCP 服务器"
        H[外部工具服务器]
        I[返回工具列表]
    end
    
    subgraph "结果展示"
        J[显示已连接]
        K[列出可用工具]
        L[用户可调用工具]
    end
    
    A --> B
    B --> C
    C --> D
    D --> E
    E --> F
    F --> G
    G --> H
    H --> I
    I --> D
    D --> J
    J --> K
    K --> L
    
    style A fill:#e1f5ff
    style D fill:#ffe1f5
    style H fill:#e1ffe1
    style J fill:#fff4e1
```

## 5. 认证流程

```mermaid
sequenceDiagram
    autonumber
    participant User as 👤 用户
    participant FE as 前端设置页
    participant API as Bamboo API
    participant OAuth as GitHub OAuth
    participant Config as 配置文件
    
    alt Copilot 认证
        User->>FE: 点击登录 Copilot
        FE->>API: POST /v1/bamboo/copilot/auth/start
        API->>OAuth: 生成 OAuth URL
        OAuth-->>API: 返回授权 URL
        API-->>FE: 返回授权链接
        FE->>User: 打开浏览器授权
        User->>OAuth: GitHub 授权
        OAuth-->>User: 回调码
        User->>FE: 输入回调码
        FE->>API: POST /v1/bamboo/copilot/auth/complete
        API->>OAuth: 交换 token
        OAuth-->>API: 返回 access token
        API->>Config: 加密存储 token
        API-->>FE: 认证成功
        FE-->>User: 显示已认证
    else API Key 认证
        User->>FE: 输入 API Key
        FE->>API: POST /v1/bamboo/settings/provider
        API->>Config: 加密存储 key
        API->>FE: 配置已保存
        FE-->>User: 显示已配置
    end
    
    Note over API,Config: 所有敏感信息都经过<br/>AES-GCM 加密后存储
```

## 6. 错误处理流程

```mermaid
graph TD
    A[API 请求] --> B{请求成功?}
    
    B -->|是| C[解析响应]
    C --> D[返回数据]
    
    B -->|否| E[捕获错误]
    
    E --> F{错误类型?}
    
    F -->|网络错误| G[Network Error]
    F -->|HTTP 4xx| H[Client Error]
    F -->|HTTP 5xx| I[Server Error]
    F -->|超时| J[Timeout Error]
    
    G --> K[ApiError<br/>status=0]
    H --> L[ApiError<br/>status=4xx]
    I --> M[ApiError<br/>status=5xx]
    J --> N[ApiError<br/>status=408]
    
    K --> O[显示错误提示<br/>检查网络连接]
    L --> P{解析错误详情}
    
    P -->|有 JSON body| Q[提取 error.message]
    P -->|无 body| R[使用 statusText]
    
    Q --> S[ApiError with details]
    R --> S
    
    S --> T[显示具体错误信息]
    M --> U[显示服务器错误<br/>建议稍后重试]
    N --> V[显示超时提示<br/>建议重试]
    
    T --> W[记录到日志]
    U --> W
    V --> W
    O --> W
    
    W --> X[错误处理完成]
    
    style A fill:#e1f5ff
    style D fill:#e1ffe1
    style E fill:#ffe1e1
    style W fill:#fff4e1
```

## 7. 定时任务调度流程

```mermaid
sequenceDiagram
    autonumber
    participant User as 👤 用户
    participant FE as 前端界面
    participant API as Bamboo API
    participant Store as Schedule Store
    participant Runner as Task Runner
    participant Agent as Agent Executor
    
    User->>FE: 创建定时任务
    FE->>API: POST /api/v1/schedules
    API->>Store: 保存调度配置
    Store-->>API: 调度 ID
    API-->>FE: 创建成功
    FE-->>User: 显示任务列表
    
    loop 每分钟检查
        Runner->>Store: 查询到期任务
        Store-->>Runner: 返回任务列表
        
        alt 有到期任务
            Runner->>Agent: 执行任务
            Agent-->>Runner: 执行结果
            Runner->>Store: 更新任务状态
            Runner->>API: 发送通知
            API-->>FE: 实时更新 UI
        end
    end
    
    User->>FE: 查看任务历史
    FE->>API: GET /api/v1/schedules/{id}/sessions
    API->>Store: 查询执行历史
    Store-->>API: 返回历史记录
    API-->>FE: 显示执行历史
    FE-->>User: 渲染历史列表
```

---

**生成时间**: 2026-03-18  
**工具**: frontend-backend-analyzer skill  
**项目**: Zenith Monorepo
