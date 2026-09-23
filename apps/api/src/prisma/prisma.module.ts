import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service.js';
import { withSoftDelete } from './soft-delete.extension.js';

/** Token wstrzykiwania klienta bazy — patrz PRISMA_TOKEN_RATIONALE poniżej. */
export const PRISMA = Symbol('PRISMA');

/** Typ klienta z aktywnym rozszerzeniem soft-delete. */
export type Db = ReturnType<typeof withSoftDelete<PrismaService>>;

/**
 * PRISMA_TOKEN_RATIONALE: PrismaService (surowy PrismaClient, patrzy na
 * WSZYSTKIE wiersze łącznie z miękko usuniętymi) jest providerem, ale
 * celowo NIE jest w `exports`. Nest odmówi wstrzyknięcia go w innym
 * module ("nieznana zależność") — to strukturalna gwarancja, nie
 * konwencja. Jedyne, co inne moduły mogą wstrzyknąć, to token PRISMA:
 * klient przepuszczony przez withSoftDelete(), gdzie Transaction i Goal
 * mają wymuszony filtr `deletedAt: null` na każdym odczycie.
 *
 *   constructor(@Inject(PRISMA) private readonly db: Db) {}
 */
@Global()
@Module({
  providers: [
    PrismaService,
    {
      provide: PRISMA,
      useFactory: (prisma: PrismaService) => withSoftDelete(prisma),
      inject: [PrismaService],
    },
  ],
  exports: [PRISMA],
})
export class PrismaModule {}
