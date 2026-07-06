import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { buildBlockKitResponse } from '../response.js';
import { SynthesisOutput } from '@context-bridge/shared/contracts/synthesis.js';

type SynthesisOutputType = z.infer<typeof SynthesisOutput>;

const fullOutput: SynthesisOutputType = {
  summary:
    'Error boundaries are React components that catch JavaScript errors in their child component tree, log those errors, and display a fallback UI.',
  sections: [
    {
      type: 'docs',
      heading: 'React Error Boundaries',
      summary: 'Official docs explain componentDidCatch and getDerivedStateFromError.',
      permalink: 'https://react.dev/error-boundaries',
      degraded: false,
    },
    {
      type: 'slack',
      heading: '#react discussion',
      summary: 'Team recommends react-error-boundary package.',
      permalink: 'https://slack.com/archives/C001/p123',
      degraded: false,
    },
    {
      type: 'github',
      heading: 'Async error boundaries',
      summary: 'Known issue with async error handling in concurrent mode.',
      permalink: 'https://github.com/facebook/react/issues/123',
      degraded: false,
    },
    {
      type: 'npm',
      heading: 'react-error-boundary',
      summary: 'Popular package (5k stars) with useErrorBoundary hook.',
      degraded: false,
    },
  ],
};

const emojiMap: Record<string, string> = {
  docs: '📚',
  slack: '💬',
  github: '🐙',
  npm: '📦',
};

type SectionBlock = { type: 'section'; text: { type: 'mrkdwn'; text: string } };

function getSectionText(block: unknown): string | undefined {
  if (
    typeof block === 'object' &&
    block !== null &&
    'type' in block &&
    block.type === 'section' &&
    'text' in block &&
    typeof block.text === 'object' &&
    block.text !== null &&
    'text' in block.text
  ) {
    return (block.text as { text: string }).text;
  }
  return undefined;
}

describe('buildBlockKitResponse', () => {
  it('returns an object with blocks array', () => {
    const result = buildBlockKitResponse(fullOutput);
    expect(result).toHaveProperty('blocks');
    expect(Array.isArray(result.blocks)).toBe(true);
  });

  it('starts with the synthesis summary as the first section (anti-slop)', () => {
    const result = buildBlockKitResponse(fullOutput);
    const firstBlock = result.blocks[0];
    expect(firstBlock).toBeDefined();

    expect(firstBlock?.type).toBe('section');
    const text = getSectionText(firstBlock);
    expect(text).toBeDefined();
    expect(text).toContain('Error boundaries are React components');
    // Anti-slop: no generic intro
    expect(text?.toLowerCase()).not.toContain("here's what i found");
    expect(text?.toLowerCase()).not.toContain('based on the sources');
  });

  it('includes a divider after the summary', () => {
    const result = buildBlockKitResponse(fullOutput);
    const secondBlock = result.blocks[1];
    expect(secondBlock).toBeDefined();
    expect(secondBlock?.type).toBe('divider');
  });

  it('renders all 4 source sections with correct emoji headers', () => {
    const result = buildBlockKitResponse(fullOutput);
    const sectionBlocks = result.blocks.filter(
      (b): b is SectionBlock =>
        b.type === 'section' && typeof (b as SectionBlock).text?.text === 'string',
    );

    // First section is summary, next 4 are source sections
    for (let i = 0; i < 4; i++) {
      const section = fullOutput.sections[i];
      expect(section).toBeDefined();
      const block = sectionBlocks[i + 1];
      expect(block).toBeDefined();
      if (section && block) {
        const emoji = emojiMap[section.type];
        expect(block.text.text).toContain(emoji);
        expect(block.text.text).toContain(section.heading);
      }
    }
  });

  it('includes permalinks as button links when present', () => {
    const result = buildBlockKitResponse(fullOutput);
    const allText = JSON.stringify(result.blocks);

    expect(allText).toContain('https://react.dev/error-boundaries');
    expect(allText).toContain('https://slack.com/archives/C001/p123');
    expect(allText).toContain('https://github.com/facebook/react/issues/123');
  });

  it('shows warning marker for degraded sections', () => {
    const degradedOutput: SynthesisOutputType = {
      summary: 'Summary text.',
      sections: [
        {
          type: 'docs',
          heading: 'Documentation',
          summary: 'No docs found.',
          degraded: true,
        },
        {
          type: 'slack',
          heading: '#general',
          summary: 'Found relevant discussion.',
          permalink: 'https://slack.com/archives/C001/p999',
          degraded: false,
        },
        {
          type: 'github',
          heading: 'GitHub',
          summary: 'No issues found.',
          degraded: true,
        },
        {
          type: 'npm',
          heading: 'react-error-boundary',
          summary: 'Package info.',
          degraded: false,
        },
      ],
    };

    const result = buildBlockKitResponse(degradedOutput);
    const allText = JSON.stringify(result.blocks);

    // Degraded sections should have warning marker
    expect(allText).toContain('⚠️');

    // Find degraded section blocks
    const degradedBlocks = result.blocks.filter(
      (b) => b.type === 'section' && getSectionText(b)?.includes('⚠️') === true,
    );
    expect(degradedBlocks.length).toBe(2); // docs and github are degraded
  });

  it('ends with a divider at the end', () => {
    const result = buildBlockKitResponse(fullOutput);

    // Should have at least 2 dividers: after summary + at end
    const dividers = result.blocks.filter((b) => b.type === 'divider');
    expect(dividers.length).toBeGreaterThanOrEqual(2);
  });

  it('does not add any generic intro text (anti-slop enforcement)', () => {
    const result = buildBlockKitResponse(fullOutput);
    const allText = JSON.stringify(result.blocks).toLowerCase();

    expect(allText).not.toContain("here's what i found");
    expect(allText).not.toContain('i hope this helps');
    expect(allText).not.toContain('based on the');
    expect(allText).not.toContain('let me know if');
  });
});
