import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Calorimetry — PhET-grade interactive (4 modes: coffee-cup, bomb, mixing, phase).
 * Σ q_i = 0; rAF exponential approach to equilibrium; pauses on document.hidden.
 */

type Mode = 'cup' | 'bomb' | 'mix' | 'phase';

type Material = { id: string; name: string; symbol: string; c: number; color: string; hotColor: string };
type Fuel = { id: string; name: string; formula: React.ReactNode; M: number; dHc: number };

const PALETTE = {
  hot: '#ff6b35', cool: '#5dd0ff', acid: '#c8f76d', phos: '#9bff9b',
  base: '#a78bfa', plasma: '#ff5b9b', warn: '#fbbf24', paper: '#f5f1e8', ice: '#cfe9ff',
};

const MATERIALS: Material[] = [
  { id: 'cu', name: 'Copper',   symbol: 'Cu',   c: 0.385, color: '#c97a4a', hotColor: '#ff9a4d' },
  { id: 'al', name: 'Aluminum', symbol: 'Al',   c: 0.897, color: '#b8b8c4', hotColor: '#ffd9a8' },
  { id: 'fe', name: 'Iron',     symbol: 'Fe',   c: 0.449, color: '#8a8378', hotColor: '#ff8a55' },
  { id: 'au', name: 'Gold',     symbol: 'Au',   c: 0.129, color: '#e5b94a', hotColor: '#fff0a0' },
  { id: 'pb', name: 'Lead',     symbol: 'Pb',   c: 0.128, color: '#7e8190', hotColor: '#d6a890' },
  { id: 'h2o',name: 'Water',    symbol: 'H₂O',  c: 4.184, color: '#5dd0ff', hotColor: '#ff8a8a' },
];

const FUELS: Fuel[] = [
  { id: 'glu',  name: 'Glucose',  formula: <>C<sub>6</sub>H<sub>12</sub>O<sub>6</sub></>, M: 180.16, dHc: -2803 },
  { id: 'oct',  name: 'Octane',   formula: <>C<sub>8</sub>H<sub>18</sub></>,              M: 114.23, dHc: -5470 },
  { id: 'eth',  name: 'Ethanol',  formula: <>C<sub>2</sub>H<sub>5</sub>OH</>,             M:  46.07, dHc: -1367 },
  { id: 'h2',   name: 'Hydrogen', formula: <>H<sub>2</sub></>,                            M:   2.016,dHc:  -286 },
];

const C_WATER = 4.184;        // J/g·°C
const DH_FUS  = 334;          // J/g  ice → liquid at 0°C

