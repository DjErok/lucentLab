import { useEffect, useMemo, useRef, useState } from 'react';
import UISlider from '../components/ui/Slider';
import SlideTabs from '../components/ui/SlideTabs';

/**
 * Stoichiometry — interactive limiting-reagent simulator.
 * Pick a reaction, set starting molecule counts, and watch reactants
 * collide and convert to products in their stoichiometric ratio.
 * Live bar chart tracks amounts; clearly identifies limiting reagent.
 */

type SpeciesID = string;
type Reaction = {
  id: string;
  label: string;
  equation: React.ReactNode;
  reactants: { id: SpeciesID; coef: number; render: (size: number) => React.ReactNode; color: string; name: string }[];
  products:  { id: SpeciesID; coef: number; render: (size: number) => React.ReactNode; color: string; name: string }[];
};

const H = '#f0e6d2', O = '#ff5b3c', N = '#5dd0ff', C = '#7d8d99', Cl = '#69e36b', Na = '#a78bfa';

const REACTIONS: Reaction[] = [
  {
    id: 'water',
    label: 'Water synthesis',
    equation: <>2 H<sub>2</sub> + O<sub>2</sub> → 2 H<sub>2</sub>O</>,
    reactants: [
      { id: 'H2', coef: 2, color: H, name: 'H₂', render: (s) => Diatomic(H, H, s, 'H', 'H') },
      { id: 'O2', coef: 1, color: O, name: 'O₂', render: (s) => Diatomic(O, O, s * 1.15, 'O', 'O') },
    ],
    products: [
      { id: 'H2O', coef: 2, color: '#9bd5ff', name: 'H₂O', render: (s) => Water(s) },
    ],
  },
  {
    id: 'ammonia',
    label: 'Haber–Bosch',
    equation: <>N<sub>2</sub> + 3 H<sub>2</sub> → 2 NH<sub>3</sub></>,
    reactants: [
      { id: 'N2', coef: 1, color: N, name: 'N₂', render: (s) => Diatomic(N, N, s * 1.15, 'N', 'N') },
      { id: 'H2', coef: 3, color: H, name: 'H₂', render: (s) => Diatomic(H, H, s, 'H', 'H') },
    ],
    products: [
      { id: 'NH3', coef: 2, color: '#b8e3ff', name: 'NH₃', render: (s) => Ammonia(s) },
    ],
  },
  {
    id: 'methane',
    label: 'Methane combustion',
    equation: <>CH<sub>4</sub> + 2 O<sub>2</sub> → CO<sub>2</sub> + 2 H<sub>2</sub>O</>,
    reactants: [
      { id: 'CH4', coef: 1, color: C, name: 'CH₄', render: (s) => Methane(s) },
      { id: 'O2',  coef: 2, color: O, name: 'O₂', render: (s) => Diatomic(O, O, s * 1.15, 'O', 'O') },
    ],
    products: [
      { id: 'CO2', coef: 1, color: '#aab4bd', name: 'CO₂', render: (s) => CO2(s) },
      { id: 'H2O', coef: 2, color: '#9bd5ff', name: 'H₂O', render: (s) => Water(s) },
    ],
  },
  {
    id: 'salt',
    label: 'Salt formation',
    equation: <>2 Na + Cl<sub>2</sub> → 2 NaCl</>,
    reactants: [
      { id: 'Na',  coef: 2, color: Na, name: 'Na', render: (s) => Mono(Na, s, 'Na') },
      { id: 'Cl2', coef: 1, color: Cl, name: 'Cl₂', render: (s) => Diatomic(Cl, Cl, s * 1.1, 'Cl', 'Cl') },
    ],
    products: [
      { id: 'NaCl', coef: 2, color: '#c9b3ff', name: 'NaCl', render: (s) => Diatomic(Na, Cl, s, 'Na', 'Cl') },
    ],
  },
];

