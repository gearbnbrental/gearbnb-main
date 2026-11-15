/**
 * The campsites the Find A Campsite pages show. In the browser each page loads them from the RMS
 * when it opens. At build time src/prerender.tsx fills CampsiteDataContext with what it already
 * fetched, so the pre-built HTML has the full list and campsite pages without any loading state.
 */
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { fetchCampsiteDetail, fetchCampsiteList } from '../data/campsites';
import type { Campsite, CampsiteSummary } from '../types/campsite';

export interface CampsiteData {
  list: CampsiteSummary[];
  details: Record<string, Campsite>;
}

export const CampsiteDataContext = createContext<CampsiteData | null>(null);

export type LoadState = 'loading' | 'ready' | 'error';

export function useCampsiteList() {
  const preloaded = useContext(CampsiteDataContext);
  const [campsites, setCampsites] = useState<CampsiteSummary[]>(preloaded?.list ?? []);
  const [state, setState] = useState<LoadState>(preloaded ? 'ready' : 'loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (preloaded) return;
    let cancelled = false;
    setState('loading');
    fetchCampsiteList().then(
      (list) => {
        if (cancelled) return;
        setCampsites(list);
        setState('ready');
      },
      () => {
        if (!cancelled) setState('error');
      },
    );
    return () => {
      cancelled = true;
    };
  }, [preloaded, attempt]);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);
  return { campsites, state, retry };
}

/** One campsite. `campsite` is null while loading, on an error, and when it isn't found. */
export function useCampsite(slug: string | undefined) {
  const preloaded = useContext(CampsiteDataContext);
  const initial = slug ? (preloaded?.details[slug] ?? null) : null;
  const [campsite, setCampsite] = useState<Campsite | null>(initial);
  const [state, setState] = useState<LoadState | 'not-found'>(preloaded ? (initial ? 'ready' : 'not-found') : 'loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (preloaded || !slug) return;
    let cancelled = false;
    setState('loading');
    fetchCampsiteDetail(slug).then(
      (found) => {
        if (cancelled) return;
        setCampsite(found);
        setState(found ? 'ready' : 'not-found');
      },
      () => {
        if (!cancelled) setState('error');
      },
    );
    return () => {
      cancelled = true;
    };
  }, [preloaded, slug, attempt]);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);
  /** After the camper's own review changes, reload so the rating and list include it. */
  const reload = useCallback(() => {
    if (!slug || preloaded) return;
    fetchCampsiteDetail(slug).then((found) => found && setCampsite(found), () => {});
  }, [slug, preloaded]);
  return { campsite, state, retry, reload };
}
