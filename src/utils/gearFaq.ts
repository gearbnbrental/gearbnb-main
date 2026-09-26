import type { FaqEntry } from './productFaq';

interface GearFaq {
  /** Appended to the shared "How many people does the X fit?" answer. */
  capacityNote?: string;
  /** Replaces that answer entirely (the shared sentence is dropped). */
  capacityAnswer?: string;
  /** Replaces the default "How many people does the X fit?" question; `{name}` is the product's name. */
  capacityQuestion?: string;
  entries: FaqEntry[];
}

const NATUREHIKE: GearFaq = {
  capacityNote: 'The tent sleeps 6 to 8 people. For extra room for bags and camping beds, plan for 6.',
  entries: [
    {
      question: 'Will I be able to stand up inside the tent?',
      answer: 'Yes for most adults because the peak height of the Naturehike Village 13 Lite reaches 183 cm.',
    },
    {
      question: 'Does this fit a sedan?',
      answer:
        'The bag measures 110 x 25 x 25 cm and weighs 18.5 kg. Measure your trunk before pickup. An SUV, MPV or pickup is the safer choice.',
    },
    {
      question: 'Does this fit a motorcycle?',
      answer: 'No. At 18.5 kg and 110 cm long, the bag is too big for a motorcycle. For motocamping, pick the Mobi Garden Backpacking Tent.',
    },
    {
      question: 'Is this waterproof?',
      answer:
        'Yes! The outer fabric of the tent has a waterproof coating and taped seams. Make sure to keep the guy ropes tight during heavy rain.',
    },
    {
      question: 'How long does setup take?',
      answer:
        'The automatic frame opens in about a minute. You need 1-2 people to lift and lock the frame. Stakes and guy ropes take a few more minutes. We will make sure to send you instructions and educational videos of assembly and disassembly to keep you from the hassle of guessing!',
    },
  ],
};

const VIDALIDO: GearFaq = {
  capacityNote: 'The 320 x 220 cm interior also fits one of our king-size beds with room for bags.',
  entries: [
    {
      question: 'Will I be able to stand up inside?',
      answer: 'The interior height reaches 170 cm. Adults up to 170 cm stand upright. Taller campers may have to stoop a little.',
    },
    {
      question: 'Does this fit a sedan?',
      answer:
        'The bag measures 101 x 25 x 25 cm and weighs 14.7 kg. Measure your trunk before pickup. Folding the rear seats may give extra room for this tent.',
    },
    {
      question: 'Does this fit a motorcycle?',
      answer: 'No. The bag is too long and heavy for a motorcycle. For motocamping, pick the Mobi Garden Backpacking Tent.',
    },
    {
      question: 'Is this waterproof?',
      answer:
        'Yes. The outer layer uses PU-coated polyester rated 1500 to 2000 mm. Make sure to stake the tent and tighten the guy ropes before rain arrives.',
    },
  ],
};

const BLACKDOG: GearFaq = {
  capacityAnswer:
    'The Blackdog Pop-up Vinyl Tent comfortably accommodates up to 3 adults, or 2 adults with 1–2 small kids. For a more comfortable setup, 3 adults will have room to move and store their bags, while adding a small child or two works well for family camping.',
  entries: [
    {
      question: 'Will I be able to stand up inside?',
      answer:
        'The peak height reaches around 120 cm. Regular adults may have to stoop a little but the tent is comfortably big enough for casual campers.',
    },
    {
      question: 'Does this fit a sedan?',
      answer: 'Yes. The bag measures 98.5 x 18 x 18 cm and weighs about 6.2 kg. Lay the bag crosswise or diagonally in the trunk.',
    },
    {
      question: 'Does this fit a motorcycle top box?',
      answer: 'No, the 98.5 cm bag is too long for a top box. For motocamping, pick the Mobi Garden Backpacking Tent.',
    },
    {
      question: 'Is this waterproof?',
      answer: 'Yes. The vinyl-coated fabric carries a PU3000 waterproof rating. The same coating blocks 99% of UV rays.',
    },
    {
      question: 'How long does setup take?',
      answer: 'About 3 minutes, the automatic frame pops open immediately after assembly. Make sure to add the stakes and guy ropes to finish.',
    },
  ],
};