export default function Calorimetry() {
  const [mode, setMode] = useState<Mode>('cup');
  const rootRef = useRef<HTMLDivElement | null>(null);

  // ── coffee-cup state ──
  const [matId, setMatId] = useState('cu');
  const material = MATERIALS.find(m => m.id === matId)!;
  const [mm, setMm] = useState(50);
  const [tm, setTm] = useState(100);
  const [mw, setMw] = useState(150);
  const [tw, setTw] = useState(20);

  // ── bomb state ──
  const [fuelId, setFuelId] = useState('glu');
  const fuel = FUELS.find(f => f.id === fuelId)!;
  const [fuelMass, setFuelMass] = useState(1.0);
  const [Ccal, setCcal] = useState(8000);
  const [dTbomb, setDTbomb] = useState(3.5);

  // ── mixing state ──
  const [mh, setMh] = useState(120); const [th, setTh] = useState(80);
  const [mc, setMc] = useState(180); const [tc, setTc] = useState(15);

  // ── phase state ──
  const [mIce, setMIce] = useState(40);
  const [mWphase, setMWphase] = useState(200);
  const [twPhase, setTwPhase] = useState(35);

  // ── animation ──
  const [progress, setProgress] = useState(1);  // 0 (just dropped) → 1 (equilibrium)
  const [running, setRunning] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastT = useRef(performance.now());

  useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    if (!running || hidden) return;
    let raf = 0;
    lastT.current = performance.now();
    const loop = (now: number) => {
      const dt = (now - lastT.current) / 1000;
      lastT.current = now;
      setProgress(p => {
        const next = p + dt / 3;            // ~3 s to reach equilibrium
        if (next >= 1) { setRunning(false); return 1; }
        return next;
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running, hidden]);

  // exponential approach k(progress) ∈ [0,1]
  const k = 1 - Math.exp(-3 * progress);

  // ── derived numbers ──
  const cup = useMemo(() => {
    const cm = material.c;
    const Tf = (mm * cm * tm + mw * C_WATER * tw) / (mm * cm + mw * C_WATER);
    const TmNow = tm + (Tf - tm) * k;
    const TwNow = tw + (Tf - tw) * k;
    const qm = mm * cm * (TmNow - tm);
    const qw = mw * C_WATER * (TwNow - tw);
    return { Tf, TmNow, TwNow, qm, qw, qFinalMag: Math.abs(mm * cm * (Tf - tm)) };
  }, [material, mm, tm, mw, tw, k]);

  const mix = useMemo(() => {
    const Tf = (mh * C_WATER * th + mc * C_WATER * tc) / ((mh + mc) * C_WATER);
    const ThNow = th + (Tf - th) * k;
    const TcNow = tc + (Tf - tc) * k;
    const qh = mh * C_WATER * (ThNow - th);
    const qc = mc * C_WATER * (TcNow - tc);
    return { Tf, ThNow, TcNow, qh, qc, qFinalMag: Math.abs(mh * C_WATER * (Tf - th)) };
  }, [mh, th, mc, tc, k]);

  const bomb = useMemo(() => {
    const qCal = Ccal * dTbomb;                    // J absorbed by calorimeter
    const qComb_J = -qCal;                          // sample's released heat (system)
    const n = fuelMass / fuel.M;                    // mol fuel
    const dHc_kJmol = n > 0 ? qComb_J / 1000 / n : 0; // kJ/mol
    const error = ((dHc_kJmol - fuel.dHc) / Math.abs(fuel.dHc)) * 100;
    return { qCal, qComb_J, n, dHc_kJmol, error };
  }, [Ccal, dTbomb, fuelMass, fuel]);

  const phase = useMemo(() => {
    // Energy available from cooling water from twPhase down to 0°C
    const qAvailable = mWphase * C_WATER * (twPhase - 0);     // J (positive)
    const qMeltAll   = mIce * DH_FUS;                          // J needed to melt all ice
    if (qAvailable <= qMeltAll) {
      // not enough — final T = 0°C, some ice remains
      const meltedMass = qAvailable / DH_FUS;
      const remainingIce = mIce - meltedMass;
      return {
        case: 'partial' as const,
        Tf: 0,
        meltedMass,
        remainingIce,
        q1: meltedMass * DH_FUS,
        q2: 0,
        qWaterCool: -qAvailable,
      };
    }
    // all ice melts; then mix m_ice (now liquid at 0) with m_w at twPhase, but
    // water has lost energy = qMeltAll already. Solve:
    // m_ice·c·(Tf−0) + m_w·c·(Tf − twPhase) + m_ice·ΔH_fus = 0
    const num = mWphase * C_WATER * twPhase - mIce * DH_FUS;
    const den = (mIce + mWphase) * C_WATER;
    const Tf = num / den;
    return {
      case: 'full' as const,
      Tf,
      meltedMass: mIce,
      remainingIce: 0,
      q1: mIce * DH_FUS,
      q2: mIce * C_WATER * (Tf - 0),
      qWaterCool: mWphase * C_WATER * (Tf - twPhase),
    };
  }, [mIce, mWphase, twPhase]);

  // ── auto-restart animation when relevant inputs change ──
  useEffect(() => { setProgress(0); setRunning(true); /* eslint-disable-next-line */ },
    [mode, matId, mm, tm, mw, tw, mh, th, mc, tc, mIce, mWphase, twPhase]);

  return (
    <div ref={rootRef} style={{ display: 'grid', gap: 16 }}>
      <div role="tablist" style={{ display: 'flex', flexWrap: 'wrap' }}>
        {(['cup','bomb','mix','phase'] as Mode[]).map((m, i) => (
          <button key={m} role="tab" aria-selected={mode===m} onClick={() => setMode(m)} className="mono"
            style={{ padding: '10px 16px', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', border: '1px solid var(--line-strong)', borderLeftWidth: i === 0 ? 1 : 0, background: mode === m ? 'var(--paper)' : 'transparent', color: mode === m ? 'var(--ink-0)' : 'var(--paper-dim)', fontWeight: mode === m ? 600 : 400, cursor: 'pointer' }}>
            {m === 'cup' ? 'Coffee-cup' : m === 'bomb' ? 'Bomb' : m === 'mix' ? 'Mixing waters' : 'Phase change'}
          </button>
        ))}
      </div>

      <div style={{ border: '1px solid var(--line)', borderLeft: '3px solid var(--phos)', background: 'var(--ink-1)', padding: '10px 14px', borderRadius: 4 }}>
        <div className="eyebrow">Conservation of energy</div>
        <div className="serif" style={{ fontSize: 18, marginTop: 4, fontStyle: 'italic', lineHeight: 1.5 }}>
          {mode === 'cup'   && <>m<sub>m</sub>c<sub>m</sub>(T<sub>f</sub> − T<sub>m</sub>) + m<sub>w</sub>c<sub>w</sub>(T<sub>f</sub> − T<sub>w</sub>) = 0  ⟹  T<sub>f</sub> = (m<sub>m</sub>c<sub>m</sub>T<sub>m</sub> + m<sub>w</sub>c<sub>w</sub>T<sub>w</sub>) / (m<sub>m</sub>c<sub>m</sub> + m<sub>w</sub>c<sub>w</sub>)</>}
          {mode === 'mix'   && <>m<sub>h</sub>c<sub>w</sub>(T<sub>f</sub> − T<sub>h</sub>) + m<sub>c</sub>c<sub>w</sub>(T<sub>f</sub> − T<sub>c</sub>) = 0  ⟹  T<sub>f</sub> = (m<sub>h</sub>T<sub>h</sub> + m<sub>c</sub>T<sub>c</sub>) / (m<sub>h</sub> + m<sub>c</sub>)</>}
          {mode === 'bomb'  && <>q<sub>combustion</sub> = −C<sub>cal</sub> · ΔT  ⟹  ΔH<sub>c</sub> = q<sub>combustion</sub> / n<sub>fuel</sub></>}
          {mode === 'phase' && <>m<sub>ice</sub>·ΔH<sub>fus</sub> + m<sub>ice</sub>c<sub>w</sub>(T<sub>f</sub>−0) + m<sub>w</sub>c<sub>w</sub>(T<sub>f</sub> − T<sub>w</sub>) = 0</>}
        </div>
      </div>

      {mode === 'cup' && <CupView material={material} matId={matId} setMatId={setMatId} mm={mm} setMm={setMm} tm={tm} setTm={setTm} mw={mw} setMw={setMw} tw={tw} setTw={setTw} cup={cup} progress={progress} onRestart={() => { setProgress(0); setRunning(true); }} onReset={() => { setProgress(1); setRunning(false); }} />}
      {mode === 'mix' && <MixView mh={mh} setMh={setMh} th={th} setTh={setTh} mc={mc} setMc={setMc} tc={tc} setTc={setTc} mix={mix} progress={progress} onRestart={() => { setProgress(0); setRunning(true); }} onReset={() => { setProgress(1); setRunning(false); }} />}
      {mode === 'bomb' && <BombView fuel={fuel} fuelId={fuelId} setFuelId={setFuelId} fuelMass={fuelMass} setFuelMass={setFuelMass} Ccal={Ccal} setCcal={setCcal} dT={dTbomb} setDT={setDTbomb} bomb={bomb} />}
      {mode === 'phase' && <PhaseView mIce={mIce} setMIce={setMIce} mW={mWphase} setMW={setMWphase} tw={twPhase} setTw={setTwPhase} phase={phase} progress={progress} />}

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 16 }}>
        <Panel>
          <div className="eyebrow">Specific heat reference · J/g·°C</div>
          <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {MATERIALS.map(m => {
              const isActive = mode === 'cup' && m.id === matId;
              return (
                <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: isActive ? `${m.color}22` : 'var(--ink-2)', border: `1px solid ${isActive ? m.color : 'transparent'}`, borderRadius: 3 }}>
                  <span style={{ fontSize: 12 }}>
                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: m.color, marginRight: 8, verticalAlign: 'middle' }} />
                    {m.name} <span className="mono" style={{ color: 'var(--paper-faint)' }}>({m.symbol})</span>
                  </span>
                  <span className="mono" style={{ fontSize: 12, color: m.color }}>{m.c.toFixed(3)}</span>
                </div>
              );
            })}
          </div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--paper-faint)', marginTop: 10, lineHeight: 1.5 }}>
            Water's c is ~10–30× larger than most metals — that's why the ocean stabilizes climate, why
            sweating cools you, and why a small mass of water can absorb a lot of heat without boiling.
          </div>
        </Panel>

        <Panel>
          <div className="eyebrow">Real-world callouts</div>
          <Callout title="Engine cooling" color={PALETTE.hot}>
            Water-glycol coolant absorbs ~3.5 J/g·°C — close to pure water's 4.184. A 50-K
            jump across 5 kg of coolant buffers <b>{(5000 * 3.5 * 50 / 1000).toFixed(0)} kJ</b>
            {' '}each pass through the radiator.
          </Callout>
          <Callout title="Biological homeostasis" color={PALETTE.cool}>
            A 70 kg human is ~60% water → ~42 kg. Burning 100 kcal (~419 kJ) of glucose with
            no heat loss would raise core T by only <b>{(419000 / (42000 * C_WATER)).toFixed(2)} °C</b>.
          </Callout>
          <Callout title="Ocean heat capacity" color={PALETTE.base}>
            Top 100 m of ocean has heat capacity ≈ 1.6 × 10²³ J/°C — absorbing the same energy
            as Earth's entire atmosphere warms it just <b>0.3 °C</b>.
          </Callout>
        </Panel>
      </div>
    </div>
  );
}

