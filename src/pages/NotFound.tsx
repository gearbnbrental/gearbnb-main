import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PAGE_META } from '../config/pageMeta';
import { usePageMeta } from '../hooks/usePageMeta';
import { BUILD_YOUR_OWN_PATH, PACKAGES_PATH } from '../utils/productSlug';

/**
 * Any address the site doesn't have, including a product that no longer exists. The server
 * answers these with a real 404 status (see the .htaccess rules written by vite.config.ts), and
 * this page adds `noindex` so search engines drop the address.
 */
export default function NotFound() {
  usePageMeta(PAGE_META.notFound.title, PAGE_META.notFound.description);

  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = PAGE_META.notFound.robots;
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center gap-4 px-5 py-16 text-center sm:px-6">
      <p className="text-sm font-semibold uppercase tracking-widest text-accent">404</p>
      <h1 className="font-serif text-2xl font-bold text-ink sm:text-3xl">We couldn&rsquo;t find that page</h1>
      <p className="text-sm text-ink-muted">
        The link may be old, or the item may no longer be available. Here are some places to start instead.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Link
          to={PACKAGES_PATH}
          className="rounded-lg bg-brand-forest px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-forest-dark"
        >
          Camping Packages
        </Link>
        <Link
          to={BUILD_YOUR_OWN_PATH}
          className="rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-surface-strong"
        >
          Build Your Own
        </Link>
        <Link
          to="/"
          className="rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-surface-strong"
        >
          Home
        </Link>
      </div>
      <Link to="/about-us#contact" className="text-sm font-medium text-accent underline underline-offset-2">
        Contact us
      </Link>
    </div>
  );
}
