import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config.js';
import { callTool, toolDefs, type ToolName } from './schema.js';
import { createTools } from './tools.js';

/**
 * The same tools as a standalone MCP server, e.g. for Claude Code:
 *   claude mcp add fizyonubul-review -- npx tsx /path/to/repo/src/mcp-stdio.ts
 */
const cfg = loadConfig((e) => console.error(JSON.stringify(e))); // stdout belongs to the MCP protocol
const tools = createTools(cfg.ctx);
const server = new McpServer({ name: 'fizyonubul-review', version: '0.1.0' });

for (const name of Object.keys(toolDefs) as ToolName[]) {
  server.registerTool(
    name,
    { description: toolDefs[name].description, inputSchema: toolDefs[name].shape },
    (args: unknown) => callTool(tools, name, args)
  );
}

await server.connect(new StdioServerTransport());
