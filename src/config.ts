import path from 'node:path';
import { loadProvinces, loadUniversities } from './reference.js';
import { fixtureSource } from './source.js';
import type { ToolContext } from './tools.js';

const env = process.env;

export function loadConfig(log: ToolContext['log']) {
  const ctx: ToolContext = {
    source: fixtureSource(path.resolve(env.APPLICATIONS ?? 'fixtures/applications.json')),
    provinces: loadProvinces(),
    universities: loadUniversities(path.resolve(env.UNIVERSITIES ?? 'fixtures/universities.json')),
    outDir: path.resolve(env.OUT_DIR ?? 'out'),
    reportsDir: path.resolve(env.REPORTS_DIR ?? 'reports'),
    log
  };
  return {
    ctx,
    maxTurns: Number(env.MAX_TURNS ?? 40),
    maxBudgetUsd: Number(env.MAX_BUDGET_USD ?? 1),
    model: env.MODEL,
    logFile: path.resolve(env.LOG_DIR ?? 'logs', `run-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`)
  };
}
