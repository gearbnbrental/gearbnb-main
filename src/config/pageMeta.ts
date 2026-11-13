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
/** Default link-preview image (1200x630) for any page that doesn't set its own `image`. */
export const OG_IMAGE_PATH = '/images/og-image.jpg';
/** Bump when any share image changes, so Facebook and the CDN fetch the new one. */
export const OG_IMAGE_VERSION = '2';
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
  '@id': 'https://gearbnbrental.com/#business',
  name: 'GearBnB',
  url: 'https://gearbnbrental.com',
  logo: 'https://gearbnbrental.com/brand_assets/GEARBNB_logo.png',
  image: 'https://gearbnbrental.com/images/og-image.jpg',
  description:
    'Camping gear for rent in Las Piñas City. GearBnB offers camping gear rental in Metro Manila, including tents, sleeping gear, cooking equipment and complete camping packages.',
  email: 'customersupport@gearbnbrental.com',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Talon Uno',
    addressLocality: 'Las Piñas City',
    addressRegion: 'Metro Manila',
    addressCountry: 'PH',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: 14.4461908,
    longitude: 120.9966593,
  },
  hasMap: 'https://www.google.com/maps/place/GearBnB+Camping+Gears+Rental/@14.4461908,120.9966593,17z',
  areaServed: [
    { '@type': 'City', name: 'Las Piñas City' },
    { '@type': 'AdministrativeArea', name: 'Metro Manila' },
    { '@type': 'AdministrativeArea', name: 'Calabarzon' },
  ],
  sameAs: [
    'https://www.facebook.com/profile.php?id=61583759100221',
    'https://www.instagram.com/gearbnb_rental',
    'https://www.tiktok.com/@camp.gearbnb',
  ],
} as const;

/** About Us page schema (AboutPage + breadcrumb + its FAQ), next to the shared LocalBusiness block.
 *  The FAQ answers must stay word for word the same as the FAQ shown on the About Us page. */
export const ABOUT_US_JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'AboutPage',
      '@id': 'https://gearbnbrental.com/about-us#webpage',
      url: 'https://gearbnbrental.com/about-us',
      name: 'About GearBnB',
      description:
        'Discover GearBnB, your camping gear rental in Las Piñas, Metro Manila. Learn about our mission and find reliable gear for your next outdoor adventure.',
      inLanguage: 'en',
      primaryImageOfPage: 'https://gearbnbrental.com/images/about-us-hero.webp',
      about: { '@id': 'https://gearbnbrental.com/#business' },
      mainEntity: { '@id': 'https://gearbnbrental.com/#business' },
      breadcrumb: { '@id': 'https://gearbnbrental.com/about-us#breadcrumb' },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://gearbnbrental.com/about-us#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gearbnbrental.com/' },
        { '@type': 'ListItem', position: 2, name: 'About Us', item: 'https://gearbnbrental.com/about-us' },
      ],
    },
    {
      '@type': 'FAQPage',
      '@id': 'https://gearbnbrental.com/about-us#faq',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'How do I rent camping gear from GearBnB?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'If you need help, you can send us a message on Messenger or TikTok. You can also directly browse available gear or packages and select your rental period. Choose Grab delivery or pick up and confirm your time at least 24 hours before your rental date.',
          },
        },
        {
          '@type': 'Question',
          name: 'How much does camping gear cost to rent?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Rental rates depend on the gear you choose and your rental period. Packages and individual items are priced separately, so you can build a rental that fits your budget.',
          },
        },
        {
          '@type': 'Question',
          name: 'How much does it cost to rent camping equipment for a weekend?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Your total cost depends on which items you select, how many pieces you rent, and how long you’re renting. Feel free to browse our gear rental page for accurate pricing.',
          },
        },
        {
          '@type': 'Question',
          name: 'How do I contact GearBnB?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: "You can message us directly on Facebook or TikTok for inquiries, recommendations, and booking assistance. We're happy to help you get camp-ready!",
          },
        },
      ],
    },
  ],
} as const;

export interface PageMeta {
  title: string;
  description: string;
  /** This page's own link-preview image (1200x630, path under public/). Defaults to OG_IMAGE_PATH. */
  image?: string;
  /** A `<meta name="robots">` value for this page's built HTML (e.g. "noindex, follow"). */
  robots?: string;
  /** Extra JSON-LD for this page's built HTML, after the shared LocalBusiness block. */
  jsonLd?: object;
}

export const PAGE_META = {
  home: {
    title: 'Camping Gear for Rent in Las Piñas & Metro Manila | GearBnB',
    description:
      'Camping gear rental in Metro Manila made easy. Rent tents, beds, chairs and full camping kits from trusted brands. Pick up in Las Piñas City. Book online.',
  },
  catalog: {
    title: 'Camping Kits for Rent in Metro Manila | GearBnB',
    description:
      'Browse and rent camping gears in Metro Manila. Explore our selection of quality outdoor equipment and find the perfect gear for your next adventure.',
    image: '/images/og-packages.jpg',
    // The hub only links on to the two catalogs, which own the keywords; kept out of search results.
    robots: 'noindex, follow',
  },
  packages: {
    title: 'Camping Package Rental in Metro Manila | GearBnB',
    description:
      'Rent a ready-to-go camping kit with tent, sleeping gear and seating in one booking. Sized for couples, backpackers, families and barkadas.',
    image: '/images/og-packages.jpg',
  },
  buildYourOwn: {
    title: 'Tent and Camping Equipment Rental by the Piece | GearBnB',
    description:
      'Rent tents, air beds, camping chairs, coolers, fans and lights by the piece. Pick your dates, mix and match your setup and pick up in Las Piñas.',
    image: '/images/og-build-your-own.jpg',
  },
  events: {
    title: 'Camping Gear Rental for Events & Team Building | GearBnB',
    description:
      'Plan your team-building or big event with camping gear rental. Get quality camping gear for groups and make your outdoor event hassle-free.',
    image: '/images/og-plan-an-event.jpg',
  },
  about: {
    title: 'Camping Gear Rental in Las Piñas, Metro Manila | GearBnB',
    description:
      'Discover GearBnB, your camping gear rental in Las Piñas, Metro Manila. Learn about our mission and find reliable gear for your next outdoor adventure.',
    jsonLd: ABOUT_US_JSON_LD,
  },
  privacy: {
    title: 'Privacy Policy | GearBnB',
    description: 'How GearBnB collects, uses, stores, shares and protects your personal data.',
  },
  terms: {
    title: 'Terms of Service | GearBnB',
    description: 'The terms for using gearbnbrental.com and renting camping gear from GearBnB.',
  },
  dataDeletion: {
    title: 'User Data Deletion | GearBnB',
    description: 'How to delete your GearBnB account and personal data, including data from Facebook Login and Google Sign-In.',
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
  { path: '/data-deletion', meta: PAGE_META.dataDeletion },
];
