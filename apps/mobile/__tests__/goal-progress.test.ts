import { goalProgress } from "../src/dashboard/goal-progress";

const goal = {
  id: "01923b6e-0000-7000-8000-000000000010",
  name: "Wakacje",
  targetAmount: 400_000,
  currentAmount: 100_000,
  targetDate: "2027-06-01",
};

it("reports progress as a whole percent", () => {
  expect(goalProgress(goal, "2026-09-28")).toEqual({ percent: 25, state: "on-track" });
});

// Rounded down: 99.9% must not read as done.
it("rounds the percent down", () => {
  expect(goalProgress({ ...goal, currentAmount: 399_999 }, "2026-09-28").percent).toBe(99);
});

it("a goal with nothing saved yet is at 0%", () => {
  expect(goalProgress({ ...goal, currentAmount: 0 }, "2026-09-28").percent).toBe(0);
});

it("caps at 100% and marks the goal reached when saved more than the target", () => {
  expect(goalProgress({ ...goal, currentAmount: 450_000 }, "2026-09-28")).toEqual({
    percent: 100,
    state: "reached",
  });
});

it("marks an unfinished goal past its date as overdue", () => {
  expect(goalProgress({ ...goal, targetDate: "2026-09-27" }, "2026-09-28").state).toBe("overdue");
});

it("the target date itself is not overdue yet", () => {
  expect(goalProgress({ ...goal, targetDate: "2026-09-28" }, "2026-09-28").state).toBe("on-track");
});

it("a reached goal is never overdue", () => {
  expect(
    goalProgress({ ...goal, currentAmount: 400_000, targetDate: "2026-01-01" }, "2026-09-28").state,
  ).toBe("reached");
});

it("without today's date (budget not loaded) it cannot tell overdue", () => {
  expect(goalProgress({ ...goal, targetDate: "2026-01-01" }, null).state).toBe("on-track");
});
