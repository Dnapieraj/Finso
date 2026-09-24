import Link from "next/link";

import { cn } from "@vireo/ui/lib/utils";

import { pl } from "@/messages/pl";

import { containerClass, textLinkClass } from "./section";

const t = pl.header;

const navItems = [
  { href: "#wyrozniki", label: t.nav.features },
  { href: "#jak-to-dziala", label: t.nav.howItWorks },
  { href: "#cennik", label: t.nav.pricing },
] as const;

export function SiteHeader() {
  return (
    <>
      {/* First focusable element: keyboard users skip the nav in one step. */}
      <a
        href="#tresc"
        className="sr-only rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {t.skipToContent}
      </a>
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur-md">
        <div className={cn(containerClass, "flex h-16 items-center justify-between gap-6")}>
          <Link
            href="/"
            aria-label={t.homeLabel}
            className={cn(
              textLinkClass,
              "font-heading text-2xl font-bold tracking-tight hover:no-underline",
            )}
          >
            Finso
          </Link>
          <nav aria-label={t.navLabel} className="hidden sm:block">
            <ul className="flex items-center gap-6 text-sm font-semibold">
              {navItems.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className={cn(textLinkClass, "text-muted-foreground hover:text-foreground")}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
    </>
  );
}
