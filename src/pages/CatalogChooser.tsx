import { Link } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta';
import { PAGE_META } from '../config/pageMeta';
import PathSelectionCards from '../components/PathSelectionCards';

export default function CatalogChooser() {
  usePageMeta(PAGE_META.catalog.title, PAGE_META.catalog.description);
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-16 sm:px-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="font-serif text-2xl font-bold text-ink sm:text-3xl">How Do You Want to Gear Up?</h1>
        <p className="max-w-xl text-sm text-ink-muted">
          Two ways to rent, both fully covered by our verification and split-payment protections.
        </p>
      </div>
      <PathSelectionCards roomyOnMobile showPromoRibbons />
      {/* Buying, not renting: the shop, in the same box style as the homepage's "Ready to build your setup?". */}
      <div className="flex flex-col items-center gap-3 rounded-3xl border border-brand-forest/10 bg-brand-forest/5 p-8 text-center">
        <h2 className="font-serif text-lg font-semibold text-ink sm:text-xl">Buy Camping Gear</h2>
        <p className="max-w-md text-sm text-ink-muted">
          Looking to own your camping essentials? Explore our selection of quality camping gear and find the right equipment
          for your next outdoor adventure.
        </p>
        <Link
          to="/shop"
          className="mt-1 rounded-lg bg-brand-forest px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-forest-dark"
        >
          Buy Now
        </Link>
      </div>
    </div>
  );
}
