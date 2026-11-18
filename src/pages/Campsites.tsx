import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import CampsiteCard from '../components/campsites/CampsiteCard';
import CampsiteFilters from '../components/campsites/CampsiteFilters';
import CampsiteMapSlot from '../components/campsites/CampsiteMapSlot';
import FaqAccordion from '../components/FaqAccordion';
import { provincePageMeta } from '../config/campsiteMeta';
import { PAGE_META } from '../config/pageMeta';
import { MESSENGER_URL } from '../config/social';
import { useCampsiteList } from '../context/CampsiteData';
import { usePageMeta } from '../hooks/usePageMeta';
import {
  CAMPSITES_PATH,
  EMPTY_FILTERS,
  activeFilterCount,
  joinWords,
  filterCampsites,
  filterOptions,
  filtersFromParams,
  filtersToParams,
  provinceFaq,
  provinceGroups,
  provinceIntro,
  type CampsiteFilters as Filters,
} from '../utils/campsites';
import { estimateDriveMinutes, loadSavedPlace, savePlace, type Place } from '../utils/travel';
import NotFound from './NotFound';

/** The directory's own FAQ, about the directory itself. Shown on /campsites only. */
const DIRECTORY_FAQ = [
  {
    question: 'How does GearBnB check campsite details?',
    answer:
      'Our team confirms each campsite’s fees, cell signal, restrooms, water, road access and rules, and every listing shows the month we last checked. Fees and rules can change, so confirm with the campsite before you go.',
  },
  {
    question: 'Can I book a campsite through GearBnB?',
    answer:
      'No. Each listing shows how to book the campsite directly. GearBnB never takes campsite bookings or payments, so pay the campsite only through its official channels.',
  },
  {
    question: 'Is it free to list a campsite?',
    answer: 'Yes. Listing a campsite in the directory is free. Message us with the campsite’s name and location and we’ll get in touch.',
  },
  {
    question: 'Where can I rent camping gear for my trip?',
    answer:
      'GearBnB rents tents, beds, chairs, coolers, fans, lights and complete camping packages. Pick up in Las Piñas City or have us book a Lalamove or Grab for the delivery and the return.',
  },
];

/** The results heading, built from the search: "Riverside and Mountain Campsites in Rizal Near
 *  Quezon City", or "All Campsites". */
function resultsHeading(filters: Filters, province: string, from: Place | null): string {
  const types = joinWords(filters.types);
  const near = from ? (from.name === 'My current location' ? 'Near You' : `Near ${from.name.split(',')[0]}`) : '';
  const filtered = types || province || near || activeFilterCount(filters) > 0;
  return [types ? `${types} Campsites` : filtered ? 'Campsites' : 'All Campsites', province && `in ${province}`, near].filter(Boolean).join(' ');
}

function CardSkeleton() {
  return (
    <div aria-hidden="true" className="flex animate-pulse flex-col overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="aspect-[4/3] bg-surface-strong" />
      <div className="flex flex-col gap-2 p-4">
        <div className="h-5 w-2/3 rounded bg-surface-strong" />
        <div className="h-4 w-1/2 rounded bg-surface-strong" />
        <div className="h-4 w-1/3 rounded bg-surface-strong" />
      </div>
    </div>
  );
}

/**
 * Find A Campsite: the directory (/campsites), and one province's campsites
 * (/campsites/province/:province). Filters live in the address bar so a filtered list can be
 * shared; the canonical address stays the plain page.
 */
