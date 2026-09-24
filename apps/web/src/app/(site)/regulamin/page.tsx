import { LegalDocument } from "@/components/legal/legal-document";
import { legalLinks } from "@/content/links";
import { pageMetadata } from "@/content/metadata";
import { termsOfService } from "@/messages/legal/terms";

export const metadata = pageMetadata({
  title: termsOfService.title,
  description: termsOfService.description,
  path: legalLinks.terms,
});

export default function TermsPage() {
  return <LegalDocument document={termsOfService} />;
}
