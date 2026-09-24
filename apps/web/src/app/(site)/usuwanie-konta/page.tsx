import { LegalDocument } from "@/components/legal/legal-document";
import { legalLinks } from "@/content/links";
import { pageMetadata } from "@/content/metadata";
import { deleteAccount } from "@/messages/legal/delete-account";

export const metadata = pageMetadata({
  title: deleteAccount.title,
  description: deleteAccount.description,
  path: legalLinks.deleteAccount,
});

export default function DeleteAccountPage() {
  return <LegalDocument document={deleteAccount} />;
}
