import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RmsAvailabilityRequest, RmsAvailabilityResult } from '../utils/rmsApi';

/**
 * These tests exercise `requestAvailabilityCheck` — the exported, plain-async-function coordinator
 * that both the reactive `useAvailabilityCheck` hook and Checkout's imperative submit-time check
 * go through — rather than the React hook itself. This project has no DOM/React-rendering test
 * environment configured (vitest.config.ts uses `environment: 'node'`, and no @testing-library/react
 * or jsdom/happy-dom dependency exists), and adding one solely for this would be a larger footprint
 * than these fixes warrant. The coordinator function covers the highest-risk shared logic — request
 * concurrency, in-flight dedup, rate-limit cooldown (including the queued-request gate), abort, and
 * error passthrough — with zero new dependencies. The hook's own React-specific piece (the
 * generation counter that guarantees a stale resolution can never overwrite a newer one, and
 * cleanup on unmount) was validated manually against the running dev server instead.
 */

const checkAvailabilityMock = vi.fn<
  (input: RmsAvailabilityRequest, options?: { signal?: AbortSignal }) => Promise<RmsAvailabilityResult>
>();

vi.mock('../utils/rmsApi', async () => {
  const actual = await vi.importActual<typeof import('../utils/rmsApi')>('../utils/rmsApi');
  return {
    ...actual,
    checkAvailability: (input: RmsAvailabilityRequest, options?: { signal?: AbortSignal }) =>
      checkAvailabilityMock(input, options),
  };
});

/**
 * The coordinator keeps real module-level state (the global cooldown, the concurrency counter, the
 * wait queue, the in-flight map) that deliberately outlives any single hook instance — which means
 * it would also leak between tests. Every test therefore loads a FRESH module graph so a cooldown
 * established by one test can never silently rate-limit the next one. `RmsApiError` is returned
 * from that same fresh graph on purpose: the coordinator's `err instanceof RmsApiError` check only
 * recognises the class from the module instance it itself imported.
 */
async function loadCoordinator() {
  vi.resetModules();
  const rmsApi = await import('../utils/rmsApi');
  const coordinator = await import('./useAvailabilityCheck');
  return {
    requestAvailabilityCheck: coordinator.requestAvailabilityCheck,
    runCoordinatedCheck: coordinator.runCoordinatedCheck,
    RmsApiError: rmsApi.RmsApiError,
  };
}

/** The display-side entry point (what the hook uses): cache enabled, fresh signal per call. */
function makeCachedRunner(runCoordinatedCheck: Awaited<ReturnType<typeof loadCoordinator>>['runCoordinatedCheck']) {
  return (request: RmsAvailabilityRequest, signal?: AbortSignal) =>
    runCoordinatedCheck(request, signal ?? new AbortController().signal, { useCache: true });
}

function makeRequest(overrides: Partial<RmsAvailabilityRequest> = {}): RmsAvailabilityRequest {
  return {
    pickupAt: '2026-10-01T00:00:00.000Z',
    returnAt: '2026-10-03T00:00:00.000Z',
    packageCode: 'PKG-TEST',
    ...overrides,
  };
}

function makeResult(overrides: Partial<RmsAvailabilityResult> = {}): RmsAvailabilityResult {
  return { available: true, issues: [], currentlyReservable: true, pendingTurnover: [], ...overrides };
}

/** A promise that never settles on its own — stands in for a request still in flight. */
function neverSettles(): Promise<RmsAvailabilityResult> {
  return new Promise<RmsAvailabilityResult>(() => {});
}

