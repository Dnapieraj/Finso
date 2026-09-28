import { describe, expect, it } from "vitest";

import { INT4_MAX } from "../common/schemas.js";
import { parseMoneyInput } from "./parse-money-input.js";

describe("parseMoneyInput", () => {
  it.each([
    ["12", 1_200],
    ["12,5", 1_250],
    ["12,50", 1_250],
    ["12.50", 1_250],
    ["0,01", 1],
    [",5", 50],
    ["  45,90 ", 4_590],
    // Separators users type or paste: spaces and no-break spaces between thousands.
    ["1 234,56", 123_456],
    ["1\u00A0234,56", 123_456],
    ["12,", 1_200],
  ])("%j → %i gr", (input, grosze) => {
    expect(parseMoneyInput(input)).toEqual({ ok: true, grosze });
  });

  // Integer arithmetic on the digits, never parseFloat: 0.1 + 0.2 must not leak in.
  it("never goes through floats", () => {
    expect(parseMoneyInput("0,29")).toEqual({ ok: true, grosze: 29 });
    expect(parseMoneyInput("1,15")).toEqual({ ok: true, grosze: 115 });
    expect(parseMoneyInput("4,35")).toEqual({ ok: true, grosze: 435 });
  });

  it.each([
    ["", "empty"],
    ["   ", "empty"],
    ["0", "zero"],
    ["0,00", "zero"],
    ["12,345", "too-precise"],
    ["-5", "invalid"],
    ["abc", "invalid"],
    ["12,5,0", "invalid"],
    ["1e3", "invalid"],
    ["12 zł", "invalid"],
  ])("%j → %s", (input, reason) => {
    expect(parseMoneyInput(input)).toEqual({ ok: false, reason });
  });

  it("rejects amounts the database cannot store (int4)", () => {
    expect(parseMoneyInput("21474836,47")).toEqual({ ok: true, grosze: INT4_MAX });
    expect(parseMoneyInput("21474836,48")).toEqual({ ok: false, reason: "too-large" });
    expect(parseMoneyInput("99999999999999999999")).toEqual({ ok: false, reason: "too-large" });
  });
});
