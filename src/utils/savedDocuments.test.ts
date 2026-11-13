import { describe, expect, it } from 'vitest';
import {
  applySavedDocuments,
  buildVerificationPayload,
  clearSavedSlots,
  describeSavedDocument,
  dropUnusableSavedSlots,
  isSlotFilled,
  reusableFor,
  savedDocumentMeta,
} from './savedDocuments';
import { classifyBookingSubmitError, RmsApiError, type RmsSavedDocument } from './rmsApi';
import type { VerificationDocumentKey, VerificationFileMeta } from '../types/gearbnb';

const KEYS: VerificationDocumentKey[] = ['idType1', 'idType2', 'verificationVideo', 'proofOfBilling'];
const empty = (): Record<VerificationDocumentKey, VerificationFileMeta | null> => ({ idType1: null, idType2: null, verificationVideo: null, proofOfBilling: null });
const upload = (name: string): VerificationFileMeta => ({ name, size: 10, type: 'image/jpeg', storagePath: `u1/${name}` });

const available = (kind: RmsSavedDocument['kind']): RmsSavedDocument => ({
  kind, state: 'AVAILABLE', uploadedAt: '2026-10-01T00:00:00.000Z', verifiedAt: '2026-10-02T00:00:00.000Z', expiresAt: '2026-12-30T00:00:00.000Z', fromBookingNumber: 'GB-2026-1001-01',
});
const none = (kind: RmsSavedDocument['kind']): RmsSavedDocument => ({ kind, state: 'NONE', uploadedAt: null, verifiedAt: null, expiresAt: null, fromBookingNumber: null });
const allAvailable = [available('GOV_ID_1'), available('GOV_ID_2'), available('VERIFICATION_VIDEO'), available('PROOF_OF_BILLING')];

describe('isSlotFilled', () => {
  it('is true for a finished upload or a saved document, false for empty or an upload still in flight', () => {
    expect(isSlotFilled(upload('a.jpg'))).toBe(true);
    expect(isSlotFilled(savedDocumentMeta(available('GOV_ID_1')))).toBe(true);
    expect(isSlotFilled(null)).toBe(false);
    expect(isSlotFilled({ name: 'a.jpg', size: 1, type: 'image/jpeg', storagePath: null })).toBe(false);
  });
});

describe('savedDocumentMeta', () => {
  it('only an AVAILABLE document becomes a slot, and it carries dates, never a file', () => {
    const meta = savedDocumentMeta(available('GOV_ID_1'))!;
    expect(meta.storagePath).toBeNull();
    expect(meta.savedDocument?.fromBookingNumber).toBe('GB-2026-1001-01');
    expect(savedDocumentMeta(none('GOV_ID_1'))).toBeNull();
    expect(savedDocumentMeta({ ...available('GOV_ID_1'), state: 'EXPIRING' })).toBeNull();
    expect(savedDocumentMeta({ ...available('GOV_ID_1'), state: 'NOT_VERIFIED' })).toBeNull();
  });
});

describe('applySavedDocuments', () => {
  it('fills every empty slot that has a saved document', () => {
    const { documents, filled } = applySavedDocuments(empty(), allAvailable);
    expect(filled).toEqual(KEYS);
    expect(KEYS.every((k) => documents[k]?.savedDocument)).toBe(true);
  });

  it('never overwrites a slot the customer already filled, even with an upload in progress', () => {
    const slots = { ...empty(), idType1: upload('mine.jpg'), idType2: { name: 'b.jpg', size: 1, type: 'image/jpeg', storagePath: null } };
    const { documents, filled } = applySavedDocuments(slots, allAvailable);
    expect(documents.idType1?.storagePath).toBe('u1/mine.jpg');
    expect(documents.idType2?.storagePath).toBeNull();
    expect(documents.idType2?.savedDocument).toBeUndefined();
    expect(filled).toEqual(['verificationVideo', 'proofOfBilling']);
  });

  it('skips slots the customer chose to replace', () => {
    const { filled } = applySavedDocuments(empty(), allAvailable, new Set<VerificationDocumentKey>(['idType2']));
    expect(filled).toEqual(['idType1', 'verificationVideo', 'proofOfBilling']);
  });

  it('only fills what is reusable: a customer with some documents saved still uploads the rest', () => {
    const { documents, filled } = applySavedDocuments(empty(), [available('GOV_ID_1'), none('GOV_ID_2'), none('VERIFICATION_VIDEO'), none('PROOF_OF_BILLING')]);
    expect(filled).toEqual(['idType1']);
    expect(documents.idType2).toBeNull();
  });

  it('does not change the record it was given', () => {
    const slots = empty();
    applySavedDocuments(slots, allAvailable);
    expect(KEYS.every((k) => slots[k] === null)).toBe(true);
  });
});

