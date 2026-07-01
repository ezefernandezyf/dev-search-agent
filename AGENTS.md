# Context Bridge — Agent Context

> Slack AI agent that answers developer questions by searching Slack history (RTS API) and external documentation sources (MCP server). Built for the Slack Agent Builder Challenge 2026 — New Slack Agent track.

## Stack
- **Runtime**: Node.js 24 + TypeScript (strict mode, never `any`)
- **Slack Framework**: Bolt for JavaScript (Socket Mode for dev)
- **MCP Server**: Express + TypeScript (JSON-RPC 2.0 over HTTP)
- **Validation**: Zod (shared contracts in `shared/contracts/`)
- **Database**: PostgreSQL (prod) / SQLite (dev) + Prisma
- **AI**: OpenAI Agents SDK or Claude Agent SDK (TBD in design phase)
- **Testing**: Vitest (unit + integration)
- **Lint/Format**: ESLint 9 flat config + Prettier
- **Package Manager**: pnpm (workspace monorepo via `pnpm-workspace.yaml`)

## Architecture
- **Monorepo**: `slack-app/`, `mcp-server/`, `shared/` — each its own `package.json` with `"type": "module"`
- **Screaming Architecture**: business domains are top-level folders in `slack-app/src/` and `mcp-server/src/`
- **Slack Agent**: Bolt app listens for `app_mention` events, delegates to MCP server and/or RTS API
- **MCP Server**: exposes tools (`search_docs`, `get_npm_package`, `get_github_issue`, `search_slack`) via JSON-RPC 2.0
- **RTS API**: Slack's Real-Time Search API for semantic search across workspace history
- **API**: internal HTTP between Bolt agent and MCP server (same host, different port)

## Hackathon Requirements
- **Track**: New Slack Agent
- **Technology**: MCP server integration + Real-Time Search API (2 of 3)
- **Sandbox**: Developer sandbox with access for `slackhack@salesforce.com` and `testing@devpost.com`
- **Submission**: Text description, ~3min demo video, architecture diagram, sandbox URL
- **Deadline**: July 13, 2026 (5:00 pm PT)

## Judging Criteria (equally weighted)
1. **Technological Implementation** — Code quality, MCP + RTS API integration
2. **Design** — UX, frontend/backend balance, Block Kit UI
3. **Potential Impact** — Value for Slack developer communities
4. **Quality of the Idea** — Originality, improvement over existing solutions

## Conventions
- Conventional Commits: `feat(scope):`, `fix(scope):`, `chore:`, `docs:`, `test(scope):` — title in English, description in Spanish
- TypeScript: strict mode, never `any`, `as const` for string literals
- Never build after changes, never add "Co-Authored-By" to commits
- ESLint + Prettier run on every change: `pnpm run lint` / `pnpm run format`
- MCP tools: each tool is its own file in `mcp-server/src/tools/`, registered in a central index

## Git Workflow (STRICT)
1. **Feature branches**: EVERY task on a new branch from `main`
2. **Branch naming**: `feat/short-name`, `fix/short-name`, `chore/short-name`
3. **Atomic commits**: one logical change per commit, conventional format
4. **Push + PR + Merge**: push branch, create PR, merge to `main`
5. **Clean working tree**: no untracked files before PR
6. **Lint before push**: `pnpm run lint && pnpm run format` must pass
7. **Tests before merge**: `pnpm test` must pass

## How to Run
```bash
pnpm install              # installs all workspace deps
pnpm run dev:mcp          # terminal 1: MCP server on :4000
pnpm run dev:slack        # terminal 2: Slack agent (Socket Mode)
pnpm test                 # run all tests
pnpm run lint             # eslint
pnpm run format           # prettier
```

## Key Files (TBD — populated during design phase)
- `slack-app/src/app.ts` — Bolt entry point + event wiring
- `mcp-server/src/index.ts` — Express + JSON-RPC 2.0 handler
- `mcp-server/src/tools/` — MCP tool definitions
- `shared/contracts/` — Zod schemas shared between packages
- `manifest.json` — Slack app manifest (permissions, scopes)
- `.env` — `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, API keys

## Environment Variables
```bash
SLACK_BOT_TOKEN=xoxb-...       # From OAuth & Permissions
SLACK_APP_TOKEN=xapp-...       # App-Level Token (connections:write)
ANTHROPIC_API_KEY=sk-ant-...   # If using Claude SDK
OPENAI_API_KEY=sk-...          # If using OpenAI SDK
DATABASE_URL=postgresql://...  # Production DB
```

## Design Decisions (TBD)
- AI SDK: Claude vs OpenAI → decides tool execution model
- MCP transport: HTTP vs WebSocket → impacts latency and complexity
- RTS API integration: direct from agent vs via MCP tool → architectural tradeoff
