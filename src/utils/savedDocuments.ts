import type { SavedDocumentInfo, VerificationDocumentKey, VerificationFileMeta } from '../types/gearbnb';
import { VERIFICATION_KIND_MAP, type RmsSavedDocument, type RmsVerificationDocumentKind } from './rmsApi';
import { BUSINESS_TIME_ZONE } from './duration';

/**
 * Saved documents for returning renters. The RMS keeps the documents a customer already uploaded and staff
 * approved (for a limited time), and offers them back at checkout. These helpers only decide what the form shows
 * and what is sent; the RMS stays the authority on whether a document can really be reused.
 */

const SLOT_FOR_KIND = Object.fromEntries(
  Object.entries(VERIFICATION_KIND_MAP).map(([slot, kind]) => [kind, slot]),
) as Record<RmsVerificationDocumentKind, VerificationDocumentKey>;

type Slots = Record<VerificationDocumentKey, VerificationFileMeta | null>;

/** A slot is complete when its file finished uploading OR it uses a saved document. */
export function isSlotFilled(meta: VerificationFileMeta | null | undefined): boolean {
  return Boolean(meta?.storagePath || meta?.savedDocument);
}

/** The slot's meta when it is filled by a saved document. Holds no file name worth showing, only dates. */
export function savedDocumentMeta(doc: RmsSavedDocument): VerificationFileMeta | null {
  if (doc.state !== 'AVAILABLE' || !doc.uploadedAt || !doc.expiresAt) return null;
  const savedDocument: SavedDocumentInfo = {
    uploadedAt: doc.uploadedAt,
    verifiedAt: doc.verifiedAt,
    expiresAt: doc.expiresAt,
    fromBookingNumber: doc.fromBookingNumber,
  };
  return { name: 'Saved document', size: 0, type: '', storagePath: null, savedDocument };
}

/**
 * Fills the EMPTY slots that have a reusable saved document. Never touches a slot the customer already filled
 * (an upload in progress counts as filled), and never one they chose to replace (`skip`). Pure: returns a new
 * record and how many slots it filled.
 */
export function applySavedDocuments(
  slots: Slots,
  saved: RmsSavedDocument[],
  skip: ReadonlySet<VerificationDocumentKey> = new Set(),
): { documents: Slots; filled: VerificationDocumentKey[] } {
  const documents = { ...slots };
  const filled: VerificationDocumentKey[] = [];
  for (const doc of saved) {
    const key = SLOT_FOR_KIND[doc.kind];
    if (!key || skip.has(key) || slots[key]) continue;
    const meta = savedDocumentMeta(doc);
    if (!meta) continue;
    documents[key] = meta;
    filled.push(key);
  }
  return { documents, filled };
}

/** The saved document (if any) that could fill this slot. */
export function reusableFor(key: VerificationDocumentKey, saved: RmsSavedDocument[] | null): RmsSavedDocument | null {
  const doc = saved?.find((d) => SLOT_FOR_KIND[d.kind] === key);
  return doc && savedDocumentMeta(doc) ? doc : null;
}

/** The `verificationDocuments` entries for the booking request: an upload, or a request to reuse the saved one. */
export function buildVerificationPayload(
  slots: Slots,
  required: readonly VerificationDocumentKey[],
): ({ kind: RmsVerificationDocumentKind; storagePath: string } | { kind: RmsVerificationDocumentKind; reuseSaved: true })[] {
  return required.map((key) => {
    const meta = slots[key];
    const kind = VERIFICATION_KIND_MAP[key];
    // Safe: the submit gate already required every slot to be filled one way or the other.
    return meta?.savedDocument && !meta.storagePath ? { kind, reuseSaved: true as const } : { kind, storagePath: meta!.storagePath! };
  });
}

/**
 * Empties the slots that use a saved document the RMS no longer offers for THIS booking, for example because the
 * customer went back and chose later dates, so a document that would be deleted before the rental ends is never
 * silently kept in the form. Uploads are never touched.
 */
export function dropUnusableSavedSlots(slots: Slots, saved: RmsSavedDocument[]): Slots {
  const next = { ...slots };
  for (const key of Object.keys(next) as VerificationDocumentKey[]) {
    if (next[key]?.savedDocument && !reusableFor(key, saved)) next[key] = null;
  }
  return next;
}

/** After the RMS refuses a reuse, empties exactly those slots so the customer can upload them again. */
export function clearSavedSlots(slots: Slots, kinds: readonly RmsVerificationDocumentKind[]): Slots {
  const next = { ...slots };
  for (const kind of kinds) {
    const key = SLOT_FOR_KIND[kind];
    if (key && next[key]?.savedDocument) next[key] = null;
  }
  return next;
}

const dateOnly = (iso: string) =>
  new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: BUSINESS_TIME_ZONE });

/** "Verified Oct 8, 2026 · kept until Jan 6, 2027" */
export function describeSavedDocument(info: SavedDocumentInfo): string {
  const parts: string[] = [];
  parts.push(info.verifiedAt ? `Verified ${dateOnly(info.verifiedAt)}` : `Uploaded ${dateOnly(info.uploadedAt)}`);
  parts.push(`kept until ${dateOnly(info.expiresAt)}`);
  return parts.join(' · ');
}
