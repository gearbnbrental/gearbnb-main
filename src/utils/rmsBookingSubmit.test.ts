import { describe, expect, it } from 'vitest';
import { RmsApiError, classifyBookingSubmitError } from './rmsApi';

describe('classifyBookingSubmitError (POST /api/customer/bookings failures)', () => {
  it('treats the RMS inventory 409 (no code) as an availability conflict', () => {
    const err = new RmsApiError('The following items are no longer available for these dates: Tent. Please review your selection.', 409);
    expect(classifyBookingSubmitError(err)).toEqual({ kind: 'inventory_conflict' });
  });

  it('treats a 409 DUPLICATE_BOOKING_REQUEST as a duplicate, never as unavailable', () => {
    const err = new RmsApiError('You already have a booking request…', 409, undefined, undefined, {
      code: 'DUPLICATE_BOOKING_REQUEST',
      bookingNumber: 'GB-2026-0001-01',
    });
    expect(classifyBookingSubmitError(err)).toEqual({ kind: 'duplicate', bookingNumber: 'GB-2026-0001-01' });
  });

  it('does not report an identity-conflict 409 as unavailable — shows RMS\'s own message', () => {
    const err = new RmsApiError('This phone number is linked to another account.', 409);
    expect(classifyBookingSubmitError(err)).toEqual({ kind: 'other', message: 'This phone number is linked to another account.' });
  });

  it('passes ordinary 4xx (validation fields), 429 and 5xx through as generic errors', () => {
    expect(classifyBookingSubmitError(new RmsApiError('Validation failed', 400, { destination: ['Destination is required.'] }))).toEqual({
      kind: 'other',
      message: 'Destination is required.',
    });
    expect(classifyBookingSubmitError(new RmsApiError('Too many requests. Please try again later.', 429, undefined, 30000)).kind).toBe('other');
    expect(classifyBookingSubmitError(new RmsApiError('Booking could not be created', 500)).kind).toBe('other');
  });

  it('handles a network failure (non-RmsApiError) with the generic message', () => {
    expect(classifyBookingSubmitError(new TypeError('Failed to fetch'))).toEqual({
      kind: 'other',
      message: 'The request could not be completed. Please try again.',
    });
  });
});
