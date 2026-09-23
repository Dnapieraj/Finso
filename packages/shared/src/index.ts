// Punkt wejścia @vireo/shared. Zero importów z NestJS, React czy Prisma.

export * from "./money.js";
export * from "./date.js";
export * from "./budget/types.js";
export * from "./budget/calculate-available-balance.js";
export * from "./budget/simulate-purchase.js";
export * from "./budget/calculate-goal-contribution.js";
export * from "./budget/period.js";
export * from "./budget/recurrence.js";
export * from "./budget/assemble-budget-input.js";
export * from "./budget/schemas.js";
export * from "./common/schemas.js";
export * from "./auth/schemas.js";
export * from "./users/schemas.js";
export * from "./categories/schemas.js";
export * from "./transactions/schemas.js";
export * from "./goals/schemas.js";
export * from "./income/schemas.js";
export * from "./recurring-rules/schemas.js";

// Jeszcze nie zbudowane (poza etapem 3): forecastIrregularIncome,
// detectRecurringPatterns.
