import {
  CalculatorIcon,
  RepeatIcon,
  TrendingUpIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@vireo/ui/components/card";

import { pl } from "@/messages/pl";

import { RichText } from "./rich-text";
import { Section } from "./section";

const t = pl.features;

const icons: Record<(typeof t.items)[number]["key"], LucideIcon> = {
  simulator: CalculatorIcon,
  irregular: TrendingUpIcon,
  subscriptions: RepeatIcon,
  shared: UsersIcon,
};

export function Features() {
  return (
    <Section id="wyrozniki" title={t.title} lead={t.lead}>
      <ul className="grid gap-4 sm:grid-cols-2">
        {t.items.map((item) => {
          const Icon = icons[item.key];
          return (
            <li key={item.key} className="flex">
              <Card className="w-full gap-5 py-6 [--card-spacing:--spacing(6)]">
                <CardHeader className="gap-3">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <CardTitle>
                    <h3>{item.title}</h3>
                  </CardTitle>
                  <CardDescription className="text-base">{item.body}</CardDescription>
                </CardHeader>
                <CardContent className="mt-auto">
                  <p className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
                    <RichText parts={item.example} />
                  </p>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
