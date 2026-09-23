import { describe, expect, it } from 'vitest';

import { grosze } from './money.js';

describe('grosze', () => {
  it('przyjmuje liczbę całkowitą', () => {
    expect(grosze(12345)).toBe(12345);
  });

  it('przyjmuje zero', () => {
    expect(grosze(0)).toBe(0);
  });

  it('przyjmuje wartości ujemne (deficyt to prawidłowa wartość)', () => {
    expect(grosze(-500)).toBe(-500);
  });

  it('rzuca dla liczby zmiennoprzecinkowej', () => {
    expect(() => grosze(12.5)).toThrow();
  });

  it('rzuca dla NaN', () => {
    expect(() => grosze(NaN)).toThrow();
  });

  it('rzuca dla Infinity', () => {
    expect(() => grosze(Infinity)).toThrow();
    expect(() => grosze(-Infinity)).toThrow();
  });
});
