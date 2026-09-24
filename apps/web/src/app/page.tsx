import { Features } from "@/components/landing/features";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Pricing } from "@/components/landing/pricing";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";

/*
 * Fully static: no data fetching, no request-time APIs and no client
 * components, so Next prerenders the whole page to HTML at build time.
 */
export default function Home() {
  return (
    <>
      <SiteHeader />
      <main id="tresc" tabIndex={-1} className="flex-1 outline-none">
        <Hero />
        <Features />
        <HowItWorks />
        <Pricing />
      </main>
      <SiteFooter />
    </>
  );
}
