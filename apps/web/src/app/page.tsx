import { grosze } from "@vireo/shared";
import { Badge } from "@vireo/ui/components/badge";
import { Button } from "@vireo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@vireo/ui/components/card";
import { Input } from "@vireo/ui/components/input";
import { Label } from "@vireo/ui/components/label";
import { Money } from "@vireo/ui/components/money";
import { Skeleton } from "@vireo/ui/components/skeleton";

import { pl } from "@/messages/pl";

import { ExpenseDialogDemo } from "./_preview/expense-dialog-demo";

const t = pl.preview;

function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-sm font-semibold">
      {children}
    </h2>
  );
}

// Temporary design-system preview with sample data; the dashboard replaces it.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          {t.eyebrow}
        </p>
        <h1 className="font-heading text-3xl font-bold tracking-tight">{t.heading}</h1>
        <p className="text-sm text-muted-foreground">{t.sampleNote}</p>
      </header>

      <Card>
        <CardContent className="flex flex-col gap-1">
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            {t.availableLabel}
          </p>
          <Money amount={grosze(8640)} className="font-heading text-5xl font-bold tracking-tight" />
          <p className="text-sm text-muted-foreground">
            {t.untilPayday} <Money amount={grosze(120960)} className="text-foreground" /> ·{" "}
            {t.daysLeft}
          </p>
        </CardContent>
      </Card>

      <section aria-labelledby="statuses" className="flex flex-col gap-3">
        <SectionTitle id="statuses">{t.statusLabel}</SectionTitle>
        <div className="flex flex-wrap gap-2">
          <Badge variant="safe">{t.safe}</Badge>
          <Badge variant="caution">{t.caution}</Badge>
          <Badge variant="risk">{t.risk}</Badge>
        </div>
      </section>

      <section aria-labelledby="list" className="flex flex-col gap-3">
        <SectionTitle id="list">{t.listLabel}</SectionTitle>
        <Card size="sm">
          <CardContent>
            <ul className="flex flex-col divide-y">
              <li className="flex items-baseline justify-between gap-4 py-2 first:pt-0">
                <span>
                  {t.subscription}
                  <span className="block text-xs text-muted-foreground">{t.subscriptionNote}</span>
                </span>
                <Money amount={grosze(2699)} className="font-semibold text-caution" />
              </li>
              <li className="flex items-baseline justify-between gap-4 py-2 last:pb-0">
                <span>
                  {t.friend}
                  <span className="block text-xs text-muted-foreground">{t.friendNote}</span>
                </span>
                <Money amount={grosze(4250)} sign="always" className="font-semibold text-safe" />
              </li>
            </ul>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="form" className="flex flex-col gap-3">
        <SectionTitle id="form">{t.formLabel}</SectionTitle>
        <div className="flex flex-col gap-2">
          <Label htmlFor="preview-amount">{t.amountLabel}</Label>
          <Input
            id="preview-amount"
            inputMode="decimal"
            placeholder={t.amountPlaceholder}
            aria-invalid="true"
            aria-describedby="preview-amount-error"
          />
          <p id="preview-amount-error" className="text-sm text-destructive">
            {t.amountError}
          </p>
        </div>
      </section>

      <section aria-labelledby="loading" className="flex flex-col gap-3">
        <SectionTitle id="loading">{t.loadingLabel}</SectionTitle>
        <Card aria-busy="true">
          <CardContent className="flex flex-col gap-3">
            <span className="sr-only">{pl.common.loading}</span>
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-12 w-40" />
            <Skeleton className="h-3 w-52" />
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="empty" className="flex flex-col gap-3">
        <SectionTitle id="empty">{t.emptyLabel}</SectionTitle>
        <Card>
          <CardHeader>
            <CardTitle>{t.emptyTitle}</CardTitle>
            <CardDescription>{t.emptyBody}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="secondary">{t.addGoal}</Button>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="actions" className="flex flex-col gap-3">
        <SectionTitle id="actions">{t.actionsLabel}</SectionTitle>
        <div className="flex flex-wrap gap-2">
          <ExpenseDialogDemo />
          <Button variant="secondary">{t.simulate}</Button>
          <Button variant="ghost">{pl.common.cancel}</Button>
          <Button variant="destructive">{t.deleteAccount}</Button>
        </div>
      </section>
    </main>
  );
}
