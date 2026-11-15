import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AmenityIconSvg from '../components/campsites/AmenityIcons';
import CampsiteCard from '../components/campsites/CampsiteCard';
import CampsiteGallery from '../components/campsites/CampsiteGallery';
import CampsiteMapSlot from '../components/campsites/CampsiteMapSlot';
import CampsiteReviews from '../components/campsites/CampsiteReviews';
import CampsiteSignInNudge from '../components/campsites/CampsiteSignInNudge';
import ContactCampsiteDialog from '../components/campsites/ContactCampsiteDialog';
import FaqAccordion from '../components/FaqAccordion';
import { ArrowRightIcon, MapPinIcon, PhoneIcon } from '../components/icons';
import { campsitePageMeta } from '../config/campsiteMeta';
import { LOGO_PATH } from '../config/pageMeta';
import { MESSENGER_URL } from '../config/social';
import { useCampsite, useCampsiteList } from '../context/CampsiteData';
import { useRental } from '../context/RentalContext';
import { usePageMeta } from '../hooks/usePageMeta';
import type { Campsite } from '../types/campsite';
import { contactChannels, type ContactChannel } from '../utils/campsiteContact';
import {
  CAMPSITES_PATH,
  DETAIL_LABELS,
  campsiteAmenityGroups,
  campsiteFaq,
  campsiteKeyHighlights,
  campsiteSummarySentence,
  checkedMonth,
  driveTimeText,
  featuredAmenities,
  feeText,
  gearSuggestions,
  headlineFee,
  joinWords,
  placeName,
  provinceGroups,
  provincePath,
  type Amenity,
} from '../utils/campsites';
import { useStickyBarRef } from '../utils/stickyBar';
import { distanceKm } from '../utils/travel';
import NotFound from './NotFound';

const BOOKING_LABEL: Record<NonNullable<Campsite['bookingMethod']>, string> = {
  FACEBOOK: 'Book through their Facebook page',
  PHONE: 'Book by phone',
  SMS: 'Book by text message',
  WEBSITE: 'Book on their website',
  WALK_IN: 'Walk-ins welcome',
  OTHER: 'Contact the campsite to book',
};

const sectionClass = 'flex flex-col gap-5 border-b border-line py-8 last:border-b-0';
const sectionHeading = 'font-serif text-2xl font-semibold text-ink';
const outlineButton =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-ink px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-surface-strong';

function AmenityRow({ amenity }: { amenity: Amenity }) {
  return (
    <li className="flex items-center gap-4 py-2">
      <AmenityIconSvg icon={amenity.icon} className={`h-6 w-6 shrink-0 ${amenity.available ? 'text-ink' : 'text-ink-faint'}`} />
      <span className={amenity.available ? 'text-ink' : 'text-ink-muted'}>
        {!amenity.available && <span className="sr-only">Not available: </span>}
        <span className={amenity.available ? '' : 'line-through'}>{amenity.label}</span>
        {amenity.detail && <span className="block text-sm text-ink-muted">{amenity.detail}</span>}
      </span>
    </li>
  );
}

