import { useEffect, useMemo, useRef, useState } from 'react';
import UISlider from '../components/ui/Slider';
import SlideTabs from '../components/ui/SlideTabs';

/**
 * Acid–Base — Brønsted-Lowry proton transfer simulator.
 * Pick an acid/base combo, choose which side starts in the flask,
 * add the opposite reagent incrementally, and watch neutralization progress.
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

type PourBatch = {
  kind: 'acid' | 'base';
  fromIndex: number;
  toIndex: number;
  phase: number;
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
const COL_W = '#f5f1e8';      // neutral hydrogen tone in molecules

export default function AcidBase() {
  const FLASK_VOL_ML = 100;
  const [comboId, setComboId] = useState(COMBOS[0].id);
  const combo = COMBOS.find(c => c.id === comboId)!;

  const [startWith, setStartWith] = useState<'acid' | 'base'>('acid');
  const [acidM, setAcidM] = useState(0.5);   // [acid] in M
  const [baseM, setBaseM] = useState(0.5);   // [base] in M
  const [addedMl, setAddedMl] = useState(0); // added titrant volume (mL)
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [pourPulse, setPourPulse] = useState(0);
  const [pourBatch, setPourBatch] = useState<PourBatch | null>(null);

  // Animation clock
  const [phase, setPhase] = useState(0); // 0..1, one-way transfer timeline
  const [drift, setDrift] = useState(0); // 0..1, continuous Brownian-like drift
  const lastT = useRef(performance.now());
  useEffect(() => {
    let raf = 0;
    const loop = (now: number) => {
      const dt = (now - lastT.current) / 1000;
      lastT.current = now;
      if (running && !document.hidden) {
        setPhase(p => Math.min(1, p + dt * 0.25 * speed));
        setDrift(d => (d + dt * 0.22 * speed) % 1);
        setPourBatch(batch => batch ? { ...batch, phase: Math.min(1, batch.phase + dt * 0.30 * speed) } : batch);
      }
      setPourPulse(v => (v > 0 ? Math.max(0, v - dt * 2.4) : v));
      raf = requestAnimationFrame(loop);
    };
    lastT.current = performance.now();
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running, speed]);

  const startVolL = FLASK_VOL_ML / 1000;
  const addedVolL = addedMl / 1000;
  const totalVolL = startVolL + addedVolL;

  const acidMoles = startWith === 'acid' ? acidM * startVolL : acidM * addedVolL;
  const baseMoles = startWith === 'base' ? baseM * startVolL : baseM * addedVolL;
  // ─── pH calculation ───
  const pH = useMemo(() => computePH(combo, acidMoles, baseMoles, totalVolL), [combo, acidMoles, baseMoles, totalVolL]);

  // Indicator color (phenolphthalein clear→pink at ~8.3, deep magenta by 10)
  const indicatorAlpha = clamp((pH - 8.3) / 1.7, 0, 0.55);
  const solutionTint = pH < 6.5
    ? `rgba(251,191,36,${0.10 + (6.5 - pH) * 0.025})`
    : pH > 8.3
      ? `rgba(236,72,153,${indicatorAlpha})`
      : 'rgba(155,213,255,0.10)';

  // Particle counts derived from concentrations
  const nAcid = molesToParticles(acidMoles);
  const nBase = molesToParticles(baseMoles);

  // Reset
  const reset = () => {
    setAcidM(0.5);
    setBaseM(0.5);
    setAddedMl(0);
    setSpeed(1);
    setRunning(true);
    setPhase(0);
    setDrift(0);
    setPourPulse(0);
    setPourBatch(null);
  };

  const addTitrant = (stepMl: number) => {
    const titrant = startWith === 'acid' ? 'base' : 'acid';
    const molarity = titrant === 'acid' ? acidM : baseM;
    const next = clamp(addedMl + stepMl, 0, 200);
    const prevCount = molesToParticles(molarity * (addedMl / 1000));
    const nextCount = molesToParticles(molarity * (next / 1000));
    if (nextCount > prevCount) {
      setPourBatch({ kind: titrant, fromIndex: prevCount, toIndex: nextCount, phase: 0 });
      setPourPulse(1);
    } else if (nextCount < prevCount) {
      setPourBatch(null);
      setPourPulse(0);
    }
    setAddedMl(next);
    setRunning(true);
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Reaction selector */}
      <SlideTabs<string>
        tabs={COMBOS.map(c => ({ id: c.id, label: c.label }))}
        value={comboId}
        onChange={(id) => { setComboId(id); setAddedMl(0); setPhase(0); setDrift(0); setPourPulse(0); setPourBatch(null); }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
        <div className="serif" style={{ fontSize: 24, fontStyle: 'italic' }}>
          {combo.acid.display}<sub>(aq)</sub> + {combo.base.display}<sub>(aq)</sub> → {combo.conjA}<sub>(aq)</sub> + {combo.conjB}
          {combo.id === 'sa-sb' && <span style={{ color: 'var(--paper-dim)' }}> · (+ Na⁺, Cl⁻)</span>}
        </div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--paper-dim)' }}>
          {combo.acid.strength} acid · {combo.base.strength} base
        </div>
      </div>
      <div className="mono" style={{ fontSize: 11, color: 'var(--paper-dim)' }}>
        Start with {startWith === 'acid' ? `${combo.acid.formula}` : `${combo.base.formula}`} in flask · add {startWith === 'acid' ? combo.base.formula : combo.acid.formula} incrementally
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

          <BeakerScene
            combo={combo}
            nAcid={nAcid}
            nBase={nBase}
            phase={phase}
            drift={drift}
            solutionTint={solutionTint}
            pourFrom={startWith === 'acid' ? 'base' : 'acid'}
            pourPulse={pourPulse}
            pourBatch={pourBatch}
          />
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
        <SlideTabs<'acid' | 'base'>
          tabs={[
            { id: 'acid', label: `Start: ${combo.acid.formula}` },
            { id: 'base', label: `Start: ${combo.base.formula}` },
          ]}
          value={startWith}
          onChange={(v) => { setStartWith(v); setAddedMl(0); setPhase(0); setPourPulse(0); setPourBatch(null); }}
        />
        <Slider label="Animation speed" value={speed} min={0.1} max={3} step={0.1}
                onChange={setSpeed} accent="var(--paper-dim)" fmt={v => `${v.toFixed(1)}×`} />
        <div style={{ gridColumn: 'span 2', display: 'grid', gap: 8 }}>
          <div className="mono" style={{ fontSize: 10, color: 'var(--paper-dim)', letterSpacing: '0.12em' }}>
            {startWith === 'acid' ? combo.base.formula : combo.acid.formula} added: {addedMl.toFixed(1)} mL ·
            {' '}acid = {(acidMoles * 1000).toFixed(1)} mmol · base = {(baseMoles * 1000).toFixed(1)} mmol
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <ControlBtn onClick={() => addTitrant(2)}>Add 2 mL</ControlBtn>
            <ControlBtn onClick={() => addTitrant(5)}>Add 5 mL</ControlBtn>
            <ControlBtn onClick={() => addTitrant(-2)}>Remove 2 mL</ControlBtn>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <ControlBtn onClick={() => setRunning(r => !r)}>{running ? '❚❚ Pause motion' : '▶ Play motion'}</ControlBtn>
            <ControlBtn onClick={reset}>↻ Reset</ControlBtn>
          </div>
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

