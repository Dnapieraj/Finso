import { planReminders, type ReminderPreferences } from "../src/notifications/plan";
import { testDue, testIncomeSource, testRule } from "./helpers/fake-api";

/** formatMoney puts no-break spaces between digit groups and before "zł". */
const zl = (text: string) => text.replaceAll(" ", " ");

/** The defaults: every kind on, amounts hidden (the lock screen is public). */
const DEFAULTS: ReminderPreferences = {
  payday: true,
  payments: true,
  overdue: true,
  showAmounts: false,
};
const WITH_AMOUNTS: ReminderPreferences = { ...DEFAULTS, showAmounts: true };

/** 9:00 device time on a calendar day — when every reminder fires. */
const nineOn = (isoDate: string) => {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1, 9, 0);
};

const salary = testIncomeSource(); // 5000 zł on the 10th
const rent = testRule(); // 1500 zł on the 5th

/** 28.09, 8:00 — before the reminder hour, nothing answered. */
function plan(overrides: Partial<Parameters<typeof planReminders>[0]> = {}) {
  return planReminders({
    today: "2026-09-28",
    now: new Date(2026, 8, 28, 8, 0),
    incomeSources: [salary],
    rules: [rent],
    due: [],
    preferences: DEFAULTS,
    ...overrides,
  });
}

describe("dzień wypłaty i stałe płatności", () => {
  it("o 9:00 w dniu terminu, przez 30 dni naprzód, od najbliższego — domyślnie bez kwot", () => {
    expect(plan()).toEqual([
      {
        id: `payment:${rent.id}:2026-10-05`,
        at: nineOn("2026-10-05"),
        title: "Stała płatność",
        body: "Masz płatność do potwierdzenia: Czynsz",
      },
      {
        id: `payday:${salary.id}:2026-10-10`,
        at: nineOn("2026-10-10"),
        title: "Dzień wypłaty",
        body: "Wpływ do potwierdzenia: Wypłata",
      },
    ]);
  });

  it("z „Pokazuj kwoty”: treść jak na karcie, z kwotą", () => {
    expect(plan({ preferences: WITH_AMOUNTS }).map((r) => r.body)).toEqual([
      zl("Czynsz 1500 zł — zapłacone?"),
      zl("Wypłata 5000 zł — wpłynęło?"),
    ]);
  });

  it("bez kwot nie ma w treści żadnej kwoty ani „zł”", () => {
    for (const reminder of plan({ due: [testDue({ occurrenceDate: "2026-09-05" })] })) {
      expect(`${reminder.title} ${reminder.body}`).not.toMatch(/\d{2,}|zł/);
    }
  });

  it("horyzont 30 dni: termin 31. dnia czeka na następne otwarcie appki", () => {
    const reminders = plan({ rules: [testRule({ dayOfMonth: 29 })], incomeSources: [] });

    expect(reminders.map((r) => r.at)).toEqual([nineOn("2026-09-29")]);
    // 29.10 is 31 days after 28.09 — planned when the app is opened again.
  });

  it("kwota z groszami zostaje dokładna", () => {
    const [reminder] = plan({
      rules: [testRule({ expectedAmount: 161_250 })],
      incomeSources: [],
      preferences: WITH_AMOUNTS,
    });

    expect(reminder?.body).toBe(zl("Czynsz 1612,50 zł — zapłacone?"));
  });

  it("dzisiejszy termin: tylko jeśli czeka na odpowiedź i 9:00 jeszcze nie minęła", () => {
    const today = testRule({ dayOfMonth: 28 });
    const dueToday = testDue({ id: today.id, occurrenceDate: "2026-09-28" });

    expect(plan({ rules: [today], incomeSources: [], due: [dueToday] })[0]?.at).toEqual(
      nineOn("2026-09-28"),
    );
    // Already answered: no longer in the due list.
    expect(plan({ rules: [today], incomeSources: [], due: [] })[0]?.at).not.toEqual(
      nineOn("2026-09-28"),
    );
    // „Jeszcze nie” today: not asked again today.
    expect(
      plan({ rules: [today], incomeSources: [], due: [{ ...dueToday, askToday: false }] }).some(
        (r) => r.id.startsWith("payment:") && r.at.getTime() === nineOn("2026-09-28").getTime(),
      ),
    ).toBe(false);
    // After 9:00 a reminder for today would arrive in the past.
    expect(
      plan({
        rules: [today],
        incomeSources: [],
        due: [dueToday],
        now: new Date(2026, 8, 28, 9, 30),
      }).some((r) => r.at.getTime() === nineOn("2026-09-28").getTime()),
    ).toBe(false);
  });

  it("pomija wyłączone reguły, zarchiwizowane źródła i dochód nieregularny", () => {
    expect(
      plan({
        rules: [testRule({ isActive: false })],
        incomeSources: [
          testIncomeSource({ isActive: false }),
          testIncomeSource({
            kind: "IRREGULAR",
            expectedAmount: null,
            recurringRuleId: null,
            schedule: null,
          }),
        ],
      }),
    ).toEqual([]);
  });

  it("reguły dochodu z listy reguł nie dublują wypłaty — wypłata idzie ze źródła", () => {
    const salaryRule = testRule({
      id: salary.recurringRuleId ?? "",
      kind: "INCOME",
      name: null,
      dayOfMonth: 10,
      expectedAmount: null,
    });

    expect(plan({ rules: [rent, salaryRule] }).filter((r) => r.at.getDate() === 10)).toHaveLength(
      1,
    );
  });

  it("reguła zaczynająca się w przyszłości nie przypomina przed startem", () => {
    const later = testRule({ startDate: "2026-11-01", dayOfMonth: 5 });

    expect(plan({ rules: [later], incomeSources: [] })).toEqual([]);
  });
});

