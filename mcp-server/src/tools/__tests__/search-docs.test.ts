import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchDocsOutput } from '@context-bridge/shared/contracts/tools';
import { searchDocsHandler } from '../search-docs.js';

describe('searchDocsHandler', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns valid SearchDocsOutput from real API (Stack Overflow)', async () => {
    const result = await searchDocsHandler({ query: 'react useeffect' });

    expect(result.content).toHaveLength(1);
    expect(result.content[0]?.type).toBe('text');

    const parsed = JSON.parse(result.content[0]?.text ?? '[]') as Array<unknown>;
    const output = SearchDocsOutput.parse({ results: parsed });

    expect(output.results.length).toBeGreaterThan(0);
    for (const item of output.results) {
      expect(item.title).toBeTruthy();
      expect(item.url).toBeTruthy();
      expect(item.snippet).toBeTruthy();
      // Stack Overflow results should link to stackoverflow.com
      expect(item.url).toMatch(/stackoverflow\.com/);
    }
  }, 15000);

  it('returns mock results with react and mdn titles when MOCK_RTS=true', async () => {
    vi.stubEnv('MOCK_RTS', 'true');
    const result = await searchDocsHandler({ query: 'react hooks' });
    const parsed = JSON.parse(result.content[0]?.text ?? '[]') as Array<{ title: string }>;

    const titles = parsed.map((item) => item.title);
    expect(titles.some((t) => t.toLowerCase().includes('react'))).toBe(true);
    expect(titles.some((t) => t.toLowerCase().includes('mdn'))).toBe(true);
  });

  it('rejects empty query string', async () => {
    await expect(searchDocsHandler({ query: '' })).rejects.toThrow();
  });

  it('rejects missing query field', async () => {
    await expect(searchDocsHandler({} as Record<string, unknown>)).rejects.toThrow();
  });
});
