import { WebClient } from '@slack/web-api';
import { z } from 'zod';
import { SlackMessageResult } from '@context-bridge/shared/contracts/tools.js';

type SlackMessageResultType = z.infer<typeof SlackMessageResult>;

/**
 * Searches Slack workspace history using the Real-Time Search API.
 *
 * Called directly from the Bolt agent (not via MCP) so judges can see
 * MCP and RTS as two independent integrations.
 */
export async function searchSlackHistory(
  query: string,
  client: WebClient,
): Promise<SlackMessageResultType[]> {
  const response = await client.search.messages({ query, count: 5 });

  const matches: unknown[] =
    (response.messages as { matches?: unknown[] } | undefined)?.matches ?? [];

  const results = matches.map((match) => {
    const m = match as {
      channel?: { id?: string };
      user?: string;
      text?: string;
      permalink?: string;
      ts?: string;
    };
    return {
      channel: m.channel?.id ?? '',
      user: m.user ?? '',
      text: m.text ?? '',
      permalink: m.permalink ?? '',
      ts: m.ts ?? '',
    };
  });

  return SlackMessageResult.array().parse(results);
}
