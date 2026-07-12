import { describe, it, expect, beforeEach, vi } from 'vitest';
import supertest from 'supertest';
import { app } from '../index.js';

describe('JSON-RPC 2.0 Dispatcher', () => {
  const request = supertest(app);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('responds with jsonrpc 2.0 and id on valid tools/call request', async () => {
    const res = await request
      .post('/rpc')
      .send({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: 'search_docs', arguments: { query: 'react' } },
        id: 1,
      });

    expect(res.status).toBe(200);
    expect(res.body.jsonrpc).toBe('2.0');
    expect(res.body.id).toBe(1);
    expect(res.body.result).toBeDefined();
    expect(res.body.result.content).toBeInstanceOf(Array);
  });

  it('responds with jsonrpc 2.0 and id for get_npm_package', async () => {
    const res = await request
      .post('/rpc')
      .send({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: 'get_npm_package', arguments: { query: 'react' } },
        id: 2,
      });

    expect(res.status).toBe(200);
    expect(res.body.jsonrpc).toBe('2.0');
    expect(res.body.id).toBe(2);
    expect(res.body.result).toBeDefined();
  });

  it('returns error for unknown method', async () => {
    const res = await request
      .post('/rpc')
      .send({
        jsonrpc: '2.0',
        method: 'unknown_method',
        id: 1,
      });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe(-32601);
    expect(res.body.id).toBe(1);
  });

  it('returns error for missing id', async () => {
    const res = await request
      .post('/rpc')
      .send({
        jsonrpc: '2.0',
        method: 'tools/call',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(-32600);
  });

  it('returns error for unknown tool', async () => {
    const res = await request
      .post('/rpc')
      .send({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: 'nonexistent_tool' },
        id: 2,
      });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe(-32601);
    expect(res.body.error.message).toContain('nonexistent_tool');
  });

  it('returns error for missing tool name', async () => {
    const res = await request
      .post('/rpc')
      .send({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {},
        id: 3,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(-32602);
  });

  it('returns error for invalid jsonrpc version', async () => {
    const res = await request
      .post('/rpc')
      .send({
        jsonrpc: '1.0',
        method: 'tools/call',
        params: { name: 'search_docs', arguments: { query: 'test' } },
        id: 4,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(-32600);
  });

  it('returns error for missing body', async () => {
    const res = await request.post('/rpc').send();

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(-32600);
  });

  it('handles handler error gracefully (500)', async () => {
    // Force an error by passing invalid Zod input
    const res = await request
      .post('/rpc')
      .send({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: 'get_npm_package', arguments: { query: '' } },
        id: 5,
      });

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe(-32603);
  });
});
