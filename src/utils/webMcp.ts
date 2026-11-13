/**
 * WebMCP: read-only tools an AI agent running in the visitor's browser can call instead of
 * scraping the page (https://github.com/webmachinelearning/webmcp). Browsers without
 * `navigator.modelContext` ignore all of this. The tools only read the public catalog and rental
 * facts; nothing here books, adds to the cart or reads personal data.
 */
import { SITE_URL } from '../config/pageMeta';
import { BUSINESS_SUMMARY, CONTACT_FACTS, DEPOSIT_RULE, HOW_RENTING_WORKS, depositTierLines } from '../config/rentalFacts';
import type { BookableGearKind, PackageKit } from '../types/gearbnb';
import { splitBestForLine } from './bestForLine';
import { cleanGearName } from './gearName';
import { gearPath, gearSlug, packagePath, packageSlug } from './productSlug';

interface ToolResult {
  content: { type: 'text'; text: string }[];
}

export interface WebMcpTool {
  name: string;
  description: string;
  inputSchema: object;
  annotations?: { readOnlyHint?: boolean };
  execute: (input: Record<string, unknown>) => Promise<ToolResult>;
}

export interface ModelContext {
  registerTool?: (tool: WebMcpTool) => void;
  unregisterTool?: (name: string) => void;
  provideContext?: (context: { tools: WebMcpTool[] }) => void;
}

export interface CatalogSnapshot {
  kits: readonly PackageKit[];
  gearKinds: readonly BookableGearKind[];
}

const text = (value: unknown): ToolResult => ({
  content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }],
});

function packageInfo(kit: PackageKit) {
  return {
    type: 'package',
    name: kit.name,
    slug: packageSlug(kit),
    url: SITE_URL + packagePath(kit),
    pricePhp: { '48h': kit.pricing['48h'], '72h': kit.pricing['72h'] },
    securityDepositPhp: kit.depositAmount,
    guests: kit.paxRange || undefined,
    bestFor: splitBestForLine(kit.description).bestFor ?? undefined,
    inStock: !kit.isOutOfStock,
  };
}

function gearInfo(kind: BookableGearKind) {
  return {
    type: 'gear',
    name: cleanGearName(kind.name),
    slug: gearSlug(kind),
    url: SITE_URL + gearPath(kind),
    category: kind.category,
    brand: kind.brand || undefined,
    pricePhp: { '48h': kind.pricing['48h'], '72h': kind.pricing['72h'] },
    extraDayPhp: kind.extraPerDayPrice || undefined,
    sizeCapacity: kind.sizeCapacity ?? undefined,
    colors: kind.variants?.map((variant) => variant.color),
    bestFor: splitBestForLine(kind.description ?? '').bestFor ?? undefined,
    inStock: kind.canSelect,
  };
}

const NOT_LOADED = 'The catalog is still loading. Try again in a few seconds.';

/** The tools, reading the catalog through `snapshot` each time they run. */
export function rentalTools(snapshot: () => CatalogSnapshot): WebMcpTool[] {
  return [
    {
      name: 'search_rental_catalog',
      description:
        'Search GearBnB camping packages and individual camping gear for rent (tents, beds, chairs, tables, coolers, fans, lights). Returns names, 48-hour and 72-hour prices in PHP, deposits for packages and each item’s page URL.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Words to match in the name, brand or category, e.g. "tent" or "cooler". Leave empty for everything.' },
          type: { type: 'string', enum: ['package', 'gear', 'any'], description: 'Packages only, individual gear only, or both (default).' },
        },
      },
      annotations: { readOnlyHint: true },
      async execute(input) {
        const { kits, gearKinds } = snapshot();
        if (kits.length === 0 && gearKinds.length === 0) return text(NOT_LOADED);
        const words = String(input.query ?? '').toLowerCase().split(/\s+/).filter(Boolean);
        const matches = (fields: (string | undefined)[]) =>
          words.every((word) => fields.some((field) => field?.toLowerCase().includes(word)));
        const type = input.type === 'package' || input.type === 'gear' ? input.type : 'any';
        return text([
          ...(type === 'gear' ? [] : kits.filter((kit) => matches([kit.name, kit.description])).map(packageInfo)),
          ...(type === 'package' ? [] : gearKinds.filter((kind) => matches([kind.name, kind.brand, kind.category])).map(gearInfo)),
        ]);
      },
    },
    {
      name: 'get_rental_item',
      description: 'Full details of one GearBnB package or gear item: description, what is included, prices, deposit and availability.',
      inputSchema: {
        type: 'object',
        properties: { slug: { type: 'string', description: 'The item’s slug from search_rental_catalog, e.g. "stargazer-kit".' } },
        required: ['slug'],
      },
      annotations: { readOnlyHint: true },
      async execute(input) {
        const { kits, gearKinds } = snapshot();
        if (kits.length === 0 && gearKinds.length === 0) return text(NOT_LOADED);
        const slug = String(input.slug ?? '').trim().toLowerCase();
        const kit = kits.find((candidate) => packageSlug(candidate) === slug);
        if (kit) {
          return text({
            ...packageInfo(kit),
            description: kit.description,
            included: kit.components?.map((component) => `${component.quantity}× ${cleanGearName(component.name ?? component.category)}`) ?? kit.includedItems,
          });
        }
        const kind = gearKinds.find((candidate) => gearSlug(candidate) === slug);
        if (kind) {
          return text({
            ...gearInfo(kind),
            description: kind.description,
            includedFree: kind.freeAccessories.map((accessory) => accessory.name),
          });
        }
        return text(`No item with slug "${slug}". Use search_rental_catalog to find one.`);
      },
    },
    {
      name: 'get_rental_policies',
      description: 'How renting from GearBnB works: booking steps, ID verification, the security deposit tiers and deadline, payment, pickup and delivery, and contact details.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      async execute() {
        return text(
          [
            BUSINESS_SUMMARY,
            '',
            'How renting works:',
            ...HOW_RENTING_WORKS.map((line) => `- ${line}`),
            '',
            DEPOSIT_RULE,
            ...depositTierLines().map((line) => `- ${line}`),
            '',
            'Contact:',
            ...CONTACT_FACTS.map((line) => `- ${line}`),
            '',
            `Rental terms: ${SITE_URL}/terms`,
          ].join('\n'),
        );
      },
    },
  ];
}

/** Registers the tools when the browser supports WebMCP. Returns the cleanup. */
export function registerRentalTools(modelContext: ModelContext | undefined, snapshot: () => CatalogSnapshot): () => void {
  if (!modelContext) return () => {};
  const tools = rentalTools(snapshot);
  try {
    if (modelContext.registerTool) {
      for (const tool of tools) modelContext.registerTool(tool);
      return () => tools.forEach((tool) => modelContext.unregisterTool?.(tool.name));
    }
    modelContext.provideContext?.({ tools });
  } catch (error) {
    // An early WebMCP build with a different shape: the site works the same without the tools.
    console.warn('WebMCP tools not registered', error);
  }
  return () => {};
}
