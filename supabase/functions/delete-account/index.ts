// Supabase Edge Function — permanently deletes the CALLING customer's own Supabase Auth account.
//
// This is the one place in the whole GearBNB system where the customer website's own account
// deletion needs a service-role-level operation (`auth.admin.deleteUser`) — something that must
// never run in browser code or read a Vite env var (see src/context/AuthContext.tsx's own comment
// on why). A Supabase Edge Function is the correct, smallest isolated place for it: it runs in
// Supabase's own server-side infrastructure (not this repo's build output, not the separate RMS
// project), and SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are already
// automatically available in every Edge Function's environment — nothing to configure by hand.
//
// Security model:
//   - The account to delete is resolved ONLY from the caller's own Supabase access token
//     (verified against Supabase directly with the anon key, same pattern the RMS already uses
//     for its own bearer-token verification in src/lib/customerAuth.ts). No user id is ever
//     accepted from the request body — there is no way for the browser to ask this function to
//     delete a DIFFERENT account than the one the token actually belongs to.
//   - The service-role key is used for exactly one call (`auth.admin.deleteUser`) and never
//     returned to the caller, logged, or exposed in any response.
//   - Deleting the Supabase Auth user does NOT touch the RMS's own `Customer`/`Booking`/payment
//     records: `Customer.authUserId` in the RMS's Prisma schema is a plain, nullable, unique
//     string column — not a foreign key into Supabase's `auth` schema — so it simply becomes a
//     dangling reference. All business/accounting records are preserved untouched. (Confirmed by
//     reading the RMS's prisma/schema.prisma; that project itself was not modified for this.)
//
// Deployment (not done by this change — see the final report): from a machine with the Supabase
// CLI linked to this project, run `supabase functions deploy delete-account`. No secrets need to
// be set manually for this function.

// @ts-nocheck — this file runs on Supabase's Deno Edge Runtime, not in this Vite/Node project; it
// is never imported by src/ and never bundled into the browser build. `Deno` and the remote
// `esm.sh` import below are only resolvable in that runtime, not by this repo's own TypeScript
// project (hence no type errors are expected to be caught by `tsc` here).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return jsonResponse({ error: 'Not authenticated' }, 401);
  }
  const token = match[1];

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error('[delete-account] Supabase environment is not configured');
    return jsonResponse({ error: 'Not configured' }, 500);
  }

  // Verifies the token directly against Supabase — never trusts a claim the browser makes about
  // who it is. This is the ONLY source of "which account to delete."
  const callerClient = createClient(supabaseUrl, anonKey);
  const {
    data: { user },
    error: authError,
  } = await callerClient.auth.getUser(token);
  if (authError || !user) {
    return jsonResponse({ error: 'Not authenticated' }, 401);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error('[delete-account] deletion failed', deleteError.message);
    return jsonResponse({ error: 'Account deletion failed' }, 500);
  }

  return jsonResponse({ success: true }, 200);
});
