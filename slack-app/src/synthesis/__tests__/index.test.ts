import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { SynthesisInput } from '@context-bridge/shared/contracts/synthesis';

type SynthesisInputType = z.infer<typeof SynthesisInput>;

const mockSynthesisOutput = {
  summary:
    'Error boundaries are React components that catch JavaScript errors in their child component tree.',
  sections: [
    {
      type: 'docs' as const,
      heading: 'React Error Boundaries',
      summary: 'Official docs explain how to use componentDidCatch.',
      permalink: 'https://react.dev/error-boundaries',
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
      heading: 'Error boundary issue',
      summary: 'Known issue with async error handling.',
      permalink: 'https://github.com/facebook/react/issues/123',
      degraded: false,
    },
    {
      type: 'npm' as const,
      heading: 'react-error-boundary',
      summary: 'Popular package with 5k stars for error handling.',
      degraded: false,
    },
  ],
};

function createMockFetchResponse(body: object, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

function getFirstCallArgs(mockFn: ReturnType<typeof vi.fn>): [unknown, RequestInit] {
  const call = mockFn.mock.calls[0];
  if (!call) throw new Error('Expected fetch to be called');
  return call as [unknown, RequestInit];
}

const sampleInput: SynthesisInputType = {
  question: 'How do we handle error boundaries in React?',
  sources: {
    docs: [
      {
        title: 'React Error Boundaries',
        url: 'https://react.dev/error-boundaries',
        snippet: 'Error boundaries are React components that catch JavaScript errors.',
      },
    ],
    slack: [
      {
        channel: 'C001',
        user: 'U001',
        text: 'We use react-error-boundary in production.',
        permalink: 'https://slack.com/archives/C001/p123',
        ts: '123.456',
      },
    ],
    github: [
      {
        title: 'Async error boundaries',
        url: 'https://github.com/facebook/react/issues/123',
        number: 123,
        state: 'open',
        repo: 'facebook/react',
        snippet: 'Tracking async error handling improvements.',
      },
    ],
    npm: [
      {
        name: 'react-error-boundary',
        version: '4.0.0',
        description: 'Simple React error boundary component',
        stars: 5000,
      },
    ],
  },
};

describe('synthesize', () => {
  let originalApiKey: string | undefined;

  beforeEach(() => {
    originalApiKey = process.env['GROQ_API_KEY'];
    process.env['GROQ_API_KEY'] = 'test-key';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalApiKey !== undefined) {
      process.env['GROQ_API_KEY'] = originalApiKey;
    } else {
      delete process.env['GROQ_API_KEY'];
    }
  });

  it('sends request to Groq API with correct structure', async () => {
    const { synthesize } = await import('../index.js');
    const mockFetch = createMockFetchResponse({
      choices: [{ message: { content: JSON.stringify(mockSynthesisOutput) } }],
    });
    vi.stubGlobal('fetch', mockFetch);

    await synthesize(sampleInput);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = getFirstCallArgs(mockFetch);
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');

    const body = JSON.parse(options.body as string) as Record<string, unknown>;
    expect(body['model']).toBe('llama-3.3-70b-versatile');
    expect(body['response_format']).toEqual({ type: 'json_object' });
  });

  it('includes anti-slop instructions in the system prompt', async () => {
    const { synthesize } = await import('../index.js');
    const mockFetch = createMockFetchResponse({
      choices: [{ message: { content: JSON.stringify(mockSynthesisOutput) } }],
    });
    vi.stubGlobal('fetch', mockFetch);

    await synthesize(sampleInput);

    const [, options] = getFirstCallArgs(mockFetch);
    const body = JSON.parse(options.body as string) as {
      messages: Array<{ role: string; content: string }>;
    };

    const systemMsg = body.messages.find((m) => m.role === 'system');
    expect(systemMsg).toBeDefined();
    if (systemMsg) {
      expect(systemMsg.content).toContain('NO "Here\'s what I found"');
      expect(systemMsg.content).toContain('NO "I hope this helps"');
    }
  });

  it('includes source data in the user message', async () => {
    const { synthesize } = await import('../index.js');
    const mockFetch = createMockFetchResponse({
      choices: [{ message: { content: JSON.stringify(mockSynthesisOutput) } }],
    });
    vi.stubGlobal('fetch', mockFetch);

    await synthesize(sampleInput);

    const [, options] = getFirstCallArgs(mockFetch);
    const body = JSON.parse(options.body as string) as {
      messages: Array<{ role: string; content: string }>;
    };

    const userMsg = body.messages.find((m) => m.role === 'user');
    expect(userMsg).toBeDefined();
    if (userMsg) {
      expect(userMsg.content).toContain('error boundaries');
      expect(userMsg.content).toContain('react-error-boundary');
    }
  });

  it('validates response with SynthesisOutput schema', async () => {
    const { synthesize } = await import('../index.js');
    const mockFetch = createMockFetchResponse({
      choices: [{ message: { content: JSON.stringify(mockSynthesisOutput) } }],
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await synthesize(sampleInput);

    expect(result.summary).toBe(mockSynthesisOutput.summary);
    expect(result.sections).toHaveLength(4);
    const firstSection = result.sections[0];
    expect(firstSection).toBeDefined();
    expect(firstSection?.type).toBe('docs');
  });

  it('retries once on 5xx error then succeeds', async () => {
    const { synthesize } = await import('../index.js');

    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: 'internal' }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: JSON.stringify(mockSynthesisOutput) } }],
          }),
      });
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await synthesize(sampleInput);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result.summary).toBe(mockSynthesisOutput.summary);
  });

  it('throws after two consecutive 5xx errors', async () => {
    const { synthesize } = await import('../index.js');
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: () => Promise.resolve({ error: 'service unavailable' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(synthesize(sampleInput)).rejects.toThrow();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('throws when GROQ_API_KEY is not set', async () => {
    delete process.env['GROQ_API_KEY'];
    const { synthesize } = await import('../index.js');

    await expect(synthesize(sampleInput)).rejects.toThrow('GROQ_API_KEY');
  });
});
