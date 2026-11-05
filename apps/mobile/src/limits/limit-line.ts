import { grosze, type CategoryLimitsOverview } from "@vireo/shared";

import { pl } from "../messages/pl";
import type { Money } from "../privacy/money";

type Status = CategoryLimitsOverview["limits"][number];

/**
 * „Zostało 754 zł z 800 zł · 62 zł dziennie”, or by how much it is over.
 * What is left rounds down and an overspend up — never better than it is;
 * the limit itself also down, so a 800,50 zł limit does not promise more.
 */
export function limitLine(money: Money, status: Status): string {
  const limit = money.format(grosze(status.limit), { whole: "down" });
  if (status.state === "over") {
    return pl.limits.over(money.format(grosze(-status.left), { whole: "up" }), limit);
  }
  return pl.limits.left(
    money.format(grosze(status.left), { whole: "down" }),
    limit,
    money.format(grosze(status.perDayLeft), { whole: "down" }),
  );
}
