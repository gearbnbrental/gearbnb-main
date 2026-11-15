/**
 * Find A Campsite shows a "Coming Soon" screen until real campsites (with GearBnB-owned or
 * permitted photos) are in the RMS. While this is true, /campsites and every campsite address show
 * Coming Soon, the build fetches no campsites and makes no campsite pages, and /campsites stays out
 * of search results, the sitemap, llms.txt and the WebMCP tools. Set it to false to launch.
 *
 * A plain constant, not an environment variable: vite.config.ts reads page settings from
 * config/pageMeta.ts directly, outside Vite, where import.meta.env doesn't exist.
 */
export const CAMPSITES_COMING_SOON = true;
