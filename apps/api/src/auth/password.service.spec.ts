import { describe, expect, it } from 'vitest';

import { PasswordService } from './password.service.js';

describe('PasswordService', () => {
  const createService = async () => {
    const service = new PasswordService();
    await service.onModuleInit();
    return service;
  };

  it('hashuje argon2id i weryfikuje poprawne hasło', async () => {
    const service = await createService();
    const hash = await service.hash('moje hasło');

    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await service.verify(hash, 'moje hasło')).toBe(true);
    expect(await service.verify(hash, 'inne hasło')).toBe(false);
  });

  it('dla nieistniejącego użytkownika zawsze zwraca false — nawet gdy hasło pasuje do atrapy', async () => {
    // Kod źródłowy (z tekstem atrapy) jest publiczny w repo. Gdyby verify
    // zwracało sam wynik porównania, to hasło "logowałoby" do każdego
    // nieistniejącego konta — tu łapiemy regresję niezależnie od tego,
    // czy wywołujący pamięta o sprawdzeniu `!user`.
    const service = await createService();

    expect(await service.verify(null, 'timing-equalization-placeholder')).toBe(false);
  });

  it('nie wymaga rehasha dla hasha z aktualnymi parametrami', async () => {
    const service = await createService();

    expect(service.needsRehash(await service.hash('x'))).toBe(false);
  });
});
