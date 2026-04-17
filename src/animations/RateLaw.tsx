import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Rate Laws — three modes:
 *   • Method of Initial Rates  — derive m, n, k from a 4-trial table.
 *   • Integrated Rate Laws     — [A] vs t, ln[A] vs t, 1/[A] vs t for orders 0/1/2.
 *   • Half-life                — visualize successive half-lives for the chosen order.
 * Plus a small particle-loss canvas where A molecules disappear consistently with the math.
 */

type Mode = 'initial' | 'integrated' | 'halflife';
type Order = 0 | 1 | 2;

const COOL = 'var(--cool)';
const HOT  = 'var(--hot)';
const PHOS = 'var(--phos)';
const ACID = 'var(--acid)';

export default function RateLaw() {
  const [mode, setMode] = useState<Mode>('initial');

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div role="tablist" aria-label="Rate-law mode" style={{ display: 'flex', flexWrap: 'wrap' }}>
        {(['initial','integrated','halflife'] as Mode[]).map((m, i) => {
          const active = m === mode;
          const label = m === 'initial' ? 'Method of Initial Rates'
                      : m === 'integrated' ? 'Integrated Rate Laws'
                      : 'Half-life';
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
            >{label}</button>
          );
        })}
      </div>

      {mode === 'initial' && <InitialRates />}
      {mode === 'integrated' && <Integrated />}
      {mode === 'halflife' && <HalfLife />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  Mode 1 — Method of Initial Rates
// ═══════════════════════════════════════════════════════════════════════

type Trial = { A: number; B: number };

function InitialRates() {
  const [trueM, setTrueM] = useState<Order>(() => randOrder());
  const [trueN, setTrueN] = useState<Order>(() => randOrder());
  const trueK = 0.250;
  const [trials, setTrials] = useState<Trial[]>([
    { A: 0.10, B: 0.10 }, { A: 0.20, B: 0.10 },
    { A: 0.10, B: 0.20 }, { A: 0.20, B: 0.20 },
  ]);
  const [showHint, setShowHint] = useState(false);
  const [reveal, setReveal] = useState(false);

  const rates = trials.map(t => trueK * Math.pow(t.A, trueM) * Math.pow(t.B, trueN));

  const derived = useMemo(() => {
    const pair = (kind: 'A'|'B') => {
      for (let i = 0; i < trials.length; i++) for (let j = i+1; j < trials.length; j++) {
        const ti = trials[i], tj = trials[j];
        if (kind === 'A' && close(ti.B, tj.B) && !close(ti.A, tj.A)) return { i, j };
        if (kind === 'B' && close(ti.A, tj.A) && !close(ti.B, tj.B)) return { i, j };
      }
      return null;
    };
    const pa = pair('A'), pb = pair('B');
    let m: number | null = null, n: number | null = null;
    let mWork: string | null = null, nWork: string | null = null;
    if (pa) {
      const a1 = trials[pa.i].A, a2 = trials[pa.j].A, r1 = rates[pa.i], r2 = rates[pa.j];
      m = Math.log(r2 / r1) / Math.log(a2 / a1);
      mWork = `m = log(r${pa.j+1}/r${pa.i+1}) / log([A]${pa.j+1}/[A]${pa.i+1}) = log(${(r2/r1).toFixed(3)}) / log(${(a2/a1).toFixed(3)}) = ${m.toFixed(3)}`;
    }
    if (pb) {
      const b1 = trials[pb.i].B, b2 = trials[pb.j].B, r1 = rates[pb.i], r2 = rates[pb.j];
      n = Math.log(r2 / r1) / Math.log(b2 / b1);
      nWork = `n = log(r${pb.j+1}/r${pb.i+1}) / log([B]${pb.j+1}/[B]${pb.i+1}) = log(${(r2/r1).toFixed(3)}) / log(${(b2/b1).toFixed(3)}) = ${n.toFixed(3)}`;
    }
    const mR = m === null ? null : Math.round(m);
    const nR = n === null ? null : Math.round(n);
    let kEst: number | null = null, kWork: string | null = null;
    if (mR !== null && nR !== null) {
      const t = trials[0], r = rates[0];
      kEst = r / (Math.pow(t.A, mR) * Math.pow(t.B, nR));
      kWork = `k = r₁ / ([A]₁^${mR} · [B]₁^${nR}) = ${r.toExponential(3)} / (${t.A.toFixed(2)}^${mR} · ${t.B.toFixed(2)}^${nR}) = ${kEst.toExponential(3)}`;
    }
    return { mR, mWork, nR, nWork, kEst, kWork };
  }, [trials, rates]);

  const overall = (derived.mR ?? 0) + (derived.nR ?? 0);
  const kUnits = unitsForOrder(overall);

  const setTrial = (i: number, key: 'A'|'B', v: number) => {
    setTrials(ts => ts.map((t, idx) => idx === i ? { ...t, [key]: v } : t));
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="serif" style={{ fontSize: 24, fontStyle: 'italic' }}>
        A + B → P  ·  rate = k [A]<sup>m</sup> [B]<sup>n</sup>
      </div>

      <div style={{ background: 'var(--ink-1)', border: '1px solid var(--line)', borderRadius: 6, padding: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="eyebrow">Initial-rates table · 4 trials</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <ControlBtn onClick={() => { setTrueM(randOrder()); setTrueN(randOrder()); setReveal(false); }}>↻ New rate law</ControlBtn>
            <ControlBtn onClick={() => setReveal(r => !r)}>{reveal ? '◐ Hide' : '◑ Reveal'}</ControlBtn>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--line-strong)' }}>
              <th style={hth()}>Trial</th>
              <th style={hth()}>[A]<sub>0</sub> (M)</th>
              <th style={hth()}>[B]<sub>0</sub> (M)</th>
              <th style={hth()}>Initial rate (M·s⁻¹)</th>
            </tr>
          </thead>
          <tbody>
            {trials.map((t, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--line)' }}>
                <td style={td()}><div className="serif" style={{ fontSize: 18 }}>{i+1}</div></td>
                <td style={td()}>
                  <input type="range" min={0.05} max={0.50} step={0.05} value={t.A}
                         onChange={e => setTrial(i, 'A', Number(e.target.value))}
                         aria-label={`Trial ${i+1} [A]`}
                         style={{ width: '100%', accentColor: COOL }} />
                  <div className="mono" style={{ fontSize: 12, color: COOL, marginTop: 2 }}>{t.A.toFixed(2)}</div>
                </td>
                <td style={td()}>
                  <input type="range" min={0.05} max={0.50} step={0.05} value={t.B}
                         onChange={e => setTrial(i, 'B', Number(e.target.value))}
                         aria-label={`Trial ${i+1} [B]`}
                         style={{ width: '100%', accentColor: HOT }} />
                  <div className="mono" style={{ fontSize: 12, color: HOT, marginTop: 2 }}>{t.B.toFixed(2)}</div>
                </td>
                <td style={td()}>
                  <div className="serif" style={{ fontSize: 18 }}>{rates[i].toExponential(3)}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mono" style={{ fontSize: 11, color: 'var(--paper-faint)', marginTop: 12, lineHeight: 1.6 }}>
          Hold [B] constant between two trials → ratio of rates gives <i>m</i>.<br/>
          Hold [A] constant between two trials → ratio of rates gives <i>n</i>.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
        <Card title="Order in A (m)" value={derived.mR === null ? '?' : String(derived.mR)} hint="needs [B]-paired trials" color={COOL} />
        <Card title="Order in B (n)" value={derived.nR === null ? '?' : String(derived.nR)} hint="needs [A]-paired trials" color={HOT} />
        <Card title="Overall order" value={(derived.mR === null || derived.nR === null) ? '?' : String(overall)} hint="m + n" color={PHOS} />
        <Card title="k (derived)" value={derived.kEst === null ? '?' : derived.kEst.toExponential(2)} hint={kUnits} color={ACID} />
      </div>

      <div style={{ background: 'var(--ink-1)', border: '1px solid var(--line)', borderRadius: 6, padding: 18 }}>
        <button
          onClick={() => setShowHint(s => !s)}
          className="mono"
          style={{
            background: 'transparent', border: 0, color: 'var(--paper)',
            cursor: 'pointer', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase',
            padding: 0,
          }}
        >{showHint ? '▾' : '▸'} How to solve</button>
        {showHint && (
          <div className="mono" style={{ fontSize: 12, color: 'var(--paper-dim)', marginTop: 12, lineHeight: 1.7 }}>
            <div style={{ marginBottom: 8 }}>1. Take the ratio of two rate laws where one concentration is held fixed:</div>
            <div className="serif" style={{ fontStyle: 'italic', fontSize: 16, marginLeft: 12 }}>r<sub>j</sub>/r<sub>i</sub> = ([A]<sub>j</sub>/[A]<sub>i</sub>)<sup>m</sup></div>
            <div style={{ margin: '8px 0' }}>2. Solve for m by taking logs of both sides:</div>
            <div className="serif" style={{ fontStyle: 'italic', fontSize: 16, marginLeft: 12 }}>m = log(r<sub>j</sub>/r<sub>i</sub>) / log([A]<sub>j</sub>/[A]<sub>i</sub>)</div>
            {derived.mWork && <div style={{ marginTop: 8, color: COOL }}>{derived.mWork}</div>}
            {derived.nWork && <div style={{ marginTop: 4, color: HOT }}>{derived.nWork}</div>}
            <div style={{ margin: '10px 0 4px' }}>3. Plug rounded orders back into any trial to find k:</div>
            {derived.kWork && <div style={{ color: ACID }}>{derived.kWork}</div>}
            {reveal && (
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
                <span className="eyebrow" style={{ color: PHOS }}>True law · </span>
                rate = {trueK} · [A]<sup>{trueM}</sup> [B]<sup>{trueN}</sup>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  Mode 2 — Integrated Rate Laws
// ═══════════════════════════════════════════════════════════════════════

function Integrated() {
  const [order, setOrder] = useState<Order>(1);
  const [k, setK] = useState(0.20);
  const [A0, setA0] = useState(1.0);
  const [tMax, setTMax] = useState(20);
  const [t, setT] = useState(0);
  const [running, setRunning] = useState(true);

  // Animation
  const last = useRef(0);
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    last.current = performance.now();
    const loop = (now: number) => {
      if (document.hidden) { last.current = now; raf = requestAnimationFrame(loop); return; }
      const dt = (now - last.current) / 1000;
      last.current = now;
      setT(prev => {
        const nx = prev + dt * (tMax / 8);
        return nx >= tMax ? 0 : nx;
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running, tMax]);

  // Sample N points for plots
  const N = 80;
  const samples = useMemo(() => {
    const arr: { t: number; A: number }[] = [];
    for (let i = 0; i <= N; i++) {
      const ti = (i / N) * tMax;
      arr.push({ t: ti, A: concAt(order, A0, k, ti) });
    }
    return arr;
  }, [order, A0, k, tMax]);

  const A_now = concAt(order, A0, k, t);
  const halfLife = halfLifeFor(order, A0, k);
  const overallUnits = unitsForOrder(order);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Top: order picker + sliders + readouts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
        <div style={{ background: 'var(--ink-1)', border: '1px solid var(--line)', borderRadius: 6, padding: 20 }}>
          <div className="eyebrow">Reaction order in A</div>
          <div style={{ display: 'flex', gap: 0, marginTop: 10 }}>
            {([0,1,2] as Order[]).map((o, i) => {
              const active = o === order;
              return (
                <button key={o} onClick={() => setOrder(o)} className="mono"
                  style={{
                    flex: 1, padding: '10px', fontSize: 11, letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    border: '1px solid var(--line-strong)',
                    borderLeft: i === 0 ? '1px solid var(--line-strong)' : 0,
                    background: active ? 'var(--paper)' : 'transparent',
                    color: active ? 'var(--ink-0)' : 'var(--paper-dim)',
                    cursor: 'pointer', fontWeight: active ? 600 : 400,
                  }}>
                  Order {o}
                </button>
              );
            })}
          </div>
          <div className="serif" style={{ fontSize: 18, fontStyle: 'italic', marginTop: 16, lineHeight: 1.6 }}>
            {order === 0 && <>[A]<sub>t</sub> = [A]<sub>0</sub> − k·t</>}
            {order === 1 && <>ln[A]<sub>t</sub> = ln[A]<sub>0</sub> − k·t  <span style={{ color: 'var(--paper-dim)', fontSize: 13 }}>(linear in ln[A])</span></>}
            {order === 2 && <>1/[A]<sub>t</sub> = 1/[A]<sub>0</sub> + k·t</>}
          </div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--paper-faint)', marginTop: 8 }}>
            Linear plot for order {order}: <span style={{ color: PHOS }}>
              {order === 0 ? '[A] vs t' : order === 1 ? 'ln[A] vs t' : '1/[A] vs t'}
            </span>
          </div>
        </div>

        <div style={{ background: 'var(--ink-1)', border: '1px solid var(--line)', borderRadius: 6, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="eyebrow">Controls</div>
          <Slider label={`k · ${overallUnits}`} value={k} min={0.001} max={10} step={0.001} onChange={setK} accent={ACID} fmt={(v) => v.toFixed(3)} />
          <Slider label="[A]₀ (M)" value={A0} min={0.1} max={5} step={0.1} onChange={setA0} accent={COOL} fmt={(v) => v.toFixed(2)} />
          <Slider label="time scale (s)" value={tMax} min={2} max={100} step={1} onChange={setTMax} accent={PHOS} fmt={(v) => String(v)} />
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <ControlBtn onClick={() => setRunning(r => !r)}>{running ? '❚❚ Pause' : '▶ Play'}</ControlBtn>
            <ControlBtn onClick={() => setT(0)}>↻ Reset t</ControlBtn>
          </div>
        </div>
      </div>

      {/* Three plots */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <Plot title="[A] vs t" yLabel="[A] (M)" samples={samples} mapY={s => s.A} t={t} highlight={order === 0} A0={A0} k={k} order={order} kind="A" />
        <Plot title="ln[A] vs t" yLabel="ln [A]" samples={samples} mapY={s => Math.log(Math.max(s.A, 1e-12))} t={t} highlight={order === 1} A0={A0} k={k} order={order} kind="ln" />
        <Plot title="1/[A] vs t" yLabel="1/[A] (M⁻¹)" samples={samples} mapY={s => 1 / Math.max(s.A, 1e-9)} t={t} highlight={order === 2} A0={A0} k={k} order={order} kind="inv" />
      </div>

      {/* Particle box + readouts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        <ParticleBox A0={A0} A_now={A_now} t={t} tMax={tMax} />
        <div style={{ background: 'var(--ink-1)', border: '1px solid var(--line)', borderRadius: 6, padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignContent: 'start' }}>
          <Stat label="t now" value={`${t.toFixed(2)} s`} accent="var(--paper)" />
          <Stat label="[A] now" value={`${A_now.toFixed(4)} M`} accent={COOL} />
          <Stat label="overall order" value={String(order)} accent={PHOS} />
          <Stat label="k" value={`${k.toFixed(3)}`} accent={ACID} />
          <Stat label="k units" value={overallUnits} accent="var(--paper-dim)" />
          <Stat label="t½" value={isFinite(halfLife) ? `${halfLife.toFixed(2)} s` : '—'} accent={HOT} />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  Mode 3 — Half-life
// ═══════════════════════════════════════════════════════════════════════

function HalfLife() {
  const [order, setOrder] = useState<Order>(1);
  const [k, setK] = useState(0.30);
  const [A0, setA0] = useState(1.0);
  const tMax = 30;
  const [t, setT] = useState(0);
  const [running, setRunning] = useState(true);

  const last = useRef(0);
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    last.current = performance.now();
    const loop = (now: number) => {
      if (document.hidden) { last.current = now; raf = requestAnimationFrame(loop); return; }
      const dt = (now - last.current) / 1000;
      last.current = now;
      setT(p => { const nx = p + dt * (tMax / 12); return nx >= tMax ? 0 : nx; });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  // Compute half-life times t1, t2, t3, ... within the window.
  const halfTimes = useMemo(() => {
    const out: number[] = [];
    let A = A0;
    let tCur = 0;
    for (let i = 0; i < 8; i++) {
      const dt = halfLifeFor(order, A, k);
      if (!isFinite(dt) || dt <= 0) break;
      tCur += dt;
      if (tCur > tMax) break;
      out.push(tCur);
      A = A / 2;
    }
    return out;
  }, [order, k, A0]);

  const A_now = concAt(order, A0, k, t);
  const formula = order === 0 ? 't½ = [A]₀ / (2k)' : order === 1 ? 't½ = ln 2 / k' : 't½ = 1 / (k · [A]₀)';
  const formulaVal = order === 0 ? A0/(2*k) : order === 1 ? Math.LN2/k : 1/(k*A0);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
        <div style={{ background: 'var(--ink-1)', border: '1px solid var(--line)', borderRadius: 6, padding: 20 }}>
          <div className="eyebrow">Order</div>
          <div style={{ display: 'flex', marginTop: 10 }}>
            {([0,1,2] as Order[]).map((o, i) => (
              <button key={o} onClick={() => setOrder(o)} className="mono"
                style={{
                  flex: 1, padding: '10px', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase',
                  border: '1px solid var(--line-strong)', borderLeft: i === 0 ? '1px solid var(--line-strong)' : 0,
                  background: o === order ? 'var(--paper)' : 'transparent',
                  color: o === order ? 'var(--ink-0)' : 'var(--paper-dim)',
                  cursor: 'pointer', fontWeight: o === order ? 600 : 400,
                }}>Order {o}</button>
            ))}
          </div>
          <div className="serif" style={{ fontSize: 22, fontStyle: 'italic', marginTop: 18 }}>{formula}</div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--paper-faint)', marginTop: 10, lineHeight: 1.6 }}>
            {order === 1 && 'First-order: each successive half-life takes the same time — independent of [A].'}
            {order === 0 && 'Zero-order: half-lives shrink — the constant rate eats through smaller pools faster.'}
            {order === 2 && 'Second-order: half-lives grow — the rate slows as [A] falls.'}
          </div>
        </div>
        <div style={{ background: 'var(--ink-1)', border: '1px solid var(--line)', borderRadius: 6, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="eyebrow">Controls</div>
          <Slider label="k" value={k} min={0.01} max={2} step={0.01} onChange={setK} accent={ACID} fmt={(v) => v.toFixed(2)} />
          <Slider label="[A]₀ (M)" value={A0} min={0.1} max={5} step={0.1} onChange={setA0} accent={COOL} fmt={(v) => v.toFixed(2)} />
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <ControlBtn onClick={() => setRunning(r => !r)}>{running ? '❚❚ Pause' : '▶ Play'}</ControlBtn>
            <ControlBtn onClick={() => setT(0)}>↻ Reset</ControlBtn>
          </div>
          <div style={{ marginTop: 6, padding: 10, background: 'var(--ink-2)', borderRadius: 4 }}>
            <Stat label="initial t½" value={isFinite(formulaVal) ? `${formulaVal.toFixed(2)} s` : '—'} accent={HOT} />
          </div>
        </div>
      </div>

      <HalfLifeBar A0={A0} A_now={A_now} t={t} tMax={tMax} halfTimes={halfTimes} />
      <ParticleBox A0={A0} A_now={A_now} t={t} tMax={tMax} />
    </div>
  );
}

function HalfLifeBar({ A0, A_now, t, tMax, halfTimes }:
  { A0: number; A_now: number; t: number; tMax: number; halfTimes: number[] }) {
  const W = 800, H = 120, PAD = 40;
  const xOf = (ti: number) => PAD + (ti / tMax) * (W - PAD - 20);
  const frac = A_now / A0;
  const barX = PAD;
  const barW = xOf(t) - barX;

  return (
    <div style={{ background: 'var(--ink-1)', border: '1px solid var(--line)', borderRadius: 6, padding: 18 }}>
      <div className="eyebrow">[A] decay · vertical bands at each half-life</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 130, marginTop: 12 }}>
        {/* baseline */}
        <line x1={PAD} y1={H-20} x2={W-20} y2={H-20} stroke="var(--line-strong)" />
        {/* half-life bands */}
        {halfTimes.map((ht, i) => (
          <g key={i}>
            <line x1={xOf(ht)} y1={20} x2={xOf(ht)} y2={H-20} stroke={HOT} strokeDasharray="4 4" opacity={0.55} />
            <text x={xOf(ht)} y={16} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="9" fill={HOT}>t{i === 0 ? '½' : `${i+1}·½`}</text>
            <text x={xOf(ht)} y={H-6} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="9" fill="var(--paper-dim)">{ht.toFixed(1)}s</text>
          </g>
        ))}
        {/* progress bar */}
        <rect x={barX} y={40} width={Math.max(0, barW)} height={40}
              fill={`url(#hlGrad)`} stroke="rgba(0,0,0,0.5)" />
        <defs>
          <linearGradient id="hlGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--cool)" stopOpacity="0.85" />
            <stop offset="100%" stopColor="var(--cool)" stopOpacity={Math.max(0.15, frac)} />
          </linearGradient>
        </defs>
        {/* current marker */}
        <line x1={xOf(t)} y1={30} x2={xOf(t)} y2={90} stroke="var(--paper)" strokeWidth="2" />
        <text x={xOf(t)} y={26} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="10" fill="var(--paper)">{(frac*100).toFixed(0)}%</text>
        {/* y label */}
        <text x={6} y={H/2} fontFamily="JetBrains Mono" fontSize="9" fill="var(--paper-dim)">[A]/[A]₀</text>
      </svg>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  Plot — small SVG plotter
// ═══════════════════════════════════════════════════════════════════════

type PlotKind = 'A' | 'ln' | 'inv';
function Plot({ title, yLabel, samples, mapY, t, highlight, kind }: {
  title: string; yLabel: string;
  samples: { t: number; A: number }[];
  mapY: (s: { t: number; A: number }) => number;
  t: number; highlight: boolean;
  A0: number; k: number; order: Order; kind: PlotKind;
}) {
  const W = 280, H = 200, PL = 42, PR = 12, PT = 26, PB = 28;
  const ys = samples.map(mapY).filter(v => isFinite(v));
  const xMax = samples[samples.length - 1]?.t ?? 1;
  let yMin = Math.min(...ys), yMax = Math.max(...ys);
  if (!isFinite(yMin) || !isFinite(yMax) || yMin === yMax) { yMin = 0; yMax = 1; }
  const pad = (yMax - yMin) * 0.08; yMin -= pad; yMax += pad;
  const xOf = (tv: number) => PL + (tv / xMax) * (W - PL - PR);
  const yOf = (yv: number) => PT + (1 - (yv - yMin) / (yMax - yMin)) * (H - PT - PB);
  const path = samples.map((s, i) => {
    const v = mapY(s);
    return isFinite(v) ? `${i === 0 ? 'M' : 'L'} ${xOf(s.t).toFixed(2)} ${yOf(v).toFixed(2)}` : '';
  }).filter(Boolean).join(' ');
  const currentY = mapY({ t, A: samples.find(s => s.t >= t)?.A ?? samples[samples.length-1].A });
  const stroke = highlight ? PHOS : 'var(--paper-dim)';
  const TICKS = 4;
  return (
    <div style={{ background: 'var(--ink-1)', border: `1px solid ${highlight ? PHOS+'66' : 'var(--line)'}`, borderRadius: 6, padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div className="eyebrow" style={{ color: highlight ? PHOS : 'var(--paper-dim)' }}>{title}</div>
        {highlight && <div className="mono" style={{ fontSize: 9, color: PHOS, letterSpacing: '0.14em' }}>LINEAR</div>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 180, marginTop: 6 }}>
        <rect x={PL} y={PT} width={W-PL-PR} height={H-PT-PB} fill={highlight ? `${PHOS}10` : 'transparent'} />
        {Array.from({ length: TICKS+1 }).map((_, i) => {
          const y = PT + (i / TICKS) * (H - PT - PB);
          const x = PL + (i / TICKS) * (W - PL - PR);
          const yv = yMax - (i / TICKS) * (yMax - yMin);
          const xv = (i / TICKS) * xMax;
          return (<g key={i}>
            <line x1={PL} y1={y} x2={W-PR} y2={y} stroke="var(--line)" strokeWidth="0.5" />
            <text x={PL-4} y={y+3} textAnchor="end" fontFamily="JetBrains Mono" fontSize="8" fill="var(--paper-faint)">{fmtTick(yv, kind)}</text>
            <line x1={x} y1={PT} x2={x} y2={H-PB} stroke="var(--line)" strokeWidth="0.5" />
            <text x={x} y={H-PB+12} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="8" fill="var(--paper-faint)">{xv.toFixed(0)}</text>
          </g>);
        })}
        <line x1={PL} y1={H-PB} x2={W-PR} y2={H-PB} stroke="var(--line-strong)" />
        <line x1={PL} y1={PT} x2={PL} y2={H-PB} stroke="var(--line-strong)" />
        <text x={PL} y={PT-6} fontFamily="JetBrains Mono" fontSize="9" fill="var(--paper-dim)">{yLabel}</text>
        <text x={W-PR} y={H-6} textAnchor="end" fontFamily="JetBrains Mono" fontSize="9" fill="var(--paper-dim)">t (s)</text>
        <path d={path} fill="none" stroke={stroke} strokeWidth={highlight ? 2 : 1.4} />
        {isFinite(currentY) && (<>
          <line x1={xOf(t)} y1={PT} x2={xOf(t)} y2={H-PB} stroke="var(--paper)" strokeWidth="0.7" opacity="0.6" />
          <circle cx={xOf(t)} cy={yOf(currentY)} r={4} fill={PHOS} stroke="var(--ink-0)" strokeWidth="1.5" />
        </>)}
      </svg>
    </div>
  );
}

function fmtTick(v: number, kind: PlotKind) {
  if (!isFinite(v)) return '—';
  if (kind === 'inv' && Math.abs(v) >= 100) return v.toFixed(0);
  if (Math.abs(v) >= 10) return v.toFixed(1);
  if (Math.abs(v) >= 1) return v.toFixed(2);
  if (Math.abs(v) >= 0.01) return v.toFixed(3);
  return v.toExponential(1);
}

// ═══════════════════════════════════════════════════════════════════════
//  Particle loss canvas
// ═══════════════════════════════════════════════════════════════════════

function ParticleBox({ A0, A_now, t, tMax }: { A0: number; A_now: number; t: number; tMax: number }) {
  const N0 = 80;
  const fraction = Math.max(0, Math.min(1, A_now / A0));
  const remaining = Math.round(N0 * fraction);

  // Stable random positions (one per particle) — frozen across renders.
  const positions = useMemo(() => {
    const r = mulberry32(424242);
    return Array.from({ length: N0 }).map(() => ({
      x: r() * 100, y: r() * 100, phase: r() * Math.PI * 2,
    }));
  }, []);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Animate particle drift
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      if (document.hidden) { raf = requestAnimationFrame(loop); return; }
      const c = canvasRef.current;
      if (!c) { raf = requestAnimationFrame(loop); return; }
      const ctx = c.getContext('2d');
      if (!ctx) { raf = requestAnimationFrame(loop); return; }
      const W = c.width, H = c.height;
      ctx.clearRect(0, 0, W, H);
      const time = performance.now() / 1000;
      for (let i = 0; i < remaining; i++) {
        const p = positions[i];
        const wob = Math.sin(time * 1.5 + p.phase) * 4;
        const cx = (p.x / 100) * (W - 18) + 9 + wob;
        const cy = (p.y / 100) * (H - 18) + 9 + Math.cos(time * 1.2 + p.phase) * 4;
        const grad = ctx.createRadialGradient(cx - 2, cy - 2, 1, cx, cy, 7);
        grad.addColorStop(0, 'rgba(255,255,255,0.6)');
        grad.addColorStop(0.3, 'rgba(93,208,255,0.95)');
        grad.addColorStop(1, 'rgba(93,208,255,0.0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, 7, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [remaining, positions]);

  return (
    <div style={{ background: 'var(--ink-1)', border: '1px solid var(--line)', borderRadius: 6, padding: 18, position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="eyebrow">Reaction box · molecules of A</div>
        <div className="mono" style={{ fontSize: 10, color: 'var(--paper-dim)' }}>
          {remaining} / {N0}  ·  t = {t.toFixed(2)}/{tMax}s
        </div>
      </div>
      <div style={{ position: 'relative', marginTop: 10, aspectRatio: '2.4 / 1', background: 'var(--ink-2)', border: '1px solid var(--line)', borderRadius: 4, overflow: 'hidden' }}>
        <canvas ref={canvasRef} width={720} height={300} style={{ width: '100%', height: '100%', display: 'block' }} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  Math helpers
// ═══════════════════════════════════════════════════════════════════════

function concAt(order: Order, A0: number, k: number, t: number): number {
  if (order === 0) return Math.max(0, A0 - k * t);
  if (order === 1) return A0 * Math.exp(-k * t);
  // order 2:  1/[A] = 1/[A]0 + k t
  return 1 / (1 / A0 + k * t);
}

function halfLifeFor(order: Order, A0: number, k: number): number {
  if (order === 0) return A0 / (2 * k);
  if (order === 1) return Math.LN2 / k;
  return 1 / (k * A0);
}

function unitsForOrder(overall: number): string {
  // k units = M^(1−overall) · s⁻¹
  const exp = 1 - overall;
  if (exp === 0) return 's⁻¹';
  if (exp === 1) return 'M·s⁻¹';
  return `M^${exp}·s⁻¹`;
}

function close(a: number, b: number) { return Math.abs(a - b) < 1e-6; }

function randOrder(): Order { return Math.floor(Math.random() * 3) as Order; }

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ═══════════════════════════════════════════════════════════════════════
//  Small UI atoms (mirrors Stoichiometry/Calorimetry)
// ═══════════════════════════════════════════════════════════════════════

function ControlBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="mono"
      style={{
        flex: 1, padding: '8px 10px', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
        border: '1px solid var(--line-strong)', background: 'transparent', color: 'var(--paper)',
        cursor: 'pointer',
      }}>{children}</button>
  );
}

function Slider({ label, value, min, max, step, onChange, accent, fmt }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; accent: string; fmt?: (v: number) => string;
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span className="eyebrow">{label}</span>
        <span className="mono" style={{ fontSize: 11, color: accent }}>{fmt ? fmt(value) : value}</span>
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

function Card({ title, value, hint, color }: { title: string; value: string; hint: string; color: string }) {
  return (
    <div style={{ background: 'var(--ink-1)', border: '1px solid var(--line)', borderRadius: 6, padding: 18 }}>
      <div className="eyebrow">{title}</div>
      <div className="serif" style={{ fontSize: 44, color, lineHeight: 1, marginTop: 6 }}>{value}</div>
      <div className="mono" style={{ fontSize: 10, color: 'var(--paper-dim)', marginTop: 6 }}>{hint}</div>
    </div>
  );
}

function hth(): React.CSSProperties {
  return { padding: '10px 8px', textAlign: 'left', fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--paper-dim)', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 400 };
}
function td(): React.CSSProperties {
  return { padding: '12px 8px', verticalAlign: 'middle' };
}
