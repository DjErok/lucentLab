import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Acid–Base — Brønsted-Lowry proton transfer simulator.
 * Pick an acid/base combo, set concentrations and stoichiometric mix,
 * watch H+ migrate from acid (or H3O+) to base (or its conjugate).
 * Live pH calc: SA/SB stoichiometric, WA via H-H, WB mirrored, WA/WB via pKa difference.
 */

type Strength = 'strong' | 'weak';
type Combo = {
  id: string;
  label: string;
  acid: { formula: string; display: React.ReactNode; strength: Strength; pKa: number };
  base: { formula: string; display: React.ReactNode; strength: Strength; pKb: number };
  conjA: React.ReactNode; // conjugate base of acid (A-)
  conjB: React.ReactNode; // conjugate acid of base (BH+)
  spectatorCation: string | null; // from the base side (e.g. Na+)
  spectatorAnion: string | null;  // from the acid side (e.g. Cl-)
  nieParts: React.ReactNode;
  spectatorList: string;
};

const COMBOS: Combo[] = [
  {
    id: 'sa-sb',
    label: 'HCl + NaOH',
    acid: { formula: 'HCl', display: <>HCl</>, strength: 'strong', pKa: -7 },
    base: { formula: 'NaOH', display: <>NaOH</>, strength: 'strong', pKb: -2 },
    conjA: <>Cl⁻</>,
    conjB: <>H₂O</>,
    spectatorCation: 'Na⁺',
    spectatorAnion: 'Cl⁻',
    nieParts: <>H⁺<sub>(aq)</sub> + OH⁻<sub>(aq)</sub> → H₂O<sub>(l)</sub></>,
    spectatorList: 'Na⁺, Cl⁻',
  },
  {
    id: 'wa-sb',
    label: 'CH₃COOH + NaOH',
    acid: { formula: 'CH3COOH', display: <>CH₃COOH</>, strength: 'weak', pKa: 4.76 },
    base: { formula: 'NaOH', display: <>NaOH</>, strength: 'strong', pKb: -2 },
    conjA: <>CH₃COO⁻</>,
    conjB: <>H₂O</>,
    spectatorCation: 'Na⁺',
    spectatorAnion: null,
    nieParts: <>CH₃COOH<sub>(aq)</sub> + OH⁻<sub>(aq)</sub> → CH₃COO⁻<sub>(aq)</sub> + H₂O<sub>(l)</sub></>,
    spectatorList: 'Na⁺',
  },
  {
    id: 'sa-wb',
    label: 'HCl + NH₃',
    acid: { formula: 'HCl', display: <>HCl</>, strength: 'strong', pKa: -7 },
    base: { formula: 'NH3', display: <>NH₃</>, strength: 'weak', pKb: 4.74 },
    conjA: <>Cl⁻</>,
    conjB: <>NH₄⁺</>,
    spectatorCation: null,
    spectatorAnion: 'Cl⁻',
    nieParts: <>H⁺<sub>(aq)</sub> + NH₃<sub>(aq)</sub> → NH₄⁺<sub>(aq)</sub></>,
    spectatorList: 'Cl⁻',
  },
  {
    id: 'wa-wb',
    label: 'CH₃COOH + NH₃',
    acid: { formula: 'CH3COOH', display: <>CH₃COOH</>, strength: 'weak', pKa: 4.76 },
    base: { formula: 'NH3', display: <>NH₃</>, strength: 'weak', pKb: 4.74 },
    conjA: <>CH₃COO⁻</>,
    conjB: <>NH₄⁺</>,
    spectatorCation: null,
    spectatorAnion: null,
    nieParts: <>CH₃COOH<sub>(aq)</sub> + NH₃<sub>(aq)</sub> → CH₃COO⁻<sub>(aq)</sub> + NH₄⁺<sub>(aq)</sub></>,
    spectatorList: '— (no spectators)',
  },
];

