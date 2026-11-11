/**
 * The agent can only call its own five tools. None of them can change an application:
 * the admin makes every decision in the FizyonuBul admin app.
 */
export const SERVER = 'review';
export const mcpName = (tool: string) => `mcp__${SERVER}__${tool}`;
export const TOOLS = ['list_pending', 'get_application', 'view_diploma', 'save_recommendation', 'write_report'];

export type Decision = { behavior: 'allow' } | { behavior: 'deny'; message: string };

export function decide(toolName: string): Decision {
  const prefix = `mcp__${SERVER}__`;
  if (toolName.startsWith(prefix) && TOOLS.includes(toolName.slice(prefix.length))) return { behavior: 'allow' };
  return { behavior: 'deny', message: `${toolName} is not available to this agent.` };
}
