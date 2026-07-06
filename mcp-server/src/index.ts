import express, { type Request, type Response } from 'express';
import cors from 'cors';
import { searchDocsHandler } from './tools/search-docs.js';
import { getNpmPackageHandler } from './tools/get-npm-package.js';
import { getGithubIssueHandler } from './tools/get-github-issue.js';

const app = express();
const PORT = process.env.PORT ?? 4000;

app.use(cors());
app.use(express.json());

interface JsonRpcRequest {
  jsonrpc: string;
  method: string;
  params?: Record<string, unknown>;
  id: number | string | null;
}

interface JsonRpcResponse {
  jsonrpc: string;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
  id: number | string | null;
}

type ToolResult = {
  content: Array<{ type: string; text: string }>;
};

const toolHandlers: Record<string, (args: Record<string, unknown>) => Promise<ToolResult>> = {
  search_docs: searchDocsHandler,
  get_npm_package: getNpmPackageHandler,
  get_github_issue: getGithubIssueHandler,
};

app.post('/rpc', async (req: Request, res: Response) => {
  const body = req.body as JsonRpcRequest | undefined;

  if (!body || body.jsonrpc !== '2.0' || !body.method || body.id === undefined || body.id === null) {
    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      error: { code: -32600, message: 'Invalid Request' },
      id: body?.id ?? null,
    };
    res.status(400).json(response);
    return;
  }

  const { jsonrpc, method, params, id } = body;

  if (method !== 'tools/call') {
    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      error: { code: -32601, message: 'Method not found' },
      id,
    };
    res.status(404).json(response);
    return;
  }

  const paramsObj = params ?? {};
  const toolName = paramsObj.name as string | undefined;
  const toolArgs = (paramsObj.arguments as Record<string, unknown>) ?? {};

  if (!toolName || typeof toolName !== 'string') {
    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      error: { code: -32602, message: 'Missing or invalid tool name in params.name' },
      id,
    };
    res.status(400).json(response);
    return;
  }

  const handler = toolHandlers[toolName];
  if (!handler) {
    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      error: { code: -32601, message: `Tool not found: ${toolName}` },
      id,
    };
    res.status(404).json(response);
    return;
  }

  try {
    const result = await handler(toolArgs);
    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      result,
      id,
    };
    res.status(200).json(response);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal error';
    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      error: { code: -32603, message },
      id,
    };
    res.status(500).json(response);
  }
});

// Health check endpoint for Render + UptimeRobot
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Only start the server when run directly (not imported by tests)
const isTestEnv = typeof process.env.VITEST !== 'undefined';
if (!isTestEnv) {
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`MCP Server running on http://localhost:${PORT}`);
  });
}

export { app };
