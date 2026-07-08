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

/**
 * Searches Wikipedia for relevant documentation articles.
 * Free API, no auth required — used as real docs source for the hackathon.
 */
async function searchWikipedia(query: string) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=5&origin=*`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Wikipedia API returned ${response.status}`);
  }

  const data = (await response.json()) as {
    query?: { search?: Array<{ title: string; snippet: string; pageid: number }> };
  };

  return (data.query?.search ?? []).map((item) => ({
    title: item.title,
    url: `https://en.wikipedia.org/?curid=${item.pageid}`,
    snippet: item.snippet.replace(/<[^>]+>/g, ''), // strip HTML tags
  }));
}

/**
 * MCP tool handler for `search_docs`.
 *
 * In demo mode (MOCK_RTS=true): returns consistent mock docs for reliable demos.
 * Otherwise: fetches real results from Wikipedia API. Falls back to mock data
 * if the API is unreachable.
 */
export async function searchDocsHandler(args: Record<string, unknown>): Promise<McpToolResponse> {
  const { query } = SearchDocsInput.parse(args);

  // Demo mode: consistent mock data
  if (process.env['MOCK_RTS'] === 'true') {
    const results = getMockResults(query);
    const output = SearchDocsOutput.parse({ results });
    return { content: [{ type: 'text', text: JSON.stringify(output.results) }] };
  }

  // Real mode: try Wikipedia API, fall back to mock
  let results;
  try {
    results = await searchWikipedia(query);
  } catch {
    results = getMockResults(query);
  }

  const output = SearchDocsOutput.parse({ results });
  return { content: [{ type: 'text', text: JSON.stringify(output.results) }] };
}