const COL_H = '#fbbf24';      // proton
const COL_OH = '#ff5b3c';     // OH oxygen
const COL_NA = '#c084fc';     // Na+
const COL_CL = '#69e36b';     // Cl-
const COL_C = '#7d8d99';      // carbon
const COL_N = '#5dd0ff';      // nitrogen
const COL_W = '#9bd5ff';      // water/hydrogen pale

export default function AcidBase() {
  const [comboId, setComboId] = useState(COMBOS[0].id);
  const combo = COMBOS.find(c => c.id === comboId)!;

  const [acidM, setAcidM] = useState(0.5);   // [acid] in M
  const [baseM, setBaseM] = useState(0.5);   // [base] in M
  const [mixPct, setMixPct] = useState(100); // % stoichiometric base added (0..200)
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1);

  // Animation clock
  const [phase, setPhase] = useState(0); // 0..1, loops
  const lastT = useRef(performance.now());
  useEffect(() => {
    let raf = 0;
    const loop = (now: number) => {
      const dt = (now - lastT.current) / 1000;
      lastT.current = now;
      if (running && !document.hidden) {
        setPhase(p => (p + dt * 0.25 * speed) % 1);
      }
      raf = requestAnimationFrame(loop);
    };
    lastT.current = performance.now();
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running, speed]);

  // ─── pH calculation ───
  const pH = useMemo(() => computePH(combo, acidM, baseM, mixPct), [combo, acidM, baseM, mixPct]);

  // Indicator color (phenolphthalein clear→pink at ~8.3, deep magenta by 10)
  const indicatorAlpha = clamp((pH - 8.3) / 1.7, 0, 0.55);
  const solutionTint = pH < 6.5
    ? `rgba(251,191,36,${0.10 + (6.5 - pH) * 0.025})`
    : pH > 8.3
      ? `rgba(236,72,153,${indicatorAlpha})`
      : 'rgba(155,213,255,0.10)';

  // Particle counts derived from concentrations
  const nAcid = Math.round(clamp(acidM, 0.01, 1) * 12) + 2;       // 2..14
  const nBase = Math.round(clamp(baseM, 0.01, 1) * 12 * (mixPct / 100)) + 1;

  // Reset
  const reset = () => { setAcidM(0.5); setBaseM(0.5); setMixPct(100); setSpeed(1); setRunning(true); setPhase(0); };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Reaction selector */}
      <div role="tablist" aria-label="Acid-Base combo" style={{ display: 'flex', flexWrap: 'wrap' }}>
        {COMBOS.map((c, i) => {
          const active = c.id === comboId;
          return (
            <button
              key={c.id}
              role="tab"
              aria-selected={active}
              onClick={() => { setComboId(c.id); setPhase(0); }}
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
              {c.label}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
        <div className="serif" style={{ fontSize: 24, fontStyle: 'italic' }}>
          {combo.acid.display}<sub>(aq)</sub> + {combo.base.display}<sub>(aq)</sub> → {combo.conjA}<sub>(aq)</sub> + {combo.conjB}
          {combo.id === 'sa-sb' && <span style={{ color: 'var(--paper-dim)' }}> · (+ Na⁺, Cl⁻)</span>}
        </div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--paper-dim)' }}>
          {combo.acid.strength} acid · {combo.base.strength} base
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16 }}>
        {/* Beaker scene */}
        <div style={{
          background: 'var(--ink-1)', border: '1px solid var(--line)',
          borderRadius: 6, padding: 18, position: 'relative', overflow: 'hidden',
          aspectRatio: '1.4 / 1',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="eyebrow">Particulate · proton transfer</div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--paper-dim)' }}>
              t = {(phase * 100).toFixed(0)}%
            </div>
          </div>

          <BeakerScene combo={combo} nAcid={nAcid} nBase={nBase} phase={phase} solutionTint={solutionTint} />
        </div>

        {/* pH meter */}
        <div style={{
          background: 'var(--ink-1)', border: '1px solid var(--line)',
          borderRadius: 6, padding: 20, display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div className="eyebrow">pH meter</div>
          <div className="serif" style={{ fontSize: 56, lineHeight: 1, color: phColor(pH) }}>
            {pH.toFixed(2)}
          </div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--paper-dim)' }}>
            [H⁺] ≈ 10<sup>{(-pH).toFixed(2)}</sup> M · [OH⁻] ≈ 10<sup>{(pH - 14).toFixed(2)}</sup> M
          </div>

          <PHBar pH={pH} />

          <div style={{ paddingTop: 8, borderTop: '1px solid var(--line)' }}>
            <div className="eyebrow">Phenolphthalein</div>
            <div style={{
              marginTop: 6, height: 22, borderRadius: 3,
              background: pH > 8.3
                ? `linear-gradient(90deg, rgba(236,72,153,${0.3 + indicatorAlpha}), rgba(236,72,153,${0.6 + indicatorAlpha * 0.4}))`
                : 'rgba(245,241,232,0.06)',
              border: '1px solid var(--line)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'JetBrains Mono', fontSize: 10, letterSpacing: '0.12em',
              color: pH > 8.3 ? '#fff' : 'var(--paper-dim)',
            }}>
              {pH > 8.3 ? 'PINK · BASIC' : 'COLORLESS · ≤ 8.3'}
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div style={{
        background: 'var(--ink-1)', border: '1px solid var(--line)',
        borderRadius: 6, padding: 20,
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18,
      }}>
        <Slider label={`[${combo.acid.formula}] · M`} value={acidM} min={0.01} max={1} step={0.01}
                onChange={setAcidM} accent="var(--acid)" fmt={v => v.toFixed(2)} />
        <Slider label={`[${combo.base.formula}] · M`} value={baseM} min={0.01} max={1} step={0.01}
                onChange={setBaseM} accent="var(--base)" fmt={v => v.toFixed(2)} />
        <Slider label="Base added · % stoich" value={mixPct} min={0} max={200} step={1}
                onChange={setMixPct} accent="var(--phos)" fmt={v => `${v.toFixed(0)}%`} />
        <Slider label="Animation speed" value={speed} min={0.1} max={3} step={0.1}
                onChange={setSpeed} accent="var(--paper-dim)" fmt={v => `${v.toFixed(1)}×`} />
        <div style={{ gridColumn: 'span 2', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <ControlBtn onClick={() => setRunning(r => !r)}>{running ? '❚❚ Pause' : '▶ Play'}</ControlBtn>
          <ControlBtn onClick={reset}>↻ Reset</ControlBtn>
        </div>
      </div>

      {/* Net ionic + conjugate pairs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        <div style={{
          background: 'var(--ink-1)', border: '1px solid var(--line)',
          borderRadius: 6, padding: 20,
        }}>
          <div className="eyebrow">Net ionic equation</div>
          <div className="serif" style={{ fontSize: 22, fontStyle: 'italic', marginTop: 8 }}>
            {combo.nieParts}
          </div>
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
            <div className="eyebrow">Spectator ions</div>
            <div className="mono" style={{ fontSize: 12, color: 'var(--paper-dim)', marginTop: 4 }}>
              {combo.spectatorList}
            </div>
          </div>
        </div>

        <div style={{
          background: 'var(--ink-1)', border: '1px solid var(--line)',
          borderRadius: 6, padding: 20,
        }}>
          <div className="eyebrow">Conjugate pairs</div>
          <ConjugateRow label="Acid pair" left={combo.acid.display} right={combo.conjA}
                        leftHint="HA · proton donor" rightHint="A⁻ · conjugate base" color="var(--acid)" />
          <ConjugateRow label="Base pair" left={combo.conjB} right={combo.base.display}
                        leftHint="BH⁺ · conjugate acid" rightHint="B · proton acceptor" color="var(--base)" />
        </div>
      </div>
    </div>
  );
}

// ─── pH math ───

function computePH(combo: Combo, Ca: number, Cb: number, mixPct: number): number {
  const Kw = 1e-14;
  const Cb_eff = Cb * (mixPct / 100);
  // Stoichiometric "moles" (per L, equal volumes assumption — simplification standard in AP problems)
  // Strong–strong
  if (combo.acid.strength === 'strong' && combo.base.strength === 'strong') {
    const diff = Ca - Cb_eff;
    if (Math.abs(diff) < 1e-9) return 7;
    if (diff > 0) {
      const H = diff;
      return -Math.log10(H + Math.sqrt(H * H + 4 * Kw) / 2 || H);
    } else {
      const OH = -diff;
      const pOH = -Math.log10(OH);
      return 14 - pOH;
    }
  }

  // Weak acid + strong base (e.g. HA + OH-)
  if (combo.acid.strength === 'weak' && combo.base.strength === 'strong') {
    const Ka = Math.pow(10, -combo.acid.pKa);
    const HA0 = Ca, OH0 = Cb_eff;
    if (OH0 < HA0 - 1e-9) {
      // Buffer region: Henderson–Hasselbalch (use unreacted HA and produced A-)
      const HA = HA0 - OH0, A = OH0;
      if (A < 1e-6) {
        // very little base — pure weak acid
        return weakAcidPH(HA0, Ka);
      }
      return combo.acid.pKa + Math.log10(A / HA);
    } else if (Math.abs(OH0 - HA0) < 1e-9) {
      // Equivalence: A- alone, hydrolyzes
      const A = HA0;
      const Kb = Kw / Ka;
      const OH = Math.sqrt(Kb * A);
      return 14 - (-Math.log10(OH));
    } else {
      // Past equivalence: excess strong base dominates
      const OHex = OH0 - HA0;
      return 14 - (-Math.log10(OHex));
    }
  }

  // Strong acid + weak base (mirror)
  if (combo.acid.strength === 'strong' && combo.base.strength === 'weak') {
    const Kb = Math.pow(10, -combo.base.pKb);
    const Ka_BH = Kw / Kb;
    const pKa_BH = -Math.log10(Ka_BH);
    const H0 = Ca, B0 = Cb_eff;
    if (H0 > B0 - 1e-9 && Math.abs(H0 - B0) > 1e-9) {
      // Excess strong acid
      return -Math.log10(H0 - B0);
    } else if (Math.abs(H0 - B0) < 1e-9) {
      // Equivalence — only BH+
      const BH = B0;
      const H = Math.sqrt(Ka_BH * BH);
      return -Math.log10(H);
    } else {
      // Buffer region: BH+ / B
      const BH = H0, B = B0 - H0;
      if (BH < 1e-6) return weakBasePH(B0, Kb);
      return pKa_BH + Math.log10(B / BH);
    }
  }

  // Weak + weak — approximate equilibrium pH = ½(pKa(HA) + pKa(BH+))
  // adjusted by log of ratio when off-stoichiometric.
  {
    const Kb = Math.pow(10, -combo.base.pKb);
    const pKa_BH = -Math.log10(Kw / Kb);
    const r = Cb_eff / Math.max(Ca, 1e-9);
    const base = 0.5 * (combo.acid.pKa + pKa_BH);
    // Slight skew when mix is off (qualitatively correct trend)
    const skew = 0.5 * Math.log10(Math.max(r, 1e-3));
    return clamp(base + skew, 0, 14);
  }
}

function weakAcidPH(C: number, Ka: number) {
  const H = (-Ka + Math.sqrt(Ka * Ka + 4 * Ka * C)) / 2;
  return -Math.log10(Math.max(H, 1e-14));
}
function weakBasePH(C: number, Kb: number) {
  const OH = (-Kb + Math.sqrt(Kb * Kb + 4 * Kb * C)) / 2;
  return 14 - (-Math.log10(Math.max(OH, 1e-14)));
}

function clamp(x: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, x)); }

function phColor(pH: number) {
  if (pH < 4) return 'var(--acid)';
  if (pH > 10) return 'var(--base)';
  if (pH < 6.5 || pH > 7.5) return 'var(--phos)';
  return 'var(--phos)';
}

// ─── visual components ───

function BeakerScene({ combo, nAcid, nBase, phase, solutionTint }: {
  combo: Combo; nAcid: number; nBase: number; phase: number; solutionTint: string;
}) {
  // Layout: beaker fills inner region. Acid molecules on left, base on right, spectators float top.
  // Phase loops 0..1 — proton-transfer cycle:
  //   0.0–0.3: H+ separating from acid
  //   0.3–0.7: H+ migrating across
  //   0.7–1.0: bound to base / conjugate forming
  // Wave a small offset by index so molecules cycle out-of-phase.

  const W = 100, H = 100; // percent units in svg viewBox 0..100

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: '38px 14px 14px', width: 'calc(100% - 28px)', height: 'calc(100% - 52px)' }}>
      {/* beaker outline */}
      <defs>
        <linearGradient id="ab-tint" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={solutionTint} />
          <stop offset="100%" stopColor={solutionTint} />
        </linearGradient>
      </defs>
      <path d={`M 6 12 L 8 92 L 92 92 L 94 12`} fill="none" stroke="var(--line-strong)" strokeWidth="0.4" />
      <rect x="8" y="20" width="84" height="72" fill="url(#ab-tint)" opacity="0.95" />
      {/* meniscus */}
      <line x1="8" y1="20" x2="92" y2="20" stroke="rgba(245,241,232,0.25)" strokeWidth="0.4" />

      {/* Region eyebrows */}
      <text x="10" y="16" fontFamily="JetBrains Mono" fontSize="2.4" fill="var(--acid)" letterSpacing="0.4">ACID · {combo.acid.formula}</text>
      <text x="90" y="16" textAnchor="end" fontFamily="JetBrains Mono" fontSize="2.4" fill="var(--base)" letterSpacing="0.4">BASE · {combo.base.formula}</text>

      {/* Spectators floating on top band */}
      {Array.from({ length: Math.min(nAcid, 6) }).map((_, i) => combo.spectatorAnion && (
        <SpectatorIon key={`sa-${i}`} x={14 + (i * 12) % 70} y={26 + ((i * 7) % 6)}
                      label={combo.spectatorAnion} color={COL_CL} phase={phase} idx={i} />
      ))}
      {Array.from({ length: Math.min(nBase, 6) }).map((_, i) => combo.spectatorCation && (
        <SpectatorIon key={`sc-${i}`} x={20 + (i * 11) % 60} y={32 + ((i * 5) % 6)}
                      label={combo.spectatorCation} color={COL_NA} phase={phase} idx={i + 3} />
      ))}

      {/* Acid molecules — proton donors */}
      {Array.from({ length: nAcid }).map((_, i) => {
        const localPhase = (phase + i * 0.07) % 1;
        const ax = 14 + (i % 4) * 8 + ((i / 4) | 0) * 2;
        const ay = 50 + (i % 3) * 12 + ((i / 6) | 0) * 5;
        return <AcidMolecule key={`a-${i}`} x={ax} y={ay} combo={combo} phase={localPhase} />;
      })}

      {/* Base molecules — proton acceptors */}
      {Array.from({ length: nBase }).map((_, i) => {
        const localPhase = (phase + 0.5 + i * 0.07) % 1;
        const bx = 64 + (i % 4) * 6 + ((i / 4) | 0) * 2;
        const by = 50 + (i % 3) * 12 + ((i / 6) | 0) * 5;
        return <BaseMolecule key={`b-${i}`} x={bx} y={by} combo={combo} phase={localPhase} />;
      })}

      {/* migrating protons */}
      {Array.from({ length: Math.min(nAcid, nBase) }).map((_, i) => {
        const localPhase = (phase + i * 0.1) % 1;
        if (localPhase < 0.25 || localPhase > 0.75) return null;
        const k = (localPhase - 0.25) / 0.5;
        const sx = 22 + (i % 4) * 8;
        const ex = 68 + (i % 4) * 6;
        const sy = 56 + (i % 3) * 12;
        const ey = 56 + (i % 3) * 12;
        const x = sx + (ex - sx) * k;
        const y = sy + (ey - sy) * k - Math.sin(k * Math.PI) * 8;
        return (
          <g key={`p-${i}`}>
            <circle cx={x} cy={y} r={2.2} fill={COL_H} opacity="0.95" />
            <circle cx={x} cy={y} r={3.6} fill={COL_H} opacity="0.25" />
            <text x={x} y={y + 0.7} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="1.6" fill="#0a0908" fontWeight="700">H⁺</text>
          </g>
        );
      })}
    </svg>
  );
}

function SpectatorIon({ x, y, label, color, phase, idx }: { x: number; y: number; label: string; color: string; phase: number; idx: number }) {
  const drift = Math.sin((phase + idx * 0.2) * Math.PI * 2) * 1.2;
  return (
    <g transform={`translate(${x} ${y + drift})`}>
      <circle r={2.6} fill={color} opacity="0.9" />
      <text y={0.8} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="1.7" fontWeight="700" fill="#0a0908">{label}</text>
    </g>
  );
}

function AcidMolecule({ x, y, combo, phase }: { x: number; y: number; combo: Combo; phase: number }) {
  // For phase 0..0.25: acid intact (HA). 0.25..0.75: H+ has departed → A-. 0.75..1: re-forms (cycle reset)
  const departed = phase >= 0.2 && phase < 0.85;
  const isAcetic = combo.acid.formula === 'CH3COOH';

  return (
    <g transform={`translate(${x} ${y})`}>
      {/* main body */}
      {isAcetic ? (
        <g>
          <circle cx={-2.6} cy={0} r={1.8} fill={COL_C} />
          <text x={-2.6} y={0.6} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="1.4" fontWeight="700" fill="#0a0908">C</text>
          <circle cx={1.4} cy={-1.4} r={1.6} fill={COL_OH} opacity="0.85" />
          <circle cx={1.4} cy={1.6} r={1.6} fill={COL_OH} opacity="0.85" />
          <text x={1.4} y={-0.9} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="1.2" fontWeight="700" fill="#0a0908">O</text>
          <text x={1.4} y={2.1} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="1.2" fontWeight="700" fill="#0a0908">O</text>
        </g>
      ) : (
        // HCl — chloride core
        <g>
          <circle r={2.4} fill={COL_CL} />
          <text y={0.7} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="1.6" fontWeight="700" fill="#0a0908">Cl</text>
        </g>
      )}
      {/* the labile proton */}
      {!departed && (
        <g>
          <circle cx={3.4} cy={-2.4} r={1.3} fill={COL_H} />
          <text x={3.4} y={-2} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="1.1" fontWeight="700" fill="#0a0908">H</text>
        </g>
      )}
      {/* charge label when departed */}
      {departed && (
        <text x={isAcetic ? 4 : 3.2} y={-2.6} fontFamily="JetBrains Mono" fontSize="1.4" fill={isAcetic ? 'var(--acid)' : COL_CL}>−</text>
      )}
    </g>
  );
}

function BaseMolecule({ x, y, combo, phase }: { x: number; y: number; combo: Combo; phase: number }) {
  // Phase 0..0.2: base alone. 0.2..0.85: bound H+ (conjugate acid / water). 0.85..1: releases.
  const bound = phase >= 0.25 && phase < 0.9;
  const isAmmonia = combo.base.formula === 'NH3';

  return (
    <g transform={`translate(${x} ${y})`}>
      {isAmmonia ? (
        <g>
          <circle r={2.4} fill={COL_N} />
          <text y={0.7} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="1.5" fontWeight="700" fill="#0a0908">N</text>
          {/* 3 H */}
          <circle cx={-2.6} cy={1.8} r={1} fill={COL_W} />
          <circle cx={2.6} cy={1.8} r={1} fill={COL_W} />
          <circle cx={0} cy={-2.6} r={1} fill={COL_W} />
        </g>
      ) : (
        // OH-
        <g>
          <circle r={2} fill={COL_OH} />
          <text y={0.6} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="1.4" fontWeight="700" fill="#0a0908">O</text>
          <circle cx={2.6} cy={1.4} r={1} fill={COL_W} />
        </g>
      )}
      {bound && (
        <g>
          <circle cx={3.4} cy={-2.4} r={1.3} fill={COL_H} />
          <text x={3.4} y={-2} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="1.1" fontWeight="700" fill="#0a0908">H</text>
          <text x={5.5} y={-2.6} fontFamily="JetBrains Mono" fontSize="1.4" fill={isAmmonia ? 'var(--base)' : 'var(--phos)'}>
            {isAmmonia ? '+' : ''}
          </text>
        </g>
      )}
    </g>
  );
}

function PHBar({ pH }: { pH: number }) {
  const pct = clamp(pH / 14, 0, 1) * 100;
  return (
    <div style={{ display: 'flex', gap: 12, height: 180, marginTop: 4 }}>
      <div style={{
        position: 'relative', width: 22, borderRadius: 3, overflow: 'hidden',
        background: 'linear-gradient(to top, #ff3d6d 0%, #fbbf24 30%, #69e36b 50%, #5dd0ff 72%, #a78bfa 100%)',
        border: '1px solid var(--line-strong)',
      }}>
        <div style={{
          position: 'absolute', left: -4, right: -4, bottom: `${pct}%`,
          height: 2, background: 'var(--paper)', boxShadow: '0 0 6px var(--paper)',
          transition: 'bottom 200ms ease-out',
        }} />
      </div>
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column-reverse', justifyContent: 'space-between',
        fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--paper-dim)',
      }}>
        {[
          { n: 0, lbl: 'strong acid' },
          { n: 3, lbl: 'acidic' },
          { n: 6, lbl: '' },
          { n: 7, lbl: 'NEUTRAL' },
          { n: 8, lbl: '' },
          { n: 11, lbl: 'basic' },
          { n: 14, lbl: 'strong base' },
        ].map(({ n, lbl }) => (
          <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 14, color: n === 7 ? 'var(--phos)' : undefined }}>{n}</span>
            <span style={{ opacity: 0.6, color: n < 7 ? 'var(--acid)' : n > 7 ? 'var(--base)' : 'var(--phos)' }}>{lbl}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConjugateRow({ label, left, right, leftHint, rightHint, color }: {
  label: string; left: React.ReactNode; right: React.ReactNode; leftHint: string; rightHint: string; color: string;
}) {
  return (
    <div style={{ marginTop: 12, padding: 10, border: `1px solid ${color}55`, background: `${color}10`, borderRadius: 4 }}>
      <div className="eyebrow" style={{ color }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
        <div style={{ flex: 1 }}>
          <div className="serif" style={{ fontSize: 18, fontStyle: 'italic', color }}>{left}</div>
          <div className="mono" style={{ fontSize: 9, color: 'var(--paper-faint)' }}>{leftHint}</div>
        </div>
        <div className="mono" style={{ fontSize: 14, color }}>⇌</div>
        <div style={{ flex: 1, textAlign: 'right' }}>
          <div className="serif" style={{ fontSize: 18, fontStyle: 'italic', color }}>{right}</div>
          <div className="mono" style={{ fontSize: 9, color: 'var(--paper-faint)' }}>{rightHint}</div>
        </div>
      </div>
    </div>
  );
}

// ─── small UI atoms ───

function ControlBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mono"
      style={{
        flex: 1,
        padding: '8px 10px', fontSize: 10, letterSpacing: '0.14em',
        textTransform: 'uppercase',
        border: '1px solid var(--line-strong)',
        background: 'transparent', color: 'var(--paper)',
        cursor: 'pointer',
      }}
    >{children}</button>
  );
}

function Slider({ label, value, min, max, step, onChange, accent, fmt }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; accent: string; fmt: (v: number) => string;
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span className="eyebrow">{label}</span>
        <span className="mono" style={{ fontSize: 11, color: accent }}>{fmt(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
             onChange={(e) => onChange(Number(e.target.value))}
             style={{ width: '100%', accentColor: accent }} />
    </div>
  );
}