const MOBI_GARDEN: GearFaq = {
  capacityNote: '2 people can fit with room to move and space for bags. The tent can hold up to 3 people with bags inside, the fit is comfortable.',
  entries: [
    {
      question: 'Will I be able to stand up inside?',
      answer: 'No, since the peak height reaches below 120 cm but you can still be able to sit up with ease inside.',
    },
    {
      question: 'Does this fit a sedan?',
      answer: 'Yes. The bag measures 48 x 16 x 16 cm. The tent fits any trunk or back seat.',
    },
    {
      question: 'Does this fit a motorcycle top box?',
      answer:
        'Check the inner length of your top box. The bag runs 48 cm long. If your box runs shorter, you can strap the bag behind the seat.',
    },
    {
      question: 'Is this waterproof?',
      answer: 'Yes, the tent is waterproof and sunproof with a light aluminum frame.',
    },
    {
      question: 'Which bed fits inside?',
      answer:
        'The floor measures 210 x 180 cm. You can pair the tent with our Mountainhiker Single Bed, the Mobi Garden Double-Sized Inflatable Bed or the Blackpongo Double-Sized Inflatable Bed depending on your preference!',
    },
  ],
};



const NOTE_INFLATOR =
  'Yes, the bed needs to be inflated before use. No need to bring your own pump, we’ll include a free-to-use inflator with your rental so you can set it up easily.';
const NOTE_SUPPORT_MAT =
  'Inflatable beds can be more vulnerable to rocks and other hard or rough surfaces. We include a bed support mat to provide an extra layer of protection between the bed and the ground, while also giving you additional support and peace of mind when camping outdoors.';
const LOW_HIGH_DIFFERENCE =
  'The low bed is lighter and more compact, making it easier to transport and ideal for lower-profile tents. The trade-off is that you may need to stoop a little when getting in and out. The high bed offers a more elevated setup and is better suited for walking-level tents like the Naturehike Village 13 Lite and Vidalido Vicore Tents.';

const LOW_BED: GearFaq = {
  capacityAnswer: 'The bed comfortably accommodates 2–3 adults, or 2 adults with 1–2 small children.',
  entries: [
    {
      question: 'Which tents fit this bed?',
      answer: 'The Mountainhiker King-Sized Low Bed is a great fit for the Naturehike Village 13 Lite, Vidalido Vicore Villa, and Blackdog Pop-up Vinyl Tent.',
    },
    {
      question: 'Does this fit in a motorcycle top box?',
      answer:
        'If your top box has at least 37 × 17 × 25 cm of internal space, it can fit. The bed weighs approximately 4.53 kg. However, because of its size and bulk, we recommend our Mobi Garden Double-Sized Inflatable Bed or Blackpongo Double-Sized Inflatable Bed for motocamping.',
    },
    { question: 'Do I need a pump or bed inflator?', answer: NOTE_INFLATOR },
    { question: 'What’s the difference between the low bed and high bed?', answer: LOW_HIGH_DIFFERENCE },
  ],
};

const HIGH_BED: GearFaq = {
  capacityAnswer: 'The bed comfortably accommodates 2–3 adults, or 2 adults with 1–2 small children.',
  entries: [
    {
      question: 'Which tents fit this bed?',
      answer: 'The Mountainhiker King-Sized High Bed is a great fit for the Naturehike Village 13 Lite, Vidalido Vicore Villa, and Blackdog Pop-up Vinyl Tent.',
    },
    {
      question: 'Does this fit in a motorcycle top box?',
      answer:
        'If your top box has at least 40 x 20.5 x 34.5 cm of internal space, it can fit. The bed weighs approximately 8.71 kg. However, because of its size and bulk, we recommend our Mobi Garden Double-Sized Inflatable Bed or Blackpongo Double-Sized Inflatable Bed for motocamping.',
    },
    { question: 'Do I need a pump or bed inflator?', answer: NOTE_INFLATOR },
    { question: 'What’s the difference between the low bed and high bed?', answer: LOW_HIGH_DIFFERENCE },
  ],
};

