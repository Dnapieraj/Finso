import * as React from "react";
import { formatMoney, type FormatMoneyOptions, type Grosze } from "@vireo/shared";
import { cn } from "@vireo/ui/lib/utils";

/**
 * An amount in grosze rendered as Polish złoty via `formatMoney`, the only
 * sanctioned way to display money. Tabular figures keep columns of amounts
 * aligned; the formatter's non-breaking spaces keep the amount on one line.
 */
function Money({
  amount,
  whole,
  sign,
  className,
  ...props
}: Omit<React.ComponentProps<"span">, "children"> & FormatMoneyOptions & { amount: Grosze }) {
  return (
    <span data-slot="money" className={cn("tabular-nums", className)} {...props}>
      {formatMoney(amount, { whole, sign })}
    </span>
  );
}

export { Money };
