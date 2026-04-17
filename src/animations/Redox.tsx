import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Redox — interactive electron-transfer simulator.
 * Pick a reaction, watch discrete electrons hop from the reductant to the
 * oxidant; live oxidation-state badges update; half-reactions, OIL RIG
 * mnemonic, standard reduction potential table, E°cell verdict, and a
 * step-by-step balancing walkthrough round out the panel.
 */

type Half = {
  label: string;          // e.g. "Zn → Zn²⁺ + 2e⁻"
  eMinus: number;         // electrons produced (oxidation) or consumed (reduction)
  E0: number;             // standard reduction potential (V), always written as reduction
};

type Rxn = {
  id: string;
  label: string;
  equation: React.ReactNode;
  // Left species = reductant (gets oxidized), right = oxidant (gets reduced)
  left:  { name: string; osBefore: number; osAfter: number; coef: number; color: string; productName: string };
  right: { name: string; osBefore: number; osAfter: number; coef: number; color: string; productName: string };
  oxidation: Half; // reductant half, flipped (written as oxidation)
  reduction: Half; // oxidant half (written as reduction)
  nElec: number;   // electrons exchanged in net equation after scaling
  net: React.ReactNode;
  balancingSteps: { title: string; body: React.ReactNode }[];
};

const ZN = '#a78bfa', CU = '#ff9e6b', MG = '#d6c2ff', H1 = '#f0e6d2',
      FE = '#f6a97a', CL = '#69e36b', AG = '#cfe3ff';

