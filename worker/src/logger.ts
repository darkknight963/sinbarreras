type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  ts: string;
  level: LogLevel;
  msg: string;
  context?: string;
  [key: string]: unknown;
}

function log(level: LogLevel, context: string, msg: string, extra?: Record<string, unknown>): void {
  const entry: LogEntry = {
    ts: new Date().toISOString(),
    level,
    context,
    msg,
    ...extra,
  };
  const line = JSON.stringify(entry);
  if (level === 'error') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

export function createLogger(context: string) {
  return {
    info: (msg: string, extra?: Record<string, unknown>) => log('info', context, msg, extra),
    warn: (msg: string, extra?: Record<string, unknown>) => log('warn', context, msg, extra),
    error: (msg: string, extra?: Record<string, unknown>) => log('error', context, msg, extra),
    debug: (msg: string, extra?: Record<string, unknown>) => {
      if (process.env.LOG_LEVEL === 'debug') log('debug', context, msg, extra);
    },
  };
}
