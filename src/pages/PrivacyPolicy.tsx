import { usePageMeta } from '../hooks/usePageMeta';
import LegalLayout, { LegalContact, LegalList, Strong, legalLinkClass, type LegalSection } from '../components/LegalLayout';

const ADDRESS = '15 Topaz St., Emapalico Homes, Barangay Talon Uno, Las Piñas City, Metro Manila';

const SECTIONS: LegalSection[] = [
  {
    id: 'who',
    title: 'Who we are',
    body: (
      <>
        <p>
          GearBnB rents camping gear in Metro Manila, Las Piñas and nearby cities. GearBnB Camping Gear Rental
          operates gearbnbrental.com. We decide how your personal data is collected and used. The law calls us the
          personal information controller.
        </p>
        <p>When you use gearbnbrental.com you agree to the practices described in this policy.</p>
        <LegalContact
          rows={[
            { label: 'Business name', value: 'GearBnB Camping Gear Rental' },
            { label: 'Address', value: ADDRESS },
            { label: 'Email', value: <a className={legalLinkClass} href="mailto:admin@gearbnbrental.com">admin@gearbnbrental.com</a> },
            { label: 'Phone', value: <a className={legalLinkClass} href="tel:+639765952432">+63 976 595 2432</a> },
            {
              label: 'Data Protection Officer',
              value: <a className={legalLinkClass} href="mailto:privacy@admin.gearbnbrental.com">privacy@admin.gearbnbrental.com</a>,
            },
          ]}
        />
      </>
    ),
  },
  {
    id: 'collect',
    title: 'Data we collect',
    body: (
      <>
        <p>We collect data you give us and data your device sends us.</p>
        <LegalList>
          <li><Strong>Account details.</Strong> The details you use to create and sign in to your account.</li>
          <li><Strong>Contact details.</Strong> Your full name, email address, mobile number and home address.</li>
          <li><Strong>Booking details.</Strong> The gear or package you choose, your rental dates, how you will collect the gear and any special requests.</li>
          <li><Strong>Rental agreement.</Strong> Your signed Rental Agreement and its booking details.</li>
          <li><Strong>Verification documents.</Strong> Two government-issued IDs, a short identification video of you holding one ID and a proof of billing.</li>
          <li><Strong>Payment records.</Strong> We do not use a payment provider or online checkout. We give you our bank and GCash details and you send your payment directly to us. We record each payment by hand. The record holds the amount, date, method and reference number. GCash and your bank handle your transfer under their own privacy policies.</li>
          <li><Strong>Event quote details.</Strong> Your event type, date, location, number of guests, gear needs and budget.</li>
          <li><Strong>Condition records.</Strong> Handover and return checklists and inspection notes for the gear you rent.</li>
          <li><Strong>Messages.</Strong> Emails and messages you send us. If you message us on Messenger, Facebook, Instagram or TikTok the privacy policy of the platform also applies.</li>
          <li><Strong>Technical data.</Strong> Your IP address, device type, browser and pages visited.</li>
        </LegalList>
        <p>
          Government IDs hold sensitive personal information such as ID numbers and dates of birth. The law gives this
          data extra protection.
        </p>
      </>
    ),
  },
  {
    id: 'use',
    title: 'Why we use your data',
    body: (
      <>
        <p>We use your data to:</p>
        <LegalList>
          <li>Create and manage your account.</li>
          <li>Verify your identity and confirm you are eligible to rent.</li>
          <li>Process your booking, confirm your payment and schedule pickup and return.</li>
          <li>Prepare quotes for events.</li>
          <li>Inspect returned gear, settle your security deposit and handle damage or loss claims.</li>
          <li>Send booking confirmations, payment reminders and support replies.</li>
          <li>Keep financial and tax records.</li>
          <li>Prevent fraud, theft and unpaid rentals.</li>
          <li>Maintain and improve the website.</li>
          <li>Meet our legal duties.</li>
        </LegalList>
        <p>
          We process your personal data with your consent. We also process data when the work is necessary to carry out
          your rental contract or to meet a legal obligation. We rely on our legitimate interests, such as fraud
          prevention, when those interests do not override your rights.
        </p>
        <p>
          By submitting your documents and completing a booking you consent to the collection and use of your sensitive
          personal information for the purposes above. You are allowed to withdraw your consent at any time by writing
          to us. Withdrawal does not affect processing done before you withdrew or processing the law requires. We
          might not be able to complete your rental after you withdraw.
        </p>
      </>
    ),
  },
  {
    id: 'share',
    title: 'Who sees your data',
    body: (
      <>
        <p>
          Only authorized GearBnB staff access your records. Access depends on job role. We keep a log of staff actions
          in our system.
        </p>
        <p>We share data with these parties only as needed:</p>
        <LegalList>
          <li><Strong>Hostinger.</Strong> Hostinger hosts our website and provides email services.</li>
          <li><Strong>Google.</Strong> Google provides our Gmail service.</li>
          <li><Strong>Government bodies, courts and law enforcement.</Strong> We share data when the law requires.</li>
          <li><Strong>Advisers and business partners.</Strong> Accountants and lawyers receive data as needed for their work. A buyer or partner receives data if we sell or merge the business.</li>
        </LegalList>
        <p>
          We do not use payment providers or delivery partners. We do not run website analytics today. If we start to
          use Google Analytics we will add Google as an analytics provider in this section before we begin.
        </p>
        <p>
          We do not sell your personal data. We do not share your data for third-party marketing. We require each
          provider to protect your data and use the data only for the services we ask for.
        </p>
        <p>
          Some providers might store data on servers outside the Philippines. We take steps to protect your data during
          any transfer.
        </p>
      </>
    ),
  },
  {
    id: 'keep',
    title: 'How long we keep your data',
    body: (
      <>
        <p>We keep your data for 90 days in these cases:</p>
        <LegalList>
          <li><Strong>Booking and payment records.</Strong> 90 days after your rental ends. This includes your signed Rental Agreement.</li>
          <li><Strong>Rental agreement.</Strong> Your signed Rental Agreement and its booking details.</li>
          <li><Strong>Verification documents.</Strong> 90 days after your rental ends.</li>
          <li><Strong>Website technical data.</Strong> 90 days after we collect the data.</li>
        </LegalList>
        <p>
          We keep tax and accounting records for the period Philippine law requires. We keep other data longer only when
          an open dispute, damage claim or legal duty requires. After the retention period we delete or anonymize your
          data.
        </p>
      </>
    ),
  },
  {
    id: 'protect',
    title: 'How we protect your data',
    body: (
      <>
        <p>
          We use organizational, physical and technical measures to protect your data from loss, misuse and
          unauthorized access.
        </p>
        <LegalList>
          <li>Encrypted connections (HTTPS) on our website.</li>
          <li>Individual staff accounts with role-based access.</li>
          <li>Logs of staff actions in our system.</li>
        </LegalList>
        <p>
          If a breach puts you at risk of serious harm we will notify you and the National Privacy Commission within 72
          hours after we learn of the breach, as the law requires.
        </p>
      </>
    ),
  },
  {
    id: 'rights',
    title: 'Your rights',
    body: (
      <>
        <p>The Data Privacy Act gives you these rights:</p>
        <LegalList>
          <li><Strong>Be informed</Strong> about how we process your data.</li>
          <li><Strong>Access</Strong> your data and receive a copy.</li>
          <li><Strong>Correct</Strong> wrong or outdated data.</li>
          <li><Strong>Object</Strong> to the processing of your data, including for direct marketing.</li>
          <li><Strong>Erase or block</Strong> data we hold when you withdraw consent or when the data is unlawfully obtained or no longer needed.</li>
          <li><Strong>Move your data.</Strong> Receive your data in a common electronic format.</li>
          <li><Strong>Claim compensation</Strong> for damage from inaccurate, false or unlawfully obtained data or from unauthorized use of your data.</li>
          <li>
            <Strong>File a complaint</Strong> with the National Privacy Commission at{' '}
            <a className={legalLinkClass} href="https://privacy.gov.ph" target="_blank" rel="noopener noreferrer">privacy.gov.ph</a>.
          </li>
        </LegalList>
        <p>
          To use a right, email{' '}
          <a className={legalLinkClass} href="mailto:privacy@admin.gearbnbrental.com">privacy@admin.gearbnbrental.com</a>.
          We might ask you to confirm your identity first. We aim to respond within 3 business days. Some requests take
          longer depending on the circumstances. Some rights have limits under the law. For example, we must keep
          records for tax purposes and legal claims.
        </p>
      </>
    ),
  },
  {
    id: 'cookies',
    title: 'Cookies',
    body: (
      <>
        <p>
          Our site uses essential cookies or similar browser storage to run features such as signing in and your cart.
          We do not use analytics or advertising cookies today.
        </p>
        <p>
          We plan to add Google Analytics. Before we do we will update this policy and ask for your consent where the
          law requires. You are allowed to block cookies in your browser settings. Essential features might not work if
          you block them.
        </p>
      </>
    ),
  },
  {
    id: 'age',
    title: 'Age limit',
    body: (
      <p>
        Our rental service is for people 18 or older. We do not knowingly collect data from anyone under 18. Contact us
        if you believe a minor gave us data and we will delete the data.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    body: (
      <p>
        We update this policy when our practices or the law change. The date at the top shows the latest version. We
        post a notice on our website when we make material changes.
      </p>
    ),
  },
  {
    id: 'contact',
    title: 'Contact us',
    body: (
      <>
        <p>Send questions, requests and complaints about your personal data to our Data Protection Officer.</p>
        <LegalContact
          rows={[
            {
              label: 'Data Protection Officer',
              value: <a className={legalLinkClass} href="mailto:privacy@admin.gearbnbrental.com">privacy@admin.gearbnbrental.com</a>,
            },
            { label: 'Address', value: ADDRESS },
            { label: 'Email', value: <a className={legalLinkClass} href="mailto:admin@gearbnbrental.com">admin@gearbnbrental.com</a> },
            { label: 'Phone', value: <a className={legalLinkClass} href="tel:+639765952432">+63 976 595 2432</a> },
            {
              label: 'Facebook Messenger',
              value: <a className={legalLinkClass} href="https://m.me/1053993614458909" target="_blank" rel="noopener noreferrer">m.me/1053993614458909</a>,
            },
            { label: 'Website', value: <a className={legalLinkClass} href="https://gearbnbrental.com">gearbnbrental.com</a> },
          ]}
        />
      </>
    ),
  },
];

export default function PrivacyPolicy() {
  usePageMeta('Privacy Policy | GearBnB', 'How GearBnB collects, uses, stores and shares your personal data.');

  return (
    <LegalLayout
      title="Privacy Policy"
      updated="September 2026"
      lead="This policy explains how GearBnB Camping Gear Rental collects, uses, stores and shares your personal data. We follow the Data Privacy Act of 2012 (Republic Act No. 10173) and its Implementing Rules and Regulations. Read this policy before you create an account, book a rental or request an event quote."
      sections={SECTIONS}
    />
  );
}
