import { pl } from "@/messages/pl";

import { Section } from "./section";

const t = pl.howItWorks;

export function HowItWorks() {
  return (
    <Section id="jak-to-dziala" title={t.title} lead={t.lead} className="bg-card">
      {/* An ordered list: the order of the steps is part of the content. */}
      <ol className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {t.steps.map((step, index) => (
          <li key={step.title} className="flex flex-col gap-3">
            <span
              aria-hidden="true"
              className="flex size-11 items-center justify-center rounded-full bg-primary font-heading text-lg font-bold text-primary-foreground"
            >
              {index + 1}
            </span>
            <h3 className="font-heading text-lg font-semibold tracking-tight">{step.title}</h3>
            <p className="text-muted-foreground">{step.body}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
