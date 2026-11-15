/**
 * Where the Find A Campsite pages get their campsites: the RMS customer API. Set
 * VITE_CAMPSITE_SAMPLES=1 to use the made-up samples in src/data/campsiteSamples.ts instead, for
 * working on the pages before the RMS campsite API exists. Never set it for a build you upload.
 */
import type { Campsite, CampsiteSummary } from '../types/campsite';
import { fetchCampsiteFromRms, fetchCampsitesFromRms } from '../utils/rmsApi';
import { SAMPLE_CAMPSITES } from './campsiteSamples';

export const USING_CAMPSITE_SAMPLES = import.meta.env.VITE_CAMPSITE_SAMPLES === '1';

export async function fetchCampsiteList(): Promise<CampsiteSummary[]> {
  if (USING_CAMPSITE_SAMPLES) return SAMPLE_CAMPSITES;
  const { campsites } = await fetchCampsitesFromRms();
  return Array.isArray(campsites) ? campsites : [];
}

/** The campsite, or null when it doesn't exist or isn't published. Other failures throw. */
export async function fetchCampsiteDetail(slug: string): Promise<Campsite | null> {
  if (USING_CAMPSITE_SAMPLES) return SAMPLE_CAMPSITES.find((campsite) => campsite.slug === slug) ?? null;
  try {
    const { campsite } = await fetchCampsiteFromRms(slug);
    return campsite ?? null;
  } catch (err) {
    if ((err as { status?: number }).status === 404) return null;
    throw err;
  }
}