const SINGLE_BED: GearFaq = {
  capacityAnswer: 'The Mountainhiker Single Bed is designed for 1 person. It’s ideal for solo campers or anyone who prefers having a separate bed while camping.',
  entries: [
    { question: 'Which tents can fit this bed?', answer: 'All 4 of our tents can accommodate this bed, including our Mobi Garden Backpacking Tent.' },
    {
      question: 'Does this fit in a motorcycle top box?',
      answer:
        'Yes, provided your top box has at least 33 × 12 × 25.5 cm of internal space. However, we recommend our Mobi Garden Double-Sized Inflatable Bed or Blackpongo Double-Sized Inflatable Bed for motocampers, as the Mountainhiker Single Bed can be quite bulky to transport.',
    },
    { question: 'Do I need a pump or bed inflator?', answer: NOTE_INFLATOR },
    {
      question: 'Is this light enough for backpacking?',
      answer:
        'The bed weighs approximately 4.1 kg, so it is relatively lightweight for its size. However, we do not recommend it for backpacking or travel camping because its packed size can take up a significant amount of space in your pack.',
    },
  ],
};

const MOBI_GARDEN_BED: GearFaq = {
  capacityAnswer: 'The Mobi Garden Double-Sized Inflatable Bed can accommodate up to 2 people.',
  entries: [
    {
      question: 'Does this fit the Mobi Garden Backpacking Tent?',
      answer:
        'Yes! This is the perfect fit for the Mobi Garden Backpacking Tent. The 195 × 135 cm bed fits comfortably within the tent’s 210 × 180 cm floor space. You can rent both together for a complete motocamping or backpacking sleep setup.',
    },
    {
      question: 'Does this fit in a motorcycle top box?',
      answer:
        'Yes. We specifically selected this bed with motocampers in mind, prioritizing a lightweight and compact setup. It packs down to approximately 37 × 19 cm and weighs only 3.5 kg, making it easier to transport on a motorcycle.',
    },
    {
      question: 'Do I need a pump?',
      answer: 'No. The Mobi Garden Double-Sized Inflatable Bed has a built-in manual pump, so you won’t need to bring or rent a separate inflator.',
    },
    { question: 'Why does it come with a bed support mat?', answer: NOTE_SUPPORT_MAT },
  ],
};

const BLACKPONGO_BED: GearFaq = {
  capacityAnswer: 'The Blackpongo Double-Sized Inflatable Bed can accommodate up to 2 people.',
  entries: [
    {
      question: 'Does this fit the Mobi Garden Backpacking Tent?',
      answer:
        'Yes! This is a great fit for the Mobi Garden Backpacking Tent. The 196 × 125 cm bed fits comfortably within the tent’s 210 × 180 cm floor space. You can rent both together for a complete motocamping or backpacking sleep setup.',
    },
    {
      question: 'Does this fit in a motorcycle top box?',
      answer:
        'Yes. With a packed size of approximately 30 × 15 cm and a weight of only 1.5 kg, this bed is an excellent option for motocampers and backpackers who want to save space and keep their gear lightweight.',
    },
    {
      question: 'Do I need a pump?',
      answer: 'No. The Blackpongo Double-Sized Inflatable Bed has a built-in manual pump, so you won’t need to bring or rent a separate inflator.',
    },
    { question: 'Why does it come with a bed support mat?', answer: NOTE_SUPPORT_MAT },
  ],
};

const SMALL_TABLE: GearFaq = {
  capacityQuestion: 'How many people does the {name} serve?',
  capacityAnswer:
    'This table is ideal for 2 people and works especially well for moto camping or campers who prefer a simple, minimalist setup.',
  entries: [
    {
      question: 'How tall is the table?',
      answer:
        'The small camping table stands at 29.5 cm tall. Its low height pairs well with all our available chairs, including the Kermit Chair, Moon Chair, and Ultra-light Chair.',
    },
    {
      question: 'Does this fit a motorcycle?',
      answer:
        'Yes. At just 0.95 kg, this table is easy to bring on a motorcycle. It can fit inside a top box or camping bag, or be secured to the seat with a strap.',
    },
    {
      question: 'What fits on top of the table?',
      answer: 'The tabletop measures approximately 40 × 34.5 cm. It has enough space for regular meals, drinks, phones, and other small camping essentials.',
    },
  ],
};

