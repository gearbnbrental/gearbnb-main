export interface FaqEntry {
  question: string;
  answer: string;
}

/**
 * The one checkout question that's identical for every product — gear or package — regardless of
 * which one a customer is looking at. Shared so the wording can never drift between the gear and
 * package details popups (see ProductFaqSection, used by both). The deposit question is NOT here:
 * a package's dialog can state its real deposit amount, a gear kind's cannot (BookableGearKind
 * carries no deposit field), so each caller writes its own version of that one.
 */
export const ID_VERIFICATION_FAQ: FaqEntry = {
  question: 'Do I need to submit ID verification before I can rent this?',
  answer:
    'Yes. Every booking requires two valid government IDs, a selfie with one of them, and proof of billing before it can be confirmed — the same verification step for any gear or package you choose.',
};

/**
 * FAQPage structured data (schema.org) for a details popup's own FAQ entries. Added because it
 * was asked for, but it has no real SEO payoff as things stand: this popup has no address of its
 * own (see ProductFaqSection / GearDetailsDialog / PackageDetailsDialog's own doc comments), and
 * Google generally only credits structured data to a page it can actually crawl at a real URL. The
 * value today is the FAQ's own visible text, read by a customer who opened this popup — this JSON
 * is a low-cost, harmless addition on top of that, not the reason it exists.
 */
export function faqPageJsonLd(entries: FaqEntry[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: entries.map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: { '@type': 'Answer', text: entry.answer },
    })),
  };
}
