// Adaptive rate limiter for API request dispatch
// Singleton: controls the interval between dispatching requests off the queue
//
// Multiple requests can be in-flight simultaneously — this only gates
// how fast we dispatch them.
//
// Uses a serializing promise chain so concurrent acquire() calls
// are queued and each waits the correct interval after the previous.
//
// Continuously adapts based on a rolling window of results:
// - Clean window (0% errors): speed up aggressively
// - Low error rate (<10%): still speed up gently (isolated errors are normal)
// - High error rate (>10%): slow down
// - Always probing: checks every 8 successes, so it recovers quickly
//   after a transient error and adapts to changing server load

import { logger } from '../util/logger';

let delayMs = 500;
let minDelayMs = 200;
let maxDelayMs = 10_000;

// Serializing chain: each acquire() waits for the previous to finish
let acquireChain = Promise.resolve();
let lastDispatchTime = 0;

// Rolling window of recent outcomes: true = success, false = throttle
const WINDOW_SIZE = 15;
const outcomes: boolean[] = [];

const AGGRESSIVE_SPEEDUP = 0.85; // -15% on clean window
const GENTLE_SPEEDUP = 0.95; // -5% on mostly-clean window
const MODERATE_SLOWDOWN = 1.5; // +50% on isolated error
const AGGRESSIVE_SLOWDOWN = 2.0; // +100% on sustained errors
const ERROR_RATE_HIGH = 0.1; // >10% triggers aggressive slowdown
const PROBE_INTERVAL = 8; // check every 8 successes

let successesSinceLastProbe = 0;

/** Configure the adaptive throttle parameters */
export function configure(opts: {
  baseDelay?: number;
  minDelay?: number;
  maxDelay?: number;
}): void {
  if (opts.baseDelay !== undefined) delayMs = opts.baseDelay;
  if (opts.minDelay !== undefined) minDelayMs = opts.minDelay;
  if (opts.maxDelay !== undefined) maxDelayMs = opts.maxDelay;
}

function pushOutcome(success: boolean): void {
  outcomes.push(success);
  if (outcomes.length > WINDOW_SIZE) {
    outcomes.shift();
  }
}

function getErrorRate(): number {
  if (outcomes.length === 0) return 0;
  const errors = outcomes.filter(o => !o).length;
  return errors / outcomes.length;
}

/**
 * Wait until it is safe to dispatch the next request.
 * Serialized: concurrent callers queue up so each waits the
 * correct interval after the previous dispatch.
 */
export async function acquire(): Promise<void> {
  const ticket = acquireChain.then(async () => {
    const now = Date.now();
    const elapsed = now - lastDispatchTime;
    const waitMs = delayMs - elapsed;
    if (waitMs > 0) {
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
    lastDispatchTime = Date.now();
  });
  acquireChain = ticket.catch(() => { /* keep chain alive on errors */ });
  await ticket;
}

/** Call after a successful API response */
export function recordSuccess(): void {
  pushOutcome(true);
  successesSinceLastProbe++;

  if (successesSinceLastProbe >= PROBE_INTERVAL) {
    successesSinceLastProbe = 0;
    const errorRate = getErrorRate();
    const prev = delayMs;

    if (errorRate === 0 && outcomes.length >= PROBE_INTERVAL) {
      // Perfectly clean window — aggressive speedup
      delayMs = Math.max(minDelayMs, Math.round(delayMs * AGGRESSIVE_SPEEDUP));
    } else if (errorRate < ERROR_RATE_HIGH) {
      // Mostly clean (isolated errors) — still speed up gently
      delayMs = Math.max(minDelayMs, Math.round(delayMs * GENTLE_SPEEDUP));
    }
    // else: high error rate — hold steady, let slowdowns from recordThrottle handle it

    if (delayMs < prev) {
      logger.debug('Throttle speedup', {
        delayMs,
        previousDelay: prev,
        errorRate: `${(errorRate * 100).toFixed(0)}%`,
      });
    }
  }
}

/** Call after a 503/429 to back off */
export function recordThrottle(): void {
  pushOutcome(false);
  // Don't reset successesSinceLastProbe — let the probe fire soon
  // so we can recover quickly once the errors pass

  const errorRate = getErrorRate();
  const prev = delayMs;

  if (errorRate > ERROR_RATE_HIGH) {
    delayMs = Math.min(maxDelayMs, Math.round(delayMs * AGGRESSIVE_SLOWDOWN));
  } else {
    delayMs = Math.min(maxDelayMs, Math.round(delayMs * MODERATE_SLOWDOWN));
  }

  logger.warn('Throttle slowdown', {
    delayMs,
    previousDelay: prev,
    errorRate: `${(errorRate * 100).toFixed(0)}%`,
  });
}

/** Get the current dispatch delay */
export function getCurrentDelay(): number {
  return delayMs;
}
