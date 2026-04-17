import { useEffect, useMemo, useState } from 'react';

/**
 * Enthalpy — two interactive modes:
 *  (1) Bond-energy ΔH: step through bonds broken vs. formed.
 *      ΔH ≈ Σ(bonds broken) − Σ(bonds formed).
 *  (2) Hess's Law: combine three known steps (multiply / reverse)
 *      to build a target reaction; live-check net stoichiometry.
 */

// ───── bond energy table (kJ/mol, AP chem standard values) ─────
const BE: Record<string, number> = {
  'H–H':   432,
  'O=O':   498,
  'C–H':   413,
  'C–C':   347,
  'C=C':   614,
  'C=O':   799, // in CO₂
  'O–H':   463,
  'N≡N':   941,
  'N–H':   391,
  'Cl–Cl': 243,
  'H–Cl':  432,
};

// Colors for bond types
const BOND_COLOR: Record<string, string> = {
  'H–H':   '#f0e6d2',
  'O=O':   '#ff5b3c',
  'C–H':   '#c9b58a',
  'C–C':   '#a0a0a0',
  'C=C':   '#8090a0',
  'C=O':   '#ffb06b',
  'O–H':   '#9bd5ff',
  'N≡N':   '#5dd0ff',
  'N–H':   '#b8e3ff',
  'Cl–Cl': '#69e36b',
  'H–Cl':  '#c9ee8f',
};

type Bond = { type: keyof typeof BE; count: number };
type RxnBE = {
  id: string;
  label: string;
  equation: React.ReactNode;
  broken: Bond[];
  formed: Bond[];
  literatureDH: number; // ΔH°rxn from ΔHf table for reference (kJ/mol fuel)
};

const BE_REACTIONS: RxnBE[] = [
  {
    id: 'methane',
    label: 'CH₄ combustion',
    equation: <>CH<sub>4</sub> + 2 O<sub>2</sub> → CO<sub>2</sub> + 2 H<sub>2</sub>O</>,
    broken: [{ type: 'C–H', count: 4 }, { type: 'O=O', count: 2 }],
    formed: [{ type: 'C=O', count: 2 }, { type: 'O–H', count: 4 }],
    literatureDH: -802, // per mol CH₄, gas-phase water
  },
  {
    id: 'ethane',
    label: 'C₂H₆ combustion',
    equation: <>2 C<sub>2</sub>H<sub>6</sub> + 7 O<sub>2</sub> → 4 CO<sub>2</sub> + 6 H<sub>2</sub>O</>,
    broken: [{ type: 'C–C', count: 2 }, { type: 'C–H', count: 12 }, { type: 'O=O', count: 7 }],
    formed: [{ type: 'C=O', count: 8 }, { type: 'O–H', count: 12 }],
    literatureDH: -2856,
  },
  {
    id: 'hcl',
    label: 'H₂ + Cl₂',
    equation: <>H<sub>2</sub> + Cl<sub>2</sub> → 2 HCl</>,
    broken: [{ type: 'H–H', count: 1 }, { type: 'Cl–Cl', count: 1 }],
    formed: [{ type: 'H–Cl', count: 2 }],
    literatureDH: -184,
  },
  {
    id: 'ammonia',
    label: 'Haber–Bosch',
    equation: <>N<sub>2</sub> + 3 H<sub>2</sub> → 2 NH<sub>3</sub></>,
    broken: [{ type: 'N≡N', count: 1 }, { type: 'H–H', count: 3 }],
    formed: [{ type: 'N–H', count: 6 }],
    literatureDH: -92,
  },
  {
    id: 'propane',
    label: 'C₃H₈ combustion',
    equation: <>C<sub>3</sub>H<sub>8</sub> + 5 O<sub>2</sub> → 3 CO<sub>2</sub> + 4 H<sub>2</sub>O</>,
    broken: [{ type: 'C–C', count: 2 }, { type: 'C–H', count: 8 }, { type: 'O=O', count: 5 }],
    formed: [{ type: 'C=O', count: 6 }, { type: 'O–H', count: 8 }],
    literatureDH: -2043,
  },
];

