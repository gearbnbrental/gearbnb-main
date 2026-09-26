import type { BookableGearKind } from '../types/gearbnb';
import { addOnAsGearKind } from './addOnAsKind';
import { cleanGearName } from './gearName';

export interface FaqLinkTarget {
  text: string;
  kind: BookableGearKind;
}

// Shorter ways staff write a product's name inside an FAQ answer, keyed by the product's full
// cleaned name.
const ALIASES: Record<string, string[]> = {
  'Small Table': ['small camping table'],
  'Mountainhiker Pinecone Lantern': ['Pinecone Lantern'],
  'Vidalido Vicore Villa Cabin Style': ['Vidalido Vicore Villa', 'Vidalido Vicore Tents', 'Vidalido Vicore Tent'],
};

const keyOf = (k: { category: string; brand: string; model: string | null }) => `${k.category}|${k.brand}|${k.model ?? ''}`;

/**
 * Every phrase in an FAQ answer that should open a product's own view: each catalog product's name
 * (and any alias above), including add-ons that only exist under a tent. `exclude` is the product
 * whose own FAQ this is, so it never links to itself. Longest phrases first, so a full name wins
 * over a shorter alias inside it.
 */
export function buildFaqLinkTargets(gearKinds: readonly BookableGearKind[], exclude?: { category: string; brand: string; model: string | null }): FaqLinkTarget[] {
  const kinds = new Map<string, BookableGearKind>();
  for (const kind of gearKinds) {
    if (!kinds.has(keyOf(kind))) kinds.set(keyOf(kind), kind);
    for (const addOn of kind.compatibleAddOns) {
      if (!kinds.has(keyOf(addOn))) kinds.set(keyOf(addOn), addOnAsGearKind(addOn));
    }
  }
  const excluded = exclude ? keyOf(exclude) : null;
  const seen = new Set<string>();
  const targets: FaqLinkTarget[] = [];
  for (const [key, kind] of kinds) {
    if (key === excluded) continue;
    const name = cleanGearName(kind.name);
    for (const text of [name, ...(ALIASES[name] ?? [])]) {
      if (seen.has(text)) continue;
      seen.add(text);
      targets.push({ text, kind });
    }
  }
  return targets.sort((a, b) => b.text.length - a.text.length);
}
