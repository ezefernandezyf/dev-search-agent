import { NpmPackageInput, NpmPackageOutput } from '@context-bridge/shared/contracts/tools';

interface McpToolResponse {
  content: Array<{ type: 'text'; text: string }>;
}

/**
 * MCP tool handler for `get_npm_package`.
 *
 * Returns mock npm package data in demo mode (MOCK_RTS=true).
 * In production, fetches from the npm registry search API.
 */
export async function getNpmPackageHandler(args: Record<string, unknown>): Promise<McpToolResponse> {
  const { query } = NpmPackageInput.parse(args);

  // Mock mode for reliable hackathon demo
  if (process.env['MOCK_RTS'] === 'true') {
    const results = [
      {
        name: 'react-error-boundary',
        version: '4.1.2',
        description: 'Reusable React error boundary component. Provides a simple and flexible way to handle JavaScript errors in React components.',
        stars: 4200,
      },
      {
        name: 'react-error-boundary-decorator',
        version: '1.3.0',
        description: 'TypeScript decorator-based alternative to class-based React Error Boundaries.',
        stars: 87,
      },
      {
        name: '@sentry/react',
        version: '8.42.0',
        description: 'Official Sentry SDK for React — includes error boundary integration with automatic error reporting to Sentry.',
        stars: 8200,
      },
    ];
    const output = NpmPackageOutput.parse({ results: results.filter(() => true) });
    return { content: [{ type: 'text', text: JSON.stringify(output.results) }] };
  }

  const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=5`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`npm registry returned ${response.status}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await response.json()) as {
    objects?: Array<{
      package: { name: string; version: string; description?: string };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      score?: { detail?: { popularity?: number } };
    }>;
  };

  const results = (data.objects ?? []).map((item) => ({
    name: item.package.name,
    version: item.package.version,
    description: item.package.description,
    stars: Math.round((item.score?.detail?.popularity ?? 0) * 100_000),
  }));

  const output = NpmPackageOutput.parse({ results });
  return {
    content: [{ type: 'text', text: JSON.stringify(output.results) }],
  };
}