export default function Campsites() {
  const { province: provinceParam } = useParams();
  const { campsites, state, retry } = useCampsiteList();
  const [searchParams, setSearchParams] = useSearchParams();
  const [hovered, setHovered] = useState<string | null>(null);
  // Where the camper is starting from: remembered in this browser only, never sent to GearBnB.
  const [from, setFromState] = useState<Place | null>(loadSavedPlace);
  const setFrom = (place: Place | null) => {
    setFromState(place);
    savePlace(place);
  };

  const provincesWithPages = useMemo(() => provinceGroups(campsites, { withPagesOnly: true }), [campsites]);
  const province = provinceParam ? (provincesWithPages.find((group) => group.slug === provinceParam) ?? null) : null;
  const pool = province ? province.campsites : campsites;

  const filters = useMemo(() => {
    const parsed = filtersFromParams(searchParams);
    return province ? { ...parsed, province: '' } : parsed;
  }, [searchParams, province]);
  // Nearest first once the camper says where they are.
  const results = useMemo(() => {
    const matches = filterCampsites(pool, filters, from);
    return from ? [...matches].sort((a, b) => estimateDriveMinutes(from, a) - estimateDriveMinutes(from, b)) : matches;
  }, [pool, filters, from]);
  const options = useMemo(() => filterOptions(pool), [pool]);

  const meta = province ? provincePageMeta(province) : PAGE_META.campsites;
  usePageMeta(meta.title, meta.description);

  if (provinceParam && state === 'ready' && !province) return <NotFound />;

  const setFilters = (next: Filters) => setSearchParams(filtersToParams(next), { replace: true });
  const clearFilters = () => setFilters(EMPTY_FILTERS);
  const heading = province ? `Camping Sites in ${province.province}` : 'Find a Campsite in the Philippines';
  const intro = province
    ? provinceIntro(province)
    : 'Discover campsites across the Philippines and find the perfect spot for your next outdoor adventure.';
  const faq = province ? provinceFaq(province) : DIRECTORY_FAQ;

  return (
    <div className="flex min-h-screen flex-col">
      <section className="relative isolate overflow-hidden bg-brand-forest-dark text-white">
        <img
          src="/images/landing-hero.webp"
          alt=""
          aria-hidden="true"
          fetchPriority="high"
          className="absolute inset-0 -z-10 h-full w-full object-cover object-[center_60%]"
        />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-b from-black/55 via-black/45 to-brand-forest-dark/90" />
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-3 px-5 pb-24 pt-14 text-center sm:px-6 sm:pb-32 sm:pt-20">
          {province && (
            <nav aria-label="Breadcrumb" className="text-sm text-white/80">
              <Link to={CAMPSITES_PATH} className="underline-offset-2 hover:underline">
                Find A Campsite
              </Link>{' '}
              › <span aria-current="page">{province.province}</span>
            </nav>
          )}
          <h1 className="font-serif text-3xl font-bold leading-tight drop-shadow-sm sm:text-5xl">{heading}</h1>
          <p className="text-base text-white/90 drop-shadow-sm sm:text-lg">{intro}</p>
        </div>
      </section>

      {/* The filter bar sits over the bottom of the green band. */}
      <div className="relative z-10 mx-auto -mt-14 w-full max-w-5xl px-5 sm:-mt-16 sm:px-6">
        <CampsiteFilters filters={filters} onChange={setFilters} options={options} showProvince={!province} from={from} onFromChange={setFrom} />
      </div>

      {/* The map, edge to edge. */}
      <section aria-label="Map of campsites" className="mt-6 sm:mt-8">
        <CampsiteMapSlot campsites={results} activeSlug={hovered} from={from} className="h-[22rem] sm:h-[30rem] lg:h-[36rem]" />
      </section>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-5 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Search Results</span>
          <h2 id="results-heading" className="font-serif text-2xl font-semibold text-ink sm:text-3xl">
            {resultsHeading(filters, province ? province.province : filters.province, from)}
          </h2>
          <p className="text-sm text-ink-muted" aria-live="polite">
            {state === 'ready' &&
              `${results.length} ${results.length === 1 ? 'campsite' : 'campsites'}${from && results.length > 1 ? ', nearest first' : ''}`}
          </p>
        </div>

        {state === 'error' ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface px-5 py-10 text-center">
            <p className="font-semibold text-ink">We couldn&rsquo;t load the campsites right now.</p>
            <button type="button" onClick={retry} className="rounded-lg bg-brand-forest px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-forest-dark">
              Try again
            </button>
          </div>
        ) : state === 'loading' ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <CardSkeleton key={index} />
            ))}
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface px-5 py-10 text-center">
            <p className="font-semibold text-ink">
              {campsites.length === 0 ? 'Campsites are being added. Check back soon.' : 'No campsites match these filters.'}
            </p>
            {campsites.length > 0 && (
              <button type="button" onClick={clearFilters} className="rounded-lg border border-line px-5 py-2.5 text-sm font-semibold text-ink hover:bg-surface-strong">
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <ul aria-labelledby="results-heading" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((campsite) => (
              <li key={campsite.slug} className="flex">
                <CampsiteCard campsite={campsite} onHover={setHovered} from={from} headingLevel="h3" />
              </li>
            ))}
          </ul>
        )}

        {/* Same green gradient and floating white FAQ card as the homepage FAQ. */}
        <section
          aria-labelledby="campsite-faq"
          className="relative mt-4 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-forest via-brand-forest-dark to-brand-navy px-5 py-8 sm:px-8 sm:py-10"
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-70 [background:radial-gradient(60%_80%_at_50%_0%,color-mix(in_srgb,var(--color-brand-olive)_35%,transparent),transparent_70%)]"
            aria-hidden="true"
          />
          <div className="relative flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <h2 id="campsite-faq" className="font-serif text-2xl font-semibold text-white">
                {province ? `Camping in ${province.province}: FAQ` : 'Frequently Asked Questions'}
              </h2>
              <p className="max-w-2xl text-sm text-white/90">
                Have more questions about our campsite recommendations? Here are quick answers to what campers ask us most. Still
                unsure?{' '}
                <a href={MESSENGER_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-white underline underline-offset-2 hover:text-white/80">
                  Message us
                </a>{' '}
                and we&rsquo;ll help you plan.
              </p>
            </div>
            <FaqAccordion items={faq} />
          </div>
        </section>

        <section className="mt-2 flex flex-col items-start gap-3 rounded-2xl bg-brand-cream/50 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-serif text-lg font-semibold text-ink">Own a campsite?</h2>
            <p className="text-sm text-ink-muted">Get it listed for free. Message us its name and location.</p>
          </div>
          <a
            href={MESSENGER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-brand-forest px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-forest-dark"
          >
            Message Us
          </a>
        </section>
      </div>
    </div>
  );
}
