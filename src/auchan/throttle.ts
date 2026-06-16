const DEFAULT_MIN_INTERVAL_MS = 1000;
const DEFAULT_JITTER_MS = 400;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BACKOFF_BASE_MS = 1500;

const RETRYABLE_STATUSES = new Set([403, 429]);

export interface ThrottlerOptions {
  minIntervalMs?: number;
  jitterMs?: number;
  maxRetries?: number;
  backoffBaseMs?: number;
}

interface StatusError extends Error {
  status: number;
}

function isStatusError(err: unknown): err is StatusError {
  return err instanceof Error && typeof (err as StatusError).status === 'number';
}

function isRetryable(err: unknown): boolean {
  return isStatusError(err) && RETRYABLE_STATUSES.has(err.status);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class Throttler {
  private readonly minIntervalMs: number;
  private readonly jitterMs: number;
  private readonly maxRetries: number;
  private readonly backoffBaseMs: number;

  private queue: Promise<unknown> = Promise.resolve();
  private lastCallEnd = 0;

  constructor(options: ThrottlerOptions = {}) {
    this.minIntervalMs = options.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS;
    this.jitterMs = options.jitterMs ?? DEFAULT_JITTER_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.backoffBaseMs = options.backoffBaseMs ?? DEFAULT_BACKOFF_BASE_MS;
  }

  run<T>(task: () => Promise<T>): Promise<T> {
    // Chain onto the existing queue so calls are serialized
    const result = this.queue.then(() => this.executeWithRetry(task));
    // Swallow errors on the queue chain itself so later tasks still run
    this.queue = result.catch(() => undefined);
    return result;
  }

  private async executeWithRetry<T>(task: () => Promise<T>): Promise<T> {
    await this.waitForInterval();

    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        const backoff = this.backoffBaseMs * Math.pow(2, attempt - 1);
        await sleep(backoff);
      }

      try {
        const result = await task();
        this.lastCallEnd = Date.now();
        return result;
      } catch (err) {
        this.lastCallEnd = Date.now();
        lastError = err;

        if (!isRetryable(err)) {
          throw err;
        }
        // Retryable — continue loop unless we've exhausted retries
      }
    }

    throw lastError;
  }

  private async waitForInterval(): Promise<void> {
    const elapsed = Date.now() - this.lastCallEnd;
    const jitter = Math.random() * this.jitterMs;
    const delay = this.minIntervalMs + jitter - elapsed;
    if (delay > 0) {
      await sleep(delay);
    }
  }
}
