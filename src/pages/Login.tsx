import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

type Mode = 'login' | 'signup';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/';
  const { user, signUp, signIn, signOut } = useAuth();

  const [mode, setMode] = useState<Mode>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState<string | null>(null);

  function handleModeSwitch(nextMode: Mode) {
    setMode(nextMode);
    setFormError(null);
    setFormMessage(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFormMessage(null);
    setSubmitting(true);

    if (mode === 'signup') {
      const result = await signUp(email, password, fullName);
      if (result.error) {
        setFormError(result.error);
      } else if (result.needsEmailConfirmation) {
        setFormMessage(`Almost there! We sent a confirmation link to ${email}. Verify your email, then log in below.`);
        setMode('login');
        setPassword('');
      } else {
        navigate(redirectTo);
      }
    } else {
      const result = await signIn(email, password);
      if (result.error) {
        setFormError(result.error);
      } else {
        navigate(redirectTo);
      }
    }

    setSubmitting(false);
  }

  if (user) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 px-4 py-20 text-center sm:px-6">
        <h1 className="font-serif text-xl font-semibold text-ink">You're Logged In</h1>
        <p className="text-sm text-ink-muted">Signed in as {user.email}</p>
        <button
          type="button"
          onClick={signOut}
          className="rounded-lg border border-line bg-surface px-6 py-2.5 text-sm font-semibold text-ink shadow-sm transition-colors hover:bg-surface-strong"
        >
          Log Out
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6 px-4 py-16 sm:px-6">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="font-serif text-xl font-semibold text-ink">
          {mode === 'login' ? 'Log In' : 'Create an Account'}
        </h1>
        <p className="text-sm text-ink-muted">
          {mode === 'login' ? 'Welcome back to GearBNB.' : 'Sign up to track your bookings faster.'}
        </p>
      </div>

      <div className="inline-flex w-full rounded-lg border border-line bg-surface-muted p-1">
        <button
          type="button"
          onClick={() => handleModeSwitch('login')}
          aria-pressed={mode === 'login'}
          className={`flex-1 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            mode === 'login' ? 'bg-brand-forest text-white shadow-sm' : 'text-ink-muted hover:text-ink'
          }`}
        >
          Log In
        </button>
        <button
          type="button"
          onClick={() => handleModeSwitch('signup')}
          aria-pressed={mode === 'signup'}
          className={`flex-1 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            mode === 'signup' ? 'bg-brand-forest text-white shadow-sm' : 'text-ink-muted hover:text-ink'
          }`}
        >
          Sign Up
        </button>
      </div>

      {formMessage && (
        <p className="rounded-lg border border-brand-forest/30 bg-brand-forest/10 px-3 py-2 text-sm text-brand-forest">
          {formMessage}
        </p>
      )}
      {formError && (
        <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          {formError}
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {mode === 'signup' && (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">Full Name</span>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Juan Dela Cruz"
              className="rounded-lg border border-line px-3 py-2 text-sm text-ink shadow-sm outline-none transition-colors focus:border-brand-forest focus:ring-2 focus:ring-brand-forest/20"
            />
          </label>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">Email Address</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="rounded-lg border border-line px-3 py-2 text-sm text-ink shadow-sm outline-none transition-colors focus:border-brand-forest focus:ring-2 focus:ring-brand-forest/20"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">Password</span>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="rounded-lg border border-line px-3 py-2 text-sm text-ink shadow-sm outline-none transition-colors focus:border-brand-forest focus:ring-2 focus:ring-brand-forest/20"
          />
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 w-full rounded-lg bg-brand-forest px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-forest-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Please wait…' : mode === 'login' ? 'Log In' : 'Sign Up'}
        </button>
      </form>

      <p className="text-center text-xs text-ink-faint">
        Just want to look around first?{' '}
        <button type="button" onClick={() => navigate('/catalog')} className="font-medium text-brand-forest underline underline-offset-2">
          Browse the catalog
        </button>
        .
      </p>
    </div>
  );
}
