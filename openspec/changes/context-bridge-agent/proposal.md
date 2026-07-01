# Proposal: Context Bridge Agent

## Intent

Slack AI agent that answers developer questions by synthesizing external docs (React docs, MDN), team Slack history (RTS API), GitHub issues, and npm packages into one coherent, well-cited Block Kit response. Built for the Slack Agent Builder Challenge 2026 — New Slack Agent track. Target: "How do we handle error boundaries in React?" demo. Single question → search 4 sources → structured answer. No multi-turn, no memory, no auth flow.

## Scope

### In Scope
- `app_mention` trigger with DM support
- MCP server: 4 tools (`search_docs`, `get_npm_package`, `get_github_issue`, `search_slack`)
- AI synthesis: parallel search → structured Block Kit response (📚 Docs, 💬 Team History, 🐙 GitHub, 📦 npm sections)
- Degradation: retry-once per source, warning markers on partial failures
- Demo scenario: mock dev team Slack with pre-seeded history

### Out of Scope
- Multi-turn conversations / follow-up questions
- Thread replies (responds in-channel)
- Conversation memory between messages
- User authentication flow (assumes Slack OAuth)
- Collapsible sections (nice-to-have, not MVP)

## Capabilities

### New Capabilities
- `mcp-tool-server`: MCP server exposing 4 search tools via JSON-RPC 2.0 over HTTP. Each tool is independently callable with Zod-validated contracts.
- `slack-agent`: Bolt app handling `app_mention` and DM events. Extracts question, delegates to MCP + RTS API, renders Block Kit response with source sections and clickable citations.
- `source-synthesis`: AI orchestration layer. Sends question to all 4 sources in parallel, combines results into one coherent answer. Retries once per failed source; includes ⚠️ warnings for unavailable sources. Quality of synthesis is the #1 evaluation criterion.

### Modified Capabilities
None (greenfield project).

## Approach

Direct integration: Bolt agent calls MCP server (HTTP) and RTS API (Slack SDK) directly — no extra proxy layer. AI SDK (OpenAI or Claude, deferred to design) handles tool dispatch and answer synthesis. Each MCP tool is a self-contained handler file registered in a central index. Block Kit response built from synthesis result with one section per source type, permalink citations, and source-type emojis.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `slack-app/src/` | New | Bolt entry point, event handlers, AI synthesis |
| `mcp-server/src/` | New | Express server, 4 tool handlers, JSON-RPC layer |
| `shared/contracts/` | New | Zod schemas for tool I/O and synthesis response |
| `manifest.json` | New | Slack app manifest (scopes, events) |
| `.env` | New | API keys, tokens, DB URL |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Synthesis quality is generic or imprecise | Medium | Thorough prompt engineering + demo scenario validation; iterate on prompt before recording demo |
| RTS API rate limits during demo | Low | Pre-seed Slack data; 1 QPS is sufficient for single-question flow |
| MCP + RTS latency exceeds Slack's 3s timeout | Low | Parallel searches; HTTP (not WebSocket) for MCP; retry-once ceiling |

## Rollback Plan

Revert via Slack app uninstall + `pnpm workspace` cleanup. Feature branch merge to `main` only after demo recording succeeds. Sandbox URL is the rollback-safe surface — last merged `main` is always demo-ready.

## Dependencies

- Slack Developer Sandbox (must invite `slackhack@salesforce.com` + `testing@devpost.com`)
- API keys: Slack Bot Token, Slack App Token, AI SDK key (OpenAI or Anthropic)
- PostgreSQL (prod) / SQLite (dev)

## Success Criteria

- [ ] Agent responds to `app_mention` within Slack's timeout with a Block Kit-formatted answer
- [ ] Demo question "How do we handle error boundaries in React?" returns sections from all 4 sources
- [ ] Partial source failure shows ⚠️ warning and still returns available results
- [ ] `pnpm test` passes with ≥80% coverage
- [ ] ~3min demo video recorded against sandbox
