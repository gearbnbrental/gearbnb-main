import { Link } from 'react-router-dom';
import { ArrowRightIcon } from '../components/icons';
import { PAGE_META } from '../config/pageMeta';
import { MESSENGER_URL } from '../config/social';
import { usePageMeta } from '../hooks/usePageMeta';

/**
 * What /campsites and every campsite address show until Find A Campsite launches (see
 * CAMPSITES_COMING_SOON in config/features.ts). Same hero photo and green fade as the directory.
 */
export default function CampsitesComingSoon() {
  usePageMeta(PAGE_META.campsites.title, PAGE_META.campsites.description);

  return (
    <section className="relative isolate flex min-h-[calc(100dvh-4.5rem)] items-center overflow-hidden bg-brand-forest-dark text-white">
      <img
        src="/images/landing-hero.webp"
        alt=""
        aria-hidden="true"
        fetchPriority="high"
        className="absolute inset-0 -z-10 h-full w-full object-cover object-[center_60%]"
      />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-b from-black/60 via-black/35 to-brand-forest-dark/95" />
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-5 px-5 py-20 text-center sm:gap-6 sm:px-6">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white backdrop-blur-sm">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#f6c445] motion-safe:animate-pulse" />
          Coming Soon
        </span>
        <h1 className="text-balance font-serif text-[2.5rem] font-bold leading-[1.05] tracking-tight drop-shadow-sm sm:text-6xl">
          Find a Campsite in the Philippines
        </h1>
        <p className="max-w-xl text-pretty text-[15px] leading-relaxed text-white/80 sm:text-lg">
          We&rsquo;re putting together a guide to campsites near Metro Manila and beyond, with entrance fees, cell signal,
          restrooms, pet rules and real camper reviews.
        </p>
        {/* Side by side at every width, each half the row on phones. */}
        <div className="mt-1 grid w-full max-w-md grid-cols-2 gap-3 max-[359px]:gap-2">
          <Link
            to="/catalog"
            className="group flex h-12 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-white px-4 text-[13px] max-[359px]:px-2 max-[359px]:text-xs font-semibold text-brand-forest shadow-lg shadow-black/20 transition hover:bg-brand-cream sm:text-sm"
          >
            Rent Camping Gear
            <ArrowRightIcon className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5 max-[359px]:hidden" />
          </Link>
          <a
            href={MESSENGER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-12 items-center justify-center whitespace-nowrap rounded-full border border-white/30 bg-white/10 px-4 text-[13px] max-[359px]:px-2 max-[359px]:text-xs font-semibold text-white backdrop-blur-sm transition hover:border-white/60 hover:bg-white/20 sm:text-sm"
          >
            Request Campsite List
          </a>
        </div>
        <p className="text-xs text-white/70 sm:text-sm">
          Own a campsite?{' '}
          <a href={MESSENGER_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-white underline decoration-white/40 underline-offset-4 hover:decoration-white">
            Get listed for free
          </a>
        </p>
      </div>
    </section>
  );
}