describe('reusableFor', () => {
  it('finds the saved document for a slot only when it can be reused', () => {
    expect(reusableFor('idType1', allAvailable)?.kind).toBe('GOV_ID_1');
    expect(reusableFor('idType1', [none('GOV_ID_1')])).toBeNull();
    expect(reusableFor('idType1', null)).toBeNull();
  });
});

describe('buildVerificationPayload', () => {
  it('sends an upload as its path and a saved document as a reuse request', () => {
    const slots = { ...empty(), idType1: savedDocumentMeta(available('GOV_ID_1')), idType2: upload('b.jpg'), verificationVideo: upload('v.mp4'), proofOfBilling: savedDocumentMeta(available('PROOF_OF_BILLING')) };
    expect(buildVerificationPayload(slots, KEYS)).toEqual([
      { kind: 'GOV_ID_1', reuseSaved: true },
      { kind: 'GOV_ID_2', storagePath: 'u1/b.jpg' },
      { kind: 'VERIFICATION_VIDEO', storagePath: 'u1/v.mp4' },
      { kind: 'PROOF_OF_BILLING', reuseSaved: true },
    ]);
  });
  it('four uploads send exactly what the site always sent (no reuse flag anywhere)', () => {
    const slots = { idType1: upload('1'), idType2: upload('2'), verificationVideo: upload('3'), proofOfBilling: upload('4') };
    const payload = buildVerificationPayload(slots, KEYS);
    expect(payload.every((d) => 'storagePath' in d && !('reuseSaved' in d))).toBe(true);
  });
});

describe('clearSavedSlots', () => {
  it('empties only the saved slots the RMS refused, leaving uploads and other saved slots alone', () => {
    const slots = { ...empty(), idType1: savedDocumentMeta(available('GOV_ID_1')), idType2: upload('b.jpg'), proofOfBilling: savedDocumentMeta(available('PROOF_OF_BILLING')) };
    const next = clearSavedSlots(slots, ['GOV_ID_1', 'GOV_ID_2']);
    expect(next.idType1).toBeNull();
    expect(next.idType2?.storagePath).toBe('u1/b.jpg'); // an upload is never cleared by a refused reuse
    expect(next.proofOfBilling?.savedDocument).toBeTruthy();
  });
});

describe('describeSavedDocument', () => {
  it('says when it was verified and until when it is kept', () => {
    const text = describeSavedDocument(savedDocumentMeta(available('GOV_ID_1'))!.savedDocument!);
    expect(text).toBe('Verified Oct 2, 2026 · kept until Dec 30, 2026');
  });
  it('falls back to the upload date when there is no verification date', () => {
    const info = { ...savedDocumentMeta(available('GOV_ID_1'))!.savedDocument!, verifiedAt: null };
    expect(describeSavedDocument(info)).toBe('Uploaded Oct 1, 2026 · kept until Dec 30, 2026');
  });
});

describe('classifyBookingSubmitError: a saved document that can no longer be used', () => {
  it('reports exactly which kinds to upload again', () => {
    const err = new RmsApiError('One or more saved documents can no longer be used.', 409, undefined, undefined, { code: 'SAVED_DOCUMENT_UNAVAILABLE', kinds: ['GOV_ID_2', 'NOT_A_KIND'] });
    expect(classifyBookingSubmitError(err)).toEqual({ kind: 'saved_document_unavailable', kinds: ['GOV_ID_2'] });
  });
  it('does not disturb the existing 409 meanings', () => {
    expect(classifyBookingSubmitError(new RmsApiError('x', 409, undefined, undefined, { code: 'DUPLICATE_BOOKING_REQUEST', bookingNumber: 'GB-1' }))).toEqual({ kind: 'duplicate', bookingNumber: 'GB-1' });
    expect(classifyBookingSubmitError(new RmsApiError('The following items are no longer available', 409)).kind).toBe('inventory_conflict');
  });
});

describe('dropUnusableSavedSlots', () => {
  it('empties a saved slot the RMS no longer offers for these dates, and keeps the ones it still offers', () => {
    const slots = { ...empty(), idType1: savedDocumentMeta(available('GOV_ID_1')), idType2: savedDocumentMeta(available('GOV_ID_2')) };
    const offered: RmsSavedDocument[] = [available('GOV_ID_1'), { ...available('GOV_ID_2'), state: 'EXPIRING' }];
    const next = dropUnusableSavedSlots(slots, offered);
    expect(next.idType1?.savedDocument).toBeTruthy();
    expect(next.idType2).toBeNull();
  });
  it('never touches an upload, even if nothing is offered', () => {
    const slots = { ...empty(), idType1: upload('mine.jpg') };
    expect(dropUnusableSavedSlots(slots, []).idType1?.storagePath).toBe('u1/mine.jpg');
  });
  it('leaves empty slots empty', () => {
    expect(dropUnusableSavedSlots(empty(), allAvailable)).toEqual(empty());
  });
});