const REACTIONS: Rxn[] = [
  {
    id: 'zn-cu',
    label: 'Zn + Cu²⁺',
    equation: <>Zn + Cu²⁺ → Zn²⁺ + Cu</>,
    left:  { name: 'Zn',   osBefore: 0,  osAfter: +2, coef: 1, color: ZN, productName: 'Zn²⁺' },
    right: { name: 'Cu²⁺', osBefore: +2, osAfter: 0,  coef: 1, color: CU, productName: 'Cu'   },
    oxidation: { label: 'Zn → Zn²⁺ + 2 e⁻',  eMinus: 2, E0: -0.76 },
    reduction: { label: 'Cu²⁺ + 2 e⁻ → Cu', eMinus: 2, E0: +0.34 },
    nElec: 2,
    net: <>Zn + Cu²⁺ → Zn²⁺ + Cu</>,
    balancingSteps: [
      { title: '1 · Assign oxidation states',  body: <>Zn(0), Cu(+2) → Zn(+2), Cu(0). Zn loses 2e⁻; Cu gains 2e⁻.</> },
      { title: '2 · Write half-reactions',     body: <>Ox: Zn → Zn²⁺ + 2 e⁻ &nbsp;·&nbsp; Red: Cu²⁺ + 2 e⁻ → Cu</> },
      { title: '3 · Match electrons',          body: <>Both halves already exchange 2 e⁻ — no multiplier needed.</> },
      { title: '4 · Sum & cancel e⁻',          body: <>Zn + Cu²⁺ → Zn²⁺ + Cu &nbsp;(2 e⁻ cancel)</> },
    ],
  },
  {
    id: 'mg-h',
    label: 'Mg + 2H⁺',
    equation: <>Mg + 2 H⁺ → Mg²⁺ + H<sub>2</sub></>,
    left:  { name: 'Mg',  osBefore: 0,  osAfter: +2, coef: 1, color: MG, productName: 'Mg²⁺' },
    right: { name: 'H⁺',  osBefore: +1, osAfter: 0,  coef: 2, color: H1, productName: 'H₂'   },
    oxidation: { label: 'Mg → Mg²⁺ + 2 e⁻',       eMinus: 2, E0: -2.37 },
    reduction: { label: '2 H⁺ + 2 e⁻ → H₂',       eMinus: 2, E0:  0.00 },
    nElec: 2,
    net: <>Mg + 2 H⁺ → Mg²⁺ + H<sub>2</sub></>,
    balancingSteps: [
      { title: '1 · Assign oxidation states',  body: <>Mg(0), H(+1) → Mg(+2), H(0). Mg loses 2e⁻; each H gains 1e⁻.</> },
      { title: '2 · Write half-reactions',     body: <>Ox: Mg → Mg²⁺ + 2 e⁻ &nbsp;·&nbsp; Red: 2 H⁺ + 2 e⁻ → H₂</> },
      { title: '3 · Match electrons',          body: <>Both sides show 2 e⁻ (the H half already uses 2 H⁺). No scaling.</> },
      { title: '4 · Sum & cancel e⁻',          body: <>Mg + 2 H⁺ → Mg²⁺ + H₂</> },
    ],
  },
  {
    id: 'fe-cl',
    label: '2Fe²⁺ + Cl₂',
    equation: <>2 Fe²⁺ + Cl<sub>2</sub> → 2 Fe³⁺ + 2 Cl⁻</>,
    left:  { name: 'Fe²⁺', osBefore: +2, osAfter: +3, coef: 2, color: FE, productName: 'Fe³⁺' },
    right: { name: 'Cl₂',  osBefore: 0,  osAfter: -1, coef: 1, color: CL, productName: 'Cl⁻'  },
    oxidation: { label: 'Fe²⁺ → Fe³⁺ + e⁻',        eMinus: 1, E0: +0.77 },
    reduction: { label: 'Cl₂ + 2 e⁻ → 2 Cl⁻',      eMinus: 2, E0: +1.36 },
    nElec: 2,
    net: <>2 Fe²⁺ + Cl<sub>2</sub> → 2 Fe³⁺ + 2 Cl⁻</>,
    balancingSteps: [
      { title: '1 · Assign oxidation states',  body: <>Fe(+2) → Fe(+3) loses 1 e⁻; Cl(0) → Cl(−1) each gains 1 e⁻.</> },
      { title: '2 · Write half-reactions',     body: <>Ox: Fe²⁺ → Fe³⁺ + e⁻ &nbsp;·&nbsp; Red: Cl₂ + 2 e⁻ → 2 Cl⁻</> },
      { title: '3 · Match electrons',          body: <>Multiply Fe half by 2: 2 Fe²⁺ → 2 Fe³⁺ + 2 e⁻</> },
      { title: '4 · Sum & cancel e⁻',          body: <>2 Fe²⁺ + Cl₂ → 2 Fe³⁺ + 2 Cl⁻ &nbsp;(2 e⁻ cancel)</> },
    ],
  },
  {
    id: 'cu-ag',
    label: 'Cu + 2Ag⁺',
    equation: <>Cu + 2 Ag⁺ → Cu²⁺ + 2 Ag</>,
    left:  { name: 'Cu',  osBefore: 0,  osAfter: +2, coef: 1, color: CU, productName: 'Cu²⁺' },
    right: { name: 'Ag⁺', osBefore: +1, osAfter: 0,  coef: 2, color: AG, productName: 'Ag'   },
    oxidation: { label: 'Cu → Cu²⁺ + 2 e⁻',        eMinus: 2, E0: +0.34 },
    reduction: { label: 'Ag⁺ + e⁻ → Ag',           eMinus: 1, E0: +0.80 },
    nElec: 2,
    net: <>Cu + 2 Ag⁺ → Cu²⁺ + 2 Ag</>,
    balancingSteps: [
      { title: '1 · Assign oxidation states',  body: <>Cu(0) → Cu(+2) loses 2 e⁻; Ag(+1) → Ag(0) each gains 1 e⁻.</> },
      { title: '2 · Write half-reactions',     body: <>Ox: Cu → Cu²⁺ + 2 e⁻ &nbsp;·&nbsp; Red: Ag⁺ + e⁻ → Ag</> },
      { title: '3 · Match electrons',          body: <>Multiply Ag half by 2: 2 Ag⁺ + 2 e⁻ → 2 Ag</> },
      { title: '4 · Sum & cancel e⁻',          body: <>Cu + 2 Ag⁺ → Cu²⁺ + 2 Ag &nbsp;(2 e⁻ cancel)</> },
    ],
  },
];

// Fixed electron "slot" positions along the flight arc; at any instant each
// slot holds 0 or 1 electron. We animate hops one at a time.
const TOTAL_HOPS = 6;