// ── COFFEE-CUP VIEW ──
function CupView(p: {
  material: Material; matId: string; setMatId: (s: string) => void;
  mm: number; setMm: (n: number) => void; tm: number; setTm: (n: number) => void;
  mw: number; setMw: (n: number) => void; tw: number; setTw: (n: number) => void;
  cup: { Tf: number; TmNow: number; TwNow: number; qm: number; qw: number; qFinalMag: number };
  progress: number; onRestart: () => void; onReset: () => void;
}) {
  const { material, cup, progress } = p;
  return (
    <>
      {/* Material selector — coffee-cup is a solid-block-into-water experiment,
          so liquid water is excluded here (use the Mixing Waters tab for that). */}
      <div role="tablist" style={{ display: 'flex', flexWrap: 'wrap' }}>
        {MATERIALS.filter(m => m.id !== 'h2o').map((m, i) => {
          const active = m.id === p.matId;
          return (
            <button key={m.id} role="tab" aria-selected={active}
              onClick={() => p.setMatId(m.id)}
              className="mono"
              style={{
                padding: '8px 12px', fontSize: 10, letterSpacing: '0.14em',
                textTransform: 'uppercase',
                border: '1px solid var(--line-strong)',
                borderLeftWidth: i === 0 ? 1 : 0,
                background: active ? m.color : 'transparent',
                color: active ? '#0a0908' : 'var(--paper-dim)',
                fontWeight: active ? 600 : 400, cursor: 'pointer',
              }}>
              {m.symbol} · {m.c}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '0.9fr 1.1fr', gap: 16 }}>
        <Panel>
          <div className="eyebrow">Coffee-cup calorimeter</div>
          <CupSVG material={material} mm={p.mm} mw={p.mw}
                  TmNow={cup.TmNow} TwNow={cup.TwNow} progress={progress} />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <ControlBtn onClick={p.onRestart}>↻ Drop block</ControlBtn>
            <ControlBtn onClick={p.onReset}>■ Equilibrium</ControlBtn>
          </div>
        </Panel>

        <Panel>
          <div className="eyebrow">Inputs</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
            <Slider label={`Mass of ${material.symbol} (g)`} value={p.mm} min={10} max={300} step={5} onChange={p.setMm} accent={material.color} />
            <Slider label={`T(${material.symbol}) initial (°C)`} value={p.tm} min={25} max={250} step={1} onChange={p.setTm} accent={PALETTE.hot} />
            <Slider label="Mass of H₂O (g)" value={p.mw} min={50} max={400} step={5} onChange={p.setMw} accent={PALETTE.cool} />
            <Slider label="T(H₂O) initial (°C)" value={p.tw} min={1} max={50} step={1} onChange={p.setTw} accent={PALETTE.cool} />
          </div>

          <Stat label="Final temperature T_f" value={`${cup.Tf.toFixed(2)} °C`} accent={PALETTE.phos} big />

          <div style={{ marginTop: 10, padding: 12, background: 'var(--ink-2)', borderRadius: 4 }}>
            <div className="eyebrow">Heat exchanged · live</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
              <Stat label={`q_${material.symbol} (lost)`} value={`${cup.qm.toFixed(0)} J`} accent={PALETTE.hot} />
              <Stat label="q_water (gained)" value={`${cup.qw.toFixed(0)} J`} accent={PALETTE.cool} />
            </div>
          </div>

          <EnergyBars qm={Math.abs(cup.qm)} qw={Math.abs(cup.qw)} qMax={cup.qFinalMag} />
        </Panel>
      </div>

      <Panel>
        <div className="eyebrow">Temperature vs. time · t = {(progress * 3).toFixed(2)} s</div>
        <TempPlot
          T1Init={p.tm} T2Init={p.tw} Tf={cup.Tf} progress={progress}
          color1={PALETTE.hot} color2={PALETTE.cool}
          label1={material.symbol} label2="H₂O"
        />
      </Panel>

      <Panel>
        <div className="eyebrow">Equation derivation</div>
        <div className="serif" style={{ fontSize: 14, lineHeight: 1.9, marginTop: 8, color: 'var(--paper-dim)' }}>
          <div>Step 1 · q<sub>lost</sub> + q<sub>gained</sub> = 0 (closed system, perfect insulation)</div>
          <div>Step 2 · m<sub>m</sub>c<sub>m</sub>(T<sub>f</sub> − T<sub>m</sub>) = −m<sub>w</sub>c<sub>w</sub>(T<sub>f</sub> − T<sub>w</sub>)</div>
          <div>Step 3 · m<sub>m</sub>c<sub>m</sub>T<sub>f</sub> − m<sub>m</sub>c<sub>m</sub>T<sub>m</sub> = −m<sub>w</sub>c<sub>w</sub>T<sub>f</sub> + m<sub>w</sub>c<sub>w</sub>T<sub>w</sub></div>
          <div>Step 4 · T<sub>f</sub>(m<sub>m</sub>c<sub>m</sub> + m<sub>w</sub>c<sub>w</sub>) = m<sub>m</sub>c<sub>m</sub>T<sub>m</sub> + m<sub>w</sub>c<sub>w</sub>T<sub>w</sub></div>
          <div style={{ color: PALETTE.phos }}>Step 5 · T<sub>f</sub> = (m<sub>m</sub>c<sub>m</sub>T<sub>m</sub> + m<sub>w</sub>c<sub>w</sub>T<sub>w</sub>) / (m<sub>m</sub>c<sub>m</sub> + m<sub>w</sub>c<sub>w</sub>)</div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--paper-faint)', marginTop: 6 }}>
            For your settings: T<sub>f</sub> = ({p.mm}·{material.c}·{p.tm} + {p.mw}·{C_WATER}·{p.tw}) / ({p.mm}·{material.c} + {p.mw}·{C_WATER}) = <b style={{ color: PALETTE.phos }}>{cup.Tf.toFixed(2)} °C</b>
          </div>
        </div>
      </Panel>
    </>
  );
}

function CupSVG({ material, mm, mw, TmNow, TwNow, progress }: {
  material: Material; mm: number; mw: number;
  TmNow: number; TwNow: number; progress: number;
}) {
  // Water surface always visible inside the cup (interior 80..238).
  const surfaceY = clamp(120 + (1 - mw / 400) * 90, 120, 215);
  const blockSize = clamp(20 + Math.sqrt(mm) * 3, 24, 56);
  // Block falls from above the cup, settles half-submerged on the water surface,
  // but never punches through the cup floor.
  const blockFall = clamp(progress * 6, 0, 1);
  const settledY = clamp(surfaceY - blockSize * 0.35, 90, 232 - blockSize);
  const blockY = lerp(40, settledY, blockFall);
  const matColor = blendColor(material.color, material.hotColor, clamp((TmNow - 20) / 180, 0, 1));
  const waterColor = waterTint(TwNow);

  return (
    <svg viewBox="0 0 240 280" style={{ width: '100%', height: 280, marginTop: 8 }}>
      <defs>
        <linearGradient id="cup-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--ink-2)" />
          <stop offset="1" stopColor="var(--ink-1)" />
        </linearGradient>
      </defs>
      <path d="M 40 80 L 50 240 L 150 240 L 160 80 Z" fill="url(#cup-grad)" stroke="var(--line-strong)" />
      <path d="M 40 80 L 30 240 L 50 240 L 40 80 Z" fill="rgba(245,241,232,0.06)" />
      <path d="M 160 80 L 170 240 L 150 240 L 160 80 Z" fill="rgba(245,241,232,0.06)" />
      <path d={`M 42 ${surfaceY} L 53 240 L 147 240 L 158 ${surfaceY} Z`} fill={waterColor} opacity="0.6" />
      <line x1={42} y1={surfaceY} x2={158} y2={surfaceY} stroke="rgba(255,255,255,0.4)" strokeWidth="0.8" />
      {TwNow > 60 && (
        <g opacity={clamp((TwNow - 60) / 40, 0, 0.6)}>
          <path d="M 80 60 Q 90 40 100 60 T 120 60" stroke="rgba(245,241,232,0.5)" strokeWidth="2" fill="none" />
          <path d="M 90 50 Q 100 35 110 50" stroke="rgba(245,241,232,0.4)" strokeWidth="2" fill="none" />
        </g>
      )}
      <rect x={100 - blockSize / 2} y={blockY} width={blockSize} height={blockSize} fill={matColor} stroke="rgba(0,0,0,0.5)" rx="3" />
      <text x={100} y={blockY + blockSize / 2 + 5} textAnchor="middle" fontFamily="Fraunces" fontSize={blockSize * 0.4} fontWeight="700" fill="#0a0908">{material.symbol}</text>
      {progress < 1 && progress > 0.15 && (
        <circle cx="100" cy={blockY + blockSize / 2} r={20 + progress * 30} fill="none" stroke={PALETTE.hot} strokeWidth="1" opacity={(1 - progress) * 0.5} />
      )}
      <rect x="195" y="50" width="10" height="200" fill="var(--ink-2)" stroke="var(--line-strong)" rx="3" />
      <rect x="197" y={250 - clamp(TwNow / 110, 0, 1) * 200} width="6" height={clamp(TwNow / 110, 0, 1) * 200} fill={PALETTE.hot} style={{ transition: 'all 60ms' }} />
      <circle cx="200" cy="255" r="9" fill={PALETTE.hot} />
      <text x="215" y="58" fontFamily="JetBrains Mono" fontSize="9" fill="var(--paper-dim)">°C</text>
      {[25, 50, 75, 100].map(t => (
        <g key={t}>
          <line x1="190" y1={250 - (t / 110) * 200} x2="195" y2={250 - (t / 110) * 200} stroke="var(--paper-faint)" />
          <text x="187" y={253 - (t / 110) * 200} fontSize="8" textAnchor="end" fontFamily="JetBrains Mono" fill="var(--paper-faint)">{t}</text>
        </g>
      ))}
      <text x="100" y="270" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="11" fill={PALETTE.hot}>T_water = {TwNow.toFixed(1)} °C</text>
    </svg>
  );
}

// ── MIXING VIEW ──
function MixView(p: {
  mh: number; setMh: (n: number) => void; th: number; setTh: (n: number) => void;
  mc: number; setMc: (n: number) => void; tc: number; setTc: (n: number) => void;
  mix: { Tf: number; ThNow: number; TcNow: number; qh: number; qc: number; qFinalMag: number };
  progress: number; onRestart: () => void; onReset: () => void;
}) {
  const { mix, progress } = p;
  const mixedColor = waterTint(mix.Tf);
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Panel>
          <div className="eyebrow">Mixing two waters</div>
          <svg viewBox="0 0 320 220" style={{ width: '100%', height: 220, marginTop: 8 }}>
            <BeakerOutline x={20} y={40} w={90} h={150} />
            <rect x={24} y={40 + 150 - p.mh / 2.5} width={82} height={p.mh / 2.5} fill={waterTint(p.th)} opacity={1 - progress * 0.9} />
            <text x={65} y={210} textAnchor="middle" fontSize="10" fontFamily="JetBrains Mono" fill={PALETTE.hot}>hot · {p.th}°C</text>
            <BeakerOutline x={210} y={40} w={90} h={150} />
            <rect x={214} y={40 + 150 - p.mc / 2.5} width={82} height={p.mc / 2.5} fill={waterTint(p.tc)} opacity={1 - progress * 0.9} />
            <text x={255} y={210} textAnchor="middle" fontSize="10" fontFamily="JetBrains Mono" fill={PALETTE.cool}>cold · {p.tc}°C</text>
            <g opacity={progress}>
              <BeakerOutline x={115} y={50} w={90} h={140} />
              <rect x={119} y={50 + 140 - (p.mh + p.mc) / 4.2} width={82} height={(p.mh + p.mc) / 4.2} fill={mixedColor} opacity="0.85" />
              <text x={160} y={205} textAnchor="middle" fontSize="11" fontFamily="JetBrains Mono" fill={PALETTE.phos}>T_f = {mix.Tf.toFixed(2)}°C</text>
            </g>
            {progress > 0 && progress < 1 && (<>
              <line x1={108} y1={50 + (1 - progress) * 80} x2={130} y2={70 + progress * 30} stroke={waterTint(p.th)} strokeWidth="3" opacity={0.7} />
              <line x1={212} y1={50 + (1 - progress) * 80} x2={190} y2={70 + progress * 30} stroke={waterTint(p.tc)} strokeWidth="3" opacity={0.7} />
            </>)}
          </svg>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <ControlBtn onClick={p.onRestart}>↻ Pour</ControlBtn>
            <ControlBtn onClick={p.onReset}>■ Mixed</ControlBtn>
          </div>
        </Panel>

        <Panel>
          <div className="eyebrow">Inputs</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
            <Slider label="Mass hot (g)" value={p.mh} min={20} max={400} step={5} onChange={p.setMh} accent={PALETTE.hot} />
            <Slider label="T hot (°C)" value={p.th} min={40} max={95} step={1} onChange={p.setTh} accent={PALETTE.hot} />
            <Slider label="Mass cold (g)" value={p.mc} min={20} max={400} step={5} onChange={p.setMc} accent={PALETTE.cool} />
            <Slider label="T cold (°C)" value={p.tc} min={1} max={30} step={1} onChange={p.setTc} accent={PALETTE.cool} />
          </div>
          <Stat label="Final T (weighted average)" value={`${mix.Tf.toFixed(2)} °C`} accent={PALETTE.phos} big />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10 }}>
            <Stat label="q_hot (lost)" value={`${mix.qh.toFixed(0)} J`} accent={PALETTE.hot} />
            <Stat label="q_cold (gained)" value={`${mix.qc.toFixed(0)} J`} accent={PALETTE.cool} />
          </div>
          <EnergyBars qm={Math.abs(mix.qh)} qw={Math.abs(mix.qc)} qMax={mix.qFinalMag} />
        </Panel>
      </div>

      <Panel>
        <div className="eyebrow">Temperature vs. time · t = {(progress * 3).toFixed(2)} s</div>
        <TempPlot T1Init={p.th} T2Init={p.tc} Tf={mix.Tf} progress={progress}
                  color1={PALETTE.hot} color2={PALETTE.cool} label1="hot" label2="cold" />
      </Panel>
    </>
  );
}