const LARGE_TABLE: GearFaq = {
  capacityQuestion: 'How many people does the {name} serve?',
  capacityAnswer: 'This table is ideal for 2 to 4 people, whether you\'re having a meal, preparing food, or simply using it as a comfortable hangout spot.',
  entries: [
    {
      question: 'How tall is the table?',
      answer:
        'The large camping table stands at 40 cm tall. Its height pairs well with all our available chairs, including the Kermit Chair, Moon Chair, and Ultra-light Chair.',
    },
    {
      question: 'Does this fit a sedan?',
      answer:
        'Yes. The table folds down for easier transport and weighs around 1.8 kg, making it a practical choice for car campers. For moto campers and backpackers, we recommend the small camping table instead because it is lighter and easier to carry.',
    },
    {
      question: 'Is cooking on this table okay?',
      answer:
        'Yes. You can place a camping stove at the center of the table on stable, level ground. For safety, keep hot pots and pans away from the edges and make sure the stove is positioned securely before cooking.',
    },
  ],
};

const EXTRA_LONG_TABLE: GearFaq = {
  capacityQuestion: 'How many people does the {name} serve?',
  capacityAnswer: 'This table can comfortably accommodate 4 to 6 people for meals, making it a great option for families and barkada camping trips.',
  entries: [
    {
      question: 'How tall is the table?',
      answer:
        'The table stands at 55 cm tall. Its height pairs well with our available chairs, including the Kermit Chair, Moon Chair, and Ultra-light Chair.',
    },
    {
      question: 'Does this fit a motorcycle?',
      answer:
        'We don\'t recommend this table for moto camping because its longer size can be bulky to transport. For motocampers, our small camping table is a more practical option. The extra-long table is better suited for larger families and barkada groups.',
    },
    {
      question: 'Is this good for a camp kitchen?',
      answer:
        'Yes. With a 120 cm tabletop, you can place a stove on one end while keeping the other side available for food preparation. Its extra-long design also gives your group plenty of space for meals, drinks, and other camping essentials, making it a great hangout table under a tent canopy.',
    },
  ],
};

const ULTRALIGHT_CHAIR: GearFaq = {
  entries: [
    {
      question: 'Is this chair easy to carry?',
      answer: 'Yes. The Ultra-light Chair is lightweight and compact, making it easy to pack for backpacking and motorcycle camping.',
    },
    {
      question: 'Is the Ultra-light Chair comfortable for long periods?',
      answer:
        'Yes. It provides comfortable support while keeping the overall weight and packed size low, making it a practical choice when portability is a priority.',
    },
    {
      question: 'Who is the Ultra-light Chair best for?',
      answer:
        'It is best for backpackers and moto campers who need a chair that takes up minimal space and is easy to bring on the road or trail.',
    },
  ],
};

const KERMIT_CHAIR: GearFaq = {
  entries: [
    {
      question: 'Is the Kermit Chair comfortable for long periods?',
      answer:
        'Yes. It has a wider seat and spacious design, making it comfortable for relaxing around camp, having meals, or spending time by the fire.',
    },
    {
      question: 'Is the Kermit Chair easy to bring camping?',
      answer:
        'It is best suited for car camping because of its larger size and more spacious design. It may not be the most practical choice for backpacking or moto camping when packing space is limited.',
    },
    {
      question: 'Who is the Kermit Chair best for?',
      answer: 'It is best for car campers who prioritize comfort and want a spacious chair for relaxing at camp.',
    },
  ],
};

