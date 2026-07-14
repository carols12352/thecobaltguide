import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/layout/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service | The Cobalt Guide",
  description: "Terms governing access to and use of The Cobalt Guide.",
};

const sections: LegalSection[] = [
  {
    id: "acceptance",
    title: "Acceptance of these terms",
    content: <p>By accessing or using The Cobalt Guide, you agree to these Terms of Service. If you do not agree, do not use the service. If you use the service on behalf of another person or organization, you represent that you have authority to accept these terms for them.</p>,
  },
  {
    id: "service",
    title: "The service",
    content: (
      <>
        <p>The Cobalt Guide is an independent, community-maintained reference for reported merchant earning multipliers in Canada. It provides map, search, account, contribution, flagging, and moderation features.</p>
        <p>The service is not affiliated with, endorsed by, or operated by American Express or any merchant shown on the map. It does not provide financial, legal, tax, or credit advice.</p>
      </>
    ),
  },
  {
    id: "accounts",
    title: "Accounts and user responsibility",
    content: (
      <>
        <p>You are responsible for the accuracy of information you provide, for maintaining the confidentiality of your account credentials, and for activity under your account. Notify the maintainers promptly if you believe your account or the service has been used without authorization.</p>
        <p>You must provide contributions in good faith and based on information you reasonably believe to be accurate. Do not submit card numbers, login credentials, private receipts, or unnecessary personal information.</p>
      </>
    ),
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    content: (
      <>
        <p>You may not misuse the service, interfere with its operation, bypass access controls or rate limits, scrape it in a manner that degrades availability, probe for vulnerabilities without authorization, impersonate others, submit deceptive or unlawful content, or use the service to violate another person&apos;s rights.</p>
        <p>We may remove content, limit contributions, suspend accounts, or restrict access when reasonably necessary to protect users, data quality, security, or the service.</p>
      </>
    ),
  },
  {
    id: "content",
    title: "User content",
    content: (
      <>
        <p>You retain ownership of original content you submit. You grant the service a worldwide, non-exclusive, royalty-free licence to host, store, reproduce, modify for formatting or moderation, aggregate, display, and distribute that content as needed to operate and improve the community reference.</p>
        <p>You represent that you have the right to submit the content and that its use as described here will not violate law or third-party rights. Community data may be corrected, combined, archived, or removed to maintain quality and safety.</p>
      </>
    ),
  },
  {
    id: "intellectual-property",
    title: "Intellectual property",
    content: <p>The service interface, branding, documentation, and software are protected by applicable intellectual-property laws and any licence terms published with the project. Third-party names, trademarks, map data, and source datasets remain the property of their respective owners. No trademark licence is granted by these terms.</p>,
  },
  {
    id: "third-parties",
    title: "Third-party services",
    content: <p>The service may rely on or link to third-party authentication, map, geocoding, hosting, database, and merchant services. We do not control those services and are not responsible for their content, availability, security, or practices. Your use of them may be subject to separate terms.</p>,
  },
  {
    id: "disclaimers",
    title: "Disclaimers",
    content: (
      <>
        <p>The service and all merchant information are provided “as is” and “as available.” Community reports may be incomplete, outdated, disputed, or incorrect. Merchant acceptance and transaction classification can vary by location, purchase, payment method, issuer decision, and time.</p>
        <p>To the fullest extent permitted by law, we disclaim all warranties, express or implied, including accuracy, fitness for a particular purpose, merchantability, non-infringement, and uninterrupted availability. You remain responsible for verifying information before making a purchase or financial decision.</p>
      </>
    ),
  },
  {
    id: "liability",
    title: "Limitation of liability",
    content: <p>To the fullest extent permitted by applicable law, the project maintainers and contributors will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for lost rewards, revenue, data, goodwill, or opportunities arising from use of or reliance on the service. Nothing in these terms excludes liability that cannot lawfully be excluded.</p>,
  },
  {
    id: "changes-termination",
    title: "Changes, suspension, and termination",
    content: (
      <>
        <p>We may change, suspend, or discontinue any part of the service, and may update these terms as the project evolves. Material revisions will be reflected by a new effective date. Continued use after revised terms take effect constitutes acceptance of those terms.</p>
        <p>You may stop using the service at any time. Provisions that by their nature should survive termination—including content licences, disclaimers, liability limits, and intellectual-property provisions—will continue to apply.</p>
      </>
    ),
  },
  {
    id: "general-contact",
    title: "General terms and contact",
    content: (
      <>
        <p>These terms are governed by applicable law without creating rights that mandatory consumer law does not permit us to limit. If any provision is unenforceable, the remaining provisions remain in effect. A failure to enforce a provision is not a waiver.</p>
        <p>Questions about these terms may be directed to the maintainers through the <a href="https://github.com/carols12352/thecobaltguide" target="_blank" rel="noopener noreferrer" className="font-medium text-cobalt-700 underline underline-offset-4 dark:text-cobalt-300">project repository</a>. Do not include private account or payment information in a public issue.</p>
      </>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms of Service"
      summary="These terms set the basic rules for using and contributing to the community merchant guide."
      effectiveDate="July 14, 2026"
      sections={sections}
    />
  );
}
