import { SearchDocsInput, SearchDocsOutput } from '@context-bridge/shared/contracts/tools';

interface McpToolResponse {
  content: Array<{ type: 'text'; text: string }>;
}

/**
 * Mock documentation results for consistent hackathon demo.
 * Used when MOCK_RTS=true.
 */
function getMockResults(query: string) {
  return [
    {
      title: `React Documentation: ${query}`,
      url: 'https://react.dev',
      snippet: `Official React documentation about ${query}. Error boundaries are React components that catch JavaScript errors anywhere in their child component tree, logging those errors and displaying a fallback UI.`,
    },
    {
      title: `MDN Web Docs: ${query}`,
      url: `https://developer.mozilla.org/search?q=${encodeURIComponent(query)}`,
      snippet: `MDN reference for ${query}. Comprehensive guide with code examples and best practices for implementing error handling in web applications.`,
    },
    {
      title: `DevHints: ${query}`,
      url: `https://devhints.io/${encodeURIComponent(query)}`,
      snippet: `Community cheatsheet for ${query}. Quick reference with practical examples and common patterns used by developers.`,
    },
  ];
}

interface StackOverflowItem {
  title: string;
  link: string;
  score: number;
  is_answered: boolean;
  answer_count: number;
  tags: string[];
  question_id: number;
}

/**
 * Searches Stack Overflow for programming documentation.
 * Free API, no auth required (300 req/day). Returns real developer Q&A.
 */
async function searchStackOverflow(query: string) {
  const url = `https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&q=${encodeURIComponent(query)}&site=stackoverflow&pagesize=5&key=U4DMV*8nvpm3EOpvf69Rxw((`;

  const response = await fetch(url, {
    headers: { 'Accept-Encoding': 'gzip' },
  });

  if (!response.ok) {
    throw new Error(`Stack Exchange API returned ${response.status}`);
  }

  const data = (await response.json()) as { items?: StackOverflowItem[] };

  return (data.items ?? []).map((item) => ({
    title: `${item.is_answered ? '✓ ' : ''}${item.title} (⭐${item.score})`,
    url: item.link,
    snippet: `Stack Overflow — ${item.answer_count} answer${item.answer_count !== 1 ? 's' : ''}. Tags: ${item.tags.slice(0, 3).join(', ')}`,
  }));
}

/**
 * MCP tool handler for `search_docs`.
 *
 * In demo mode (MOCK_RTS=true): returns consistent mock docs for reliable demos.
 * Otherwise: fetches real results from Stack Overflow API. Falls back to mock
 * data if the API is unreachable or rate-limited.
 */
export async function searchDocsHandler(args: Record<string, unknown>): Promise<McpToolResponse> {
  const { query } = SearchDocsInput.parse(args);

  // Demo mode: consistent mock data
  if (process.env['MOCK_RTS'] === 'true') {
    const results = getMockResults(query);
    const output = SearchDocsOutput.parse({ results });
    return { content: [{ type: 'text', text: JSON.stringify(output.results) }] };
  }

  // Real mode: try Stack Overflow API, fall back to mock
  let results;
  try {
    results = await searchStackOverflow(query);
  } catch {
    results = getMockResults(query);
  }

  const output = SearchDocsOutput.parse({ results });
  return { content: [{ type: 'text', text: JSON.stringify(output.results) }] };
}
