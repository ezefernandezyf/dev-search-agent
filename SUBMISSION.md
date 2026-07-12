# Context Bridge — Slack Agent for Developer Communities

**Track**: New Slack Agent
**Built for**: Slack Agent Builder Challenge 2026

---

## 🎯 The Problem

Developer communities on Slack face a constant stream of repetitive technical questions. The answers are scattered across **documentation, Slack history, GitHub issues, and npm packages** — forcing developers to manually search each source and mentally synthesize the results. This slows down knowledge-sharing and frustrates both the asker and potential responders.

## 💡 The Solution

Context Bridge is an AI-powered Slack agent that answers developer questions by **searching 4 sources in parallel** and **synthesizing a single structured response** — all from a single `@mention`.

What used to take 3-5 manual searches across different platforms now happens in ~3 seconds with one message.

---

## 🏗 Technical Implementation

### Architecture

Context Bridge follows a **clean monorepo architecture** with 3 packages:

| Package | Role |
|---------|------|
| `shared/` | Zod validation contracts shared across all services |
| `mcp-server/` | Express server exposing 3 MCP tools via JSON-RPC 2.0 |
| `slack-app/` | Bolt app handling `app_mention` events, orchestrating the pipeline |

### MCP Server (Model Context Protocol)

The server implements **3 MCP tools** registered in a central index:

- **`search_docs`** → Queries Stack Overflow for real programming Q&A results
- **`get_npm_package`** → Queries npm registry for package metadata and popularity
- **`get_github_issue`** → Queries GitHub Issues for relevant bug reports and discussions

Each tool validates input and output with Zod, ensuring type safety across the HTTP boundary.

### Real-Time Search API (RTS)

Direct integration with Slack's RTS API via `@slack/web-api` SDK — called independently from MCP so judges can verify both integrations. Shows **graceful degradation** when user tokens are unavailable, demonstrating resilience.

### AI Synthesis (Groq)

Uses **Groq API** (JSON mode) to synthesize results from all 4 sources into a coherent, well-cited answer. The system prompt enforces **anti-slop rules** to eliminate generic filler ("Here's what I found", "I hope this helps") and produce direct, technical responses.

### Block Kit UX

The response renders as structured **Slack Block Kit** with cognitive-load-first design:
1. **Synthesis** — the direct answer (no generic header)
2. **Source sections** — each with emoji signposting (📚💬🐙📦) and clickable "View source" buttons
3. **Degradation markers** — ⚠️ warnings for failed sources (transparency over silence)

### Resilience

- **`Promise.allSettled`** ensures a single source failure never blocks the full response
- **Retry-once on 5xx** errors for external APIs
- **2.5s timeout** per source via `AbortController`
- **Fallback to raw source data** if Groq synthesis fails
- **Graceful degradation** markers on all partial failures

---

## 🎨 Design Philosophy

The Block Kit layout follows **cognitive-load-first principles**:

1. **Synthesis-first**: The answer is the first thing the user sees — no preamble, no generic intro
2. **Scanable sections**: Each source has a distinct emoji + type label (📚💬🐙📦) for instant visual scanning
3. **Transparent degradation**: When a source fails, the user sees exactly which one and why — no silent omissions
4. **Actionable citations**: Every source includes clickable permalinks ("View source" buttons) so users can verify claims

---

## 📊 Impact for Slack Communities

Developer support channels on Slack suffer from the coordination tax of searching multiple knowledge sources. Context Bridge reduces this by:

1. **Cutting search time from minutes to seconds** — one query replaces 3-5 manual searches
2. **Preserving community knowledge** — Slack history contains invaluable past discussions that are hard to rediscover
3. **Encouraging help-seeking** — lowers the barrier to asking by providing immediate, structured answers
4. **Scaling support capacity** — reduces the burden on expert community members to answer repetitive questions

---

## 🔧 Testing & Quality

- **50 unit + integration tests** covering all MCP tools, synthesis pipeline, Block Kit builder, and full app flow
- **TypeScript strict mode** — no `any`, no exceptions
- **ESLint + Prettier** enforcing code quality
- **MCP tools independently testable** via Vitest with mocked HTTP responses
- **Integration tests verifying the full pipeline** from question to Block Kit output

---

## 🚀 How to Run

1. Clone: `git clone https://github.com/ezefernandezyf/dev-search-agent.git`
2. Install: `pnpm install`
3. Build: `pnpm run build`
4. Set env vars (see `.env.example`):
   - `SLACK_BOT_TOKEN` — Slack bot token (OAuth & Permissions)
   - `SLACK_APP_TOKEN` — Slack app token (`connections:write`)
   - `GROQ_API_KEY` — Groq API key
5. Start: `pnpm run start`
6. Install the app in your Slack workspace
7. `@Context Bridge How do we handle error boundaries in React?`

### Sandbox URL
https://dev-search-agent.onrender.com

### GitHub Repository
https://github.com/ezefernandezyf/dev-search-agent