const MOON_CHAIR: GearFaq = {
  entries: [
    {
      question: 'Is the Moon Chair comfortable?',
      answer: 'Yes. Its supportive, relaxed design makes it a comfortable choice for sitting back and relaxing at camp.',
    },
    {
      question: 'Is the Moon Chair good for casual camping?',
      answer: 'Yes. It is a great choice for campers who want a comfortable chair for meals, conversations, or simply relaxing outdoors.',
    },
    {
      question: 'Who is the Moon Chair best for?',
      answer: 'It is best for casual campers who want a comfortable and easy-to-use chair for relaxing at camp.',
    },
  ],
};

const STRIP_LIGHT: GearFaq = {
  entries: [
    {
      question: 'How long does the battery last?',
      answer:
        'The main lamp runs for approximately 3.5 to 10 hours, while the light string runs for about 7 to 14 hours. Actual battery life depends on the brightness level.',
    },
    {
      question: 'How long is the light string?',
      answer: 'The light string is 10 meters long, giving you plenty of coverage for larger tents, canopies, and camping areas.',
    },
    {
      question: 'Does this use disposable batteries?',
      answer: 'No. The Blackdog Strip Light has a built-in 2,000 mAh rechargeable battery, so you don\'t need to bring or replace disposable batteries.',
    },
    {
      question: 'Do I receive this completely charged?',
      answer: 'Yes. We fully charge the Blackdog Strip Light before your rental so it is ready to use when you receive it.',
    },
  ],
};

const PINECONE_LANTERN: GearFaq = {
  entries: [
    {
      question: 'How long does the battery last?',
      answer:
        'The lantern runs for approximately 4 to 30 hours, depending on the brightness level. Using a lower brightness setting will give you a longer runtime.',
    },
    {
      question: 'Does this use disposable batteries?',
      answer: 'No. It has a built-in 2,000 mAh rechargeable battery, so there is no need for disposable batteries.',
    },
    {
      question: 'Is this bright enough for a group?',
      answer:
        'The Pinecone Lantern works well for a camping table, small tent, or personal lighting. For larger groups or bigger camping areas, we recommend adding the Blackdog Strip Light for wider coverage.',
    },
    {
      question: 'Do I receive this completely charged?',
      answer: 'Yes. We fully charge the Pinecone Lantern before your rental so it is ready to use when you receive it.',
    },
  ],
};

const ORASHARE_LIGHT: GearFaq = {
  entries: [
    {
      question: 'How long does the battery last?',
      answer: 'The Orashare Camping Light runs for approximately 6 to 12 hours, depending on the brightness level.',
    },
    {
      question: 'Does this use disposable batteries?',
      answer: 'No. It has a built-in 2,400 mAh rechargeable battery, so you don\'t need to bring disposable batteries.',
    },
    {
      question: 'Which light lasts through the night?',
      answer:
        'The Orashare can run for up to 12 hours on a low setting, making it suitable for overnight use. If you need the longest possible runtime, the Mountainhiker Pinecone Lantern can run for up to 30 hours on a low setting.',
    },
    {
      question: 'Do I receive this completely charged?',
      answer: 'Yes. We fully charge the Orashare Camping Light before your rental so it is ready to use when you receive it.',
    },
  ],
};

const COOLER_ICE_TIP =
  'Pre-chill your drinks and food before placing them inside. Fill empty spaces with ice, keep the cooler in a shaded area, and avoid opening the lid too often. With proper use, the cooler can provide insulation for up to 48 hours.';

const NATUREHIKE_COOLER: GearFaq = {
  entries: [
    {
      question: 'How much can the cooler hold?',
      answer: 'The cooler has an 18-liter capacity, giving you enough space for drinks, ice, and food for a day trip or overnight camp.',
    },
    { question: 'How can I make the ice last longer?', answer: COOLER_ICE_TIP },
    {
      question: 'Can I bring this for motorcycle camping?',
      answer:
        'Yes. The 18L cooler can be used for motorcycle camping, but make sure you have enough storage space for it alongside the rest of your camping gear, especially if you\'re bringing a full setup.',
    },
  ],
};

