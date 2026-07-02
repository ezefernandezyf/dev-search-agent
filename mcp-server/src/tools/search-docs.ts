import { SearchDocsInput, SearchDocsOutput } from '@context-bridge/shared/contracts/tools.js';

interface McpToolResponse {
  content: Array<{ type: 'text'; text: string }>;
}

/**
 * MCP tool handler for `search_docs`.
 *
 * Returns mock documentation results for hackathon reliability.
 * In production, this would call DuckDuckGo Instant Answer API or MDN docs.
 */
export async function searchDocsHandler(args: Record<string, unknown>): Promise<McpToolResponse> {
  const { query } = SearchDocsInput.parse(args);

  const results = [
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

  const output = SearchDocsOutput.parse({ results });
  return {
    content: [{ type: 'text', text: JSON.stringify(output.results) }],
  };
}
