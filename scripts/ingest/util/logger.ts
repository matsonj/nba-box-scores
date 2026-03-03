// Structured logging utility for the ingestion pipeline

let verboseEnabled = false;

function timestamp(): string {
  return new Date().toISOString();
}

function formatContext(context?: Record<string, unknown>): string {
  if (!context || Object.keys(context).length === 0) return '';
  const pairs = Object.entries(context)
    .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join(' ');
  return ` ${pairs}`;
}

function write(level: string, message: string, context?: Record<string, unknown>): void {
  const line = `${timestamp()} [${level}] ${message}${formatContext(context)}\n`;
  if (level === 'ERROR') {
    process.stderr.write(line);
  } else {
    process.stdout.write(line);
  }
}

export const logger = {
  setVerbose(enabled: boolean): void {
    verboseEnabled = enabled;
  },

  debug(msg: string, ctx?: Record<string, unknown>): void {
    if (!verboseEnabled) return;
    write('DEBUG', msg, ctx);
  },

  info(msg: string, ctx?: Record<string, unknown>): void {
    write('INFO', msg, ctx);
  },

  warn(msg: string, ctx?: Record<string, unknown>): void {
    write('WARN', msg, ctx);
  },

  error(msg: string, ctx?: Record<string, unknown>): void {
    write('ERROR', msg, ctx);
  },

  /** Overwrite the current line with a progress update (TTY only) */
  progress(msg: string): void {
    if (process.stdout.isTTY) {
      process.stdout.write(`\r\x1b[K${msg}`);
    }
  },
};
