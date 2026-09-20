import { Link } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta';
import LegalLayout, {
  LegalContact,
  LegalList,
  LegalSteps,
  Strong,
  legalLinkClass,
  type LegalSection,
} from '../components/LegalLayout';

const MAPS_URL =
  'https://www.google.com/maps/place/GearBnB+Camping+Gears+Rental/@14.4461804,120.9966593,17z/data=!4m6!3m5!1s0x3397d3090cbbd26f:0x665f11a5d4c66dde!8m2!3d14.4461908!4d120.9966593!16s%2Fg%2F11z8h467l7?entry=ttu';

/** In-page jump to another section of this same document. */
function SectionRef({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <a
      className={legalLinkClass}
      href={`#${id}`}
      onClick={(event) => {
        event.preventDefault();
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.history.replaceState(null, '', `#${id}`);
      }}
    >
      {children}
    </a>
  );
}

const RentalTermsLink = () => (
  <Link className={legalLinkClass} to="/terms">Rental Terms</Link>
);
const DepositRefundsLink = () => (
  <Link className={legalLinkClass} to="/terms#deposit">Deposit and Refunds</Link>
);

const SECTIONS: LegalSection[] = [
  {
    id: 'offer',
    title: 'What GearBnB offers',
    body: (
      <>
        <p>
          In these Terms, GearBnB, we, us and our mean GearBnB Camping Gear Rental, the operator of gearbnbrental.com.
          You means the person using the site or renting gear.
        </p>
        <p>GearBnB rents camping gear. The site gives you two paths:</p>
        <LegalList>
          <li><Strong>Rent Your Gears.</Strong> Choose a package or build your own kit.</li>
          <li><Strong>Plan An Event.</Strong> Send a quote request for a custom event setup.</li>
        </LegalList>
        <p>
          These Terms cover rentals of gear owned by GearBnB. We serve Metro Manila, Las Piñas and nearby cities.
        </p>
      </>
    ),
  },
  {
    id: 'eligibility',
    title: 'Who is eligible',
    body: (
      <>
        <p>To rent from us you must:</p>
        <LegalList>
          <li>Be 18 or older and have legal capacity to enter a contract.</li>
          <li>Give the documents listed in <SectionRef id="documents">section&nbsp;3</SectionRef>.</li>
          <li>Give true, complete and current information.</li>
          <li>Keep your login details private if you create an account. You are responsible for activity under your account.</li>
        </LegalList>
      </>
    ),
  },
  {
    id: 'documents',
    title: 'Required documents',
    body: (
      <>
        <p>Every booking needs these documents:</p>
        <LegalList>
          <li>Two valid government-issued IDs.</li>
          <li>A short identification video of you holding one of the IDs, giving a thumbs-up and stating your full name.</li>
          <li>A proof of billing.</li>
        </LegalList>
        <p>
          We verify your documents before we approve a booking. We might reject a booking when documents are unclear,
          incomplete, expired or do not match. We handle your documents under our{' '}
          <Link className={legalLinkClass} to="/privacy-policy">Privacy Policy</Link>.
        </p>
      </>
    ),
  },
  {
    id: 'booking',
    title: 'How booking works',
    body: (
      <>
        <LegalSteps>
          <li>Choose a package or build your own kit.</li>
          <li>Send your trip dates, how you will collect the gear and your verification documents.</li>
          <li>We review your documents and approve or reject your request.</li>
          <li>Pay the security deposit after we approve your request.</li>
          <li>We confirm your payment and lock your dates.</li>
          <li>Pay the rental fee before your rental start date.</li>
        </LegalSteps>
        <p>
          Your booking is confirmed only when we send you a confirmation. We might reject a request or ask you to fix a
          problem.
        </p>
        <p>
          Gear is available on a first confirmed, first served basis. If gear becomes unavailable after we confirm your
          booking we will offer equal gear, a new date or a full refund.
        </p>
      </>
    ),
  },
  {
    id: 'payments',
    title: 'Prices and payments',
    body: (
      <LegalList>
        <li>All prices are in Philippine pesos (PHP). We will add VAT once we complete our BIR registration.</li>
        <li>The rental fee depends on the gear and the length of your rental. Rates change by rental duration and we list the rates per item.</li>
        <li>Your payment has two parts. The security deposit is due after we approve your request. The rental fee total is due before your rental start date.</li>
        <li>We accept GCash and bank transfer. We give you our bank and GCash details and we confirm each payment by hand.</li>
        <li>If we do not receive your rental fee before the start date we might cancel your booking and release your dates. We keep your security deposit unless your cancellation qualifies for a refund under <SectionRef id="cancel">section&nbsp;10</SectionRef>.</li>
      </LegalList>
    ),
  },
  {
    id: 'deposit',
    title: 'Security deposit and refunds',
    body: (
      <LegalList>
        <li>The deposit is a fixed amount per package. We show the amount when you book. The amount stays the same regardless of rental length.</li>
        <li>If you rent more than one package the deposits add up.</li>
        <li>The deposit for a Build Your Own kit varies with the amount you rent. We show the deposit amount when you book.</li>
        <li>We refund the deposit in full when you return all gear on time and in the same condition as at handover, apart from normal wear.</li>
        <li>We inspect the gear when you return the gear. We settle your deposit after the inspection. We refund within 24 to 48 hours through GCash or bank transfer.</li>
        <li>We deduct from the deposit for damage, missing items or parts, extra cleaning and late fees. We show you each deduction with our inspection notes.</li>
        <li>If costs exceed your deposit you pay the difference within 3 days after we notify you.</li>
        <li>A late return costs you the deposit. See <SectionRef id="handover">section&nbsp;7</SectionRef>.</li>
        <li>We keep the deposit when a cancellation does not qualify for a refund. See <SectionRef id="cancel">section&nbsp;10</SectionRef>.</li>
      </LegalList>
    ),
  },
  {
    id: 'handover',
    title: 'Pickup and return',
    body: (
      <LegalList>
        <li>
          Collect your gear at our{' '}
          <a className={legalLinkClass} href={MAPS_URL} target="_blank" rel="noopener noreferrer">location</a> on your
          start date, in person or through your own Grab.
        </li>
        <li>Choose self pickup or Grab delivery. You book and pay for your own Grab. GearBnB does not charge or arrange delivery. We do not allow Lalamove. Confirm your pickup or delivery arrangements with us at least 24 hours before your start date.</li>
        <li>At handover we complete a condition checklist with you. Check the checklist and report any issue before you leave. The checklist is the record of the gear condition at handover. We assume any issue you do not report at receipt happened during the rental period.</li>
        <li>Return all gear and accessories on your end date at the same time of day you picked up the gear. Return the gear clean and dry.</li>
        <li>A late return costs you your full security deposit plus a late fee of 50% of the package fee for each day you are late. If you expect to be late, tell us as early as possible.</li>
        <li>An early return does not qualify for a partial refund unless we agreed in writing beforehand.</li>
        <li>We complete a return inspection and record the condition of each item.</li>
      </LegalList>
    ),
  },
  {
    id: 'care',
    title: 'Care and use of gear',
    body: (
      <LegalList>
        <li>Use the gear for camping and outdoor recreation as intended. Follow the gear instructions.</li>
        <li>Do not sublet, lend, transfer, sell, pledge or modify the gear without our prior written consent. Commercial or large-scale use is not allowed.</li>
        <li>Return the gear in the same good condition as you received it, with all accessories, pegs, ropes, poles and parts. Deflate and pack inflatable beds carefully.</li>
        <li>Do not leave tents, inflatable beds or fans in extreme weather or prolonged direct sunlight longer than needed. Sweep your campsite before you leave so no pegs, ropes or small parts stay behind.</li>
        <li>Keep tents and other fabric gear away from open flames and heat sources.</li>
        <li>Do not repair the gear yourself. Tell us about any damage right away.</li>
      </LegalList>
    ),
  },
  {
    id: 'damage',
    title: 'Loss and damage',
    body: (
      <>
        <LegalList>
          <li>You are responsible for the gear from handover until we complete the return inspection.</li>
          <li>We do not charge for normal wear and tear such as small dirt marks, sand or dust, light creasing on inflatable beds and minor scuffs from reasonable use.</li>
          <li>We charge for excessive dirt that needs deep cleaning, mud, burn marks, food or drink stains, strong odors, damage from improper packing, tears, broken parts and water damage from improper drying.</li>
          <li>A lost tent peg costs ₱20 per piece. A lost guy rope or tent rope costs ₱10 per piece. A standard cleaning fee is ₱150 for items returned excessively dirty. We deduct these from your security deposit.</li>
          <li>For other lost, missing or broken items we charge the current retail replacement value or the actual repair cost, whichever applies, and deduct it from your security deposit.</li>
          <li>We tell you about any damage, loss or cleaning charge within 24 hours of your return.</li>
          <li>Report theft to the police and send us a copy of the report.</li>
          <li>We assess damage in good faith and show you the evidence.</li>
        </LegalList>
        <p>
          Read the full <RentalTermsLink /> and the <DepositRefundsLink /> section for how we handle loss and damage.
        </p>
      </>
    ),
  },
  {
    id: 'cancel',
    title: 'Cancellations, changes and weather',
    body: (
      <LegalList>
        <li><Strong>Cancellations.</Strong> Cancel 7 or more days before your rental start date and we refund your security deposit in full within 24 to 48 hours through GCash or bank transfer. Cancel 3 to 6 days before, or fewer than 3 days before, and we do not refund the deposit, but you can reschedule your booking.</li>
        <li>
          <Strong>Changes.</Strong> Message us as early as possible when you need to change your dates.
        </li>
        <li>
          <Strong>Weather and events beyond your control.</Strong> We offer a free reschedule or a full refund when
          sudden weather changes on the camping day, a typhoon, earthquake, flood or landslide, a government travel
          restriction or lockdown, or an official road closure or evacuation order stops your trip. We do not offer
          this when you go ahead despite storm or typhoon warnings, ignore an evacuation notice, or handle or secure
          the gear badly when warnings were available. Tell us as soon as you can. We might ask for photo or video
          evidence and we decide in good faith whether an event qualifies. Read the <RentalTermsLink /> and the{' '}
          <DepositRefundsLink /> section for details.
        </li>
        <li><Strong>Cancellation by GearBnB.</Strong> We might cancel a booking when gear is unavailable or a safety concern exists. If we cancel we refund all payments you made for the booking.</li>
      </LegalList>
    ),
  },
  {
    id: 'events',
    title: 'Event quote requests',
    body: (
      <LegalList>
        <li>A quote request is not a booking. We review your request and send you a quote.</li>
        <li>Each quote states the price, gear, dates and payment terms. A quote is valid for 7 days only.</li>
        <li>You accept a quote in writing and pay as the quote states. We then convert your request into a custom booking.</li>
        <li>
          Sections <SectionRef id="deposit">6</SectionRef> to <SectionRef id="damage">9</SectionRef> apply to custom
          bookings unless the quote says otherwise.
        </li>
      </LegalList>
    ),
  },
  {
    id: 'safety',
    title: 'Safety and risk',
    body: (
      <p>
        Camping involves risk. Weather, terrain, wildlife, fire and injury are real risks. You choose where and how you
        camp. You are responsible for your own safety and the safety of your group. Read the gear instructions before
        use. Stop using damaged or unsafe gear and tell us. To the extent the law allows, GearBnB is not liable for injury,
        accident, property damage or loss during your use of the gear. Nothing in this section removes your rights
        under Philippine law.
      </p>
    ),
  },
  {
    id: 'website',
    title: 'Using the website',
    body: (
      <>
        <LegalList>
          <li>Do not hack, scrape or overload the site.</li>
          <li>Do not use bots or automated tools to make bookings.</li>
          <li>Do not give false information or fake documents.</li>
          <li>We might suspend access for anyone who breaks these rules.</li>
        </LegalList>
        <p>
          The logos, text, images and design on the site belong to GearBnB or its licensors. Use them only to book and
          manage your rental.
        </p>
      </>
    ),
  },
  {
    id: 'liability',
    title: 'Our liability',
    body: (
      <>
        <p>
          We provide gear in working condition and we maintain the gear with care. To the extent the law allows,
          GearBnB is not liable for indirect or consequential loss or for loss from events beyond our control. Our
          total liability for a claim about a rental will not exceed the amount you paid for the rental in question.
        </p>
        <p>
          Nothing in these Terms excludes liability for fraud or gross negligence. Nothing in these Terms excludes
          liability the law does not allow us to exclude. Nothing in these Terms limits your rights under the Consumer
          Act of the Philippines (Republic Act No. 7394).
        </p>
      </>
    ),
  },
  {
    id: 'electronic',
    title: 'Electronic agreements',
    body: (
      <p>
        The Electronic Commerce Act (Republic Act No. 8792) gives electronic documents and signatures legal effect. Your
        online booking, our confirmations, your payments and your handover checklists are valid records of our
        agreement.
      </p>
    ),
  },
  {
    id: 'law',
    title: 'Governing law and disputes',
    body: (
      <p>
        Philippine law governs these Terms. Contact us first about any dispute. We will work in good faith to resolve
        the dispute within 3 business days. If we cannot resolve the dispute, the courts of Las Piñas, Philippines, have
        jurisdiction. You and GearBnB agree to this venue.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to these Terms',
    body: (
      <p>
        We update these Terms from time to time and post the changes on our website. The date at the top shows the
        latest version. Changes do not affect bookings we already confirmed. If you keep using the site after a change
        you accept the new Terms.
      </p>
    ),
  },
  {
    id: 'general',
    title: 'General terms',
    body: (
      <p>
        If a court finds part of these Terms unenforceable the rest stay in effect. These Terms, your booking
        confirmation and the <Link className={legalLinkClass} to="/privacy-policy">Privacy Policy</Link> make up the
        whole agreement between you and GearBnB.
      </p>
    ),
  },
  {
    id: 'contact',
    title: 'Contact us',
    body: (
      <LegalContact
        rows={[
          { label: 'Business name', value: 'GearBnB Camping Gear Rental' },
          { label: 'Address', value: '15 Topaz St., Emapalico Homes, Barangay Talon Uno, Las Piñas, Metro Manila' },
          { label: 'Email', value: <a className={legalLinkClass} href="mailto:admin@gearbnbrental.com">admin@gearbnbrental.com</a> },
          { label: 'Phone', value: <a className={legalLinkClass} href="tel:+639765952432">+63 976 595 2432</a> },
          {
            label: 'Facebook Messenger',
            value: <a className={legalLinkClass} href="https://m.me/1053993614458909" target="_blank" rel="noopener noreferrer">m.me/1053993614458909</a>,
          },
          { label: 'Website', value: <a className={legalLinkClass} href="https://gearbnbrental.com">gearbnbrental.com</a> },
        ]}
      />
    ),
  },
];

export default function TermsOfService() {
  usePageMeta('Terms of Service | GearBnB', 'The terms for using gearbnbrental.com and renting camping gear from GearBnB.');

  return (
    <LegalLayout
      title="Terms of Service"
      updated="September 2026"
      lead={
        <>
          These Terms govern your use of gearbnbrental.com and your rental of camping gear from GearBnB. Read them
          before you book. When you use the site or complete a booking you agree to these Terms and to our{' '}
          <Link className={legalLinkClass} to="/privacy-policy">Privacy Policy</Link>. If you disagree, do not use the
          site.
        </>
      }
      sections={SECTIONS}
    />
  );
}
