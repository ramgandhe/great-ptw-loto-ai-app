import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/marketing/legal-page";
import { SITE } from "@/lib/marketing/site";

export const metadata: Metadata = {
  title: `Terms and conditions | ${SITE.product}`,
  description: `The terms that govern use of ${SITE.product}.`,
};

const sections: LegalSection[] = [
  {
    id: "agreement",
    title: "The agreement",
    body: (
      <>
        <p>
          These terms form an agreement between {SITE.company} (&quot;we&quot;, &quot;us&quot;) and
          the organisation that subscribes to {SITE.product} (&quot;Customer&quot;). An order form
          or subscription agreement signed with us takes precedence over these terms where the two
          conflict.
        </p>
        <p>
          If you accept these terms for an organisation, you confirm you have authority to bind it.
          Individual users use the service under their organisation&apos;s subscription.
        </p>
      </>
    ),
  },
  {
    id: "accounts",
    title: "Accounts and access",
    body: (
      <ul>
        <li>Organisation accounts are created by invitation after an access request is accepted.</li>
        <li>
          The Customer&apos;s administrators decide who has access and which role each person holds,
          and must remove access promptly when someone leaves.
        </li>
        <li>
          Each user must keep their credentials private. Actions taken with a user&apos;s account are
          treated as taken by that user, which is what makes the audit trail meaningful.
        </li>
      </ul>
    ),
  },
  {
    id: "safety",
    title: "Safety responsibilities",
    body: (
      <>
        <p>
          <strong>
            {SITE.product} is a tool for managing and recording safe systems of work. It does not
            replace competent persons, site risk assessments, or the Customer&apos;s legal duties.
          </strong>
        </p>
        <ul>
          <li>
            The Customer remains responsible for complying with the laws that apply to its sites,
            including the Factories Act, 1948, the Occupational Safety, Health and Working
            Conditions Code, 2020, state rules, and any industry standards it has adopted.
          </li>
          <li>
            The Customer configures permit types, approval routes, isolation plans and checklists,
            and is responsible for their adequacy for the hazards at its sites.
          </li>
          <li>
            The Customer must keep a fallback procedure for issuing and closing permits and
            isolations if the service is unavailable, and must never delay an emergency response
            to use the service.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "data",
    title: "Customer data",
    body: (
      <>
        <p>
          The Customer owns the data it and its users put into the service (&quot;Customer
          Data&quot;). It grants us permission to host and process Customer Data only to provide,
          secure and support the service, and as described in our{" "}
          <Link href="/privacy">privacy policy</Link>. For personal data, the Customer is the Data
          Fiduciary and we are its Data Processor under the Digital Personal Data Protection Act,
          2023.
        </p>
        <p>
          The Customer is responsible for having a lawful basis to record its workforce&apos;s
          personal data, and for giving them any notices the law requires.
        </p>
      </>
    ),
  },
  {
    id: "use",
    title: "Acceptable use",
    body: (
      <>
        <p>The Customer and its users must not:</p>
        <ul>
          <li>use the service in breach of law or to record information they have no right to record;</li>
          <li>try to access another organisation&apos;s data or bypass role or tenant restrictions;</li>
          <li>probe, overload or disrupt the service, or introduce malicious code;</li>
          <li>resell, sublicense or copy the service, or reverse engineer it except as the law allows.</li>
        </ul>
      </>
    ),
  },
  {
    id: "fees",
    title: "Fees and payment",
    body: (
      <p>
        Fees, modules and billing periods are set out in the order form. Fees exclude GST and other
        applicable taxes, which are charged in addition. Invoices are payable within [30] days.
        If an undisputed invoice is more than [30] days overdue, we may suspend the service after
        giving [15] days&apos; written notice.
      </p>
    ),
  },
  {
    id: "availability",
    title: "Availability and support",
    body: (
      <p>
        We aim to keep the service available [99.5]% of each month, excluding scheduled maintenance
        announced in advance. Support is available by email at{" "}
        <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a> during 10:00–18:00 IST, Monday to Friday.
        Any service credits are set out in the order form.
      </p>
    ),
  },
  {
    id: "ip",
    title: "Intellectual property",
    body: (
      <p>
        We own the service, its software and its documentation. The Customer receives a
        non-exclusive, non-transferable right to use the service during the subscription. Feedback
        the Customer gives may be used to improve the service without obligation.
      </p>
    ),
  },
  {
    id: "confidentiality",
    title: "Confidentiality",
    body: (
      <p>
        Each party will protect the other&apos;s confidential information with at least reasonable
        care and use it only for this agreement. This does not apply to information that is public,
        already known, independently developed, or that must be disclosed by law.
      </p>
    ),
  },
  {
    id: "warranties",
    title: "Warranties and disclaimer",
    body: (
      <p>
        We will provide the service with reasonable skill and care and in line with its
        documentation. Apart from that, the service is provided &quot;as is&quot;, and to the
        extent the law allows we disclaim all other warranties, including fitness for a particular
        purpose and uninterrupted or error-free operation.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Limitation of liability",
    body: (
      <ul>
        <li>
          Neither party is liable for indirect or consequential loss, or for loss of profit,
          revenue or goodwill.
        </li>
        <li>
          Each party&apos;s total liability under this agreement is limited to the fees paid or
          payable by the Customer in the 12 months before the claim arose.
        </li>
        <li>
          These limits do not apply to fraud, a breach of confidentiality, the Customer&apos;s
          payment obligations, or liability that cannot be limited by law.
        </li>
      </ul>
    ),
  },
  {
    id: "indemnity",
    title: "Indemnities",
    body: (
      <p>
        We will defend the Customer against third-party claims that the service infringes their
        intellectual property. The Customer will defend us against third-party claims arising from
        Customer Data or from its use of the service in breach of these terms, including claims
        arising from work carried out at its sites.
      </p>
    ),
  },
  {
    id: "term",
    title: "Term and termination",
    body: (
      <ul>
        <li>The agreement runs for the subscription term in the order form and renews as stated there.</li>
        <li>
          Either party may terminate if the other materially breaches it and does not fix the breach
          within 30 days of written notice.
        </li>
        <li>
          After termination the Customer may export its data for [90] days, after which we delete
          it as described in the <Link href="/privacy">privacy policy</Link>.
        </li>
      </ul>
    ),
  },
  {
    id: "law",
    title: "Governing law and disputes",
    body: (
      <p>
        This agreement is governed by the laws of India. The parties will first try to settle any
        dispute through discussion between senior representatives. Failing that within 30 days,
        the dispute will be referred to a sole arbitrator under the Arbitration and Conciliation
        Act, 1996, seated in {SITE.jurisdictionCity}, in English. Subject to that, the courts at{" "}
        {SITE.jurisdictionCity} have exclusive jurisdiction.
      </p>
    ),
  },
  {
    id: "general",
    title: "General",
    body: (
      <ul>
        <li>Neither party is liable for delay caused by events beyond its reasonable control.</li>
        <li>Neither party may assign the agreement without consent, except to a successor of its business.</li>
        <li>If a clause is found unenforceable, the rest of the agreement continues to apply.</li>
        <li>
          We may update these terms by posting a new version here. Changes that reduce the
          Customer&apos;s rights take effect at the next renewal, unless required by law sooner.
        </li>
        <li>
          Notices to us: {SITE.registeredAddress}, with a copy to{" "}
          <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>.
        </li>
      </ul>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms and conditions"
      current="/terms"
      intro={
        <p>
          Please read these terms before using {SITE.product}. They explain what we provide, what
          the Customer is responsible for, and how disputes are resolved.
        </p>
      }
      sections={sections}
    />
  );
}
