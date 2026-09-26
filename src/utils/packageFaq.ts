import type { FaqEntry } from './productFaq';

const NOMAD: FaqEntry[] = [
  {
    question: 'What is The Nomad Kit?',
    answer:
      'The Nomad Kit is a compact 2-person camping package designed for motocampers, couples, or casual backpackers who want a small, cozy, and practical camping setup. It includes the essential gear you need for a comfortable outdoor stay without bringing a bulky setup.',
  },
  {
    question: 'Is The Nomad Kit good for motocamping?',
    answer:
      'Yes. The Nomad Kit is especially suitable for motocampers because it provides a light camping setup that is easier to bring along on your trip. It’s also a great option for couples who prefer a simple and cozy campsite setup.',
  },
  {
    question: 'Is The Nomad Kit easy to set up?',
    answer:
      'Definitely! Your rental will arrive already prepared and packed, so you can focus on getting to your campsite and enjoying your trip. We’ll also provide assembly and disassembly instructions to guide you through setting up and packing the gear properly.',
  },
];

const STARGAZER: FaqEntry[] = [
  {
    question: 'What is The Stargazer Kit?',
    answer:
      'The Stargazer Kit is a 2-person camping package designed for couples or buddies who want a more spacious and comfortable camping setup. It’s a larger version of our Nomad Kit, giving you more room to settle in and enjoy the outdoors.\n\nWhile designed for 2 adults, the Stargazer Kit can also comfortably accommodate up to 3 adults, or 2 adults with 1–2 small kids. If you need extra seating, you can also add additional camping chairs for extra pax.',
  },
  {
    question: 'Is The Stargazer Kit suitable for car camping?',
    answer:
      'Yes. The Stargazer Kit is ideal for car campers because of its larger and bulkier tent setup. It’s not recommended for backpacking or motocamping since the tent is too bulky to comfortably carry on a motorcycle.',
  },
  {
    question: 'Is The Stargazer tent waterproof and sunproof?',
    answer:
      'The Blackdog Vinyl tent has both sunproof and waterproof features. The tent is designed to provide protection from both sun and rain. Its waterproof construction helps keep rain from passing through the tent, so you can stay comfortable and dry even when the weather changes.',
  },
];

const BASE_CAMPER: FaqEntry[] = [
  {
    question: 'How many people can The Base Campers Kit accommodate?',
    answer:
      'The Base Campers Kit can accommodate up to 6 people, making it a great choice for families, barkadas, or larger groups who want plenty of space during their camping trip. It’s also a good option for longer stays where having extra room can make the experience more comfortable.',
  },
  {
    question: 'Is The Base Campers Kit spacious and comfortable for long camping trips?',
    answer:
      'Yes. The Base Campers Kit is designed for a spacious, bedroom-like camping experience. The tent has a walking-level interior, while the elevated bed makes it easier to get in and out without feeling like you’re sleeping directly on the ground. It’s especially suitable for campers who prefer more room to move around and a comfortable setup for longer trips.',
  },
  {
    question: 'What is a Canopy and does The Base Campers Kit have one?',
    answer:
      'A canopy is simply a covered extension that provides extra shade and shelter outside the main tent. The Vidalido Vicore (Base Camper Tent) has a built-in canopy at the entrance, giving you a covered outdoor area where you can sit, relax, or keep some of your camping essentials. You can also add-on more canopy poles to extend the covered area further.',
  },
];

const TRAVELER: FaqEntry[] = [
  {
    question: 'How many people can The Traveler Kit accommodate?',
    answer:
      'The Traveler Kit can accommodate up to 8 people, making it our largest camping package and a great choice for large families, barkadas, and groups who want plenty of room to relax and move around.',
  },
  {
    question: 'What makes The Traveler Kit a premium camping setup?',
    answer:
      'The Traveler Kit offers a spacious and cozy setup designed to feel more like a comfortable outdoor bedroom than a traditional camping tent. It has a walking-level interior and two elevated beds, making it easier to move around and get in and out of bed. It’s ideal for larger groups and campers who prefer plenty of space and comfort.',
  },
  {
    question: 'Is The Traveler Kit tent waterproof and sunproof?',
    answer:
      'Yes. The Traveler Kit features a large, sunproof and waterproof tent designed to provide comfortable shelter in different weather conditions. It also has a spacious canopy area at the front, giving your group additional covered space to sit, relax, and enjoy the outdoors.',
  },
];

/**
 * The staff-written FAQ entries specific to one package, matched on the package's name so both
 * color editions (e.g. "(BLACK)" / "(KHAKI)") share one set. A package with no entry here simply
 * gets none, never an invented one.
 */
export function packageSpecificFaq(packageName: string): FaqEntry[] {
  const name = packageName.toLowerCase();
  if (name.includes('nomad')) return NOMAD;
  if (name.includes('stargazer')) return STARGAZER;
  if (name.includes('base camper')) return BASE_CAMPER;
  if (name.includes('traveler')) return TRAVELER;
  return [];
}
