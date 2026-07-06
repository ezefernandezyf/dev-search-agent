import { z } from 'zod';
import { SynthesisInput, SynthesisOutput } from '@context-bridge/shared/contracts/synthesis';

type SynthesisInputType = z.infer<typeof SynthesisInput>;
type SynthesisOutputType = z.infer<typeof SynthesisOutput>;

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

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
 * Synthesizes search results from 4 sources into a structured answer using Groq API.
 * Retries once on 5xx errors. Throws on total failure — caller handles fallback.
 */
export async function synthesize(input: SynthesisInputType): Promise<SynthesisOutputType> {
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
