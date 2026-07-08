import { z } from 'zod';
import { SynthesisInput, SynthesisOutput } from '@context-bridge/shared/contracts/synthesis';

type SynthesisInputType = z.infer<typeof SynthesisInput>;
type SynthesisOutputType = z.infer<typeof SynthesisOutput>;

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = process.env['GROQ_MODEL'] ?? 'llama-3.1-8b-instant';

const SYSTEM_PROMPT = `You are a senior developer synthesizing information from multiple sources to answer a technical question.

RULES:
- Return ONLY valid JSON matching the SynthesisOutput schema.
- The "summary" field IS the answer. Write it as a direct, concise technical response.
- NO "Here's what I found" — start directly with the answer.
- NO "I hope this helps" — no filler closings.
- NO "Based on the sources" — no meta-commentary about where info came from.
- The synthesis IS the header — start with the actual answer.
- For each source section, write a brief summary of what that source contributes.
- Set "degraded: true" for a section only if that source had no useful data.
- Include a "permalink" in a section only if the source provided a relevant link.

OUTPUT SCHEMA:
{
  "summary": string,
  "sections": [
    { "type": "docs"|"slack"|"github"|"npm", "heading": string, "summary": string, "permalink"?: string, "degraded": boolean }
  ]
}`;

async function callGroqApi(
  input: SynthesisInputType,
  apiKey: string,
): Promise<SynthesisOutputType> {
  const userMessage = `Question: ${input.question}\n\nSources:\n${JSON.stringify(input.sources, null, 2)}`;

  const response = await fetch(GROQ_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  const content = data.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Groq API returned empty response');
  }

  const parsed: unknown = JSON.parse(content);
  return SynthesisOutput.parse(parsed);
}

/**
 * Pre-written mock synthesis for reliable hackathon demo.
 * Activated by MOCK_SYNTHESIS=true env var.
 */
function getMockSynthesis(input: SynthesisInputType): SynthesisOutputType {
  const degraded = (type: string) =>
    (input.sources[type as keyof typeof input.sources] as unknown[]).length === 0;

  return {
    summary:
      'Error boundaries are React components that catch JavaScript errors anywhere in their child component tree, logging those errors and displaying a fallback UI instead of crashing the entire app. Implement them by creating a class component with `componentDidCatch` and `getDerivedStateFromError`, or use the lightweight `react-error-boundary` library which provides a cleaner hook-based API with `FallbackComponent` and `resetKeys` for recovery. For comprehensive coverage, wrap route-level components, pair with `React.Suspense` for loading/error/empty state patterns, and combine with try/catch at data fetching layers since error boundaries do not catch async errors.',
    sections: [
      {
        type: 'docs',
        heading: 'React Documentation',
        summary:
          'Official React docs describe error boundaries as components that catch errors during rendering, in lifecycle methods, and in constructors. They must be class components implementing either `static getDerivedStateFromError()` or `componentDidCatch()`.',
        permalink: 'https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary',
        degraded: degraded('docs'),
      },
      {
        type: 'slack',
        heading: 'Team Discussion',
        summary:
          'The team has been using error boundaries since React 16. Key takeaways: wrap route-level components, `react-error-boundary` by Brian Vaughn cut crash reports by 60%, and combining with React.Suspense creates a clean declarative pattern.',
        permalink: 'https://slack.com/archives/C12345/p12345',
        degraded: degraded('slack'),
      },
      {
        type: 'github',
        heading: 'GitHub: Error Boundary Patterns',
        summary:
          'Popular React repos show error boundaries paired with server-side auth for dashboard apps, using `react-query` for data fetching with error states, and catching nullish route params in React Router to prevent white screens.',
        permalink: 'https://github.com/bvaughn/react-error-boundary',
        degraded: degraded('github'),
      },
      {
        type: 'npm',
        heading: 'npm: react-error-boundary',
        summary:
          '`react-error-boundary` v4 — the standard community wrapper with 4.2k+ stars. Provides `ErrorBoundary` component, `useErrorBoundary` hook, and `withErrorBoundary` HOC. Much cleaner than the class-based approach.',
        permalink: 'https://www.npmjs.com/package/react-error-boundary',
        degraded: degraded('npm'),
      },
    ],
  };
}

/**
 * Synthesizes search results from 4 sources into a structured answer using Groq API.
 * Retries once on 5xx errors. Throws on total failure — caller handles fallback.
 */
export async function synthesize(input: SynthesisInputType): Promise<SynthesisOutputType> {
  // Mock mode for reliable hackathon demo
  if (process.env['MOCK_SYNTHESIS'] === 'true') {
    SynthesisInput.parse(input);
    return getMockSynthesis(input);
  }

  const apiKey = process.env['GROQ_API_KEY'];
  if (!apiKey) {
    throw new Error('GROQ_API_KEY environment variable is not set');
  }

  // Validate input
  SynthesisInput.parse(input);

  try {
    return await callGroqApi(input, apiKey);
  } catch (firstError) {
    // Retry once on 5xx errors
    if (firstError instanceof Error && firstError.message.includes('Groq API error: 5')) {
      return callGroqApi(input, apiKey);
    }
    throw firstError;
  }
}
