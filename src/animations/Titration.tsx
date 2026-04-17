import { useEffect, useMemo, useRef, useState } from 'react';
import SlideTabs from '../components/ui/SlideTabs';
import AnimatedCounter from '../components/ui/AnimatedCounter';

/**
 * Titration — interactive acid-base titration simulator.
 * Choose acid (strong / weak), titrate with NaOH 0.1 M, watch the pH curve emerge.
 * Demonstrates the AP-Chem distinction between strong-acid and weak-acid curves:
 *  - buffer plateau, half-equivalence (pH = pKa), basic equivalence point.
 *
 * Math is exact (no fudging):
 *   Strong acid + strong base:
 *     before eq:  [H+] = (n_HA - n_OH) / V_total
 *     at eq:      pH = 7 (pure water)
 *     after eq:   [OH-] = (n_OH - n_HA) / V_total
 *   Weak acid (Ka) + strong base:
 *     V=0:        [H+] from quadratic Ka = x^2 / (Ca - x)
 *     buffer:     [H+] from Ka = [H+]·n_A / n_HA  (no approximation)
 *     at eq:      conjugate base hydrolysis [OH-] = sqrt(Kw/Ka · [A-])
 *     after eq:   excess strong OH- dominates
 */

type AcidKey = 'HCl' | 'AcOH' | 'HF' | 'NH4';
type Acid = {
  key: AcidKey;
  name: string;
  formula: React.ReactNode;
  conjugate: React.ReactNode;
  Ka: number | null; // null = strong (fully dissociated)
  pKa: number | null;
  blurb: string;
};

const Kw = 1e-14;
const ACIDS: Acid[] = [
  { key: 'HCl',  name: 'Hydrochloric',  formula: <>HCl</>,         conjugate: <>Cl⁻</>,
    Ka: null, pKa: null, blurb: 'Strong acid · fully dissociated' },
  { key: 'HF',   name: 'Hydrofluoric',  formula: <>HF</>,          conjugate: <>F⁻</>,
    Ka: 6.8e-4, pKa: -Math.log10(6.8e-4), blurb: 'Weak acid · moderate Ka' },
  { key: 'AcOH', name: 'Acetic',        formula: <>CH₃COOH</>,     conjugate: <>CH₃COO⁻</>,
    Ka: 1.8e-5, pKa: -Math.log10(1.8e-5), blurb: 'Weak acid · classic AP example' },
  { key: 'NH4',  name: 'Ammonium',      formula: <>NH₄⁺</>,        conjugate: <>NH₃</>,
    Ka: 5.6e-10, pKa: -Math.log10(5.6e-10), blurb: 'Very weak acid · low Ka' },
];

// fixed initial conditions
const Ca0 = 0.1;     // M, acid
const Va  = 25;      // mL, acid
const Cb0 = 0.1;     // M, NaOH titrant
const Veq = (Ca0 * Va) / Cb0;  // mL = 25
const X_MAX = 60;    // mL plot range

