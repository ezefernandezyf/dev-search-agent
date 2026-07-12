import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock all downstream modules ──
vi.mock('../synthesis/index.js');
vi.mock('../block-kit/response.js');
vi.mock('../rts/search.js');

import { synthesize } from '../synthesis/index.js';
import { buildBlockKitResponse } from '../block-kit/response.js';
import { searchSlackHistory } from '../rts/search.js';
import { createAppMentionHandler } from '../events/app-mention.js';
import type { SlackBlockKitMessage } from '../block-kit/response.js';

// ── Mock data ──

const mockSlackResults = [
  {
    channel: 'C001',
    user: 'U001',
    text: 'Use error boundaries to catch rendering errors.',
    permalink: 'https://slack.com/archives/C001/p123',
    ts: '123.456',
  },
];

const mockMcpDocsResults = [
  {
    title: 'React Error Boundaries',
    url: 'https://react.dev',
    snippet: 'Error boundaries are React components that catch JavaScript errors.',
  },
];

const mockMcpNpmResults = [
  {
    name: 'react-error-boundary',
    version: '4.0.0',
    description: 'Simple error boundary component for React',
    stars: 5000,
  },
];

const mockMcpGithubResults = [
  {
    title: 'Error boundary improvements in concurrent mode',
    url: 'https://github.com/facebook/react/issues/123',
    number: 123,
    state: 'open',
    repo: 'facebook/react',
    snippet: 'Tracking improvements for error handling.',
  },
];

const mockSynthesisOutput = {
  summary:
    'Error boundaries catch JavaScript errors in React component trees and display a fallback UI.',
  sections: [
    {
      type: 'docs' as const,
      heading: 'React Error Boundaries',
      summary: 'Official docs explain componentDidCatch and getDerivedStateFromError.',
      permalink: 'https://react.dev',
      degraded: false,
    },
    {
      type: 'slack' as const,
      heading: '#react discussion',
      summary: 'Team recommends react-error-boundary package.',
      permalink: 'https://slack.com/archives/C001/p123',
      degraded: false,
    },
    {
      type: 'github' as const,
      heading: 'Async error boundaries issue',
      summary: 'Known issue with async error handling.',
      permalink: 'https://github.com/facebook/react/issues/123',
      degraded: false,
    },
    {
      type: 'npm' as const,
      heading: 'react-error-boundary',
      summary: 'Popular error handling package with useErrorBoundary hook.',
      degraded: false,
    },
  ],
};

const mockBlockKitMessage: SlackBlockKitMessage = {
  blocks: [
    { type: 'section', text: { type: 'mrkdwn', text: mockSynthesisOutput.summary } },
    { type: 'divider' },
    ...mockSynthesisOutput.sections.map((s) => ({
      type: 'section' as const,
      text: { type: 'mrkdwn' as const, text: `*📚 ${s.heading}*\n${s.summary}` },
    })),
    { type: 'divider' },
  ],
};

function createMockMcpResponse(data: unknown[]): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers({ 'content-type': 'application/json' }),
    redirected: false,
    type: 'default',
    url: 'http://localhost:4000/rpc',
    body: null,
    bodyUsed: false,
    clone: () => createMockMcpResponse(data),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    text: () => Promise.resolve(JSON.stringify(data)),
    json: () =>
      Promise.resolve({
        jsonrpc: '2.0',
        result: {
          content: [{ type: 'text', text: JSON.stringify(data) }],
        },
        id: 1,
      }),
  } as Response;
}

