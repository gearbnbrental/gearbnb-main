import { useEffect } from 'react';

/**
 * Sets the browser tab title and `<meta name="description">` for exactly as long as the calling
 * page is mounted, then restores whatever was there before — nothing else in this app currently
 * sets either of these (index.html only has the one static site-wide `<title>GearBnB</title>` and
 * no description tag at all), so this is a minimal, page-scoped mechanism rather than a global SEO
 * system: it must never leak a page's title/description onto a different route after navigating
 * away, which is why the cleanup restores the previous values instead of leaving them set.
 */
export function usePageMeta(title: string, description: string): void {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;

    let meta = document.querySelector('meta[name="description"]');
    const previousDescription = meta?.getAttribute('content') ?? null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', description);

    return () => {
      document.title = previousTitle;
      if (previousDescription === null) {
        meta?.remove();
      } else {
        meta?.setAttribute('content', previousDescription);
      }
    };
  }, [title, description]);
}