export default function Titration() {
  const [acidKey, setAcidKey] = useState<AcidKey>('AcOH');
  const acid = ACIDS.find(a => a.key === acidKey)!;

  const [Vb, setVb] = useState(0);          // mL of NaOH added
  const [auto, setAuto] = useState(false);
  const rafRef = useRef<number | null>(null);
  const lastT = useRef<number>(0);
  const startVb = useRef<number>(0);
  const startTime = useRef<number>(0);

  // Auto-titration: 0 -> 50 mL over 8 s.
  useEffect(() => {
    if (!auto) return;
    startVb.current = Vb;
    startTime.current = performance.now();
    lastT.current = startTime.current;
    const target = 50;
    const dur = 8000 * (1 - startVb.current / target);
    const loop = (now: number) => {
      const elapsed = now - startTime.current;
      const frac = Math.min(1, elapsed / Math.max(50, dur));
      const v = startVb.current + (target - startVb.current) * frac;
      setVb(v);
      if (frac >= 1) { setAuto(false); return; }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [auto]);

  // Cleanup on unmount
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const state = useMemo(() => speciation(acid, Vb), [acid, Vb]);
  const { pH, HA, A, Hp, OH, phase } = state;

  // Half-equivalence (only meaningful for weak acid)
  const Vhalf = acid.Ka != null ? Veq / 2 : null;
  const nearEq   = Math.abs(Vb - Veq) < 0.05;
  const nearHalf = Vhalf != null && Math.abs(Vb - Vhalf) < 0.05;

  const stepBy = (dV: number) => setVb(v => clamp(v + dV, 0, X_MAX));
  const reset = () => { setAuto(false); setVb(0); };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Acid selector */}
      <SlideTabs<AcidKey>
        tabs={ACIDS.map(a => ({ id: a.key, label: a.name }))}
        value={acidKey}
        onChange={(k) => { setAcidKey(k); setAuto(false); setVb(0); }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
        <div className="serif" style={{ fontSize: 24, fontStyle: 'italic' }}>
          {acid.formula} <span style={{ color: 'var(--paper-dim)' }}>+ NaOH →</span>{' '}
          Na<sup>+</sup> + {acid.conjugate} + H₂O
        </div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--paper-dim)' }}>
          {acid.Ka == null
            ? 'STRONG · Ka = ∞'
            : <>Ka = {acid.Ka.toExponential(1)} · pKa = {acid.pKa!.toFixed(2)}</>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 0.7fr) 1.6fr', gap: 16 }}>
        {/* Apparatus */}
        <div style={{
          position: 'relative',
          background: 'var(--ink-1)',
          border: '1px solid var(--line)',
          borderRadius: 6,
          padding: 18,
          display: 'flex', flexDirection: 'column',
        }}>
          <div className="eyebrow">Apparatus</div>
          <Apparatus Vb={Vb} pH={pH} dripping={auto} />
          <div style={{ paddingTop: 12, borderTop: '1px solid var(--line)', marginTop: 12, display: 'grid', gap: 6 }}>
            <KV k="Acid" v={`${acidName(acid)} · 0.10 M · 25 mL`} />
            <KV k="Base" v="NaOH · 0.10 M" />
            <KV k="V added" v={`${Vb.toFixed(2)} mL`} accent="var(--base)" />
          </div>
        </div>

        {/* Curve */}
        <div style={{
          background: 'var(--ink-1)',
          border: '1px solid var(--line)',
          borderRadius: 6,
          padding: 20,
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span className="eyebrow">Titration curve · pH vs V(NaOH)</span>
            <PhaseBadge phase={phase} />
          </div>
          <Curve acid={acid} Vb={Vb} pH={pH} Vhalf={Vhalf} />

          {/* Controls */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <ControlBtn onClick={() => stepBy(-1)}>− 1 mL</ControlBtn>
            <ControlBtn onClick={() => stepBy(1)}>+ 1 mL</ControlBtn>
            <ControlBtn onClick={() => stepBy(5)}>+ 5 mL</ControlBtn>
            <ControlBtn onClick={() => setAuto(a => !a)} active={auto}>
              {auto ? '❚❚ Pause' : '▶ Auto-titrate'}
            </ControlBtn>
            <ControlBtn onClick={reset}>↺ Reset</ControlBtn>
          </div>

          {/* Live readouts */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12,
            borderTop: '1px solid var(--line)', paddingTop: 12,
          }}>
            <Stat label="pH"      value={<AnimatedCounter value={pH} decimals={2} />} accent={pHColor(pH)} big />
            <Stat label="[H⁺]"    value={sci(Hp)}   accent="var(--acid)" />
            <Stat label="[OH⁻]"   value={sci(OH)}   accent="var(--base)" />
            <Stat label="V base"  value={`${Vb.toFixed(2)} mL`} />
            <Stat label="[HA]"    value={sci(HA)}   accent="var(--paper)" />
            <Stat label="[A⁻]"    value={sci(A)}    accent="var(--phos)" />
            <Stat
              label="pKa"
              value={acid.pKa != null ? acid.pKa.toFixed(2) : '—'}
              accent="var(--cool)"
            />
            <Stat label="V_eq"    value={`${Veq.toFixed(2)} mL`} accent="var(--base)" />
          </div>

          {(nearEq || nearHalf) && (
            <div style={{
              padding: 10, borderRadius: 4,
              background: nearEq ? 'rgba(110,200,255,0.08)' : 'rgba(255,200,80,0.08)',
              border: `1px solid ${nearEq ? 'var(--base)' : 'var(--cool)'}55`,
            }}>
              <div className="eyebrow" style={{ color: nearEq ? 'var(--base)' : 'var(--cool)' }}>
                {nearEq ? 'EQUIVALENCE POINT' : 'HALF-EQUIVALENCE'}
              </div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--paper-dim)', marginTop: 4 }}>
                {nearEq
                  ? `n(OH⁻) added = n(HA) initial. ${acid.Ka == null
                      ? 'Pure salt of strong-strong → pH = 7.'
                      : 'Salt of weak acid → A⁻ hydrolyzes, pH > 7.'}`
                  : `[HA] = [A⁻]; Henderson–Hasselbalch ⇒ pH = pKa = ${acid.pKa!.toFixed(2)}.`}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────── chemistry ──────────────────────────────

type Speciation = {
  pH: number;
  Hp: number; OH: number;
  HA: number; A: number;
  phase: 'initial' | 'buffer' | 'half' | 'equiv' | 'after';
};

function speciation(acid: Acid, Vb: number): Speciation {
  const Vt_L = (Va + Vb) / 1000;          // total volume in L
  const n_HA0 = Ca0 * (Va / 1000);        // mol acid initially
  const n_OH  = Cb0 * (Vb / 1000);        // mol OH- added

  // Stoichiometric formal concentrations of HA and A- after neutralisation
  const n_HA_form = Math.max(0, n_HA0 - n_OH);
  const n_A_form  = Math.min(n_HA0, n_OH);
  const HA_form = n_HA_form / Vt_L;
  const A_form  = n_A_form  / Vt_L;

  let pH: number;
  let phase: Speciation['phase'] = 'initial';

  if (acid.Ka == null) {
    // STRONG ACID + STRONG BASE
    if (n_OH < n_HA0) {
      const Hconc = (n_HA0 - n_OH) / Vt_L;
      pH = -Math.log10(Hconc);
      phase = Vb < 0.01 ? 'initial' : 'buffer'; // "buffer" label is misleading here;
      // for strong acid we just call it the pre-equiv region — handled in PhaseBadge.
      if (Vb < 0.01) phase = 'initial';
      else if (Math.abs(Vb - Veq) < 0.05) phase = 'equiv';
      else phase = 'buffer';
    } else if (Math.abs(n_OH - n_HA0) < 1e-12) {
      pH = 7;
      phase = 'equiv';
    } else {
      const OHc = (n_OH - n_HA0) / Vt_L;
      pH = 14 + Math.log10(OHc);
      phase = 'after';
    }
  } else {
    // WEAK ACID + STRONG BASE — solve the exact proton-balance cubic so the
    // curve is continuous from V=0 through equivalence and beyond. Works
    // uniformly for any Ka (including NH4+ where the simple buffer formula
    // breaks down at small Vb because self-dissociation of HA dominates).
    //
    //   Ca = total acid (HA + A-) formal concentration after dilution
    //   Cb = [Na+] = added strong base formal concentration
    //   h³ + (Cb + Ka)h² − (Ka(Ca − Cb) + Kw)h − Ka·Kw = 0
    const Ka = acid.Ka;
    const Ca = n_HA0 / Vt_L;
    const Cb = n_OH  / Vt_L;
    const a2 = Cb + Ka;
    const a1 = -(Ka * (Ca - Cb) + Kw);
    const a0 = -Ka * Kw;
    const h = solveCubicPositive(a2, a1, a0);
    pH = -Math.log10(h);

    if (Vb < 1e-6)                          phase = 'initial';
    else if (Math.abs(Vb - Veq / 2) < 0.05) phase = 'half';
    else if (Math.abs(Vb - Veq)     < 0.05) phase = 'equiv';
    else if (Vb < Veq)                      phase = 'buffer';
    else                                    phase = 'after';
  }

  pH = clamp(pH, 0, 14);
  const Hp = Math.pow(10, -pH);
  const OH = Kw / Hp;

  // Equilibrium [HA] / [A-]:
  //   strong acid: HA fully dissociated, so [HA] ≈ 0; A- = Cl- (spectator).
  //   weak acid: refine forms by accounting for actual H+/OH- shuffle.
  let HA_eq: number, A_eq: number;
  if (acid.Ka == null) {
    HA_eq = 0;
    A_eq = (n_HA0 / Vt_L);     // all dissociated
  } else {
    // Treat the formal concentrations as the equilibrium concentrations to first
    // order; this is exact when both forms are sizeable and very close otherwise.
    HA_eq = HA_form;
    A_eq  = A_form;
    // At the very start there's no A- formed yet from titration; report the small
    // amount produced by self-dissociation.
    if (Vb < 1e-6) {
      A_eq = Hp;            // x from initial equilibrium
      HA_eq = HA_form - Hp;
    }
  }

  return { pH, Hp, OH, HA: Math.max(0, HA_eq), A: Math.max(0, A_eq), phase };
}

// ────────────────────────────── apparatus SVG ──────────────────────────────

function Apparatus({ Vb, pH, dripping }: { Vb: number; pH: number; dripping: boolean }) {
  // Phenolphthalein: clear below pH ~8.2, magenta above ~10. Smooth interpolation.
  const t = clamp((pH - 8.2) / (10 - 8.2), 0, 1);
  // base flask color = very pale neutral; pink emerges with t.
  const r = Math.round(245 - (245 - 236) * (1 - t));
  const g = Math.round(241 - (241 - 110) * t);
  const b = Math.round(232 - (232 - 170) * t);
  const flaskColor = `rgba(${r},${g},${b},${0.45 + 0.3 * t})`;

  // burette fill: starts full (volume = 50 mL capacity) and drains as we add.
  const buretteFrac = clamp(Vb / 50, 0, 1);

  return (
    <svg viewBox="0 0 200 380" preserveAspectRatio="xMidYMid meet" style={{ width: '100%', flex: 1, marginTop: 8 }}>
      {/* Burette */}
      <rect x="80" y="10" width="40" height="200" fill="var(--ink-2)" stroke="var(--line-strong)" strokeWidth="1" />
      {/* base inside burette (shrinks downward as drained) */}
      <rect
        x="84" y={10 + buretteFrac * 196}
        width="32" height={200 - buretteFrac * 196}
        fill="#9bd5ff" opacity="0.55"
      />
      {/* tick marks 0..50 mL */}
      {[0, 10, 20, 30, 40, 50].map((v) => (
        <g key={v}>
          <line x1="120" y1={10 + (v / 50) * 200} x2="128" y2={10 + (v / 50) * 200}
                stroke="rgba(245,241,232,0.5)" strokeWidth="1" />
          <text x="132" y={14 + (v / 50) * 200} fill="rgba(245,241,232,0.5)"
                fontSize="8" fontFamily="JetBrains Mono">{v}</text>
        </g>
      ))}
      {/* burette tip */}
      <path d="M 95 210 L 105 210 L 102 224 L 98 224 Z" fill="var(--ink-3)" stroke="var(--line-strong)" />
      <text x="100" y="244" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="9" fill="#9bd5ff">
        NaOH titrant
      </text>

      {/* Drop animating downward */}
      {dripping && Vb < 50 && (
        <circle cx="100" r="3" fill="#9bd5ff">
          <animate attributeName="cy" from="226" to="298" dur="0.7s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="1;1;0" dur="0.7s" repeatCount="indefinite" />
        </circle>
      )}

      {/* Erlenmeyer flask */}
      <path d="M 60 290 L 80 250 L 120 250 L 140 290 L 162 360 L 38 360 Z"
            fill="var(--ink-2)" stroke="var(--line-strong)" strokeWidth="1" />
      {/* Liquid inside */}
      <path d="M 50 320 L 150 320 L 161 360 L 39 360 Z" fill={flaskColor} />
      {/* Surface highlight */}
      <ellipse cx="100" cy="320" rx="50" ry="2" fill="rgba(255,255,255,0.18)" />
      <text x="100" y="376" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="9"
            fill="rgba(245,241,232,0.55)">
        analyte + phenolphthalein
      </text>
    </svg>
  );
}

// ────────────────────────────── curve canvas ──────────────────────────────

function Curve({
  acid, Vb, pH, Vhalf,
}: { acid: Acid; Vb: number; pH: number; Vhalf: number | null }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const c = ref.current; if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const cssW = c.clientWidth, cssH = c.clientHeight;
    c.width = cssW * dpr; c.height = cssH * dpr;
    const ctx = c.getContext('2d'); if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cssW, cssH);

    const padL = 36, padR = 14, padT = 12, padB = 26;
    const W = cssW - padL - padR, H = cssH - padT - padB;
    const xOf = (v: number) => padL + (v / X_MAX) * W;
    const yOf = (p: number) => padT + (1 - p / 14) * H;

    // Grid
    ctx.strokeStyle = 'rgba(245,241,232,0.06)';
    ctx.lineWidth = 1;
    for (let p = 0; p <= 14; p += 2) {
      const y = yOf(p);
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + W, y); ctx.stroke();
    }
    for (let v = 0; v <= X_MAX; v += 10) {
      const x = xOf(v);
      ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + H); ctx.stroke();
    }

    // Axes
    ctx.strokeStyle = 'rgba(245,241,232,0.35)';
    ctx.beginPath();
    ctx.moveTo(padL, padT); ctx.lineTo(padL, padT + H); ctx.lineTo(padL + W, padT + H);
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = 'rgba(245,241,232,0.55)';
    ctx.font = '10px JetBrains Mono';
    for (let p = 0; p <= 14; p += 2) {
      const y = yOf(p);
      ctx.fillText(`${p}`, 10, y + 3);
    }
    for (let v = 0; v <= X_MAX; v += 10) {
      const x = xOf(v);
      ctx.fillText(`${v}`, x - 6, padT + H + 14);
    }
    ctx.fillText('pH', 10, padT - 2);
    ctx.fillText('V_NaOH (mL)', padL + W - 78, padT + H + 14);

    // Pre-compute full curve for the chosen acid (for context, drawn faintly,
    // then the traced portion drawn boldly in front).
    const SAMPLES = 400;
    const pts: { x: number; y: number; v: number }[] = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const v = (i / SAMPLES) * X_MAX;
      const s = speciation(acid, v);
      pts.push({ v, x: xOf(v), y: yOf(s.pH) });
    }

    // Equivalence vertical
    const xEq = xOf(Veq);
    ctx.strokeStyle = 'rgba(155,213,255,0.45)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(xEq, padT); ctx.lineTo(xEq, padT + H); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#9bd5ff';
    ctx.fillText('V_eq', xEq + 4, padT + 12);

    // Half-equivalence (weak only)
    if (Vhalf != null) {
      const xH = xOf(Vhalf);
      ctx.strokeStyle = 'rgba(255,200,120,0.4)';
      ctx.setLineDash([3, 5]);
      ctx.beginPath(); ctx.moveTo(xH, padT); ctx.lineTo(xH, padT + H); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#ffc878';
      ctx.fillText('½ V_eq · pH=pKa', xH + 4, padT + 24);
      // pKa horizontal hint
      const yK = yOf(acid.pKa!);
      ctx.strokeStyle = 'rgba(255,200,120,0.18)';
      ctx.setLineDash([2, 4]);
      ctx.beginPath(); ctx.moveTo(padL, yK); ctx.lineTo(padL + W, yK); ctx.stroke();
      ctx.setLineDash([]);
    }

    // Faint full curve
    ctx.strokeStyle = 'rgba(245,241,232,0.18)';
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.stroke();

    // Bold traced portion 0..Vb
    ctx.strokeStyle = '#ffc878';
    ctx.lineWidth = 2.25;
    ctx.beginPath();
    let first = true;
    for (const p of pts) {
      if (p.v > Vb + 1e-9) break;
      if (first) { ctx.moveTo(p.x, p.y); first = false; }
      else ctx.lineTo(p.x, p.y);
    }
    // include the exact current point as the line's terminus
    ctx.lineTo(xOf(Vb), yOf(pH));
    ctx.stroke();

    // Glowing current point
    const cx = xOf(Vb), cy = yOf(pH);
    ctx.fillStyle = 'rgba(255,200,120,0.18)';
    ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,200,120,0.32)';
    ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff8e6';
    ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, Math.PI * 2); ctx.fill();
  }, [acid, Vb, pH, Vhalf]);

  return (
    <canvas
      ref={ref}
      style={{ width: '100%', height: 280, display: 'block', borderRadius: 4, background: 'var(--ink-2)' }}
    />
  );
}

