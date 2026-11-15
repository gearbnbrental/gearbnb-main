/**
 * Find A Campsite shows a "Coming Soon" screen until real campsites (with GearBnB-owned or
 * permitted photos) are in the RMS. While this is true, /campsites and every campsite address show
 * Coming Soon, the build fetches no campsites and makes no campsite pages, and /campsites stays out
 * of search results, the sitemap, llms.txt and the WebMCP tools. To launch, set LAUNCHED to true.
 *
 * The one exception: a local dev server started with VITE_CAMPSITE_SAMPLES=1 shows the real pages
 * with the sample campsites, for working on them. A build (`vite build`) is never a dev server, so
 * an uploaded site always follows LAUNCHED. import.meta.env is read defensively because
 * vite.config.ts imports config/pageMeta.ts (and so this file) outside Vite, where it doesn't exist.
 */
const LAUNCHED = false;
const env = (import.meta as { env?: { DEV?: boolean; VITE_CAMPSITE_SAMPLES?: string } }).env;
const DEV_PREVIEW = env?.DEV === true && env?.VITE_CAMPSITE_SAMPLES === '1';

export const CAMPSITES_COMING_SOON = !LAUNCHED && !DEV_PREVIEW;
