/**
 * Pobieramy `limit + 1` wierszy: jeśli przyszedł dodatkowy, istnieje
 * następna strona, a jej kursorem jest id ostatniego zwracanego elementu.
 * Tańsze niż osobne COUNT(*) przy każdej stronie.
 */
export function toPage<Row extends { id: string }, Item>(
  rows: Row[],
  limit: number,
  map: (row: Row) => Item,
): { items: Item[]; nextCursor: string | null } {
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  return {
    items: pageRows.map(map),
    nextCursor: hasMore ? (pageRows.at(-1)?.id ?? null) : null,
  };
}

/** Zakres dat dla `where` Prismy — `undefined` = bez ograniczenia z tej strony. */
export function dateRange(
  from: Date | undefined,
  to: Date | undefined,
): { gte: Date | undefined; lte: Date | undefined } | undefined {
  return from || to ? { gte: from, lte: to } : undefined;
}
