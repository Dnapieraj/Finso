import type { INestApplication } from '@nestjs/common';
import type { OpenAPIObject } from '@nestjs/swagger';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';

/**
 * Dokument OpenAPI generowany z kontrolerów i DTO (createZodDto).
 * Osobna funkcja, żeby test e2e mógł sprawdzić dokumentację bez
 * stawiania UI pod /docs.
 */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Finso API')
    .setDescription('Kwoty zawsze w groszach (int). Daty kalendarzowe jako YYYY-MM-DD.')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  // cleanupOpenApiDoc porządkuje schematy wygenerowane z Zoda (nazwy,
  // referencje) — bez niego część typów ląduje w dokumencie jako puste.
  return cleanupOpenApiDoc(SwaggerModule.createDocument(app, config));
}

/** Swagger UI pod /docs i JSON pod /docs-json. */
export function setupSwagger(app: INestApplication): void {
  SwaggerModule.setup('docs', app, () => buildOpenApiDocument(app));
}
