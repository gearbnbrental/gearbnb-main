import { useLayoutEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import SocialIconLink from '../components/SocialIconLink';
import { ArrowRightIcon, ChatBubbleIcon } from '../components/icons';
import { PAGE_META } from '../config/pageMeta';
import { MESSENGER_URL } from '../config/social';
import { usePageMeta } from '../hooks/usePageMeta';

/**
 * Height of the site's sticky header (menu bar, plus the icon strip on laptops), kept up to date
 * when it changes size (screen width, the phone menu opening). Null until measured: the page then
 * falls back to fixed sizes in its classes, which is also what the pre-built HTML uses.
 */
function useHeaderHeight(): number | null {
  const [height, setHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const header = document.querySelector('header');
    if (!header) return;
    const update = () => setHeight(Math.round(header.getBoundingClientRect().height));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);
  return height;
}

/**
 * What /campsites and every campsite address show until Find A Campsite launches (see
 * CAMPSITES_COMING_SOON in config/features.ts). Same hero photo and green fade as the directory.
 */
export default function CampsitesComingSoon() {
  usePageMeta(PAGE_META.campsites.title, PAGE_META.campsites.description);
  const headerHeight = useHeaderHeight();

  return (
    <>
      {/* Exactly fills the screen under the sticky header, so the page opens with the content
          centred and the photo ending at the bottom of the screen. Phones are compact so the
          heading, buttons and owners card all fit (100dvh is the visible height in the browser). */}
      <section
        style={headerHeight ? { minHeight: `calc(100dvh - ${headerHeight}px)` } : undefined}
        className="relative isolate flex min-h-[calc(100dvh-3.5rem)] flex-col overflow-hidden bg-brand-forest-dark text-white sm:min-h-[calc(100dvh-4.5rem)] lg:min-h-[calc(100dvh-6.875rem)]"
      >
        <img
          src="/images/landing-hero.webp"
          alt=""
          aria-hidden="true"
          fetchPriority="high"
          className="absolute inset-0 -z-10 h-full w-full object-cover object-[center_60%]"
        />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-b from-black/60 via-black/35 to-brand-forest-dark/95" />
        {/* The text, buttons and owners card stay together as one group, centred on the photo, with
            about 1cm extra between the buttons and the card (less on very short screens, so the
            card still fits the first screen). */}
        <div className="flex flex-1 flex-col justify-center gap-16 py-6 sm:gap-20 sm:py-16 [@media(max-height:600px)]:gap-6 [@media(max-height:600px)]:py-4 sm:[@media(max-height:780px)]:py-6">
          <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-3.5 px-5 text-center sm:gap-6 sm:px-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white backdrop-blur-sm">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#f6c445] motion-safe:animate-pulse" />
              Coming Soon
            </span>
            <h1 className="text-balance font-serif text-[2.1rem] font-bold leading-[1.05] tracking-tight drop-shadow-sm sm:text-6xl">
              Find a Campsite in the Philippines
            </h1>
            <p className="max-w-xl text-pretty text-sm leading-relaxed text-white/80 sm:text-lg">
              We&rsquo;re putting together a guide to campsites near Metro Manila and beyond, with entrance fees, cell signal,
              restrooms, pet rules and real camper reviews.
            </p>
            {/* Side by side at every width, each half the row on phones. */}
            <div className="mt-1 grid w-full max-w-md grid-cols-2 gap-3 max-[359px]:gap-2">
              <Link
                to="/catalog"
                className="group flex h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-white px-4 text-[13px] max-[359px]:px-2 max-[359px]:text-xs font-semibold text-brand-forest shadow-lg shadow-black/20 transition hover:bg-brand-cream sm:h-12 sm:text-sm"
              >
                Rent Camping Gear
                <ArrowRightIcon className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5 max-[359px]:hidden" />
              </Link>
              <a
                href={MESSENGER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-11 items-center justify-center whitespace-nowrap rounded-full border border-white/30 bg-white/10 px-4 text-[13px] max-[359px]:px-2 max-[359px]:text-xs font-semibold text-white backdrop-blur-sm transition hover:border-white/60 hover:bg-white/20 sm:h-12 sm:text-sm"
              >
                Request Campsite List
              </a>
            </div>
          </div>
          {/* For campsite owners: the homepage's "Not sure what to rent?" layout, in this page's own
              look (see-through glass on the photo, like the Request Campsite List button), a short
              step below the buttons. */}
          <div role="region" aria-labelledby="campsite-owners" className="px-5 sm:px-6">
            <div className="mx-auto w-full max-w-3xl rounded-2xl border border-white/20 bg-white/10 p-3.5 text-left shadow-lg shadow-black/20 backdrop-blur-md sm:p-5">
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-white ring-1 ring-white/20 sm:h-10 sm:w-10">
                    <ChatBubbleIcon className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <h2 id="campsite-owners" className="text-sm font-bold text-white sm:text-base">
                      Own a campsite? Get listed for FREE
                    </h2>
                    <p className="text-xs text-white/75 sm:text-sm">
                      Send us a message to list your campsite for free and explore partnerships with GearBnB.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-3 sm:justify-end sm:gap-4 sm:border-l sm:border-white/15 sm:pl-5">
                  <SocialIconLink platform="messenger" showLabel size="sm" tone="dark" />
                  <SocialIconLink platform="facebook" showLabel size="sm" tone="dark" />
                  <SocialIconLink platform="tiktok" showLabel size="sm" tone="dark" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