beforeEach(() => {
  checkAvailabilityMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('requestAvailabilityCheck: success', () => {
  it('resolves with the RMS result on a normal successful call', async () => {
    const { requestAvailabilityCheck } = await loadCoordinator();
    const result = makeResult();
    checkAvailabilityMock.mockResolvedValueOnce(result);

    await expect(requestAvailabilityCheck(makeRequest())).resolves.toEqual(result);
    expect(checkAvailabilityMock).toHaveBeenCalledTimes(1);
  });

  it('resolves with an unavailable result unchanged — never fabricates availability', async () => {
    const { requestAvailabilityCheck } = await loadCoordinator();
    const result = makeResult({
      available: false,
      issues: [{ name: 'Tri-Pod Camping Fan', requested: 2, availableCount: 1 }],
    });
    checkAvailabilityMock.mockResolvedValueOnce(result);

    await expect(requestAvailabilityCheck(makeRequest())).resolves.toEqual(result);
  });
});

describe('requestAvailabilityCheck: error passthrough', () => {
  it('rejects with a genuine network failure, never masking it as available', async () => {
    const { requestAvailabilityCheck } = await loadCoordinator();
    checkAvailabilityMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(requestAvailabilityCheck(makeRequest())).rejects.toThrow('Failed to fetch');
  });

  it('rejects with a 500 RmsApiError unchanged', async () => {
    const { requestAvailabilityCheck, RmsApiError } = await loadCoordinator();
    checkAvailabilityMock.mockRejectedValueOnce(new RmsApiError('Internal error', 500));

    await expect(requestAvailabilityCheck(makeRequest())).rejects.toMatchObject({ status: 500 });
  });
});

describe('requestAvailabilityCheck: in-flight de-duplication', () => {
  it('shares ONE underlying call for two truly identical, simultaneous requests', async () => {
    const { requestAvailabilityCheck } = await loadCoordinator();
    const result = makeResult();
    let resolveFetch: (value: RmsAvailabilityResult) => void = () => {};
    checkAvailabilityMock.mockImplementationOnce(
      () =>
        new Promise<RmsAvailabilityResult>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const request = makeRequest({ packageCode: 'PKG-DEDUP' });
    const first = requestAvailabilityCheck(request);
    const second = requestAvailabilityCheck({ ...request }); // structurally identical, different object

    await Promise.resolve();
    await Promise.resolve();
    resolveFetch(result);

    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(firstResult).toEqual(result);
    expect(secondResult).toEqual(result);
    expect(checkAvailabilityMock).toHaveBeenCalledTimes(1);
  });

  it('does NOT merge two genuinely different requests into one call', async () => {
    const { requestAvailabilityCheck } = await loadCoordinator();
    checkAvailabilityMock.mockResolvedValueOnce(makeResult({ available: true }));
    checkAvailabilityMock.mockResolvedValueOnce(makeResult({ available: false, issues: [] }));

    const [a, b] = await Promise.all([
      requestAvailabilityCheck(makeRequest({ packageCode: 'PKG-A' })),
      requestAvailabilityCheck(makeRequest({ packageCode: 'PKG-B' })),
    ]);

    expect(checkAvailabilityMock).toHaveBeenCalledTimes(2);
    expect(a.available).toBe(true);
    expect(b.available).toBe(false);
  });
});

describe('requestAvailabilityCheck: concurrency cap', () => {
  it('never issues more than the configured number of simultaneous underlying calls', async () => {
    const { requestAvailabilityCheck } = await loadCoordinator();
    const releasers: Array<() => void> = [];
    checkAvailabilityMock.mockImplementation(
      () =>
        new Promise<RmsAvailabilityResult>((resolve) => {
          releasers.push(() => resolve(makeResult()));
        }),
    );

    // Six genuinely distinct requests fired at once — mirrors many simultaneously-mounted package
    // cards changing dates together.
    const promises = Array.from({ length: 6 }, (_, i) => requestAvailabilityCheck(makeRequest({ packageCode: `PKG-${i}` })));

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(checkAvailabilityMock.mock.calls.length).toBeLessThanOrEqual(3);
    expect(checkAvailabilityMock.mock.calls.length).toBeGreaterThan(0);

    while (releasers.length > 0) {
      const release = releasers.shift()!;
      release();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    }

    await Promise.all(promises);
    expect(checkAvailabilityMock).toHaveBeenCalledTimes(6);
  });
});

describe('requestAvailabilityCheck: abort safety', () => {
  it('rejects with an AbortError when the caller aborts, and never leaves other work affected', async () => {
    const { requestAvailabilityCheck } = await loadCoordinator();
    checkAvailabilityMock.mockImplementation(neverSettles);

    const controller = new AbortController();
    const promise = requestAvailabilityCheck(makeRequest({ packageCode: 'PKG-ABORT' }), controller.signal);
    controller.abort();

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('an aborted subscriber does not cancel a shared in-flight request another subscriber still wants', async () => {
    const { requestAvailabilityCheck } = await loadCoordinator();
    const result = makeResult();
    let resolveFetch: (value: RmsAvailabilityResult) => void = () => {};
    checkAvailabilityMock.mockImplementationOnce(
      () =>
        new Promise<RmsAvailabilityResult>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const request = makeRequest({ packageCode: 'PKG-SHARED' });
    const controllerA = new AbortController();
    const promiseA = requestAvailabilityCheck({ ...request }, controllerA.signal);
    const promiseB = requestAvailabilityCheck({ ...request }); // no signal — must not be cancelled by A

    await Promise.resolve();
    await Promise.resolve();
    controllerA.abort();
    await Promise.resolve();
    resolveFetch(result);

    await expect(promiseA).rejects.toMatchObject({ name: 'AbortError' });
    await expect(promiseB).resolves.toEqual(result);
  });
});

describe('requestAvailabilityCheck: rate-limit cooldown', () => {
  it('surfaces a recoverable rate-limited error to a caller arriving during an active cooldown, without touching RMS', async () => {
    const { requestAvailabilityCheck, RmsApiError } = await loadCoordinator();
    checkAvailabilityMock.mockRejectedValueOnce(new RmsApiError('Too many requests', 429, undefined, 21_000));

    await expect(requestAvailabilityCheck(makeRequest({ packageCode: 'PKG-429' }))).rejects.toMatchObject({ status: 429 });
    expect(checkAvailabilityMock).toHaveBeenCalledTimes(1);

    await expect(requestAvailabilityCheck(makeRequest({ packageCode: 'PKG-NEXT' }))).rejects.toThrow(/rate-limited/i);
    // Still exactly one — the second caller never reached RMS at all.
    expect(checkAvailabilityMock).toHaveBeenCalledTimes(1);
  });

  it('never retries automatically — a persistent 429 surfaces as a single, distinct failure', async () => {
    const { requestAvailabilityCheck, RmsApiError } = await loadCoordinator();
    checkAvailabilityMock.mockRejectedValue(new RmsApiError('Too many requests', 429, undefined, 21_000));

    await expect(requestAvailabilityCheck(makeRequest({ packageCode: 'PKG-PERSISTENT-429' }))).rejects.toMatchObject({
      status: 429,
    });
    expect(checkAvailabilityMock).toHaveBeenCalledTimes(1);
  });

  it('waits out a short cooldown inline rather than failing, when RMS asks for only a moment', async () => {
    vi.useFakeTimers();
    const { requestAvailabilityCheck, RmsApiError } = await loadCoordinator();
    // 1s < MAX_INLINE_COOLDOWN_WAIT_MS (3s), so the next caller waits rather than erroring.
    checkAvailabilityMock.mockRejectedValueOnce(new RmsApiError('Too many requests', 429, undefined, 1_000));

    await expect(requestAvailabilityCheck(makeRequest({ packageCode: 'PKG-SHORT-429' }))).rejects.toMatchObject({
      status: 429,
    });

    checkAvailabilityMock.mockResolvedValueOnce(makeResult());
    const pending = requestAvailabilityCheck(makeRequest({ packageCode: 'PKG-AFTER-SHORT' }));

    // Nothing sent yet — it's sitting in the inline cooldown wait.
    await Promise.resolve();
    expect(checkAvailabilityMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1_001);
    await expect(pending).resolves.toEqual(makeResult());
    expect(checkAvailabilityMock).toHaveBeenCalledTimes(2);
  });
});

describe('short-lived success cache (display-side checks)', () => {
  it('serves an identical repeat signature from cache instead of asking RMS again', async () => {
    const { runCoordinatedCheck } = await loadCoordinator();
    const run = makeCachedRunner(runCoordinatedCheck);
    checkAvailabilityMock.mockResolvedValueOnce(makeResult());

    const first = await run(makeRequest({ packageCode: 'PKG-CACHE' }));
    // A remount / second card asking the very same question later in the same session.
    const second = await run(makeRequest({ packageCode: 'PKG-CACHE' }));

    expect(first).toEqual(makeResult());
    expect(second).toEqual(makeResult());
    expect(checkAvailabilityMock).toHaveBeenCalledTimes(1);
  });

  it('does not let one package\'s cached answer satisfy a different package', async () => {
    const { runCoordinatedCheck } = await loadCoordinator();
    const run = makeCachedRunner(runCoordinatedCheck);
    checkAvailabilityMock.mockResolvedValueOnce(makeResult({ available: true }));
    checkAvailabilityMock.mockResolvedValueOnce(makeResult({ available: false }));

    await run(makeRequest({ packageCode: 'PKG-ONE' }));
    const other = await run(makeRequest({ packageCode: 'PKG-TWO' }));

    expect(checkAvailabilityMock).toHaveBeenCalledTimes(2);
    expect(other.available).toBe(false);
  });

  it('expires after its TTL so a later check gets a genuinely fresh answer', async () => {
    vi.useFakeTimers();
    const { runCoordinatedCheck } = await loadCoordinator();
    const run = makeCachedRunner(runCoordinatedCheck);
    checkAvailabilityMock.mockResolvedValue(makeResult());

    await run(makeRequest({ packageCode: 'PKG-TTL' }));
    expect(checkAvailabilityMock).toHaveBeenCalledTimes(1);

    // Still inside the 30s TTL — no second call.
    vi.setSystemTime(Date.now() + 29_000);
    await run(makeRequest({ packageCode: 'PKG-TTL' }));
    expect(checkAvailabilityMock).toHaveBeenCalledTimes(1);

    // Past it — asks RMS again rather than serving a stale availability answer.
    vi.setSystemTime(Date.now() + 2_000);
    await run(makeRequest({ packageCode: 'PKG-TTL' }));
    expect(checkAvailabilityMock).toHaveBeenCalledTimes(2);
  });

  it('never caches a failure — a transient error is not replayed as an answer', async () => {
    const { runCoordinatedCheck, RmsApiError } = await loadCoordinator();
    const run = makeCachedRunner(runCoordinatedCheck);
    checkAvailabilityMock.mockRejectedValueOnce(new RmsApiError('Internal error', 500));
    checkAvailabilityMock.mockResolvedValueOnce(makeResult());

    await expect(run(makeRequest({ packageCode: 'PKG-ERR-CACHE' }))).rejects.toMatchObject({ status: 500 });
    await expect(run(makeRequest({ packageCode: 'PKG-ERR-CACHE' }))).resolves.toEqual(makeResult());
    expect(checkAvailabilityMock).toHaveBeenCalledTimes(2);
  });

  it('serves a cached answer even during an active cooldown — it costs RMS nothing', async () => {
    const { runCoordinatedCheck, RmsApiError } = await loadCoordinator();
    const run = makeCachedRunner(runCoordinatedCheck);
    checkAvailabilityMock.mockResolvedValueOnce(makeResult());
    await run(makeRequest({ packageCode: 'PKG-CACHED-BEFORE-429' }));

    // A different package then trips the rate limit and establishes a cooldown.
    checkAvailabilityMock.mockRejectedValueOnce(new RmsApiError('Too many requests', 429, undefined, 21_000));
    await expect(run(makeRequest({ packageCode: 'PKG-429' }))).rejects.toMatchObject({ status: 429 });

    // The already-answered package still renders its known result rather than a rate-limited error.
    await expect(run(makeRequest({ packageCode: 'PKG-CACHED-BEFORE-429' }))).resolves.toEqual(makeResult());
    expect(checkAvailabilityMock).toHaveBeenCalledTimes(2);
  });

  it('is bypassed entirely by the submit-time authoritative check', async () => {
    const { runCoordinatedCheck, requestAvailabilityCheck } = await loadCoordinator();
    const run = makeCachedRunner(runCoordinatedCheck);
    checkAvailabilityMock.mockResolvedValue(makeResult());

    await run(makeRequest({ packageCode: 'PKG-SUBMIT' }));
    expect(checkAvailabilityMock).toHaveBeenCalledTimes(1);

    // Checkout's pre-submission check must always ask RMS again, never reuse the cached answer.
    await requestAvailabilityCheck(makeRequest({ packageCode: 'PKG-SUBMIT' }));
    expect(checkAvailabilityMock).toHaveBeenCalledTimes(2);

    // ...and it must not poison the display cache with its own result either way.
    await run(makeRequest({ packageCode: 'PKG-SUBMIT' }));
    expect(checkAvailabilityMock).toHaveBeenCalledTimes(2);
  });

  it('a clean five-package selection costs exactly five RMS calls, and a repeat of the same selection costs none', async () => {
    const { runCoordinatedCheck } = await loadCoordinator();
    const run = makeCachedRunner(runCoordinatedCheck);
    checkAvailabilityMock.mockResolvedValue(makeResult());

    const selection = { pickupAt: '2026-11-01T00:00:00.000Z', returnAt: '2026-11-03T00:00:00.000Z' };
    const packages = ['PKG-0001', 'PKG-0002', 'PKG-0003', 'PKG-0004', 'PKG-0005'];

    await Promise.all(packages.map((packageCode) => run(makeRequest({ ...selection, packageCode }))));
    expect(checkAvailabilityMock).toHaveBeenCalledTimes(5);

    // Same five cards re-mounting (StrictMode, a re-render, navigating back) must add nothing.
    await Promise.all(packages.map((packageCode) => run(makeRequest({ ...selection, packageCode }))));
    expect(checkAvailabilityMock).toHaveBeenCalledTimes(5);
  });
});

describe('requestAvailabilityCheck: queued requests and the cooldown gate', () => {
  it('holds QUEUED requests back once a sibling 429 establishes a cooldown, instead of sending each one to RMS', async () => {
    const { requestAvailabilityCheck, RmsApiError } = await loadCoordinator();

    // The first request to reach RMS is rate-limited and establishes a long global cooldown; the
    // other two that got concurrency slots alongside it are still in flight when that happens.
    checkAvailabilityMock.mockRejectedValueOnce(new RmsApiError('Too many requests', 429, undefined, 21_000));
    checkAvailabilityMock.mockImplementation(neverSettles);

    // Five distinct packages — exactly one PathACatalog date selection with five package cards.
    const settled = Array.from({ length: 5 }, (_, i) =>
      requestAvailabilityCheck(makeRequest({ packageCode: `PKG-${i}` })).catch((err: unknown) => err),
    );

    // The two that were still queued behind the concurrency cap must both come back rate-limited.
    const queuedOutcomes = await Promise.all([settled[3], settled[4]]);
    for (const outcome of queuedOutcomes) {
      expect(outcome).toBeInstanceOf(Error);
      expect((outcome as Error).message).toMatch(/rate-limited/i);
    }

    // Only the three that already held slots ever reached RMS. Without the release-time cooldown
    // gate, the queued two would have gone on to make two more doomed calls (5 total).
    expect(checkAvailabilityMock).toHaveBeenCalledTimes(3);
  });

  it('keeps draining the queue when a queued waiter is aborted, instead of stalling on the freed slot', async () => {
    const { runCoordinatedCheck } = await loadCoordinator();
    const run = makeCachedRunner(runCoordinatedCheck);
    const releasers: Array<() => void> = [];
    checkAvailabilityMock.mockImplementation(
      () =>
        new Promise<RmsAvailabilityResult>((resolve) => {
          releasers.push(() => resolve(makeResult()));
        }),
    );

    // Three occupy every slot; two more queue behind them.
    const inFlight = [0, 1, 2].map((i) => run(makeRequest({ packageCode: `PKG-BUSY-${i}` })));
    const abortedController = new AbortController();
    const abandoned = run(makeRequest({ packageCode: 'PKG-QUEUED-ABORTED' }), abortedController.signal).catch(
      (err: unknown) => err,
    );
    const stillWanted = run(makeRequest({ packageCode: 'PKG-QUEUED-WANTED' }));

    await Promise.resolve();
    await Promise.resolve();
    expect(checkAvailabilityMock).toHaveBeenCalledTimes(3);

    // The queued request nobody wants any more goes away...
    abortedController.abort();
    await expect(abandoned).resolves.toMatchObject({ name: 'AbortError' });

    // ...and freeing a slot must still hand it to the queued request that IS still wanted, rather
    // than leaving it waiting forever on a promise that can never settle.
    releasers.shift()!();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(checkAvailabilityMock).toHaveBeenCalledTimes(4);

    while (releasers.length > 0) {
      releasers.shift()!();
      await Promise.resolve();
      await Promise.resolve();
    }
    await expect(stillWanted).resolves.toEqual(makeResult());
    await Promise.all(inFlight);
  });

  it('does not permanently poison future requests — a later explicit request runs normally once the window passes', async () => {
    vi.useFakeTimers();
    const { requestAvailabilityCheck, RmsApiError } = await loadCoordinator();
    checkAvailabilityMock.mockRejectedValueOnce(new RmsApiError('Too many requests', 429, undefined, 21_000));

    await expect(requestAvailabilityCheck(makeRequest({ packageCode: 'PKG-429' }))).rejects.toMatchObject({ status: 429 });
    await expect(requestAvailabilityCheck(makeRequest({ packageCode: 'PKG-DURING' }))).rejects.toThrow(/rate-limited/i);
    expect(checkAvailabilityMock).toHaveBeenCalledTimes(1);

    // Jump past the cooldown window rather than waiting it out for real.
    vi.setSystemTime(Date.now() + 21_001);

    checkAvailabilityMock.mockResolvedValueOnce(makeResult());
    await expect(requestAvailabilityCheck(makeRequest({ packageCode: 'PKG-AFTER' }))).resolves.toEqual(makeResult());
    expect(checkAvailabilityMock).toHaveBeenCalledTimes(2);
  });
});