const BLACKDOG_COOLER: GearFaq = {
  entries: [
    {
      question: 'How much can the cooler hold?',
      answer: 'The cooler has a 17-liter capacity, giving you enough space for drinks, ice, and food for a day trip or overnight camp.',
    },
    { question: 'How can I make the ice last longer?', answer: COOLER_ICE_TIP },
    {
      question: 'Can I bring this for motorcycle camping?',
      answer:
        'Yes. The cooler measures 37.2 × 24 × 36 cm and can fit in a motorcycle trunk, on the back seat, or in available floor space. Make sure to plan your storage carefully, especially if you\'re bringing a full camping setup.',
    },
  ],
};

const TRIPOD_FAN: GearFaq = {
  entries: [
    {
      question: 'How long does the battery last?',
      answer:
        'The fan runs for approximately 27 hours on Speed 1, 13 hours on Speed 2, and 8 hours on Speed 3. Actual runtime may vary depending on usage.',
    },
    {
      question: 'Does this need an outlet?',
      answer: 'No. The fan has a built-in 10,000 mAh rechargeable battery, so you can use it at camp without being plugged into an outlet.',
    },
    {
      question: 'Will the fan last the whole night?',
      answer:
        'Yes. On Speed 1, it can run for up to 27 hours, while Speed 3 provides up to 8 hours of runtime. For overnight use, Speed 1 or 2 is recommended.',
    },
    {
      question: 'Will I receive this fully charged?',
      answer: 'Yes. We fully charge the fan before your rental so it is ready to use when you receive it.',
    },
  ],
};

const BIG_COOKING_SET: GearFaq = {
  entries: [
    {
      question: 'Is the cooking set hygienic?',
      answer: 'Yes. Every cooking set is thoroughly washed, cleaned, and sanitized before it is prepared for the next rental.',
    },
    {
      question: 'What does the cooking set include?',
      answer: 'The set includes 1 frying pan and 3 pots in different sizes, making it suitable for preparing different meals while camping.',
    },
    {
      question: 'Is the cooking set easy to bring to camp?',
      answer: 'Yes. The cookware is designed to pack together into a compact 21 x 15.5 x 21 cm size, making it easy to transport and store.',
    },
  ],
};

const COOK_OUTDOORS_ANSWER = 'No. Cook outdoors only. Stoves release carbon monoxide and pose a fire risk inside tents.';
const GAZLITE_BURN_TIME = 'About 1.5 to 2 hours on high flame, 2 to 3 hours on medium and 3 to 4+ hours on low.';

const GAZLITE_STOVE: GearFaq = {
  entries: [
    { question: 'Which gas do I need?', answer: 'The Gazlite LPG Can.' },
    { question: 'How long can this last?', answer: GAZLITE_BURN_TIME },
    { question: 'Is cooking inside the tent okay?', answer: COOK_OUTDOORS_ANSWER },
    {
      question: 'How do I travel with the stove?',
      answer: 'Detach the gas can before you pack. Keep the can upright and away from engine heat or direct sun.',
    },
    {
      question: 'Can I power this with a butane?',
      answer: 'No, we kindly remind you not to use butane in a Gazlite Portable Stove as they are not compatible and built for each other.',
    },
  ],
};

const ULTRALIGHT_STOVE: GearFaq = {
  entries: [
    {
      question: 'Which gas do I need?',
      answer: 'For the Ultra-light Portable Stove, it is powered by a butane can which you can add-on to your booking.',
    },
    { question: 'Is cooking inside the tent okay?', answer: 'No. Please cook outdoors only. Stoves release carbon monoxide and pose a fire risk inside tents.' },
    {
      question: 'Does wind affect the flame?',
      answer:
        'Yes. Cook behind a windbreak, a rock, or your vehicle to save gas. We will include a free use of windshield so that you can cook with ease.',
    },
    {
      question: 'Does this fit a motorcycle top box?',
      answer: 'Yes. The stove weighs 238 g and we specially selected this for motocampers and backpackers.',
    },
  ],
};

