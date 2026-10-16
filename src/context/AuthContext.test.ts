import { describe, expect, it, vi } from 'vitest';

// AuthContext imports the Supabase client, which needs env vars; the error mapping doesn't.
vi.mock('../supabase', () => ({ supabase: {} }));

const { friendlyAuthError } = await import('./AuthContext');

describe('friendlyAuthError: social sign-in', () => {
  it('explains a Facebook account that shares no email', () => {
    expect(friendlyAuthError('Error getting user email from external provider')).toMatch(/Facebook account doesn't share an email/);
  });

  it('explains a sign-in provider that is not switched on yet', () => {
    expect(friendlyAuthError('Unsupported provider: provider is not enabled')).toMatch(/isn't available right now/);
  });

  it('keeps the existing wrong-password message', () => {
    expect(friendlyAuthError('Invalid login credentials')).toBe('Incorrect email or password.');
  });
});
