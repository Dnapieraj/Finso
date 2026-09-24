import { Features } from "@/components/landing/features";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Pricing } from "@/components/landing/pricing";

/*
 * Fully static: no data fetching, no request-time APIs and no client
 * components, so Next prerenders the whole page to HTML at build time.
 */
export default function Home() {
  return (
    <>
      <Hero />
      <Features />
      <HowItWorks />
      <Pricing />
    </>
  );
}
