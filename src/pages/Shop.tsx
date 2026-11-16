import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import FilterPill from '../components/FilterPill';
import { ChevronDownIcon } from '../components/icons';
import ShopItemCard from '../components/shop/ShopItemCard';
import ShopItemDialog from '../components/shop/ShopItemDialog';
import { ShopEmpty, ShopError, ShopLoading, ShopNoMatches } from '../components/shop/ShopStates';
import { PAGE_META } from '../config/pageMeta';
import { shopItemPageMeta } from '../config/shopMeta';
import { usePageMeta } from '../hooks/usePageMeta';
import { useShopItems } from '../hooks/useShopItems';
import { SHOP_PATH, SHOP_SORTS, filterShopItems, findShopItemBySlug, resolveShopSlug, shopCategories, sortShopItems, type ShopSort } from '../utils/shop';

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
  );
}

/**
 * The shop: camping gear GearBnB sells, one listing per physical piece, all from the RMS
 * (GET /api/customer/shop). Each item has its own address, /catalog/camping-gear-sale/<slug>: its details open over
 * the list, and the build gives it its own page with Product schema (see src/prerender.tsx).
 * Buying happens over Messenger until online checkout is added.
 */
export default function Shop() {
  const { state, retry } = useShopItems();
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [category, setCategory] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<ShopSort>('featured');

  const items = useMemo(() => (state.status === 'ready' ? state.items : []), [state]);
  const categories = useMemo(() => shopCategories(items), [items]);
  // A category that's no longer in the shop (its last item sold) quietly falls back to "All".
  const activeCategory = categories.some((option) => option.label === category) ? category : '';
  const shown = useMemo(() => sortShopItems(filterShopItems(items, { category: activeCategory, query }), sort), [items, activeCategory, query, sort]);

  const openItem = findShopItemBySlug(items, slug);
  // An out-of-date address (a changed listingKey, an older address form) moves to the listing's
  // current one, the same way the server's 301 does; one for a listing that's gone entirely says so.
  const resolved = slug && state.status === 'ready' && !openItem ? resolveShopSlug(items, slug) : null;
  const soldOut = resolved?.type === 'not-found';
  const redirectTo = resolved?.type === 'redirect' ? resolved.to : null;
  useEffect(() => {
    if (redirectTo) navigate(redirectTo, { replace: true });
  }, [redirectTo, navigate]);

  const closeItem = useCallback(() => {
    // Opened from the grid: going back returns to the list exactly as it was. Opened from a link:
    // go to the list instead.
    if ((location.state as { fromShop?: boolean } | null)?.fromShop) navigate(-1);
    else navigate(SHOP_PATH, { replace: true });
  }, [location.state, navigate]);

  const meta = openItem ? shopItemPageMeta(openItem) : PAGE_META.shop;
  usePageMeta(meta.title, meta.description);
  // With an item open, its name is the page's one h1.
  const PageHeading = openItem ? 'h2' : 'h1';

  const clearFilters = () => {
    setCategory('');
    setQuery('');
  };

  return (
    <div className="flex min-h-screen flex-col pb-28">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 sm:gap-6 sm:p-6">
        <div className="flex flex-col gap-1">
          <PageHeading className="font-serif text-2xl font-bold text-ink sm:text-3xl">Camping Gear for Sale</PageHeading>
          <p className="text-sm text-ink-muted">
            Buy camping gear from GearBnB, new and used, one piece at a time. Each listing shows its own photos, condition and
            price. Want to rent instead?{' '}
            <Link to="/catalog" className="font-medium text-accent underline underline-offset-2">
              Browse our rental catalog
            </Link>
            .
          </p>
        </div>

        {soldOut && (
          <div role="status" className="flex flex-col items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-amber-800">That item has been sold or is no longer for sale. Here&rsquo;s everything still available.</p>
            <button
              type="button"
              onClick={() => navigate(SHOP_PATH, { replace: true })}
              className="shrink-0 font-semibold text-amber-900 underline underline-offset-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {state.status === 'loading' && <ShopLoading />}
        {state.status === 'error' && <ShopError error={state.error} onRetry={retry} />}
        {state.status === 'ready' && items.length === 0 && <ShopEmpty />}

        {state.status === 'ready' && items.length > 0 && (
          <div className="flex flex-col gap-4 sm:gap-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="group relative block flex-1">
                <span className="sr-only">Search the shop</span>
                <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-ink-faint transition-colors group-focus-within:text-accent" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by name, brand or model"
                  className="w-full rounded-xl border border-line bg-surface py-2.5 pl-10 pr-3 text-sm text-ink shadow-sm outline-none transition-colors focus:border-brand-forest focus:ring-2 focus:ring-brand-forest/20"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-ink-muted">
                <span className="shrink-0">Sort by</span>
                {/* The browser's own arrow sits differently in every browser: ours is centred instead. */}
                <span className="relative w-full sm:w-auto">
                  <select
                    value={sort}
                    onChange={(event) => setSort(event.target.value as ShopSort)}
                    className="w-full appearance-none rounded-xl border border-line bg-surface py-2.5 pl-3 pr-10 text-sm font-medium text-ink shadow-sm outline-none focus:border-brand-forest focus:ring-2 focus:ring-brand-forest/20"
                  >
                    {SHOP_SORTS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDownIcon className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                </span>
              </label>
            </div>

            {categories.length > 1 && (
              // One swipeable row on phones, wrapping from sm up (same as the Build Your Own categories).
              <div
                role="group"
                aria-label="Filter by category"
                className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [&>*]:shrink-0"
              >
                <FilterPill selected={activeCategory === ''} onClick={() => setCategory('')}>
                  All <span className="opacity-70">({items.length})</span>
                </FilterPill>
                {categories.map((option) => (
                  <FilterPill key={option.label} selected={activeCategory === option.label} onClick={() => setCategory(option.label)}>
                    {option.label} <span className="opacity-70">({option.count})</span>
                  </FilterPill>
                ))}
              </div>
            )}

            <p className="text-xs text-ink-faint" aria-live="polite">
              {shown.length} item{shown.length === 1 ? '' : 's'}
            </p>

            {shown.length === 0 ? (
              <ShopNoMatches onClear={clearFilters} />
            ) : (
              <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-3">
                {shown.map((item) => (
                  <ShopItemCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {openItem && <ShopItemDialog key={openItem.id} item={openItem} onClose={closeItem} headingLevel="h1" />}
    </div>
  );
}
