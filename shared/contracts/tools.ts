import { z } from 'zod';

// ── Search Docs ──────────────────────────────────────────

export const SearchDocsInput = z.object({
  query: z.string().min(1, 'query must not be empty'),
});

export const DocResult = z.object({
  title: z.string(),
  url: z.string(),
  snippet: z.string(),
});

export const SearchDocsOutput = z.object({
  results: z.array(DocResult),
});

// ── npm Package ──────────────────────────────────────────

export const NpmPackageInput = z.object({
  query: z.string().min(1, 'query must not be empty'),
});

export const NpmPackageResult = z.object({
  name: z.string(),
  version: z.string(),
  description: z.string().optional(),
  stars: z.number().int().nonnegative(),
});

export const NpmPackageOutput = z.object({
  results: z.array(NpmPackageResult),
});

// ── GitHub Issue ─────────────────────────────────────────

export const GithubIssueInput = z.object({
  query: z.string().min(1, 'query must not be empty'),
});

export const GithubIssueResult = z.object({
  title: z.string(),
  url: z.string(),
  number: z.number().int().positive(),
  state: z.string(),
  repo: z.string(),
  snippet: z.string().optional(),
});

export const GithubIssueOutput = z.object({
  results: z.array(GithubIssueResult),
});

// ── Slack Search ─────────────────────────────────────────

export const SlackSearchInput = z.object({
  query: z.string().min(1, 'query must not be empty'),
});

export const SlackMessageResult = z.object({
  channel: z.string(),
  user: z.string(),
  text: z.string(),
  permalink: z.string(),
  ts: z.string(),
});

export const SlackSearchOutput = z.object({
  results: z.array(SlackMessageResult),
});
