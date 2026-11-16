import { Link } from 'react-router-dom';
import SocialIconLink from '../components/SocialIconLink';
import { ArrowRightIcon, ChatBubbleIcon } from '../components/icons';
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
    <>
      <section className="relative isolate flex min-h-[calc(100dvh-4.5rem)] items-center overflow-hidden bg-brand-forest-dark pb-10 text-white">
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
        </div>
      </section>

      {/* For campsite owners: the same floating card as the homepage's "Not sure what to rent?",
          overlapping the bottom of the photo. */}
      <section aria-labelledby="campsite-owners" className="relative z-20 -mt-12 px-5 pb-14 sm:-mt-14 sm:px-6 sm:pb-20">
        <div className="mx-auto w-full max-w-3xl rounded-2xl border border-line bg-surface p-4 text-left shadow-lg sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-forest text-white sm:h-10 sm:w-10">
                <ChatBubbleIcon className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
              </span>
              <div className="flex flex-col gap-0.5">
                <h2 id="campsite-owners" className="text-sm font-bold text-ink sm:text-base">
                  Own a campsite? Get listed for free
                </h2>
                <p className="text-xs text-ink-muted sm:text-sm">
                  Send us a message to list your campsite for free and explore partnerships with GearBnB.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-center gap-3 sm:justify-end sm:gap-4 sm:border-l sm:border-line-soft sm:pl-5">
              <SocialIconLink platform="messenger" showLabel size="sm" />
              <SocialIconLink platform="facebook" showLabel size="sm" />
              <SocialIconLink platform="tiktok" showLabel size="sm" />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