function computePH(combo: Combo, nAcid: number, nBase: number, Vtot: number): number {
  const Kw = 1e-14;
  const Ca = nAcid / Math.max(Vtot, 1e-12);
  const Cb = nBase / Math.max(Vtot, 1e-12);
  // Stoichiometric "moles" (per L, equal volumes assumption — simplification standard in AP problems)
  // Strong–strong
  if (combo.acid.strength === 'strong' && combo.base.strength === 'strong') {
    const diff = nAcid - nBase;
    if (Math.abs(diff) < 1e-9) return 7;
    if (diff > 0) {
      const H = diff / Math.max(Vtot, 1e-12);
      const Hcorr = (H + Math.sqrt(H * H + 4 * Kw)) / 2;
      return -Math.log10(Hcorr);
    } else {
      const OH = (-diff) / Math.max(Vtot, 1e-12);
      const pOH = -Math.log10(OH);
      return 14 - pOH;
    }
  }

  // Weak acid + strong base (e.g. HA + OH-)
  if (combo.acid.strength === 'weak' && combo.base.strength === 'strong') {
    const Ka = Math.pow(10, -combo.acid.pKa);
    const HA0 = nAcid, OH0 = nBase;
    if (OH0 < HA0 - 1e-9) {
      // Buffer region: Henderson–Hasselbalch (use unreacted HA and produced A-)
      const HA = (HA0 - OH0) / Math.max(Vtot, 1e-12);
      const A = OH0 / Math.max(Vtot, 1e-12);
      if (A < 1e-8) {
        // very little base — pure weak acid
        return weakAcidPH(Ca, Ka);
      }
      return combo.acid.pKa + Math.log10(A / HA);
    } else if (Math.abs(OH0 - HA0) < 1e-9) {
      // Equivalence: A- alone, hydrolyzes
      const A = HA0 / Math.max(Vtot, 1e-12);
      const Kb = Kw / Ka;
      const OH = Math.sqrt(Kb * A);
      return 14 - (-Math.log10(OH));
    } else {
      // Past equivalence: excess strong base dominates
      const OHex = (OH0 - HA0) / Math.max(Vtot, 1e-12);
      return 14 - (-Math.log10(OHex));
    }
  }

  // Strong acid + weak base (mirror)
  if (combo.acid.strength === 'strong' && combo.base.strength === 'weak') {
    const Kb = Math.pow(10, -combo.base.pKb);
    const Ka_BH = Kw / Kb;
    const pKa_BH = -Math.log10(Ka_BH);
    const H0 = nAcid, B0 = nBase;
    if (H0 > B0 - 1e-9 && Math.abs(H0 - B0) > 1e-9) {
      // Excess strong acid
      return -Math.log10((H0 - B0) / Math.max(Vtot, 1e-12));
    } else if (Math.abs(H0 - B0) < 1e-9) {
      // Equivalence — only BH+
      const BH = B0 / Math.max(Vtot, 1e-12);
      const H = Math.sqrt(Ka_BH * BH);
      return -Math.log10(H);
    } else {
      // Buffer region: BH+ / B
      const BH = H0 / Math.max(Vtot, 1e-12);
      const B = (B0 - H0) / Math.max(Vtot, 1e-12);
      if (BH < 1e-8) return weakBasePH(Cb, Kb);
      return pKa_BH + Math.log10(B / BH);
    }
  }

  // Weak + weak — approximate equilibrium pH = ½(pKa(HA) + pKa(BH+))
  // adjusted by log of ratio when off-stoichiometric.
  {
    const Kb = Math.pow(10, -combo.base.pKb);
    const pKa_BH = -Math.log10(Kw / Kb);
    if (nBase < 1e-12) return weakAcidPH(Ca, Math.pow(10, -combo.acid.pKa));
    if (nAcid < 1e-12) return weakBasePH(Cb, Kb);
    const r = nBase / Math.max(nAcid, 1e-12);
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
function molesToParticles(n: number) {
  if (n <= 0) return 0;
  return Math.max(1, Math.round(clamp(n / 0.0005, 0, 18)));
}

function phColor(pH: number) {
  if (pH < 4) return 'var(--acid)';
  if (pH > 10) return 'var(--base)';
  if (pH < 6.5 || pH > 7.5) return 'var(--phos)';
  return 'var(--phos)';
}

// ─── visual components ───

function BeakerScene({ combo, nAcid, nBase, phase, drift, solutionTint, pourFrom, pourPulse, pourBatch }: {
  combo: Combo; nAcid: number; nBase: number; phase: number; drift: number; solutionTint: string; pourFrom: 'acid' | 'base'; pourPulse: number; pourBatch: PourBatch | null;
}) {
  // Layout: beaker fills inner region. Acid molecules on left, base on right, spectators float top.
  // Phase progresses 0..1 once — proton-transfer cycle:
  //   0.0–0.3: H+ separating from acid
  //   0.3–0.7: H+ migrating across
  //   0.7–1.0: bound to base / conjugate forming
  // Wave a small offset by index so molecules cycle out-of-phase.

  const entryProgress = easeInOut(clamp((pourBatch?.phase ?? 1) / 0.42, 0, 1));
  const dissolveProgress = easeInOut(clamp(((pourBatch?.phase ?? 1) - 0.36) / 0.64, 0, 1));
  const reactionPhase = phase;
  const reactedPairs = Math.min(nAcid, nBase);
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

      {/* Pouring cue when adding titrant */}
      <PourStream from={pourFrom} strength={pourPulse} color={pourFrom === 'acid' ? 'var(--acid)' : 'var(--base)'} />

      {/* Spectators floating on top band */}
      {Array.from({ length: Math.min(nAcid, 6) }).map((_, i) => (combo.acid.formula !== 'HCl' && combo.spectatorAnion) && (
        <SpectatorIon key={`sa-${i}`} x={14 + (i * 12) % 70} y={26 + ((i * 7) % 6)}
                      label={combo.spectatorAnion} color={COL_CL} phase={drift} idx={i}
                      opacity={1} />
      ))}
      {Array.from({ length: Math.min(nBase, 6) }).map((_, i) => combo.spectatorCation && combo.base.formula !== 'NaOH' && (
        <SpectatorIon key={`sc-${i}`} x={20 + (i * 11) % 60} y={32 + ((i * 5) % 6)}
                      label={combo.spectatorCation} color={COL_NA} phase={drift} idx={i + 3}
                      opacity={1} />
      ))}

      {/* Acid molecules — proton donors */}
      {Array.from({ length: nAcid }).map((_, i) => {
        const targetX = 14 + pseudoRand(i * 13.1 + 1.7) * 30 + Math.sin((drift + i * 0.17) * Math.PI * 2) * 1.4;
        const targetY = 40 + pseudoRand(i * 29.7 + 2.9) * 42 + Math.cos((drift + i * 0.13) * Math.PI * 2) * 1.1;
        const entering = isInPourBatch(pourBatch, 'acid', i);
        const { x: ax, y: ay } = entering ? enteringPoint('acid', i, targetX, targetY, entryProgress) : { x: targetX, y: targetY };
        const gatedReaction = entering ? reactionPhase * dissolveProgress : reactionPhase;
        const transfer = i < reactedPairs ? clamp((gatedReaction - i * 0.018) / 0.88, 0, 1) : null;
        return <AcidMolecule key={`a-${i}`} x={ax} y={ay} combo={combo} transfer={transfer} dissolve={entering ? dissolveProgress : 1} />;
      })}

      {/* Base molecules — proton acceptors */}
      {Array.from({ length: nBase }).map((_, i) => {
        const targetX = 57 + pseudoRand(i * 17.3 + 3.1) * 31 + Math.sin((drift + i * 0.19) * Math.PI * 2) * 1.3;
        const targetY = 40 + pseudoRand(i * 31.9 + 4.3) * 42 + Math.cos((drift + i * 0.11) * Math.PI * 2) * 1.1;
        const entering = isInPourBatch(pourBatch, 'base', i);
        const { x: bx, y: by } = entering ? enteringPoint('base', i, targetX, targetY, entryProgress) : { x: targetX, y: targetY };
        const gatedReaction = entering ? reactionPhase * dissolveProgress : reactionPhase;
        const transfer = i < reactedPairs ? clamp((gatedReaction - i * 0.018) / 0.88, 0, 1) : null;
        return <BaseMolecule key={`b-${i}`} x={bx} y={by} combo={combo} transfer={transfer} dissolve={entering ? dissolveProgress : 1} />;
      })}

      {/* migrating protons */}
      {Array.from({ length: reactedPairs }).map((_, i) => {
        const pairEntering = isInPourBatch(pourBatch, 'acid', i) || isInPourBatch(pourBatch, 'base', i);
        const gatedReaction = pairEntering ? reactionPhase * dissolveProgress : reactionPhase;
        const transfer = clamp((gatedReaction - i * 0.018) / 0.88, 0, 1);
        if (transfer < 0.2 || transfer > 0.75) return null;
        const k = (transfer - 0.2) / 0.55;
        // Use the exact same donor/acceptor anchors as rendered molecules.
        const ax = 14 + pseudoRand(i * 13.1 + 1.7) * 30 + Math.sin((drift + i * 0.17) * Math.PI * 2) * 1.4;
        const ay = 40 + pseudoRand(i * 29.7 + 2.9) * 42 + Math.cos((drift + i * 0.13) * Math.PI * 2) * 1.1;
        const bx = 57 + pseudoRand(i * 17.3 + 3.1) * 31 + Math.sin((drift + i * 0.19) * Math.PI * 2) * 1.3;
        const by = 40 + pseudoRand(i * 31.9 + 4.3) * 42 + Math.cos((drift + i * 0.11) * Math.PI * 2) * 1.1;
        const sx = combo.acid.formula === 'HCl' ? ax + 9 : ax + 3.4;
        const sy = combo.acid.formula === 'HCl' ? ay - 5.5 : ay - 2.4;
        const ex = combo.base.formula === 'NaOH' ? bx - 2.1 : bx + 3.4;
        const ey = combo.base.formula === 'NaOH' ? by - 1.6 : by - 2.4;
        const x = sx + (ex - sx) * k;
        const y = sy + (ey - sy) * k - Math.sin(k * Math.PI) * 2.2;
        return (
          <g key={`p-${i}`}>
            <circle cx={x} cy={y} r={1.3} fill={COL_H} opacity="0.95" />
            <text x={x} y={y + 0.4} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="1.1" fill="#0a0908" fontWeight="700">H⁺</text>
          </g>
        );
      })}
    </svg>
  );
}

function SpectatorIon({ x, y, label, color, phase, idx, opacity = 1 }: {
  x: number; y: number; label: string; color: string; phase: number; idx: number; opacity?: number;
}) {
  const drift = Math.sin((phase + idx * 0.2) * Math.PI * 2) * 1.2;
  return (
    <g transform={`translate(${x} ${y + drift})`} opacity={opacity}>
      <circle r={2.6} fill={color} opacity="0.9" />
      <text y={0.8} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="1.7" fontWeight="700" fill="#0a0908">{label}</text>
    </g>
  );
}

function isInPourBatch(batch: PourBatch | null, kind: 'acid' | 'base', idx: number) {
  return !!batch && batch.kind === kind && idx >= batch.fromIndex && idx < batch.toIndex && batch.phase < 1;
}

function AcidMolecule({ x, y, combo, transfer, dissolve }: {
  x: number; y: number; combo: Combo; transfer: number | null; dissolve: number;
}) {
  // transfer: 0..1 one-way progress for matched acid-base pairs.
  // null means no matched acceptor (remains unreacted donor).
  const departed = transfer != null ? transfer >= 0.2 : false;
  const dissolved = dissolve > 0.88;
  const bondOpacity = 1 - clamp(dissolve / 0.86, 0, 1);
  const hX = 1.6 + dissolve * 7.4;
  const hY = -1.1 - dissolve * 4.4;
  const isAcetic = combo.acid.formula === 'CH3COOH';
  const speciesLabel = isAcetic
    ? (departed ? 'CH₃COO⁻' : 'CH₃COOH')
    : (!dissolved ? 'HCl' : departed ? 'Cl⁻' : 'Cl⁻ + H⁺');

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
          {!departed && (
            <line x1="1.5" y1="-0.6" x2={hX} y2={hY} stroke="rgba(245,241,232,0.35)" strokeWidth="0.35" opacity={bondOpacity} />
          )}
          <circle r={2.4} fill={COL_CL} />
          <text y={0.7} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="1.4" fontWeight="700" fill="#0a0908">
            {dissolved ? 'Cl⁻' : 'Cl'}
          </text>
        </g>
      )}
      {/* the labile proton */}
      {!departed && (
        <g>
          <circle cx={isAcetic ? 3.4 : hX} cy={isAcetic ? -2.4 : hY} r={1.3} fill={COL_H} />
          <text x={isAcetic ? 3.4 : hX} y={(isAcetic ? -2.4 : hY) + 0.4} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="1.0" fontWeight="700" fill="#0a0908">
            {dissolved ? 'H⁺' : 'H'}
          </text>
        </g>
      )}
      {/* charge label when departed */}
      {departed && isAcetic && (
        <text x={isAcetic ? 4 : 3.2} y={-2.6} fontFamily="JetBrains Mono" fontSize="1.4" fill={isAcetic ? 'var(--acid)' : COL_CL}>−</text>
      )}
      <text y={5.2} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="1.05" fill="var(--paper-faint)">
        {speciesLabel}
      </text>
    </g>
  );
}