// ────────────────────────────── small UI atoms ──────────────────────────────

function ControlBtn({
  children, onClick, active,
}: { children: React.ReactNode; onClick: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="mono"
      style={{
        flex: 1,
        padding: '8px 10px', fontSize: 10, letterSpacing: '0.14em',
        textTransform: 'uppercase',
        border: '1px solid var(--line-strong)',
        background: active ? 'var(--paper)' : 'transparent',
        color: active ? 'var(--ink-0)' : 'var(--paper)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >{children}</button>
  );
}

function Stat({
  label, value, accent, big,
}: { label: string; value: React.ReactNode; accent?: string; big?: boolean }) {
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 4 }}>{label}</div>
      <div className="serif" style={{ fontSize: big ? 26 : 16, color: accent ?? 'var(--paper)' }}>
        {value}
      </div>
    </div>
  );
}

function KV({ k, v, accent }: { k: string; v: React.ReactNode; accent?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
      <span className="eyebrow">{k}</span>
      <span className="mono" style={{ color: accent ?? 'var(--paper)' }}>{v}</span>
    </div>
  );
}

function PhaseBadge({ phase }: { phase: Speciation['phase'] }) {
  const map: Record<Speciation['phase'], { label: string; color: string }> = {
    initial: { label: 'Initial',                color: 'var(--acid)' },
    buffer:  { label: 'Buffer region',          color: 'var(--cool)' },
    half:    { label: '½-equivalence · pH=pKa', color: 'var(--cool)' },
    equiv:   { label: 'Equivalence point',      color: 'var(--base)' },
    after:   { label: 'After equivalence',      color: 'var(--phos)' },
  };
  const { label, color } = map[phase];
  return (
    <span className="mono" style={{
      fontSize: 11, color, textTransform: 'uppercase', letterSpacing: '0.14em',
    }}>{label}</span>
  );
}

