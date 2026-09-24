import Link from "next/link";

import { buttonVariants } from "@vireo/ui/components/button";
import { cn } from "@vireo/ui/lib/utils";

import { containerClass } from "@/components/site/classes";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { pl } from "@/messages/pl";

const t = pl.notFound;

/*
 * The root not-found sits outside the (site) group, so it renders the
 * header and footer itself. Next serves it with a 404 status.
 */
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="tresc" tabIndex={-1} className="flex-1 outline-none">
        <div className={cn(containerClass, "flex max-w-3xl flex-col items-start gap-4 py-24")}>
          <h1 className="font-heading text-4xl font-bold tracking-tight sm:text-5xl">{t.title}</h1>
          <p className="text-lg text-muted-foreground">{t.body}</p>
          <Link href="/" className={cn(buttonVariants(), "mt-2")}>
            {t.backHome}
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