function BaseMolecule({ x, y, combo, transfer, dissolve }: {
  x: number; y: number; combo: Combo; transfer: number | null; dissolve: number;
}) {
  // For matched pairs, acceptor becomes bound once proton arrives and stays bound.
  const bound = transfer != null ? transfer >= 0.75 : false;
  const isAmmonia = combo.base.formula === 'NH3';
  const dissolved = dissolve > 0.88;
  const bondOpacity = 1 - clamp(dissolve / 0.86, 0, 1);
  const chargeOpacity = clamp((dissolve - 0.72) / 0.28, 0, 1);
  const naX = -2.4 - dissolve * 7.2;
  const naY = -1.8 - dissolve * 4.2;
  const speciesLabel = isAmmonia
    ? (bound ? 'NH₄⁺' : 'NH₃')
    : (!dissolved ? 'NaOH' : bound ? 'H₂O' : 'OH⁻');

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
          {!bound && <line x1="-1.4" y1="-0.7" x2={naX} y2={naY} stroke="rgba(245,241,232,0.35)" strokeWidth="0.35" opacity={bondOpacity} />}
          <g opacity={1} transform={`translate(${naX} ${naY})`}>
            <circle r={1.7} fill={COL_NA} />
            <text y={0.55} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="1.1" fontWeight="700" fill="#0a0908">
              {dissolved ? 'Na⁺' : 'Na'}
            </text>
          </g>
          <circle r={2} fill={COL_OH} />
          <text y={0.6} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="1.4" fontWeight="700" fill="#0a0908">O</text>
          <circle cx={2.6} cy={1.4} r={1} fill={COL_H} />
          <text x={2.6} y={1.9} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="1.0" fontWeight="700" fill="#0a0908">H</text>
          {!bound && <text x={-2.8} y={-1.8} fontFamily="JetBrains Mono" fontSize="1.4" fill="var(--base)" opacity={chargeOpacity}>−</text>}
        </g>
      )}
      {bound && (
        isAmmonia ? (
          <g>
            <circle cx={3.4} cy={-2.4} r={1.3} fill={COL_H} />
            <text x={3.4} y={-2} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="1.1" fontWeight="700" fill="#0a0908">H</text>
            <text x={5.5} y={-2.6} fontFamily="JetBrains Mono" fontSize="1.4" fill="var(--base)">+</text>
          </g>
        ) : (
          // For OH- acceptor, incoming proton sits close to O to form H2O.
          <g>
            <circle cx={-2.1} cy={-1.6} r={1.3} fill={COL_H} />
            <text x={-2.1} y={-1.2} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="1.1" fontWeight="700" fill="#0a0908">H</text>
          </g>
        )
      )}
      <text y={5.2} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="1.05" fill="var(--paper-faint)">
        {speciesLabel}
      </text>
    </g>
  );
}

