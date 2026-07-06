import { z } from 'zod';
import { SynthesisOutput } from '@context-bridge/shared/contracts/synthesis';

type SynthesisOutputType = z.infer<typeof SynthesisOutput>;

type SlackBlock =
  | { type: 'section'; text: { type: 'mrkdwn'; text: string }; accessory?: SlackAccessory }
  | { type: 'divider' }
  | { type: 'actions'; elements: SlackAccessory[] };

type SlackAccessory = {
  type: 'button';
  text: { type: 'plain_text'; text: string };
  url: string;
  action_id: string;
};

export type SlackBlockKitMessage = {
  blocks: SlackBlock[];
};

const EMOJI_BY_TYPE: Record<string, string> = {
  docs: '📚',
  slack: '💬',
  github: '🐙',
  npm: '📦',
};

const TYPE_LABELS: Record<string, string> = {
  docs: 'Documentation',
  slack: 'Slack',
  github: 'GitHub',
  npm: 'npm',
};

/**
 * Converts a SynthesisOutput into Slack Block Kit JSON.
 *
 * Anti-slop: the synthesis summary is the first block — no generic intro.
 * Degraded sections show a ⚠️ warning instead of normal content.
 */
export function buildBlockKitResponse(output: SynthesisOutputType): SlackBlockKitMessage {
  const blocks: SlackBlock[] = [];

  // Section 0: Synthesis summary (the answer itself)
  blocks.push({
    type: 'section',
    text: { type: 'mrkdwn', text: output.summary },
  });

  blocks.push({ type: 'divider' });

  // Source sections
  for (const section of output.sections) {
    const emoji = EMOJI_BY_TYPE[section.type] ?? '📌';

    if (section.degraded) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `⚠️ *${emoji} ${TYPE_LABELS[section.type] ?? section.type}* — _No data available from this source._`,
        },
      });
    } else {
      const text = `*${emoji} ${section.heading}*\n${section.summary}`;

      const block: SlackBlock = {
        type: 'section',
        text: { type: 'mrkdwn', text },
      };

      if (section.permalink) {
        block.accessory = {
          type: 'button',
          text: { type: 'plain_text', text: 'View source' },
          url: section.permalink,
          action_id: `source_link_${section.type}`,
        };
      }

      blocks.push(block);
    }
  }

  blocks.push({ type: 'divider' });

  return { blocks };
}
