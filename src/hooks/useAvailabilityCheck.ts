import { useCallback, useEffect, useRef, useState } from 'react';
import {
  checkAvailability,
  RmsApiError,
  RmsAvailabilityTimeoutError,
  type RmsAvailabilityRequest,
  type RmsAvailabilityResult,
} from '../utils/rmsApi';

/**
 * Single shared availability-check mechanism for the whole site — Path A (one instance per
 * visible package card), Path B (Build Your Own), and Checkout all call this instead of each
 * independently reinventing the same debounce/AbortController/cache/error-handling lifecycle.
 * Three earlier, hand-rolled copies of this same logic (one per page) is exactly how a fix applied
 * to one of them (Path B's manual retry escape hatch) never reached the other two, and how Path A
 * ended up able to fire one simultaneous request per visible card with no cross-card coordination —
 * see the root-cause audit this fix is based on. Fixing it here means every caller benefits.
 *
 * Every request this hook starts reaches a terminal status — 'available'/'unavailable' result
 * (wrapped as 'success'; the caller interprets `result.available`/`currentlyReservable` itself,
 * exactly as before), 'error', or 'rate_limited' — on success, RMS error, network failure, this
 * hook's own bounded timeout, an aborted/superseded request, or unmount. Nothing here can leave
 * `status: 'checking'` set with no future write: every branch of every `.then`/`.catch`, and the
 * effect's own cleanup, either sets a terminal status or is itself superseded by a new run that
 * will.
 */

// ---------------------------------------------------------------------------------------------
// Module-level (NOT React state) request coordinator, shared by every hook instance across the
// entire app. This is deliberately outside the hook itself: Path A mounts one hook instance per
// visible package card, and those instances share no common ancestor component — only a
// module-level singleton can coordinate across them.
// ---------------------------------------------------------------------------------------------

/** Max availability requests allowed in flight at once, app-wide — mirrors the same
 *  pooler-safe-concurrency convention the RMS's own countAvailableUnitsBatch already uses
 *  server-side (AVAILABILITY_QUERY_CONCURRENCY = 4), applied here to the client-side fan-out
 *  itself. A customer with many package cards on screen changing dates once now sends at most
 *  this many requests at a time instead of one per card simultaneously — smoothing the burst that
 *  used to trip RMS's 10-requests/60s-per-IP limit during completely normal use. */
const MAX_CONCURRENT_REQUESTS = 3;
let activeRequestCount = 0;
const waitQueue: (() => void)[] = [];

/**
 * Drains the wait queue until either a waiter actually takes the freed slot or the queue empties.
 * The loop matters: a waiter that was aborted in the same tick its turn came up is already
 * `settled` and takes no slot when invoked, and the previous single-shift version would simply
 * return at that point — leaving the freed slot unclaimed and every remaining queued request
 * waiting forever on a promise that could never settle. That is one of the paths that could pin a
 * card on "Checking availability…" indefinitely, so this keeps going until a slot is genuinely
 * consumed.
 */
function runQueue(): void {
  while (activeRequestCount < MAX_CONCURRENT_REQUESTS && waitQueue.length > 0) {
    const next = waitQueue.shift();
    if (!next) return;
    const before = activeRequestCount;
    next();
    if (activeRequestCount > before) return;
  }
}

/** Resolves once a concurrency slot is free, with a release callback; rejects (AbortError) if
 *  `signal` aborts first, whether already-aborted, while queued, or while waiting. */
function acquireSlot(signal: AbortSignal): Promise<() => void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    let settled = false;
    const tryAcquire = () => {
      if (settled) return;
      if (activeRequestCount < MAX_CONCURRENT_REQUESTS) {
        activeRequestCount += 1;
        settled = true;
        let released = false;
        resolve(() => {
          if (released) return;
          released = true;
          activeRequestCount -= 1;
          runQueue();
        });
      } else {
        waitQueue.push(tryAcquire);
      }
    };
    signal.addEventListener(
      'abort',
      () => {
        if (settled) return;
        const idx = waitQueue.indexOf(tryAcquire);
        if (idx !== -1) waitQueue.splice(idx, 1);
        settled = true;
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
    tryAcquire();
  });
}

/** A genuinely rate-limited outcome that the coordinator decided is too long to silently wait
 *  out — see MAX_INLINE_COOLDOWN_WAIT_MS below. Distinct from RmsApiError so callers never need to
 *  inspect a status code to recognize this case. */