function BeakerOutline({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <g>
      <path d={`M ${x} ${y} L ${x} ${y + h} L ${x + w} ${y + h} L ${x + w} ${y}`}
            fill="var(--ink-2)" stroke="var(--line-strong)" strokeWidth="1.5" />
      <line x1={x - 4} y1={y} x2={x + w + 4} y2={y} stroke="var(--line-strong)" strokeWidth="1.5" />
    </g>
  );
}

// ── BOMB CALORIMETER VIEW ──
function BombView(p: {
  fuel: Fuel; fuelId: string; setFuelId: (s: string) => void;
  fuelMass: number; setFuelMass: (n: number) => void;
  Ccal: number; setCcal: (n: number) => void;
  dT: number; setDT: (n: number) => void;
  bomb: { qCal: number; qComb_J: number; n: number; dHc_kJmol: number; error: number };
}) {
  const { fuel, bomb } = p;
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '0.9fr 1.1fr', gap: 16 }}>
        <Panel>
          <div className="eyebrow">Bomb calorimeter (constant V)</div>
          <svg viewBox="0 0 260 280" style={{ width: '100%', height: 280, marginTop: 8 }}>
            <rect x="20" y="40" width="220" height="220" fill="var(--ink-2)" stroke="var(--line-strong)" rx="4" />
            <rect x="24" y="60" width="212" height="196" fill={waterTint(25 + p.dT)} opacity="0.55" />
            <text x="30" y="55" fontSize="9" fontFamily="JetBrains Mono" fill="var(--paper-dim)">water bath · C_cal = {p.Ccal} J/°C</text>
            <rect x="80" y="100" width="100" height="120" fill="#3a3633" stroke="#1a1817" strokeWidth="2" rx="3" />
            <rect x="85" y="105" width="90" height="110" fill="#5a5350" />
            <text x="130" y="95" textAnchor="middle" fontSize="9" fontFamily="JetBrains Mono" fill="var(--paper-faint)">steel bomb (O₂)</text>
            <ellipse cx="130" cy="180" rx="18" ry="6" fill="#1a1817" />
            <rect x="115" y="170" width="30" height="12" fill={PALETTE.warn} opacity={0.85} />
            <text x="130" y="200" textAnchor="middle" fontSize="9" fontFamily="JetBrains Mono" fill={PALETTE.warn}>{p.fuelMass.toFixed(2)} g sample</text>
            <line x1="100" y1="100" x2="120" y2="170" stroke="#c97a4a" strokeWidth="1" />
            <line x1="160" y1="100" x2="140" y2="170" stroke="#c97a4a" strokeWidth="1" />
            <line x1="60" y1="40" x2="60" y2="180" stroke="var(--line-strong)" strokeWidth="2" />
            <circle cx="60" cy="185" r="6" fill="var(--paper-faint)" />
            <text x="60" y="35" textAnchor="middle" fontSize="8" fontFamily="JetBrains Mono" fill="var(--paper-dim)">stir</text>
            <rect x="200" y="40" width="8" height="180" fill="var(--ink-1)" stroke="var(--line-strong)" rx="2" />
            <rect x="201" y={220 - p.dT * 25} width="6" height={p.dT * 25} fill={PALETTE.hot} />
            <circle cx="204" cy="225" r="8" fill={PALETTE.hot} />
            <text x="212" y="44" fontSize="9" fontFamily="JetBrains Mono" fill="var(--paper-dim)">ΔT</text>
          </svg>
        </Panel>

        <Panel>
          <div className="eyebrow">Fuel selector</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {FUELS.map(f => {
              const active = f.id === p.fuelId;
              return (
                <button key={f.id} onClick={() => p.setFuelId(f.id)} className="mono"
                  style={{
                    padding: '6px 10px', fontSize: 10, letterSpacing: '0.12em',
                    border: '1px solid var(--line-strong)',
                    background: active ? PALETTE.warn : 'transparent',
                    color: active ? '#0a0908' : 'var(--paper-dim)',
                    cursor: 'pointer',
                  }}>
                  {f.name} · M={f.M}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <Slider label={`Mass of ${fuel.name} (g)`} value={p.fuelMass} min={0.1} max={5} step={0.05} onChange={p.setFuelMass} accent={PALETTE.warn} />
            <Slider label="C_cal (J/°C)" value={p.Ccal} min={4000} max={15000} step={100} onChange={p.setCcal} accent={PALETTE.base} />
            <Slider label="Measured ΔT (°C)" value={p.dT} min={0.5} max={8} step={0.05} onChange={p.setDT} accent={PALETTE.hot} />
            <div>
              <div className="eyebrow" style={{ marginBottom: 4 }}>moles fuel</div>
              <div className="mono" style={{ fontSize: 16, color: PALETTE.warn }}>{bomb.n.toExponential(3)}</div>
            </div>
          </div>

          <div style={{ marginTop: 12, padding: 12, background: 'var(--ink-2)', borderRadius: 4 }}>
            <div className="eyebrow">Computed q · derivation</div>
            <div className="mono" style={{ fontSize: 11, lineHeight: 1.8, color: 'var(--paper-dim)', marginTop: 6 }}>
              <div>q_cal = C_cal · ΔT = {p.Ccal} · {p.dT} = <b style={{ color: PALETTE.cool }}>{bomb.qCal.toFixed(0)} J</b> (gained)</div>
              <div>q_combustion = −q_cal = <b style={{ color: PALETTE.hot }}>{(bomb.qComb_J / 1000).toFixed(2)} kJ</b> (released)</div>
              <div>n_fuel = m / M = {p.fuelMass} / {fuel.M} = <b style={{ color: PALETTE.warn }}>{bomb.n.toExponential(3)} mol</b></div>
              <div>ΔH_c = q_comb / n = <b style={{ color: PALETTE.phos }}>{bomb.dHc_kJmol.toFixed(0)} kJ/mol</b></div>
            </div>
          </div>

          <Stat label={`Measured ΔH_combustion of ${fuel.name}`}
                value={`${bomb.dHc_kJmol.toFixed(0)} kJ/mol`}
                accent={PALETTE.phos} big />

          <div style={{ marginTop: 8, padding: 10, border: `1px solid ${PALETTE.warn}55`, borderRadius: 4 }}>
            <div className="eyebrow">Literature value</div>
            <div className="serif" style={{ fontSize: 16, color: PALETTE.warn }}>{fuel.dHc} kJ/mol</div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--paper-faint)', marginTop: 4 }}>
              error vs. literature: <b style={{ color: Math.abs(bomb.error) > 10 ? PALETTE.hot : PALETTE.phos }}>{bomb.error >= 0 ? '+' : ''}{bomb.error.toFixed(1)}%</b> ·
              tune ΔT to dial in
            </div>
          </div>
        </Panel>
      </div>
    </>
  );
}

// ── PHASE-CHANGE VIEW ──
function PhaseView(p: {
  mIce: number; setMIce: (n: number) => void;
  mW: number; setMW: (n: number) => void;
  tw: number; setTw: (n: number) => void;
  phase: { case: 'partial' | 'full'; Tf: number; meltedMass: number; remainingIce: number; q1: number; q2: number; qWaterCool: number };
  progress: number;
}) {
  const { phase, progress } = p;
  const iceFrac = phase.case === 'partial' ? 1 - (phase.meltedMass / p.mIce) * progress
                                            : 1 - progress;
  const TwNow = p.tw + (phase.Tf - p.tw) * (1 - Math.exp(-3 * progress));
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '0.9fr 1.1fr', gap: 16 }}>
        <Panel>
          <div className="eyebrow">Ice + warm water</div>
          <svg viewBox="0 0 240 280" style={{ width: '100%', height: 280, marginTop: 8 }}>
            <path d="M 40 80 L 50 240 L 150 240 L 160 80 Z" fill="var(--ink-2)" stroke="var(--line-strong)" />
            {(() => {
              const surfaceY = Math.max(80, Math.min(240, 80 + (1 - p.mW / 400) * 160));
              return <path d={`M 42 ${surfaceY} L 53 240 L 147 240 L 158 ${surfaceY} Z`} fill={waterTint(TwNow)} opacity="0.55" />;
            })()}
            {iceFrac > 0.02 && Array.from({ length: Math.max(1, Math.round(iceFrac * 5)) }).map((_, i) => {
              const px = 70 + (i % 3) * 22 + ((i >= 3) ? 11 : 0);
              const py = 200 - Math.floor(i / 3) * 22;
              const sz = 16 * Math.sqrt(iceFrac);
              return (
                <g key={i}>
                  <rect x={px - sz / 2} y={py - sz / 2} width={sz} height={sz} fill={PALETTE.ice} stroke="rgba(255,255,255,0.6)" rx="2" opacity="0.85" />
                  <line x1={px - sz / 3} y1={py - sz / 3} x2={px + sz / 3} y2={py + sz / 3} stroke="rgba(255,255,255,0.5)" />
                </g>
              );
            })}
            <rect x="180" y="50" width="10" height="200" fill="var(--ink-1)" stroke="var(--line-strong)" rx="3" />
            <rect x="182" y={250 - clamp((TwNow + 5) / 50, 0, 1) * 200} width="6" height={clamp((TwNow + 5) / 50, 0, 1) * 200} fill={TwNow < 5 ? PALETTE.cool : PALETTE.hot} />
            <circle cx="185" cy="255" r="9" fill={TwNow < 5 ? PALETTE.cool : PALETTE.hot} />
            <text x="100" y="270" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="11" fill={PALETTE.phos}>T = {TwNow.toFixed(2)} °C</text>
          </svg>
        </Panel>

        <Panel>
          <div className="eyebrow">Inputs</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
            <Slider label="Mass of ice (g) at 0°C" value={p.mIce} min={5} max={200} step={5} onChange={p.setMIce} accent={PALETTE.ice} />
            <Slider label="Mass of water (g)" value={p.mW} min={50} max={400} step={5} onChange={p.setMW} accent={PALETTE.cool} />
            <Slider label="T water initial (°C)" value={p.tw} min={5} max={80} step={1} onChange={p.setTw} accent={PALETTE.hot} />
            <div>
              <div className="eyebrow" style={{ marginBottom: 4 }}>case</div>
              <div className="serif" style={{ fontSize: 16,
                color: phase.case === 'partial' ? PALETTE.cool : PALETTE.phos }}>
                {phase.case === 'partial' ? '② not enough heat' : '① all ice melts'}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 10, padding: 12, background: 'var(--ink-2)', borderRadius: 4 }}>
            <div className="eyebrow">Energy ledger · J</div>
            <div className="mono" style={{ fontSize: 11, lineHeight: 1.8, color: 'var(--paper-dim)', marginTop: 6 }}>
              <div>q₁ · fuse {phase.meltedMass.toFixed(1)} g ice = m·ΔH_fus = <b style={{ color: PALETTE.ice }}>{phase.q1.toFixed(0)} J</b></div>
              <div>q₂ · warm melted ice 0 → T_f = m·c·ΔT = <b style={{ color: PALETTE.cool }}>{phase.q2.toFixed(0)} J</b></div>
              <div>q_water · cool {p.mW} g · {p.tw - phase.Tf > 0 ? '+' : ''}{(phase.Tf - p.tw).toFixed(2)} °C = <b style={{ color: PALETTE.hot }}>{phase.qWaterCool.toFixed(0)} J</b></div>
              <div style={{ marginTop: 4, color: PALETTE.phos }}>
                check: q₁ + q₂ + q_water = {(phase.q1 + phase.q2 + phase.qWaterCool).toFixed(1)} J ≈ 0
              </div>
            </div>
          </div>

          <Stat label="Final temperature" value={`${phase.Tf.toFixed(2)} °C`} accent={PALETTE.phos} big />

          {phase.case === 'partial' && (
            <div style={{ marginTop: 8, padding: 10,
                          border: `1px solid ${PALETTE.ice}55`,
                          background: `${PALETTE.ice}10`, borderRadius: 4 }}>
              <div className="eyebrow" style={{ color: PALETTE.ice }}>Ice remaining</div>
              <div className="serif" style={{ fontSize: 18, color: PALETTE.ice }}>
                {phase.remainingIce.toFixed(2)} g (of {p.mIce} g)
              </div>
              <div className="mono" style={{ fontSize: 10, color: 'var(--paper-faint)', marginTop: 4, lineHeight: 1.5 }}>
                Water didn't carry enough heat to melt all the ice. Final mixture sits at 0 °C
                with both phases coexisting.
              </div>
            </div>
          )}
        </Panel>
      </div>

      <Panel>
        <div className="eyebrow">Phase-change pathway · q breakdown</div>
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, marginTop: 12, height: 60 }}>
          {(() => {
            const total = Math.abs(phase.q1) + Math.abs(phase.q2);
            if (total < 1) return null;
            const w1 = (Math.abs(phase.q1) / total) * 100;
            const w2 = (Math.abs(phase.q2) / total) * 100;
            const cell = (bg: string): React.CSSProperties => ({ background: bg, color: '#0a0908', padding: '8px 12px', display: 'flex', alignItems: 'center', fontFamily: 'JetBrains Mono', fontSize: 11 });
            return (<>
              <div style={{ width: `${w1}%`, ...cell(PALETTE.ice) }}>q₁ fusion · {phase.q1.toFixed(0)} J ({w1.toFixed(0)}%)</div>
              <div style={{ width: `${w2}%`, ...cell(PALETTE.cool) }}>q₂ warm melted ice · {phase.q2.toFixed(0)} J ({w2.toFixed(0)}%)</div>
            </>);
          })()}
        </div>
        <div className="mono" style={{ fontSize: 10, color: 'var(--paper-faint)', marginTop: 8, lineHeight: 1.6 }}>
          Latent heat dominates: melting 1 g of ice (334 J) absorbs as much energy as warming 1 g of liquid water by ~80 °C. That's why ice cubes are spectacularly effective coolers.
        </div>
      </Panel>
    </>
  );
}