/** "Show all details": every confirmed detail, grouped, in a dialog (a bottom sheet on phones). */
function AmenitiesDialog({ campsite, onClose }: { campsite: Campsite; onClose: () => void }) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="amenities-title"
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-surface shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 id="amenities-title" className="font-serif text-xl font-semibold text-ink">
            What this campsite offers
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" autoFocus className="flex h-9 w-9 items-center justify-center rounded-full text-xl hover:bg-surface-strong">
            ×
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-4">
          {campsiteAmenityGroups(campsite).map((group) => (
            <section key={group.title} className="border-b border-line-soft py-4 last:border-b-0">
              <h3 className="mb-2 text-lg font-semibold text-ink">{group.title}</h3>
              <ul className="divide-y divide-line-soft">
                {group.items.map((amenity) => (
                  <AmenityRow key={`${group.title}-${amenity.label}`} amenity={amenity} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = window.location.href.split('#')[0];
    try {
      if (navigator.share) await navigator.share({ title, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // Cancelled by the camper, or the clipboard is blocked: nothing to do.
    }
  }
  return (
    <button type="button" onClick={share} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-ink underline-offset-2 hover:bg-surface-strong hover:underline">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
        <path d="M12 15V3M7.5 7.5 12 3l4.5 4.5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
      </svg>
      <span aria-live="polite">{copied ? 'Link copied' : 'Share'}</span>
    </button>
  );
}

function DetailSkeleton() {
  return (
    <div aria-hidden="true" className="mx-auto flex w-full max-w-6xl animate-pulse flex-col gap-4 px-5 py-6 sm:px-6">
      <div className="h-8 w-2/3 rounded bg-surface-strong" />
      <div className="h-4 w-1/3 rounded bg-surface-strong" />
      <div className="aspect-[2/1] w-full rounded-2xl bg-surface-strong" />
      <div className="h-24 w-full rounded bg-surface-strong" />
    </div>
  );
}

/** One campsite's page (/campsites/:slug), laid out like an Airbnb listing. */
export default function CampsiteDetail() {
  const { slug } = useParams();
  const { campsite, state, retry, reload } = useCampsite(slug);
  const { campsites } = useCampsiteList();
  const stickyBarRef = useStickyBarRef();
  const { updateTripDetails } = useRental();
  const navigate = useNavigate();
  const [amenitiesOpen, setAmenitiesOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const closeAmenities = useCallback(() => setAmenitiesOpen(false), []);
  // The contact button the camper tapped: opens the sign-in / lead code pop-up.
  const [contact, setContact] = useState<ContactChannel | null>(null);
  const closeContact = useCallback(() => setContact(null), []);

  const provinceHasPage = useMemo(
    () => !!campsite && provinceGroups(campsites, { withPagesOnly: true }).some((group) => group.province === campsite.province.trim()),
    [campsites, campsite],
  );
  const nearby = useMemo(
    () =>
      campsite
        ? campsites
            .filter((other) => other.slug !== campsite.slug)
            .sort((a, b) => distanceKm(campsite, a) - distanceKm(campsite, b))
            .slice(0, 3)
        : [],
    [campsites, campsite],
  );

  const meta = campsite ? campsitePageMeta(campsite, provinceHasPage) : null;
  usePageMeta(meta?.title ?? 'Find A Campsite | GearBnB', meta?.description ?? '');

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [slug]);

  if (state === 'not-found') return <NotFound />;
  if (state === 'error') {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-3 px-5 text-center">
        <p className="font-semibold text-ink">We couldn&rsquo;t load this campsite right now.</p>
        <button type="button" onClick={retry} className="rounded-lg bg-brand-forest px-5 py-2.5 text-sm font-semibold text-white">
          Try again
        </button>
      </div>
    );
  }
  if (!campsite) return <DetailSkeleton />;

  const d = campsite.details;
  const checked = checkedMonth(campsite.detailsCheckedAt);
  const mapsUrl = campsite.googleMapsUrl ?? `https://www.google.com/maps/search/?api=1&query=${campsite.lat},${campsite.lng}`;
  const wazeUrl = `https://waze.com/ul?ll=${campsite.lat},${campsite.lng}&navigate=yes`;
  const fee = headlineFee(campsite);
  const entranceFee = feeText(campsite.entranceFeeCentavos, campsite.feeUnit);
  const campingFee = feeText(campsite.campingFeeCentavos, campsite.feeUnit);
  const drive = driveTimeText(campsite.driveMinutesFromLasPinas);
  const highlights = campsiteKeyHighlights(campsite);
  const amenities = featuredAmenities(campsite, 10);
  const amenityCount = campsiteAmenityGroups(campsite).reduce((total, group) => total + group.items.length, 0);
  const terrain = joinWords(d.terrain.map((label) => label.toLowerCase()));
  const kind = terrain ? `${terrain.charAt(0).toUpperCase()}${terrain.slice(1)} campsite` : 'Campsite';
  const rated = campsite.rating.count > 0 && campsite.rating.average !== null;
  const paragraphs = campsite.description.split(/\n{2,}/).filter(Boolean);

  function rentGear() {
    updateTripDetails({ destination: `${campsite!.name}, ${placeName(campsite!)}` });
    navigate('/catalog');
  }

  const thingsToKnow = [
    {
      title: 'Camp rules',
      lines: [
        d.petPolicy && DETAIL_LABELS.petPolicy[d.petPolicy],
        d.campfire && `Bonfire: ${DETAIL_LABELS.campfire[d.campfire].toLowerCase()}`,
        d.cookingAllowed !== null && (d.cookingAllowed ? 'Cooking allowed' : 'No cooking'),
        ...(d.houseRules ? d.houseRules.split(/\n+/) : []),
      ],
    },
    {
      title: 'Getting there',
      lines: [
        drive && `${drive.charAt(0).toUpperCase()}${drive.slice(1)} by car from Las Piñas`,
        d.roadAccess && `Road: ${DETAIL_LABELS.roadAccess[d.roadAccess].toLowerCase()}`,
        d.parking && (d.parking === 'PARK_AND_WALK' && d.parkingWalkMinutes ? `Park, then walk about ${d.parkingWalkMinutes} minutes` : DETAIL_LABELS.parking[d.parking]),
        d.carCamping !== null && (d.carCamping ? 'Car camping allowed' : 'No car camping'),
        d.motoCamping !== null && (d.motoCamping ? 'Motocamping allowed' : 'No motocamping'),
      ],
    },
    {
      title: 'Good to know',
      lines: [
        campsite.operatingHours && `Hours: ${campsite.operatingHours}`,
        d.bestTimeToVisit && `Best time to visit: ${d.bestTimeToVisit}`,
        campsite.feeNotes && `Fees: ${campsite.feeNotes}`,
        'Fees and rules can change, so confirm with the campsite before you go.',
      ],
    },
  ].map((column) => ({ ...column, lines: column.lines.filter((line): line is string => typeof line === 'string' && line.length > 0) }));

  return (
    <div className="flex min-h-screen flex-col pb-24 lg:pb-0">
      {contact && <ContactCampsiteDialog campsite={campsite} contact={contact} onClose={closeContact} />}
      <CampsiteSignInNudge slug={campsite.slug} />
      <article className="mx-auto flex w-full max-w-6xl flex-col px-5 sm:px-6 sm:pt-6">
        {/* Phones: the photos first (full width), then the title. Wider: the title above the photo grid. */}
        <div className="order-2 flex flex-col gap-2 pt-5 sm:order-1 sm:pt-0">
          <nav aria-label="Breadcrumb" className="hidden text-sm text-ink-muted sm:block">
            <Link to={CAMPSITES_PATH} className="underline-offset-2 hover:underline">
              Find A Campsite
            </Link>{' '}
            ›{' '}
            {provinceHasPage ? (
              <Link to={provincePath(campsite.province)} className="underline-offset-2 hover:underline">
                {campsite.province}
              </Link>
            ) : (
              campsite.province
            )}{' '}
            › <span aria-current="page">{campsite.name}</span>
          </nav>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h1 className="font-serif text-2xl font-bold leading-tight text-ink sm:text-3xl">{campsite.name}</h1>
            <div className="hidden sm:block">
              <ShareButton title={campsite.name} />
            </div>
          </div>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink">
            {rated ? (
              <a href="#reviews" className="flex items-center gap-1 font-semibold text-ink">
                <span aria-hidden="true" className="text-[#f5b400]">
                  ★
                </span>{' '}
                {campsite.rating.average!.toFixed(1)} <span aria-hidden="true">·</span>{' '}
                <span className="underline underline-offset-2">
                  {campsite.rating.count} {campsite.rating.count === 1 ? 'review' : 'reviews'}
                </span>
              </a>
            ) : (
              <span className="text-ink-muted">No reviews yet</span>
            )}{' '}
            <span aria-hidden="true">·</span>{' '}
            <a href="#location" className="font-semibold underline underline-offset-2">
              {placeName(campsite)}
            </a>
          </p>
        </div>
        <div className="order-1 sm:order-2 sm:pt-5">
          <CampsiteGallery campsite={campsite} />
        </div>

        <div className="order-3 grid gap-x-16 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex min-w-0 flex-col">
            <section className={sectionClass}>
              <div>
                <h2 className="text-xl font-semibold text-ink">
                  {kind} in {placeName(campsite)}
                </h2>
                <p className="text-ink-muted">
                  {[drive && `${drive.charAt(0).toUpperCase()}${drive.slice(1)} from Las Piñas`, entranceFee && `Entrance ${entranceFee.toLowerCase()}`, campingFee && `Camping ${campingFee.toLowerCase()}`]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <div className="flex items-center gap-4 border-t border-line pt-5">
                <img src={LOGO_PATH} alt="" className="h-12 w-12 rounded-full border border-line bg-white object-contain p-1" />
                <div>
                  <p className="font-semibold text-ink">Details checked by GearBnB</p>
                  <p className="text-sm text-ink-muted">{checked ? `Last checked ${checked}` : 'Being checked by our team'}</p>
                </div>
              </div>
            </section>

            {highlights.length > 0 && (
              <section aria-label="Highlights" className={sectionClass}>
                <ul className="flex flex-col gap-6">
                  {highlights.map((highlight) => (
                    <li key={highlight.title} className="flex gap-5">
                      <AmenityIconSvg icon={highlight.icon} className="h-7 w-7 shrink-0 text-ink" />
                      <div>
                        <p className="font-semibold text-ink">{highlight.title}</p>
                        <p className="text-sm text-ink-muted">{highlight.text}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section aria-labelledby="about" className={sectionClass}>
              <h2 id="about" className="sr-only">
                About {campsite.name}
              </h2>
              <p className="text-base leading-relaxed text-ink">{campsiteSummarySentence(campsite)}</p>
              <div className={aboutOpen ? 'flex flex-col gap-4' : 'line-clamp-4'}>
                {paragraphs.map((paragraph, index) => (
                  <p key={index} className="whitespace-pre-line text-base leading-relaxed text-ink">
                    {paragraph}
                  </p>
                ))}
              </div>
              {campsite.description.length > 280 && (
                <button type="button" onClick={() => setAboutOpen((value) => !value)} className="flex items-center gap-1 self-start font-semibold text-ink underline underline-offset-2">
                  {aboutOpen ? 'Show less' : 'Show more'} <ArrowRightIcon className={`h-4 w-4 ${aboutOpen ? '-rotate-90' : ''}`} />
                </button>
              )}
            </section>

            {amenities.length > 0 && (
              <section aria-labelledby="offers" className={sectionClass}>
                <h2 id="offers" className={sectionHeading}>
                  What this campsite offers
                </h2>
                <ul className="grid gap-x-8 sm:grid-cols-2">
                  {amenities.map((amenity) => (
                    <AmenityRow key={amenity.label} amenity={amenity} />
                  ))}
                </ul>
                <button type="button" onClick={() => setAmenitiesOpen(true)} className={`${outlineButton} self-start`}>
                  Show all {amenityCount} details
                </button>
              </section>
            )}

            {d.activities.length > 0 && (
              <section aria-labelledby="things-to-do" className={sectionClass}>
                <h2 id="things-to-do" className={sectionHeading}>
                  Things to do
                </h2>
                <ul className="flex flex-wrap gap-2">
                  {d.activities.map((activity) => (
                    <li key={activity} className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-ink">
                      {activity}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {/* The sticky card, like Airbnb's booking box. */}
          <aside aria-label="Plan your trip" className="pb-8 lg:py-8">
            <div className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-6 shadow-[0_6px_16px_rgba(0,0,0,0.12)] lg:sticky lg:top-28">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-ink">
                  <span className="text-2xl font-semibold">{fee.text ?? 'Fee not confirmed'}</span>
                  {fee.text && <span className="text-ink-muted"> entrance</span>}
                </p>
                {rated && (
                  <a href="#reviews" className="text-sm text-ink-muted hover:underline">
                    ★ {campsite.rating.average!.toFixed(1)}
                  </a>
                )}
              </div>
              <button
                type="button"
                onClick={rentGear}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-forest px-5 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-brand-forest-dark"
              >
                Rent gear for this trip <ArrowRightIcon className="h-4 w-4" />
              </button>
              <p className="-mt-2 text-center text-xs text-ink-muted">Tents, beds, chairs, lights and more from GearBnB</p>
              <div className="flex flex-col gap-3 border-t border-line pt-5">
                <h2 className="font-semibold text-ink">How to book this campsite</h2>
                <p className="text-sm text-ink">{campsite.bookingMethod ? BOOKING_LABEL[campsite.bookingMethod] : 'Contact the campsite to book.'}</p>
                {campsite.bookingNotes && <p className="text-sm text-ink-muted">{campsite.bookingNotes}</p>}
                {/* The campsite's own offer for campers who come from GearBnB: subtle, under the
                    booking details, and only when the campsite has agreed to one. */}
                {campsite.gearbnbOffer && (
                  <p className="flex items-start gap-2 rounded-lg bg-brand-forest/5 px-3 py-2 text-sm text-ink">
                    <span aria-hidden="true">🎟️</span>
                    <span>
                      <span className="font-semibold">GearBnB offer:</span> {campsite.gearbnbOffer}. Mention your GearBnB code when you book.
                    </span>
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {contactChannels(campsite).map((channel) => (
                    <button
                      key={channel.channel}
                      type="button"
                      onClick={() => setContact(channel)}
                      className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink hover:bg-surface-strong"
                    >
                      {channel.channel === 'PHONE' && <PhoneIcon className="h-4 w-4" />}
                      {channel.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-ink-muted">GearBnB doesn&rsquo;t take campsite bookings or payments. Book and pay the campsite directly.</p>
              </div>
            </div>
          </aside>
        </div>

        <div className="order-4 flex flex-col border-t border-line">
          <section className={sectionClass}>
            <CampsiteReviews campsite={campsite} onChanged={reload} />
          </section>

          <section id="location" aria-labelledby="location-heading" className={`${sectionClass} scroll-mt-24`}>
            <h2 id="location-heading" className={sectionHeading}>
              Where you&rsquo;ll be
            </h2>
            <p className="flex items-center gap-2 text-ink">
              <MapPinIcon className="h-4 w-4 shrink-0" /> {[campsite.addressLine, campsite.barangay, placeName(campsite)].filter(Boolean).join(', ')}
            </p>
            <CampsiteMapSlot campsites={[campsite]} single className="h-[22rem] rounded-2xl sm:h-[28rem]" />
            <div className="flex flex-wrap gap-2">
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className={outlineButton}>
                Open in Google Maps
              </a>
              <a href={wazeUrl} target="_blank" rel="noopener noreferrer" className={outlineButton}>
                Open in Waze
              </a>
            </div>
          </section>

          <section aria-labelledby="gear" className={sectionClass}>
            <h2 id="gear" className={sectionHeading}>
              What gear to bring
            </h2>
            <ul className="-mx-5 flex snap-x gap-4 overflow-x-auto px-5 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
              {gearSuggestions(campsite).map((item) => (
                <li key={item.item} className="flex w-64 shrink-0 snap-start flex-col gap-1 rounded-2xl border border-line bg-surface p-5 sm:w-auto">
                  <span className="font-semibold text-ink">{item.item}</span>
                  <span className="text-sm text-ink-muted">{item.why}</span>
                  {item.href && (
                    <Link to={item.href} className="mt-auto inline-flex items-center gap-1 pt-2 text-sm font-semibold text-accent hover:underline">
                      Rent it from GearBnB <ArrowRightIcon className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="know" className={sectionClass}>
            <h2 id="know" className={sectionHeading}>
              Things to know
            </h2>
            <div className="grid gap-8 sm:grid-cols-3">
              {thingsToKnow.map((column) => (
                <div key={column.title} className="flex flex-col gap-2">
                  <h3 className="font-semibold text-ink">{column.title}</h3>
                  <ul className="flex flex-col gap-2">
                    {column.lines.map((line) => (
                      <li key={line} className="text-sm text-ink-muted">
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section aria-labelledby="faq" className={sectionClass}>
            <h2 id="faq" className={sectionHeading}>
              {campsite.name} FAQ
            </h2>
            <div className="rounded-2xl border border-line bg-surface px-5">
              <FaqAccordion items={campsiteFaq(campsite)} />
            </div>
            <p className="text-sm text-ink-muted">
              Is this your campsite?{' '}
              <a href={MESSENGER_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent hover:underline">
                Message us to update it
              </a>
              .
            </p>
          </section>

          {nearby.length > 0 && (
            <section aria-labelledby="nearby" className={sectionClass}>
              <h2 id="nearby" className={sectionHeading}>
                Campsites nearby
              </h2>
              <ul className="grid gap-4 sm:grid-cols-3">
                {nearby.map((other) => (
                  <li key={other.slug} className="flex">
                    <CampsiteCard campsite={other} headingLevel="h3" />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </article>

      {/* Phones and tablets: the fee and "Rent gear" in a bar at the bottom, like Airbnb's Reserve bar. */}
      <div ref={stickyBarRef} className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{fee.text ? (fee.text === 'Free' ? 'Free entrance' : `${fee.text} entrance`) : campsite.name}</p>
            <p className="truncate text-xs text-ink-muted">{rated ? `★ ${campsite.rating.average!.toFixed(1)} · ${placeName(campsite)}` : placeName(campsite)}</p>
          </div>
          <button type="button" onClick={rentGear} className="shrink-0 rounded-xl bg-brand-forest px-5 py-3 text-sm font-semibold text-white hover:bg-brand-forest-dark">
            Rent gear
          </button>
        </div>
      </div>

      {amenitiesOpen && <AmenitiesDialog campsite={campsite} onClose={closeAmenities} />}
    </div>
  );
}
