import { NpmPackageInput, NpmPackageOutput } from '@context-bridge/shared/contracts/tools.js';

interface McpToolResponse {
  content: Array<{ type: 'text'; text: string }>;
}

/**
 * MCP tool handler for `get_npm_package`.
 *
 * Fetches package results from the npm registry search API.
 * Maps popularity score to approximate star counts.
 */
export async function getNpmPackageHandler(args: Record<string, unknown>): Promise<McpToolResponse> {
  const { query } = NpmPackageInput.parse(args);

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
