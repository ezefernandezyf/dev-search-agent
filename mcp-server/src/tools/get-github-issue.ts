import { GithubIssueInput, GithubIssueOutput } from '@context-bridge/shared/contracts/tools';

interface McpToolResponse {
  content: Array<{ type: 'text'; text: string }>;
}

/**
 * MCP tool handler for `get_github_issue`.
 *
 * Returns mock GitHub issue data in demo mode (MOCK_RTS=true).
 * In production, searches GitHub issues via the public API.
 */
export async function getGithubIssueHandler(args: Record<string, unknown>): Promise<McpToolResponse> {
  const { query } = GithubIssueInput.parse(args);

  // Mock mode for reliable hackathon demo
  if (process.env['MOCK_RTS'] === 'true') {
    const results = [
      {
        title: 'Error boundaries should support functional components with hooks',
        url: 'https://github.com/facebook/react/issues/19630',
        number: 19630,
        state: 'open',
        repo: 'facebook/react',
        snippet: 'Currently error boundaries require class components. A hook-based API (useErrorBoundary or similar) would allow functional components to act as error boundaries without the class boilerplate.',
      },
      {
        title: 'Add resetErrorBoundary to reset the error state and retry rendering',
        url: 'https://github.com/bvaughn/react-error-boundary/issues/85',
        number: 85,
        state: 'closed',
        repo: 'bvaughn/react-error-boundary',
        snippet: 'Feature request: expose a reset function from the error boundary that parent components can call to clear the error state and re-render the children. This enables "Try again" UX patterns.',
      },
      {
        title: 'TypeScript: errorInfo type is any in componentDidCatch',
        url: 'https://github.com/DefinitelyTyped/DefinitelyTyped/issues/65052',
        number: 65052,
        state: 'closed',
        repo: 'DefinitelyTyped/DefinitelyTyped',
        snippet: 'The errorInfo parameter in componentDidCatch is typed as any in @types/react. It should be typed as { componentStack: string } for better TypeScript support.',
      },
    ];
    const output = GithubIssueOutput.parse({ results: results.filter(() => true) });
    return { content: [{ type: 'text', text: JSON.stringify(output.results) }] };
  }

  const url = `https://api.github.com/search/issues?q=${encodeURIComponent(query)}&per_page=5`;

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'context-bridge-mcp-server/0.1.0',
  };

  // Optional token increases rate limit from 60 → 5000 req/hour
  const githubToken = process.env['GITHUB_TOKEN'];
  if (githubToken) {
    headers['Authorization'] = `Bearer ${githubToken}`;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`GitHub API returned ${response.status}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await response.json()) as {
    items?: Array<{
      number: number;
      title: string;
      state: string;
      html_url: string;
      body?: string;
      repository_url?: string;
    }>;
  };

  const results = (data.items ?? []).map((item) => {
    const repo = item.repository_url
      ? item.repository_url.replace('https://api.github.com/repos/', '')
      : 'unknown';

    return {
      title: item.title,
      url: item.html_url,
      number: item.number,
      state: item.state,
      repo,
      snippet: item.body?.slice(0, 200),
    };
  });

  const output = GithubIssueOutput.parse({ results });
  return {
    content: [{ type: 'text', text: JSON.stringify(output.results) }],
  };
}
