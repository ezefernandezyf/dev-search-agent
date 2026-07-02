import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchDocsOutput } from '@context-bridge/shared/contracts/tools.js';
import { searchDocsHandler } from '../search-docs.js';

describe('searchDocsHandler', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns valid SearchDocsOutput for a valid query', async () => {
    const result = await searchDocsHandler({ query: 'error boundaries' });

    expect(result.content).toHaveLength(1);
    expect(result.content[0]?.type).toBe('text');

    const parsed = JSON.parse(result.content[0]?.text ?? '[]') as Array<unknown>;
    const output = SearchDocsOutput.parse({ results: parsed });

    expect(output.results.length).toBeGreaterThan(0);
    for (const item of output.results) {
      expect(item.title).toBeTruthy();
      expect(item.url).toBeTruthy();
      expect(item.snippet).toBeTruthy();
    }
  });

  it('returns results with documentation-oriented titles', async () => {
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
