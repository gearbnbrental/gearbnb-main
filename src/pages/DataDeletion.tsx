import { Link } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta';
import { PAGE_META } from '../config/pageMeta';
import LegalLayout, { LegalContact, LegalList, LegalSteps, Strong, legalLinkClass, type LegalSection } from '../components/LegalLayout';

/**
 * User data deletion instructions. Its address is the "Data deletion instructions URL" in the
 * Facebook Login app settings (Meta requires one), and it covers Google Sign-In and email accounts
 * too. Keep it in step with the Privacy Policy's "How long we keep your data" and "Withdraw consent
 * and delete your data" sections.
 */

const DPO_EMAIL = (
  <a className={legalLinkClass} href="mailto:privacy@admin.gearbnbrental.com?subject=Delete%20my%20account">
    privacy@admin.gearbnbrental.com
  </a>
);
const PHONE = <a className={legalLinkClass} href="tel:+639765952432">+63 976 595 2432</a>;
const PrivacyLink = ({ hash = '', children }: { hash?: string; children: React.ReactNode }) => (
  <Link className={legalLinkClass} to={`/privacy-policy${hash}`}>{children}</Link>
);

const SECTIONS: LegalSection[] = [
  {
    id: 'request',
    title: 'Ask us to delete your data',
    body: (
      <>
        <LegalSteps>
          <li>Email {DPO_EMAIL} with the subject <Strong>Delete my account</Strong>.</li>
          <li>Send the email from the email address on your GearBnB account, or tell us that address.</li>
          <li>Tell us how you sign in: email and password, Google or Facebook.</li>
          <li>We might ask you to confirm your identity before we delete anything.</li>
          <li>We delete your account and your personal data and email you to confirm.</li>
        </LegalSteps>
        <p>
          You do not need a reason to ask. Deleting your account cancels access to My Bookings. We are unable to
          process a new booking for you until you create a new account and send new verification documents.
        </p>
      </>
    ),
  },
  {
    id: 'what',
    title: 'What we delete',
    body: (
      <LegalList>
        <li>Your account details and contact details.</li>
        <li>
          <Strong>Facebook Login data:</Strong> your name, email address, Facebook profile picture and Facebook account
          identifier.
        </li>
        <li>
          <Strong>Google Sign-In data:</Strong> your name, email address, Google profile picture and Google account
          identifier.
        </li>
        <li>Your verification documents and booking details.</li>
        <li>Messages and event quote requests linked to your account.</li>
      </LegalList>
    ),
  },
  {
    id: 'keep',
    title: 'What we might keep',
    body: (
      <>
        <p>The law requires us to keep some records after you ask us to delete your data:</p>
        <LegalList>
          <li>Tax and accounting records, for the period Philippine law requires.</li>
          <li>Data tied to an open dispute, damage claim or legal duty, until the matter ends.</li>
        </LegalList>
        <p>
          We keep these records secure and use them only for that purpose. See the{' '}
          <PrivacyLink hash="#keep">Privacy Policy</PrivacyLink> for how long we keep each type of data.
        </p>
      </>
    ),
  },
  {
    id: 'facebook',
    title: 'Remove GearBnB from your Facebook account',
    body: (
      <>
        <p>You are allowed to stop Facebook from sharing your data with GearBnB at any time:</p>
        <LegalSteps>
          <li>On Facebook, open <Strong>Settings &amp; privacy</Strong>, then <Strong>Settings</Strong>.</li>
          <li>
            Open{' '}
            <a className={legalLinkClass} href="https://www.facebook.com/settings?tab=business_tools" target="_blank" rel="noopener noreferrer">
              Apps and websites
            </a>
            .
          </li>
          <li>Find <Strong>GearBnB</Strong> and tap <Strong>Remove</Strong>.</li>
        </LegalSteps>
        <p>
          Removing GearBnB on Facebook stops new data from Facebook. It does not delete the data we already hold. To
          delete that data, follow the steps in <Strong>Ask us to delete your data</Strong> above.
        </p>
        <p>
          For Google, remove GearBnB on your{' '}
          <a className={legalLinkClass} href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">
            Google Account permissions page
          </a>
          .
        </p>
      </>
    ),
  },
  {
    id: 'contact',
    title: 'Contact us',
    body: (
      <>
        <p>
          Questions about deleting your data go to our Data Protection Officer. You are also allowed to complain to the
          National Privacy Commission. See the <PrivacyLink hash="#contact">Privacy Policy</PrivacyLink>.
        </p>
        <LegalContact
          rows={[
            { label: 'Data Protection Officer', value: DPO_EMAIL },
            { label: 'Phone', value: PHONE },
          ]}
        />
      </>
    ),
  },
];

export default function DataDeletion() {
  usePageMeta(PAGE_META.dataDeletion.title, PAGE_META.dataDeletion.description);

  return (
    <LegalLayout
      title="User Data Deletion"
      updated="October 2026"
      lead="How to delete your GearBnB account and the personal data we hold about you. This includes the data we receive when you sign in with Facebook or Google."
      sections={SECTIONS}
    />
  );
}
