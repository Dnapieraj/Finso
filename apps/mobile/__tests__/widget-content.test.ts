import { widgetContent, type WidgetSnapshot } from "../src/widget/content";

/** formatMoney puts no-break spaces between digit groups and before "zł". */
const zl = (text: string) => text.replaceAll(" ", " ");

/** Budget loaded on 28.09 (Warsaw); the period ends 9.10, payday 10.10. */
const snapshot = (overrides: Partial<WidgetSnapshot> = {}): WidgetSnapshot => ({
  asOf: "2026-09-28",
  timeZone: "Europe/Warsaw",
  periodEnd: "2026-10-09",
  available: 123_456,
  todayLeft: 10_288,
  hidden: false,
  ...overrides,
});

/** 28.09, 12:00 in Warsaw. */
const noon = new Date("2026-09-28T10:00:00Z");

describe("widgetContent", () => {
  it("today's amount, rounded down, and how far payday is", () => {
    expect(widgetContent(snapshot(), noon)).toEqual({
      kind: "amount",
      title: "Dziś możesz wydać",
      amount: zl("102 zł"),
      detail: "Wypłata za 12 dni",
    });
  });

  it("over today's plan: says by how much, rounded up", () => {
    expect(widgetContent(snapshot({ todayLeft: -4_510 }), noon)).toMatchObject({
      title: "Dziś ponad plan o",
      amount: zl("46 zł"),
    });
  });

  it("below the line for the period: says so like Start, not today's plan", () => {
    // Start shows „Jesteś pod kreską o …” and no today line; the widget too.
    expect(widgetContent(snapshot({ available: -101_201, todayLeft: -16_900 }), noon)).toEqual({
      kind: "amount",
      title: "Jesteś pod kreską o",
      amount: zl("1013 zł"),
      detail: "Wypłata za 12 dni",
    });
  });

  it("a snapshot saved by an older version (no balance) is not trusted", () => {
    const old = { ...snapshot() } as Partial<WidgetSnapshot>;
    delete old.available;
    expect(widgetContent(old as WidgetSnapshot, noon)).toMatchObject({ kind: "message" });
  });

  it("the period ends today: payday tomorrow; two days left: in 2 days", () => {
    expect(widgetContent(snapshot({ periodEnd: "2026-09-28" }), noon).detail).toBe("Wypłata jutro");
    expect(widgetContent(snapshot({ periodEnd: "2026-09-29" }), noon).detail).toBe(
      "Wypłata za 2 dni",
    );
  });

  it("privacy mode or app lock: the amount is hidden, the rest stays", () => {
    expect(widgetContent(snapshot({ hidden: true }), noon)).toMatchObject({
      amount: "•••",
      detail: "Wypłata za 12 dni",
    });
  });

  it("hidden: the title does not tell either — below the line or over today", () => {
    for (const s of [
      snapshot({ available: -500, hidden: true }),
      snapshot({ todayLeft: -500, hidden: true }),
    ]) {
      expect(widgetContent(s, noon)).toMatchObject({ title: "Twój budżet", amount: "•••" });
    }
  });

  it("numbers from another day are not shown — they would be wrong", () => {
    // 29.09, 0:30 in Warsaw: a new day, the budget has not been loaded yet.
    expect(widgetContent(snapshot(), new Date("2026-09-28T22:30:00Z"))).toEqual({
      kind: "message",
      title: "Finso",
      detail: "Otwórz Finso, żeby odświeżyć budżet.",
    });
  });

  it("nothing saved (signed out, never opened): asks to open the app", () => {
    expect(widgetContent(null, noon)).toEqual({
      kind: "message",
      title: "Finso",
      detail: "Otwórz Finso, żeby zobaczyć, ile możesz dziś wydać.",
    });
  });
});
