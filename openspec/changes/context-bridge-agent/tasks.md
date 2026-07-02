# Tasks: Context Bridge Agent

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 1200–1600 (20 core files + tests + config) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 → PR 4 |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Bootstrap + Contracts | PR 1 | Workspace, configs, Zod schemas, ESLint/Prettier |
| 2 | MCP Server | PR 2 | JSON-RPC dispatcher, 3 tool handlers, unit tests |
| 3 | Slack Agent Core | PR 3 | RTS client, synthesis engine, Block Kit builder, unit tests |
| 4 | Wiring + Integration | PR 4 | Bolt entry, app_mention handler, manifest, integration tests |

## Phase 1: Bootstrap & Contracts

- [x] 1.1 Create `pnpm-workspace.yaml` with 3 packages (`slack-app`, `mcp-server`, `shared`)
- [x] 1.2 Create `tsconfig.base.json` (strict, ESNext module, NodeNext resolution)
- [x] 1.3 Create `shared/package.json` (name: `@context-bridge/shared`, deps: zod) + `shared/tsconfig.json` (ref: base)
- [x] 1.4 RED: Write Vitest tests for `tools.ts` and `synthesis.ts` Zod schemas (assert valid/invalid shapes) — 41 tests passing
- [x] 1.5 GREEN: Implement `shared/contracts/tools.ts` (SearchDocsInput/Output, NpmPackageInput/Output, GithubIssueInput/Output, SlackSearchInput/Output)
- [x] 1.6 GREEN: Implement `shared/contracts/synthesis.ts` (SourceSection, SynthesisInput, SynthesisOutput)
- [x] 1.7 Create `mcp-server/package.json` (deps: express, cors, zod, @context-bridge/shared) + `mcp-server/tsconfig.json`
- [x] 1.8 Create `slack-app/package.json` (deps: @slack/bolt, @slack/web-api, zod, @context-bridge/shared) + `slack-app/tsconfig.json`
- [x] 1.9 Create ESLint 9 flat config + Prettier config at root; add `lint`/`format` scripts to each `package.json`

## Phase 2: MCP Server

- [x] 2.1 RED: Write test for JSON-RPC 2.0 dispatcher — stub HTTP POST to `/rpc`, assert `id`/`jsonrpc` in response
- [x] 2.2 GREEN: Implement `mcp-server/src/index.ts` — Express server on `:4000`, JSON-RPC 2.0 `POST /rpc` handler, tool router by `params.name`
- [x] 2.3 RED: Write failing test for `search_docs` handler — stub fetch to external docs, assert Zod output shape
- [x] 2.4 GREEN: Implement `mcp-server/src/tools/search-docs.ts` — fetch React/MDN docs, validate with `SearchDocsOutput`
- [x] 2.5 RED: Write failing test for `get_npm_package` — stub npm registry response, assert Zod output
- [x] 2.6 GREEN: Implement `mcp-server/src/tools/get-npm-package.ts` — npm registry lookup, parse with `NpmPackageOutput`
- [x] 2.7 RED: Write failing test for `get_github_issue` — stub GitHub API response, assert Zod output
- [x] 2.8 GREEN: Implement `mcp-server/src/tools/get-github-issue.ts` — GitHub issue search, parse with `GithubIssueOutput`

## Phase 3: Slack Agent Core

- [ ] 3.1 TDD: Implement `slack-app/src/rts/search.ts` — RTS API client wrapper (stub Slack SDK, test query → result transform)
- [ ] 3.2 RED: Write prompt-capture test for synthesis — assert Groq fetch is called with expected system prompt, validate output schema
- [ ] 3.3 GREEN: Implement `slack-app/src/synthesis/index.ts` — Groq API fetch + `SynthesisOutput` Zod validation, retry-once on 5xx
- [ ] 3.4 RED: Write Block Kit JSON assertion test — assert sections have correct emoji headers (📚💬🐙📦), permalinks, degradation markers
- [ ] 3.5 GREEN: Implement `slack-app/src/block-kit/response.ts` — `SynthesisOutput` → Block Kit JSON builder, anti-slop rules enforced

## Phase 4: Wiring & Integration

- [ ] 4.1 Implement `slack-app/src/app.ts` — Bolt entry (Socket Mode), import and wire `app_mention` handler
- [ ] 4.2 Implement `slack-app/src/events/app-mention.ts` — extract question → `Promise.allSettled` ([MCP:3tools, RTS:search]) → synthesize → `say()` Block Kit, 2.5s timeout per source
- [ ] 4.3 Create `manifest.json` — scopes (`app_mentions:read`, `chat:write`, `search:read`), Socket Mode enabled, event subscriptions
- [ ] 4.4 Create `.env.example` — SLACK_BOT_TOKEN, SLACK_APP_TOKEN, GROQ_API_KEY placeholders
- [ ] 4.5 RED: Write integration test — mock MCP server (json-rpc-2.0 stub) + mock RTS, assert full pipeline produces valid Block Kit with 4 sections
- [ ] 4.6 GREEN: Run integration test, fix any pipeline gaps
- [ ] 4.7 Final pass: `pnpm run lint && pnpm run format && pnpm tsc --noEmit && pnpm vitest run --coverage` (target ≥80%)
- [ ] 4.8 Demo validation: run against pre-seeded mock data for "How do we handle error boundaries in React?"
