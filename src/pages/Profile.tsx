import { useState } from 'react';
import AuthRequiredMessage from '../components/AuthRequiredMessage';
import ConfirmDialog from '../components/ConfirmDialog';
import PasswordInput from '../components/PasswordInput';
import PhoneNumberInput from '../components/PhoneNumberInput';
import { useAuth } from '../context/AuthContext';
import { isPasswordValid, MIN_PASSWORD_LENGTH } from '../utils/passwordPolicy';
import { isValidPhoneNumber, normalizePhoneNumber } from '../utils/phone';

const INPUT_CLASS =
  'h-11 rounded-lg border border-line px-3 text-sm text-ink shadow-sm outline-none transition-colors focus:border-brand-forest focus:ring-2 focus:ring-brand-forest/20';

const SUCCESS_BANNER_CLASS =
  'rounded-lg border border-brand-forest/30 bg-brand-forest/10 px-3 py-2 text-sm text-accent';
const ERROR_BANNER_CLASS =
  'rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400';

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">{title}</h2>
      {children}
    </section>
  );
}

/** Strips a stored +63 E.164 phone down to the local digits PhoneNumberInput expects to display
 *  (it already shows its own "+63" prefix) — GearBnB is Philippines-only, so every stored phone is
 *  expected to already be in this form; a value that isn't (e.g. old data) is shown as-is rather
 *  than mangled. */
function localPhoneDigits(e164: string): string {
  return e164.startsWith('+63') ? e164.slice(3) : e164;
}

export default function Profile() {
  const { user, loading: authLoading } = useAuth();

  if (authLoading) return null;
  if (!user) {
    return (
      <AuthRequiredMessage redirectPath="/profile" message="Please log in or create an account to view your profile." />
    );
  }

  return <ProfileContent />;
}

/** Split from Profile so every hook below only ever runs once `user` is guaranteed non-null —
 *  Profile's own early returns above happen before any of these hooks would be declared. */
function ProfileContent() {
  const { user, signOut, updateProfile, changePassword } = useAuth();

  // Non-null by the time this component ever renders — see Profile's own guard above.
  const currentUser = user!;
  const storedFullName = typeof currentUser.user_metadata?.full_name === 'string' ? currentUser.user_metadata.full_name : '';
  const storedPhone = typeof currentUser.user_metadata?.phone === 'string' ? currentUser.user_metadata.phone : '';
  // A Google-only account (signed up/in exclusively via OAuth) has no 'email' entry in its own
  // identities — there is no password to reauthenticate with or change. Checking this directly off
  // Supabase's own identities array (rather than assuming every account has a password) is what
  // keeps the Change Password section from offering a "current password" field that can't possibly
  // be correct for that customer, per this task's explicit "do not break Google Sign-In accounts"
  // requirement.
  const hasPasswordAuth = (currentUser.identities ?? []).some((identity) => identity.provider === 'email');

  const [fullName, setFullName] = useState(storedFullName);
  const [phone, setPhone] = useState(localPhoneDigits(storedPhone));
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  async function handleProfileSave() {
    setProfileError(null);
    setProfileSuccess(null);
    if (!fullName.trim()) {
      setProfileError('Enter your full name.');
      return;
    }
    if (!isValidPhoneNumber(phone)) {
      setProfileError('Enter a valid Philippine mobile number.');
      return;
    }
    setProfileSubmitting(true);
    const result = await updateProfile(fullName.trim(), normalizePhoneNumber(phone)!);
    setProfileSubmitting(false);
    if (result.error) {
      setProfileError(result.error);
      return;
    }
    setProfileSuccess('Your profile has been updated.');
  }

  async function handlePasswordSave() {
    setPasswordError(null);
    setPasswordSuccess(null);
    if (!currentPassword) {
      setPasswordError('Enter your current password.');
      return;
    }
    if (!isPasswordValid(newPassword)) {
      setPasswordError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }
    setPasswordSubmitting(true);
    const result = await changePassword(currentPassword, newPassword);
    setPasswordSubmitting(false);
    if (result.error) {
      setPasswordError(result.error);
      return;
    }
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setPasswordSuccess('Your password has been changed.');
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 py-10 sm:px-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-serif text-xl font-semibold text-ink">Profile</h1>
        <p className="text-sm text-ink-muted">Manage your account information and security.</p>
      </div>

      <SectionCard title="Your Information">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">Full Name</span>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Juan Dela Cruz"
            className={INPUT_CLASS}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">Email Address</span>
          <input type="email" value={currentUser.email ?? ''} disabled readOnly className={`${INPUT_CLASS} cursor-not-allowed opacity-60`} />
          <span className="text-xs text-ink-faint">Email can't be changed here — contact us if you need help with this.</span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">Mobile Number</span>
          <PhoneNumberInput value={phone} onChange={setPhone} autoComplete="tel" />
        </label>

        {profileSuccess && <p className={SUCCESS_BANNER_CLASS}>{profileSuccess}</p>}
        {profileError && <p className={ERROR_BANNER_CLASS}>{profileError}</p>}

        <button
          type="button"
          onClick={handleProfileSave}
          disabled={profileSubmitting}
          className="h-11 w-full rounded-lg bg-brand-forest px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-forest-dark disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:self-start sm:px-6"
        >
          {profileSubmitting ? 'Saving…' : 'Save Changes'}
        </button>
      </SectionCard>

      <SectionCard title="Change Password">
        {hasPasswordAuth ? (
          <>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink">Current Password</span>
              <PasswordInput value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink">New Password</span>
              <PasswordInput
                value={newPassword}
                onChange={setNewPassword}
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink">Confirm New Password</span>
              <PasswordInput
                value={confirmNewPassword}
                onChange={setConfirmNewPassword}
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
              />
            </label>

            {passwordSuccess && <p className={SUCCESS_BANNER_CLASS}>{passwordSuccess}</p>}
            {passwordError && <p className={ERROR_BANNER_CLASS}>{passwordError}</p>}

            <button
              type="button"
              onClick={handlePasswordSave}
              disabled={passwordSubmitting}
              className="h-11 w-full rounded-lg bg-brand-forest px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-forest-dark disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:self-start sm:px-6"
            >
              {passwordSubmitting ? 'Updating…' : 'Change Password'}
            </button>
          </>
        ) : (
          <p className="text-sm text-ink-muted">
            Your account signs in with Google — there's no GearBnB password to change here. Manage your sign-in
            through your Google Account instead.
          </p>
        )}
      </SectionCard>

      <SectionCard title="Account">
        <button
          type="button"
          onClick={() => setShowLogoutConfirm(true)}
          className="h-11 w-full rounded-lg border border-line bg-surface px-4 text-sm font-semibold text-ink shadow-sm transition-colors hover:bg-surface-strong sm:w-auto sm:self-start sm:px-6"
        >
          Log Out
        </button>
      </SectionCard>

      <ConfirmDialog
        open={showLogoutConfirm}
        title="Log out of your account?"
        message="You will need to sign in again to access your account."
        confirmLabel="Log Out"
        destructive
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={async () => {
          await signOut();
          setShowLogoutConfirm(false);
        }}
      />
    </div>
  );
}