function enteringPoint(kind: 'acid' | 'base', idx: number, targetX: number, targetY: number, progress: number) {
  const sx = kind === 'acid' ? 18 : 82;
  const sy = 7;
  const clusterX = sx + (pseudoRand(idx * 8.7 + 0.4) - 0.5) * 5.2;
  const clusterY = sy + pseudoRand(idx * 11.3 + 0.9) * 5.4;
  return {
    x: clusterX + (targetX - clusterX) * progress,
    y: clusterY + (targetY - clusterY) * progress,
  };
}

function easeInOut(t: number) {
  return t * t * (3 - 2 * t);
}

function pseudoRand(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function PourStream({ from, strength, color }: { from: 'acid' | 'base'; strength: number; color: string }) {
  if (strength <= 0.02) return null;
  const x = from === 'acid' ? 18 : 82;
  const dir = from === 'acid' ? 1 : -1;
  return (
    <g opacity={0.35 + strength * 0.5}>
      <rect x={x - 2} y={2} width={4} height={12} rx={1} fill="var(--line-strong)" />
      <polygon points={`${x - 1.5},14 ${x + 1.5},14 ${x},17`} fill="var(--line-strong)" />
      <path d={`M ${x} 17 C ${x + dir * 2} 25, ${x + dir * 1} 36, ${x} 44`} stroke={color} strokeWidth={1.8 + strength * 1.2} fill="none" strokeLinecap="round" />
      <circle cx={x + dir * 0.8} cy={47} r={1.3 + strength * 0.6} fill={color} />
      <circle cx={x + dir * 2.1} cy={52} r={0.9 + strength * 0.4} fill={color} />
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
    <UISlider label={label} value={value} min={min} max={max} step={step}
              onChange={onChange} accent={accent} format={fmt} />
  );
}