// ── ENERGY BAR CHART ──
function EnergyBars({ qm, qw, qMax }: { qm: number; qw: number; qMax: number }) {
  const max = Math.max(qMax, qm, qw, 1);
  return (
    <div style={{ marginTop: 12 }}>
      <div className="eyebrow" style={{ marginBottom: 6 }}>|q| comparison · J</div>
      <div style={{ display: 'grid', gap: 6 }}>
        <BarRow label="metal lost" v={qm} max={max} color={PALETTE.hot} />
        <BarRow label="water gained" v={qw} max={max} color={PALETTE.cool} />
      </div>
      <div className="mono" style={{ fontSize: 10, color: 'var(--paper-faint)', marginTop: 6 }}>
        At equilibrium |q_metal| = |q_water| — energy is conserved.
      </div>
    </div>
  );
}

function BarRow({ label, v, max, color }: { label: string; v: number; max: number; color: string }) {
  const pct = (v / max) * 100;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 70px', alignItems: 'center', gap: 8 }}>
      <span className="mono" style={{ fontSize: 10, color: 'var(--paper-dim)' }}>{label}</span>
      <div style={{ height: 14, background: 'var(--ink-2)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%',
                      background: `linear-gradient(90deg, ${color}aa, ${color})`,
                      transition: 'width 80ms' }} />
      </div>
      <span className="mono" style={{ fontSize: 11, color, textAlign: 'right' }}>{v.toFixed(0)}</span>
    </div>
  );
}

