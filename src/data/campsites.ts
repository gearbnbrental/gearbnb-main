/**
 * Where the Find A Campsite pages get their campsites: the RMS customer API. Set
 * VITE_CAMPSITE_SAMPLES=1 to use the made-up samples in src/data/campsiteSamples.ts instead, for
 * working on the pages before the RMS campsite API exists. Never set it for a build you upload.
 */
import type { Campsite, CampsiteLeadChannel, CampsiteSummary } from '../types/campsite';
import { fetchCampsiteFromRms, fetchCampsitesFromRms, recordCampsiteLeadOnRms } from '../utils/rmsApi';

export const USING_CAMPSITE_SAMPLES = import.meta.env.VITE_CAMPSITE_SAMPLES === '1';

/** Loaded only with the flag on, so a normal build never ships the made-up samples at all. */
const samples = async () => (await import('./campsiteSamples')).SAMPLE_CAMPSITES;

export async function fetchCampsiteList(): Promise<CampsiteSummary[]> {
  if (USING_CAMPSITE_SAMPLES) return samples();
  const { campsites } = await fetchCampsitesFromRms();
  return Array.isArray(campsites) ? campsites : [];
}

/** The campsite, or null when it doesn't exist or isn't published. Other failures throw. */
export async function fetchCampsiteDetail(slug: string): Promise<Campsite | null> {
  if (USING_CAMPSITE_SAMPLES) return (await samples()).find((campsite) => campsite.slug === slug) ?? null;
  try {
    const { campsite } = await fetchCampsiteFromRms(slug);
    return campsite ?? null;
  } catch (err) {
    if ((err as { status?: number }).status === 404) return null;
    throw err;
  }
}

/** Records a tap on one of the campsite's contact buttons and returns the lead code to show the
 *  camper. With the samples on, a made-up code and no request (there's no RMS endpoint to call). */
export async function recordCampsiteLead(slug: string, channel: CampsiteLeadChannel): Promise<string> {
  if (USING_CAMPSITE_SAMPLES) return 'GB-SAMPLE';
  const { code } = await recordCampsiteLeadOnRms(slug, { channel });
  return code;
}
