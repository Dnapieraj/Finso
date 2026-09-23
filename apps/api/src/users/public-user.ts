import type { PublicUser } from '@vireo/shared';

import type { User } from '../generated/prisma/client.js';

/** Pola pobierane z bazy dla publicznego widoku — `select`, nie cały wiersz. */
export const publicUserSelect = {
  id: true,
  email: true,
  plan: true,
  currency: true,
  timezone: true,
  periodStartDay: true,
} as const;

/**
 * Wiersz User → publiczny widok. Jedno miejsce dla auth i users, żeby
 * nowe pole nie trafiło do jednej odpowiedzi, a do drugiej nie.
 */
export function toPublicUser(user: Pick<User, keyof typeof publicUserSelect>): PublicUser {
  return {
    id: user.id,
    email: user.email,
    plan: user.plan,
    currency: user.currency,
    timezone: user.timezone,
    periodStartDay: user.periodStartDay,
  };
}
