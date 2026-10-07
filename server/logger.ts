/**
 * VideoFetch Leveled Logger
 * Provides structured, leveled logging using process streams.
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

function formatMessage(level: LogLevel, message: string, meta?: any): string {
  const timestamp = new Date().toISOString();
  let text = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  if (meta !== undefined) {
    if (meta instanceof Error) {
      text += `\n${meta.stack || meta.message}`;
    } else if (typeof meta === 'object') {
      try {
        text += ` ${JSON.stringify(meta)}`;
      } catch {
        text += ` [Unserializable Object]`;
      }
    } else {
      text += ` ${meta}`;
    }
  }
  return text + '\n';
}

export const logger = {
  info(message: string, meta?: any): void {
    process.stdout.write(formatMessage('info', message, meta));
  },
  warn(message: string, meta?: any): void {
    process.stderr.write(formatMessage('warn', message, meta));
  },
  error(message: string, meta?: any): void {
    process.stderr.write(formatMessage('error', message, meta));
  },
  debug(message: string, meta?: any): void {
    if (process.env.DEBUG || process.env.NODE_ENV !== 'production') {
      process.stdout.write(formatMessage('debug', message, meta));
    }
  },
  raw(message: string): void {
    process.stdout.write(message + '\n');
  },
};