export default function Stoichiometry() {
  const [rxnId, setRxnId] = useState(REACTIONS[0].id);
  const rxn = REACTIONS.find(r => r.id === rxnId)!;

  // Initial counts per reactant — keyed by reactant id
  const [counts, setCounts] = useState<Record<string, number>>(() => initialCounts(REACTIONS[0]));
  // When reaction changes, reset counts to defaults for that reaction
  useEffect(() => { setCounts(initialCounts(rxn)); setProgress(0); setRunning(true); }, [rxnId]);

  const [progress, setProgress] = useState(0); // 0..1, fraction of limiting consumption
  const [running, setRunning] = useState(true);
  const lastTime = useRef<number>(0);

  // Guard: if counts don't yet contain entries for this rxn (right after a switch),
  // fall back to the reaction's defaults so downstream math never sees undefined.
  const safeCounts = useMemo(() => {
    const base = initialCounts(rxn);
    for (const r of rxn.reactants) {
      if (typeof counts[r.id] === 'number') base[r.id] = counts[r.id];
    }
    return base;
  }, [rxn, counts]);

  // Compute limiting reagent given current starting counts
  const { limiting, maxExtent, finalAmounts, excess } = useMemo(
    () => computeStoichiometry(rxn, safeCounts),
    [rxn, safeCounts]
  );

  // Animate progress 0..1
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    lastTime.current = performance.now();
    const loop = (now: number) => {
      const dt = (now - lastTime.current) / 1000;
      lastTime.current = now;
      setProgress(p => {
        const next = p + dt / 6; // 6 seconds for full extent
        if (next >= 1) { setRunning(false); return 1; }
        return next;
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  // Current amounts at this progress
  const live = useMemo(() => liveAmounts(rxn, safeCounts, maxExtent, progress), [rxn, safeCounts, maxExtent, progress]);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Reaction selector */}
      <SlideTabs<string>
        tabs={REACTIONS.map(r => ({ id: r.id, label: r.label }))}
        value={rxnId}
        onChange={setRxnId}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
        <div className="serif" style={{ fontSize: 24, fontStyle: 'italic' }}>{rxn.equation}</div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--paper-dim)' }}>
          ratio · {rxn.reactants.map(r => r.coef).join(' : ')} → {rxn.products.map(p => p.coef).join(' : ')}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        {/* Flask scene */}
        <div style={{
          background: 'var(--ink-1)',
          border: '1px solid var(--line)',
          borderRadius: 6,
          aspectRatio: '1.4 / 1',
          padding: 18,
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="eyebrow">Flask · t = {(progress * 100).toFixed(0)}%</div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--paper-dim)' }}>
              extent ξ = {(progress * maxExtent).toFixed(2)}
            </div>
          </div>

          <ParticleScene rxn={rxn} live={live} />

          {progress >= 1 && (
            <div className="mono" style={{
              position: 'absolute', bottom: 14, left: 18, right: 18,
              fontSize: 10, color: 'var(--acid)', letterSpacing: '0.14em',
            }}>
              ⟶ {limiting.name.toUpperCase()} EXHAUSTED · REACTION COMPLETE
            </div>
          )}
        </div>

        {/* Right: controls + live readouts */}
        <div style={{
          background: 'var(--ink-1)',
          border: '1px solid var(--line)',
          borderRadius: 6,
          padding: 20,
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div className="eyebrow">Starting amounts</div>
          {rxn.reactants.map(r => (
            <Slider
              key={r.id}
              label={`${r.name} · molecules`}
              value={safeCounts[r.id]}
              onChange={(v: number) => { setCounts(c => ({ ...c, [r.id]: v })); resetTo(setProgress, setRunning); }}
              min={1}
              max={20}
              accent={r.color}
            />
          ))}

          {/* Run controls */}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <ControlBtn onClick={() => { setProgress(0); setRunning(true); }}>↻ Run</ControlBtn>
            <ControlBtn onClick={() => setRunning(r => !r)}>{running ? '❚❚ Pause' : '▶ Play'}</ControlBtn>
            <ControlBtn onClick={() => { setRunning(false); setProgress(0); }}>■ Reset</ControlBtn>
          </div>

          {/* Limiting reagent callout */}
          <div style={{
            marginTop: 4, padding: 12,
            border: `1px solid ${limiting.color}66`, background: `${limiting.color}10`,
            borderRadius: 4,
          }}>
            <div className="eyebrow" style={{ color: limiting.color }}>LIMITING REAGENT</div>
            <div className="serif" style={{ fontSize: 24, color: limiting.color }}>{limiting.name}</div>
            <div style={{ fontSize: 11, color: 'var(--paper-dim)', marginTop: 4, lineHeight: 1.5 }}>
              {limiting.reason}
            </div>
          </div>

          {/* Theoretical yield */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
            {rxn.products.map(p => (
              <Stat key={p.id} label={`${p.name} produced`} value={`${finalAmounts[p.id].toFixed(0)}`} accent="var(--phos)" />
            ))}
            {Object.entries(excess).map(([id, v]) => (
              <Stat key={id} label={`${id} leftover`} value={`${v.toFixed(1)}`} />
            ))}
          </div>
        </div>
      </div>

      {/* Bar chart — concentrations over the course of the reaction */}
      <BarChart rxn={rxn} live={live} starting={safeCounts} finalAmounts={finalAmounts} />
    </div>
  );
}

// ───── helpers ─────

function initialCounts(r: Reaction): Record<string, number> {
  const m: Record<string, number> = {};
  r.reactants.forEach((s, i) => { m[s.id] = i === 0 ? 6 : 4; });
  return m;
}

function resetTo(setP: (n: number) => void, setR: (b: boolean) => void) {
  setP(0); setR(true);
}

function computeStoichiometry(rxn: Reaction, counts: Record<string, number>) {
  // Extent ξ such that for each reactant, n_i - coef_i * ξ ≥ 0
  // Limiting reagent: smallest n_i / coef_i
  let limitingId = rxn.reactants[0].id, minRatio = Infinity, reason = '';
  for (const r of rxn.reactants) {
    const ratio = (counts[r.id] ?? 0) / r.coef;
    if (ratio < minRatio) { minRatio = ratio; limitingId = r.id; }
  }
  const lim = rxn.reactants.find(r => r.id === limitingId)!;
  const have = counts[limitingId];
  reason = `${have} ${lim.name} ÷ coef ${lim.coef} = ${(have / lim.coef).toFixed(2)}; smallest ratio sets the cap.`;

  const maxExtent = minRatio;
  const finalAmounts: Record<string, number> = {};
  rxn.products.forEach(p => { finalAmounts[p.id] = p.coef * maxExtent; });
  const excess: Record<string, number> = {};
  rxn.reactants.forEach(r => {
    if (r.id !== limitingId) {
      const left = counts[r.id] - r.coef * maxExtent;
      excess[r.name] = left;
    }
  });
  return { limiting: { ...lim, reason }, maxExtent, finalAmounts, excess };
}

function liveAmounts(rxn: Reaction, counts: Record<string, number>, maxExtent: number, progress: number) {
  const ext = progress * maxExtent;
  const reactants: Record<string, number> = {};
  const products: Record<string, number> = {};
  rxn.reactants.forEach(r => { reactants[r.id] = Math.max(0, counts[r.id] - r.coef * ext); });
  rxn.products.forEach(p => { products[p.id] = p.coef * ext; });
  return { reactants, products };
}

// ───── particle scene ─────

function ParticleScene({ rxn, live }: { rxn: Reaction; live: ReturnType<typeof liveAmounts> }) {
  // Render reactant + product molecules as a flowing grid that drifts gently.
  // Quantities round to nearest whole; use opacity for fractional fade.
  const items: { key: string; el: React.ReactNode }[] = [];
  rxn.reactants.forEach(r => {
    const n = live.reactants[r.id];
    const whole = Math.floor(n);
    const frac = n - whole;
    for (let i = 0; i < whole; i++) items.push({ key: `${r.id}-${i}`, el: r.render(28) });
    if (frac > 0.05) items.push({ key: `${r.id}-frac`, el: <span style={{ opacity: frac }}>{r.render(28)}</span> });
  });
  rxn.products.forEach(p => {
    const n = live.products[p.id];
    const whole = Math.floor(n);
    const frac = n - whole;
    for (let i = 0; i < whole; i++) items.push({ key: `${p.id}-${i}`, el: p.render(28) });
    if (frac > 0.05) items.push({ key: `${p.id}-frac`, el: <span style={{ opacity: frac }}>{p.render(28)}</span> });
  });

  return (
    <div style={{
      position: 'absolute', inset: '46px 18px 30px',
      display: 'flex', flexWrap: 'wrap', gap: 10, alignContent: 'flex-start',
    }}>
      {items.map(({ key, el }) => (
        <div key={key} style={{ display: 'inline-flex', animation: 'st-drift 3s ease-in-out infinite alternate', animationDelay: `${(key.charCodeAt(0) % 10) * 0.1}s` }}>
          {el}
        </div>
      ))}
      <style>{`@keyframes st-drift { from { transform: translateY(0) } to { transform: translateY(4px) } }`}</style>
    </div>
  );
}

// ───── bar chart ─────

function BarChart({ rxn, live, starting, finalAmounts }: {
  rxn: Reaction;
  live: ReturnType<typeof liveAmounts>;
  starting: Record<string, number>;
  finalAmounts: Record<string, number>;
}) {
  const all = [
    ...rxn.reactants.map(r => ({ kind: 'r' as const, id: r.id, name: r.name, color: r.color, current: live.reactants[r.id], start: starting[r.id], finalY: 0 })),
    ...rxn.products.map(p  => ({ kind: 'p' as const, id: p.id,  name: p.name,  color: p.color, current: live.products[p.id], start: 0, finalY: finalAmounts[p.id] })),
  ];
  const max = Math.max(...all.map(x => Math.max(x.start, x.finalY, x.current)), 1);

  return (
    <div style={{
      background: 'var(--ink-1)', border: '1px solid var(--line)',
      borderRadius: 6, padding: 20,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="eyebrow">Live amounts</div>
        <div className="mono" style={{ fontSize: 10, color: 'var(--paper-dim)' }}>
          REACTANTS ↓   ·   PRODUCTS ↑
        </div>
      </div>
      <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: `repeat(${all.length}, 1fr)`, gap: 18, alignItems: 'end', height: 180 }}>
        {all.map(b => {
          const h = (b.current / max) * 140;
          const startH = (b.start / max) * 140;
          const targetH = (b.finalY / max) * 140;
          return (
            <div key={b.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
              {/* live bar */}
              <div style={{ position: 'relative', width: '70%', height: 150, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                {/* start ghost (reactants only) */}
                {b.kind === 'r' && b.start > 0 && (
                  <div style={{
                    position: 'absolute', bottom: 0, width: '100%', height: startH,
                    border: `1px dashed ${b.color}55`, borderRadius: 3,
                  }} />
                )}
                {/* target ghost (products only) */}
                {b.kind === 'p' && b.finalY > 0 && (
                  <div style={{
                    position: 'absolute', bottom: 0, width: '100%', height: targetH,
                    border: `1px dashed ${b.color}55`, borderRadius: 3,
                  }} />
                )}
                <div style={{
                  width: '100%', height: h,
                  background: `linear-gradient(180deg, ${b.color}cc 0%, ${b.color}77 100%)`,
                  borderTop: `2px solid ${b.color}`,
                  borderRadius: 3,
                  transition: 'height 200ms ease-out',
                }} />
              </div>
              <div className="mono" style={{ fontSize: 11, color: b.color }}>{b.name}</div>
              <div className="mono" style={{ fontSize: 10, color: 'var(--paper-faint)' }}>{b.current.toFixed(1)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ───── molecule renderers ─────

function Mono(color: string, size: number, label: string) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `radial-gradient(circle at 35% 30%, #fff8 0%, ${color} 60%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#0a0908', fontFamily: 'JetBrains Mono', fontSize: size * 0.42, fontWeight: 600,
      boxShadow: `0 0 ${size * 0.4}px ${color}55`,
    }}>{label}</div>
  );
}

function Diatomic(c1: string, c2: string, size: number, l1: string, l2: string) {
  return (
    <div style={{ position: 'relative', width: size * 1.7, height: size, display: 'flex', alignItems: 'center' }}>
      {Mono(c1, size, l1)}
      <div style={{ position: 'absolute', left: size * 0.85, top: '50%', width: size * 0.3, height: 3, background: 'rgba(245,241,232,0.6)', transform: 'translateY(-50%)' }} />
      <div style={{ position: 'absolute', left: size * 0.7, top: 0 }}>{Mono(c2, size, l2)}</div>
    </div>
  );
}

function Water(size: number) {
  return (
    <div style={{ position: 'relative', width: size * 1.7, height: size * 1.4 }}>
      <div style={{ position: 'absolute', left: size * 0.35, top: 0 }}>{Mono(O, size, 'O')}</div>
      <div style={{ position: 'absolute', left: 0, top: size * 0.55 }}>{Mono(H, size * 0.7, 'H')}</div>
      <div style={{ position: 'absolute', right: 0, top: size * 0.55 }}>{Mono(H, size * 0.7, 'H')}</div>
    </div>
  );
}

function Ammonia(size: number) {
  return (
    <div style={{ position: 'relative', width: size * 1.8, height: size * 1.3 }}>
      <div style={{ position: 'absolute', left: size * 0.4, top: 0 }}>{Mono(N, size, 'N')}</div>
      <div style={{ position: 'absolute', left: 0, top: size * 0.55 }}>{Mono(H, size * 0.65, 'H')}</div>
      <div style={{ position: 'absolute', left: size * 0.55, top: size * 0.7 }}>{Mono(H, size * 0.65, 'H')}</div>
      <div style={{ position: 'absolute', right: 0, top: size * 0.55 }}>{Mono(H, size * 0.65, 'H')}</div>
    </div>
  );
}

function Methane(size: number) {
  return (
    <div style={{ position: 'relative', width: size * 1.9, height: size * 1.5 }}>
      <div style={{ position: 'absolute', left: size * 0.45, top: size * 0.3 }}>{Mono(C, size, 'C')}</div>
      <div style={{ position: 'absolute', left: 0, top: 0 }}>{Mono(H, size * 0.55, 'H')}</div>
      <div style={{ position: 'absolute', right: 0, top: 0 }}>{Mono(H, size * 0.55, 'H')}</div>
      <div style={{ position: 'absolute', left: 0, bottom: 0 }}>{Mono(H, size * 0.55, 'H')}</div>
      <div style={{ position: 'absolute', right: 0, bottom: 0 }}>{Mono(H, size * 0.55, 'H')}</div>
    </div>
  );
}

function CO2(size: number) {
  return (
    <div style={{ position: 'relative', width: size * 2.6, height: size, display: 'flex', alignItems: 'center' }}>
      {Mono(O, size * 0.9, 'O')}
      <div style={{ width: size * 0.35, height: 4, background: 'rgba(245,241,232,0.6)' }} />
      {Mono(C, size, 'C')}
      <div style={{ width: size * 0.35, height: 4, background: 'rgba(245,241,232,0.6)' }} />
      {Mono(O, size * 0.9, 'O')}
    </div>
  );
}

// ───── small UI atoms ─────

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

function Slider({ label, value, onChange, min, max, accent }: any) {
  return (
    <UISlider label={label} value={value} min={min} max={max} step={1}
              onChange={onChange} accent={accent}
              format={(v) => Number.isInteger(v) ? `${v}` : v.toFixed(2)} />
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 4 }}>{label}</div>
      <div className="serif" style={{ fontSize: 17, color: accent ?? 'var(--paper)' }}>{value}</div>
    </div>
  );
}
