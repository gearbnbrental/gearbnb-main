import { describe, expect, it } from 'vitest';
import appSource from './App.tsx?raw';
import { CLIENT_ONLY_PATHS, PRERENDERED_PAGES } from './config/pageMeta';
import { CAMPSITES_PATH } from './utils/campsites';
import { BUILD_YOUR_OWN_PATH, PACKAGES_PATH } from './utils/productSlug';

/**
 * The server answers only pre-built pages, the app-only pages in CLIENT_ONLY_PATHS and real files
 * (see prerenderRouteMeta in vite.config.ts); every other address is a 404. A route added to
 * App.tsx but missing from both lists would load when clicked inside the app but 404 on refresh.
 */
describe('every App.tsx route is answered by the server', () => {
  const routePaths = [...appSource.matchAll(/<Route\s+path="([^"]+)"/g)].map((match) => match[1]);

  it('finds the routes', () => {
    expect(routePaths.length).toBeGreaterThan(10);
  });

  it.each(routePaths.filter((path) => path !== '*'))('%s', (path) => {
    const prerendered = PRERENDERED_PAGES.map((page) => page.path);
    const answered = (candidate: string) => prerendered.includes(candidate) || CLIENT_ONLY_PATHS.includes(candidate);
    if (path.endsWith('/:slug?')) {
      // The catalog itself is pre-built; each product's page is too (one per product at build time).
      const base = path.replace('/:slug?', '');
      expect([PACKAGES_PATH, BUILD_YOUR_OWN_PATH]).toContain(base);
      expect(answered(base)).toBe(true);
      return;
    }
    if (path.startsWith(`${CAMPSITES_PATH}/`)) {
      // The directory is pre-built, and so is each campsite and province page that exists at
      // build time; one published since then still opens in the app from the 404 page.
      expect(['/campsites/:slug', '/campsites/province/:province']).toContain(path);
      expect(answered(CAMPSITES_PATH)).toBe(true);
      return;
    }
    expect(answered(path)).toBe(true);
  });

  it('has a catch-all page for everything else', () => {
    expect(routePaths).toContain('*');
  });
});
