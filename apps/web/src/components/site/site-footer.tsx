import Link from "next/link";

import { cn } from "@vireo/ui/lib/utils";

import { legalLinks } from "@/content/links";
import { pl } from "@/messages/pl";

import { containerClass, textLinkClass } from "./classes";

const t = pl.footer;

const links = [
  { href: legalLinks.privacy, label: t.privacy },
  { href: legalLinks.terms, label: t.terms },
  { href: legalLinks.deleteAccount, label: t.deleteAccount },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div
        className={cn(
          containerClass,
          "flex flex-col gap-6 py-10 sm:flex-row sm:items-center sm:justify-between",
        )}
      >
        <div className="flex flex-col gap-1">
          <p className="font-heading text-xl font-bold tracking-tight">Finso</p>
          <p className="text-sm text-muted-foreground">{t.tagline}</p>
        </div>
        <nav aria-label={t.legalLabel}>
          <ul className="flex flex-col gap-3 text-sm sm:flex-row sm:gap-6">
            {links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={textLinkClass}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className={cn(containerClass, "pb-10 text-sm text-muted-foreground")}>
        <p>{t.copyright}</p>
      </div>
    </footer>
  );
}
