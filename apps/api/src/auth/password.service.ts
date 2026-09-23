import type { OnModuleInit } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/**
 * Hashowanie haseł argon2id z domyślnymi parametrami biblioteki
 * (64 MiB, 3 iteracje, 4 wątki — powyżej minimum OWASP). Gdy kiedyś je
 * podniesiemy, `needsRehash` pozwoli przeliczyć stare hashe przy
 * najbliższym logowaniu, bez resetu haseł.
 */
@Injectable()
export class PasswordService implements OnModuleInit {
  /**
   * Hash-atrapa do porównań, gdy użytkownik o danym e-mailu nie istnieje.
   * Bez niej "zły e-mail" odpowiada w ~1 ms, a "złe hasło" w ~50 ms
   * (argon2) — mierząc czas, da się sprawdzić, kto ma konto.
   */
  private dummyHash = '';

  async onModuleInit(): Promise<void> {
    this.dummyHash = await argon2.hash('timing-equalization-placeholder');
  }

  /** Hashuje nowe hasło (rejestracja). */
  hash(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  /**
   * Weryfikuje hasło. `hash === null` (brak użytkownika) nadal wykonuje
   * pełne porównanie z atrapą i zwraca `false` — ten sam koszt czasowy.
   */
  async verify(hash: string | null, password: string): Promise<boolean> {
    const matches = await argon2.verify(hash ?? this.dummyHash, password);
    return hash !== null && matches;
  }

  /** Czy hash powstał ze słabszymi parametrami niż obecne domyślne. */
  needsRehash(hash: string): boolean {
    return argon2.needsRehash(hash);
  }
}
