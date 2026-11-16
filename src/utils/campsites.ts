/**
 * Plain logic for the Find A Campsite directory: addresses, the wording built from a campsite's
 * details (the summary sentence, the facts, the auto-FAQ, "what to bring"), filters and province
 * grouping. The pages, the built HTML, the schema, llms.txt and the in-browser agent tools all use
 * these, so a campsite reads the same everywhere. A detail staff haven't confirmed (null) is left
 * out of sentences and answers instead of guessed.
 */
import type {
  CampsiteDetails,
  CampsiteReview,
  CampsiteReviewInput,
  CampsiteSummary,
  Campsite,
  FeeUnit,
  SignalLevel,
} from '../types/campsite';
import { BUILD_YOUR_OWN_PATH, PACKAGES_PATH, slugify } from './productSlug';
import { estimateDriveMinutes, type Place } from './travel';

export const CAMPSITES_PATH = '/campsites';
export const CAMPSITE_PROVINCE_PATH = '/campsites/province';
/** A province gets its own page once it has this many campsites (fewer would be a thin page). */
export const MIN_CAMPSITES_FOR_PROVINCE_PAGE = 3;
/** "Within 3 hours of Manila", measured from GearBnB in Las Piñas. */
export const NEAR_MANILA_MINUTES = 180;

export const campsitePath = (campsite: Pick<CampsiteSummary, 'slug'>) => `${CAMPSITES_PATH}/${campsite.slug}`;
export const provinceSlug = (province: string) => slugify(province);
export const provincePath = (province: string) => `${CAMPSITE_PROVINCE_PATH}/${provinceSlug(province)}`;

/** "Famy, Laguna" */
export const placeName = (campsite: Pick<CampsiteSummary, 'cityMunicipality' | 'province'>) =>
  [campsite.cityMunicipality, campsite.province].filter(Boolean).join(', ');

// ---------------------------------------------------------------------------------------------
// Signal

export const NETWORKS = [
  { key: 'signalSmart', name: 'Smart', brands: 'Smart / TNT' },
  { key: 'signalGlobe', name: 'Globe', brands: 'Globe / TM / GOMO' },
  { key: 'signalDito', name: 'DITO', brands: 'DITO' },
] as const satisfies readonly { key: keyof CampsiteDetails; name: string; brands: string }[];

export type NetworkName = (typeof NETWORKS)[number]['name'];

export const SIGNAL_LABEL: Record<SignalLevel, string> = { NONE: 'No signal', WEAK: 'Weak', STRONG: 'Strong' };
const SIGNAL_RANK: Record<SignalLevel, number> = { NONE: 0, WEAK: 1, STRONG: 2 };

/** The network(s) with the strongest signal, or null when no network has been checked. A level of
 *  NONE everywhere comes back as `{ networks: [], level: 'NONE' }`. */
export function bestSignal(details: CampsiteDetails): { networks: NetworkName[]; level: SignalLevel } | null {
  const checked = NETWORKS.filter((network) => details[network.key] !== null);
  if (checked.length === 0) return null;
  const top = Math.max(...checked.map((network) => SIGNAL_RANK[details[network.key] as SignalLevel]));
  const level = (Object.keys(SIGNAL_RANK) as SignalLevel[]).find((key) => SIGNAL_RANK[key] === top) as SignalLevel;
  if (level === 'NONE') return { networks: [], level };
  return { networks: checked.filter((network) => details[network.key] === level).map((network) => network.name), level };
}

/** "Smart (strong)", "Smart and Globe (weak)", "No signal on any network", or null. */
export function bestSignalText(details: CampsiteDetails): string | null {
  const best = bestSignal(details);
  if (!best) return null;
  if (best.level === 'NONE') return 'No signal on any network';
  return `${joinWords(best.networks)} (${SIGNAL_LABEL[best.level].toLowerCase()})`;
}

export function hasAnySignal(details: CampsiteDetails, network?: NetworkName): boolean {
  return NETWORKS.some(
    (entry) => (!network || entry.name === network) && (details[entry.key] === 'WEAK' || details[entry.key] === 'STRONG'),
  );
}

// ---------------------------------------------------------------------------------------------
// Words

