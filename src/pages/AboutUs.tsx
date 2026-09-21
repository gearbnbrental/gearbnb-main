import type { ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import FaqAccordion, { type FaqItem } from '../components/FaqAccordion';
import {
  CheckCircleIcon,
  ClockIcon,
  CompassIcon,
  GearPlaceholderIcon,
  LeafIcon,
  ShieldCheckIcon,
  TruckIcon,
} from '../components/icons';
import { MESSENGER_URL } from '../config/social';
import { usePageMeta } from '../hooks/usePageMeta';

/**
 * /about-us — content sourced verbatim from the client's "ABOUT US PAGE.docx" (headings,
 * paragraphs, benefit list, three-step process, value statements, and FAQ) — nothing here is
 * paraphrased or invented. Visual composition (section order, card/hero/CTA-band treatment,
 * editorial two-column layouts) follows the client-supplied "ABOUTUS_REF" reference image,
 * recreated with this project's own design tokens and real image/icon assets rather than copied
 * as a screenshot. See the final report for the one placeholder area (map/location) the document
 * itself marks as a placeholder and this project has no real address/coordinates for.
 */

// text-accent, not text-brand-forest: identical color in light mode (see index.css's @theme
// block — --color-accent equals --color-brand-forest there), but accent has an actual dark-mode
// override to a brighter green, while brand-forest deliberately stays constant across themes
// (fine for a button's own background, but too low-contrast for text sitting on a dark surface).
const EYEBROW_CLASS = 'text-xs font-bold uppercase tracking-[0.18em] text-accent';

/** A very faint, repeating dot texture — an outdoor-inspired "grain" rather than a flat, plain
 *  fill, applied to a few sections for cohesion. Built from `--color-brand-brown` at low opacity
 *  via `color-mix`, matching this page's existing color-mix idiom rather than a new hex value. */
const TEXTURE_CLASS =
  'pointer-events-none absolute inset-0 -z-10 opacity-[0.05] [background-image:radial-gradient(circle,var(--color-brand-brown)_1px,transparent_1px)] [background-size:22px_22px]';

/** One soft, asymmetric brand-colored glow — the same low-opacity `radial-gradient` +
 *  `color-mix` idiom already used on the homepage (see LandingPage.tsx's logo glow / final CTA
 *  glow), just repositioned per-section so backgrounds read as gently layered rather than flat,
 *  without ever competing with the text sitting on top of them. */
function SectionGlow({ variant, corner }: { variant: 'forest' | 'olive'; corner: 'left' | 'right' }) {
  const color = variant === 'forest' ? 'var(--color-brand-forest)' : 'var(--color-brand-olive)';
  const position = corner === 'left' ? '15%_20%' : '85%_15%';
  return (
    <div
      className="pointer-events-none absolute inset-0 -z-10 opacity-60"
      style={{
        background: `radial-gradient(45% 55% at ${position}, color-mix(in srgb, ${color} 16%, transparent), transparent 70%)`,
      }}
      aria-hidden="true"
    />
  );
}

const BRANDS = ['Naturehike', 'Blackdog', 'Vidalido', 'Mobi Garden', 'Mountainhiker'];

const BENEFITS = [
  'Personal camping gear recommendations',
  'Setup and disassembly guidance',
  'Beginner-friendly explanations',
  "Well-maintained and hygienic gear you're able to trust",
  '24/7 support through Messenger and TikTok',
];

interface ProcessStep {
  number: number;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}

const PROCESS_STEPS: ProcessStep[] = [
  {
    number: 1,
    title: 'Choose your setup',
    description:
      'Pick a ready-made package or build your own camping essentials rental. New to camping? Start with a beginner camping setup and add pieces as you gain confidence.',
    icon: GearPlaceholderIcon,
  },
  {
    number: 2,
    title: 'Reserve your dates',
    description:
      'GearBnB offers 48-hour, 72-hour, and extended-day rental periods. This gives you enough time to set up, enjoy your trip, and pack down without rushing.',
    icon: ClockIcon,
  },
  {
    number: 3,
    title: 'Get your gear delivered or picked up',
    description:
      'Choose Grab delivery or in-person pickup. Our chat support operates 24/7, so let us know your preferred time at least 24 hours before your rental date.',
    icon: TruckIcon,
  },
];

interface ValueCard {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}

const VALUES: ValueCard[] = [
  {
    title: 'Simple',
    description: 'Camping should feel simple, not stressful. We take the second-guessing out of your trip.',
    icon: LeafIcon,
  },
  {
    title: 'Prepared',
    description: "We'll make sure you have the right equipment and information to feel confident outdoors.",
    icon: ShieldCheckIcon,
  },
  {
    title: 'Memorable',
    description: 'Your trip should be about the experience. We take care of the gear, so you can enjoy the moment.',
    icon: CompassIcon,
  },
];

const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'How do I rent camping gear from GearBnB?',
    answer:
      'If you need help, you can send us a message on Messenger or TikTok. You can also directly browse available gear or packages and select your rental period. Choose Grab delivery or pick up and confirm your time at least 24 hours before your rental date.',
  },
  {
    question: 'How much does camping gear cost to rent?',
    answer:
      'Rental rates depend on the gear you choose and your rental period. Packages and individual items are priced separately, so you can build a rental that fits your budget.',
  },
  {
    question: 'How much does it cost to rent camping equipment for a weekend?',
    answer:
      'Your total cost depends on which items you select, how many pieces you rent, and how long you’re renting. Feel free to browse our gear rental page for accurate pricing.',
  },
  {
    question: 'How do I contact GearBnB?',
    answer:
      "You can message us directly on Facebook or TikTok for inquiries, recommendations, and booking assistance. We're happy to help you get camp-ready!",
  },
];

