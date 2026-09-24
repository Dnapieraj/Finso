import { Badge } from "@vireo/ui/components/badge";
import { Card, CardContent } from "@vireo/ui/components/card";
import { Money } from "@vireo/ui/components/money";

import { pl } from "@/messages/pl";

const t = pl.hero.mockup;

/**
 * A simulator screen drawn with the real design-system components instead
 * of a screenshot: it follows the theme, stays sharp at any size and needs
 * no image pipeline. The text is real, so screen readers read the example;
 * the caption says the amounts are illustrative.
 */
export function PhoneMockup() {
  return (
    <figure className="mx-auto flex w-full max-w-xs flex-col items-center gap-3">
      <div className="w-full rounded-[2.75rem] bg-foreground/10 p-2.5 shadow-xl ring-1 ring-foreground/10">
        <div className="flex flex-col gap-3 rounded-[2.25rem] bg-background px-4 pt-8 pb-6">
          <p className="font-heading text-xl font-bold tracking-tight">{t.screenTitle}</p>

          <div className="flex items-baseline justify-between gap-3 rounded-lg border border-input bg-card px-3 py-2.5">
            <span className="text-muted-foreground">{t.itemLabel}</span>
            <Money amount={t.itemPrice} className="font-semibold" />
          </div>

          <Card size="sm">
            <CardContent className="flex flex-col gap-3">
              <Badge variant="safe">{t.verdict}</Badge>
              <div>
                <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  {t.remainingLabel}
                </p>
                <p className="font-heading text-3xl font-bold tracking-tight">
                  <Money amount={t.remaining} />
                </p>
                <p className="text-muted-foreground">{t.remainingSuffix}</p>
              </div>
              <dl className="flex flex-col divide-y text-sm">
                <div className="flex justify-between gap-3 py-2">
                  <dt className="text-muted-foreground">{t.dailyLabel}</dt>
                  <dd>
                    <Money amount={t.daily} whole="down" className="font-semibold" />
                  </dd>
                </div>
                <div className="flex justify-between gap-3 pt-2">
                  <dt className="text-muted-foreground">{t.goalLabel}</dt>
                  <dd className="font-semibold text-safe">{t.goalImpact}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
      <figcaption className="text-center text-sm text-muted-foreground">{t.caption}</figcaption>
    </figure>
  );
}
