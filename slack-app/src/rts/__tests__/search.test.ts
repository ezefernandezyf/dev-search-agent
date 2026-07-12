import { describe, it, expect, vi } from 'vitest';
import { searchSlackHistory } from '../search.js';

function createMockClient(messages: Record<string, unknown>[] = []) {
  const searchMessages = vi.fn().mockResolvedValue({
    messages: {
      matches: messages,
    },
  });

  return {
    search: { messages: searchMessages },
    searchMessages,
  };
}

describe('searchSlackHistory', () => {
  it('calls client.search.messages with query and count=5', async () => {
    const mock = createMockClient();
    const client = mock as unknown as import('@slack/web-api').WebClient;

    await searchSlackHistory('error boundaries', client);

    expect(mock.searchMessages).toHaveBeenCalledWith({
      query: 'error boundaries',
      count: 5,
    });
  });

  it('returns validated SlackMessageResult objects from API matches', async () => {
    const rawMatches = [
      {
        channel: { id: 'C001', name: 'general' },
        user: 'U001',
        text: 'Use ErrorBoundary components to catch rendering errors.',
        permalink: 'https://slack.com/archives/C001/p1234567890',
        ts: '1234567890.123456',
      },
      {
        channel: { id: 'C002', name: 'react' },
        user: 'U002',
        text: 'We wrap our app in a top-level error boundary.',
        permalink: 'https://slack.com/archives/C002/p1234567891',
        ts: '1234567891.123456',
      },
    ];

    const mock = createMockClient(rawMatches);
    const client = mock as unknown as import('@slack/web-api').WebClient;

    const results = await searchSlackHistory('error boundaries', client);

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      channel: 'C001',
      user: 'U001',
      text: 'Use ErrorBoundary components to catch rendering errors.',
      permalink: 'https://slack.com/archives/C001/p1234567890',
      ts: '1234567890.123456',
    });
    expect(results[1]?.channel).toBe('C002');
  });

  it('returns empty array when no matches found', async () => {
    const mock = createMockClient();
    // Override with empty matches
    mock.searchMessages.mockResolvedValueOnce({
      messages: { matches: [] },
    });
    const client = mock as unknown as import('@slack/web-api').WebClient;

    const results = await searchSlackHistory('nonexistent topic', client);

    expect(results).toEqual([]);
  });

  it('returns empty array when messages.matches is undefined', async () => {
    const mock = createMockClient();
    mock.searchMessages.mockResolvedValueOnce({
      messages: {},
    });
    const client = mock as unknown as import('@slack/web-api').WebClient;

    const results = await searchSlackHistory('anything', client);

    expect(results).toEqual([]);
  });

  it('throws when the Slack API returns an error', async () => {
    const mock = createMockClient();
    mock.searchMessages.mockRejectedValueOnce(new Error('rate_limited'));
    const client = mock as unknown as import('@slack/web-api').WebClient;

    await expect(searchSlackHistory('test', client)).rejects.toThrow('rate_limited');
  });

  it('extracts channel id from channel object', async () => {
    const rawMatches = [
      {
        channel: { id: 'C999', name: 'testing' },
        user: 'U001',
        text: 'test message',
        permalink: 'https://slack.com/archives/C999/p000',
        ts: '000.000',
      },
    ];

    const mock = createMockClient(rawMatches);
    const client = mock as unknown as import('@slack/web-api').WebClient;

    const results = await searchSlackHistory('test', client);

    expect(results[0]?.channel).toBe('C999');
  });
});
