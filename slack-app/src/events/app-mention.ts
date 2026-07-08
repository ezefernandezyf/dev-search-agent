import { z } from 'zod';
import { WebClient } from '@slack/web-api';
import { synthesize } from '../synthesis/index.js';
import { buildBlockKitResponse } from '../block-kit/response.js';
import { searchSlackHistory } from '../rts/search.js';
import { SynthesisInput } from '@context-bridge/shared/contracts/synthesis';
import type { SlackBlockKitMessage } from '../block-kit/response.js';

type SynthesisInputType = z.infer<typeof SynthesisInput>;

const MCP_PORT = process.env['PORT'] ?? '4000';
const MCP_ENDPOINT = `http://localhost:${MCP_PORT}/rpc`;
const TIMEOUT_MS = 2500;

/** Strips the bot mention tag (e.g. `<@U12345>`) from the start of text. */
function extractQuestion(text: string): string {
  return text.replace(/<@[A-Z0-9]+>/g, '').trim();
}

interface McpToolResult {
  data: unknown[];
  degraded: boolean;
}

/**
 * Calls a single MCP tool via HTTP JSON-RPC 2.0.
 * Throws on network/HTTP errors — caller handles fallback.
 */
async function callMcpTool(
  toolName: string,
  query: string,
  signal: AbortSignal,
): Promise<unknown[]> {
  const response = await fetch(MCP_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: toolName, arguments: { query } },
      id: 1,
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`MCP ${toolName} returned ${response.status}`);
  }

  const jsonRpcResponse = (await response.json()) as {
    result?: { content?: Array<{ type: string; text: string }> };
    error?: { message: string };
  };

  if (jsonRpcResponse.error) {
    throw new Error(`MCP ${toolName} error: ${jsonRpcResponse.error.message}`);
  }

  const content = jsonRpcResponse.result?.content;
  if (!content || content.length === 0) {
    return [];
  }

  const text = content[0]?.text;
  if (!text) {
    return [];
  }

  return JSON.parse(text) as unknown[];
}

/**
 * Calls an MCP tool with a 2.5s timeout.
 * Returns degraded=true on timeout or error.
 */
async function callMcpWithTimeout(toolName: string, query: string): Promise<McpToolResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const data = await callMcpTool(toolName, query, controller.signal);
    clearTimeout(timeoutId);
    return { data, degraded: false };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { data: [], degraded: true };
    }
    return { data: [], degraded: true };
  }
}

/** Wraps searchSlackHistory in a degraded-safe promise. */
async function callRtsWithSafety(query: string, client: WebClient): Promise<McpToolResult> {
  try {
    const data = await searchSlackHistory(query, client);
    return { data, degraded: false };
  } catch {
    return { data: [], degraded: true };
  }
}

/**
 * Builds a fallback Block Kit response from raw source data when synthesis fails.
 */
function buildFallbackResponse(
  question: string,
  sources: {
    docs: { data: unknown[]; degraded: boolean };
    slack: { data: unknown[]; degraded: boolean };
    github: { data: unknown[]; degraded: boolean };
    npm: { data: unknown[]; degraded: boolean };
  },
): SlackBlockKitMessage {
  const blocks: SlackBlockKitMessage['blocks'] = [];

  // Fallback summary
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*Results for: ${question}*\n_Synthesis unavailable — showing raw source results._`,
    },
  });

  blocks.push({ type: 'divider' });

  const sourceConfigs: Array<{
    key: keyof typeof sources;
    label: string;
    emoji: string;
  }> = [
    { key: 'docs', label: 'Documentation', emoji: '📚' },
    { key: 'slack', label: 'Slack History', emoji: '💬' },
    { key: 'github', label: 'GitHub Issues', emoji: '🐙' },
    { key: 'npm', label: 'npm Packages', emoji: '📦' },
  ];

  for (const cfg of sourceConfigs) {
    const source = sources[cfg.key];
    if (source.degraded || source.data.length === 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `⚠️ *${cfg.emoji} ${cfg.label}* — _No data available from this source._`,
        },
      });
    } else {
      const items = (source.data as Record<string, unknown>[])
        .slice(0, 3)
        .map((item) => {
          const title = String(item['title'] ?? item['name'] ?? '');
          const snippet = String(item['snippet'] ?? item['text'] ?? item['description'] ?? '');
          return `• *${title}* — ${snippet.slice(0, 120)}`;
        })
        .join('\n');

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${cfg.emoji} ${cfg.label}*\n${items}`,
        },
      });
    }
  }

  blocks.push({ type: 'divider' });

  return { blocks };
}

/**
 * Factory that creates the `app_mention` event handler.
 *
 * Uses a closure to lazily get the Slack WebClient so tests can inject
 * a mock client without depending on the Bolt app instance.
 */
export function createAppMentionHandler(getAppClient: () => WebClient) {
  return async ({
    event,
    say,
  }: {
    event: { text?: string; channel?: string };
    say: (message: unknown) => Promise<unknown>;
  }): Promise<void> => {
    const question = extractQuestion(event.text ?? '');
    if (!question) {
      await say('Please provide a question so I can search for relevant information.');
      return;
    }

    const client = getAppClient();

    // ── Parallel fan-out to all 4 sources with 2.5s timeout ──
    const [docsResult, npmResult, githubResult, slackResult] = await Promise.allSettled([
      callMcpWithTimeout('search_docs', question),
      callMcpWithTimeout('get_npm_package', question),
      callMcpWithTimeout('get_github_issue', question),
      callRtsWithSafety(question, client),
    ]);

    const docs =
      docsResult.status === 'fulfilled' ? docsResult.value : { data: [], degraded: true };
    const npm = npmResult.status === 'fulfilled' ? npmResult.value : { data: [], degraded: true };
    const github =
      githubResult.status === 'fulfilled' ? githubResult.value : { data: [], degraded: true };
    const slack =
      slackResult.status === 'fulfilled' ? slackResult.value : { data: [], degraded: true };

    // Build synthesis input
    const synthesisInput: SynthesisInputType = {
      question,
      sources: {
        docs: docs.data as Array<{ title: string; url: string; snippet: string }>,
        slack: slack.data as Array<{
          channel: string;
          user: string;
          text: string;
          permalink: string;
          ts: string;
        }>,
        github: github.data as Array<{
          title: string;
          url: string;
          number: number;
          state: string;
          repo: string;
          snippet?: string;
        }>,
        npm: npm.data as Array<{
          name: string;
          version: string;
          description?: string;
          stars: number;
        }>,
      },
    };

    // ── Try synthesis, fall back to raw results ──
    try {
      const synthesis = await synthesize(synthesisInput);
      const message = buildBlockKitResponse(synthesis);
      await say(message);
    } catch {
      const fallback = buildFallbackResponse(question, { docs, slack, github, npm });
      await say(fallback);
    }
  };
}
