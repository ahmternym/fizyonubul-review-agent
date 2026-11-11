import { query, type CanUseTool } from '@anthropic-ai/claude-agent-sdk';
import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { loadConfig } from './config.js';
import { decide, SERVER } from './policy.js';
import { SYSTEM_PROMPT, TASK_PROMPT } from './prompt.js';
import { buildSdkServer } from './sdkServer.js';
import { createTools } from './tools.js';

let logFile = '';
const log = (event: Record<string, unknown>) => {
  if (logFile) appendFileSync(logFile, JSON.stringify({ t: new Date().toISOString(), ...event }) + '\n');
};

const cfg = loadConfig(log);
logFile = cfg.logFile;
mkdirSync(path.dirname(logFile), { recursive: true });
const tools = createTools(cfg.ctx);

const canUseTool: CanUseTool = async (toolName, input) => {
  const d = decide(toolName);
  log({ permission: toolName, decision: d.behavior });
  return d.behavior === 'allow' ? { behavior: 'allow', updatedInput: input } : d;
};

console.log(`FizyonuBul review agent: maxTurns=${cfg.maxTurns} budget=$${cfg.maxBudgetUsd}`);

const run = query({
  prompt: TASK_PROMPT,
  options: {
    systemPrompt: SYSTEM_PROMPT,
    model: cfg.model,
    mcpServers: { [SERVER]: buildSdkServer(tools) },
    tools: [], // no shell, files or web
    canUseTool, // every call goes through policy.ts and is logged
    maxTurns: cfg.maxTurns,
    maxBudgetUsd: cfg.maxBudgetUsd,
    settingSources: [],
    persistSession: false
  }
});

try {
  for await (const msg of run) {
    if (msg.type === 'assistant') {
      for (const block of msg.message.content) {
        if (block.type === 'text' && block.text.trim()) console.log(`\n${block.text.trim()}`);
        if (block.type === 'tool_use') {
          const input = block.input as { uid?: string; decision?: string };
          console.log(`→ ${block.name.replace(`mcp__${SERVER}__`, '')}${input.uid ? ` ${input.uid}` : ''}${input.decision ? ` = ${input.decision}` : ''}`);
          log({ tool_use: block.name, input: block.input });
        }
      }
    } else if (msg.type === 'user') {
      // Log tool errors (e.g. an approve refused by code) so the run can be audited later
      const content = msg.message.content;
      if (Array.isArray(content)) {
        for (const b of content) {
          if (b.type === 'tool_result' && b.is_error) {
            const text = Array.isArray(b.content) ? b.content.map((c) => ('text' in c ? c.text : '')).join(' ') : String(b.content);
            console.log(`  ✗ ${text}`);
            log({ tool_error: text });
          }
        }
      }
    } else if (msg.type === 'result') {
      const summary = { result: msg.subtype, turns: msg.num_turns, cost_usd: Number(msg.total_cost_usd.toFixed(4)) };
      log(summary);
      console.log(`\nDone: ${JSON.stringify(summary)}\nLog: ${path.relative(process.cwd(), logFile)}`);
      if (msg.subtype !== 'success') process.exitCode = 1;
    }
  }
} catch (e) {
  log({ error: String((e as Error).message).slice(0, 300) });
  if (!process.exitCode) {
    console.error(`Agent stopped: ${(e as Error).message.slice(0, 300)}`);
    process.exitCode = 1;
  }
}
