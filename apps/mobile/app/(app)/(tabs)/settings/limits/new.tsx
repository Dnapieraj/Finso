import { useCategoryLimits } from "../../../../../src/limits/queries";
import { LimitForm } from "../../../../../src/settings/limit-form";

export default function NewLimit() {
  const limits = useCategoryLimits();
  return <LimitForm taken={limits.data?.limits.map((limit) => limit.categoryId) ?? []} />;
}
