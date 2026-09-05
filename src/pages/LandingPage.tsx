import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import PathSelectionCards from '../components/PathSelectionCards';
import SocialLinks from '../components/SocialLinks';
import { CheckIcon, ChevronIcon, GearPlaceholderIcon } from '../components/icons';
import { useCatalog } from '../context/CatalogContext';
import { mockPackages } from '../data/mockData';
import type { IndividualItem } from '../types/gearbnb';
import { formatCurrency } from '../utils/format';

function PathsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 19.5h4.5L15 6h4.5M4 6h4.5L15 19.5h4.5" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3.75 5.25 6.375v5.25c0 4.24 2.888 8.108 6.75 9.093 3.862-.985 6.75-4.853 6.75-9.093v-5.25L12 3.75Zm-2.25 8.25 1.75 1.75 3.25-3.75"
      />
    </svg>
  );
}

function TruckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 6.75h9v9h-9v-9Zm9 3h3.375L18.75 12v3.75H12.75m-6-1.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm10.5 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z"
      />
    </svg>
  );
}

function ReceiptIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.75 3.75h10.5v16.5l-2.25-1.5-2.25 1.5-2.25-1.5-2.25 1.5-1.5-1.5V3.75Zm2.25 4.5h6m-6 3h6m-6 3h3.75"
      />
    </svg>
  );
}

function CalendarCheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.75 3v2.25M17.25 3v2.25M3.75 8.25h16.5M4.5 6h15a.75.75 0 0 1 .75.75V19.5a.75.75 0 0 1-.75.75h-15a.75.75 0 0 1-.75-.75V6.75A.75.75 0 0 1 4.5 6Zm3.75 8.25 2.25 2.25 4.5-4.5"
      />
    </svg>
  );
}

interface ProcessStep {
  title: string;
  description: string;
  icon: ReactNode;
}

const PROCESS_STEPS: ProcessStep[] = [
  {
    title: 'Select Gear',
    description: 'Choose a bundle (Path A) or build your custom setup (Path B).',
    icon: <PathsIcon className="h-5 w-5" />,
  },
  {
    title: 'Verify & Book',
    description: 'Submit trip dates, fulfillment preference (pickup/delivery), and identity verification documents.',
    icon: <CalendarCheckIcon className="h-5 w-5" />,
  },
  {
    title: 'Admin Review & Deposit',
    description: 'Receive confirmation upon document approval and pay the security deposit to secure your booking.',
    icon: <ReceiptIcon className="h-5 w-5" />,
  },
  {
    title: 'Pick Up / Delivery',
    description: 'Receive your camping gear on your start date.',
    icon: <TruckIcon className="h-5 w-5" />,
  },
];

const CATALOG_PAGE_SIZE = 8;

function CatalogPreviewCard({ item }: { item: IndividualItem }) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg bg-surface-strong">
        {imageFailed || !item.imageUrl ? (
          <GearPlaceholderIcon className="h-10 w-10 text-ink-faint" />
        ) : (
          <img
            src={item.imageUrl}
            alt={item.name}
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover"
          />
        )}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-ink">{item.name}</h3>
        <p className="text-xs text-ink-faint">{item.category}</p>
      </div>
      <p className="text-sm font-semibold text-brand-forest">From {formatCurrency(item.pricing['48h'])}</p>
    </div>
  );
}

interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-forest/10 text-brand-forest">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <p className="text-sm text-ink-muted">{description}</p>
    </div>
  );
}

const FEATURES: FeatureCardProps[] = [
  {
    icon: <PathsIcon className="h-5 w-5" />,
    title: 'Two Ways to Gear Up',
    description: "Pick a ready-made package, or build your own from individual gear — whatever fits your trip.",
  },
  {
    icon: <ShieldIcon className="h-5 w-5" />,
    title: 'Verified Community',
    description: 'Every renter is ID-verified and every item is deposit-protected before it leaves our hands.',
  },
  {
    icon: <TruckIcon className="h-5 w-5" />,
    title: 'Pickup or Delivery',
    description: "Grab your gear yourself, or have it delivered straight to your campsite.",
  },
  {
    icon: <ReceiptIcon className="h-5 w-5" />,
    title: 'Transparent Split Payment',
    description: 'See your refundable deposit and rental fee broken down clearly before you book.',
  },
];

const PLACEHOLDER_BRANDS = ['TRAILWORKS', 'SUMMIT & CO.', 'PEAKLINE', 'NORTHBOUND', 'WILDPATH'];

