import { describe, it, expect } from 'vitest';
import {
  SearchDocsInput,
  SearchDocsOutput,
  DocResult,
  NpmPackageInput,
  NpmPackageOutput,
  NpmPackageResult,
  GithubIssueInput,
  GithubIssueOutput,
  GithubIssueResult,
  SlackSearchInput,
  SlackSearchOutput,
  SlackMessageResult,
} from '../../contracts/tools.js';

// ── SearchDocsInput / Output ─────────────────────────────

describe('SearchDocsInput', () => {
  it('accepts a valid non-empty query', () => {
    expect(SearchDocsInput.parse({ query: 'error boundaries' })).toEqual({
      query: 'error boundaries',
    });
  });

  it('rejects an empty query string', () => {
    expect(() => SearchDocsInput.parse({ query: '' })).toThrow();
  });

  it('rejects missing query field', () => {
    expect(() => SearchDocsInput.parse({})).toThrow();
  });
});

describe('SearchDocsOutput', () => {
  it('accepts an empty results array', () => {
    expect(SearchDocsOutput.parse({ results: [] })).toEqual({ results: [] });
  });

  it('accepts a populated results array', () => {
    const data = {
      results: [
        { title: 'React Docs', url: 'https://react.dev', snippet: 'React is a library...' },
      ],
    };
    expect(SearchDocsOutput.parse(data)).toEqual(data);
  });

  it('rejects a result with missing url', () => {
    expect(() =>
      SearchDocsOutput.parse({ results: [{ title: 'X', snippet: '...' }] }),
    ).toThrow();
  });
});

describe('DocResult', () => {
  it('accepts valid doc result', () => {
    const doc = { title: 'Guide', url: 'https://example.com', snippet: 'A guide' };
    expect(DocResult.parse(doc)).toEqual(doc);
  });

  it('rejects missing title', () => {
    expect(() => DocResult.parse({ url: 'https://example.com', snippet: '...' })).toThrow();
  });
});

// ── NpmPackageInput / Output ─────────────────────────────

describe('NpmPackageInput', () => {
  it('accepts valid query', () => {
    expect(NpmPackageInput.parse({ query: 'react' })).toEqual({ query: 'react' });
  });

  it('rejects empty query', () => {
    expect(() => NpmPackageInput.parse({ query: '' })).toThrow();
  });
});

describe('NpmPackageResult', () => {
  it('accepts valid package data with optional description', () => {
    const pkg = { name: 'react', version: '19.0.0', stars: 230000, description: 'UI lib' };
    expect(NpmPackageResult.parse(pkg)).toEqual(pkg);
  });

  it('accepts package data without description', () => {
    const pkg = { name: 'react', version: '19.0.0', stars: 230000 };
    expect(NpmPackageResult.parse(pkg)).toEqual({ ...pkg, description: undefined });
  });

  it('rejects negative stars', () => {
    expect(() =>
      NpmPackageResult.parse({ name: 'x', version: '1.0.0', stars: -1 }),
    ).toThrow();
  });
});

describe('NpmPackageOutput', () => {
  it('accepts empty results', () => {
    expect(NpmPackageOutput.parse({ results: [] })).toEqual({ results: [] });
  });
});

// ── GithubIssueInput / Output ────────────────────────────

describe('GithubIssueInput', () => {
  it('accepts valid query', () => {
    expect(GithubIssueInput.parse({ query: 'react bug' })).toEqual({ query: 'react bug' });
  });

  it('rejects empty query', () => {
    expect(() => GithubIssueInput.parse({ query: '' })).toThrow();
  });
});

describe('GithubIssueResult', () => {
  it('accepts valid issue with snippet', () => {
    const issue = {
      title: 'Bug: crash on mount',
      url: 'https://github.com/facebook/react/issues/1',
      number: 1,
      state: 'open',
      repo: 'facebook/react',
      snippet: 'Error happens when...',
    };
    expect(GithubIssueResult.parse(issue)).toEqual(issue);
  });

  it('accepts valid issue without snippet', () => {
    const issue = {
      title: 'Feature request',
      url: 'https://github.com/facebook/react/issues/2',
      number: 2,
      state: 'closed',
      repo: 'facebook/react',
    };
    expect(GithubIssueResult.parse(issue)).toEqual({ ...issue, snippet: undefined });
  });

  it('rejects non-positive issue number', () => {
    expect(() =>
      GithubIssueResult.parse({
        title: 'x',
        url: 'https://github.com/x/x/issues/0',
        number: 0,
        state: 'open',
        repo: 'x/x',
      }),
    ).toThrow();
  });
});

describe('GithubIssueOutput', () => {
  it('accepts empty results', () => {
    expect(GithubIssueOutput.parse({ results: [] })).toEqual({ results: [] });
  });
});

// ── SlackSearchInput / Output ────────────────────────────

describe('SlackSearchInput', () => {
  it('accepts valid query', () => {
    expect(SlackSearchInput.parse({ query: 'deploy script' })).toEqual({
      query: 'deploy script',
    });
  });

  it('rejects empty query', () => {
    expect(() => SlackSearchInput.parse({ query: '' })).toThrow();
  });
});

describe('SlackMessageResult', () => {
  it('accepts valid message', () => {
    const msg = {
      channel: 'C123',
      user: 'U456',
      text: 'Hello!',
      permalink: 'https://slack.com/archives/C123/p789',
      ts: '1719000000.000001',
    };
    expect(SlackMessageResult.parse(msg)).toEqual(msg);
  });

  it('rejects missing permalink', () => {
    expect(() =>
      SlackMessageResult.parse({
        channel: 'C123',
        user: 'U456',
        text: 'Hello',
        ts: '1719000000.000001',
      }),
    ).toThrow();
  });
});

describe('SlackSearchOutput', () => {
  it('accepts empty results', () => {
    expect(SlackSearchOutput.parse({ results: [] })).toEqual({ results: [] });
  });
});
