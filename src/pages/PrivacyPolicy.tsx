import { usePageMeta } from '../hooks/usePageMeta';
import LegalLayout, {
  LegalContact,
  LegalList,
  LegalTable,
  SectionLink,
  Strong,
  legalLinkClass,
  type LegalSection,
} from '../components/LegalLayout';

const ADDRESS = '15 Topaz St., Emapalico Homes, Barangay Talon Uno, Las Piñas City, Metro Manila';

const DPO_EMAIL = (
  <a className={legalLinkClass} href="mailto:privacy@admin.gearbnbrental.com">privacy@admin.gearbnbrental.com</a>
);
const ADMIN_EMAIL = <a className={legalLinkClass} href="mailto:admin@gearbnbrental.com">admin@gearbnbrental.com</a>;
const PHONE = <a className={legalLinkClass} href="tel:+639765952432">+63 976 595 2432</a>;
const NPC_LINK = (
  <a className={legalLinkClass} href="https://privacy.gov.ph" target="_blank" rel="noopener noreferrer">privacy.gov.ph</a>
);

const SECTIONS: LegalSection[] = [
  {
    id: 'summary',
    title: 'Summary',
    body: (
      <>
        <p>Here are the key points. The sections below give the full detail.</p>
        <LegalList>
          <li><Strong>What we collect.</Strong> Your contact details, booking details, verification documents, payment records and messages. We also collect basic technical data when you visit our website.</li>
          <li><Strong>Why we collect the data.</Strong> We verify your identity, process your booking, confirm your payment, inspect returned gear and protect our gear from fraud and theft.</li>
          <li><Strong>Who sees the data.</Strong> Authorized GearBnB staff. Our hosting and email providers, Hostinger and Google, process some data for us. We do not sell your data.</li>
          <li><Strong>How long we keep the data.</Strong> 90 days for booking records, payment records, verification documents and website technical data. We keep tax and accounting records for the period the law requires.</li>
          <li><Strong>Your rights.</Strong> You are allowed to access, correct, block or delete your data and to withdraw your consent. Email {DPO_EMAIL}.</li>
          <li><Strong>Google sign-in.</Strong> If you sign in with Google we receive your name, email address and profile picture. We use this data only to run your GearBnB account. We do not sell the data or use the data for advertising. See <SectionLink id="google">section&nbsp;5</SectionLink>.</li>
          <li><Strong>Payments.</Strong> We do not use a payment provider. You pay by GCash or bank transfer and we record each payment by hand.</li>
        </LegalList>
      </>
    ),
  },
  {
    id: 'who',
    title: 'Who we are',
    body: (
      <>
        <p>
          GearBnB Camping Gear Rental rents camping gear in Metro Manila, Las Piñas and nearby cities. We operate
          gearbnbrental.com. We decide why and how we process your personal data. The law calls us the personal
          information controller.
        </p>
        <p>
          Our Data Protection Officer oversees how we handle personal data. The officer answers your questions and
          handles your requests.
        </p>
        <LegalContact
          rows={[
            { label: 'Business name', value: 'GearBnB Camping Gear Rental' },
            { label: 'Address', value: ADDRESS },
            { label: 'Email', value: ADMIN_EMAIL },
            { label: 'Phone', value: PHONE },
            { label: 'Data Protection Officer', value: DPO_EMAIL },
          ]}
        />
      </>
    ),
  },
  {
    id: 'scope',
    title: 'Who this policy covers',
    body: (
      <>
        <p>This policy applies to:</p>
        <LegalList>
          <li>Visitors to gearbnbrental.com.</li>
          <li>People who create an account or sign in with Google.</li>
          <li>People who book or rent gear from us.</li>
          <li>People who request an event quote.</li>
          <li>People who contact us by email, phone or social media message.</li>
        </LegalList>
        <p>When you use gearbnbrental.com you agree to the practices described in this policy. If you disagree, do not use the site.</p>
        <p>These terms have a specific meaning in this policy:</p>
        <LegalList>
          <li><Strong>Personal data</Strong> means information which identifies you or lets us identify you.</li>
          <li><Strong>Sensitive personal information</Strong> means data the law protects more strictly. Government-issued ID numbers are one example.</li>
          <li><Strong>Processing</Strong> means anything we do with data. Examples are collecting, recording, storing, using, sharing and deleting.</li>
        </LegalList>
      </>
    ),
  },
  {
    id: 'collect',
    title: 'Data we collect',
    body: (
      <>
        <p>
          We collect data in three ways. You give us some data. We create some data while we handle your booking. Your
          device sends us some data when you visit the site.
        </p>
        <p><Strong>Data you give us</Strong></p>
        <LegalList>
          <li><Strong>Account details.</Strong> The details you use to create and sign in to your account.</li>
          <li><Strong>Google sign-in data.</Strong> If you choose to sign in with Google we receive your name, email address and profile picture from Google. See <SectionLink id="google">section&nbsp;5</SectionLink>.</li>
          <li><Strong>Contact details.</Strong> Your full name, email address, mobile number and home address.</li>
          <li><Strong>Booking details.</Strong> The gear or package you choose, your rental dates, how you will collect the gear and any special requests.</li>
          <li><Strong>Rental agreement.</Strong> Your signed Rental Agreement and its booking details.</li>
          <li><Strong>Verification documents.</Strong> Two government-issued IDs, a short identification video of you holding one ID and a proof of billing. The video shows your face and voice. In the video you give a thumbs-up and state your full name.</li>
          <li><Strong>Payment records.</Strong> We do not use a payment provider or online checkout. We give you our bank and GCash details and you send your payment directly to us. We record each payment by hand. The record holds the amount, date, method and reference number.</li>
          <li><Strong>Event quote details.</Strong> Your event type, date, location, number of guests, gear needs and budget.</li>
          <li><Strong>Messages.</Strong> Emails and messages you send us. If you message us on Messenger, Facebook, Instagram or TikTok we receive your messages and the profile name the platform shows us.</li>
        </LegalList>
        <p><Strong>Data we create</Strong></p>
        <LegalList>
          <li><Strong>Condition records.</Strong> Handover and return checklists and inspection notes for the gear you rent.</li>
          <li><Strong>Booking notes.</Strong> Notes our staff record about your booking. Examples are document approval, payment confirmation and deposit settlement.</li>
        </LegalList>
        <p><Strong>Data your device sends us</Strong></p>
        <LegalList>
          <li><Strong>Technical data.</Strong> Your IP address, device type, browser, pages visited and the date and time of your visit.</li>
          <li><Strong>Cookie and storage data.</Strong> Small files and browser storage which keep the site working. See <SectionLink id="cookies">section&nbsp;12</SectionLink>.</li>
        </LegalList>
        <p>You choose what you give us. We need the contact details, booking details and verification documents to complete a rental.</p>
      </>
    ),
  },
  {
    id: 'google',
    title: 'Google Sign-In and Google user data',
    body: (
      <>
        <p>
          You are allowed to sign in to GearBnB with your Google Account. This section explains how we handle the
          Google user data we receive. This section applies together with the rest of this policy.
        </p>
        <p><Strong>What Google user data we access</Strong></p>
        <p>When you choose to sign in with Google we receive this data from Google:</p>
        <LegalList>
          <li>Your name.</li>
          <li>Your email address.</li>
          <li>Your Google profile picture.</li>
          <li>A unique identifier for your Google Account.</li>
        </LegalList>
        <p>
          Google shows you a consent screen before Google shares this data with us. We request only the basic sign-in
          scopes: openid, email and profile. We do not access your Gmail messages, contacts, calendar, Google Drive
          files or any other data in your Google Account.
        </p>
        <p><Strong>How we use Google user data</Strong></p>
        <LegalList>
          <li>Create your GearBnB account and sign you in.</li>
          <li>Match your bookings and Rental Agreements to your account.</li>
          <li>Contact you about your bookings, payments and support requests.</li>
        </LegalList>
        <p>
          We use Google user data only to provide and improve the user-facing features of GearBnB. We do not use Google
          user data for advertising, including targeted, personalized or retargeted ads. We do not sell Google user
          data. We do not give Google user data to data brokers or information resellers. We do not use Google user data
          to assess credit-worthiness or for lending. We do not use Google user data to develop, improve or train
          generalized artificial intelligence or machine learning models.
        </p>
        <p><Strong>Who we share Google user data with</Strong></p>
        <p>We do not transfer or disclose Google user data to third parties except in these cases:</p>
        <LegalList>
          <li>Service providers who host and run our website and email for us. They use the data only to give us their services.</li>
          <li>Government bodies, courts and law enforcement when the law requires.</li>
          <li>To keep our site secure or to investigate abuse.</li>
          <li>A buyer or partner when we sell or merge the business. We share the data only with your consent.</li>
        </LegalList>
        <p><Strong>How we protect Google user data</Strong></p>
        <p>
          We protect Google user data with the same measures we use for all your data. We use encrypted connections
          (HTTPS). We limit access to authorized staff with individual accounts and role-based access. We log staff
          actions in our system. See <SectionLink id="protect">section&nbsp;11</SectionLink>.
        </p>
        <p><Strong>How long we keep Google user data and how to delete the data</Strong></p>
        <p>
          We keep Google user data for as long as your GearBnB account stays open. We delete the data when you ask us to
          delete your account. Email {DPO_EMAIL}. We confirm your identity and delete the Google user data we hold. We
          tell you about any data the law requires us to keep. See <SectionLink id="delete">section&nbsp;14</SectionLink>.
        </p>
        <p>
          You are allowed to remove GearBnB's access to your Google Account at any time on your{' '}
          <a className={legalLinkClass} href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">
            Google Account permissions page
          </a>
          . Removing access stops new data from reaching us. Ask us to delete the data we already hold.
        </p>
        <p><Strong>Google API Services User Data Policy</Strong></p>
        <p>
          GearBnB's use and transfer of information received from Google APIs adheres to the{' '}
          <a className={legalLinkClass} href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </p>
      </>
    ),
  },
  {
    id: 'verify',
    title: 'Identity verification and sensitive data',
    body: (
      <>
        <p>We verify your identity before we approve a booking. This protects our gear from theft and fraud. We ask for three things:</p>
        <LegalList>
          <li>Two government-issued IDs.</li>
          <li>A short identification video of you holding one ID.</li>
          <li>A proof of billing.</li>
        </LegalList>
        <p>
          Government IDs hold sensitive personal information such as ID numbers and dates of birth. The law gives this
          data extra protection. The video shows your face and voice.
        </p>
        <p><Strong>How we use these documents</Strong></p>
        <LegalList>
          <li>Confirm who you are.</li>
          <li>Match the person in the video to the person on your IDs.</li>
          <li>Confirm your name and address match your proof of billing.</li>
          <li>Keep a record for loss, theft, damage or payment claims.</li>
        </LegalList>
        <p>We do not use these documents for advertising. We do not use these documents for any purpose outside this policy.</p>
        <p><Strong>How we protect these documents</Strong></p>
        <LegalList>
          <li>Only authorized staff who verify bookings see the documents.</li>
          <li>We log staff actions in our system.</li>
          <li>We keep the documents for 90 days after your rental ends. See <SectionLink id="keep">section&nbsp;10</SectionLink>.</li>
        </LegalList>
        <p><Strong>Your consent</Strong></p>
        <p>
          We ask for your consent before we collect these documents. You are allowed to refuse. If you refuse we are
          unable to verify your identity and we are unable to approve your booking.
        </p>
      </>
    ),
  },
  {
    id: 'use',
    title: 'How we use your data',
    body: (
      <>
        <p>We use your data only for the purposes below. Each purpose has a legal basis under the Data Privacy Act.</p>
        <LegalTable
          headers={['Purpose', 'Data we use', 'Legal basis']}
          rows={[
            ['Create and manage your account, including Google sign-in', 'Account details, contact details and Google sign-in data', 'Contract and consent'],
            ['Verify your identity and eligibility', 'Contact details and verification documents', 'Consent and legitimate interests'],
            ['Process your booking and schedule pickup and return', 'Contact and booking details', 'Contract'],
            ['Confirm your payment and settle your deposit', 'Payment records and condition records', 'Contract'],
            ['Prepare quotes for events', 'Contact and event quote details', 'Contract'],
            ['Inspect returned gear and handle damage or loss claims', 'Booking, condition and payment records', 'Contract and legitimate interests'],
            ['Send confirmations, reminders and support replies', 'Contact details and messages', 'Contract and legitimate interests'],
            ['Keep financial and tax records', 'Booking and payment records', 'Legal obligation'],
            ['Prevent fraud, theft and unpaid rentals', 'Verification documents, booking and payment records', 'Legitimate interests'],
            ['Run, secure and improve the website', 'Technical data', 'Legitimate interests'],
            ['Meet legal requests and protect our legal rights', 'Data the request or claim requires', 'Legal obligation and legitimate interests'],
          ]}
        />
        <p>
          <Strong>Contract</Strong> means we need the data to carry out your rental or to answer your request before a
          rental. <Strong>Legal obligation</Strong> means the law requires us to process the data.{' '}
          <Strong>Legitimate interests</Strong> means we have a genuine business need such as fraud prevention. This
          need does not override your rights.
        </p>
        <p>
          We process sensitive personal information only with your consent or as the law allows. By submitting your
          documents and completing a booking you consent to the collection and use of your sensitive personal
          information for the purposes above. You are allowed to withdraw your consent at any time by writing to us.
          Withdrawal does not affect processing done before you withdrew or processing the law requires. We might not
          be able to complete your rental after you withdraw.
        </p>
        <p>We ask you first before we use your data for a new purpose.</p>
      </>
    ),
  },
  {
    id: 'share',
    title: 'Who we share data with',
    body: (
      <>
        <p>
          Only authorized GearBnB staff access your records. Access depends on job role. We keep a log of staff actions
          in our system.
        </p>
        <p>We share data with these parties only as needed:</p>
        <LegalTable
          headers={['Recipient', 'Why we share', 'Data shared']}
          rows={[
            ['Authorized GearBnB staff', 'Run bookings, verify identity and inspect gear', 'Data each person needs for the job'],
            ['Hostinger', 'Website hosting and email services', 'Website data and emails'],
            ['Google', 'Gmail email service', 'Emails you send us and our replies'],
            ['Google (sign-in)', 'You choose to sign in with your Google Account', 'Google knows you signed in to GearBnB'],
            ['Government bodies, courts and law enforcement', 'Meet legal duties', 'Data the law requires'],
            ['Accountants and lawyers', 'Tax, accounting and legal advice', 'Data needed for their work'],
            ['A buyer or partner in a business sale or merger', 'Transfer the business', 'Business records'],
          ]}
        />
        <p>
          We do not use payment providers or delivery partners. GCash, your bank and Grab handle your data under their
          own privacy policies when you use their services.
        </p>
        <p>
          We do not sell your personal data. We do not share your data for third-party marketing or advertising. We
          require each provider to protect your data and use the data only for the services we ask for.
        </p>
        <p>
          We do not run website analytics today. If we start to use Google Analytics we will add Google as an analytics
          provider in this section before we begin.
        </p>
      </>
    ),
  },
  {
    id: 'transfer',
    title: 'Transfers outside the Philippines',
    body: (
      <p>
        Hostinger and Google run servers in several countries. Your data might be stored or processed outside the
        Philippines. We stay responsible for your data when a provider handles the data for us. We choose providers with
        security measures to protect your data during any transfer.
      </p>
    ),
  },
  {
    id: 'keep',
    title: 'How long we keep your data',
    body: (
      <>
        <p>We keep your data only as long as we need the data for the purposes in this policy or as the law requires.</p>
        <LegalTable
          headers={['Data', 'How long we keep the data']}
          rows={[
            ['Booking records, including your signed Rental Agreement', '90 days after your rental ends'],
            ['Payment records', '90 days after your rental ends'],
            ['Verification documents', '90 days after your rental ends'],
            ['Website technical data', '90 days after we collect the data'],
            ['Account details and Google sign-in data', 'While your account stays open. We delete the data when you ask us to delete your account'],
            ['Tax and accounting records', 'The period Philippine law requires'],
            ['Data tied to an open dispute, damage claim or legal duty', 'Until the matter ends'],
          ]}
        />
        <p>
          We keep messages only as long as we need them for the purposes above. After the retention period we delete or
          anonymize your data.
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
        <p><Strong>Organizational measures</Strong></p>
        <LegalList>
          <li>A Data Protection Officer oversees how we handle personal data.</li>
          <li>Staff see only the data their job needs.</li>
        </LegalList>
        <p><Strong>Technical measures</Strong></p>
        <LegalList>
          <li>Encrypted connections (HTTPS) on our website.</li>
          <li>Individual staff accounts with role-based access.</li>
          <li>Logs of staff actions in our system.</li>
        </LegalList>
        <p><Strong>If a breach happens</Strong></p>
        <p>
          We investigate every incident and keep a record. If a breach puts you at risk of serious harm we notify you
          and the National Privacy Commission within 72 hours after we learn of the breach, as the law requires. We take
          steps to stop a repeat.
        </p>
        <p>
          No online system is completely secure. Keep your login details private and tell us right away if you think
          someone else used your account.
        </p>
      </>
    ),
  },
  {
    id: 'cookies',
    title: 'Cookies and similar tools',
    body: (
      <>
        <p>
          Cookies are small files a website stores in your browser. Similar tools include browser storage. Our site uses
          essential cookies or similar browser storage to run features such as signing in and your cart.
        </p>
        <LegalTable
          headers={['Type', 'Purpose', 'Status']}
          rows={[
            ['Essential', 'Keep you signed in, hold your cart and keep the site secure', 'In use'],
            ['Analytics', 'Measure site traffic and show us which pages visitors use', 'Not in use today'],
            ['Advertising', 'Show you ads on other sites', 'Not in use'],
          ]}
        />
        <p>
          We plan to add Google Analytics. Before we do we will update this policy and ask for your consent where the
          law requires.
        </p>
        <p>You are allowed to block cookies in your browser settings. Essential features might not work if you block them.</p>
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
          <li><Strong>Be informed</Strong> about how we process your data. This policy gives you this information.</li>
          <li><Strong>Access</Strong> your data and receive a copy.</li>
          <li><Strong>Correct</Strong> data which is wrong or outdated.</li>
          <li><Strong>Object</Strong> to the processing of your data, including for direct marketing.</li>
          <li><Strong>Erase or block</Strong> data we hold when you withdraw consent or when the data is false, unlawfully obtained, used without authority or no longer needed.</li>
          <li><Strong>Move your data.</Strong> Receive your data in a common electronic format.</li>
          <li><Strong>Claim compensation</Strong> for damage from inaccurate, false or unlawfully obtained data or from unauthorized use of your data.</li>
          <li><Strong>File a complaint</Strong> with the National Privacy Commission at {NPC_LINK}.</li>
        </LegalList>
        <p><Strong>How to make a request</Strong></p>
        <p>
          Email {DPO_EMAIL}. Include your full name and the email address or mobile number you used for your booking.
          Tell us what you want us to do.
        </p>
        <p>We might ask you to confirm your identity first. This protects your data from people who pretend to be you.</p>
        <p>
          We aim to respond within 3 business days. Some requests take longer depending on the circumstances. We tell
          you the reason when this happens.
        </p>
        <p>
          Some rights have limits under the law. For example, we must keep records for tax purposes and legal claims. We
          tell you which data we keep and why.
        </p>
      </>
    ),
  },
  {
    id: 'delete',
    title: 'Withdraw consent and delete your data',
    body: (
      <>
        <p>
          Email {DPO_EMAIL} to withdraw your consent, close your account or ask us to delete your data. We confirm your
          identity and delete the data we hold. This includes Google user data. We tell you about any data the law
          requires us to keep.
        </p>
        <p>Deleting your verification documents means we are unable to process a new booking for you until you send new documents.</p>
      </>
    ),
  },
  {
    id: 'thirdparty',
    title: 'Other websites and platforms',
    body: (
      <p>
        Our site links to services from other companies. These include Google Sign-In, Google Maps for our pickup
        location and Messenger, Facebook, Instagram and TikTok for messages. GCash, your bank and Grab also handle data
        when you use their services. Each company controls its own data and follows its own privacy policy. Read those
        policies before you use the services.
      </p>
    ),
  },
  {
    id: 'age',
    title: 'Children',
    body: (
      <p>
        Our rental service is for people 18 or older. We do not knowingly collect data from anyone under 18. Contact us
        if you believe a minor gave us data. We verify the request and delete the data.
      </p>
    ),
  },
  {
    id: 'marketing',
    title: 'Marketing messages',
    body: (
      <p>
        We use your email address and mobile number for booking, payment and support messages. We do not send promotions
        unless you agree first. You are allowed to opt out at any time.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    body: (
      <p>
        We update this policy when our practices or the law change. The date at the top shows the latest version. We
        post a notice on our website when we make material changes. Philippine law governs this policy.
      </p>
    ),
  },
  {
    id: 'contact',
    title: 'Contact us and complaints',
    body: (
      <>
        <p>
          Send questions, requests and complaints about your personal data to our Data Protection Officer. If we do not
          resolve your concern you are allowed to file a complaint with the National Privacy Commission at {NPC_LINK}.
        </p>
        <LegalContact
          rows={[
            { label: 'Data Protection Officer', value: DPO_EMAIL },
            { label: 'Address', value: ADDRESS },
            { label: 'Email', value: ADMIN_EMAIL },
            { label: 'Phone', value: PHONE },
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
  usePageMeta('Privacy Policy | GearBnB', 'How GearBnB collects, uses, stores, shares and protects your personal data.');

  return (
    <LegalLayout
      title="Privacy Policy"
      updated="September 2026"
      lead="This policy explains how GearBnB Camping Gear Rental collects, uses, stores, shares and protects your personal data. We follow the Data Privacy Act of 2012 (Republic Act No. 10173) and its Implementing Rules and Regulations. Read this policy before you create an account, book a rental or request an event quote."
      sections={SECTIONS}
    />
  );
}
