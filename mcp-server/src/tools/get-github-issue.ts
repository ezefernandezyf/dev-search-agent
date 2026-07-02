import { GithubIssueInput, GithubIssueOutput } from '@context-bridge/shared/contracts/tools.js';

interface McpToolResponse {
  content: Array<{ type: 'text'; text: string }>;
}

/**
 * MCP tool handler for `get_github_issue`.
 *
 * Searches GitHub issues via the public API (no auth required for public repos).
 * Rate-limited to 60 requests/hour without authentication.
 */
export async function getGithubIssueHandler(args: Record<string, unknown>): Promise<McpToolResponse> {
  const { query } = GithubIssueInput.parse(args);

  const url = `https://api.github.com/search/issues?q=${encodeURIComponent(query)}&per_page=5`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'context-bridge-mcp-server/0.1.0',
    },
  });

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
