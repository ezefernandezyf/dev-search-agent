import { WebClient } from '@slack/web-api';
import { z } from 'zod';
import { SlackMessageResult } from '@context-bridge/shared/contracts/tools';

type SlackMessageResultType = z.infer<typeof SlackMessageResult>;

/**
 * Searches Slack workspace history using the Real-Time Search API.
 *
 * Called directly from the Bolt agent (not via MCP) so judges can see
 * MCP and RTS as two independent integrations.
 */
/**
 * Mock RTS data for hackathon demo — avoids needing a user token with search:read.
 * Activated by MOCK_RTS=true env var.
 */
function getMockResults(query: string): SlackMessageResultType[] {
  return [
    {
      channel: '#frontend-discuss',
      user: 'U12345',
      text: `We've been using error boundaries in our React app since v16. The key is wrapping route-level components so a crash in one route doesn't take down the whole app.`,
      permalink: 'https://slack.com/archives/C12345/p12345',
      ts: '1710432000.000100',
    },
    {
      channel: '#react-help',
      user: 'U67890',
      text: `Anyone tried react-error-boundary by Brian Vaughn? Way cleaner API than the class-based approach — you get a FallbackComponent prop and resetKeys for recovery. We switched last sprint and it cut our crash reports by 60%.`,
      permalink: 'https://slack.com/archives/C67890/p67890',
      ts: '1710518400.000200',
    },
    {
      channel: '#architecture',
      user: 'U24680',
      text: `Reminder: error boundaries don't catch errors in event handlers, async code, or SSR. Only errors during rendering, lifecycle methods, and constructors of the whole tree below. If you need async error handling, combine with a try/catch boundary at the data fetching layer.`,
      permalink: 'https://slack.com/archives/C24680/p24680',
      ts: '1710604800.000300',
    },
    {
      channel: '#frontend-discuss',
      user: 'U13579',
      text: `Pro tip: pair error boundaries with React.Suspense for a really clean loading/error/empty state pattern. The combination makes your component tree declarative about all three states. ${query} is something every team should have in their design system.`,
      permalink: 'https://slack.com/archives/C13579/p13579',
      ts: '1710691200.000400',
    },
    {
      channel: '#general',
      user: 'U11223',
      text: `Just shipped our error boundary strategy to production. We have a top-level boundary that shows a friendly "Something went wrong" screen + a "Try again" button, and lower-level boundaries around critical feature sections that degrade gracefully instead of full-page crashes.`,
      permalink: 'https://slack.com/archives/C11223/p11223',
      ts: '1710777600.000500',
    },
  ];
}

export async function searchSlackHistory(
  query: string,
  client: WebClient,
): Promise<SlackMessageResultType[]> {
  // Mock mode for hackathon demo — avoids needing user token with search:read
  if (process.env['MOCK_RTS'] === 'true') {
    const results = getMockResults(query);
    return SlackMessageResult.array().parse(results);
  }

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