export default function LandingPage() {
  const navigate = useNavigate();
  const { kits, items } = useCatalog();
  const categories = useMemo(() => {
    const unique = Array.from(new Set(items.map((item) => item.category)));
    return ['All', ...unique];
  }, [items]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [catalogPage, setCatalogPage] = useState(1);

  const visibleItems: IndividualItem[] =
    activeCategory === 'All' ? items : items.filter((item) => item.category === activeCategory);

  const catalogPageCount = Math.max(1, Math.ceil(visibleItems.length / CATALOG_PAGE_SIZE));
  const paginatedItems = visibleItems.slice(
    (catalogPage - 1) * CATALOG_PAGE_SIZE,
    catalogPage * CATALOG_PAGE_SIZE,
  );

  function handleCategorySelect(category: string) {
    setActiveCategory(category);
    setCatalogPage(1);
  }

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden px-4 py-24 text-center sm:px-6 sm:py-32">
        <img
          src="/images/hero.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-brand-forest/80" />

        <div className="relative mx-auto flex w-full max-w-3xl flex-col items-center gap-6">
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-cream">
            Located in Las Piñas City
          </span>
          <h1 className="font-serif text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Camping Gears Rental in the Philippines Made Easy
          </h1>
          <p className="max-w-xl text-base text-white/80">
            Great camping trips start with the right gear, and we&rsquo;ve got it ready for you.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/catalog')}
              className="rounded-lg bg-brand-forest px-6 py-3 text-sm font-semibold text-white shadow-sm ring-1 ring-white/20 transition-colors hover:bg-brand-forest-dark"
            >
              Rent Your Gears
            </button>
            <button
              type="button"
              onClick={() => navigate('/event-plan')}
              className="rounded-lg border border-white/40 bg-transparent px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-white/10"
            >
              Plan An Event
            </button>
          </div>
        </div>
      </section>

      {/* Path selection */}
      <section className="px-4 py-16 sm:px-6">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
          <div className="flex flex-col items-center gap-2 text-center">
            <h2 className="font-serif text-2xl font-bold text-ink sm:text-3xl">How Do You Want to Gear Up?</h2>
            <p className="max-w-xl text-sm text-ink-muted">
              Two ways to rent, both fully covered by our verification and split-payment protections.
            </p>
          </div>
          <PathSelectionCards />
        </div>
      </section>

      {/* How does the process work */}
      <section className="bg-page-band px-4 py-16 sm:px-6">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
          <div className="flex flex-col items-center gap-2 text-center">
            <h2 className="font-serif text-2xl font-bold text-ink sm:text-3xl">How Does the Process Work?</h2>
            <p className="max-w-xl text-sm text-ink-muted">
              From picking your gear to pickup day, here&rsquo;s exactly what to expect.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PROCESS_STEPS.map((step, index) => (
              <div key={step.title} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-forest text-sm font-bold text-white">
                    {index + 1}
                  </span>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-forest/10 text-brand-forest">
                    {step.icon}
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-ink">{step.title}</h3>
                <p className="text-sm text-ink-muted">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Placeholder brand strip */}
      <section className="border-b border-line-soft px-4 py-8 sm:px-6">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
            Gear from names campers trust
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
            {PLACEHOLDER_BRANDS.map((brand) => (
              <span key={brand} className="text-sm font-bold tracking-wide text-ink-faint">
                {brand}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Catalog preview */}
      <section className="px-4 py-16 sm:px-6">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
          <div className="flex flex-col items-center gap-2 text-center">
            <h2 className="font-serif text-2xl font-bold text-ink sm:text-3xl">
              Explore the Best Outdoor Adventure Gear
            </h2>
            <p className="max-w-xl text-sm text-ink-muted">
              High-quality, ready-to-rent equipment for your next adventure.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => handleCategorySelect(category)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  activeCategory === category
                    ? 'bg-brand-forest text-white'
                    : 'bg-surface-strong text-ink-muted hover:bg-line'
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {paginatedItems.map((item) => (
              <CatalogPreviewCard key={item.id} item={item} />
            ))}
          </div>

          {catalogPageCount > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setCatalogPage((page) => Math.max(1, page - 1))}
                disabled={catalogPage === 1}
                aria-label="Previous page"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink-muted transition-colors hover:bg-surface-strong disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronIcon direction="left" className="h-4 w-4" />
              </button>
              {Array.from({ length: catalogPageCount }, (_, index) => index + 1).map((pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  onClick={() => setCatalogPage(pageNumber)}
                  aria-current={catalogPage === pageNumber ? 'page' : undefined}
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                    catalogPage === pageNumber
                      ? 'bg-brand-forest text-white'
                      : 'text-ink-muted hover:bg-surface-strong'
                  }`}
                >
                  {pageNumber}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCatalogPage((page) => Math.min(catalogPageCount, page + 1))}
                disabled={catalogPage === catalogPageCount}
                aria-label="Next page"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink-muted transition-colors hover:bg-surface-strong disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronIcon direction="right" className="h-4 w-4" />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => navigate('/catalog/path-b')}
            className="mx-auto rounded-lg bg-brand-forest px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-forest-dark"
          >
            View All Catalog
          </button>
        </div>
      </section>

      {/* Why rent with us */}
      <section className="bg-page-band px-4 py-16 sm:px-6">
        <div className="mx-auto grid w-full max-w-5xl gap-10 lg:grid-cols-2 lg:items-center">
          <div className="relative overflow-hidden rounded-2xl border border-line bg-surface p-10 sm:p-14">
            <svg viewBox="0 0 200 140" className="mx-auto h-40 w-40 text-brand-forest/70 sm:h-48 sm:w-48">
              <path
                d="M20 120 L100 30 L180 120 Z"
                fill="none"
                stroke="currentColor"
                strokeWidth={4}
                strokeLinejoin="round"
              />
              <path d="M100 30 L100 120" stroke="currentColor" strokeWidth={3} />
              <circle cx="70" cy="15" r="3" fill="currentColor" />
              <circle cx="100" cy="5" r="3" fill="currentColor" />
              <circle cx="130" cy="15" r="3" fill="currentColor" />
            </svg>
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between rounded-xl border border-line bg-white px-4 py-3 shadow-lg sm:left-6 sm:right-auto sm:w-56">
              <div>
                <p className="text-xs font-medium text-gray-500">Nomad Kit</p>
                <p className="text-sm font-semibold text-gray-900">
                  {/* Static illustrative example — not live catalog data. */}
                  From {formatCurrency(mockPackages[0].pricing['48h'])}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div>
              <h2 className="font-serif text-2xl font-bold text-ink sm:text-3xl">Why Rent with GearBNB?</h2>
              <p className="mt-2 text-sm text-ink-muted">
                Our booking flow is built around trust and clarity, so every trip starts stress-free.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {FEATURES.map((feature) => (
                <FeatureCard key={feature.title} {...feature} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Bundles */}
      <section className="px-4 py-16 sm:px-6">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
          <div className="flex flex-col items-center gap-2 text-center">
            <h2 className="font-serif text-2xl font-bold text-ink sm:text-3xl">
              Adventure Bundles for Every Explorer
            </h2>
            <p className="max-w-xl text-sm text-ink-muted">
              Ready-made packages that bundle everything you need into one simple booking.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {kits.map((kit) => (
              <button
                key={kit.id}
                type="button"
                onClick={() => navigate('/catalog/path-a')}
                className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5 text-left shadow-sm transition-shadow hover:shadow-md"
              >
                <div>
                  <h3 className="text-base font-semibold text-ink">{kit.name}</h3>
                  <p className="mt-1 text-sm text-ink-muted">{kit.description}</p>
                </div>
                <ul className="flex flex-col gap-1.5 text-sm text-ink-muted">
                  {kit.includedItems.map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <CheckIcon className="h-4 w-4 shrink-0 text-brand-forest" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-auto pt-2 text-sm font-semibold text-brand-forest">
                  From {formatCurrency(kit.pricing['48h'])} &middot; {formatCurrency(kit.depositAmount)} deposit
                </p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section className="bg-gradient-to-br from-brand-brown to-brand-navy px-4 py-16 text-center sm:px-6">
        <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-5">
          <h2 className="font-serif text-3xl font-bold text-white sm:text-4xl">Gear Up for Your Next Adventure</h2>
          <p className="text-sm text-white/80">
            From mountain peaks to forest trails &mdash; get the gear you need, when you need it.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/catalog')}
              className="rounded-lg border border-white/50 bg-transparent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              Explore All Gear
            </button>
            <button
              type="button"
              onClick={() => navigate('/catalog')}
              className="rounded-lg bg-white px-6 py-3 text-sm font-semibold text-brand-forest shadow-sm transition-colors hover:bg-brand-cream"
            >
              Reserve Now &rarr;
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-brand-brown px-4 py-12 sm:px-6">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <img src="/brand_assets/GEARBNB_logo.png" alt="" className="h-8 w-8 rounded-full" />
                <span className="font-serif text-base font-bold text-brand-cream">GearBNB</span>
              </div>
              <p className="text-sm text-white/70">
                Your gateway to the outdoors. Rent tents, sleeping bags, and full camp kits &mdash; no buying required.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-white">Quick Links</h3>
              <button type="button" onClick={() => navigate('/catalog')} className="w-fit text-left text-sm text-white/70 hover:text-brand-cream">
                Rent Gear
              </button>
              <span className="text-sm text-white/70">Adventure Bundles</span>
              <span className="text-sm text-white/70">Event Plan</span>
            </div>

            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-white">Rental Help</h3>
              <span className="text-sm text-white/70">How Renting Works</span>
              <span className="text-sm text-white/70">Pricing &amp; Fees</span>
              <span className="text-sm text-white/70">Gear Care Tips</span>
            </div>

            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-white">Policies</h3>
              <span className="text-sm text-white/70">Rental Terms</span>
              <span className="text-sm text-white/70">Privacy Policy</span>
              <span className="text-sm text-white/70">Deposit &amp; Refunds</span>
            </div>
          </div>

          <div className="flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-white/60 sm:flex-row">
            <span>&copy; 2026 GearBNB. All rights reserved.</span>
            <div className="flex items-center gap-2">
              <SocialLinks className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-brand-cream transition-opacity hover:opacity-80" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
