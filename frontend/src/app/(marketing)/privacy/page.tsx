import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/marketing/legal-page";
import { SITE } from "@/lib/marketing/site";

export const metadata: Metadata = {
  title: `Privacy policy | ${SITE.product}`,
  description: `How ${SITE.company} handles personal data under the Digital Personal Data Protection Act, 2023.`,
};

const sections: LegalSection[] = [
  {
    id: "roles",
    title: "Who is responsible for your data",
    body: (
      <>
        <p>
          {SITE.company}, CIN {SITE.cin}, with its registered office at {SITE.registeredAddress}{" "}
          (&quot;we&quot;, &quot;us&quot;), operates {SITE.product}. Under the Digital Personal
          Data Protection Act, 2023 (&quot;DPDP Act&quot;) we act in two different capacities:
        </p>
        <ul>
          <li>
            <strong>As Data Fiduciary</strong> for personal data we collect for our own purposes:
            visitors to this website, people who request access, and the contact details of the
            people who manage our customers&apos; accounts.
          </li>
          <li>
            <strong>As Data Processor</strong> for everything our customers put into{" "}
            {SITE.product}: permits, workforce records, isolation evidence, incident reports and
            the like (&quot;Customer Data&quot;). The customer organisation, usually your employer
            or the site owner, is the Data Fiduciary for that data and decides why and how it is
            processed. We process it only on their documented instructions.
          </li>
        </ul>
        <p>
          If you use {SITE.product} through your employer or a site you work at, please send
          requests about your Customer Data to that organisation first. We will help them respond.
        </p>
      </>
    ),
  },
  {
    id: "collect",
    title: "Personal data we collect",
    body: (
      <ul>
        <li>
          <strong>Access requests:</strong> your name, work email, company, and, if you give them,
          your phone number, job title, number of sites and message.
        </li>
        <li>
          <strong>Account data:</strong> name, email address, role, department, profile photo and
          sign-in history for each user an organisation invites.
        </li>
        <li>
          <strong>Operational records within Customer Data:</strong> names and roles recorded on
          permits, approvals and rejections with their reasons, time-stamped progress entries,
          gas-test readings, photographs taken as isolation or work evidence, and incident and
          near-miss reports, which may include descriptions of injuries.
        </li>
        <li>
          <strong>Technical data:</strong> IP address, browser and device information, and
          security and audit logs of actions taken in the service.
        </li>
      </ul>
    ),
  },
  {
    id: "use",
    title: "Why we use it",
    body: (
      <>
        <ul>
          <li>To respond to your access request and set up your organisation, based on your consent.</li>
          <li>To provide, secure and support the service for the customer that invited you.</li>
          <li>To keep the audit trail that makes a permit record trustworthy.</li>
          <li>To send service messages such as invitations, approval requests and expiry reminders.</li>
          <li>
            To comply with law, court orders and directions from authorities, which are legitimate
            uses under section 7 of the DPDP Act.
          </li>
        </ul>
        <p>
          We do not sell personal data, and we do not use Customer Data to advertise to anyone.
        </p>
      </>
    ),
  },
  {
    id: "sharing",
    title: "Who we share it with",
    body: (
      <ul>
        <li>
          <strong>Authorised users of the same organisation</strong>, according to the roles the
          organisation assigns.
        </li>
        <li>
          <strong>Service providers</strong> who host the service, store files and deliver email for
          us, bound by contract to process data only on our instructions and to protect it.
          [List of sub-processors, or a link to it.]
        </li>
        <li>
          <strong>Authorities</strong>, where the law requires it, for example an accident report
          a customer is obliged to file.
        </li>
      </ul>
    ),
  },
  {
    id: "location",
    title: "Where your data is stored",
    body: (
      <p>
        Data is stored in India. If data is transferred outside
        India, it will only go to countries not restricted by the Central Government under section
        16 of the DPDP Act, and under safeguards no weaker than those described here.
      </p>
    ),
  },
  {
    id: "retention",
    title: "How long we keep it",
    body: (
      <ul>
        <li>
          Access requests that do not become customers are deleted [12 months] after our last
          contact.
        </li>
        <li>
          Customer Data is kept for the subscription term and deleted within [90 days] after it
          ends, unless the customer asks us to export it first. Customers remain responsible for
          any statutory period they must keep safety records for.
        </li>
        <li>
          Security logs are kept for at least 180 days, as required by the CERT-In directions of
          28 April 2022.
        </li>
        <li>
          Where you withdraw consent, or the purpose is no longer served, we erase the data unless
          the law requires us to keep it.
        </li>
      </ul>
    ),
  },
  {
    id: "security",
    title: "How we protect it",
    body: (
      <>
        <p>
          We apply reasonable security safeguards as required by section 8(5) of the DPDP Act,
          including encryption in transit, single sign-on, role-based access checked on the server
          for every action, separation of each organisation&apos;s data, and audit logging.
        </p>
        <p>
          If a personal data breach occurs, we will notify the Data Protection Board of India and
          the affected people as the DPDP Act and its rules require, notify CERT-In within six hours
          of noticing a reportable cyber incident, and support our customers with their own
          notifications.
        </p>
      </>
    ),
  },
  {
    id: "rights",
    title: "Your rights",
    body: (
      <>
        <p>Under the DPDP Act you can:</p>
        <ul>
          <li>ask for a summary of the personal data we process about you and who we shared it with;</li>
          <li>ask us to correct, complete, update or erase it;</li>
          <li>withdraw your consent at any time, as easily as you gave it;</li>
          <li>nominate another person to exercise your rights if you die or become incapacitated;</li>
          <li>have your grievances addressed by our Grievance Officer.</li>
        </ul>
        <p>
          Withdrawing consent does not affect processing that already took place. For data held
          as Customer Data, we will pass your request to the organisation responsible for it.
        </p>
      </>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: (
      <p>
        {SITE.product} is a workplace tool and is not meant for anyone under 18. We do not
        knowingly collect personal data from children. If you believe we have, contact us and we
        will delete it.
      </p>
    ),
  },
  {
    id: "grievance",
    title: "Contact and grievances",
    body: (
      <>
        <p>
          Privacy questions: <a href={`mailto:${SITE.privacyEmail}`}>{SITE.privacyEmail}</a>
        </p>
        <p>
          Grievance Officer: {SITE.grievanceOfficer},{" "}
          <a href={`mailto:${SITE.grievanceEmail}`}>{SITE.grievanceEmail}</a>, {SITE.registeredAddress}.
          We respond within the period prescribed under the DPDP Rules. If you are not satisfied
          with our response, you may complain to the Data Protection Board of India.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: (
      <p>
        We will post any change on this page and update the date at the top. If a change affects
        how we use data you consented to, we will ask for your consent again. See also our{" "}
        <Link href="/cookies">cookie policy</Link> and <Link href="/terms">terms and conditions</Link>.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      current="/privacy"
      intro={
        <p>
          This policy explains what personal data {SITE.product} handles, why, and the choices you
          have. It is written for the Digital Personal Data Protection Act, 2023 and the rules made
          under it.
        </p>
      }
      sections={sections}
    />
  );
}
