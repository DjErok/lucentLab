import { useMemo, useState } from 'react';

/**
 * Gibbs Free Energy — ΔG = ΔH − T·ΔS
 *
 * Interactive simulator showing how spontaneity depends on enthalpy,
 * entropy, and temperature. Sliders feed a live ΔG vs T plot, a
 * sign-quadrant diagram, and a verbose verdict. A gallery of real
 * reactions loads textbook ΔH / ΔS values.
 *
 * Units: ΔH in kJ/mol, ΔS in J/(mol·K), T in K.  ΔG = ΔH − T·ΔS/1000.
 */

type Example = {
  id: string;
  label: string;
  equation: React.ReactNode;
  H: number;       // kJ/mol
  S: number;       // J/(mol·K)
  Tdefault: number;
  note: string;
};

const EXAMPLES: Example[] = [
  {
    id: 'h2o',
    label: 'Water synthesis',
    equation: <>2 H<sub>2</sub>(g) + O<sub>2</sub>(g) → 2 H<sub>2</sub>O(l)</>,
    H: -572, S: -327, Tdefault: 298,
    note: 'Strongly exothermic; entropy decreases (gas → liquid). Spontaneous at room T because |ΔH| ≫ T|ΔS|.',
  },
  {
    id: 'no',
    label: 'NO formation',
    equation: <>N<sub>2</sub>(g) + O<sub>2</sub>(g) → 2 NO(g)</>,
    H: 180, S: 25, Tdefault: 298,
    note: 'Endothermic with small positive ΔS. Crossover T ≈ 7200 K — non-spontaneous in practice.',
  },
  {
    id: 'ice',
    label: 'Ice → water',
    equation: <>H<sub>2</sub>O(s) → H<sub>2</sub>O(l)</>,
    H: 6.0, S: 22, Tdefault: 273,
    note: 'Endothermic melt with positive ΔS. Crossover at exactly 273 K — the melting point.',
  },
  {
    id: 'ch4',
    label: 'Methane combustion',
    equation: <>CH<sub>4</sub>(g) + 2 O<sub>2</sub>(g) → CO<sub>2</sub>(g) + 2 H<sub>2</sub>O(l)</>,
    H: -890, S: -242, Tdefault: 298,
    note: 'Burning fuel: huge negative ΔH overwhelms the entropy penalty. Spontaneous at all reasonable T.',
  },
  {
    id: 'nh3',
    label: 'Ammonia decomposition',
    equation: <>2 NH<sub>3</sub>(g) → N<sub>2</sub>(g) + 3 H<sub>2</sub>(g)</>,
    H: 92, S: 199, Tdefault: 298,
    note: 'Endothermic but entropy-favored (2 mol gas → 4 mol gas). Crossover ≈ 462 K.',
  },
];

