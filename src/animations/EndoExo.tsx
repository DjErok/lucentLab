import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Endothermic vs Exothermic — PhET-grade interactive.
 *
 * Synchronized panels:
 *  · LEFT  — molecular animation (reactants → transition state → products), looping.
 *  · RIGHT — energy diagram with marble that rides an SVG path (getPointAtLength).
 *  · BELOW — thermometer for the surroundings, live bond-energy tally,
 *            real-reaction selector, sign-convention banner, and live numbers.
 *
 * Sign convention:  ΔH < 0 → exothermic (system releases heat to surroundings)
 *                   ΔH > 0 → endothermic (system absorbs heat from surroundings)
 */

type Mode = 'exo' | 'endo';

type Atom = { sym: string; r: number; color: string };
type Reaction = {
  id: string;
  mode: Mode;
  label: string;
  equation: React.ReactNode;
  deltaH: number;        // kJ/mol
  Ea: number;            // kJ/mol activation energy (illustrative)
  reactE: number;        // baseline reactant energy (kJ/mol, illustrative)
  // Bond-energy ledger
  broken: { name: string; E: number }[];   // kJ/mol, positive (energy IN)
  formed: { name: string; E: number }[];   // kJ/mol, positive magnitude (energy OUT)
  // Atoms used by the schematic scene (4 atoms re-paired)
  atoms: [Atom, Atom, Atom, Atom];
  // Display labels for reactants / products in the scene
  rLabel: string;
  pLabel: string;
};

const C = {
  H:  '#f0e6d2',
  O:  '#ff5b3c',
  C:  '#7d8d99',
  N:  '#5dd0ff',
  Cl: '#69e36b',
  Na: '#a78bfa',
  hot:    '#ff6b35',
  cool:   '#5dd0ff',
  warn:   '#fbbf24',
  paper:  '#f5f1e8',
};

const REACTIONS: Reaction[] = [
  {
    id: 'methane',
    mode: 'exo',
    label: 'Methane combustion',
    equation: <>CH<sub>4</sub> + 2 O<sub>2</sub> → CO<sub>2</sub> + 2 H<sub>2</sub>O</>,
    deltaH: -890, Ea: 250, reactE: 0,
    broken: [
      { name: '4 × C–H', E: 4 * 413 },
      { name: '2 × O=O', E: 2 * 498 },
    ],
    formed: [
      { name: '2 × C=O', E: 2 * 799 },
      { name: '4 × O–H', E: 4 * 463 },
    ],
    atoms: [
      { sym: 'C',  r: 22, color: C.C },
      { sym: 'H',  r: 14, color: C.H },
      { sym: 'O',  r: 20, color: C.O },
      { sym: 'O',  r: 20, color: C.O },
    ],
    rLabel: 'CH₄ · O₂',
    pLabel: 'CO₂ · H₂O',
  },
  {
    id: 'neutral',
    mode: 'exo',
    label: 'HCl + NaOH neutralization',
    equation: <>HCl(aq) + NaOH(aq) → NaCl(aq) + H<sub>2</sub>O(l)</>,
    deltaH: -56, Ea: 25, reactE: 0,
    broken: [
      { name: 'H–Cl(aq) sep.', E: 431 },
      { name: 'Na–OH(aq) sep.', E: 380 },
    ],
    formed: [
      { name: 'H–OH (l)', E: 463 + 463 },
      { name: 'Na⁺Cl⁻ (aq)', E: 411 },
    ],
    atoms: [
      { sym: 'H',  r: 14, color: C.H },
      { sym: 'Cl', r: 22, color: C.Cl },
      { sym: 'Na', r: 22, color: C.Na },
      { sym: 'O',  r: 20, color: C.O },
    ],
    rLabel: 'HCl · NaOH',
    pLabel: 'NaCl · H₂O',
  },
  {
    id: 'photo',
    mode: 'endo',
    label: 'Photosynthesis',
    equation: <>6 CO<sub>2</sub> + 6 H<sub>2</sub>O → C<sub>6</sub>H<sub>12</sub>O<sub>6</sub> + 6 O<sub>2</sub></>,
    deltaH: 2803, Ea: 3100, reactE: 0,
    broken: [
      { name: '12 × C=O', E: 12 * 799 },
      { name: '12 × O–H', E: 12 * 463 },
    ],
    formed: [
      { name: 'glucose bonds', E: 12 * 413 + 5 * 358 + 5 * 463 },
      { name: '6 × O=O', E: 6 * 498 },
    ],
    atoms: [
      { sym: 'C',  r: 22, color: C.C },
      { sym: 'O',  r: 20, color: C.O },
      { sym: 'H',  r: 14, color: C.H },
      { sym: 'O',  r: 20, color: C.O },
    ],
    rLabel: 'CO₂ · H₂O',
    pLabel: 'C₆H₁₂O₆ · O₂',
  },
  {
    id: 'nh4no3',
    mode: 'endo',
    label: 'NH₄NO₃ dissolving',
    equation: <>NH<sub>4</sub>NO<sub>3</sub>(s) → NH<sub>4</sub><sup>+</sup>(aq) + NO<sub>3</sub><sup>−</sup>(aq)</>,
    deltaH: 25, Ea: 15, reactE: 0,
    broken: [
      { name: 'lattice (NH₄⁺·NO₃⁻)', E: 650 },
    ],
    formed: [
      { name: 'hydration NH₄⁺', E: 305 },
      { name: 'hydration NO₃⁻', E: 320 },
    ],
    atoms: [
      { sym: 'N',  r: 20, color: C.N },
      { sym: 'H',  r: 14, color: C.H },
      { sym: 'N',  r: 20, color: C.N },
      { sym: 'O',  r: 20, color: C.O },
    ],
    rLabel: 'NH₄NO₃(s)',
    pLabel: 'NH₄⁺ · NO₃⁻ (aq)',
  },
];

