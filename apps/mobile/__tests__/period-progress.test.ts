import { periodProgress } from "../src/dashboard/period-progress";

it("counts today as day N of the period and names the next payday", () => {
  expect(
    periodProgress({ period: { start: "2026-09-10", end: "2026-10-09" }, asOf: "2026-09-28" }),
  ).toEqual({ day: 19, totalDays: 30, ratio: 19 / 30, payday: "2026-10-10" });
});

it("the first day of the period is day 1, not 0", () => {
  expect(
    periodProgress({ period: { start: "2026-09-10", end: "2026-10-09" }, asOf: "2026-09-10" }),
  ).toMatchObject({ day: 1, totalDays: 30 });
});

it("the last day of the period fills the bar", () => {
  expect(
    periodProgress({ period: { start: "2026-09-10", end: "2026-10-09" }, asOf: "2026-10-09" }),
  ).toMatchObject({ day: 30, ratio: 1 });
});

it("handles a period across 29 February in a leap year", () => {
  expect(
    periodProgress({ period: { start: "2028-02-10", end: "2028-03-09" }, asOf: "2028-03-01" }),
  ).toEqual({ day: 21, totalDays: 29, ratio: 21 / 29, payday: "2028-03-10" });
});

it("a calendar-month period (periodStartDay = 1) ends before the 1st", () => {
  expect(
    periodProgress({ period: { start: "2026-12-01", end: "2026-12-31" }, asOf: "2026-12-15" }),
  ).toMatchObject({ totalDays: 31, payday: "2027-01-01" });
});
