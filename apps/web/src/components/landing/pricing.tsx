import { CheckIcon } from "lucide-react";

import { grosze } from "@vireo/shared";
import { Badge } from "@vireo/ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@vireo/ui/components/card";
import { Money } from "@vireo/ui/components/money";
import { cn } from "@vireo/ui/lib/utils";

import { plusPrice, yearlyPerMonth } from "@/content/pricing";
import { pl } from "@/messages/pl";

import { Section } from "./section";
import { StoreButtons } from "./store-buttons";

const t = pl.pricing;

function FeatureList({ items }: { items: readonly string[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <CheckIcon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-safe" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function PlanCard({
  name,
  badge,
  highlighted = false,
  price,
  features,
}: {
  name: string;
  badge?: string;
  highlighted?: boolean;
  price: React.ReactNode;
  features: readonly string[];
}) {
  return (
    <Card
      className={cn(
        "gap-6 py-7 text-base [--card-spacing:--spacing(7)]",
        highlighted && "ring-2 ring-primary",
      )}
    >
      <CardHeader className="gap-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-2xl">
            <h3>{name}</h3>
          </CardTitle>
          {badge && <Badge>{badge}</Badge>}
        </div>
        {price}
      </CardHeader>
      <CardContent>
        <FeatureList items={features} />
      </CardContent>
    </Card>
  );
}

/** Plans and prices only. Purchases happen in the app through the stores. */
export function Pricing() {
  return (
    <Section id="cennik" title={t.title} lead={t.lead}>
      <div className="grid gap-6 md:grid-cols-2">
        <PlanCard
          name={t.free.name}
          features={t.free.features}
          price={
            <p className="flex flex-wrap items-baseline gap-x-2">
              <Money
                amount={grosze(0)}
                whole="up"
                className="font-heading text-4xl font-bold tracking-tight"
              />
              <span className="text-muted-foreground">{t.free.priceNote}</span>
            </p>
          }
        />
        <PlanCard
          name={t.plus.name}
          badge={t.plus.badge}
          highlighted
          features={t.plus.features}
          price={
            <div className="flex flex-col gap-1">
              <p className="flex flex-wrap items-baseline gap-x-2">
                <Money
                  amount={plusPrice.monthly}
                  className="font-heading text-4xl font-bold tracking-tight"
                />
                <span className="text-muted-foreground">{t.perMonth}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                {t.plus.yearlyPrefix}{" "}
                <Money
                  amount={plusPrice.yearly}
                  whole="up"
                  className="font-semibold text-foreground"
                />{" "}
                {t.plus.yearlyMiddle}{" "}
                <Money
                  amount={yearlyPerMonth(plusPrice.yearly)}
                  className="font-semibold text-foreground"
                />{" "}
                {t.plus.yearlySuffix}
              </p>
            </div>
          }
        />
      </div>

      <div className="mt-10 flex flex-col items-start gap-5 md:items-center md:text-center">
        <p className="max-w-2xl text-pretty text-muted-foreground">{t.storeNote}</p>
        <StoreButtons label={t.storesLabel} />
      </div>
    </Section>
  );
}