export default function Gibbs() {
  const [H, setH] = useState(-50);    // kJ/mol
  const [S, setS] = useState(120);    // J/(mol·K)
  const [T, setT] = useState(298);    // K
  const [activeEx, setActiveEx] = useState<string | null>(null);

  const G = H - (T * S) / 1000; // kJ/mol
  const Tcross = S !== 0 ? (H / S) * 1000 : null; // K  (ΔH / ΔS, with unit fix)
  const spontaneous = G < 0;
  const atEquilibrium = Math.abs(G) < 0.5;

  const verdict = useMemo(() => buildVerdict(H, S, T, G), [H, S, T, G]);

  const loadExample = (e: Example) => {
    setH(e.H); setS(e.S); setT(e.Tdefault); setActiveEx(e.id);
  };
  const clearActive = () => setActiveEx(null);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Examples gallery */}
      <div role="tablist" aria-label="Example reactions" style={{ display: 'flex', gap: 0, flexWrap: 'wrap' }}>
        {EXAMPLES.map((e, i) => {
          const active = e.id === activeEx;
          return (
            <button
              key={e.id}
              role="tab"
              aria-selected={active}
              onClick={() => loadExample(e)}
              className="mono"
              style={{
                padding: '10px 14px', fontSize: 11, letterSpacing: '0.14em',
                textTransform: 'uppercase',
                border: '1px solid var(--line-strong)',
                borderLeft: i === 0 ? '1px solid var(--line-strong)' : 0,
                background: active ? 'var(--paper)' : 'transparent',
                color: active ? 'var(--ink-0)' : 'var(--paper-dim)',
                fontWeight: active ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              {e.label}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
        <div className="serif" style={{ fontSize: 28, fontStyle: 'italic' }}>ΔG = ΔH − T·ΔS</div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--paper-dim)' }}>
          ΔG &lt; 0 spontaneous · ΔG = 0 equilibrium · ΔG &gt; 0 non-spontaneous
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16 }}>
        {/* ΔG vs T plot */}
        <div style={{
          background: 'var(--ink-1)', border: '1px solid var(--line)',
          borderRadius: 6, padding: 18, position: 'relative',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="eyebrow">ΔG vs Temperature</div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--paper-dim)' }}>
              slope = −ΔS · intercept = ΔH
            </div>
          </div>
          <GibbsPlot H={H} S={S} T={T} Tcross={Tcross} />
        </div>

        {/* Sliders + readouts */}
        <div style={{
          background: 'var(--ink-1)', border: '1px solid var(--line)',
          borderRadius: 6, padding: 20,
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          <div className="eyebrow">Thermodynamic inputs</div>
          <Slider label="ΔH (kJ/mol)" value={H} min={-500} max={500} step={1}
                  unit="kJ/mol" accent="var(--hot)"
                  onChange={(v) => { setH(v); clearActive(); }} />
          <Slider label="ΔS (J/(mol·K))" value={S} min={-500} max={500} step={1}
                  unit="J/(mol·K)" accent="var(--cool)"
                  onChange={(v) => { setS(v); clearActive(); }} />
          <Slider label="T (K)" value={T} min={100} max={2000} step={5}
                  unit="K" accent="var(--phos)"
                  onChange={(v) => { setT(v); clearActive(); }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
            <Stat label="ΔH" value={`${H.toFixed(0)} kJ/mol`} accent="var(--hot)" />
            <Stat label="−T·ΔS" value={`${(-T * S / 1000).toFixed(1)} kJ/mol`} accent="var(--cool)" />
            <Stat label="T" value={`${T} K`} accent="var(--phos)" />
            <Stat label="T_crossover"
                  value={Tcross !== null && isFinite(Tcross) ? `${Tcross.toFixed(0)} K` : '— none —'} />
          </div>
        </div>
      </div>

      {/* Verdict + Quadrant */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16 }}>
        {/* Verdict */}
        <div style={{
          background: atEquilibrium
            ? 'rgba(245,191,36,0.06)'
            : spontaneous ? 'rgba(105,227,107,0.06)' : 'rgba(255,61,109,0.06)',
          border: `1px solid ${atEquilibrium ? '#fbbf24' : spontaneous ? '#69e36b' : '#ff3d6d'}`,
          borderRadius: 6, padding: 22,
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div className="eyebrow" style={{
            color: atEquilibrium ? '#fbbf24' : spontaneous ? 'var(--phos)' : 'var(--plasma)',
          }}>
            {atEquilibrium ? 'Equilibrium' : spontaneous ? 'Spontaneous' : 'Non-spontaneous'}
          </div>
          <div className="serif" style={{
            fontSize: 42, fontStyle: 'italic',
            color: atEquilibrium ? '#fbbf24' : spontaneous ? 'var(--phos)' : 'var(--plasma)',
          }}>
            ΔG = {G >= 0 ? '+' : ''}{G.toFixed(2)} kJ/mol
          </div>
          <div style={{ fontSize: 13, color: 'var(--paper-dim)', lineHeight: 1.6 }}>
            {verdict}
          </div>
          {activeEx && (
            <div style={{
              marginTop: 4, padding: 10,
              background: 'rgba(245,241,232,0.04)',
              borderLeft: '2px solid var(--paper-dim)',
              fontSize: 12, color: 'var(--paper-dim)', lineHeight: 1.5,
            }}>
              <span className="mono" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--paper)' }}>
                {EXAMPLES.find(e => e.id === activeEx)!.label.toUpperCase()} ·{' '}
              </span>
              {EXAMPLES.find(e => e.id === activeEx)!.note}
            </div>
          )}
        </div>

        {/* Quadrant chart */}
        <Quadrant H={H} S={S} />
      </div>
    </div>
  );
}

// ───── ΔG vs T plot ─────

function GibbsPlot({ H, S, T, Tcross }: { H: number; S: number; T: number; Tcross: number | null }) {
  // Plot ΔG over T ∈ [0, 2000].  Compute G range to fit.
  const Tmin = 0, Tmax = 2000;
  const samples = 80;
  const pts: { t: number; g: number }[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = Tmin + (i / samples) * (Tmax - Tmin);
    pts.push({ t, g: H - (t * S) / 1000 });
  }
  const Gs = pts.map(p => p.g);
  const Gmin = Math.min(...Gs, -10);
  const Gmax = Math.max(...Gs, 10);
  const pad = (Gmax - Gmin) * 0.1 || 10;
  const yLo = Gmin - pad, yHi = Gmax + pad;

  // SVG geometry
  const W = 560, Hgt = 280, ml = 48, mr = 16, mt = 16, mb = 36;
  const innerW = W - ml - mr, innerH = Hgt - mt - mb;
  const xOf = (t: number) => ml + ((t - Tmin) / (Tmax - Tmin)) * innerW;
  const yOf = (g: number) => mt + (1 - (g - yLo) / (yHi - yLo)) * innerH;
  const yZero = yOf(0);

  // Build path; split at zero crossing for color (red below x-axis = spontaneous).
  // Simpler: clip two copies of the line with rects above/below y=0.
  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(p.t).toFixed(2)},${yOf(p.g).toFixed(2)}`).join(' ');
  const currentG = H - (T * S) / 1000;

  // Tick values
  const tTicks = [0, 500, 1000, 1500, 2000];
  const gTicks = niceTicks(yLo, yHi, 5);

  const inRange = Tcross !== null && isFinite(Tcross) && Tcross > Tmin && Tcross < Tmax;

  return (
    <svg viewBox={`0 0 ${W} ${Hgt}`} style={{ width: '100%', height: 'auto', marginTop: 10 }}>
      {/* axes */}
      <line x1={ml} y1={mt} x2={ml} y2={Hgt - mb} stroke="rgba(245,241,232,0.4)" />
      <line x1={ml} y1={Hgt - mb} x2={W - mr} y2={Hgt - mb} stroke="rgba(245,241,232,0.4)" />

      {/* y-grid + labels */}
      {gTicks.map(g => (
        <g key={`gy-${g}`}>
          <line x1={ml} y1={yOf(g)} x2={W - mr} y2={yOf(g)} stroke="rgba(245,241,232,0.06)" />
          <text x={ml - 6} y={yOf(g) + 3} textAnchor="end" fontFamily="JetBrains Mono" fontSize="9" fill="rgba(245,241,232,0.55)">
            {g.toFixed(0)}
          </text>
        </g>
      ))}

      {/* x-ticks */}
      {tTicks.map(t => (
        <g key={`tx-${t}`}>
          <line x1={xOf(t)} y1={Hgt - mb} x2={xOf(t)} y2={Hgt - mb + 4} stroke="rgba(245,241,232,0.4)" />
          <text x={xOf(t)} y={Hgt - mb + 16} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="9" fill="rgba(245,241,232,0.55)">
            {t}
          </text>
        </g>
      ))}

      {/* y=0 line (spontaneity threshold) */}
      <line x1={ml} y1={yZero} x2={W - mr} y2={yZero}
            stroke="rgba(245,241,232,0.55)" strokeDasharray="2 3" />
      <text x={W - mr - 4} y={yZero - 4} textAnchor="end" fontFamily="JetBrains Mono" fontSize="9" fill="rgba(245,241,232,0.55)">
        ΔG = 0
      </text>

      {/* Spontaneous (below x-axis) shaded red */}
      <defs>
        <clipPath id="below"><rect x={ml} y={yZero} width={innerW} height={Math.max(0, mt + innerH - yZero)} /></clipPath>
        <clipPath id="above"><rect x={ml} y={mt} width={innerW} height={Math.max(0, yZero - mt)} /></clipPath>
      </defs>

      <path d={linePath} fill="none" stroke="rgba(245,241,232,0.55)" strokeWidth="2" clipPath="url(#above)" />
      <path d={linePath} fill="none" stroke="#ff3d6d" strokeWidth="2.5" clipPath="url(#below)" />

      {/* Crossover */}
      {inRange && (
        <g>
          <line x1={xOf(Tcross!)} y1={mt} x2={xOf(Tcross!)} y2={Hgt - mb}
                stroke="#fbbf24" strokeDasharray="3 3" strokeWidth="1.2" />
          <text x={xOf(Tcross!) + 4} y={mt + 12} fontFamily="JetBrains Mono" fontSize="9" fill="#fbbf24">
            T_cross = {Tcross!.toFixed(0)} K
          </text>
        </g>
      )}

      {/* Current T marker */}
      <line x1={xOf(T)} y1={mt} x2={xOf(T)} y2={Hgt - mb}
            stroke="rgba(167,139,250,0.4)" strokeDasharray="2 4" />
      <circle cx={xOf(T)} cy={yOf(currentG)} r="6"
              fill={currentG < 0 ? '#ff3d6d' : 'rgba(245,241,232,0.85)'}
              stroke="var(--paper)" strokeWidth="1.5" />
      <text x={xOf(T)} y={yOf(currentG) - 10} textAnchor="middle"
            fontFamily="JetBrains Mono" fontSize="10" fill="var(--paper)">
        {currentG.toFixed(1)} kJ
      </text>

      {/* axis titles */}
      <text x={(ml + W - mr) / 2} y={Hgt - 4} textAnchor="middle"
            fontFamily="JetBrains Mono" fontSize="10" fill="var(--paper-dim)">
        T (K)
      </text>
      <text x={12} y={(mt + Hgt - mb) / 2} textAnchor="middle"
            fontFamily="JetBrains Mono" fontSize="10" fill="var(--paper-dim)"
            transform={`rotate(-90 12 ${(mt + Hgt - mb) / 2})`}>
        ΔG (kJ/mol)
      </text>
    </svg>
  );
}

function niceTicks(lo: number, hi: number, n: number): number[] {
  const span = hi - lo;
  const raw = span / n;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const start = Math.ceil(lo / step) * step;
  const out: number[] = [];
  for (let v = start; v <= hi; v += step) out.push(Math.round(v * 1000) / 1000);
  return out;
}

// ───── Quadrant chart ─────

function Quadrant({ H, S }: { H: number; S: number }) {
  // Rows: H<0 (top, exo) / H>0 (bot, endo)
  // Cols: S<0 (left)     / S>0 (right)
  const cells = [
    { row: 0, col: 0, key: 'exo-dec',  title: 'ΔH<0, ΔS<0', label: 'SPONT. AT LOW T',     sub: 'enthalpy-favored',   color: '#a78bfa' },
    { row: 0, col: 1, key: 'exo-inc',  title: 'ΔH<0, ΔS>0', label: 'ALWAYS SPONTANEOUS',  sub: 'any temperature',    color: '#69e36b' },
    { row: 1, col: 0, key: 'endo-dec', title: 'ΔH>0, ΔS<0', label: 'NEVER SPONTANEOUS',   sub: 'no T can save it',   color: '#ff3d6d' },
    { row: 1, col: 1, key: 'endo-inc', title: 'ΔH>0, ΔS>0', label: 'SPONT. AT HIGH T',    sub: 'entropy-favored',    color: '#fbbf24' },
  ];
  const activeCol = S >= 0 ? 1 : 0;
  const activeRow = H <= 0 ? 0 : 1;

  return (
    <div style={{
      background: 'var(--ink-1)', border: '1px solid var(--line)',
      borderRadius: 6, padding: 18, display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="eyebrow">Sign quadrants</div>
        <div className="mono" style={{ fontSize: 10, color: 'var(--paper-dim)' }}>
          ΔH={H >= 0 ? '+' : '−'} · ΔS={S >= 0 ? '+' : '−'}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '14px 1fr 1fr', gridTemplateRows: 'auto 1fr 1fr 14px', gap: 4, flex: 1 }}>
        {/* col headers */}
        <div />
        <ColHeader text="ΔS &lt; 0  (less disorder)" />
        <ColHeader text="ΔS &gt; 0  (more disorder)" />

        {/* row 1 */}
        <RowHeader text="ΔH<0 exo" />
        {cells.filter(c => c.row === 0).map(c => (
          <Cell key={c.key} cell={c} active={c.row === activeRow && c.col === activeCol} />
        ))}

        {/* row 2 */}
        <RowHeader text="ΔH>0 endo" />
        {cells.filter(c => c.row === 1).map(c => (
          <Cell key={c.key} cell={c} active={c.row === activeRow && c.col === activeCol} />
        ))}

        <div />
        <div />
        <div />
      </div>
    </div>
  );
}

function ColHeader({ text }: { text: string }) {
  return (
    <div className="mono" style={{
      fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase',
      color: 'var(--paper-dim)', textAlign: 'center', padding: '2px 0',
    }} dangerouslySetInnerHTML={{ __html: text }} />
  );
}

function RowHeader({ text }: { text: string }) {
  return (
    <div className="mono" style={{
      fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase',
      color: 'var(--paper-dim)',
      writingMode: 'vertical-rl', transform: 'rotate(180deg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>{text}</div>
  );
}

function Cell({ cell, active }: { cell: { title: string; label: string; sub: string; color: string }; active: boolean }) {
  return (
    <div style={{
      border: `1px solid ${active ? cell.color : 'var(--line)'}`,
      background: active ? `${cell.color}1f` : 'var(--ink-2)',
      borderRadius: 4, padding: 10,
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      transition: 'all 200ms ease-out',
      boxShadow: active ? `0 0 0 1px ${cell.color}55, 0 0 20px ${cell.color}33` : 'none',
    }}>
      <div className="mono" style={{ fontSize: 9, letterSpacing: '0.1em', color: active ? cell.color : 'var(--paper-dim)' }}>
        {cell.title}
      </div>
      <div className="serif" style={{ fontSize: active ? 14 : 13, color: active ? cell.color : 'var(--paper)', lineHeight: 1.2, marginTop: 6 }}>
        {cell.label}
      </div>
      <div style={{ fontSize: 10, color: 'var(--paper-dim)', marginTop: 4, fontStyle: 'italic' }}>
        {cell.sub}
      </div>
    </div>
  );
}

// ───── Verbose verdict generator ─────

function buildVerdict(H: number, S: number, T: number, G: number): string {
  const tds = (T * S) / 1000; // kJ/mol — value of T·ΔS
  const minusTdS = -tds;       // the term as it appears in ΔG
  const Hsign = H < 0 ? 'exothermic' : H > 0 ? 'endothermic' : 'thermoneutral';
  const Ssign = S < 0 ? 'decreasing entropy' : S > 0 ? 'increasing entropy' : 'no entropy change';
  const Tcross = S !== 0 ? (H / S) * 1000 : null;

  if (Math.abs(G) < 0.5) {
    return `ΔG ≈ 0 — the reaction sits at equilibrium at T = ${T} K. Forward and reverse are equally favored (${H.toFixed(0)} kJ/mol enthalpy exactly balances the ${tds.toFixed(0)} kJ/mol T·ΔS term).`;
  }

  let driver: string;
  if (G < 0) {
    if (H < 0 && S > 0) {
      driver = `Both terms favor the products: the ${Hsign} ΔH (${H.toFixed(0)} kJ/mol) and the ${Ssign} (−T·ΔS = ${minusTdS.toFixed(0)} kJ/mol) pull the same way. Spontaneous at any temperature.`;
    } else if (H < 0) {
      driver = `The ${Hsign} ΔH (${H.toFixed(0)} kJ/mol) overcomes the entropy penalty (−T·ΔS = +${minusTdS.toFixed(0)} kJ/mol opposes). Cooling makes this even more favorable; above T = ${Tcross?.toFixed(0)} K it would reverse.`;
    } else {
      driver = `Entropy drives this one: −T·ΔS = ${minusTdS.toFixed(0)} kJ/mol overpowers the +${H.toFixed(0)} kJ/mol enthalpy cost. Below T = ${Tcross?.toFixed(0)} K the reaction would freeze out.`;
    }
    return `ΔG = ${G.toFixed(1)} kJ/mol — reaction proceeds spontaneously as written. ${driver}`;
  } else {
    if (H > 0 && S < 0) {
      driver = `Both terms oppose the products: the ${Hsign} ΔH (+${H.toFixed(0)} kJ/mol) and the ${Ssign} (−T·ΔS = +${minusTdS.toFixed(0)} kJ/mol) work against it. No temperature can rescue it.`;
    } else if (H > 0) {
      driver = `The +${H.toFixed(0)} kJ/mol enthalpy cost beats the entropy gain (−T·ΔS = ${minusTdS.toFixed(0)} kJ/mol favors). Heat above T = ${Tcross?.toFixed(0)} K and it would turn spontaneous.`;
    } else {
      driver = `The entropy penalty wins: −T·ΔS = +${minusTdS.toFixed(0)} kJ/mol exceeds the ${H.toFixed(0)} kJ/mol enthalpy gain. Cool below T = ${Tcross?.toFixed(0)} K and the reaction becomes spontaneous.`;
    }
    return `ΔG = +${G.toFixed(1)} kJ/mol — non-spontaneous in the forward direction. ${driver}`;
  }
}

// ───── small UI atoms ─────

function Slider({ label, value, min, max, step, unit, accent, onChange }: {
  label: string; value: number; min: number; max: number; step: number;
  unit: string; accent: string; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span className="eyebrow">{label}</span>
        <span className="mono" style={{ fontSize: 11, color: accent }}>
          {value >= 0 && value !== 0 ? '+' : ''}{value.toFixed(0)} {unit}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
             onChange={(e) => onChange(Number(e.target.value))}
             style={{ width: '100%', accentColor: accent }} />
    </div>
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