describe("zaległe pozycje", () => {
  const overdueRent = testDue({ occurrenceDate: "2026-09-05", overdue: true });
  const notYetSalary = testDue({
    kind: "INCOME",
    id: salary.id,
    label: "Wypłata",
    occurrenceDate: "2026-09-28",
    askToday: false,
  });

  it("codziennie o 9:00 przez 7 dni od jutra, z liczbą czekających pozycji", () => {
    const overdue = plan({ incomeSources: [], rules: [], due: [overdueRent, notYetSalary] });

    expect(overdue.map((r) => r.at)).toEqual(
      ["29", "30"]
        .map((d) => `2026-09-${d}`)
        .concat(["01", "02", "03", "04", "05"].map((d) => `2026-10-${d}`))
        .map(nineOn),
    );
    expect(overdue[0]).toEqual({
      id: "overdue:2026-09-29",
      at: nineOn("2026-09-29"),
      title: "Czeka na potwierdzenie",
      body: "2 pozycje czekają na odpowiedź.",
    });
  });

  it("odmiana: 1 pozycja czeka, 5 pozycji czeka", () => {
    const one = plan({ incomeSources: [], rules: [], due: [overdueRent] });
    const five = plan({
      incomeSources: [],
      rules: [],
      due: ["01", "02", "03", "04", "05"].map((d) =>
        testDue({ occurrenceDate: `2026-09-${d}`, overdue: true }),
      ),
    });

    expect(one[0]?.body).toBe("1 pozycja czeka na odpowiedź.");
    expect(five[0]?.body).toBe("5 pozycji czeka na odpowiedź.");
  });

  it("nic nie czeka: brak przypomnień o zaległych", () => {
    expect(plan({ incomeSources: [], rules: [] })).toEqual([]);
  });
});

describe("przełączniki", () => {
  const due = [testDue({ occurrenceDate: "2026-09-05", overdue: true })];
  const kinds = (preferences: ReminderPreferences) =>
    new Set(plan({ due, preferences }).map((r) => r.id.split(":")[0]));

  it("każdy rodzaj wyłącza się osobno", () => {
    expect(kinds(DEFAULTS)).toEqual(new Set(["payday", "payment", "overdue"]));
    expect(kinds({ ...DEFAULTS, payday: false })).toEqual(new Set(["payment", "overdue"]));
    expect(kinds({ ...DEFAULTS, payments: false })).toEqual(new Set(["payday", "overdue"]));
    expect(kinds({ ...DEFAULTS, overdue: false })).toEqual(new Set(["payday", "payment"]));
    expect(kinds({ ...DEFAULTS, payday: false, payments: false, overdue: false })).toEqual(
      new Set(),
    );
  });
});

it("najwyżej 60 przypomnień, najbliższe pierwsze (iOS trzyma 64 zaplanowane)", () => {
  // 14 weekly rules, two per weekday: about 63 payments in 31 days, plus the payday.
  const rules = Array.from({ length: 14 }, (_, i) =>
    testRule({
      id: `01923b6e-0000-7000-8000-0000000001${String(i).padStart(2, "0")}`,
      frequency: "WEEKLY",
      dayOfMonth: null,
      dayOfWeek: i % 7,
    }),
  );

  const reminders = plan({ rules });

  expect(reminders).toHaveLength(60);
  const times = reminders.map((r) => r.at.getTime());
  expect(times).toEqual([...times].sort((a, b) => a - b));
});