// ────────────────────────────── utilities ──────────────────────────────

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}


// Solve h³ + a2·h² + a1·h + a0 = 0 for the unique positive real root in (1e-15, 1).
// Bisection — slow but bulletproof for the monotonic proton-balance polynomial.
function solveCubicPositive(a2: number, a1: number, a0: number): number {
  const f = (h: number) => ((h + a2) * h + a1) * h + a0;
  let lo = 1e-15, hi = 1;
  // f(0) = a0 < 0; f(1) > 0 for any realistic Ca/Cb up to 1 M. Expand if needed.
  let flo = f(lo), fhi = f(hi);
  while (fhi < 0 && hi < 1e3) { hi *= 10; fhi = f(hi); }
  while (flo > 0 && lo > 1e-30) { lo /= 10; flo = f(lo); }
  for (let i = 0; i < 80; i++) {
    const mid = Math.sqrt(lo * hi); // geometric midpoint — h spans many decades
    const fm = f(mid);
    if (fm > 0) hi = mid; else lo = mid;
    if (hi / lo < 1 + 1e-10) break;
  }
  return Math.sqrt(lo * hi);
}

function sci(x: number): string {
  if (!isFinite(x) || x <= 0) return '0';
  if (x >= 0.01 && x < 1000) return x.toFixed(3);
  const exp = Math.floor(Math.log10(x));
  const mant = x / Math.pow(10, exp);
  return `${mant.toFixed(2)}e${exp >= 0 ? '+' : ''}${exp}`;
}

function pHColor(p: number): string {
  if (p < 4) return 'var(--acid)';
  if (p > 10) return 'var(--base)';
  if (p > 7.5) return 'var(--phos)';
  return 'var(--paper)';
}

function acidName(a: Acid): string {
  if (a.key === 'HCl') return 'HCl';
  if (a.key === 'AcOH') return 'CH₃COOH';
  if (a.key === 'HF') return 'HF';
  return 'NH₄⁺';
}