class AvailabilityRateLimitedError extends Error {
  constructor() {
    super('Availability checks are temporarily rate-limited.');
  }
}

/** How long RMS asked every caller to back off after a 429, app-wide — not per signature, since
 *  the limit itself is per-IP, not per-request-shape. Reset the moment the window naturally
 *  elapses; never grows without a fresh 429 actually extending it. */
let cooldownUntil = 0;
/** Same fallback the previous single-retry design used, for the rare case RMS's 429 response
 *  didn't include a Retry-After header at all. */
const DEFAULT_COOLDOWN_MS = 5_000;
/** A cooldown shorter than this is waited out inline (the caller's own 'checking' state simply
 *  lasts a little longer) — longer than this, silently blocking would read as a stuck app, so it
 *  surfaces immediately as a recoverable 'rate_limited' state instead. */
const MAX_INLINE_COOLDOWN_WAIT_MS = 3_000;

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

/**
 * The single gate every request must pass immediately before it is allowed to reach RMS. Returns
 * `null` when there is no active cooldown (the overwhelmingly common case), a promise to await
 * when the cooldown is short enough that a slightly longer 'checking' state beats an error, and
 * throws AvailabilityRateLimitedError otherwise so the caller surfaces a recoverable
 * 'rate_limited' state instead of silently blocking.
 *
 * Deliberately called TWICE per request — once when the caller first arrives (before an in-flight
 * entry is even created) and again the moment a queued request is actually granted a concurrency
 * slot. The second call is the one that matters: a request that passed the first check while no
 * cooldown existed, then sat in acquireSlot's waitQueue behind three others, would otherwise go
 * straight to RMS even though a sibling's 429 established a global cooldown in the meantime —
 * turning one legitimate 429 into a burst of several. Re-checking at release time is what makes
 * the cooldown actually authoritative for queued work, without busy-looping, without re-queueing
 * anything, and without inventing a retry policy: the queue still drains in FIFO order, it just
 * drains into a "rate-limited, try again" answer rather than into more doomed RMS calls.
 *
 * Returns `null` rather than being an `async` function on purpose. An async function would yield a
 * microtask even on the no-cooldown path, and runCoordinatedCheck's fast path has to stay
 * synchronous all the way to its `signal.addEventListener('abort', ...)` — a caller that aborts
 * immediately after calling (a card unmounting in the same tick, which really happens under
 * StrictMode) would otherwise abort before that listener exists, and `addEventListener` never
 * fires retroactively.
 */
function cooldownGate(signal: AbortSignal): Promise<void> | null {
  const now = Date.now();
  if (now >= cooldownUntil) return null;
  const remaining = cooldownUntil - now;
  if (remaining > MAX_INLINE_COOLDOWN_WAIT_MS) {
    throw new AvailabilityRateLimitedError();
  }
  return delay(remaining, signal);
}

interface InFlightEntry {
  promise: Promise<RmsAvailabilityResult>;
  controller: AbortController;
  subscribers: number;
}

/** Identical, truly-simultaneous requests (same pickup/return/package/gear signature) share ONE
 *  network call and ONE promise, regardless of which page/card/hook instance asked — never merges
 *  two DIFFERENT signatures, which would misreport one package's availability as another's.
 *  Reference-counted rather than tied to whichever caller happened to start it: an individual
 *  subscriber aborting only cancels the shared underlying request once EVERY subscriber has
 *  abandoned it, so one card unmounting can never yank the answer out from under a different card
 *  that's still waiting on the exact same question. */
const inFlightBySignature = new Map<string, InFlightEntry>();

/**
 * Short-lived successful answers, keyed by the exact request signature and shared by every hook
 * instance app-wide. This is what makes a remount (React StrictMode's dev double-invoke, a card
 * re-keyed by a catalog refresh, navigating back to the catalog) render its already-known answer
 * instantly instead of asking RMS the identical question again — the per-hook cache this replaces
 * died with the component and so protected nothing across remounts.
 *
 * Deliberately short (30s) and memory-only: availability genuinely goes stale as other customers
 * book, so this is a within-interaction de-duplicator, never a substitute for a fresh answer. It
 * does not survive a page reload, it is never consulted by the submit-time authoritative check
 * (see requestAvailabilityCheck, which passes useCache: false), and it never stores failures — a
 * transient error must never be replayed as though RMS had answered.
 */
const SUCCESS_CACHE_TTL_MS = 30_000;

