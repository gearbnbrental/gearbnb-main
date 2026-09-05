import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../supabase';

interface AuthResult {
  error: string | null;
  /** True when signUp succeeded but the account needs email confirmation before it can log in. */
  needsEmailConfirmation?: boolean;
}

interface AuthContextValue {
  user: User | null;
  /** First name from metadata, falling back to the email's local part, then "Account". */
  displayName: string;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getDisplayName(user: User | null): string {
  if (!user) return 'Account';

  const firstName = user.user_metadata?.first_name;
  if (typeof firstName === 'string' && firstName.trim() !== '') {
    return capitalize(firstName.trim());
  }

  // Our own signup form only collects one "Full Name" field, stored as full_name.
  const fullName = user.user_metadata?.full_name;
  if (typeof fullName === 'string' && fullName.trim() !== '') {
    return capitalize(fullName.trim().split(/\s+/)[0]);
  }

  const emailLocalPart = user.email?.split('@')[0];
  if (emailLocalPart) {
    return capitalize(emailLocalPart);
  }

  return 'Account';
}

/** Maps raw Supabase Auth error text to a customer-friendly message. */
function friendlyAuthError(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes('invalid login credentials')) {
    return 'Incorrect email or password.';
  }
  if (normalized.includes('email not confirmed')) {
    return 'Please confirm your email before logging in — check your inbox for the confirmation link.';
  }
  if (normalized.includes('already registered') || normalized.includes('already exists')) {
    return 'An account with this email already exists. Try logging in instead.';
  }
  return message;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signUp(email: string, password: string, fullName: string): Promise<AuthResult> {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    if (error) return { error: friendlyAuthError(error.message) };

    // Supabase returns an empty identities array (instead of a distinct error) when the email
    // is already registered — a deliberate anti-enumeration behavior on newer projects.
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      return { error: 'An account with this email already exists. Try logging in instead.' };
    }

    // Email confirmation enabled: signUp succeeds but no session is issued until confirmed.
    if (data.user && !data.session) {
      return { error: null, needsEmailConfirmation: true };
    }

    return { error: null };
  }

  async function signIn(email: string, password: string): Promise<AuthResult> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: friendlyAuthError(error.message) };
    return { error: null };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  const user = session?.user ?? null;
  const value: AuthContextValue = {
    user,
    displayName: getDisplayName(user),
    loading,
    signUp,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
