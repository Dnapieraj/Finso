-- Stary seed nadawał kategoriom systemowym id w stylu 'cat-jedzenie', a API
-- wymaga UUID (idSchema) — GET /categories kończył się 500, a wydatku nie
-- dało się przypisać do kategorii systemowej. Ta migracja przepisuje id na
-- stałe UUID z prisma/system-categories.ts.
--
-- Transaction.categoryId i RecurringRule.categoryId mają ON UPDATE CASCADE
-- (migracja 20260923140839_init), więc przy zmianie Category.id Postgres
-- przepisuje odwołania sam, w tej samej instrukcji — także w koszu
-- (deletedAt). Na bazie bez starych id (produkcja) nic nie robi.

CREATE TEMP TABLE "_system_category_ids" ("old_id" TEXT PRIMARY KEY, "new_id" TEXT NOT NULL);

INSERT INTO "_system_category_ids" ("old_id", "new_id") VALUES
  ('cat-jedzenie',    '00000000-0000-7000-8000-000000000001'),
  ('cat-transport',   '00000000-0000-7000-8000-000000000002'),
  ('cat-mieszkanie',  '00000000-0000-7000-8000-000000000003'),
  ('cat-rozrywka',    '00000000-0000-7000-8000-000000000004'),
  ('cat-zdrowie',     '00000000-0000-7000-8000-000000000005'),
  ('cat-edukacja',    '00000000-0000-7000-8000-000000000006'),
  ('cat-subskrypcje', '00000000-0000-7000-8000-000000000007'),
  ('cat-inne',        '00000000-0000-7000-8000-000000000008');

-- 1. Nowy seed ruszył przed tą migracją, więc w bazie są oba wiersze.
--    Zmiana id wpadłaby na klucz główny — przepinamy odwołania na nowy
--    wiersz i usuwamy stary.
UPDATE "Transaction" AS t SET "categoryId" = m."new_id"
FROM "_system_category_ids" AS m
WHERE t."categoryId" = m."old_id"
  AND EXISTS (SELECT 1 FROM "Category" AS c WHERE c."id" = m."new_id");

UPDATE "RecurringRule" AS r SET "categoryId" = m."new_id"
FROM "_system_category_ids" AS m
WHERE r."categoryId" = m."old_id"
  AND EXISTS (SELECT 1 FROM "Category" AS c WHERE c."id" = m."new_id");

DELETE FROM "Category" AS c
USING "_system_category_ids" AS m
WHERE c."id" = m."old_id" AND c."userId" IS NULL
  AND EXISTS (SELECT 1 FROM "Category" AS n WHERE n."id" = m."new_id");

-- 2. Zwykły przypadek: zmiana id; ON UPDATE CASCADE przepisuje
--    Transaction i RecurringRule.
UPDATE "Category" AS c SET "id" = m."new_id"
FROM "_system_category_ids" AS m
WHERE c."id" = m."old_id" AND c."userId" IS NULL;

DROP TABLE "_system_category_ids";
