import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GithubIssueOutput } from '@context-bridge/shared/contracts/tools';
import { getGithubIssueHandler } from '../get-github-issue.js';

const mockResponse = {
  items: [
    {
      number: 12345,
      title: 'Bug: Error boundary does not catch async errors',
      state: 'open',
      html_url: 'https://github.com/facebook/react/issues/12345',
      body: 'When using error boundaries with async functions, the error is not caught...',
      repository_url: 'https://api.github.com/repos/facebook/react',
    },
    {
      number: 67890,
      title: 'RFC: Improve error boundary API',
      state: 'closed',
      html_url: 'https://github.com/facebook/react/issues/67890',
      body: 'Proposal to improve the error boundary API in React 19...',
      repository_url: 'https://api.github.com/repos/facebook/react',
    },
  ],
};

describe('getGithubIssueHandler', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });

  it('returns valid GithubIssueOutput for a valid query', async () => {
    const result = await getGithubIssueHandler({ query: 'error boundary react' });

    expect(result.content).toHaveLength(1);
    expect(result.content[0]?.type).toBe('text');

    const parsed = JSON.parse(result.content[0]?.text ?? '[]') as Array<unknown>;
    const output = GithubIssueOutput.parse({ results: parsed });

    expect(output.results).toHaveLength(2);
  });

  it('maps GitHub API fields correctly', async () => {
    const result = await getGithubIssueHandler({ query: 'error boundary react' });
    const parsed = JSON.parse(result.content[0]?.text ?? '[]') as Array<{
      title: string;
      number: number;
      state: string;
      url: string;
      repo: string;
      snippet: string;
    }>;

    expect(parsed[0]?.title).toBe('Bug: Error boundary does not catch async errors');
    expect(parsed[0]?.number).toBe(12345);
    expect(parsed[0]?.state).toBe('open');
    expect(parsed[0]?.repo).toBe('facebook/react');
    expect(parsed[0]?.url).toBe('https://github.com/facebook/react/issues/12345');
    expect(parsed[0]?.snippet).toBeDefined();
  });

  it('truncates body snippet to 200 characters', async () => {
    const result = await getGithubIssueHandler({ query: 'error boundary react' });
    const parsed = JSON.parse(result.content[0]?.text ?? '[]') as Array<{
      snippet: string;
    }>;

    expect(parsed[0]?.snippet?.length).toBeLessThanOrEqual(200);
  });

  it('rejects empty query string', async () => {
    await expect(getGithubIssueHandler({ query: '' })).rejects.toThrow();
  });

  it('throws on GitHub API error', async () => {
    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Forbidden', { status: 403 }),
    );

    await expect(getGithubIssueHandler({ query: 'react' })).rejects.toThrow(
      'GitHub API returned 403',
    );
  });

  it('handles empty results gracefully', async () => {
    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await getGithubIssueHandler({ query: 'zzzzz_nonexistent' });
    const parsed = JSON.parse(result.content[0]?.text ?? '[]') as Array<unknown>;
    const output = GithubIssueOutput.parse({ results: parsed });

    expect(output.results).toHaveLength(0);
  });
});
