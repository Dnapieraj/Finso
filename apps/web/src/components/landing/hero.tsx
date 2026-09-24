import { cn } from "@vireo/ui/lib/utils";

import { containerClass } from "@/components/site/classes";
import { pl } from "@/messages/pl";

import { PhoneMockup } from "./phone-mockup";
import { StoreButtons } from "./store-buttons";

const t = pl.hero;

export function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      // The glow fades from `secondary` to the page color. Hero text on pure
      // `secondary` still clears 4.5:1 in both themes (checked with
      // `contrastRatio`: primary 6.3, muted-foreground 4.8, foreground 10+).
      className="bg-[radial-gradient(ellipse_at_top_right,var(--secondary),transparent_60%)]"
    >
      <div
        className={cn(
          containerClass,
          "grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-[1.15fr_1fr] lg:gap-16",
        )}
      >
        <div className="flex flex-col gap-6">
          <p className="text-sm font-semibold tracking-wider text-primary uppercase">{t.eyebrow}</p>
          <h1
            id="hero-title"
            className="font-heading text-5xl font-bold tracking-tight text-balance sm:text-6xl"
          >
            {t.title}
          </h1>
          <p className="max-w-xl text-lg text-pretty text-muted-foreground sm:text-xl">{t.lead}</p>
          <StoreButtons label={t.storesLabel} className="mt-2" />
        </div>
        <PhoneMockup />
      </div>
    </section>
  );
}
