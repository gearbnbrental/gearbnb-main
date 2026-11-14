/**
 * The homepage FAQ, in one place: LandingPage shows it and the build writes the same questions and
 * answers into the homepage's FAQPage schema (see HOME_JSON_LD in pageMeta.ts), so the two can
 * never disagree. Plain text only; `link` is shown under the answer.
 */
import { MESSENGER_URL } from './social.ts';

export interface HomeFaqEntry {
  question: string;
  answer: string;
  link?: { href: string; label: string };
}

export const HOME_FAQ: HomeFaqEntry[] = [
  {
    question: 'Where are you located?',
    answer:
      "We're based in Talon Uno, Las Piñas City. We offer camping gear rental across Metro Manila, Calabarzon and nearby areas. We share the exact pickup address once we confirm your booking. Open our Google Maps pin for directions and nearby landmarks.",
    link: {
      href: 'https://www.google.com/maps/place/GearBnB+Camping+Gears+Rental/@14.4461908,120.9940844,17z/data=!3m1!4b1!4m6!3m5!1s0x3397d3090cbbd26f:0x665f11a5d4c66dde!8m2!3d14.4461908!4d120.9966593!16s%2Fg%2F11z8h467l7?entry=ttu&g_ep=EgoyMDI2MDkxNi4wIKXMDSoASAFQAw%3D%3D',
      label: 'View Our Location',
    },
  },
  {
    question: 'Can I customize my own package?',
    answer:
      'Yes. Choosing our Build Your Own option lets you mix and match individual gear by category to fit your trip exactly, instead of booking a fixed kit.',
  },
  {
    question: 'What if I go beyond my rental duration?',
    answer:
      "Let us know and we'll do our best to accommodate an extended rental where available, charged at our per-day rate on top of your original booking.",
  },
  {
    question: 'Do you sell camping gear?',
    answer:
      'Yes, we have selected tents for sale. Send us a message to ask which tents are available, their prices and other details. We also offer camping gear for rent, including tents, sleeping gear, cooking equipment and complete camping packages for every type of trip.',
    link: { href: MESSENGER_URL, label: 'Message Us About Tents for Sale' },
  },
  {
    question: 'Can you help me find a campsite?',
    answer: 'We can point you toward popular spots based on your trip, but booking the campsite itself is up to you.',
  },
  {
    question: 'How do I get started?',
    answer:
      "Browse our packages or build your own kit. Pick your dates and book. We'll guide you through verification and payment from there.",
  },
];
