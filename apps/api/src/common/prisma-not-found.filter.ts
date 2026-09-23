import type { ArgumentsHost } from '@nestjs/common';
import { Catch, NotFoundException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';

import { Prisma } from '../generated/prisma/client.js';

/** Prisma: "operacja wymagała rekordu, którego nie znaleziono". */
const RECORD_NOT_FOUND = 'P2025';

/**
 * `update`/`delete` z `where: { id, userId }` rzuca P2025, gdy wiersza
 * nie ma — albo gdy należy do kogoś innego. Oba przypadki to dla klienta
 * 404: odpowiedź nie może zdradzać, że cudzy zasób o tym id istnieje.
 * Pozostałe błędy Prismy idą dalej do domyślnego handlera (500).
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaNotFoundFilter extends BaseExceptionFilter {
  override catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost): void {
    if (exception.code === RECORD_NOT_FOUND) {
      super.catch(new NotFoundException(), host);
      return;
    }
    super.catch(exception, host);
  }
}
