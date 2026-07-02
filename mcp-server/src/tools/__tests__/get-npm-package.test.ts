import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NpmPackageOutput } from '@context-bridge/shared/contracts/tools.js';
import { getNpmPackageHandler } from '../get-npm-package.js';

const mockResponse = {
  objects: [
    {
      package: {
        name: 'react',
        version: '19.0.0',
        description: 'React is a JavaScript library for building user interfaces',
      },
      score: { detail: { popularity: 0.99 } },
    },
    {
      package: {
        name: 'react-dom',
        version: '19.0.0',
        description: 'React package for working with the DOM',
      },
      score: { detail: { popularity: 0.98 } },
    },
  ],
};

describe('getNpmPackageHandler', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });

  it('returns valid NpmPackageOutput for a valid query', async () => {
    const result = await getNpmPackageHandler({ query: 'react' });

    expect(result.content).toHaveLength(1);
    expect(result.content[0]?.type).toBe('text');

    const parsed = JSON.parse(result.content[0]?.text ?? '[]') as Array<unknown>;
    const output = NpmPackageOutput.parse({ results: parsed });

    expect(output.results).toHaveLength(2);
  });

  it('maps popularity to star count', async () => {
    const result = await getNpmPackageHandler({ query: 'react' });
    const parsed = JSON.parse(result.content[0]?.text ?? '[]') as Array<{ stars: number }>;

    // 0.99 popularity → ~99_000 stars
    expect(parsed[0]?.stars).toBeGreaterThan(0);
    expect(parsed[1]?.stars).toBeGreaterThan(0);
  });

  it('includes package description when available', async () => {
    const result = await getNpmPackageHandler({ query: 'react' });
    const parsed = JSON.parse(result.content[0]?.text ?? '[]') as Array<{
      name: string;
      description?: string;
    }>;

    expect(parsed[0]?.name).toBe('react');
    expect(parsed[0]?.description).toBeDefined();
  });

  it('rejects empty query string', async () => {
    await expect(getNpmPackageHandler({ query: '' })).rejects.toThrow();
  });

  it('throws on npm registry error', async () => {
    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Not Found', { status: 404 }),
    );

    await expect(getNpmPackageHandler({ query: 'react' })).rejects.toThrow(
      'npm registry returned 404',
    );
  });
});