describe('Full Pipeline Integration (4.5 + 4.6)', () => {
  let say: ReturnType<typeof vi.fn>;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock MCP server HTTP calls
    mockFetch = vi.fn().mockImplementation(async (_url: string, options: RequestInit) => {
      const body = JSON.parse(options.body as string) as {
        params?: { name?: string };
      };
      const toolName = body.params?.name;

      let data: unknown[];
      switch (toolName) {
        case 'search_docs':
          data = mockMcpDocsResults;
          break;
        case 'get_npm_package':
          data = mockMcpNpmResults;
          break;
        case 'get_github_issue':
          data = mockMcpGithubResults;
          break;
        default:
          data = [];
      }

      return createMockMcpResponse(data);
    });

    vi.stubGlobal('fetch', mockFetch);

    // Mock searchSlackHistory
    vi.mocked(searchSlackHistory).mockResolvedValue(mockSlackResults);

    // Mock synthesize
    vi.mocked(synthesize).mockResolvedValue(mockSynthesisOutput);

    // Mock buildBlockKitResponse
    vi.mocked(buildBlockKitResponse).mockReturnValue(mockBlockKitMessage);

    say = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls all 4 sources (3 MCP + RTS) and returns a Block Kit message via say()', async () => {
    const mockClient = {} as Record<string, unknown>;
    const handler = createAppMentionHandler(() => mockClient as never);

    await handler({
      event: { text: '<@U12345> How do we handle error boundaries in React?' },
      say,
    });

    // 1. RTS was called
    expect(searchSlackHistory).toHaveBeenCalledWith(
      'How do we handle error boundaries in React?',
      mockClient,
    );

    // 2. MCP was called for all 3 tools
    const mcpCalls = vi
      .mocked(fetch)
      .mock.calls.filter(([url]) => url === 'http://localhost:4000/rpc');
    expect(mcpCalls.length).toBe(3);

    // Verify each MCP tool name was used
    const mcpBodies = mcpCalls.map(([, opts]) => {
      const init = opts as RequestInit;
      return JSON.parse(init.body as string) as {
        params?: { name?: string };
      };
    });
    const toolNames = mcpBodies.map((b: { params?: { name?: string } }) => b.params?.name);
    expect(toolNames).toContain('search_docs');
    expect(toolNames).toContain('get_npm_package');
    expect(toolNames).toContain('get_github_issue');

    // 3. Synthesize was called with correct input
    expect(synthesize).toHaveBeenCalledWith(
      expect.objectContaining({
        question: 'How do we handle error boundaries in React?',
        sources: expect.objectContaining({
          docs: expect.any(Array),
          slack: expect.any(Array),
          github: expect.any(Array),
          npm: expect.any(Array),
        }),
      }),
    );

    // 4. buildBlockKitResponse was called
    expect(buildBlockKitResponse).toHaveBeenCalledWith(mockSynthesisOutput);

    // 5. say() was called with the Block Kit message
    expect(say).toHaveBeenCalledWith(mockBlockKitMessage);
  });

  it('extracts question by stripping bot mention tag', async () => {
    const mockClient = {} as Record<string, unknown>;
    const handler = createAppMentionHandler(() => mockClient as never);

    await handler({
      event: { text: '<@U99999> How do error boundaries work?' },
      say,
    });

    expect(synthesize).toHaveBeenCalledWith(
      expect.objectContaining({
        question: 'How do error boundaries work?',
      }),
    );
  });

  it('handles empty question gracefully', async () => {
    const mockClient = {} as Record<string, unknown>;
    const handler = createAppMentionHandler(() => mockClient as never);

    await handler({
      event: { text: '<@U12345> ' },
      say,
    });

    expect(synthesize).not.toHaveBeenCalled();
    expect(say).toHaveBeenCalledWith(expect.stringContaining('Please provide a question'));
  });

  it('falls back to raw results when synthesis fails', async () => {
    vi.mocked(synthesize).mockRejectedValue(new Error('Synthesis failed'));

    const mockClient = {} as Record<string, unknown>;
    const handler = createAppMentionHandler(() => mockClient as never);

    await handler({
      event: { text: '<@U12345> How do error boundaries work?' },
      say,
    });

    // Should not have called buildBlockKitResponse (synthesis failed before that)
    expect(buildBlockKitResponse).not.toHaveBeenCalled();

    // Should have called say with a fallback message
    expect(say).toHaveBeenCalledWith(
      expect.objectContaining({
        blocks: expect.arrayContaining([expect.objectContaining({ type: 'section' })]),
      }),
    );
  });

  it('handles MCP fetch rejection gracefully (degraded source)', async () => {
    // Make github issue call reject
    vi.mocked(fetch).mockImplementation(async (url: unknown, options: unknown) => {
      const reqBody = JSON.parse((options as RequestInit).body as string) as {
        params?: { name?: string };
      };
      const toolName = reqBody.params?.name;

      if (toolName === 'get_github_issue') {
        throw new Error('Network error');
      }

      let data: unknown[];
      switch (toolName) {
        case 'search_docs':
          data = mockMcpDocsResults;
          break;
        case 'get_npm_package':
          data = mockMcpNpmResults;
          break;
        default:
          data = [];
      }

      return createMockMcpResponse(data);
    });

    vi.mocked(synthesize).mockResolvedValue(mockSynthesisOutput);
    vi.mocked(buildBlockKitResponse).mockReturnValue(mockBlockKitMessage);

    const mockClient = {} as Record<string, unknown>;
    const handler = createAppMentionHandler(() => mockClient as never);

    await handler({
      event: { text: '<@U12345> How do error boundaries work?' },
      say,
    });

    // The handler should still complete and call say even with a failing source
    expect(say).toHaveBeenCalled();
  });
});
