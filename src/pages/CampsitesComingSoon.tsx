import { Link } from 'react-router-dom';
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
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-b from-black/55 via-black/45 to-brand-forest-dark/90" />
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 px-5 py-20 text-center sm:px-6">
        <span className="rounded-full bg-[#f6c445] px-4 py-1.5 text-xs font-extrabold uppercase tracking-wide text-ink shadow-md sm:text-sm">
          Coming Soon
        </span>
        <h1 className="font-serif text-4xl font-bold leading-tight drop-shadow-sm sm:text-6xl">Find A Campsite</h1>
        <p className="text-base text-white/90 drop-shadow-sm sm:text-lg">
          We&rsquo;re putting together a guide to campsites near Metro Manila and beyond, with entrance fees, cell signal,
          restrooms, pet rules and real camper reviews. Check back soon!
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/catalog"
            className="rounded-lg bg-white px-6 py-3 text-sm font-semibold text-brand-forest shadow-md transition-all hover:-translate-y-0.5 hover:bg-brand-cream"
          >
            Rent Camping Gear
          </Link>
          <a
            href={MESSENGER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-white/60 px-6 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:border-white hover:bg-white/10"
          >
            Ask Us for a Campsite
          </a>
        </div>
        <p className="text-sm text-white/80">
          Own a campsite?{' '}
          <a href={MESSENGER_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-white underline underline-offset-2">
            Message us
          </a>{' '}
          to get it listed for free.
        </p>
      </div>
    </section>
  );
}
