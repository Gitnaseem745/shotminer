import { logger } from './logger.js';

export interface RetryOptions {
  maxRetries: number;
  baseDelayMs?: number;   // Base delay for exponential backoff (default: 500)
  maxDelayMs?: number;    // Cap on delay (default: 10000)
}

/**
 * Wraps an async function with retry logic using exponential backoff + jitter.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  opts: RetryOptions
): Promise<T> {
  const { maxRetries, baseDelayMs = 500, maxDelayMs = 10000 } = opts;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      if (attempt > maxRetries) {
        logger.error(`[Retry] ${label} — all ${maxRetries} retries exhausted. Giving up.`);
        throw error;
      }

      // Exponential backoff: base * 2^(attempt-1) + random jitter
      const delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
      const jitter = Math.floor(Math.random() * delay * 0.3);
      const totalDelay = delay + jitter;

      logger.warn(`[Retry] ${label} — attempt ${attempt} failed: ${error.message}. Retrying in ${totalDelay}ms...`);
      await new Promise(resolve => setTimeout(resolve, totalDelay));
    }
  }

  // Should never reach here, but TypeScript needs it
  throw new Error(`[Retry] ${label} — unexpected retry loop exit`);
}