// ── TEMPERATURE PLOT ──
function TempPlot({ T1Init, T2Init, Tf, progress, color1, color2, label1, label2 }: {
  T1Init: number; T2Init: number; Tf: number; progress: number;
  color1: string; color2: string; label1: string; label2: string;
}) {
  const W = 600, H = 200, pad = 30, tMax = 3, pts = 60;
  const Tmin = Math.min(T1Init, T2Init, Tf) - 5;
  const Tmax = Math.max(T1Init, T2Init, Tf) + 5;
  const xOf = (t: number) => pad + (t / tMax) * (W - pad - 20);
  const yOf = (T: number) => pad + (1 - (T - Tmin) / (Tmax - Tmin)) * (H - pad - 20);
  const build = (Ti: number, frac: number) => {
    const N = Math.max(2, Math.floor(frac * pts));
    const seg: string[] = [];
    for (let i = 0; i <= N; i++) {
      const tau = i / pts, t = tau * tMax;
      const T = Ti + (Tf - Ti) * (1 - Math.exp(-3 * tau));
      seg.push(`${i === 0 ? 'M' : 'L'} ${xOf(t).toFixed(2)} ${yOf(T).toFixed(2)}`);
    }
    return seg.join(' ');
  };
  const tNow = progress * tMax;
  const kNow = 1 - Math.exp(-3 * progress);
  const T1Now = T1Init + (Tf - T1Init) * kNow;
  const T2Now = T2Init + (Tf - T2Init) * kNow;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, marginTop: 8 }}>
      <defs><pattern id="cal-grid" width="40" height="20" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 20" fill="none" stroke="rgba(245,241,232,0.05)" />
      </pattern></defs>
      <rect x={pad} y={pad} width={W - pad - 20} height={H - pad - 20} fill="url(#cal-grid)" />
      <line x1={pad} y1={pad} x2={pad} y2={H - 20} stroke="rgba(245,241,232,0.3)" />
      <line x1={pad} y1={H - 20} x2={W - 20} y2={H - 20} stroke="rgba(245,241,232,0.3)" />
      <line x1={pad} y1={yOf(Tf)} x2={W - 20} y2={yOf(Tf)} stroke={PALETTE.phos} strokeWidth="1" strokeDasharray="3 4" opacity="0.6" />
      <text x={W - 24} y={yOf(Tf) - 3} textAnchor="end" fontSize="9" fontFamily="JetBrains Mono" fill={PALETTE.phos}>T_f = {Tf.toFixed(1)}°C</text>
      <path d={build(T1Init, 1)} fill="none" stroke={color1} strokeWidth="1" opacity="0.25" />
      <path d={build(T2Init, 1)} fill="none" stroke={color2} strokeWidth="1" opacity="0.25" />
      <path d={build(T1Init, progress)} fill="none" stroke={color1} strokeWidth="2.5" />
      <path d={build(T2Init, progress)} fill="none" stroke={color2} strokeWidth="2.5" />
      <circle cx={xOf(tNow)} cy={yOf(T1Now)} r="5" fill={color1} stroke="#0a0908" />
      <circle cx={xOf(tNow)} cy={yOf(T2Now)} r="5" fill={color2} stroke="#0a0908" />
      <text x={pad - 4} y={pad + 4} textAnchor="end" fontSize="9" fontFamily="JetBrains Mono" fill="var(--paper-faint)">{Tmax.toFixed(0)}°</text>
      <text x={pad - 4} y={H - 22} textAnchor="end" fontSize="9" fontFamily="JetBrains Mono" fill="var(--paper-faint)">{Tmin.toFixed(0)}°</text>
      <text x={W - 20} y={H - 6} textAnchor="end" fontSize="9" fontFamily="JetBrains Mono" fill="var(--paper-faint)">{tMax.toFixed(0)} s</text>
      <text x={pad} y={H - 6} fontSize="9" fontFamily="JetBrains Mono" fill="var(--paper-faint)">0 s</text>
      <g transform={`translate(${W - 130}, ${pad + 4})`}>
        <rect x="0" y="0" width="110" height="34" fill="var(--ink-1)" stroke="var(--line)" rx="2" opacity="0.9" />
        <line x1="6" y1="11" x2="22" y2="11" stroke={color1} strokeWidth="2.5" />
        <text x="26" y="14" fontSize="10" fontFamily="JetBrains Mono" fill={color1}>{label1}</text>
        <line x1="6" y1="25" x2="22" y2="25" stroke={color2} strokeWidth="2.5" />
        <text x="26" y="28" fontSize="10" fontFamily="JetBrains Mono" fill={color2}>{label2}</text>
      </g>
    </svg>
  );
}

