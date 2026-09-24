# web

Statyczna strona wizytówkowa Finso: **Next.js 16 (App Router)** + Tailwind v4 + `@vireo/ui`.
Bez logowania, bez danych użytkownika i bez wywołań API — cała aplikacja jest w `apps/mobile`.

| Adres                         | Zawartość                                                            |
| ----------------------------- | -------------------------------------------------------------------- |
| `/`                           | Hero, wyróżniki, „Jak to działa”, cennik Free/Plus, linki do sklepów |
| `/polityka-prywatnosci`       | Polityka prywatności (szkic do przeglądu prawnego)                   |
| `/regulamin`                  | Regulamin (szkic)                                                    |
| `/usuwanie-konta`             | Jak usunąć konto — wymóg Google Play                                 |
| `/sitemap.xml`, `/robots.txt` | SEO                                                                  |

Każda strona jest generowana statycznie przy `next build`.

## Uruchomienie

```bash
pnpm --filter web dev     # http://localhost:3000
pnpm --filter web build   # produkcyjny build (wymaga zbudowanego @vireo/shared)
```

## Gdzie co jest

- `src/messages/pl.ts` — wszystkie teksty strony; `src/messages/legal/` — treść dokumentów prawnych
- `src/content/site.ts` — domena, e-mail kontaktowy, administrator danych (**placeholdery**)
- `src/content/links.ts` — linki do App Store / Google Play (na razie `#`) i stron prawnych
- `src/content/pricing.ts` — ceny planu Plus w groszach
- Kwoty wyświetla wyłącznie komponent `Money` z `@vireo/ui` (przez `formatMoney`)

Przed publikacją placeholdery trzeba podmienić — lista w `docs/PRODUCT.md` (etap 8).

## Testy

```bash
pnpm --filter web test:e2e
```

Playwright buduje stronę, uruchamia ją na porcie 3100 i testuje na desktopie i telefonie
(Pixel 7): treść, dostępność klawiaturą, dark mode, brak przewijania w bok, brak cookies,
metadane SEO, sitemap, robots i 404. Przy pierwszym uruchomieniu zainstaluj przeglądarkę:
`pnpm --filter web exec playwright install chromium`.