export default function Redox() {
  const [rxnId, setRxnId] = useState(REACTIONS[0].id);
  const rxn = useMemo(() => REACTIONS.find(r => r.id === rxnId)!, [rxnId]);

  const [speed, setSpeed] = useState(1);          // 0.25..3x
  const [running, setRunning] = useState(true);
  const [hopsDone, setHopsDone] = useState(0);    // 0..TOTAL_HOPS
  const [hopProgress, setHopProgress] = useState(0); // 0..1 for current in-flight electron
  const [stepIdx, setStepIdx] = useState(-1);     // -1 = not started

  // Reset transient state when the reaction changes
  useEffect(() => {
    setHopsDone(0); setHopProgress(0); setStepIdx(-1); setRunning(true);
  }, [rxnId]);

  // rAF loop for electron hops — pause on document.hidden, running=false, or complete
  const rafRef = useRef<number | null>(null);
  const lastT = useRef<number>(0);
  useEffect(() => {
    const onVis = () => { lastT.current = performance.now(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    if (!running) return;
    if (hopsDone >= TOTAL_HOPS) return;
    lastT.current = performance.now();
    const loop = (now: number) => {
      if (document.hidden) { lastT.current = now; rafRef.current = requestAnimationFrame(loop); return; }
      const dt = (now - lastT.current) / 1000;
      lastT.current = now;
      setHopProgress(p => {
        // one hop takes ~1.1s at speed=1
        const next = p + (dt * speed) / 1.1;
        if (next >= 1) {
          setHopsDone(h => Math.min(TOTAL_HOPS, h + 1));
          return 0;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [running, speed, hopsDone]);

  // Oxidation state "morph" fraction for badges — ramps smoothly with hops completed
  const morph = Math.min(1, (hopsDone + hopProgress) / TOTAL_HOPS);
  const leftOS  = lerp(rxn.left.osBefore,  rxn.left.osAfter,  morph);
  const rightOS = lerp(rxn.right.osBefore, rxn.right.osAfter, morph);
  const transferred = morph >= 1;

  // E°cell = E°cathode (reduction half as written) − E°anode (reductant half, still as reduction)
  // Reductant's half written as oxidation flips sign — so E°anode (reduction) = −E0ox written as oxidation
  // We've stored E0 as reduction potential on both halves, so E°cell = reduction.E0 − oxidation.E0.
  const Ecell = rxn.reduction.E0 - rxn.oxidation.E0;
  const spontaneous = Ecell > 0;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Reaction selector */}
      <div role="tablist" aria-label="Reaction" style={{ display: 'flex', flexWrap: 'wrap' }}>
        {REACTIONS.map((r, i) => {
          const active = r.id === rxnId;
          return (
            <button
              key={r.id}
              role="tab"
              aria-selected={active}
              onClick={() => setRxnId(r.id)}
              className="mono"
              style={{
                padding: '10px 16px', fontSize: 11, letterSpacing: '0.14em',
                textTransform: 'uppercase',
                border: '1px solid var(--line-strong)',
                borderLeft: i === 0 ? '1px solid var(--line-strong)' : 0,
                background: active ? 'var(--paper)' : 'transparent',
                color: active ? 'var(--ink-0)' : 'var(--paper-dim)',
                fontWeight: active ? 600 : 400, cursor: 'pointer',
              }}
            >{r.label}</button>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
        <div className="serif" style={{ fontSize: 24, fontStyle: 'italic' }}>{rxn.equation}</div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--paper-dim)' }}>
          n · {rxn.nElec} e⁻ transferred   ·   E°cell = {fmtV(Ecell)}
        </div>
      </div>

      {/* OIL RIG banner */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0,
        border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden',
      }}>
        <MnemonicTile kind="OIL" title="Oxidation Is Loss" sub={`${rxn.left.name} loses ${rxn.oxidation.eMinus} e⁻`} />
        <MnemonicTile kind="RIG" title="Reduction Is Gain" sub={`${rxn.right.name} gains ${rxn.reduction.eMinus} e⁻`} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        {/* Scene */}
        <div style={{
          position: 'relative',
          background: 'var(--ink-1)',
          border: '1px solid var(--line)',
          borderRadius: 6,
          aspectRatio: '1.5 / 1',
          padding: 18,
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="eyebrow">Scene · electron transfer</div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--paper-dim)' }}>
              HOPS · {hopsDone}/{TOTAL_HOPS}   ·   {Math.round(speed * 100)}% SPEED
            </div>
          </div>

          <ElectronScene rxn={rxn} hopsDone={hopsDone} hopProgress={hopProgress} leftOS={leftOS} rightOS={rightOS} transferred={transferred} />

          {transferred && (
            <div className="mono" style={{
              position: 'absolute', bottom: 14, left: 18, right: 18,
              fontSize: 10, color: 'var(--acid)', letterSpacing: '0.14em',
            }}>
              ⟶ TRANSFER COMPLETE · {rxn.left.productName} + {rxn.right.productName} FORMED
            </div>
          )}
        </div>

        {/* Controls + half-reactions */}
        <div style={{
          background: 'var(--ink-1)', border: '1px solid var(--line)',
          borderRadius: 6, padding: 20,
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div className="eyebrow">Half-reactions</div>

          <div style={{ borderLeft: '2px solid var(--hot)', paddingLeft: 12 }}>
            <div className="eyebrow" style={{ color: 'var(--hot)' }}>OXIDATION · LOSES e⁻</div>
            <div className="mono" style={{ fontSize: 13, marginTop: 4 }}>{rxn.oxidation.label}</div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--paper-dim)', marginTop: 2 }}>
              E° (as reduction) = {fmtV(rxn.oxidation.E0)}
            </div>
          </div>

          <div style={{ borderLeft: '2px solid var(--cool)', paddingLeft: 12 }}>
            <div className="eyebrow" style={{ color: 'var(--cool)' }}>REDUCTION · GAINS e⁻</div>
            <div className="mono" style={{ fontSize: 13, marginTop: 4 }}>{rxn.reduction.label}</div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--paper-dim)', marginTop: 2 }}>
              E° = {fmtV(rxn.reduction.E0)}
            </div>
          </div>

          <div style={{
            marginTop: 4, padding: 12,
            border: '1px solid var(--line-strong)', borderRadius: 4,
            background: 'var(--ink-2)',
          }}>
            <div className="eyebrow">Net ionic equation</div>
            <div className="serif" style={{ fontSize: 18, marginTop: 4, fontStyle: 'italic' }}>{rxn.net}</div>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <ControlBtn onClick={() => { setHopsDone(0); setHopProgress(0); setRunning(true); }}>↻ Run</ControlBtn>
            <ControlBtn onClick={() => setRunning(r => !r)}>{running ? '❚❚ Pause' : '▶ Play'}</ControlBtn>
            <ControlBtn onClick={() => { setRunning(false); setHopsDone(0); setHopProgress(0); setStepIdx(-1); }}>■ Reset</ControlBtn>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span className="eyebrow">Hop speed</span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--phos)' }}>{speed.toFixed(2)}×</span>
            </div>
            <input type="range" min={0.25} max={3} step={0.05} value={speed}
                   onChange={(e) => setSpeed(Number(e.target.value))}
                   style={{ width: '100%', accentColor: 'var(--phos)' }} />
          </div>
        </div>
      </div>

      {/* Potentials table + balancing walkthrough */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: 16 }}>
        {/* Balancing */}
        <div style={{
          background: 'var(--ink-1)', border: '1px solid var(--line)',
          borderRadius: 6, padding: 20,
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="eyebrow">Step-by-step balancing</div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--paper-dim)' }}>
              {stepIdx < 0 ? 'NOT STARTED' : `STEP ${stepIdx + 1}/${rxn.balancingSteps.length}`}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rxn.balancingSteps.map((s, i) => {
              const active = stepIdx === i;
              const past = stepIdx > i;
              return (
                <div key={i} style={{
                  padding: '10px 12px', borderRadius: 4,
                  border: `1px solid ${active ? 'var(--phos)' : 'var(--line)'}`,
                  background: active ? 'var(--ink-2)' : 'transparent',
                  opacity: past ? 0.6 : 1,
                  transition: 'opacity 150ms, border-color 150ms, background 150ms',
                }}>
                  <div className="mono" style={{ fontSize: 10, letterSpacing: '0.14em', color: active ? 'var(--phos)' : 'var(--paper-dim)' }}>
                    {s.title.toUpperCase()}
                  </div>
                  <div className="serif" style={{ fontSize: 14, marginTop: 4, fontStyle: 'italic' }}>{s.body}</div>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <ControlBtn onClick={() => setStepIdx(i => Math.max(-1, i - 1))}>◂ Prev</ControlBtn>
            <ControlBtn onClick={() => setStepIdx(i => Math.min(rxn.balancingSteps.length - 1, i + 1))}>▸ Next step</ControlBtn>
            <ControlBtn onClick={() => setStepIdx(-1)}>■ Clear</ControlBtn>
          </div>
        </div>

        {/* Potentials table + verdict */}
        <div style={{
          background: 'var(--ink-1)', border: '1px solid var(--line)',
          borderRadius: 6, padding: 20,
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div className="eyebrow">Standard reduction potentials</div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--paper-faint)', letterSpacing: '0.14em' }}>
            E° · 25 °C · 1 M · 1 atm
          </div>

          <PotentialRow label={cathodeLabel(rxn)} value={rxn.reduction.E0} tint="var(--cool)" />
          <PotentialRow label={anodeLabel(rxn)}   value={rxn.oxidation.E0} tint="var(--hot)"  />

          <div style={{ borderTop: '1px dashed var(--line)', paddingTop: 10 }}>
            <div className="mono" style={{ fontSize: 11, color: 'var(--paper-dim)' }}>
              E°cell = E°cathode − E°anode
            </div>
            <div className="mono" style={{ fontSize: 13, marginTop: 4 }}>
              = {fmtV(rxn.reduction.E0)} − ({fmtV(rxn.oxidation.E0)})
            </div>
            <div className="serif" style={{ fontSize: 30, marginTop: 6, color: spontaneous ? 'var(--phos)' : 'var(--acid)' }}>
              {fmtV(Ecell)}
            </div>
          </div>

          <div style={{
            padding: 12, borderRadius: 4,
            border: `1px solid ${spontaneous ? 'var(--phos)' : 'var(--acid)'}44`,
            background: `${spontaneous ? 'var(--phos)' : 'var(--acid)'}10`,
          }}>
            <div className="eyebrow" style={{ color: spontaneous ? 'var(--phos)' : 'var(--acid)' }}>
              Verdict
            </div>
            <div className="serif" style={{ fontSize: 18, marginTop: 4, color: spontaneous ? 'var(--phos)' : 'var(--acid)' }}>
              {spontaneous ? '✓ Spontaneous  ·  E°cell > 0' : '✗ Non-spontaneous  ·  E°cell ≤ 0'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--paper-dim)', marginTop: 6, lineHeight: 1.5 }}>
              ΔG° = −nFE°cell = {fmtkJ(-rxn.nElec * 96.485 * Ecell)} kJ/mol (F = 96 485 C/mol)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────── scene ─────── */

function ElectronScene({
  rxn, hopsDone, hopProgress, leftOS, rightOS, transferred,
}: {
  rxn: Rxn; hopsDone: number; hopProgress: number;
  leftOS: number; rightOS: number; transferred: boolean;
}) {
  // Two atoms — left (reductant) and right (oxidant). During animation,
  // an electron departs from the left orbital, arcs over, arrives at the
  // right atom. Two "ghost" electrons at left start, ghost circles drop
  // as hops complete to give the visual of electrons leaving.
  const leftX = 150, rightX = 450, cy = 160;

  const currentName = (side: 'L' | 'R') => {
    if (side === 'L') return transferred ? rxn.left.productName  : rxn.left.name;
    return transferred ? rxn.right.productName : rxn.right.name;
  };

  return (
    <svg viewBox="0 0 600 320" style={{ width: '100%', height: 'calc(100% - 30px)', marginTop: 8 }}>
      <defs>
        <radialGradient id="lgrad" cx="0.35" cy="0.35">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="60%" stopColor={rxn.left.color} />
          <stop offset="100%" stopColor={rxn.left.color} stopOpacity="0.85" />
        </radialGradient>
        <radialGradient id="rgrad" cx="0.35" cy="0.35">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="60%" stopColor={rxn.right.color} />
          <stop offset="100%" stopColor={rxn.right.color} stopOpacity="0.85" />
        </radialGradient>
        <marker id="rx-arrow" markerWidth="10" markerHeight="10" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill="rgba(245,241,232,0.5)" />
        </marker>
      </defs>

      {/* Flow arrow baseline */}
      <line x1={leftX + 60} y1={260} x2={rightX - 60} y2={260}
            stroke="rgba(245,241,232,0.35)" strokeWidth="1" markerEnd="url(#rx-arrow)" />
      <text x={(leftX + rightX) / 2} y={278} textAnchor="middle"
            fontFamily="JetBrains Mono" fontSize="10"
            fill="rgba(245,241,232,0.55)" letterSpacing="0.14em">
        ELECTRON FLOW →
      </text>

      {/* LEFT atom */}
      <g transform={`translate(${leftX},${cy})`}>
        <circle r="55" fill="url(#lgrad)" stroke="rgba(0,0,0,0.4)" />
        <text textAnchor="middle" y="8" fontFamily="Fraunces" fontSize="30" fontWeight="600" fill="#0a0908">
          {currentName('L')}
        </text>
        <text textAnchor="middle" y="-72" fontFamily="JetBrains Mono" fontSize="11"
              fill="var(--hot)" letterSpacing="0.16em">
          REDUCTANT · OX
        </text>
        {/* OS badge */}
        <OSBadge x={0} y={82} before={rxn.left.osBefore} after={rxn.left.osAfter} live={leftOS} name={rxn.left.name} productName={rxn.left.productName} tint="var(--hot)" />
      </g>

      {/* RIGHT atom */}
      <g transform={`translate(${rightX},${cy})`}>
        <circle r="55" fill="url(#rgrad)" stroke="rgba(0,0,0,0.4)" />
        <text textAnchor="middle" y="8" fontFamily="Fraunces" fontSize="30" fontWeight="600" fill="#0a0908">
          {currentName('R')}
        </text>
        <text textAnchor="middle" y="-72" fontFamily="JetBrains Mono" fontSize="11"
              fill="var(--cool)" letterSpacing="0.16em">
          OXIDANT · RED
        </text>
        <OSBadge x={0} y={82} before={rxn.right.osBefore} after={rxn.right.osAfter} live={rightOS} name={rxn.right.name} productName={rxn.right.productName} tint="var(--cool)" />
      </g>

      {/* Ghost electron dots sitting on the LEFT atom — shrink as hops complete */}
      {Array.from({ length: TOTAL_HOPS }).map((_, i) => {
        const gone = i < hopsDone || (i === hopsDone && hopProgress > 0.05);
        const angle = (i / TOTAL_HOPS) * Math.PI * 2 - Math.PI / 2;
        const x = leftX + Math.cos(angle) * 42;
        const y = cy + Math.sin(angle) * 42;
        return (
          <circle key={`gl-${i}`} cx={x} cy={y} r="4"
                  fill={gone ? 'rgba(251,191,36,0.15)' : '#fbbf24'}
                  stroke={gone ? 'rgba(251,191,36,0.25)' : 'rgba(0,0,0,0.4)'}
                  style={{ transition: 'fill 180ms' }} />
        );
      })}
      {/* Ghost electron dots arriving on the RIGHT atom — fill as hops land */}
      {Array.from({ length: TOTAL_HOPS }).map((_, i) => {
        const here = i < hopsDone;
        const angle = (i / TOTAL_HOPS) * Math.PI * 2 - Math.PI / 2;
        const x = rightX + Math.cos(angle) * 42;
        const y = cy + Math.sin(angle) * 42;
        return (
          <circle key={`gr-${i}`} cx={x} cy={y} r="4"
                  fill={here ? '#fbbf24' : 'rgba(251,191,36,0.10)'}
                  stroke={here ? 'rgba(0,0,0,0.4)' : 'rgba(251,191,36,0.18)'}
                  style={{ transition: 'fill 180ms' }} />
        );
      })}

      {/* In-flight electron */}
      {hopsDone < TOTAL_HOPS && (() => {
        const k = hopProgress;
        const sx = leftX + 50, sy = cy - 20;
        const ex = rightX - 50, ey = cy - 20;
        const x = sx + (ex - sx) * k;
        const arc = -70;
        const y = sy + (ey - sy) * k + Math.sin(k * Math.PI) * arc;
        return (
          <g>
            <circle cx={x} cy={y} r="10" fill="#fbbf24"
                    filter="drop-shadow(0 0 10px rgba(251,191,36,0.9))" />
            <text x={x} y={y + 3} textAnchor="middle"
                  fontFamily="JetBrains Mono" fontSize="10" fontWeight="600" fill="#0a0908">
              e⁻
            </text>
          </g>
        );
      })()}
    </svg>
  );
}

function OSBadge({
  x, y, before, after, live, name, productName, tint,
}: { x: number; y: number; before: number; after: number; live: number; name: string; productName: string; tint: string }) {
  const showProduct = Math.abs(live - after) < Math.abs(live - before);
  const displayName = showProduct ? productName : name;
  const displayOS = Math.round(live);
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect x="-72" y="-14" width="144" height="28" rx="3"
            fill="rgba(10,9,8,0.5)" stroke={tint} strokeOpacity="0.5" />
      <text x="0" y="5" textAnchor="middle"
            fontFamily="JetBrains Mono" fontSize="11" fill={tint} letterSpacing="0.06em">
        {name}({signed(before)}) → {displayName}({signed(displayOS)})
      </text>
    </g>
  );
}

/* ─────── small UI atoms ─────── */

function MnemonicTile({ kind, title, sub }: { kind: 'OIL' | 'RIG'; title: string; sub: string }) {
  const tint = kind === 'OIL' ? 'var(--hot)' : 'var(--cool)';
  const icon = kind === 'OIL' ? '−e⁻' : '+e⁻';
  return (
    <div style={{
      padding: '12px 16px',
      background: 'var(--ink-1)',
      borderRight: kind === 'OIL' ? '1px solid var(--line)' : undefined,
      display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div className="mono" style={{
        padding: '6px 10px', fontSize: 12, letterSpacing: '0.16em',
        border: `1px solid ${tint}`, color: tint, borderRadius: 3,
      }}>{icon}</div>
      <div>
        <div className="eyebrow" style={{ color: tint }}>{kind}</div>
        <div className="serif" style={{ fontSize: 17, fontStyle: 'italic' }}>{title}</div>
        <div className="mono" style={{ fontSize: 10, color: 'var(--paper-dim)', marginTop: 2 }}>{sub}</div>
      </div>
    </div>
  );
}

function PotentialRow({ label, value, tint }: { label: string; value: number; tint: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 10px', borderLeft: `2px solid ${tint}`, background: 'var(--ink-2)',
                  borderRadius: 3 }}>
      <span className="mono" style={{ fontSize: 12 }}>{label}</span>
      <span className="mono" style={{ fontSize: 13, color: tint }}>{fmtV(value)}</span>
    </div>
  );
}

function ControlBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mono"
      style={{
        flex: 1, padding: '8px 10px', fontSize: 10, letterSpacing: '0.14em',
        textTransform: 'uppercase',
        border: '1px solid var(--line-strong)',
        background: 'transparent', color: 'var(--paper)',
        cursor: 'pointer',
      }}
    >{children}</button>
  );
}

/* ─────── helpers ─────── */

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function signed(n: number) { if (n === 0) return '0'; return n > 0 ? `+${n}` : `${n}`; }
function fmtV(v: number) { return `${v >= 0 ? '+' : ''}${v.toFixed(2)} V`; }
function fmtkJ(j: number) { const kj = j / 1000; return `${kj >= 0 ? '+' : ''}${kj.toFixed(1)}`; }
function cathodeLabel(r: Rxn) { return `Cathode · ${r.reduction.label}`; }
function anodeLabel(r: Rxn)   { return `Anode · ${r.oxidation.label} (reverse)`; }