// ───── Hess's Law: target acetylene formation ─────
type HessStep = {
  id: string;
  equation: React.ReactNode;
  // signed species coefficients (negative = reactant)
  species: Record<string, number>;
  dH: number; // kJ
};

// Target: 2 C(s) + H₂(g) → C₂H₂(g),  ΔH°f = +227 kJ/mol
const HESS_TARGET = {
  label: '2 C(s) + H₂(g) → C₂H₂(g)',
  species: { 'C(s)': -2, 'H₂(g)': -1, 'C₂H₂(g)': 1 } as Record<string, number>,
  dH: 227,
};

const HESS_STEPS: HessStep[] = [
  {
    id: 'A',
    equation: <>C<sub>2</sub>H<sub>2</sub>(g) + 5⁄2 O<sub>2</sub>(g) → 2 CO<sub>2</sub>(g) + H<sub>2</sub>O(l)</>,
    species: { 'C₂H₂(g)': -1, 'O₂(g)': -2.5, 'CO₂(g)': 2, 'H₂O(l)': 1 },
    dH: -1300,
  },
  {
    id: 'B',
    equation: <>C(s) + O<sub>2</sub>(g) → CO<sub>2</sub>(g)</>,
    species: { 'C(s)': -1, 'O₂(g)': -1, 'CO₂(g)': 1 },
    dH: -394,
  },
  {
    id: 'C',
    equation: <>H<sub>2</sub>(g) + 1⁄2 O<sub>2</sub>(g) → H<sub>2</sub>O(l)</>,
    species: { 'H₂(g)': -1, 'O₂(g)': -0.5, 'H₂O(l)': 1 },
    dH: -286,
  },
];

// target multipliers that yield the solution: A reversed, B ×2, C ×1
const HESS_SOLUTION: Record<string, number> = { A: -1, B: 2, C: 1 };

// ───── main component ─────

