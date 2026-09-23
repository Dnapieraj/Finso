// Punkt wejścia @vireo/shared. Zero importów z NestJS, React czy Prisma.

export * from './money.js';
export * from './date.js';
export * from './budget/types.js';
export * from './budget/calculate-available-balance.js';
export * from './budget/simulate-purchase.js';
export * from './budget/calculate-goal-contribution.js';

// Jeszcze nie zbudowane (poza etapem 3): forecastIrregularIncome,
// detectRecurringPatterns.
