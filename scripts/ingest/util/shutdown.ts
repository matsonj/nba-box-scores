// Graceful shutdown handler for SIGINT/SIGTERM

import { logger } from './logger';

const FORCE_EXIT_TIMEOUT_MS = 10_000;

export const shutdownController = new AbortController();
export const shutdownSignal: AbortSignal = shutdownController.signal;

let shutdownRequested = false;

function requestShutdown(signal: string): void {
  if (shutdownRequested) {
    logger.warn('Second signal received, forcing exit', { signal });
    process.exit(1);
  }

  shutdownRequested = true;
  logger.info('Shutdown requested, finishing in-flight work...', { signal });
  shutdownController.abort();

  // Force exit after timeout if graceful shutdown hangs
  setTimeout(() => {
    logger.error('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, FORCE_EXIT_TIMEOUT_MS).unref();
}

process.on('SIGINT', () => requestShutdown('SIGINT'));
process.on('SIGTERM', () => requestShutdown('SIGTERM'));