/** Every "Book Your Gear" CTA on this page — matches the destination the rest of the site's own
 *  primary CTAs already use ("Rent Your Gears", "Start Your Rental Today", "Explore All Gear" on
 *  the homepage all send the customer to /catalog to choose Package vs Build Your Own). */
function BookYourGearButton({ className = '' }: { className?: string }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate('/catalog')}
      className={`inline-flex w-fit items-center gap-1.5 rounded-lg bg-brand-forest px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-forest-dark ${className}`}
    >
      Book Your Gear
      <span aria-hidden="true">&rarr;</span>
    </button>
  );
}

export default function AboutUs() {
  usePageMeta(
    'Camping Gear Rental in Las Piñas, Metro Manila | GearBnB',
    'Discover Gearbnb, your camping gear rental in Las Piñas, Metro Manila. Learn about our mission and find reliable gear for your next outdoor adventure.',
  );

  return (
    <div className="flex flex-col">
      {/* Hero — uses the client-provided AboutUS_2 reference photo (copied from
          Reference UI/AboutUS_2.png to public/images/about-us-2.png, also reused by My Bookings'
          own header banner) rather than a stock/invented image, darkened for readable white text,
          matching the reference's large-photo-with-overlay hero treatment. */}
      <section className="relative isolate overflow-hidden">
        <img
          src="/images/about-us-2.png"
          alt="A tent and camp chairs set up beside a mountain river with a waterfall in the background"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-black/10" />
        <div className="relative mx-auto flex min-h-[360px] w-full max-w-5xl flex-col justify-center gap-3 px-5 py-12 sm:min-h-[540px] sm:gap-4 sm:px-6 sm:py-20">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-white">About Us</span>
          <h1 className="max-w-xl font-serif text-3xl font-bold leading-tight text-white drop-shadow-sm sm:text-5xl">
            Local Camping Gear Rental in Las Piñas, Metro Manila
          </h1>
          <p className="max-w-lg text-sm text-white sm:text-base">
            Your first camping trip should feel like a fresh breath of air. At GearBnB, we&rsquo;re your local
            camping gear rental in Las Piñas, Metro Manila, guiding you through every step of your trip.
          </p>
          <BookYourGearButton className="mt-2" />
        </div>

        {/* Soft fade into the section below, so the hero photo eases into the page rather than
            cutting off sharply at a hard edge. */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-[var(--color-page)] sm:h-24"
          aria-hidden="true"
        />
      </section>

      {/* Location / service area */}
      <section className="relative overflow-hidden bg-page-band px-5 py-10 sm:px-6 sm:py-20">
        <div className={TEXTURE_CLASS} aria-hidden="true" />
        <SectionGlow variant="forest" corner="right" />
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 lg:flex-row lg:items-center">
          <div className="flex flex-1 flex-col gap-4">
            <span className={EYEBROW_CLASS}>Our Location &amp; Service Area</span>
            <h2 className="font-serif text-2xl font-bold text-ink sm:text-3xl">
              Camping Gear Rental Serving Las Piñas and Nearby Cities
            </h2>
            <p className="text-sm text-ink-muted sm:text-base">
              Rent camping gear from trusted outdoor brands, including Naturehike, Blackdog, Vidalido, Mobi Garden,
              Mountainhiker and many more.
            </p>
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-ink">Searching for camping gear for rent near me? We serve:</p>
              <ul className="flex flex-col gap-1.5 text-sm text-ink-muted">
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  Las Piñas and the rest of Metro Manila
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  Cities across Cavite
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  Cities across Laguna
                </li>
              </ul>
            </div>
            <p className="text-sm text-ink-muted sm:text-base">
              Camping outside these areas? As long as you&rsquo;re able to pick up your gear from GearBnB, you&rsquo;re
              welcome to rent, even for a trip to Luzon, Visayas or Mindanao.
            </p>
          </div>

          {/* Map + brands card — now points at the real GearBnB Camping Gears Rental location
              (confirmed via the client-provided Google Maps place link). The keyless
              `google.com/maps?...&output=embed` form is used deliberately: it renders a real,
              interactive embedded map with no Google Maps API key required, so nothing here adds
              a key to expose. The brand chips alongside it are the exact brand names from the
              client's original document, styled like the reference's "Our Brands" panel. */}
          <div className="flex flex-1 flex-col gap-4 rounded-2xl border border-line/80 bg-surface p-4 shadow-sm sm:flex-row sm:p-5">
            {/* aspect-[16/9] below sm (was aspect-square at every width): stacked as the first of
                two full-width columns on mobile, a square map ran ~340px tall on its own before
                "Our Brands" was visible below it — a wide, shorter ratio still shows the pin and
                nearby streets clearly while taking meaningfully less vertical space. sm:aspect-
                square restores the original ratio once this sits beside the brands card in a row,
                where its height is already bounded by that row instead of standing alone. */}
            <div className="aspect-[16/9] flex-1 overflow-hidden rounded-xl border border-line sm:aspect-square">
              <iframe
                title="GearBnB Camping Gears Rental location"
                src="https://www.google.com/maps?q=14.4461908,120.9966593&z=17&output=embed"
                className="h-full w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
            <div className="flex flex-1 flex-col gap-3">
              <p className="text-sm font-semibold text-ink">Brands in Our Rental Collection</p>
              <div className="flex flex-wrap gap-1.5">
                {BRANDS.map((brand) => (
                  <span
                    key={brand}
                    className="rounded-full border border-line bg-surface-muted px-2.5 py-1 text-xs font-medium text-ink-muted"
                  >
                    {brand}
                  </span>
                ))}
                <span className="rounded-full border border-line bg-surface-muted px-2.5 py-1 text-xs font-medium text-ink-muted">
                  and more
                </span>
              </div>
              <a
                href="https://www.google.com/maps/place/GearBnB+Camping+Gears+Rental/@14.4461908,120.9966593,17z/data=!3m1!4b1!4m6!3m5!1s0x3397d3090cbbd26f:0x665f11a5d4c66dde!8m2!3d14.4461908!4d120.9966593!16s%2Fg%2F11z8h467l7?entry=ttu&g_ep=EgoyMDI2MDkwOS4wIKXMDSoASAFQAw%3D%3D"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-auto flex items-center gap-1 self-start text-sm font-semibold text-accent transition-colors hover:text-brand-forest-dark"
              >
                Get Directions <span aria-hidden="true">&rarr;</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Have questions — horizontal banner reusing an existing GearBnB camp photo as the
          backdrop, matching the reference's imagery + message CTA banner. */}
      <section className="px-5 py-10 sm:px-6 sm:py-20">
        <div className="relative mx-auto isolate flex w-full max-w-5xl min-h-[220px] items-center overflow-hidden rounded-2xl sm:min-h-[260px]">
          <img
            src="/images/camp-setups/camp-setup-3.jpg"
            alt="A quiet forest campsite in the mist"
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/50 to-black/20" />
          <div className="relative flex flex-col gap-3 px-6 py-10 sm:px-10">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-white">Have Questions?</span>
            <h2 className="font-serif text-2xl font-bold text-white sm:text-3xl">Need help or have questions?</h2>
            <p className="max-w-md text-sm text-white">
              Whether you&rsquo;re new to camping, not sure what to rent, or wanted to know more, feel free to reach
              out.
            </p>
            <a
              href={MESSENGER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-lg bg-brand-forest px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-forest-dark"
            >
              Message Us <span aria-hidden="true">&rarr;</span>
            </a>
          </div>
        </div>
      </section>

      {/* What makes GearBnB different */}
      <section className="relative overflow-hidden bg-page-band px-5 py-10 sm:px-6 sm:py-20">
        <div className={TEXTURE_CLASS} aria-hidden="true" />
        <SectionGlow variant="olive" corner="left" />
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 lg:flex-row lg:items-center">
          <div className="flex flex-1 flex-col gap-5">
            <div className="flex flex-col gap-2">
              <span className={EYEBROW_CLASS}>Why Choose GearBnB</span>
              <h2 className="font-serif text-2xl font-bold text-ink sm:text-3xl">
                What Makes GearBnB Different From Other Gear Rentals?
              </h2>
              <p className="text-sm text-ink-muted sm:text-base">
                A lot of outdoor gear rental services stop at handing you a bundle of gear. Our rental team goes
                further.
              </p>
            </div>

            <ul className="flex flex-col gap-2.5 text-left">
              {BENEFITS.map((benefit) => (
                <li key={benefit} className="flex items-start gap-2.5 text-sm text-ink">
                  <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  {benefit}
                </li>
              ))}
            </ul>

            <p className="font-serif text-lg font-semibold text-ink">
              Your safety and your comfort come first, so does a memorable camping experience.
            </p>

            <BookYourGearButton />
          </div>

          {/* aspect-video below sm (was aspect-[4/3] at every width up to lg): this section
              already stacks text above image below `lg`, so the image never pushes the heading,
              benefits, or CTA down — but at a flat 4:3 it still ran ~290px tall on a 390px phone,
              adding real scroll length before the next section. A wider, shorter mobile crop keeps
              the photo clearly readable while taking less of that. sm:aspect-[4/3] restores the
              original ratio from tablet width up; lg:aspect-[3/4] (desktop's side-by-side layout)
              is unchanged. */}
          <div className="flex-1">
            <img
              src="/images/camp-setups/camp-setup-6.jpg"
              alt="A Naturehike tent camp setup rented from GearBnB"
              loading="lazy"
              className="aspect-video w-full rounded-2xl object-cover shadow-sm sm:aspect-[4/3] lg:aspect-[3/4]"
            />
          </div>
        </div>
      </section>

      {/* How does it work */}
      <section className="relative overflow-hidden px-5 py-10 sm:px-6 sm:py-20">
        <SectionGlow variant="forest" corner="right" />
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
          <div className="flex flex-col gap-2">
            <span className={EYEBROW_CLASS}>Our Simple Process</span>
            <h2 className="font-serif text-2xl font-bold text-ink sm:text-3xl">
              How Does Camping Equipment Rental Work with GearBnB?
            </h2>
            <p className="max-w-xl text-sm text-ink-muted sm:text-base">Renting your gear takes three simple steps.</p>
          </div>

          <div className="grid gap-6 rounded-2xl bg-surface-muted p-6 sm:grid-cols-3 sm:p-8">
            {PROCESS_STEPS.map((step) => (
              <div key={step.number} className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5 shadow-sm">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-forest text-sm font-bold text-white">
                    {step.number}
                  </span>
                  {/* Solid circle + white icon, not a bare colored glyph — per the client's
                      "section icons should be white" request; the badge is what keeps a white
                      icon visible against this card's own light background. */}
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-forest text-white">
                    <step.icon className="h-4 w-4" />
                  </span>
                </div>
                <h3 className="text-base font-semibold text-ink">{step.title}</h3>
                <p className="text-sm text-ink-muted">{step.description}</p>
              </div>
            ))}
          </div>

          <BookYourGearButton className="self-center" />
        </div>
      </section>

      {/* Our promise */}
      <section className="relative overflow-hidden bg-page-band px-5 py-10 sm:px-6 sm:py-20">
        <div className={TEXTURE_CLASS} aria-hidden="true" />
        <SectionGlow variant="olive" corner="left" />
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
          <div className="flex flex-col gap-2">
            <span className={EYEBROW_CLASS}>Our Promise to Every Rental</span>
            <h2 className="font-serif text-2xl font-bold text-ink sm:text-3xl">Our Promise to Every Rental</h2>
            <p className="max-w-xl text-sm text-ink-muted sm:text-base">
              Every rental comes with more than gear, and each one is built on our three simple values.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            {VALUES.map((value) => (
              <div key={value.title} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-6 shadow-sm">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-forest text-white">
                  <value.icon className="h-6 w-6" />
                </span>
                <h3 className="font-serif text-xl font-bold text-ink">{value.title}</h3>
                <p className="text-sm text-ink-muted">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA — reuses the same scenic lakeside photo as the hero (bookend imagery), darkened
          more evenly since the text here is centered rather than left-anchored. */}
      <section className="relative isolate overflow-hidden">
        <img
          src="/images/background_landpage.png"
          alt="A GearBnB tent and camp chairs set up beside a lake at sunrise"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-black/70" />
        <div className="relative mx-auto flex min-h-[320px] w-full max-w-2xl flex-col items-center justify-center gap-5 px-5 py-16 text-center sm:px-6">
          <h2 className="font-serif text-3xl font-bold text-white drop-shadow-sm sm:text-4xl">
            Your Outdoor Adventure Starts Here
          </h2>
          <p className="text-sm text-white">
            Are you planning your camping trip and not sure where to start? At GearBnB, we&rsquo;re your trusted
            camping gear rental in Las Piñas, Metro Manila, serving campers across Metro Manila, Cavite, and Laguna. Your
            next trip deserves gear you&rsquo;re able to rely on.
          </p>
          <BookYourGearButton className="bg-white !text-brand-forest hover:bg-brand-cream" />
        </div>

        {/* Same soft fade as the hero, easing the scenic band into the FAQ section below it. */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-[var(--color-page)] sm:h-24"
          aria-hidden="true"
        />
      </section>

      {/* FAQ */}
      <section className="relative overflow-hidden px-5 py-10 sm:px-6 sm:py-20">
        <SectionGlow variant="forest" corner="right" />
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 lg:flex-row">
          <div className="flex flex-1 flex-col gap-2">
            <span className={EYEBROW_CLASS}>FAQ</span>
            <h2 className="font-serif text-2xl font-bold text-ink sm:text-3xl">Frequently Asked Questions</h2>
            <p className="max-w-sm text-sm text-ink-muted">
              Here are common questions we get, with straightforward answers. Don&rsquo;t see your question here?
              Shoot us a message.
            </p>
          </div>
          <div className="flex-[1.4]">
            <FaqAccordion items={FAQ_ITEMS} />
          </div>
        </div>
      </section>
    </div>
  );
}
