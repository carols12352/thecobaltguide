import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/layout/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy | The Cobalt Guide",
  description: "How The Cobalt Guide collects, uses, stores, and protects information.",
};

const sections: LegalSection[] = [
  {
    id: "scope",
    title: "Scope",
    content: <p>This Privacy Policy explains how The Cobalt Guide handles information when you browse the map, create an account, submit merchant information, report a multiplier, flag content, or use moderation features. The service is an independent community project and is not operated by American Express.</p>,
  },
  {
    id: "information-we-collect",
    title: "Information we collect",
    content: (
      <>
        <p>We collect information that you provide directly, including your email address, authentication details, optional profile information, merchant submissions, multiplier reports, transaction dates, purchase context, notes, and content flags.</p>
        <p>We also process limited technical information needed to operate, secure, and measure the performance of the service. This may include authentication session data, request timestamps, IP addresses used for rate limiting and abuse prevention, device or browser information present in ordinary server logs, and local preferences stored in your browser.</p>
        <p>Public merchant contributions may identify a place and transaction context, but users should not include card numbers, receipts, account credentials, or other sensitive personal information in free-text fields.</p>
      </>
    ),
  },
  {
    id: "performance-measurement",
    title: "Performance measurement",
    content: (
      <>
        <p>We use Vercel Speed Insights to understand how quickly and reliably the site loads and responds. It reports anonymous Web Vitals together with limited technical context such as the visited route or path, browser, device type, operating system, approximate country, network speed, metric attribution, SDK version, and event time.</p>
        <p>Vercel states that Speed Insights does not store information that identifies an individual visitor or allows a browsing session to be reconstructed across pages. We use these measurements only to diagnose performance and improve the service; merchant reports, account email addresses, notes, and authentication credentials are not included in Speed Insights events. See <a href="https://vercel.com/docs/speed-insights/privacy-policy" target="_blank" rel="noopener noreferrer" className="font-medium text-cobalt-700 underline underline-offset-4 dark:text-cobalt-300">Vercel&apos;s Speed Insights privacy information</a> for details.</p>
      </>
    ),
  },
  {
    id: "how-we-use-information",
    title: "How we use information",
    content: (
      <>
        <p>We use information to provide accounts and authentication; display and aggregate community merchant reports; maintain confidence and reputation signals; prevent spam and misuse; review flags; measure and improve site performance; respond to support, privacy, and security requests; and maintain the reliability of the service.</p>
        <p>We do not sell personal information. The current service does not use personal information for behavioural advertising or automated decisions that produce legal or similarly significant effects.</p>
      </>
    ),
  },
  {
    id: "cookies-storage",
    title: "Cookies and browser storage",
    content: (
      <>
        <p>The service uses essential cookies to maintain authentication sessions and protect account workflows. These cookies are necessary for signed-in features.</p>
        <p>Limited browser storage may be used for functional purposes, such as email-request cooldowns and dismissed interface guidance. The current service does not set advertising cookies. A configured map provider or authentication provider may process its own technical data under its policy.</p>
      </>
    ),
  },
  {
    id: "service-providers",
    title: "Service providers",
    content: (
      <>
        <p>We rely on service providers to operate the application. These may include Supabase for authentication and database services, Upstash for caching and rate limiting, Vercel for hosting and anonymous performance measurement, Google when you choose Google sign-in, map tile providers such as OpenFreeMap or a configured alternative, and geocoding providers such as Mapbox and OpenStreetMap-based services.</p>
        <p>These providers may process information in other jurisdictions and under their own privacy terms. We disclose only the information reasonably needed for the relevant service, subject to configuration and operational requirements.</p>
      </>
    ),
  },
  {
    id: "sharing",
    title: "Disclosure and public content",
    content: (
      <>
        <p>Merchant locations, aggregated multiplier results, confidence indicators, and some contribution context are intended to be publicly visible. Account email addresses are not displayed as part of ordinary public merchant data.</p>
        <p>We may disclose information when required by law, to protect the service or its users, to investigate abuse or security incidents, or as part of a transfer of the project where appropriate notice and safeguards are provided.</p>
      </>
    ),
  },
  {
    id: "retention-security",
    title: "Retention and security",
    content: (
      <>
        <p>We retain account and contribution information for as long as reasonably needed to provide the service, preserve moderation and audit integrity, resolve disputes, and meet legal or security obligations. Short-lived caches and rate-limit records expire on operational schedules. Information that is no longer required should be deleted or anonymized where reasonably practicable.</p>
        <p>We use safeguards appropriate to the nature of the service, including access controls, row-level database policies, validation, rate limits, and restricted administrative tools. No internet service can guarantee absolute security.</p>
      </>
    ),
  },
  {
    id: "your-choices",
    title: "Your choices and rights",
    content: (
      <>
        <p>Depending on applicable law, you may request access to, correction of, or deletion of personal information associated with your account, or ask how it has been used or disclosed. Some contribution or moderation records may need to be retained for integrity, legal, fraud-prevention, or security reasons.</p>
        <p>You may remove eligible pending reports through account controls. You can also choose not to create an account, although contribution and account features will then be unavailable.</p>
      </>
    ),
  },
  {
    id: "changes-contact",
    title: "Changes and contact",
    content: (
      <>
        <p>We may update this policy as the service, providers, or legal requirements change. Material revisions will be reflected by a new effective date and, where appropriate, additional notice.</p>
        <p>For privacy questions or requests, contact the project maintainers through the <a href="https://github.com/carols12352/thecobaltguide" target="_blank" rel="noopener noreferrer" className="font-medium text-cobalt-700 underline underline-offset-4 dark:text-cobalt-300">project repository</a>. Do not post personal information in a public issue; request a private contact channel instead. We may need to verify your identity before completing a request.</p>
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy Policy"
      summary="This policy describes the limited information the service needs, why it is used, and the choices available to users."
      effectiveDate="July 20, 2026"
      sections={sections}
    />
  );
}
