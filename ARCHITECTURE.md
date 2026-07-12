# Context Bridge — Architecture

## High-Level Flow

```mermaid
sequenceDiagram
    actor Developer
    participant Slack as Slack Workspace
    participant Bolt as Bolt App (Socket Mode)
    participant MCP as MCP Server (Express)
    participant SO as Stack Overflow API
    participant npm as npm Registry API
    participant GH as GitHub Issues API
    participant RTS as Slack RTS API
    participant Groq as Groq LLM API
    participant BlockKit as Block Kit Builder

    Developer->>Slack: @Context Bridge How do I...?
    Slack->>Bolt: app_mention event
    Bolt->>Bolt: extractQuestion()
    
    par Parallel fan-out (Promise.allSettled, 2.5s timeout)
        Bolt->>MCP: POST /rpc { name: "search_docs", query }
        MCP->>SO: fetch Stack Overflow
        SO-->>MCP: Question results
        MCP-->>Bolt: JSON-RPC response
        
        Bolt->>MCP: POST /rpc { name: "get_npm_package", query }
        MCP->>npm: fetch registry search
        npm-->>MCP: Package results
        MCP-->>Bolt: JSON-RPC response
        
        Bolt->>MCP: POST /rpc { name: "get_github_issue", query }
        MCP->>GH: fetch issue search
        GH-->>MCP: Issue results
        MCP-->>Bolt: JSON-RPC response
        
        Bolt->>RTS: client.search.messages(query)
        alt No user token
            RTS-->>Bolt: ⚠️ Degraded (graceful)
        else Available
            RTS-->>Bolt: Slack messages
        end
    end
    
    Bolt->>Bolt: collectSources(allSettled)
    Bolt->>Groq: POST /chat/completions { system+user prompt }
    Groq-->>Bolt: SynthesisOutput (JSON)
    Bolt->>BlockKit: buildBlockKitResponse(synthesis)
    BlockKit-->>Bolt: Slack blocks
    
    alt Groq fails
        Bolt->>BlockKit: buildFallbackResponse(raw sources)
        BlockKit-->>Bolt: Fallback blocks
    end
    
    Bolt-->>Slack: say(blocks)
    Slack-->>Developer: 📚💬🐙📦 Block Kit response
```

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Render (single host)                   │
│                                                          │
│  ┌──────────────────────┐    ┌──────────────────────┐    │
│  │    Slack App (Bolt)   │    │     MCP Server        │   │
│  │  ┌────────────────┐   │    │  ┌────────────────┐   │   │
│  │  │ app-mention.ts │   │    │  │  search-docs   │   │   │
│  │  │ (orquestrador) │───┼────┼─▶│ get-npm-package│   │   │
│  │  │                │   │    │  │ get-github-issue│  │   │
│  │  │ synthesis/     │   │    │  └────────────────┘   │   │
│  │  │ block-kit/     │   │    └──────────────────────┘   │   │
│  │  │ rts/           │   │          :4000/$PORT         │   │
│  │  └────────────────┘   │                              │
│  │   Socket Mode :3000   │                              │
│  └──────────────────────┘                               │
└─────────────────────────────────────────────────────────┘
```

## Data Contracts (Zod)

```
shared/contracts/
├── tools.ts          DocResult | NpmPackageResult | GithubIssueResult | SlackMessageResult
└── synthesis.ts      SynthesisInput { question, sources } → SynthesisOutput { summary, sections[] }
```

## Degradation Strategy

| Source failure | Behavior |
|---------------|----------|
| Stack Overflow timeout | ⚠️ Documentation — No data available |
| Slack RTS unavailable | ⚠️ Slack — No data available (requires user token) |
| GitHub rate limited | ⚠️ GitHub — No data available |
| npm API error | ⚠️ npm — No data available |
| All 4 sources fail | "Could not find information from any source" |
| Groq synthesis fails | Show raw source results with "View source" buttons |

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 24 + TypeScript (strict) |
| Monorepo | pnpm workspaces (3 packages) |
| Slack Framework | Bolt for JavaScript (Socket Mode) |
| MCP Server | Express 5 + JSON-RPC 2.0 |
| Validation | Zod (shared contracts) |
| AI Synthesis | Groq API (Llama 3.1, JSON mode) |
| Testing | Vitest (50 tests) |
| Deployment | Render + UptimeRobot |