export default function Enthalpy() {
  const [mode, setMode] = useState<'bond' | 'hess'>('bond');

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div role="tablist" aria-label="Mode" style={{ display: 'flex' }}>
        {(['bond', 'hess'] as const).map((m, i) => {
          const active = mode === m;
          return (
            <button
              key={m}
              role="tab"
              aria-selected={active}
              onClick={() => setMode(m)}
              className="mono"
              style={{
                padding: '10px 16px', fontSize: 11, letterSpacing: '0.14em',
                textTransform: 'uppercase',
                border: '1px solid var(--line-strong)',
                borderLeft: i === 0 ? '1px solid var(--line-strong)' : 0,
                background: active ? 'var(--paper)' : 'transparent',
                color: active ? 'var(--ink-0)' : 'var(--paper-dim)',
                fontWeight: active ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              {m === 'bond' ? 'Bond energy ΔH' : "Hess's Law"}
            </button>
          );
        })}
      </div>

      {mode === 'bond' ? <BondEnergyMode /> : <HessMode />}

      <div style={{
        padding: 14, borderLeft: '3px solid var(--phos)',
        background: 'var(--ink-1)', borderRadius: 4,
        fontSize: 12, color: 'var(--paper-dim)', lineHeight: 1.6,
      }}>
        <span className="eyebrow" style={{ color: 'var(--phos)' }}>Note · </span>
        Bond-energy ΔH uses <em>average</em> gas-phase bond enthalpies, so it is
        always an <em>estimate</em>. ΔH from standard enthalpies of formation
        (ΔH°<sub>f</sub>) uses measured compound values and is more accurate —
        especially when products contain liquids (e.g. H₂O(l) vs H₂O(g)).
      </div>
    </div>
  );
}

// ═══════════════════ BOND-ENERGY MODE ═══════════════════

function BondEnergyMode() {
  const [rxnId, setRxnId] = useState(BE_REACTIONS[0].id);
  const rxn = BE_REACTIONS.find(r => r.id === rxnId)!;

  // Flatten bonds into a sequence for stepping (broken first, then formed)
  const sequence = useMemo(() => flattenBonds(rxn), [rxnId]);
  const [step, setStep] = useState(0);
  const [auto, setAuto] = useState(false);

  useEffect(() => { setStep(0); setAuto(false); }, [rxnId]);

  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => {
      setStep(s => {
        if (s >= sequence.length) { setAuto(false); return s; }
        return s + 1;
      });
    }, 450);
    return () => clearInterval(id);
  }, [auto, sequence.length]);

  const brokenTotal = rxn.broken.reduce((s, b) => s + BE[b.type] * b.count, 0);
  const formedTotal = rxn.formed.reduce((s, b) => s + BE[b.type] * b.count, 0);
  const dH = brokenTotal - formedTotal;

  // Progress-so-far tally
  const runningBroken = sequence.slice(0, step).filter(x => x.side === 'broken')
    .reduce((s, x) => s + BE[x.type], 0);
  const runningFormed = sequence.slice(0, step).filter(x => x.side === 'formed')
    .reduce((s, x) => s + BE[x.type], 0);
  const runningDH = runningBroken - runningFormed;

  const totalEnergy = brokenTotal + formedTotal;
  const tallyPct = totalEnergy ? ((runningBroken + runningFormed) / totalEnergy) * 100 : 0;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Reaction tabs */}
      <div role="tablist" aria-label="Reaction" style={{ display: 'flex', flexWrap: 'wrap' }}>
        {BE_REACTIONS.map((r, i) => {
          const active = r.id === rxnId;
          return (
            <button
              key={r.id}
              role="tab"
              aria-selected={active}
              onClick={() => setRxnId(r.id)}
              className="mono"
              style={{
                padding: '8px 12px', fontSize: 10, letterSpacing: '0.14em',
                textTransform: 'uppercase',
                border: '1px solid var(--line-strong)',
                borderLeft: i === 0 ? '1px solid var(--line-strong)' : 0,
                background: active ? 'var(--paper)' : 'transparent',
                color: active ? 'var(--ink-0)' : 'var(--paper-dim)',
                fontWeight: active ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              {r.label}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 12 }}>
        <div className="serif" style={{ fontSize: 24, fontStyle: 'italic' }}>{rxn.equation}</div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--paper-dim)' }}>
          step {step} / {sequence.length}
        </div>
      </div>

      {/* Two-column bond visual */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <BondColumn
          label="Bonds broken"
          sub="Energy IN · positive"
          color="var(--hot)"
          bonds={rxn.broken}
          activeCount={countDone(sequence, step, 'broken')}
          subtotal={runningBroken}
          total={brokenTotal}
        />
        <BondColumn
          label="Bonds formed"
          sub="Energy OUT · negative"
          color="var(--cool)"
          bonds={rxn.formed}
          activeCount={countDone(sequence, step, 'formed')}
          subtotal={runningFormed}
          total={formedTotal}
        />
      </div>

      {/* Running tally bar */}
      <div style={{
        background: 'var(--ink-1)', border: '1px solid var(--line)',
        borderRadius: 6, padding: 16,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <div className="eyebrow">Running tally</div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--paper-dim)' }}>
            {runningBroken} − {runningFormed} = {fmtSigned(runningDH)} kJ
          </div>
        </div>
        <div style={{
          position: 'relative', height: 14, background: 'var(--ink-2)',
          borderRadius: 7, overflow: 'hidden', border: '1px solid var(--line)',
        }}>
          <div style={{
            position: 'absolute', inset: 0, width: `${tallyPct}%`,
            background: 'linear-gradient(90deg, var(--hot)cc 0%, var(--cool)cc 100%)',
            transition: 'width 300ms ease-out',
          }} />
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <ControlBtn onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}>← Back</ControlBtn>
          <ControlBtn
            onClick={() => setStep(s => Math.min(sequence.length, s + 1))}
            disabled={step >= sequence.length}
          >
            Step →
          </ControlBtn>
          <ControlBtn onClick={() => setAuto(a => !a)}>{auto ? '❚❚ Pause' : '▶ Auto'}</ControlBtn>
          <ControlBtn onClick={() => { setStep(0); setAuto(false); }}>↻ Reset</ControlBtn>
          <ControlBtn onClick={() => { setStep(sequence.length); setAuto(false); }}>⇥ All</ControlBtn>
        </div>
      </div>

      {/* Result + bond table */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        <ResultCard
          broken={brokenTotal}
          formed={formedTotal}
          dH={dH}
          literature={rxn.literatureDH}
        />
        <BondTable />
      </div>
    </div>
  );
}

function flattenBonds(rxn: RxnBE) {
  const seq: { side: 'broken' | 'formed'; type: string }[] = [];
  rxn.broken.forEach(b => { for (let i = 0; i < b.count; i++) seq.push({ side: 'broken', type: b.type }); });
  rxn.formed.forEach(b => { for (let i = 0; i < b.count; i++) seq.push({ side: 'formed', type: b.type }); });
  return seq;
}

function countDone(seq: ReturnType<typeof flattenBonds>, step: number, side: 'broken' | 'formed') {
  const map: Record<string, number> = {};
  seq.slice(0, step).filter(x => x.side === side).forEach(x => { map[x.type] = (map[x.type] ?? 0) + 1; });
  return map;
}

function BondColumn({ label, sub, color, bonds, activeCount, subtotal, total }: {
  label: string; sub: string; color: string;
  bonds: Bond[]; activeCount: Record<string, number>;
  subtotal: number; total: number;
}) {
  return (
    <div style={{
      background: 'var(--ink-1)', border: '1px solid var(--line)',
      borderRadius: 6, padding: 18,
    }}>
      <div className="eyebrow" style={{ color }}>{label}</div>
      <div style={{ fontSize: 11, color: 'var(--paper-dim)', marginTop: 4 }}>{sub}</div>

      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {bonds.map(b => {
          const done = activeCount[b.type] ?? 0;
          return (
            <div key={b.type}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <span className="mono" style={{ fontSize: 12 }}>
                  <span style={{ color: done >= b.count ? color : 'var(--paper)' }}>{done}</span>
                  <span style={{ color: 'var(--paper-faint)' }}> / {b.count}</span>
                  {' · '}
                  <span>{b.type}</span>
                </span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--paper-dim)' }}>
                  {BE[b.type]} kJ ea
                </span>
              </div>
              {/* Array of bond "sticks" */}
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {Array.from({ length: b.count }, (_, i) => {
                  const on = i < done;
                  return (
                    <div key={i} title={`${b.type}: ${BE[b.type]} kJ`}
                      style={{
                        position: 'relative',
                        width: 44, height: 14,
                        borderRadius: 7,
                        background: on ? BOND_COLOR[b.type] : 'transparent',
                        border: `1.5px solid ${on ? BOND_COLOR[b.type] : 'var(--line-strong)'}`,
                        opacity: on ? 1 : 0.45,
                        transition: 'background 200ms, opacity 200ms',
                        boxShadow: on ? `0 0 10px ${BOND_COLOR[b.type]}55` : 'none',
                      }}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{
        marginTop: 16, paddingTop: 12,
        borderTop: '1px solid var(--line)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      }}>
        <span className="eyebrow">Subtotal</span>
        <div>
          <span className="mono" style={{ fontSize: 12, color: 'var(--paper-dim)' }}>
            {subtotal} of{' '}
          </span>
          <span className="serif" style={{ fontSize: 22, color }}>
            {total} kJ
          </span>
        </div>
      </div>
    </div>
  );
}

function ResultCard({ broken, formed, dH, literature }: {
  broken: number; formed: number; dH: number; literature: number;
}) {
  const exo = dH < 0;
  return (
    <div style={{
      background: 'var(--ink-1)', border: `1px solid ${exo ? 'var(--hot)' : 'var(--cool)'}`,
      borderRadius: 6, padding: 22,
    }}>
      <div className="eyebrow">Result · ΔH = Σ(broken) − Σ(formed)</div>
      <div className="mono" style={{ fontSize: 16, color: 'var(--paper)', marginTop: 10 }}>
        <span style={{ color: 'var(--hot)' }}>{broken}</span>
        {' − '}
        <span style={{ color: 'var(--cool)' }}>{formed}</span>
        {' = '}
      </div>
      <div className="serif" style={{
        fontSize: 42, fontStyle: 'italic',
        color: exo ? 'var(--hot)' : 'var(--cool)', marginTop: 4,
      }}>
        {fmtSigned(dH)} kJ
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 10 }}>
        <div className="eyebrow" style={{ color: exo ? 'var(--hot)' : 'var(--cool)' }}>
          {exo ? 'EXOTHERMIC · releases heat' : 'ENDOTHERMIC · absorbs heat'}
        </div>
      </div>
      <div style={{
        marginTop: 14, paddingTop: 12,
        borderTop: '1px dashed var(--line)',
        fontSize: 11, color: 'var(--paper-dim)', lineHeight: 1.6,
      }}>
        <span className="mono">ΔH°<sub>rxn</sub> (from ΔH°<sub>f</sub> tables): </span>
        <span className="mono" style={{ color: 'var(--paper)' }}>{fmtSigned(literature)} kJ</span>
        <span> · diff {fmtSigned(dH - literature)} kJ (average-bond estimate vs. measured)</span>
      </div>
    </div>
  );
}

function BondTable() {
  const entries = Object.entries(BE);
  return (
    <div style={{
      background: 'var(--ink-1)', border: '1px solid var(--line)',
      borderRadius: 6, padding: 18,
    }}>
      <div className="eyebrow">Avg. bond enthalpies</div>
      <div style={{ fontSize: 11, color: 'var(--paper-dim)', marginTop: 2 }}>kJ · mol⁻¹</div>
      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 14px' }}>
        {entries.map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="mono" style={{ fontSize: 12, color: BOND_COLOR[k] }}>{k}</span>
            <span className="mono" style={{ fontSize: 12, color: 'var(--paper)' }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════ HESS'S LAW MODE ═══════════════════

function HessMode() {
  // Allowed multipliers: -2, -1, -1/2, 0, 1/2, 1, 2
  const MULTS = [-2, -1, -0.5, 0, 0.5, 1, 2];
  const [coefs, setCoefs] = useState<Record<string, number>>(
    () => Object.fromEntries(HESS_STEPS.map(s => [s.id, 0]))
  );

  const combined = useMemo(() => combineSpecies(coefs), [coefs]);
  const combinedDH = HESS_STEPS.reduce((s, step) => s + (coefs[step.id] ?? 0) * step.dH, 0);
  const match = speciesMatch(combined, HESS_TARGET.species);

  const setCoef = (id: string, next: number) => setCoefs(c => ({ ...c, [id]: next }));

  const cycleMult = (id: string, dir: 1 | -1) => {
    const cur = coefs[id] ?? 0;
    const idx = MULTS.indexOf(cur);
    const i = idx === -1 ? 3 : idx;
    const ni = Math.min(MULTS.length - 1, Math.max(0, i + dir));
    setCoef(id, MULTS[ni]);
  };

  const showSolution = () => setCoefs({ ...HESS_SOLUTION });
  const reset = () => setCoefs(Object.fromEntries(HESS_STEPS.map(s => [s.id, 0])));

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Target */}
      <div style={{
        background: 'var(--ink-1)', border: '1px solid var(--line-strong)',
        borderRadius: 6, padding: 18,
      }}>
        <div className="eyebrow">Target reaction · find ΔH°<sub>f</sub>(C₂H₂)</div>
        <div className="serif" style={{ fontSize: 26, fontStyle: 'italic', marginTop: 6 }}>
          2 C(s) + H<sub>2</sub>(g) → C<sub>2</sub>H<sub>2</sub>(g)
        </div>
      </div>

      {/* Step rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {HESS_STEPS.map(step => {
          const coef = coefs[step.id] ?? 0;
          const active = coef !== 0;
          const displayed = active ? {
            equation: renderStepEquation(step, coef),
            dH: coef * step.dH,
          } : null;
          return (
            <div key={step.id} style={{
              background: 'var(--ink-1)',
              border: `1px solid ${active ? 'var(--phos)' : 'var(--line)'}`,
              borderRadius: 6, padding: 16,
              display: 'grid', gridTemplateColumns: '40px 1fr auto', gap: 14, alignItems: 'center',
            }}>
              <div className="serif" style={{
                fontSize: 22, color: active ? 'var(--phos)' : 'var(--paper-dim)',
                fontStyle: 'italic', textAlign: 'center',
              }}>
                ({step.id})
              </div>
              <div>
                <div className="serif" style={{ fontSize: 17, fontStyle: 'italic' }}>
                  {step.equation}
                </div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--paper-dim)', marginTop: 4 }}>
                  ΔH = {fmtSigned(step.dH)} kJ
                  {active && (
                    <>
                      {'  ⟶  '}
                      <span style={{ color: 'var(--phos)' }}>{displayed!.equation}</span>
                      {'  ·  ΔH = '}
                      <span style={{ color: 'var(--phos)' }}>{fmtSigned(displayed!.dH)} kJ</span>
                    </>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <MiniBtn onClick={() => setCoef(step.id, coef === 0 ? 1 : 0)}>
                  {coef === 0 ? 'Use' : 'Skip'}
                </MiniBtn>
                <MiniBtn onClick={() => setCoef(step.id, -coef || -1)}>Reverse</MiniBtn>
                <MiniBtn onClick={() => cycleMult(step.id, 1)}>×2</MiniBtn>
                <MiniBtn onClick={() => cycleMult(step.id, -1)}>×½</MiniBtn>
                <div className="mono" style={{
                  fontSize: 13, width: 44, textAlign: 'center',
                  color: active ? 'var(--phos)' : 'var(--paper-faint)',
                }}>
                  ×{fmtMult(coef)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Net species + verdict */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16 }}>
        <div style={{
          background: 'var(--ink-1)', border: '1px solid var(--line)',
          borderRadius: 6, padding: 18,
        }}>
          <div className="eyebrow">Net equation (your combo)</div>
          <div className="serif" style={{ fontSize: 18, fontStyle: 'italic', marginTop: 10, minHeight: 28 }}>
            {renderNetEquation(combined)}
          </div>
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed var(--line)', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
            {Object.keys({ ...combined, ...HESS_TARGET.species }).sort().map(sp => {
              const got = combined[sp] ?? 0;
              const need = HESS_TARGET.species[sp] ?? 0;
              const ok = Math.abs(got - need) < 1e-6;
              return (
                <div key={sp} style={{ fontSize: 11 }}>
                  <div className="mono" style={{ color: ok ? 'var(--phos)' : 'var(--hot)' }}>
                    {sp}
                  </div>
                  <div className="mono" style={{ fontSize: 10, color: 'var(--paper-dim)' }}>
                    got {fmtMult(got)} · need {fmtMult(need)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{
          background: 'var(--ink-1)',
          border: `1px solid ${match ? 'var(--phos)' : 'var(--line)'}`,
          borderRadius: 6, padding: 18,
        }}>
          <div className="eyebrow" style={{ color: match ? 'var(--phos)' : 'var(--paper-dim)' }}>
            {match ? '✓ Matches target' : 'Not yet matching'}
          </div>
          <div className="serif" style={{
            fontSize: 36, fontStyle: 'italic', marginTop: 10,
            color: match ? 'var(--phos)' : 'var(--paper)',
          }}>
            ΔH = {fmtSigned(combinedDH)} kJ
          </div>
          {match && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--paper-dim)', lineHeight: 1.5 }}>
              Literature ΔH°<sub>f</sub>(C₂H₂) = +227 kJ/mol — off by{' '}
              <span className="mono" style={{ color: 'var(--paper)' }}>{fmtSigned(combinedDH - 227)}</span> kJ
              (rounding of component ΔH values).
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <ControlBtn onClick={showSolution}>Show solution</ControlBtn>
            <ControlBtn onClick={reset}>Reset</ControlBtn>
          </div>
        </div>
      </div>
    </div>
  );
}

// ───── Hess helpers ─────

function combineSpecies(coefs: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  HESS_STEPS.forEach(step => {
    const c = coefs[step.id] ?? 0;
    if (c === 0) return;
    Object.entries(step.species).forEach(([sp, v]) => {
      out[sp] = (out[sp] ?? 0) + c * v;
    });
  });
  // strip ~zero entries
  Object.keys(out).forEach(k => { if (Math.abs(out[k]) < 1e-6) delete out[k]; });
  return out;
}

function speciesMatch(a: Record<string, number>, b: Record<string, number>) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (Math.abs((a[k] ?? 0) - (b[k] ?? 0)) > 1e-6) return false;
  }
  return true;
}

function renderStepEquation(step: HessStep, coef: number): string {
  const reactants: string[] = [];
  const products: string[] = [];
  Object.entries(step.species).forEach(([sp, v]) => {
    const scaled = v * coef;
    if (scaled === 0) return;
    const token = `${fmtMult(Math.abs(scaled))} ${sp}`;
    if (scaled < 0) reactants.push(token);
    else products.push(token);
  });
  return `${reactants.join(' + ')} → ${products.join(' + ')}`;
}

function renderNetEquation(species: Record<string, number>): React.ReactNode {
  const entries = Object.entries(species);
  if (entries.length === 0) return <span style={{ color: 'var(--paper-faint)' }}>— select steps to build an equation —</span>;
  const reactants = entries.filter(([, v]) => v < 0).map(([sp, v]) => `${fmtMult(-v)} ${sp}`);
  const products = entries.filter(([, v]) => v > 0).map(([sp, v]) => `${fmtMult(v)} ${sp}`);
  return `${reactants.join(' + ') || '∅'} → ${products.join(' + ') || '∅'}`;
}

function fmtMult(n: number): string {
  if (n === 0) return '0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (Math.abs(abs - 0.5) < 1e-6) return `${sign}½`;
  if (Math.abs(abs - 1) < 1e-6) return `${sign}1`;
  if (Math.abs(abs - 1.5) < 1e-6) return `${sign}³⁄₂`;
  if (Math.abs(abs - 2.5) < 1e-6) return `${sign}⁵⁄₂`;
  if (Math.abs(abs - Math.round(abs)) < 1e-6) return `${sign}${Math.round(abs)}`;
  return `${sign}${abs.toFixed(1)}`;
}

function fmtSigned(n: number): string {
  if (n > 0) return `+${Math.round(n)}`;
  return `${Math.round(n)}`;
}

// ───── small UI atoms ─────

function ControlBtn({ children, onClick, disabled }: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="mono"
      style={{
        flex: 1,
        padding: '8px 10px', fontSize: 10, letterSpacing: '0.14em',
        textTransform: 'uppercase',
        border: '1px solid var(--line-strong)',
        background: 'transparent',
        color: disabled ? 'var(--paper-faint)' : 'var(--paper)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >{children}</button>
  );
}

function MiniBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mono"
      style={{
        padding: '5px 8px', fontSize: 9, letterSpacing: '0.1em',
        textTransform: 'uppercase',
        border: '1px solid var(--line-strong)',
        background: 'transparent', color: 'var(--paper)',
        cursor: 'pointer',
      }}
    >{children}</button>
  );
}
