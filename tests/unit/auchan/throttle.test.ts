import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Throttler } from '../../../src/auchan/throttle.js';

// Fake timers pour accélérer les tests
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Throttler', () => {
  it('exécute une tâche et retourne son résultat', async () => {
    const throttler = new Throttler({ minIntervalMs: 0, jitterMs: 0 });
    const result = await throttler.run(() => Promise.resolve(42));
    expect(result).toBe(42);
  });

  it('attend au moins minIntervalMs entre deux appels successifs', async () => {
    const minIntervalMs = 500;
    const throttler = new Throttler({ minIntervalMs, jitterMs: 0 });

    const timestamps: number[] = [];
    const task = () => {
      timestamps.push(Date.now());
      return Promise.resolve(null);
    };

    const p1 = throttler.run(task);
    const p2 = throttler.run(task);

    await vi.runAllTimersAsync();
    await Promise.all([p1, p2]);

    expect(timestamps).toHaveLength(2);
    expect(timestamps[1] - timestamps[0]).toBeGreaterThanOrEqual(minIntervalMs);
  });

  it('ajoute un jitter aléatoire entre 0 et jitterMs', async () => {
    const jitterMs = 200;
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // jitter fixe à 100ms

    const throttler = new Throttler({ minIntervalMs: 0, jitterMs });
    const timestamps: number[] = [];
    const task = () => {
      timestamps.push(Date.now());
      return Promise.resolve(null);
    };

    const p1 = throttler.run(task);
    const p2 = throttler.run(task);

    await vi.runAllTimersAsync();
    await Promise.all([p1, p2]);

    // Le délai entre les appels doit inclure le jitter (0.5 * 200 = 100ms)
    expect(timestamps[1] - timestamps[0]).toBeGreaterThanOrEqual(100);
  });

  it('retry sur une erreur 403 avec backoff exponentiel', async () => {
    const backoffBaseMs = 100;
    const throttler = new Throttler({
      minIntervalMs: 0,
      jitterMs: 0,
      maxRetries: 2,
      backoffBaseMs,
    });

    let attempts = 0;
    const task = vi.fn(async () => {
      attempts++;
      if (attempts < 3) {
        const err = new Error('Forbidden') as Error & { status: number };
        err.status = 403;
        throw err;
      }
      return 'ok';
    });

    const p = throttler.run(task);
    await vi.runAllTimersAsync();
    const result = await p;

    expect(result).toBe('ok');
    expect(task).toHaveBeenCalledTimes(3);
  });

  it('retry sur une erreur 429 avec backoff exponentiel', async () => {
    const throttler = new Throttler({
      minIntervalMs: 0,
      jitterMs: 0,
      maxRetries: 1,
      backoffBaseMs: 100,
    });

    let attempts = 0;
    const task = vi.fn(async () => {
      attempts++;
      if (attempts < 2) {
        const err = new Error('Too Many Requests') as Error & { status: number };
        err.status = 429;
        throw err;
      }
      return 'ok';
    });

    const p = throttler.run(task);
    await vi.runAllTimersAsync();
    const result = await p;

    expect(result).toBe('ok');
    expect(task).toHaveBeenCalledTimes(2);
  });

  it('lève une erreur après maxRetries tentatives', async () => {
    const throttler = new Throttler({
      minIntervalMs: 0,
      jitterMs: 0,
      maxRetries: 2,
      backoffBaseMs: 100,
    });

    const task = vi.fn(async () => {
      const err = new Error('Forbidden') as Error & { status: number };
      err.status = 403;
      throw err;
    });

    const p = throttler.run(task);
    await vi.runAllTimersAsync();

    await expect(p).rejects.toThrow('Forbidden');
    expect(task).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it('ne retente pas sur une erreur 400', async () => {
    const throttler = new Throttler({
      minIntervalMs: 0,
      jitterMs: 0,
      maxRetries: 3,
      backoffBaseMs: 100,
    });

    const task = vi.fn(async () => {
      const err = new Error('Bad Request') as Error & { status: number };
      err.status = 400;
      throw err;
    });

    const p = throttler.run(task);
    await vi.runAllTimersAsync();

    await expect(p).rejects.toThrow('Bad Request');
    expect(task).toHaveBeenCalledTimes(1); // pas de retry
  });

  it('ne retente pas sur une erreur 500', async () => {
    const throttler = new Throttler({
      minIntervalMs: 0,
      jitterMs: 0,
      maxRetries: 3,
      backoffBaseMs: 100,
    });

    const task = vi.fn(async () => {
      const err = new Error('Server Error') as Error & { status: number };
      err.status = 500;
      throw err;
    });

    const p = throttler.run(task);
    await vi.runAllTimersAsync();

    await expect(p).rejects.toThrow('Server Error');
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('sérialise les appels (le 2e appel attend la fin du 1er)', async () => {
    const throttler = new Throttler({ minIntervalMs: 0, jitterMs: 0 });
    const order: number[] = [];

    const p1 = throttler.run(async () => {
      order.push(1);
      await new Promise((r) => setTimeout(r, 200));
      order.push(2);
      return null;
    });

    const p2 = throttler.run(async () => {
      order.push(3);
      return null;
    });

    await vi.runAllTimersAsync();
    await Promise.all([p1, p2]);

    // Le 2e appel ne doit commencer qu'après la fin du 1er
    expect(order).toEqual([1, 2, 3]);
  });
});
