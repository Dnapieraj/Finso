import { CheckIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@vireo/ui/components/card";
import { Money } from "@vireo/ui/components/money";

import { appPrice } from "@/content/pricing";
import { pl } from "@/messages/pl";

import { Section } from "./section";
import { StoreButtons } from "./store-buttons";

const t = pl.pricing;

/** One price, paid once in the store. The site itself sells nothing. */
export function Pricing() {
  return (
    <Section id="cennik" title={t.title} lead={t.lead}>
      <Card className="mx-auto w-full max-w-xl gap-6 py-7 text-base ring-2 ring-primary [--card-spacing:--spacing(7)]">
        <CardHeader className="gap-3">
          <CardTitle className="text-2xl">
            <h3>{t.name}</h3>
          </CardTitle>
          <p className="flex flex-wrap items-baseline gap-x-2">
            <Money amount={appPrice} className="font-heading text-4xl font-bold tracking-tight" />
            <span className="text-muted-foreground">{t.priceNote}</span>
          </p>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-3">
            {t.features.map((item) => (
              <li key={item} className="flex gap-3">
                <CheckIcon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-safe" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="mt-10 flex flex-col items-start gap-5 md:items-center md:text-center">
        <p className="max-w-2xl text-pretty text-muted-foreground">{t.storeNote}</p>
        <StoreButtons label={t.storesLabel} />
      </div>
    </Section>
  );
}
