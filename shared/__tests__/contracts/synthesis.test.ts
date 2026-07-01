import { describe, it, expect } from 'vitest';
import {
  SourceSection,
  SynthesisInput,
  SynthesisOutput,
  DocResult,
  SlackMessage,
  GithubIssue,
  NpmPackage,
} from '../../contracts/synthesis.js';

// ── SourceSection ────────────────────────────────────────

describe('SourceSection', () => {
  it('accepts valid section without permalink', () => {
    const section = {
      type: 'docs',
      heading: 'React Error Boundaries',
      summary: 'Error boundaries catch errors in lifecycle methods...',
    };
    expect(SourceSection.parse(section)).toEqual({ ...section, degraded: false });
  });

  it('accepts valid section with permalink', () => {
    const section = {
      type: 'github',
      heading: 'Issue #1234',
      summary: 'React 19 deprecates componentDidCatch',
      permalink: 'https://github.com/facebook/react/issues/1234',
    };
    expect(SourceSection.parse(section)).toEqual({ ...section, degraded: false });
  });

  it('accepts degraded section', () => {
    const section = {
      type: 'npm',
      heading: 'npm search timed out',
      summary: 'Results unavailable',
      degraded: true,
    };
    expect(SourceSection.parse(section)).toEqual(section);
  });

  it('rejects invalid type', () => {
    expect(() =>
      SourceSection.parse({
        type: 'twitter',
        heading: 'X',
        summary: 'Not allowed',
      }),
    ).toThrow();
  });

  it('rejects missing heading', () => {
    expect(() =>
      SourceSection.parse({ type: 'docs', summary: 'Missing heading' }),
    ).toThrow();
  });
});

// ── SynthesisInput ───────────────────────────────────────

describe('SynthesisInput', () => {
  const validInput = {
    question: 'How do we handle error boundaries in React?',
    sources: {
      docs: [{ title: 'React Docs', url: 'https://react.dev', snippet: 'Error boundaries...' }],
      slack: [
        {
          channel: 'C123',
          user: 'U456',
          text: 'We use react-error-boundary',
          permalink: 'https://slack.com/archives/C123/p789',
          ts: '1719000000.000001',
        },
      ],
      github: [
        {
          title: 'RFC: Error Boundaries',
          url: 'https://github.com/facebook/react/issues/1',
          number: 1,
          state: 'open',
          repo: 'facebook/react',
          snippet: 'Proposal for error boundaries',
        },
      ],
      npm: [
        { name: 'react-error-boundary', version: '4.0.0', stars: 4200, description: 'Wrapper' },
      ],
    },
  };

  it('accepts fully populated input', () => {
    const result = SynthesisInput.parse(validInput);
    expect(result.question).toBe('How do we handle error boundaries in React?');
    expect(result.sources.docs).toHaveLength(1);
    expect(result.sources.slack).toHaveLength(1);
    expect(result.sources.github).toHaveLength(1);
    expect(result.sources.npm).toHaveLength(1);
  });

  it('accepts empty sources arrays', () => {
    const input = {
      question: 'Test',
      sources: { docs: [], slack: [], github: [], npm: [] },
    };
    expect(SynthesisInput.parse(input)).toEqual(input);
  });

  it('rejects missing question', () => {
    expect(() =>
      SynthesisInput.parse({
        sources: { docs: [], slack: [], github: [], npm: [] },
      }),
    ).toThrow();
  });
});

// ── SynthesisOutput ──────────────────────────────────────

describe('SynthesisOutput', () => {
  it('accepts valid output with sections', () => {
    const output = {
      summary: 'Use error boundaries to catch rendering errors...',
      sections: [
        {
          type: 'docs',
          heading: 'React Error Boundaries',
          summary: 'Error boundaries catch errors in lifecycle methods...',
          permalink: 'https://react.dev/error-boundaries',
        },
        {
          type: 'slack',
          heading: 'Team discussion in #frontend',
          summary: 'We use react-error-boundary wrapper',
          degraded: true,
        },
      ],
    };
    const result = SynthesisOutput.parse(output);
    expect(result.summary).toBeTruthy();
    expect(result.sections).toHaveLength(2);
  });

  it('accepts output with empty sections', () => {
    const output = {
      summary: 'Could not find information from any source.',
      sections: [],
    };
    expect(SynthesisOutput.parse(output)).toEqual(output);
  });

  it('rejects missing summary', () => {
    expect(() =>
      SynthesisOutput.parse({ sections: [] }),
    ).toThrow();
  });
});

// ── Individual source types (edge cases) ─────────────────

describe('DocResult', () => {
  it('accepts doc with all fields', () => {
    const doc = { title: 'Guide', url: 'https://example.com', snippet: 'Content' };
    expect(DocResult.parse(doc)).toEqual(doc);
  });

  it('rejects doc with missing url', () => {
    expect(() => DocResult.parse({ title: 'Guide', snippet: 'Content' })).toThrow();
  });
});

describe('SlackMessage', () => {
  it('rejects message with missing ts', () => {
    expect(() =>
      SlackMessage.parse({
        channel: 'C123',
        user: 'U456',
        text: 'Hello',
        permalink: 'https://slack.com/archives/C123/p789',
      }),
    ).toThrow();
  });
});

describe('GithubIssue', () => {
  it('rejects issue with zero number', () => {
    expect(() =>
      GithubIssue.parse({
        title: 'x',
        url: 'https://github.com/x/x/issues/0',
        number: 0,
        state: 'open',
        repo: 'x/x',
      }),
    ).toThrow();
  });
});

describe('NpmPackage', () => {
  it('rejects negative stars', () => {
    expect(() =>
      NpmPackage.parse({ name: 'x', version: '1.0.0', stars: -5 }),
    ).toThrow();
  });
});
