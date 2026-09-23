import type { ArgumentMetadata, PipeTransform } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { createZodValidationPipe, ZodSchemaDeclarationException } from 'nestjs-zod';
import { isZodDto } from 'nestjs-zod/dto';

// Jawny typ: nestjs-zod nie eksportuje nazwy typu tej klasy, a przy
// `declaration: true` tsc wymaga typu, który da się zapisać w .d.ts.
const BaseZodValidationPipe: new () => PipeTransform = createZodValidationPipe();

/**
 * Globalny pipe walidacji. Różnica względem domyślnego z nestjs-zod:
 * `@Body()` typowany czymkolwiek innym niż DTO z `createZodDto` to błąd
 * serwera, a nie ciche przepuszczenie niezwalidowanych danych.
 *
 * Tryb `strictSchemaDeclaration` z nestjs-zod byłby za szeroki — objąłby
 * też `@Param('id') id: string` i nasze własne dekoratory parametrów.
 * Body to jedyne miejsce, gdzie klient wysyła całe obiekty, więc tu
 * pilnujemy, żeby zawsze stał za nimi schemat Zod.
 */
@Injectable()
export class ZodValidationPipe extends BaseZodValidationPipe {
  override transform(value: unknown, metadata: ArgumentMetadata): unknown {
    if (metadata.type === 'body' && !isZodDto(metadata.metatype)) {
      throw new ZodSchemaDeclarationException();
    }
    return super.transform(value, metadata);
  }
}
