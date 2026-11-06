/** LinkedIn Easy Apply E2E suite — @author Li Jiang (Richard) */
import fs from 'node:fs';
import path from 'node:path';

const LOG_DIR = path.resolve(process.cwd(), 'logs');
fs.mkdirSync(LOG_DIR, { recursive: true });

const runId = new Date().toISOString().replace(/[:.]/g, '-');
const logFile = path.join(LOG_DIR, `run-${runId}.log`);

type Level = 'INFO' | 'WARN' | 'ERROR';

function write(level: Level, message: string, meta?: Record<string, unknown>): void {
  const entry = { ts: new Date().toISOString(), level, message, ...(meta ?? {}) };
  fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');
  const suffix = meta ? ` ${JSON.stringify(meta)}` : '';
  // eslint-disable-next-line no-console
  console.log(`[${entry.ts}] [${level}] ${message}${suffix}`);
}

/**
 * Structured JSON-lines logger. Every run writes logs/run-<timestamp>.log which
 * is uploaded as a CI artifact next to the Playwright report, so failures can
 * be correlated between console output, trace and this file.
 */
export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => write('INFO', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => write('WARN', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => write('ERROR', message, meta),
  logFile,
};