export default function EndoExo() {
  const [rxnId, setRxnId] = useState<string>(REACTIONS[0].id);
  const rxn = REACTIONS.find(r => r.id === rxnId)!;
  const mode = rxn.mode;

  const [t, setT] = useState(0);              // 0..1, full reaction-coordinate progress
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(0.5);
  const [hidden, setHidden] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(true);

  // Pause on tab hidden
  useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Pause when scrolled out of view
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '120px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Animation loop — continuous cycle 0 → 1 → 0
  useEffect(() => {
    if (!playing || hidden || !visible) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setT(v => {
        let n = v + dt * 0.12 * speed;
        if (n > 1) n = 0;
        return n;
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, visible, hidden]);

  // Live numbers — derived from rxn + t
  const totalBroken = rxn.broken.reduce((s, b) => s + b.E, 0);
  const totalFormed = rxn.formed.reduce((s, b) => s + b.E, 0);
  const computedDeltaH = totalBroken - totalFormed; // approx ΔH from bond enthalpies

  const reactE = rxn.reactE;
  const peakE  = reactE + rxn.Ea;
  const prodE  = reactE + rxn.deltaH;

  // Tally progresses through the transition state (t between 0.30 and 0.70)
  const tallyT = clamp((t - 0.30) / 0.40, 0, 1);
  // Bonds break first (first half of transition), bonds form second half
  const breakProg = clamp(tallyT * 2, 0, 1);
  const formProg  = clamp(tallyT * 2 - 1, 0, 1);
  const energyIn   = totalBroken * breakProg;
  const energyOut  = totalFormed * formProg;
  const netSoFar   = energyIn - energyOut;

  // Surroundings temperature change is a smoothed function of t past the peak
  const release = clamp((t - 0.5) / 0.5, 0, 1); // 0 at peak → 1 at end
  const tempDelta = release * (mode === 'exo' ? +1 : -1);

  // Phase string (for the marble label)
  const phase =
    t < 0.20 ? 'reactants' :
    t < 0.40 ? 'climbing barrier' :
    t < 0.55 ? 'transition state' :
    t < 0.80 ? 'descending to products' : 'products';

  return (
    <div ref={rootRef} style={{ display: 'grid', gap: 16 }}>
      {/* Sign-convention banner */}
      <div style={{
        border: '1px solid var(--line)', borderLeft: `3px solid ${mode === 'exo' ? C.hot : C.cool}`,
        background: 'var(--ink-1)', padding: '10px 14px', borderRadius: 4,
      }}>
        <div className="eyebrow">Sign convention · system perspective</div>
        <div className="serif" style={{ fontSize: 15, marginTop: 4, lineHeight: 1.5 }}>
          <span style={{ color: C.hot }}>Exothermic</span>: ΔH &lt; 0 — the system <em>releases</em> heat to the surroundings.
          {' '}
          <span style={{ color: C.cool }}>Endothermic</span>: ΔH &gt; 0 — the system <em>absorbs</em> heat from the surroundings.
        </div>
      </div>

      {/* Reaction selector */}
      <div role="tablist" style={{ display: 'flex', flexWrap: 'wrap' }}>
        {REACTIONS.map((r, i) => {
          const active = r.id === rxnId;
          return (
            <button
              key={r.id}
              role="tab"
              aria-selected={active}
              onClick={() => { setRxnId(r.id); setT(0); }}
              className="mono"
              style={{
                padding: '10px 14px', fontSize: 11, letterSpacing: '0.14em',
                textTransform: 'uppercase',
                border: '1px solid var(--line-strong)',
                borderLeftWidth: i === 0 ? 1 : 0,
                background: active ? 'var(--paper)' : 'transparent',
                color: active ? 'var(--ink-0)' : 'var(--paper-dim)',
                fontWeight: active ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              <span style={{
                display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                background: r.mode === 'exo' ? C.hot : C.cool, marginRight: 8, verticalAlign: 'middle',
              }} />
              {r.label}
            </button>
          );
        })}
      </div>

      {/* Equation + ΔH */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 12 }}>
        <div className="serif" style={{ fontSize: 22, fontStyle: 'italic' }}>{rxn.equation}</div>
        <div className="mono" style={{ fontSize: 13, color: mode === 'exo' ? C.hot : C.cool }}>
          ΔH = {rxn.deltaH > 0 ? '+' : ''}{rxn.deltaH} kJ/mol · {mode === 'exo' ? 'EXOTHERMIC' : 'ENDOTHERMIC'}
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button onClick={() => setPlaying(p => !p)} className="mono" style={ctrlBtn()}>
          {playing ? '❚❚ pause' : '▶ play'}
        </button>
        <button onClick={() => { setT(0); setPlaying(true); }} className="mono" style={ctrlBtn()}>↻ restart</button>
        <span className="eyebrow">Speed</span>
        <input type="range" min={0.05} max={1.5} step={0.05} value={speed}
               onChange={e => setSpeed(Number(e.target.value))}
               style={{ width: 160, accentColor: 'var(--phos)' }} />
        <span className="mono" style={{ fontSize: 12, color: 'var(--phos)', width: 50 }}>{speed.toFixed(2)}×</span>

        <div style={{ flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="eyebrow">ξ</span>
          <input type="range" min={0} max={1} step={0.001} value={t}
                 onChange={e => { setT(Number(e.target.value)); setPlaying(false); }}
                 style={{ flex: 1, accentColor: mode === 'exo' ? C.hot : C.cool }} />
          <span className="mono" style={{ fontSize: 11, color: 'var(--paper-dim)', width: 56 }}>{(t * 100).toFixed(0)}%</span>
        </div>
      </div>

      {/* Two synchronized panels */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16 }}>
        {/* LEFT — molecular scene */}
        <Panel>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="eyebrow">Reaction · molecular view</span>
            <span className="mono" style={{ fontSize: 10, color: phaseTint(t, mode) }}>{phase.toUpperCase()}</span>
          </div>
          <MolecularScene rxn={rxn} t={t} />
          <div className="mono" style={{
            display: 'flex', justifyContent: 'space-between', fontSize: 11,
            color: 'var(--paper-dim)', marginTop: 8,
          }}>
            <span>{rxn.rLabel}</span>
            <span style={{ opacity: 0.5 }}>→</span>
            <span>{rxn.pLabel}</span>
          </div>
        </Panel>

        {/* RIGHT — energy diagram */}
        <Panel>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="eyebrow">Energy diagram</span>
            <span className="mono" style={{ fontSize: 10, color: 'var(--paper-dim)' }}>marble · ξ = {(t * 100).toFixed(0)}%</span>
          </div>
          <EnergyDiagram mode={mode} t={t} reactE={reactE} peakE={peakE} prodE={prodE} deltaH={rxn.deltaH} Ea={rxn.Ea} />
        </Panel>
      </div>

      {/* Surroundings + tally + numbers */}
      <div style={{ display: 'grid', gridTemplateColumns: '0.7fr 1.3fr 1fr', gap: 16 }}>
        {/* Thermometer */}
        <Panel>
          <div className="eyebrow">Surroundings</div>
          <Thermometer mode={mode} delta={tempDelta} />
          <div className="mono" style={{ fontSize: 11, color: mode === 'exo' ? C.hot : C.cool, marginTop: 6, textAlign: 'center' }}>
            {mode === 'exo' ? 'q_surr > 0 (heated)' : 'q_surr < 0 (cooled)'}
          </div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--paper-faint)', marginTop: 4, textAlign: 'center', lineHeight: 1.5 }}>
            q<sub>sys</sub> = −q<sub>surr</sub>
          </div>
        </Panel>

        {/* Bond-energy tally */}
        <Panel>
          <div className="eyebrow">Bond-energy tally · ΔH ≈ Σ broken − Σ formed</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10 }}>
            <TallyCol title="Energy IN · bonds broken" sign="+" color={C.warn} items={rxn.broken} progress={breakProg} total={totalBroken} live={energyIn} />
            <TallyCol title="Energy OUT · bonds formed" sign="−" color={C.cool} items={rxn.formed} progress={formProg} total={totalFormed} live={energyOut} />
          </div>
          <div style={{ marginTop: 12, padding: '10px 12px',
                        border: `1px solid ${(netSoFar < 0 ? C.hot : C.cool)}55`,
                        background: `${(netSoFar < 0 ? C.hot : C.cool)}10`, borderRadius: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span className="eyebrow">NET (so far)</span>
              <span className="serif" style={{ fontSize: 22, color: netSoFar < 0 ? C.hot : C.cool }}>
                {netSoFar > 0 ? '+' : ''}{netSoFar.toFixed(0)} kJ/mol
              </span>
            </div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--paper-faint)', marginTop: 4 }}>
              final ΔH (bond-enthalpy estimate) = {computedDeltaH > 0 ? '+' : ''}{computedDeltaH.toFixed(0)} kJ/mol
            </div>
          </div>
        </Panel>

        {/* Live numerical panel */}
        <Panel>
          <div className="eyebrow">Live numbers · kJ/mol</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
            <NumStat label="Reactant E" value={fmt(reactE)} />
            <NumStat label="Transition E" value={fmt(peakE)} accent={C.warn} />
            <NumStat label="Product E"   value={fmt(prodE)} accent={mode === 'exo' ? C.hot : C.cool} />
            <NumStat label="Eₐ" value={`+${rxn.Ea}`} accent={C.warn} />
            <NumStat label="ΔH" value={`${rxn.deltaH > 0 ? '+' : ''}${rxn.deltaH}`}
                     accent={mode === 'exo' ? C.hot : C.cool} big />
            <NumStat label="System → Surr." value={mode === 'exo' ? 'releases' : 'absorbs'}
                     accent={mode === 'exo' ? C.hot : C.cool} />
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ============================================================
   Molecular scene — 4 atoms, schematic re-pairing
   ============================================================ */

function MolecularScene({ rxn, t }: { rxn: Reaction; t: number }) {
  const atoms = rxn.atoms;
  const VBW = 600, VBH = 300;

  // Reference frames at canonical t values, interpolated piecewise.
  // 0.0 — far apart (reactants)        0.25 — meeting
  // 0.5 — transition state (cross)      0.75 — products forming
  // 1.0 — products separated
  const F0: P[] = [{ x:  90, y: 150 }, { x: 150, y: 150 }, { x: 460, y: 150 }, { x: 520, y: 150 }];
  const F1: P[] = [{ x: 230, y: 150 }, { x: 280, y: 150 }, { x: 340, y: 150 }, { x: 390, y: 150 }];
  const F2: P[] = [{ x: 250, y:  90 }, { x: 250, y: 210 }, { x: 360, y:  90 }, { x: 360, y: 210 }];
  const F3: P[] = [{ x: 270, y:  90 }, { x: 270, y: 210 }, { x: 330, y:  90 }, { x: 330, y: 210 }];
  const F4: P[] = [{ x: 110, y:  70 }, { x: 480, y: 230 }, { x: 170, y:  70 }, { x: 540, y: 230 }];

  const stops = [0, 0.25, 0.5, 0.75, 1];
  const frames = [F0, F1, F2, F3, F4];
  let i = 0;
  while (i < stops.length - 2 && t > stops[i + 1]) i++;
  const local = (t - stops[i]) / (stops[i + 1] - stops[i]);
  const k = ease(clamp(local, 0, 1));
  const pos = (idx: number): P => ({
    x: lerp(frames[i][idx].x, frames[i + 1][idx].x, k),
    y: lerp(frames[i][idx].y, frames[i + 1][idx].y, k),
  });

  // Bond opacities. Old bonds (0-1, 2-3) live until the transition; new bonds (0-2, 1-3) emerge after.
  const oldOp = clamp(1 - (t - 0.25) / 0.20, 0, 1);
  const newOp = clamp((t - 0.55) / 0.20, 0, 1);

  // Heat aura
  const auraOp = clamp((t - 0.5) / 0.4, 0, 1);
  const auraCol = rxn.mode === 'exo' ? C.hot : C.cool;

  return (
    <div style={{ position: 'relative', marginTop: 8, aspectRatio: '2 / 1', borderRadius: 4, background: 'var(--ink-2)', overflow: 'hidden' }}>
      {/* Heat / cool aura */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(circle at 50% 55%, ${auraCol}33 0%, transparent 65%)`,
        opacity: auraOp, pointerEvents: 'none', transition: 'opacity 200ms',
      }} />

      <svg viewBox={`0 0 ${VBW} ${VBH}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        {/* collision speed lines while approaching */}
        {t < 0.30 && (
          <>
            <line x1={pos(1).x + 30} y1={150} x2={pos(1).x + 70} y2={150} stroke="rgba(245,241,232,0.25)" strokeWidth="1.5" strokeDasharray="3 4" />
            <line x1={pos(2).x - 30} y1={150} x2={pos(2).x - 70} y2={150} stroke="rgba(245,241,232,0.25)" strokeWidth="1.5" strokeDasharray="3 4" />
          </>
        )}

        {/* Old bonds */}
        <Bond A={pos(0)} B={pos(1)} opacity={oldOp} color="#d6c9b3" />
        <Bond A={pos(2)} B={pos(3)} opacity={oldOp} color="#d6c9b3" />
        {/* New bonds */}
        <Bond A={pos(0)} B={pos(2)} opacity={newOp} color={C.warn} thick />
        <Bond A={pos(1)} B={pos(3)} opacity={newOp} color={C.warn} thick />

        {/* Atoms */}
        {atoms.map((a, idx) => {
          const p = pos(idx);
          return (
            <g key={idx}>
              <circle cx={p.x} cy={p.y} r={a.r}
                      fill={a.color} stroke="rgba(0,0,0,0.5)" strokeWidth="1.5" />
              <text x={p.x} y={p.y + a.r * 0.36} textAnchor="middle"
                    fontFamily="Fraunces" fontWeight="700" fontSize={a.r * 0.95}
                    fill="#0a0908">{a.sym}</text>
            </g>
          );
        })}

        {/* Phase callout */}
        {t > 0.40 && t < 0.60 && (
          <text x={VBW / 2} y={36} textAnchor="middle" fontFamily="JetBrains Mono"
                fontSize="11" letterSpacing="0.18em" fill={C.warn}>
            ‡ TRANSITION STATE
          </text>
        )}
        {t > 0.60 && (
          <text x={VBW / 2} y={36} textAnchor="middle" fontFamily="JetBrains Mono"
                fontSize="11" letterSpacing="0.18em" fill={auraCol}>
            {rxn.mode === 'exo' ? '↯ HEAT RELEASED' : '❄ HEAT ABSORBED'}
          </text>
        )}
      </svg>
    </div>
  );
}

type P = { x: number; y: number };

function Bond({ A, B, opacity, color, thick }: { A: P; B: P; opacity: number; color: string; thick?: boolean }) {
  if (opacity <= 0.01) return null;
  return <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke={color}
               strokeWidth={thick ? 4 : 3} strokeLinecap="round"
               style={{ opacity, transition: 'opacity 180ms' }} />;
}

/* ============================================================
   Energy diagram with marble on the curve
   ============================================================ */

function EnergyDiagram({
  mode, t, reactE, peakE, prodE, deltaH, Ea,
}: {
  mode: Mode; t: number;
  reactE: number; peakE: number; prodE: number; deltaH: number; Ea: number;
}) {
  const W = 460, H = 280;
  // Map energy → y. Build a normalized scale that includes both endpoints + peak.
  const eMin = Math.min(reactE, prodE) - Math.max(20, Math.abs(deltaH) * 0.1);
  const eMax = peakE + Math.max(20, Ea * 0.15);
  const yOf  = (E: number) => 30 + (1 - (E - eMin) / (eMax - eMin)) * (H - 60);

  const reactY = yOf(reactE);
  const prodY  = yOf(prodE);
  const peakY  = yOf(peakE);

  // Smooth curve: reactant plateau → bump → product plateau.
  const x0 = 50, xR = 130, xP = 250, xL = 350, x1 = W - 30;
  const pathD = `M ${x0} ${reactY} L ${xR} ${reactY} C ${xR + 60} ${reactY}, ${xP - 60} ${peakY}, ${xP} ${peakY} C ${xP + 60} ${peakY}, ${xL - 30} ${prodY}, ${xL} ${prodY} L ${x1} ${prodY}`;

  const pathRef = useRef<SVGPathElement | null>(null);
  const [marble, setMarble] = useState<P>({ x: x0, y: reactY });
  useEffect(() => {
    if (!pathRef.current) return;
    const len = pathRef.current.getTotalLength();
    const p = pathRef.current.getPointAtLength(len * clamp(t, 0, 1));
    setMarble({ x: p.x, y: p.y });
  }, [t, pathD]);

  const curveColor = mode === 'exo' ? C.hot : C.cool;

  return (
    <div style={{ marginTop: 8, aspectRatio: '1.6 / 1', position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
        <defs>
          <pattern id="ee-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(245,241,232,0.04)" />
          </pattern>
          <marker id="ee-arr-down" markerWidth="10" markerHeight="10" refX="5" refY="6" orient="auto">
            <path d="M0,0 L6,0 L3,6 z" fill={curveColor} />
          </marker>
          <marker id="ee-arr-up" markerWidth="10" markerHeight="10" refX="5" refY="0" orient="auto">
            <path d="M0,6 L6,6 L3,0 z" fill={curveColor} />
          </marker>
          <marker id="ea-arr" markerWidth="10" markerHeight="10" refX="5" refY="0" orient="auto">
            <path d="M0,6 L6,6 L3,0 z" fill={C.warn} />
          </marker>
        </defs>
        <rect width={W} height={H} fill="url(#ee-grid)" />

        {/* axes */}
        <line x1="40" y1="20" x2="40" y2={H - 30} stroke="rgba(245,241,232,0.3)" />
        <line x1="40" y1={H - 30} x2={W - 10} y2={H - 30} stroke="rgba(245,241,232,0.3)" />
        <text x="14" y={H / 2} fill="rgba(245,241,232,0.5)" fontSize="9" fontFamily="JetBrains Mono"
              transform={`rotate(-90 14 ${H / 2})`} textAnchor="middle">POTENTIAL ENERGY</text>
        <text x={W / 2} y={H - 10} fill="rgba(245,241,232,0.5)" fontSize="9" fontFamily="JetBrains Mono"
              textAnchor="middle">REACTION COORDINATE →</text>

        {/* dashed level lines */}
        <line x1={x0} y1={reactY} x2={x1} y2={reactY} stroke="rgba(245,241,232,0.18)" strokeDasharray="2 4" />
        <line x1={x0} y1={prodY}  x2={x1} y2={prodY}  stroke="rgba(245,241,232,0.18)" strokeDasharray="2 4" />

        {/* the curve */}
        <path ref={pathRef} d={pathD} fill="none" stroke={curveColor} strokeWidth="2.5" strokeLinecap="round" />

        {/* labels */}
        <text x={x0 + 4} y={reactY - 6} fill="var(--paper)" fontSize="10" fontFamily="JetBrains Mono">REACTANTS</text>
        <text x={x1 - 4} y={prodY - 6}  fill="var(--paper)" fontSize="10" fontFamily="JetBrains Mono" textAnchor="end">PRODUCTS</text>
        <text x={xP} y={peakY - 8} fill={C.warn} fontSize="10" fontFamily="JetBrains Mono" textAnchor="middle">‡  Eₐ</text>

        {/* Eₐ arrow on the left side of the peak */}
        <line x1={xR + 10} y1={reactY} x2={xR + 10} y2={peakY + 5}
              stroke={C.warn} strokeWidth="1.2" strokeDasharray="3 3" markerEnd="url(#ea-arr)" />
        <text x={xR + 16} y={(reactY + peakY) / 2} fill={C.warn} fontSize="11" fontFamily="Fraunces" fontStyle="italic">
          +{Ea}
        </text>

        {/* ΔH arrow on the right */}
        <line x1={W - 50} y1={reactY} x2={W - 50} y2={prodY}
              stroke={curveColor} strokeWidth="1.5"
              markerEnd={mode === 'exo' ? 'url(#ee-arr-down)' : 'url(#ee-arr-up)'} />
        <text x={W - 44} y={(reactY + prodY) / 2 + 4} fill={curveColor} fontSize="13" fontFamily="Fraunces" fontStyle="italic">
          ΔH
        </text>
        <text x={W - 44} y={(reactY + prodY) / 2 + 20} fill={curveColor} fontSize="10" fontFamily="JetBrains Mono">
          {deltaH > 0 ? '+' : ''}{deltaH}
        </text>

        {/* Marble */}
        <circle cx={marble.x} cy={marble.y} r="14" fill={curveColor} opacity="0.18" />
        <circle cx={marble.x} cy={marble.y} r="6.5" fill={C.paper} stroke="rgba(0,0,0,0.45)" />
      </svg>
    </div>
  );
}

/* ============================================================
   Thermometer
   ============================================================ */

function Thermometer({ mode, delta }: { mode: Mode; delta: number }) {
  // baseline at 50%, swings up (exo) or down (endo) by delta (−1..+1)
  const fill = clamp(0.5 + (mode === 'exo' ? delta : delta) * 0.40, 0.05, 0.95);
  const color = mode === 'exo' ? C.hot : C.cool;
  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
      <svg viewBox="0 0 80 200" style={{ width: 64, height: 180 }}>
        {/* ticks */}
        {[0.2, 0.4, 0.6, 0.8].map((v, i) => (
          <line key={i} x1="44" y1={20 + (1 - v) * 140} x2="50" y2={20 + (1 - v) * 140}
                stroke="rgba(245,241,232,0.4)" />
        ))}
        {/* tube */}
        <rect x="32" y="20" width="14" height="140" rx="7" fill="var(--ink-2)" stroke="var(--line-strong)" />
        {/* fluid */}
        <rect x="34" y={20 + (1 - fill) * 140} width="10" height={fill * 140} fill={color}
              style={{ transition: 'all 200ms' }} />
        {/* bulb */}
        <circle cx="39" cy="170" r="14" fill={color} stroke="var(--line-strong)" />
        {/* labels */}
        <text x="56" y="24"  fill="rgba(245,241,232,0.5)" fontSize="9" fontFamily="JetBrains Mono">hot</text>
        <text x="56" y="160" fill="rgba(245,241,232,0.5)" fontSize="9" fontFamily="JetBrains Mono">cold</text>
      </svg>
    </div>
  );
}

/* ============================================================
   Tally column
   ============================================================ */

function TallyCol({
  title, sign, color, items, progress, total, live,
}: {
  title: string; sign: '+' | '−'; color: string;
  items: { name: string; E: number }[]; progress: number; total: number; live: number;
}) {
  return (
    <div style={{ borderLeft: `2px solid ${color}55`, padding: '4px 0 4px 10px' }}>
      <div className="eyebrow" style={{ color }}>{title}</div>
      <div style={{ marginTop: 6, display: 'grid', gap: 4 }}>
        {items.map((b, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <span style={{ color: 'var(--paper-dim)' }}>{b.name}</span>
            <span className="mono" style={{ color: progress >= (i + 1) / items.length ? color : 'var(--paper-faint)' }}>
              {sign}{b.E}
            </span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 6, height: 4, background: 'var(--ink-2)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${progress * 100}%`, background: color, transition: 'width 100ms' }} />
      </div>
      <div className="mono" style={{ fontSize: 11, color, marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
        <span>{sign}{live.toFixed(0)}</span>
        <span style={{ color: 'var(--paper-faint)' }}>/ {sign}{total}</span>
      </div>
    </div>
  );
}

/* ============================================================
   Small atoms
   ============================================================ */

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--ink-1)', border: '1px solid var(--line)', borderRadius: 6,
      padding: 16, display: 'flex', flexDirection: 'column',
    }}>
      {children}
    </div>
  );
}

function NumStat({ label, value, accent, big }: { label: string; value: string; accent?: string; big?: boolean }) {
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 4 }}>{label}</div>
      <div className="serif" style={{ fontSize: big ? 22 : 16, color: accent ?? 'var(--paper)' }}>{value}</div>
    </div>
  );
}

function ctrlBtn(): React.CSSProperties {
  return {
    padding: '8px 14px', fontSize: 11, letterSpacing: '0.16em',
    textTransform: 'uppercase', border: '1px solid var(--line-strong)',
    background: 'transparent', color: 'var(--paper)', cursor: 'pointer',
  };
}

function phaseTint(t: number, mode: Mode): string {
  if (t < 0.25) return 'var(--paper-dim)';
  if (t < 0.55) return C.warn;
  return mode === 'exo' ? C.hot : C.cool;
}

function fmt(v: number): string { return `${v > 0 ? '+' : ''}${v.toFixed(0)}`; }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function lerp(a: number, b: number, k: number) { return a + (b - a) * k; }
function ease(x: number) { return x * x * (3 - 2 * x); }
