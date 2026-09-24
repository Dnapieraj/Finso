import { LegalDocument } from "@/components/legal/legal-document";
import { legalLinks } from "@/content/links";
import { pageMetadata } from "@/content/metadata";
import { privacyPolicy } from "@/messages/legal/privacy";

export const metadata = pageMetadata({
  title: privacyPolicy.title,
  description: privacyPolicy.description,
  path: legalLinks.privacy,
});

export default function PrivacyPolicyPage() {
  return <LegalDocument document={privacyPolicy} />;
}
