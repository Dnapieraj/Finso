-- Klucze idempotencji: ponowione żądanie z tym samym Idempotency-Key
-- zwraca zapisaną odpowiedź zamiast tworzyć drugi wydatek.
CREATE TABLE "IdempotencyKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    -- Endpoint, którego dotyczy klucz, np. 'POST /transactions'.
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    -- SHA-256 zwalidowanego body: ten sam klucz z inną treścią to 422.
    "requestHash" TEXT NOT NULL,
    "responseStatus" INTEGER NOT NULL,
    "responseBody" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IdempotencyKey_userId_scope_key_key"
    ON "IdempotencyKey"("userId", "scope", "key");
CREATE INDEX "IdempotencyKey_expiresAt_idx" ON "IdempotencyKey"("expiresAt");

-- Usunięcie konta kasuje też klucze (RODO), jak resztę danych użytkownika.
ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