export function joinWords(words: readonly string[]): string {
  if (words.length <= 1) return words[0] ?? '';
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

const peso = (centavos: number) => `₱${(centavos / 100).toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;

const FEE_UNIT: Record<FeeUnit, string> = {
  PER_PERSON: 'per person',
  PER_TENT: 'per tent',
  PER_NIGHT: 'per night',
  PER_GROUP: 'per group',
};

/** "₱150 per person", "Free", or null when not confirmed. */
export function feeText(centavos: number | null, unit: FeeUnit | null): string | null {
  if (centavos === null) return null;
  if (centavos === 0) return 'Free';
  return unit ? `${peso(centavos)} ${FEE_UNIT[unit]}` : peso(centavos);
}

/** The fee to show on a card and to filter by: the entrance fee, else the camping fee. */
export function headlineFee(campsite: Pick<CampsiteSummary, 'entranceFeeCentavos' | 'campingFeeCentavos' | 'feeUnit'>) {
  const centavos = campsite.entranceFeeCentavos ?? campsite.campingFeeCentavos;
  return { centavos, text: feeText(centavos, campsite.feeUnit) };
}

/** "about 45 minutes", "about 2.5 hours", "about 3 hours" */
export function driveTimeText(minutes: number | null): string | null {
  if (minutes === null || minutes <= 0) return null;
  if (minutes < 60) return `about ${Math.round(minutes / 5) * 5 || 5} minutes`;
  const hours = Math.round((minutes / 60) * 2) / 2;
  return `about ${hours} ${hours === 1 ? 'hour' : 'hours'}`;
}

/** "November 2026" from "2026-11-03". */
export function checkedMonth(isoDate: string | null): string | null {
  if (!isoDate) return null;
  const date = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-PH', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

const lower = (text: string) => text.toLowerCase();

/** "riverside", "beach and forest" from the terrain labels, for sentences. */
const terrainWords = (details: CampsiteDetails) => joinWords(details.terrain.map(lower));

// ---------------------------------------------------------------------------------------------
// Detail labels (the facts grid on a campsite page)

export const DETAIL_LABELS = {
  drinkingWater: { POTABLE: 'Drinking water available', WASH_ONLY: 'Wash water only, bring drinking water', NONE: 'None, bring your own' },
  electricity: { AVAILABLE: 'Available', LIMITED: 'Limited (charging only)', NONE: 'None' },
  parking: { AT_CAMPSITE: 'Cars can park at the campsite', PARK_AND_WALK: 'Park and walk', NONE: 'No parking' },
  roadAccess: { ANY_CAR: 'Any car', SUV_4X4: 'SUV or 4x4 recommended', HIKE_IN: 'Hike in only' },
  petPolicy: { ALLOWED: 'Pets allowed', NOT_ALLOWED: 'No pets', ASK: 'Ask the campsite first' },
  campfire: { ALLOWED: 'Allowed', PIT_ONLY: 'In the designated fire pit only', NOT_ALLOWED: 'Not allowed' },
  shade: { LOTS: 'Lots of shade', SOME: 'Some shade', NONE: 'No shade' },
  storeNearby: { NONE: 'None nearby, bring supplies', SARI_SARI: 'Sari-sari store nearby', MARKET_OR_TOWN: 'Market or town nearby' },
} as const;

export const NOT_CONFIRMED = 'Not confirmed yet';

const yesNo = (value: boolean | null) => (value === null ? NOT_CONFIRMED : value ? 'Yes' : 'No');

/** The facts grid, in reading order. Unconfirmed details stay in the list as "Not confirmed yet",
 *  so campers can see what to ask the campsite. */
export function campsiteFacts(campsite: CampsiteSummary): { label: string; value: string }[] {
  const d = campsite.details;
  const parking =
    d.parking === 'PARK_AND_WALK' && d.parkingWalkMinutes
      ? `Park and walk about ${d.parkingWalkMinutes} minutes`
      : d.parking
        ? DETAIL_LABELS.parking[d.parking]
        : NOT_CONFIRMED;
  return [
    { label: 'Entrance fee', value: feeText(campsite.entranceFeeCentavos, campsite.feeUnit) ?? NOT_CONFIRMED },
    ...(campsite.campingFeeCentavos !== null
      ? [{ label: 'Camping fee', value: feeText(campsite.campingFeeCentavos, campsite.feeUnit) ?? NOT_CONFIRMED }]
      : []),
    { label: 'Best signal', value: bestSignalText(d) ?? NOT_CONFIRMED },
    { label: 'Restroom', value: yesNo(d.hasRestroom) },
    { label: 'Showers', value: yesNo(d.hasShowers) },
    { label: 'Water', value: d.drinkingWater ? DETAIL_LABELS.drinkingWater[d.drinkingWater] : NOT_CONFIRMED },
    { label: 'Electricity', value: d.electricity ? DETAIL_LABELS.electricity[d.electricity] : NOT_CONFIRMED },
    { label: 'Road access', value: d.roadAccess ? DETAIL_LABELS.roadAccess[d.roadAccess] : NOT_CONFIRMED },
    { label: 'Parking', value: parking },
    { label: 'Car camping', value: yesNo(d.carCamping) },
    { label: 'Motocamping', value: yesNo(d.motoCamping) },
    { label: 'Pets', value: d.petPolicy ? DETAIL_LABELS.petPolicy[d.petPolicy] : NOT_CONFIRMED },
    { label: 'Bonfire', value: d.campfire ? DETAIL_LABELS.campfire[d.campfire] : NOT_CONFIRMED },
    { label: 'Cooking', value: d.cookingAllowed === null ? NOT_CONFIRMED : d.cookingAllowed ? 'Allowed' : 'Not allowed' },
    { label: 'Shade', value: d.shade ? DETAIL_LABELS.shade[d.shade] : NOT_CONFIRMED },
    { label: 'Kid-friendly', value: yesNo(d.kidFriendly) },
    { label: 'Tents on site', value: yesNo(d.tentsOnSite) },
    { label: 'Store nearby', value: d.storeNearby ? DETAIL_LABELS.storeNearby[d.storeNearby] : NOT_CONFIRMED },
    ...(d.groundTypes.length ? [{ label: 'Ground', value: d.groundTypes.join(', ') }] : []),
    ...(driveTimeText(campsite.driveMinutesFromLasPinas)
      ? [{ label: 'From Las Piñas', value: `${driveTimeText(campsite.driveMinutesFromLasPinas)} by car` }]
      : []),
  ];
}

/** Short amenity highlights for a card: only what's confirmed and useful at a glance. */
export function campsiteHighlights(campsite: CampsiteSummary): string[] {
  const d = campsite.details;
  const signal = bestSignal(d);
  return [
    d.hasRestroom ? 'Restroom' : null,
    d.hasShowers ? 'Showers' : null,
    d.electricity === 'AVAILABLE' ? 'Electricity' : null,
    signal && signal.level !== 'NONE' ? `${signal.networks[0]} signal` : null,
    d.carCamping ? 'Car camping' : null,
    d.motoCamping ? 'Motocamping' : null,
    d.petPolicy === 'ALLOWED' ? 'Pet-friendly' : null,
    d.campfire === 'ALLOWED' || d.campfire === 'PIT_ONLY' ? 'Bonfire' : null,
  ].filter((item): item is string => item !== null);
}

// ---------------------------------------------------------------------------------------------
// "What this campsite offers" (Airbnb-style amenity list) and the top highlights

export type AmenityIcon =
  | 'signal'
  | 'restroom'
  | 'shower'
  | 'water'
  | 'power'
  | 'car'
  | 'moto'
  | 'parking'
  | 'road'
  | 'pets'
  | 'fire'
  | 'cooking'
  | 'shade'
  | 'kids'
  | 'tent'
  | 'store';

export interface Amenity {
  icon: AmenityIcon;
  label: string;
  /** Extra words under the label, e.g. "Strong" for a network. */
  detail?: string;
  /** False: shown crossed out ("No showers"), so campers know it's missing. */
  available: boolean;
}

export interface AmenityGroup {
  title: string;
  items: Amenity[];
}

/** Every confirmed detail as an amenity, grouped. Unconfirmed details are left out. */
export function campsiteAmenityGroups(campsite: CampsiteSummary): AmenityGroup[] {
  const d = campsite.details;
  const item = (icon: AmenityIcon, label: string, available: boolean | null, detail?: string): Amenity | null =>
    available === null ? null : { icon, label, available, ...(detail ? { detail } : {}) };
  const groups: AmenityGroup[] = [
    {
      title: 'Cell signal',
      items: NETWORKS.filter((network) => d[network.key] !== null).map((network) => ({
        icon: 'signal' as const,
        label: network.brands,
        detail: SIGNAL_LABEL[d[network.key] as SignalLevel],
        available: d[network.key] !== 'NONE',
      })),
    },
    {
      title: 'Facilities',
      items: [
        item('restroom', 'Restroom', d.hasRestroom),
        item('shower', 'Showers', d.hasShowers),
        d.drinkingWater
          ? item('water', d.drinkingWater === 'POTABLE' ? 'Drinking water' : d.drinkingWater === 'WASH_ONLY' ? 'Wash water only' : 'No water', d.drinkingWater !== 'NONE')
          : null,
        d.electricity
          ? item('power', d.electricity === 'LIMITED' ? 'Charging station only' : 'Electricity', d.electricity !== 'NONE')
          : null,
        item('tent', 'Tents for rent on site', d.tentsOnSite),
        d.storeNearby ? item('store', DETAIL_LABELS.storeNearby[d.storeNearby], d.storeNearby !== 'NONE') : null,
        d.shade ? item('shade', DETAIL_LABELS.shade[d.shade], d.shade !== 'NONE') : null,
      ].filter((entry): entry is Amenity => entry !== null),
    },
    {
      title: 'Getting there',
      items: [
        d.roadAccess ? item('road', DETAIL_LABELS.roadAccess[d.roadAccess], true) : null,
        item('car', 'Car camping', d.carCamping, d.carCamping ? 'Park beside your tent' : undefined),
        item('moto', 'Motocamping', d.motoCamping),
        d.parking
          ? item(
              'parking',
              d.parking === 'PARK_AND_WALK' && d.parkingWalkMinutes ? `Parking, then a ${d.parkingWalkMinutes}-minute walk` : DETAIL_LABELS.parking[d.parking],
              d.parking !== 'NONE',
            )
          : null,
      ].filter((entry): entry is Amenity => entry !== null),
    },
    {
      title: 'Camp rules',
      items: [
        d.petPolicy ? item('pets', d.petPolicy === 'ASK' ? 'Pets: ask first' : 'Pets allowed', d.petPolicy !== 'NOT_ALLOWED') : null,
        d.campfire ? item('fire', d.campfire === 'PIT_ONLY' ? 'Bonfire in the fire pit' : 'Bonfire allowed', d.campfire !== 'NOT_ALLOWED') : null,
        item('cooking', 'Cooking allowed', d.cookingAllowed),
        item('kids', 'Kid-friendly', d.kidFriendly),
      ].filter((entry): entry is Amenity => entry !== null),
    },
  ];
  return groups.filter((group) => group.items.length > 0);
}

/** Up to `count` amenities for the short list: what the campsite has first, then what it lacks. */
export function featuredAmenities(campsite: CampsiteSummary, count = 10): Amenity[] {
  const all = campsiteAmenityGroups(campsite).flatMap((group) => group.items);
  return [...all.filter((entry) => entry.available), ...all.filter((entry) => !entry.available)].slice(0, count);
}

export interface KeyHighlight {
  icon: AmenityIcon;
  title: string;
  text: string;
}

/** The three things worth knowing first, like Airbnb's highlights under the title. */
export function campsiteKeyHighlights(campsite: CampsiteSummary): KeyHighlight[] {
  const d = campsite.details;
  const best = bestSignal(d);
  const others = NETWORKS.filter((network) => d[network.key] !== null && !(best?.networks as string[] | undefined)?.includes(network.name))
    .map((network) => `${network.name} ${SIGNAL_LABEL[d[network.key] as SignalLevel].toLowerCase()}`)
    .join(', ');
  const candidates: (KeyHighlight | null)[] = [
    best
      ? best.level === 'NONE'
        ? { icon: 'signal', title: 'No cell signal', text: 'A real unplug. Download maps and tell family before you go.' }
        : { icon: 'signal', title: `${best.level === 'STRONG' ? 'Strong' : 'Weak'} ${joinWords(best.networks)} signal`, text: others ? `Also checked: ${others}.` : 'Checked by our team on site.' }
      : null,
    d.hasRestroom
      ? { icon: 'restroom', title: d.hasShowers ? 'Restrooms and showers' : 'Restrooms on site', text: d.drinkingWater === 'POTABLE' ? 'Drinking water is available too.' : 'Bring your own drinking water.' }
      : null,
    d.carCamping
      ? { icon: 'car', title: 'Car camping', text: 'Park right beside your tent.' }
      : d.motoCamping
        ? { icon: 'moto', title: 'Motocamping friendly', text: 'Motorcycles can ride into the camping area.' }
        : null,
    d.petPolicy === 'ALLOWED' ? { icon: 'pets', title: 'Pets welcome', text: 'Bring your dog along for the trip.' } : null,
    d.campfire === 'ALLOWED' || d.campfire === 'PIT_ONLY'
      ? { icon: 'fire', title: 'Bonfires allowed', text: d.campfire === 'PIT_ONLY' ? 'In the designated fire pit.' : 'Great for a night of stories.' }
      : null,
    d.electricity === 'AVAILABLE' ? { icon: 'power', title: 'Electricity', text: 'Plug in fans and lights.' } : null,
  ];
  return candidates.filter((entry): entry is KeyHighlight => entry !== null).slice(0, 3);
}

// ---------------------------------------------------------------------------------------------
// The answer-style summary sentence (top of the page, meta description, llms.txt)

export function campsiteSummarySentence(campsite: CampsiteSummary): string {
  const d = campsite.details;
  const kind = d.terrain.length ? `${terrainWords(d)} campsite` : 'campsite';
  const drive = driveTimeText(campsite.driveMinutesFromLasPinas);
  const first = `${campsite.name} is a${/^[aeiou]/i.test(kind) ? 'n' : ''} ${kind} in ${placeName(campsite)}${
    drive ? `, ${drive} from Las Piñas` : ''
  }.`;

  const fee = feeText(campsite.entranceFeeCentavos, campsite.feeUnit);
  const feePart = fee ? (fee === 'Free' ? 'Entrance is free' : `Entrance is ${fee}`) : null;

  const has = [d.hasRestroom ? 'restrooms' : null, d.hasShowers ? 'showers' : null, d.electricity === 'AVAILABLE' ? 'electricity' : null].filter(
    (item): item is string => item !== null,
  );
  const extras = [
    has.length ? `there ${has.length === 1 && has[0] === 'electricity' ? 'is' : 'are'} ${joinWords(has)}` : null,
    (() => {
      const best = bestSignal(d);
      if (!best) return null;
      return best.level === 'NONE' ? 'there is no cell signal' : `${joinWords(best.networks)} signal is ${best.level.toLowerCase()}`;
    })(),
    d.petPolicy === 'ALLOWED' ? 'pets are allowed' : d.petPolicy === 'NOT_ALLOWED' ? 'pets are not allowed' : null,
  ].filter((item): item is string => item !== null);

  const secondParts = [feePart, extras.length ? joinWords(extras) : null].filter(Boolean) as string[];
  if (secondParts.length === 0) return first;
  const second = secondParts.join('; ');
  return `${first} ${second.charAt(0).toUpperCase()}${second.slice(1)}.`;
}

// ---------------------------------------------------------------------------------------------
// Auto-FAQ: questions campers (and AI assistants) ask, answered only from confirmed details

export interface CampsiteFaqItem {
  question: string;
  answer: string;
}

const BOOKING_METHOD_ANSWER: Record<NonNullable<Campsite['bookingMethod']>, string> = {
  FACEBOOK: 'Message the campsite on its Facebook page to book.',
  PHONE: 'Call the campsite to book.',
  SMS: 'Text the campsite to book.',
  WEBSITE: "Book on the campsite's own website.",
  WALK_IN: 'Walk-ins are accepted; you can pay at the entrance.',
  OTHER: 'Contact the campsite directly to book.',
};

export function campsiteFaq(campsite: Campsite): CampsiteFaqItem[] {
  const d = campsite.details;
  const name = campsite.name;
  const items: (CampsiteFaqItem | null)[] = [
    (() => {
      const entrance = feeText(campsite.entranceFeeCentavos, campsite.feeUnit);
      const camping = feeText(campsite.campingFeeCentavos, campsite.feeUnit);
      if (!entrance && !camping) return null;
      const parts = [entrance ? `Entrance: ${entrance}.` : null, camping ? `Camping: ${camping}.` : null, campsite.feeNotes];
      return { question: `How much is the entrance fee at ${name}?`, answer: parts.filter(Boolean).join(' ') };
    })(),
    (() => {
      const best = bestSignal(d);
      if (!best) return null;
      const perNetwork = NETWORKS.filter((network) => d[network.key] !== null)
        .map((network) => `${network.brands}: ${SIGNAL_LABEL[d[network.key] as SignalLevel].toLowerCase()}`)
        .join('; ');
      const lead = best.level === 'NONE' ? 'There is no cell signal on any network.' : `${joinWords(best.networks)} has the best signal (${best.level.toLowerCase()}).`;
      return { question: `Which network has the best signal at ${name}?`, answer: `${lead} ${perNetwork}.` };
    })(),
    d.hasRestroom === null
      ? null
      : {
          question: `Is there a restroom at ${name}?`,
          answer: d.hasRestroom
            ? `Yes, there are restrooms${d.hasShowers ? ' and showers' : d.hasShowers === false ? ', but no showers' : ''}.`
            : 'No, there are no restrooms at the campsite.',
        },
    d.drinkingWater
      ? { question: `Is there drinking water at ${name}?`, answer: `${DETAIL_LABELS.drinkingWater[d.drinkingWater]}.` }
      : null,
    d.electricity
      ? {
          question: `Is there electricity at ${name}?`,
          answer:
            d.electricity === 'AVAILABLE'
              ? 'Yes, electricity is available.'
              : d.electricity === 'LIMITED'
                ? 'Only limited power, such as a charging station. Bring rechargeable fans and lights.'
                : 'No. Bring power banks and rechargeable fans and lights.',
        }
      : null,
    d.petPolicy
      ? {
          question: `Are pets allowed at ${name}?`,
          answer: d.petPolicy === 'ALLOWED' ? 'Yes, pets are allowed.' : d.petPolicy === 'NOT_ALLOWED' ? 'No, pets are not allowed.' : 'Ask the campsite before bringing pets.',
        }
      : null,
    d.campfire
      ? {
          question: `Can we make a bonfire at ${name}?`,
          answer:
            d.campfire === 'ALLOWED'
              ? 'Yes, bonfires are allowed.'
              : d.campfire === 'PIT_ONLY'
                ? 'Yes, in the designated fire pit only.'
                : 'No, bonfires are not allowed.',
        }
      : null,
    d.roadAccess
      ? {
          question: `Can a regular car get to ${name}?`,
          answer:
            d.roadAccess === 'ANY_CAR'
              ? 'Yes, any car can reach it.'
              : d.roadAccess === 'SUV_4X4'
                ? 'An SUV or 4x4 is recommended for the road in.'
                : `No, ${name} is hike-in only.`,
        }
      : null,
    d.carCamping === null && d.motoCamping === null
      ? null
      : {
          question: `Can I do car camping or motocamping at ${name}?`,
          answer: [
            d.carCamping === null ? null : d.carCamping ? 'Car camping: yes, you can park beside your tent.' : 'Car camping: no.',
            d.motoCamping === null ? null : d.motoCamping ? 'Motocamping: yes, motorcycles can ride in.' : 'Motocamping: no.',
          ]
            .filter(Boolean)
            .join(' '),
        },
    d.activities.length
      ? { question: `What can you do at ${name}?`, answer: `${joinWords(d.activities)}.` }
      : null,
    campsite.driveMinutesFromLasPinas
      ? {
          question: `How far is ${name} from Metro Manila?`,
          answer: `${capitalize(driveTimeText(campsite.driveMinutesFromLasPinas) as string)} by car from Las Piñas City, depending on traffic.`,
        }
      : null,
    campsite.bookingMethod
      ? {
          question: `How do I book ${name}?`,
          answer: [BOOKING_METHOD_ANSWER[campsite.bookingMethod], campsite.bookingNotes].filter(Boolean).join(' '),
        }
      : null,
    {
      question: `Where can I rent camping gear for ${name}?`,
      answer: `GearBnB rents tents, beds, chairs, coolers, fans, lights and complete camping packages. Pick up in Las Piñas City or book Lalamove or Grab delivery, and book online at gearbnbrental.com.`,
    },
  ];
  return items.filter((item): item is CampsiteFaqItem => item !== null);
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

// ---------------------------------------------------------------------------------------------
// "What gear to bring here"

export interface GearSuggestion {
  item: string;
  why: string;
  /** A catalog page, or null for advice that isn't something GearBnB rents. */
  href: string | null;
}

export function gearSuggestions(campsite: CampsiteSummary): GearSuggestion[] {
  const d = campsite.details;
  const terrain = d.terrain.map(lower).join(' ');
  const suggestions: (GearSuggestion | null)[] = [
    d.tentsOnSite === true
      ? null
      : { item: 'A tent', why: d.tentsOnSite === false ? "The campsite doesn't rent tents." : 'Bring your own shelter.', href: PACKAGES_PATH },
    { item: 'Sleeping gear', why: 'An air bed or high bed keeps you off hard or damp ground.', href: BUILD_YOUR_OWN_PATH },
    d.electricity === 'AVAILABLE'
      ? null
      : { item: 'Rechargeable fan and lights', why: d.electricity === 'NONE' ? 'There is no electricity.' : 'Power is limited.', href: BUILD_YOUR_OWN_PATH },
    d.storeNearby === 'NONE' ? { item: 'A cooler', why: 'There is no store nearby, so bring food and ice.', href: BUILD_YOUR_OWN_PATH } : null,
    d.shade === 'NONE' ? { item: 'A shade canopy', why: 'There is little natural shade.', href: BUILD_YOUR_OWN_PATH } : null,
    { item: 'Camping chairs and a table', why: 'For meals and stargazing at camp.', href: BUILD_YOUR_OWN_PATH },
    d.drinkingWater && d.drinkingWater !== 'POTABLE' ? { item: 'Drinking water', why: 'There is no drinking water on site.', href: null } : null,
    /beach|sand/.test(terrain) || d.groundTypes.some((ground) => /sand/i.test(ground))
      ? { item: 'Sand pegs', why: 'Regular pegs slip in sand.', href: null }
      : null,
    /mountain|forest/.test(terrain) ? { item: 'A jacket', why: 'Nights get cold at higher ground.', href: null } : null,
  ];
  return suggestions.filter((item): item is GearSuggestion => item !== null);
}

// ---------------------------------------------------------------------------------------------
// Filters (kept in the address bar so a filtered list can be shared)

/** The must-haves a camper can tick. Every ticked one must be confirmed for a campsite to show. */
export const MUST_HAVES = [
  { key: 'signal', label: 'Has cell signal', test: (d: CampsiteDetails) => hasAnySignal(d) },
  { key: 'restroom', label: 'Has restroom', test: (d: CampsiteDetails) => d.hasRestroom === true },
  { key: 'showers', label: 'Has showers', test: (d: CampsiteDetails) => d.hasShowers === true },
  { key: 'carCamping', label: 'Car camping', test: (d: CampsiteDetails) => d.carCamping === true },
  { key: 'motoCamping', label: 'Motocamping', test: (d: CampsiteDetails) => d.motoCamping === true },
  { key: 'anyCar', label: 'Regular car can reach it', test: (d: CampsiteDetails) => d.roadAccess === 'ANY_CAR' },
  { key: 'pets', label: 'Pet-friendly', test: (d: CampsiteDetails) => d.petPolicy === 'ALLOWED' },
  { key: 'bonfire', label: 'Bonfire allowed', test: (d: CampsiteDetails) => d.campfire === 'ALLOWED' || d.campfire === 'PIT_ONLY' },
  { key: 'electricity', label: 'Electricity', test: (d: CampsiteDetails) => d.electricity === 'AVAILABLE' },
  { key: 'drinkingWater', label: 'Drinking water', test: (d: CampsiteDetails) => d.drinkingWater === 'POTABLE' },
  { key: 'kidFriendly', label: 'Kid-friendly', test: (d: CampsiteDetails) => d.kidFriendly === true },
] as const;

/** `nearMe` needs the camper's location (see utils/travel.ts); `nearManila` (from Las Piñas) is for
 *  the in-browser agent tools. */
export type MustHave = (typeof MUST_HAVES)[number]['key'] | 'nearMe' | 'nearManila';
export const NEAR_ME_LABEL = 'Within 3 hours from me';
export const NEAR_MANILA_LABEL = 'Within 3 hours of Manila';

export interface CampsiteFilters {
  query: string;
  province: string;
  /** Camping types (terrain labels); a campsite matches any one of them. */
  types: string[];
  activity: string;
  /** Every one must be true of the campsite. */
  mustHaves: MustHave[];
  /** Signal on each of these networks. */
  networks: NetworkName[];
  /** Maximum headline fee in pesos; 0 = no limit. */
  maxFee: number;
}

export const EMPTY_FILTERS: CampsiteFilters = {
  query: '',
  province: '',
  types: [],
  activity: '',
  mustHaves: [],
  networks: [],
  maxFee: 0,
};

const MUST_HAVE_KEYS: readonly string[] = [...MUST_HAVES.map((item) => item.key), 'nearMe', 'nearManila'];
const NETWORK_NAMES: readonly string[] = NETWORKS.map((network) => network.name);

export function filtersFromParams(params: URLSearchParams): CampsiteFilters {
  const maxFee = Number(params.get('maxFee'));
  const list = (key: string) => params.getAll(key).flatMap((value) => value.split(',')).map((value) => value.trim()).filter(Boolean);
  return {
    query: params.get('q') ?? '',
    province: params.get('province') ?? '',
    types: [...new Set(list('type'))],
    activity: params.get('activity') ?? '',
    mustHaves: [...new Set(list('has').filter((key) => MUST_HAVE_KEYS.includes(key)))] as MustHave[],
    networks: [...new Set(list('signal').filter((name) => NETWORK_NAMES.includes(name)))] as NetworkName[],
    maxFee: Number.isFinite(maxFee) && maxFee > 0 ? maxFee : 0,
  };
}

export function filtersToParams(filters: CampsiteFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.query.trim()) params.set('q', filters.query.trim());
  if (filters.province) params.set('province', filters.province);
  for (const type of filters.types) params.append('type', type);
  if (filters.activity) params.set('activity', filters.activity);
  for (const key of filters.mustHaves) params.append('has', key);
  for (const network of filters.networks) params.append('signal', network);
  if (filters.maxFee > 0) params.set('maxFee', String(filters.maxFee));
  return params;
}

/** How many filters are on (each ticked box counts), not counting the search words. */
export function activeFilterCount(filters: CampsiteFilters): number {
  return (
    (filters.province ? 1 : 0) +
    filters.types.length +
    (filters.activity ? 1 : 0) +
    filters.mustHaves.length +
    filters.networks.length +
    (filters.maxFee > 0 ? 1 : 0)
  );
}

const sameLabel = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** `from`: where the camper is starting, for "Within 3 hours from me" (ignored without it). */
export function matchesFilters(campsite: CampsiteSummary, filters: CampsiteFilters, from: Place | null = null): boolean {
  const d = campsite.details;
  const query = filters.query.trim().toLowerCase();
  if (query) {
    const haystack = [campsite.name, campsite.cityMunicipality, campsite.province, campsite.region, ...d.terrain, ...d.activities]
      .join(' ')
      .toLowerCase();
    if (!query.split(/\s+/).every((word) => haystack.includes(word))) return false;
  }
  if (filters.province && !sameLabel(campsite.province, filters.province)) return false;
  if (filters.types.length && !d.terrain.some((label) => filters.types.some((type) => sameLabel(label, type)))) return false;
  if (filters.activity && !d.activities.some((label) => sameLabel(label, filters.activity))) return false;
  for (const key of filters.mustHaves) {
    if (key === 'nearMe') {
      if (from && estimateDriveMinutes(from, campsite) > NEAR_MANILA_MINUTES) return false;
      continue;
    }
    if (key === 'nearManila') {
      if (!(campsite.driveMinutesFromLasPinas && campsite.driveMinutesFromLasPinas <= NEAR_MANILA_MINUTES)) return false;
      continue;
    }
    const mustHave = MUST_HAVES.find((item) => item.key === key);
    if (mustHave && !mustHave.test(d)) return false;
  }
  if (filters.networks.some((network) => !hasAnySignal(d, network))) return false;
  if (filters.maxFee > 0) {
    const { centavos } = headlineFee(campsite);
    if (centavos === null || centavos > filters.maxFee * 100) return false;
  }
  return true;
}

export const filterCampsites = <T extends CampsiteSummary>(campsites: readonly T[], filters: CampsiteFilters, from: Place | null = null) =>
  campsites.filter((campsite) => matchesFilters(campsite, filters, from));

/** The choices the filter menus offer, with how many campsites have each: only values some
 *  campsite actually has, sorted. */
export function filterOptions(campsites: readonly CampsiteSummary[]) {
  const counted = (values: string[][]) => {
    const counts = new Map<string, { label: string; count: number }>();
    for (const labels of values) {
      for (const key of new Set(labels.map((label) => label.trim().toLowerCase()).filter(Boolean))) {
        const label = labels.find((value) => value.trim().toLowerCase() === key)!.trim();
        const entry = counts.get(key) ?? { label, count: 0 };
        entry.count += 1;
        counts.set(key, entry);
      }
    }
    return [...counts.values()].sort((a, b) => a.label.localeCompare(b.label));
  };
  return {
    provinces: counted(campsites.map((campsite) => [campsite.province])),
    types: counted(campsites.map((campsite) => campsite.details.terrain)),
    activities: counted(campsites.map((campsite) => campsite.details.activities)),
  };
}

// ---------------------------------------------------------------------------------------------
// Provinces

export interface ProvinceGroup<T extends CampsiteSummary = CampsiteSummary> {
  province: string;
  slug: string;
  region: string;
  campsites: T[];
}

/** Campsites grouped by province, alphabetically. `withPagesOnly` keeps the provinces with enough
 *  campsites for their own page. */
export function provinceGroups<T extends CampsiteSummary>(campsites: readonly T[], { withPagesOnly = false } = {}): ProvinceGroup<T>[] {
  const groups = new Map<string, ProvinceGroup<T>>();
  for (const campsite of campsites) {
    const slug = provinceSlug(campsite.province);
    if (!slug) continue;
    const group = groups.get(slug) ?? { province: campsite.province.trim(), slug, region: campsite.region, campsites: [] };
    group.campsites.push(campsite);
    groups.set(slug, group);
  }
  return [...groups.values()]
    .filter((group) => !withPagesOnly || group.campsites.length >= MIN_CAMPSITES_FOR_PROVINCE_PAGE)
    .map((group) => ({ ...group, campsites: [...group.campsites].sort((a, b) => a.name.localeCompare(b.name)) }))
    .sort((a, b) => a.province.localeCompare(b.province));
}

/** The intro under a province page's H1, built from its campsites. */
export function provinceIntro(group: ProvinceGroup): string {
  const count = group.campsites.length;
  const terrain = filterOptions(group.campsites).types.slice(0, 3).map((option) => lower(option.label));
  const drives = group.campsites.map((campsite) => campsite.driveMinutesFromLasPinas).filter((minutes): minutes is number => !!minutes);
  const nearest = drives.length ? driveTimeText(Math.min(...drives)) : null;
  return [
    `${count} campsites in ${group.province}${terrain.length ? `, from ${joinWords(terrain)} spots` : ''}, with the fees, signal, restrooms and rules checked by GearBnB.`,
    nearest ? `The nearest is ${nearest} from Las Piñas.` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export function provinceFaq(group: ProvinceGroup): CampsiteFaqItem[] {
  const names = (list: CampsiteSummary[]) => joinWords(list.map((campsite) => campsite.name));
  const pets = group.campsites.filter((campsite) => campsite.details.petPolicy === 'ALLOWED');
  const restrooms = group.campsites.filter((campsite) => campsite.details.hasRestroom === true);
  const signal = group.campsites.filter((campsite) => hasAnySignal(campsite.details));
  return [
    { question: `What are the campsites in ${group.province}?`, answer: `${names(group.campsites)}.` },
    pets.length ? { question: `Which campsites in ${group.province} allow pets?`, answer: `${names(pets)}.` } : null,
    restrooms.length ? { question: `Which campsites in ${group.province} have restrooms?`, answer: `${names(restrooms)}.` } : null,
    signal.length ? { question: `Which campsites in ${group.province} have cell signal?`, answer: `${names(signal)}.` } : null,
  ].filter((item): item is CampsiteFaqItem => item !== null);
}

// ---------------------------------------------------------------------------------------------
// Reviews

export type ReviewSort = 'newest' | 'highest' | 'lowest';

export function sortReviews(reviews: readonly CampsiteReview[], sort: ReviewSort): CampsiteReview[] {
  const byDate = (a: CampsiteReview, b: CampsiteReview) => b.createdAt.localeCompare(a.createdAt);
  return [...reviews].sort((a, b) => {
    if (sort === 'highest' && a.rating !== b.rating) return b.rating - a.rating;
    if (sort === 'lowest' && a.rating !== b.rating) return a.rating - b.rating;
    return byDate(a, b);
  });
}

export const MAX_REVIEW_PHOTOS = 5;
export const REVIEW_MIN_LENGTH = 20;
export const REVIEW_MAX_LENGTH = 2000;

/** The same rules the RMS enforces, checked first so campers see the problem before sending.
 *  `today` is a yyyy-mm-dd date. */
export function reviewErrors(input: CampsiteReviewInput, today: string): Partial<Record<keyof CampsiteReviewInput, string>> {
  const errors: Partial<Record<keyof CampsiteReviewInput, string>> = {};
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) errors.rating = 'Choose a rating from 1 to 5 stars.';
  const length = input.body.trim().length;
  if (length < REVIEW_MIN_LENGTH) errors.body = `Write at least ${REVIEW_MIN_LENGTH} characters about your stay.`;
  else if (length > REVIEW_MAX_LENGTH) errors.body = `Keep it under ${REVIEW_MAX_LENGTH.toLocaleString('en-PH')} characters.`;
  if (input.photoPaths.length > MAX_REVIEW_PHOTOS) errors.photoPaths = `Add up to ${MAX_REVIEW_PHOTOS} photos.`;
  if (input.visitDate && (!/^\d{4}-\d{2}-\d{2}$/.test(input.visitDate) || input.visitDate > today || input.visitDate < '2000-01-01')) {
    errors.visitDate = "The visit date can't be in the future.";
  }
  return errors;
}

/** Today's date in Manila as yyyy-mm-dd. */
export function manilaToday(now = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
}
