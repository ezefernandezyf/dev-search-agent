# Design: Context Bridge Agent

AI-powered Slack agent (Bolt + Groq API) that answers developer questions by searching 4 parallel sources and synthesizing results into a structured Block Kit response. Single-turn, stateless, Socket Mode for dev, demo-tuned for the "How do we handle error boundaries in React?" question.

## Data Flow

```
User @mention → Bolt (Socket Mode)
    │
    ├─▶ MCP Server (HTTP :4000)
    │    ├─ search_docs(query)
    │    ├─ get_npm_package(query)
    │    ├─ get_github_issue(query)
    │    └─ tools registered in central index
    │
    ├─▶ Slack RTS API (direct SDK call)
    │    └─ search workspace history
    │
    └─▶ Promise.allSettled — parallel fan-out
              │
              ▼
    Groq API synthesizes (fetch + prompt)
    (Zod validates structured output → SourceSection[])
              │
              ▼
    Block Kit builder → Bolt say()
              │
              ▼
    User sees: synthesis → 📚 Docs → 💬 Team History → 🐙 GitHub → 📦 npm
```

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **AI SDK** | Groq API (direct fetch) | Zero cost (free tier), same pattern as Nexus Talent. Single-turn agent doesn't need SDK tool dispatch — we already know to call all 4 sources in parallel. Groq's Llama/Mixtral models synthesize the combined results via prompt engineering. |
| **MCP Transport** | HTTP JSON-RPC 2.0 | Slack's own MCP reference uses HTTP. No state management. Parallelism meets demo latency needs — WebSocket adds complexity for zero judging value. |
| **RTS API** | Direct from Bolt agent | Judging requires demonstrating _both_ MCP and RTS API independently. Wrapping RTS as an MCP tool hides it. Direct call = cleaner demo narrative, fewer hops. |
| **Persistence** | None (stateless MVP) | No multi-turn, no memory. Prisma/PostgreSQL removed from MVP scope. The agent responds once per mention and forgets. Add post-MVP if needed. |
| **Block Kit UX** | Synthesis-first structure | Cognitive-load design: lead with the answer, then chunk sources below. Emoji signposting (📚💬🐙📦) enables scanning. No generic "Here's what I found" slop. |

### Groq Direct Integration Pattern

```
fetch("https://api.groq.com/openai/v1/chat/completions", {
  messages: [{
    role: "system",
    content: "You are a senior developer synthesizing information from 4 sources.
              Return structured JSON matching SourceSection[]."
  }, {
    role: "user",
    content: `Question: ${question}
              Sources: ${JSON.stringify(allSources)}`
  }],
  response_format: { type: "json_object" }  // Groq JSON mode
})
→ Zod validates SynthesisOutput
→ Block Kit builder renders sections
```

Same pattern as Nexus Talent: fetch + Zod validation + structured output. No SDK wrapper needed — the agent calls all 4 sources in parallel with `Promise.allSettled`, then sends the combined results to Groq for synthesis. Prompt engineering is the quality lever; the model (Llama 4/Mixtral on Groq) is capable enough for factual synthesis from provided sources.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `pnpm-workspace.yaml` | Create | 3 packages: `slack-app`, `mcp-server`, `shared` |
| `tsconfig.base.json` | Create | Shared strict TS config |
| `shared/package.json` | Create | Zod-only package (no runtime deps) |
| `shared/contracts/tools.ts` | Create | Zod schemas: all MCP tool I/O |
| `shared/contracts/synthesis.ts` | Create | Zod schemas: synthesis input/output |
| `mcp-server/package.json` | Create | Express, cors, zod |
| `mcp-server/tsconfig.json` | Create | Project ref to shared |
| `mcp-server/src/index.ts` | Create | Express + JSON-RPC 2.0 dispatcher |
| `mcp-server/src/tools/search-docs.ts` | Create | Fetches React/MDN docs |
| `mcp-server/src/tools/get-npm-package.ts` | Create | npm registry lookup |
| `mcp-server/src/tools/get-github-issue.ts` | Create | GitHub issue search |
| `slack-app/package.json` | Create | Bolt, slack-web-api, zod |
| `slack-app/tsconfig.json` | Create | Project ref to shared |
| `slack-app/src/app.ts` | Create | Bolt entry, event wiring |
| `slack-app/src/events/app-mention.ts` | Create | main handler: parallel dispatch → synthesize → respond |
| `slack-app/src/synthesis/index.ts` | Create | Groq API fetch + prompt + Zod validation |
| `slack-app/src/block-kit/response.ts` | Create | Block Kit JSON builder |
| `slack-app/src/rts/search.ts` | Create | RTS API client wrapper |
| `manifest.json` | Create | Slack app permissions + scopes |

## Interfaces / Contracts

```typescript
// shared/contracts/tools.ts
export const SearchDocsInput = z.object({ query: z.string().min(1) })
export const SearchDocsOutput = z.object({
  results: z.array(z.object({
    title: z.string(), url: z.string(), snippet: z.string(),
  })),
})

export const SynthesisInput = z.object({
  question: z.string(),
  sources: z.object({
    docs: z.array(DocResult),
    slack: z.array(SlackMessage),
    github: z.array(GithubIssue),
    npm: z.array(NpmPackage),
  }),
})

export const SourceSection = z.object({
  type: z.enum(['docs','slack','github','npm']),
  heading: z.string(),
  summary: z.string(),
  permalink: z.string().optional(),
  degraded: z.boolean().default(false),
})

export const SynthesisOutput = z.object({
  summary: z.string(),         // single comprehensive answer
  sections: z.array(SourceSection),
})
```

## Block Kit Structure

```
Section 0: Synthesis (the answer itself — no generic header)
━━━━━━━━━━━━━━━━━━━━━━━
📚 React Docs
  Error boundaries catch errors in lifecycle methods...
  <React docs →>

💬 Team History
  @juan asked about this in #frontend-discuss...
  <Jump to message →>

🐙 GitHub Issue #1234
  React 19 deprecates componentDidCatch...
  <View issue →>

📦 npm: react-error-boundary v4.0
  4.2k ⭐ — the standard community wrapper...
  <View package →>

━━━━━━━━━━━━━━━━━━━━━━━
⚠️ *GitHub Issues* — search timed out. Results unavailable for this source.
```

Anti-slop rules enforced in prompt + builder: no "Here's what I found", no "I hope this helps", no generic intros. The synthesis IS the header. Source emoji + type label are the only signposts. Citations are inline with clickable permalinks.

## Error Handling & Resilience

| Situation | Behavior |
|-----------|----------|
| Source times out (>2.5s) | Skipped with ⚠️ degradation marker |
| Source returns error | One retry immediately (no backoff), then ⚠️ |
| All 4 sources fail | Return: "Could not find information from any source." + suggestions |
| Synthesis itself fails | Return raw source results as structured Block Kit sections |
| Total wall-clock budget | 2.5s for sources (parallel), ~500ms for synthesis = ~3s total |

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | MCP tool handlers | Vitest: stub HTTP responses, assert Zod output |
| Unit | Block Kit builder | Vitest: assert JSON matches expected structure |
| Unit | Synthesis prompt | Vitest: capture prompt, validate section count |
| E2E | Full flow | Manual against Slack sandbox + demo question |

## Migration / Rollout

No migration (greenfield). Feature branch from `main`. Merge only after demo recording succeeds. Sandbox URL is always rollback-safe since last merged `main` is demo-ready.

## Open Questions

- [ ] Socket Mode availability in Slack sandbox — if unavailable, switch to HTTP events with ngrok
- [ ] RTS API token scopes — confirm `search:read` is sufficient for sandbox workspace
