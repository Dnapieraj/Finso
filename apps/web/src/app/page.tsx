import { Button } from "@vireo/ui/components/button";

import { pl } from "@/messages/pl";

const t = pl.preview;

const statuses = [
  { label: t.safe, className: "bg-safe-subtle text-safe" },
  { label: t.caution, className: "bg-caution-subtle text-caution" },
  { label: t.risk, className: "bg-risk-subtle text-risk" },
] as const;

// Temporary design-system preview; the dashboard replaces it.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-1">
        <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          {t.eyebrow}
        </p>
        <h1 className="font-heading text-3xl font-bold tracking-tight">{t.heading}</h1>
      </header>

      <section className="bg-card flex flex-col gap-1 rounded-2xl p-4 shadow-xs">
        <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          {t.availableLabel}
        </p>
        <p className="font-heading text-5xl font-bold tracking-tight tabular-nums">
          {t.availableSample}
        </p>
        <p className="text-muted-foreground text-sm">{t.availableHint}</p>
      </section>

      <section aria-labelledby="statuses" className="flex flex-col gap-3">
        <h2 id="statuses" className="text-sm font-semibold">
          {t.statusLabel}
        </h2>
        <ul className="flex flex-wrap gap-2">
          {statuses.map(({ label, className }) => (
            <li key={label} className={`rounded-full px-3 py-1 text-sm font-semibold ${className}`}>
              {label}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="actions" className="flex flex-col gap-3">
        <h2 id="actions" className="text-sm font-semibold">
          {t.actionsLabel}
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button>{t.addExpense}</Button>
          <Button variant="secondary">{t.simulate}</Button>
          <Button variant="ghost">{t.cancel}</Button>
          <Button variant="destructive">{t.deleteAccount}</Button>
        </div>
      </section>
    </main>
  );
}
