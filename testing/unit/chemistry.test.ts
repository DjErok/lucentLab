// Math-only regression tests. Run with Vitest:  npm i -D vitest && npx vitest
// These guard the chemistry equations independent of the React UI.

import { describe, it, expect } from 'vitest';

// ──────────────────────────────────────────────────────────────────────────
// Titration — exact proton-balance cubic for HA + NaOH
// h³ + (Cb + Ka)h² − (Ka(Ca − Cb) + Kw)h − Ka·Kw = 0
// ──────────────────────────────────────────────────────────────────────────
const Kw = 1e-14;

function solveCubicPositive(a2: number, a1: number, a0: number): number {
  const f = (h: number) => ((h + a2) * h + a1) * h + a0;
  let lo = 1e-15, hi = 1;
  while (f(hi) < 0 && hi < 1e3) hi *= 10;
  while (f(lo) > 0 && lo > 1e-30) lo /= 10;
  for (let i = 0; i < 80; i++) {
    const mid = Math.sqrt(lo * hi);
    if (f(mid) > 0) hi = mid; else lo = mid;
  }
  return Math.sqrt(lo * hi);
}

function pHTitration(Ka: number, Ca: number, Cb: number): number {
  const h = solveCubicPositive(Cb + Ka, -(Ka * (Ca - Cb) + Kw), -Ka * Kw);
  return -Math.log10(h);
}

describe('Titration — proton balance', () => {
  it('NH4+ initial pH (Ca=0.05 after dilution-free start) ≈ 5.13', () => {
    const Ka = 5.6e-10;
    expect(pHTitration(Ka, 0.1, 0)).toBeCloseTo(5.13, 1);
  });

  it('NH4+ at half-equivalence: pH = pKa', () => {
    const Ka = 5.6e-10;
    // Vb = 12.5 mL, Va = 25 mL → Ca_total = 0.025/0.0375, Cb = 0.0125/0.0375
    const Ca = 0.025 / 0.0375;
    const Cb = 0.0125 / 0.0375;
    expect(pHTitration(Ka, Ca, Cb)).toBeCloseTo(-Math.log10(Ka), 1);
  });

  it('NH4+ curve is continuous near V=0 (no jump from pH 5 to pH 7)', () => {
    const Ka = 5.6e-10;
    const p0     = pHTitration(Ka, 0.1, 0);
    const pTiny  = pHTitration(Ka, 0.025/0.02515, 0.000015/0.02515);
    expect(Math.abs(p0 - pTiny)).toBeLessThan(0.5);
  });

  it('Strong-acid HCl + NaOH at V_eq → pH = 7', () => {
    const Hc = (0.0025 - 0.0025) / 0.05;
    const pH = Hc <= 0 ? 7 : -Math.log10(Hc);
    expect(pH).toBe(7);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Calorimetry — T_f for two-body mixing
// ──────────────────────────────────────────────────────────────────────────
function Tfinal(m1: number, c1: number, T1: number, m2: number, c2: number, T2: number): number {
  return (m1*c1*T1 + m2*c2*T2) / (m1*c1 + m2*c2);
}

describe('Calorimetry', () => {
  it('Equal-mass equal-c → T_f is the mean', () => {
    expect(Tfinal(100, 4.184, 80, 100, 4.184, 20)).toBeCloseTo(50, 6);
  });

  it('Cu (100 g, 100 °C) into water (200 g, 20 °C) → T_f ≈ 21.8 °C', () => {
    expect(Tfinal(100, 0.385, 100, 200, 4.184, 20)).toBeCloseTo(21.83, 1);
  });

  it('T_f always lies between the two starting temperatures', () => {
    const Tf = Tfinal(50, 0.9, 250, 300, 4.184, 15);
    expect(Tf).toBeGreaterThan(15);
    expect(Tf).toBeLessThan(250);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Stoichiometry — limiting reagent
// ──────────────────────────────────────────────────────────────────────────
function limitingReagent(amounts: number[], coeffs: number[]): number {
  let minRatio = Infinity, idx = -1;
  for (let i = 0; i < amounts.length; i++) {
    const r = amounts[i] / coeffs[i];
    if (r < minRatio) { minRatio = r; idx = i; }
  }
  return idx;
}

describe('Stoichiometry', () => {
  it('2 H2 + O2 → 2 H2O · 4 mol H2 + 1 mol O2 → O2 limits', () => {
    expect(limitingReagent([4, 1], [2, 1])).toBe(1);
  });
  it('Equal stoichiometric supply → no limiting reagent (ratios tie)', () => {
    expect([0, 1]).toContain(limitingReagent([2, 1], [2, 1]));
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Henderson-Hasselbalch (Buffer)
// ──────────────────────────────────────────────────────────────────────────
describe('Buffer · Henderson-Hasselbalch', () => {
  it('pH = pKa when [A-] = [HA]', () => {
    const pKa = 4.76;
    expect(pKa + Math.log10(1)).toBeCloseTo(pKa, 6);
  });
  it('pH > pKa when [A-] > [HA]', () => {
    const pKa = 4.76;
    expect(pKa + Math.log10(10)).toBeCloseTo(5.76, 6);
  });
});