const GAZLITE_LPG_CAN: GearFaq = {
  entries: [
    { question: 'How long does one can last?', answer: GAZLITE_BURN_TIME },
    {
      question: 'How many cans should I rent?',
      answer:
        '1 can of Gazlite gives 1.5 to 2 hours on high flame. Make sure to add a spare for grilling or big pots. If you are camping for multiple days, it’s recommended to calculate and plan your cooking time. If you run out of gazlite during camping, you can have refilled with gazlite stores (Link gazlite stores: https://gazlite.com.ph/store-locations/) in the area.',
    },
    { question: 'Which stove does this fit?', answer: 'The Gazlite Portable Stove.' },
    {
      question: 'How do I store the can at camp?',
      answer: 'Keep the can upright, capped, and in the shade. Never leave the can inside a hot car.',
    },
  ],
};

/** The staff-written FAQ for one Build Your Own tent, bed, table, chair, light, cooler, fan or cooking set, matched on brand + model (so every
 *  color of a kind shares one). Undefined for any other product, which then gets only the generic
 *  FAQ (capacity, ID verification, security deposit), and these entries always sit ON TOP of it. */
export function gearSpecificFaq(kind: { category: string; brand: string; model: string | null }): GearFaq | undefined {
  const category = kind.category.trim().toLowerCase();
  const brand = kind.brand.trim().toLowerCase();
  const model = (kind.model ?? '').toLowerCase();
  if (category === 'tent') {
    if (brand === 'naturehike' && model.includes('village 13')) return NATUREHIKE;
    if (brand === 'vidalido' && model.includes('vicore')) return VIDALIDO;
    if (brand === 'blackdog' && model.includes('pop-up vinyl')) return BLACKDOG;
    if (brand === 'mobi garden' && model.includes('backpacking')) return MOBI_GARDEN;
  }
  if (category === 'camping table' && (brand === '' || brand === 'generic')) {
    if (model.includes('small table')) return SMALL_TABLE;
    if (model.includes('large table')) return LARGE_TABLE;
    if (model.includes('extra-long table')) return EXTRA_LONG_TABLE;
  }
  if (category === 'camping chair' && (brand === '' || brand === 'generic')) {
    if (model.includes('ultra-light')) return ULTRALIGHT_CHAIR;
    if (model.includes('kermit')) return KERMIT_CHAIR;
    if (model.includes('moon')) return MOON_CHAIR;
  }
  if (category === 'fan' && (brand === '' || brand === 'generic') && model.includes('fan')) return TRIPOD_FAN;
  if (category === 'cooking' && (brand === '' || brand === 'generic') && model.includes('big cooking set')) return BIG_COOKING_SET;
  if (category === 'cooking') {
    if (brand === 'gazlite' && model.includes('portable stove')) return GAZLITE_STOVE;
    if (brand === 'gazlite' && model.includes('lpg can')) return GAZLITE_LPG_CAN;
    if ((brand === '' || brand === 'generic') && model.includes('ultra-light portable stove')) return ULTRALIGHT_STOVE;
  }
  if (category === 'cooler') {
    if (brand === 'naturehike' && model.includes('18l')) return NATUREHIKE_COOLER;
    if (brand === 'blackdog' && model.includes('17l')) return BLACKDOG_COOLER;
  }
  if (category === 'lights') {
    if (brand === 'blackdog' && model.includes('strip light')) return STRIP_LIGHT;
    if (brand === 'mountainhiker' && model.includes('pinecone')) return PINECONE_LANTERN;
    if (brand === 'orashare' && model.includes('camping light')) return ORASHARE_LIGHT;
  }
  if (category === 'bed') {
    if (brand === 'mountainhiker' && model.includes('low bed')) return LOW_BED;
    if (brand === 'mountainhiker' && model.includes('high bed')) return HIGH_BED;
    if (brand === 'mountainhiker' && model.includes('single bed')) return SINGLE_BED;
    if (brand === 'mobi garden' && model.includes('inflatable')) return MOBI_GARDEN_BED;
    if (brand === 'blackpongo' && model.includes('inflatable')) return BLACKPONGO_BED;
  }
  return undefined;
}
