import type { INestApplication } from '@nestjs/common';
import type { OpenAPIObject } from '@nestjs/swagger';

import { buildOpenApiDocument } from '../src/swagger.js';
import { createTestApp } from './helpers.js';

/**
 * Dokumentacja generuje się z tych samych schematów Zod, które walidują
 * żądania — ten test pilnuje, że wszystkie moduły są w niej widoczne,
 * a typy (grosze jako integer, daty jako format date) przeszły poprawnie.
 */
describe('OpenAPI (e2e)', () => {
  let app: INestApplication;
  let doc: OpenAPIObject;

  beforeAll(async () => {
    app = await createTestApp();
    doc = buildOpenApiDocument(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('dokumentuje wszystkie moduły CRUD', () => {
    expect(Object.keys(doc.paths)).toEqual(
      expect.arrayContaining([
        '/categories',
        '/categories/{id}',
        '/transactions',
        '/transactions/{id}',
        '/transactions/{id}/restore',
        '/goals',
        '/goals/{id}',
        '/goals/{id}/restore',
        '/income/sources',
        '/income/sources/{id}',
        '/income/entries',
        '/income/entries/{id}',
        '/income/entries/{id}/restore',
        '/recurring-rules',
        '/recurring-rules/{id}',
        '/budget/current',
        '/budget/simulate',
        '/users/me',
        '/auth/login',
      ]),
    );
  });

  it('opisuje kwotę jako integer, a datę jako format date', () => {
    const schema = doc.components?.schemas?.CreateTransactionDto;
    expect(schema).toMatchObject({
      properties: {
        // OpenAPI 3.0: "> 0" to minimum + exclusiveMinimum: true (w 3.1 byłoby exclusiveMinimum: 0).
        amount: { type: 'integer', minimum: 0, exclusiveMinimum: true, maximum: 2_147_483_647 },
        date: { type: 'string', format: 'date' },
      },
      required: expect.arrayContaining(['amount', 'date']),
    });
  });

  it('dokumentuje parametry zapytania listy transakcji', () => {
    const params = (doc.paths['/transactions']?.get?.parameters ?? []) as { name: string; in: string }[];
    expect(params.filter((p) => p.in === 'query').map((p) => p.name)).toEqual(
      expect.arrayContaining(['limit', 'cursor', 'from', 'to', 'categoryId']),
    );
  });

  it('oznacza chronione endpointy jako wymagające Bearer tokena', () => {
    expect(doc.paths['/transactions']?.get?.security).toEqual([{ bearer: [] }]);
    expect(doc.components?.securitySchemes?.bearer).toMatchObject({ type: 'http', scheme: 'bearer' });
  });
});
