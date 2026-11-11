import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/** Starts the real stdio MCP server and talks to it the way Claude Code would. */
describe('MCP server (stdio)', () => {
  let client: Client;

  beforeAll(async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'review-mcp-'));
    client = new Client({ name: 'test', version: '1.0.0' });
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [path.resolve('node_modules/tsx/dist/cli.mjs'), path.resolve('src/mcp-stdio.ts')],
        env: { ...(process.env as Record<string, string>), OUT_DIR: path.join(dir, 'out'), REPORTS_DIR: path.join(dir, 'reports') }
      })
    );
  }, 30000);

  afterAll(async () => client?.close());

  it('lists the five tools', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(['get_application', 'list_pending', 'save_recommendation', 'view_diploma', 'write_report']);
  });

  it('returns the diploma as an image content block over MCP', async () => {
    const res = (await client.callTool({ name: 'view_diploma', arguments: { uid: 'syn-ap-01' } })) as { content: { type: string; mimeType?: string }[] };
    expect(res.content[0]).toMatchObject({ type: 'image', mimeType: 'image/png' });
  });
});