interface CachedSuccess {
  result: RmsAvailabilityResult;
  expiresAt: number;
}

const successCache = new Map<string, CachedSuccess>();

function readSuccessCache(signature: string): RmsAvailabilityResult | null {
  const hit = successCache.get(signature);
  if (!hit) return null;
  if (Date.now() >= hit.expiresAt) {
    successCache.delete(signature);
    return null;
  }
  return hit.result;
}

/** Drops every cached "available" answer — called after RMS rejects a booking with an inventory
 *  409, so no card or background check keeps showing a now-stale success for up to the cache TTL. */
export function clearAvailabilityCache(): void {
  successCache.clear();
}

function writeSuccessCache(signature: string, result: RmsAvailabilityResult): void {
  successCache.set(signature, { result, expiresAt: Date.now() + SUCCESS_CACHE_TTL_MS });
}

/**
 * The single path every availability request in the app takes to RMS: short-lived success cache,
 * global rate-limit cooldown gate (entry and slot-release), concurrency cap, in-flight dedup, and
 * reference-counted abort. Exported so both entry points below — and the coordinator's own tests —
 * exercise exactly this code rather than a parallel copy.
 *
 * `options.useCache` is the one deliberate difference between callers: display-side checks reuse a
 * fresh answer for an identical signature, while the submit-time check never does.
 */