// ── small UI atoms ──
function Panel({ children }: { children: React.ReactNode }) {
  return <div style={{ background: 'var(--ink-1)', border: '1px solid var(--line)', borderRadius: 6, padding: 16, display: 'flex', flexDirection: 'column' }}>{children}</div>;
}
function Slider({ label, value, min, max, step, onChange, accent }: { label: string; value: number; min: number; max: number; step?: number; onChange: (n: number) => void; accent: string }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span className="eyebrow">{label}</span>
        <span className="mono" style={{ fontSize: 11, color: accent }}>{Number.isInteger(value) ? value : value.toFixed(2)}</span>
      </div>
      <input type="range" min={min} max={max} step={step ?? 1} value={value} onChange={e => onChange(Number(e.target.value))} style={{ width: '100%', accentColor: accent }} />
    </div>
  );
}
function Stat({ label, value, accent, big }: { label: string; value: string; accent?: string; big?: boolean }) {
  return (
    <div style={{ marginTop: big ? 12 : 0 }}>
      <div className="eyebrow" style={{ marginBottom: 4 }}>{label}</div>
      <div className="serif" style={{ fontSize: big ? 28 : 17, color: accent ?? 'var(--paper)' }}>{value}</div>
    </div>
  );
}
function ControlBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button onClick={onClick} className="mono" style={{ flex: 1, padding: '8px 10px', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', border: '1px solid var(--line-strong)', background: 'transparent', color: 'var(--paper)', cursor: 'pointer' }}>{children}</button>;
}
function Callout({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 10, padding: '8px 12px', borderLeft: `3px solid ${color}`, background: `${color}10`, borderRadius: 3 }}>
      <div className="eyebrow" style={{ color }}>{title}</div>
      <div style={{ fontSize: 11, color: 'var(--paper-dim)', marginTop: 4, lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}
// ── tiny helpers ──
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function lerp(a: number, b: number, k: number) { return a + (b - a) * k; }
function waterTint(T: number): string {
  const t = clamp(T / 100, 0, 1);
  return `rgb(${Math.round(80 + t * 175)},${Math.round(180 - t * 100)},${Math.round(230 - t * 180)})`;
}
function parseHex(h: string): [number, number, number] {
  const x = h.replace('#', '');
  return [parseInt(x.slice(0, 2), 16), parseInt(x.slice(2, 4), 16), parseInt(x.slice(4, 6), 16)];
}
function blendColor(a: string, b: string, k: number): string {
  const pa = parseHex(a), pb = parseHex(b);
  return `rgb(${Math.round(pa[0] + (pb[0] - pa[0]) * k)},${Math.round(pa[1] + (pb[1] - pa[1]) * k)},${Math.round(pa[2] + (pb[2] - pa[2]) * k)})`;
}
