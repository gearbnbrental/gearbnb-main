import { describe, expect, it, vi } from 'vitest';

vi.mock('../../supabase', () => ({ supabase: {} }));

const file = (name: string, type: string) => new File(['x'], name, { type });

describe('verification document type allowlist matches the verification-documents bucket', () => {
  it('accepts only the bucket-allowed image types for ID slots, rejects GIF/SVG/BMP', async () => {
    const { DOCUMENT_SLOTS, isAcceptedFileType } = await import('./VerificationUpload');
    const id = DOCUMENT_SLOTS.find((s) => s.key === 'idType1')!;
    for (const t of ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']) {
      expect(isAcceptedFileType(file('a', t), id.accept)).toBe(true);
    }
    for (const t of ['image/gif', 'image/svg+xml', 'image/bmp', 'application/pdf']) {
      expect(isAcceptedFileType(file('a', t), id.accept)).toBe(false);
    }
  });

  it('proof of billing additionally allows PDF; video slot allows mp4/webm/quicktime only', async () => {
    const { DOCUMENT_SLOTS, isAcceptedFileType } = await import('./VerificationUpload');
    const billing = DOCUMENT_SLOTS.find((s) => s.key === 'proofOfBilling')!;
    const video = DOCUMENT_SLOTS.find((s) => s.key === 'verificationVideo')!;
    expect(isAcceptedFileType(file('a', 'application/pdf'), billing.accept)).toBe(true);
    expect(isAcceptedFileType(file('a', 'image/gif'), billing.accept)).toBe(false);
    expect(isAcceptedFileType(file('a', 'video/mp4'), video.accept)).toBe(true);
    expect(isAcceptedFileType(file('a', 'video/x-msvideo'), video.accept)).toBe(false);
  });
});
