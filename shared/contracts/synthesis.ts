import { z } from 'zod';

// ── Synthesis Source Types ───────────────────────────────

export const DocResult = z.object({
  title: z.string(),
  url: z.string(),
  snippet: z.string(),
});

export const SlackMessage = z.object({
  channel: z.string(),
  user: z.string(),
  text: z.string(),
  permalink: z.string(),
  ts: z.string(),
});

export const GithubIssue = z.object({
  title: z.string(),
  url: z.string(),
  number: z.number().int().positive(),
  state: z.string(),
  repo: z.string(),
  snippet: z.string().optional(),
});

export const NpmPackage = z.object({
  name: z.string(),
  version: z.string(),
  description: z.string().optional(),
  stars: z.number().int().nonnegative(),
});

// ── Synthesis I/O ────────────────────────────────────────

export const SynthesisInput = z.object({
  question: z.string(),
  sources: z.object({
    docs: z.array(DocResult),
    slack: z.array(SlackMessage),
    github: z.array(GithubIssue),
    npm: z.array(NpmPackage),
  }),
});

export const SourceSection = z.object({
  type: z.enum(['docs', 'slack', 'github', 'npm']),
  heading: z.string(),
  summary: z.string(),
  permalink: z.string().optional(),
  degraded: z.boolean().default(false),
});

export const SynthesisOutput = z.object({
  summary: z.string(),
  sections: z.array(SourceSection),
});
