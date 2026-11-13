/**
 * Build-time only (never shipped to the browser), loaded by prerenderRouteMeta in vite.config.ts:
 * the files AI agents read instead of the full HTML. Each page gets a Markdown version
 * (/_md/<page>.md, also served at the page's own address to a request with
 * `Accept: text/markdown`), and /llms.txt summarises the business and links every page.
 */
import TurndownService from 'turndown';
import { SITE_URL, type PageMeta } from './config/pageMeta';
import { BUSINESS_SUMMARY, CONTACT_FACTS, DEPOSIT_RULE, HOW_RENTING_WORKS, depositTierLines } from './config/rentalFacts';

const bullets = (lines: string[]) => lines.map((line) => `- ${line}`);
const CONTACT_LINES = bullets(CONTACT_FACTS);

export interface AgentPage {
  path: string;
  meta: PageMeta;
  /** Where the page's Markdown version is served, e.g. "/_md/about-us.md". */
  markdownPath: string;
}

export interface AgentProduct extends AgentPage {
  name: string;
  /** One line: prices, deposit, size. */
  summary: string;
}

const turndown = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', codeBlockStyle: 'fenced' });
turndown.remove(['input', 'select', 'textarea', 'script', 'style', 'noscript', 'iframe', 'form']);
// Pictures and icons mean nothing in text. (A rule, not remove(): turndown's own image rule wins
// over remove().)
turndown.addRule('noImages', {
  filter: (node) => ['img', 'picture', 'svg'].includes(node.nodeName.toLowerCase()),
  replacement: () => '',
});
// Buttons are controls ("Add to Cart", "Close", filter pills), so they're dropped, except where
// their text is the content: an FAQ question (aria-expanded) or an item in a list (a package's
// "What's Included" names).
turndown.addRule('buttons', {
  filter: 'button',
  replacement: (content, node) => {
    const element = node as HTMLElement;
    if (element.hasAttribute('aria-expanded')) {
      // Inside a heading already (the homepage FAQ), otherwise bold.
      return /^H[1-6]$/.test(element.parentElement?.nodeName ?? '') ? content.trim() : `\n\n**${content.trim()}**\n\n`;
    }
    return element.closest('li') ? ` ${content.trim()}` : '';
  },
});
// Links inside the site become full addresses, so they still work once the text is copied elsewhere.
turndown.addRule('absoluteLinks', {
  filter: (node) => node.nodeName === 'A' && !!node.getAttribute('href'),
  replacement: (content, node) => {
    const href = (node as HTMLAnchorElement).getAttribute('href') ?? '';
    const text = content.trim();
    if (!text) return '';
    const url = href.startsWith('/') ? SITE_URL + href : href;
    return `[${text}](${url})`;
  },
});

function frontMatter(page: AgentPage): string {
  const quote = (value: string) => JSON.stringify(value);
  return [
    '---',
    `title: ${quote(page.meta.title)}`,
    `description: ${quote(page.meta.description)}`,
    `url: ${SITE_URL}${page.path === '/' ? '/' : page.path}`,
    '---',
    '',
  ].join('\n');
}

const tidy = (markdown: string) => markdown.replace(/\n{3,}/g, '\n\n').trim();

/** A page's Markdown version from its rendered HTML (without the navbar and footer). */
export function pageMarkdown(page: AgentPage, html: string): string {
  return `${frontMatter(page)}${tidy(turndown.turndown(html))}\n\n## Contact GearBnB\n\n${CONTACT_LINES.join('\n')}\n`;
}

/** A catalog page's Markdown version: its products with prices, each linking its own page. */
export function catalogMarkdown(page: AgentPage, heading: string, intro: string, products: AgentProduct[]): string {
  const items = products.map((product) => `- [${product.name}](${SITE_URL}${product.path}): ${product.summary}`);
  return `${frontMatter(page)}# ${heading}\n\n${intro}\n\n${items.join('\n')}\n\nSecurity deposits: ${SITE_URL}/terms#deposit\n\n## Contact GearBnB\n\n${CONTACT_LINES.join('\n')}\n`;
}

/** /llms.txt (https://llmstxt.org): what GearBnB is, the facts agents get asked, and every page. */
export function llmsTxt({
  pages,
  packages,
  gear,
}: {
  pages: AgentPage[];
  packages: AgentProduct[];
  gear: AgentProduct[];
}): string {
  const link = (title: string, page: AgentPage) => `- [${title}](${SITE_URL}${page.markdownPath}): ${page.meta.description}`;
  const byPath = new Map(pages.map((page) => [page.path, page]));
  const section = (title: string, entries: [string, string][]) => {
    const lines = entries.filter(([path]) => byPath.has(path)).map(([path, label]) => link(label, byPath.get(path)!));
    return lines.length ? [`## ${title}`, '', ...lines, ''] : [];
  };
  const productLines = (products: AgentProduct[]) =>
    products.map((product) => `- [${product.name}](${SITE_URL}${product.markdownPath}): ${product.summary}`);

  return [
    '# GearBnB',
    '',
    `> ${BUSINESS_SUMMARY}`,
    '',
    'Each page below links its Markdown version. Every page on gearbnbrental.com also returns Markdown when requested with `Accept: text/markdown`.',
    '',
    '## How renting works',
    '',
    ...bullets(HOW_RENTING_WORKS),
    '',
    '## Security deposit',
    '',
    DEPOSIT_RULE,
    '',
    ...bullets(depositTierLines()),
    '',
    '## Contact',
    '',
    ...CONTACT_LINES,
    '',
    ...section('Main pages', [
      ['/', 'Home'],
      ['/catalog/camping-packages', 'Camping packages'],
      ['/catalog/build-your-own', 'Build your own (gear by the piece)'],
      ['/plan-an-event', 'Plan an event'],
      ['/about-us', 'About GearBnB'],
    ]),
    ...(packages.length ? ['## Camping packages', '', ...productLines(packages), ''] : []),
    ...(gear.length ? ['## Gear by the piece', '', ...productLines(gear), ''] : []),
    ...section('Policies', [
      ['/terms', 'Rental terms and security deposit'],
      ['/terms-of-service', 'Terms of service'],
    ]),
    ...section('Optional', [
      ['/privacy-policy', 'Privacy policy'],
      ['/data-deletion', 'Data deletion'],
    ]),
  ].join('\n');
}