export async function runCoordinatedCheck(
  request: RmsAvailabilityRequest,
  signal: AbortSignal,
  options: { useCache: boolean },
): Promise<RmsAvailabilityResult> {
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

  const signature = JSON.stringify(request);

  // Checked before the cooldown gate on purpose: an answer already in hand is not a new call on
  // RMS, so being inside a rate-limit cooldown is no reason to withhold it from the customer.
  if (options.useCache) {
    const cached = readSuccessCache(signature);
    if (cached) return cached;
  }

  // First gate: a caller arriving while a cooldown is already known never even creates an
  // in-flight entry or takes a concurrency slot.
  const entryGate = cooldownGate(signal);
  if (entryGate) await entryGate;

  let entry = inFlightBySignature.get(signature);
  if (!entry) {
    const controller = new AbortController();
    const promise = (async () => {
      const release = await acquireSlot(controller.signal);
      try {
        // Second gate, and the one that closes the queued-request hole: between passing the gate
        // above and being granted a slot here, a sibling request may have hit a 429 and set a
        // global cooldown. Re-checking now means this request is held back by that cooldown like
        // any other, instead of being waved through purely because it got in line first.
        const releaseGate = cooldownGate(controller.signal);
        if (releaseGate) await releaseGate;
        const result = await checkAvailability(request, { signal: controller.signal });
        if (options.useCache) writeSuccessCache(signature, result);
        return result;
      } catch (err) {
        if (err instanceof RmsApiError && err.status === 429) {
          cooldownUntil = Date.now() + (err.retryAfterMs ?? DEFAULT_COOLDOWN_MS);
        }
        throw err;
      } finally {
        release();
      }
    })();
    entry = { promise, controller, subscribers: 0 };
    inFlightBySignature.set(signature, entry);
    // Fire-and-forget cleanup only — every real subscriber awaits `entry.promise` itself (below)
    // and handles its own rejection there. Without the trailing .catch() here, a rejection would
    // make THIS unattached derived promise reject too, reported as an unhandled rejection despite
    // every actual caller already having a live .catch() of their own on the original promise.
    promise
      .finally(() => {
        if (inFlightBySignature.get(signature) === entry) inFlightBySignature.delete(signature);
      })
      .catch(() => {});
  }

  const currentEntry = entry;
  // An abort that landed while this call was awaiting the cooldown gate above would have fired
  // before the listener below could be attached, and `addEventListener` never fires retroactively —
  // so it's checked explicitly here rather than silently leaving this caller waiting on work it no
  // longer wants. Only tears down the shared request if nobody else has subscribed to it yet.
  if (signal.aborted) {
    if (currentEntry.subscribers <= 0) currentEntry.controller.abort();
    throw new DOMException('Aborted', 'AbortError');
  }
  currentEntry.subscribers += 1;
  // This specific caller's own promise must settle (reject) the instant ITS OWN signal aborts —
  // standard AbortController-caller expectations — regardless of whether the shared underlying
  // request keeps running for a different, still-interested subscriber. Racing against the shared
  // promise (rather than only awaiting it directly) is what guarantees that: only cancelling the
  // shared work itself once every subscriber has abandoned it (the subscribers-<=0 branch below).
  let onCallerAbort: () => void = () => {};
  const ownAbort = new Promise<never>((_, reject) => {
    onCallerAbort = () => {
      currentEntry.subscribers -= 1;
      if (currentEntry.subscribers <= 0) currentEntry.controller.abort();
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal.addEventListener('abort', onCallerAbort, { once: true });
  });
  try {
    return await Promise.race([currentEntry.promise, ownAbort]);
  } finally {
    signal.removeEventListener('abort', onCallerAbort);
  }
}

/**
 * Imperative, one-shot entry point into the exact same shared coordinator the reactive hook below
 * uses — for the one legitimate non-reactive caller in this codebase: Checkout's own
 * "fresh check right at the moment of clicking Submit" (see PaymentBreakdown's validateAndConfirm),
 * which awaits a single answer inline rather than displaying a continuously-updating result. Still
 * gets the same concurrency cap, in-flight dedup, rate-limit cooldown, and bounded timeout as
 * every other caller — never a second, uncoordinated way to reach RMS's availability endpoint.
 */
export function requestAvailabilityCheck(request: RmsAvailabilityRequest, signal?: AbortSignal): Promise<RmsAvailabilityResult> {
  // useCache: false — this is the submit-time check that must always ask RMS fresh. A cached
  // answer, however recent, must never stand in for the confirmation taken moments before a real
  // booking is created (RMS's own in-transaction re-check remains the final authority regardless).
  return runCoordinatedCheck(request, signal ?? new AbortController().signal, { useCache: false });
}

// ---------------------------------------------------------------------------------------------
// Per-consumer hook
// ---------------------------------------------------------------------------------------------

export type AvailabilityCheckStatus = 'idle' | 'checking' | 'success' | 'error' | 'rate_limited' | 'timeout';

export interface AvailabilityCheckState {
  status: AvailabilityCheckStatus;
  /** Only meaningful when status === 'success' — the raw RMS response. Deliberately not narrowed
   *  to available/unavailable/pending_turnover here: each existing caller already has its own
   *  established way of interpreting `available`/`currentlyReservable`/`issues` for its own UI
   *  (PathACatalog's per-card badge, PathBCatalog's gear list, Checkout's confirmation banner),
   *  and duplicating that interpretation a second time inside this shared hook would be exactly
   *  the kind of drift-prone duplication this fix is meant to remove. */
  result: RmsAvailabilityResult | null;
}

const IDLE_STATE: AvailabilityCheckState = { status: 'idle', result: null };
const CHECKING_STATE: AvailabilityCheckState = { status: 'checking', result: null };
const ERROR_STATE: AvailabilityCheckState = { status: 'error', result: null };
const RATE_LIMITED_STATE: AvailabilityCheckState = { status: 'rate_limited', result: null };
const TIMEOUT_STATE: AvailabilityCheckState = { status: 'timeout', result: null };

/**
 * Hard ceiling on how long a single check may sit in 'checking' before the hook gives up on it
 * itself and reports a recoverable 'timeout', regardless of WHERE the time went — waiting for a
 * concurrency slot, waiting out an inline cooldown, or waiting on RMS. checkAvailability's own
 * 8s fetch timeout only bounds the network call itself; this bounds the whole user-visible wait,
 * which is the thing a customer actually experiences. Sized to comfortably cover the realistic
 * worst case (two slower-than-usual requests ahead of this one in the queue, then a full 8s fetch
 * timeout of its own) without ever being open-ended.
 */
const OVERALL_DEADLINE_MS = 15_000;

export interface UseAvailabilityCheckOptions {
  /** Debounce before a changed request is actually sent — 350ms everywhere today, matching every
   *  existing availability effect this replaces. */
  debounceMs?: number;
}

/**
 * `request === null` means "nothing to check right now" (no dates yet, nothing selected, etc.) —
 * resolves to 'idle', mirroring every existing caller's own current behavior for that case.
 *
 * Race-safety: a monotonically increasing generation counter is captured before each debounced
 * request starts; the resolution handlers below check it before ever calling `setState`, so a
 * request that finishes after a newer one has already started can never overwrite the newer
 * result — this holds even if `AbortController.abort()` somehow failed to actually prevent a
 * stale promise from settling, since the generation check is the actual correctness guarantee,
 * not just the abort signal (which is used for cheap early cancellation, not relied on alone).
 */
export function useAvailabilityCheck(
  request: RmsAvailabilityRequest | null,
  options?: UseAvailabilityCheckOptions,
): AvailabilityCheckState & { retry: () => void } {
  const debounceMs = options?.debounceMs ?? 350;
  const signature = request ? JSON.stringify(request) : null;

  const [state, setState] = useState<AvailabilityCheckState>(IDLE_STATE);
  const generationRef = useRef(0);
  const mountedRef = useRef(true);
  const [retryNonce, setRetryNonce] = useState(0);

  // Sets mountedRef back to TRUE on every mount, not only false on unmount. The previous version
  // only had the cleanup half, which made this permanently false the moment React StrictMode ran
  // its dev-only mount -> unmount -> mount cycle: every subsequent resolution handler bailed on
  // `!mountedRef.current` and no terminal state was ever written, pinning every card on
  // "Checking availability…" forever in development. A ref that is only ever cleared is not a
  // mounted flag.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // Bumped on every run (including the very first) so any earlier in-flight resolution — even
    // one whose abort() call raced a fetch that had already started resolving — is guaranteed to
    // find its captured generation stale and skip its setState calls below.
    generationRef.current += 1;
    const myGeneration = generationRef.current;

    if (!request || !signature) {
      setState(IDLE_STATE);
      return;
    }

    // A still-fresh answer for this exact signature renders immediately — no debounce, no request.
    // This is what makes a remount (StrictMode's double-invoke, a re-keyed card, navigating back)
    // cost zero RMS calls instead of repeating the identical question.
    const cached = readSuccessCache(signature);
    if (cached) {
      setState({ status: 'success', result: cached });
      return;
    }

    setState(CHECKING_STATE);
    const controller = new AbortController();

    // Exactly one terminal outcome per effect run, enforced here rather than trusted to every
    // individual branch: whichever of the resolution handlers, the deadline, or the cleanup gets
    // here first wins, and the rest become no-ops. `next === null` means "this run is over, but
    // there is nothing to display" (superseded or unmounted) — it still stops the deadline timer,
    // which is what prevents an abandoned run from later firing a spurious 'timeout' over a newer
    // run's result.
    let settled = false;
    const settle = (next: AvailabilityCheckState | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      if (next === null) return;
      if (!mountedRef.current || myGeneration !== generationRef.current) return;
      setState(next);
    };

    const deadline = setTimeout(() => {
      // Abort first so the work we have stopped waiting for also stops consuming a concurrency
      // slot and an RMS connection, then report a recoverable timeout.
      controller.abort();
      settle(TIMEOUT_STATE);
    }, OVERALL_DEADLINE_MS);

    const timer = setTimeout(() => {
      runCoordinatedCheck(request, controller.signal, { useCache: true })
        .then((result) => {
          settle({ status: 'success', result });
        })
        .catch((err: unknown) => {
          // A plain AbortError means "superseded/no longer needed" (this run's own controller was
          // aborted by cleanup, or by the deadline above, or the shared in-flight entry it
          // subscribed to was) — never surfaced as a failure of its own. If the deadline caused
          // it, that path has already settled this run as 'timeout'.
          if (err instanceof DOMException && err.name === 'AbortError') {
            settle(null);
            return;
          }
          if (err instanceof AvailabilityRateLimitedError) {
            settle(RATE_LIMITED_STATE);
            return;
          }
          if (err instanceof RmsAvailabilityTimeoutError) {
            settle(TIMEOUT_STATE);
            return;
          }
          // Any other RMS/network failure — recoverable the same way, via retry() below. Never
          // cached: a transient failure must not be replayed as though RMS had answered.
          settle(ERROR_STATE);
        });
    }, debounceMs);

    return () => {
      clearTimeout(timer);
      settle(null);
      controller.abort();
    };
    // Deliberately keyed on the signature string (not `request` itself, a fresh object every
    // render for most callers) plus retryNonce, which `retry()` bumps to force a re-run even when
    // signature/debounceMs haven't changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, debounceMs, retryNonce]);

  const retry = useCallback(() => {
    // Drops this signature's cached answer first — an explicit "Try Again" must always reach RMS,
    // never replay a cached one. Errors are never cached to begin with, but a customer retrying a
    // stale-looking success deserves a genuinely fresh answer too.
    if (signature) successCache.delete(signature);
    setRetryNonce((n) => n + 1);
  }, [signature]);

  return { ...state, retry };
}
