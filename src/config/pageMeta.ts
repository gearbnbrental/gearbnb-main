/**
 * The title and description of every public page, in ONE place. Each page passes its entry to
 * usePageMeta (so the browser tab and client-side navigation stay right), and the production build
 * (see prerenderRouteMeta in vite.config.ts) writes the same entries into that page's own HTML
 * file — so a crawler or a Facebook/Messenger link preview that never runs JavaScript still sees
 * the right title, description and preview image for the page instead of the home page's.
 * Change a title or description here and both stay in sync.
 */

export const SITE_URL = 'https://gearbnbrental.com';
export const SITE_NAME = 'GearBnB';
/** Shared link-preview image (1200px wide) for every page. */
export const OG_IMAGE_PATH = '/images/og-image.jpg';
export const LOGO_PATH = '/brand_assets/GEARBNB_logo.png';

/**
 * Structured data (schema.org JSON-LD) describing the business itself — never per-page copy.
 * Search engines read this as a direct, unambiguous fact (name, address, real social profiles),
 * rather than inferring it from whatever body text happens to be on the page a search matched.
 * It does not change what Google DISPLAYS as the title/snippet (that stays Google's own choice —
 * see prerenderRouteMeta's own doc comment), but it gives Google a source it can cross-check that
 * copy against instead of guessing. Address/socials match the "Where are you located?" FAQ answer
 * and config/social.ts exactly — this is not a second place those get typed.
 */
export const ORGANIZATION_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: SITE_NAME,
  url: SITE_URL,
  logo: SITE_URL + LOGO_PATH,
  image: SITE_URL + OG_IMAGE_PATH,
  description: 'Camping gear rental in Metro Manila, Philippines — tents, sleeping gear, cooking equipment, and complete camping packages.',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Talon Uno, Las Piñas City',
    addressRegion: 'Metro Manila',
    addressCountry: 'PH',
  },
  areaServed: 'Metro Manila, Philippines',
  sameAs: [
    'https://www.facebook.com/profile.php?id=61583759100221',
    'https://www.instagram.com/gearbnb_rental',
    'https://www.tiktok.com/@camp.gearbnb',
  ],
} as const;

export interface PageMeta {
  title: string;
  description: string;
}

export const PAGE_META = {
  home: {
    title: 'Camping Gear Rental in the Philippines | GearBnB',
    description:
      'Explore camping gear rental in the Philippines, serving Metro Manila, Las Piñas, and nearby cities. Find quality gear and book for your next adventure.',
  },
  catalog: {
    title: 'Camping Kits for Rent in Metro Manila | GearBnB',
    description:
      'Browse and rent camping gears in Metro Manila. Explore our selection of quality outdoor equipment and find the perfect gear for your next adventure.',
  },
  packages: {
    title: 'Camping Gear for Rent in Metro Manila | GearBnB',
    description:
      'Choose camping gear for rent in Metro Manila and find ready-to-go packages for solo trips, couples, and groups. Book your gear and get outdoors!',
  },
  buildYourOwn: {
    title: 'Camping Gear Rental in Metro Manila | GearBnB',
    description:
      'Customize your adventure with camping gear rental in Metro Manila. Pick the gear you need, build your own package, and enjoy the outdoors your way.',
  },
  events: {
    title: 'Camping Gear Rental for Events & Team Building | GearBnB',
    description:
      'Plan your team-building or big event with camping gear rental. Get quality camping gear for groups and make your outdoor event hassle-free.',
  },
  about: {
    title: 'Camping Gear Rental in Las Piñas, Metro Manila | GearBnB',
    description:
      'Discover Gearbnb, your camping gear rental in Las Piñas, Metro Manila. Learn about our mission and find reliable gear for your next outdoor adventure.',
  },
  privacy: {
    title: 'Privacy Policy | GearBnB',
    description: 'How GearBnB collects, uses, stores, shares and protects your personal data.',
  },
  terms: {
    title: 'Terms of Service | GearBnB',
    description: 'The terms for using gearbnbrental.com and renting camping gear from GearBnB.',
  },
} satisfies Record<string, PageMeta>;

/** The public pages that get their own pre-built HTML file, by URL path. Private pages (cart,
 * checkout, login, bookings, profile) are deliberately not listed. */
export const PRERENDERED_PAGES: { path: string; meta: PageMeta }[] = [
  { path: '/', meta: PAGE_META.home },
  { path: '/catalog', meta: PAGE_META.catalog },
  { path: '/catalog/camping-packages', meta: PAGE_META.packages },
  { path: '/catalog/build-your-own', meta: PAGE_META.buildYourOwn },
  { path: '/plan-an-event', meta: PAGE_META.events },
  { path: '/about-us', meta: PAGE_META.about },
  { path: '/privacy-policy', meta: PAGE_META.privacy },
  { path: '/terms-of-service', meta: PAGE_META.terms },
];
