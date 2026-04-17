import { useEffect, useMemo, useRef, useState } from 'react';
import UISlider from '../components/ui/Slider';

/**
 * Collision Theory + Maxwell-Boltzmann distribution.
 * Two-color particle gas with elastic collisions; live speed histogram
 * overlaid with the analytic MB curve; activation-energy threshold;
 * sliders for T, Ea, N, sim speed; live readouts for <v>, v_rms,
 * fraction above v_thresh, and effective collision rate.
 *
 * Internal units are scaled (mass = 1, k_B = 1) for visual stability.
 * A scale factor maps internal speed → "m/s" for AP-style readouts.
 */

type P = {
  x: number; y: number; vx: number; vy: number; r: number;
  kind: 0 | 1; // 0 = red (A), 1 = blue (B)
};

const COL_A = '#ff5b3c';   // red — species A
const COL_B = '#5dd0ff';   // blue — species B
const COL_HIT = '#7CFFB2'; // phosphor — effective collisions
const M = 1;                // particle mass (internal)
const K = 1;                // Boltzmann (internal)
const T_REF = 500;          // K which maps to internal kT = 1
const SPEED_TO_MS = 515 / Math.sqrt(8 * K * T_REF / (Math.PI * M)); // tune so 500 K ≈ 515 m/s mean
const EA_KJ_TO_INT = 1 / 8.0; // kJ/mol → internal Ea (so Ea=40 kJ ≈ 5 kT at 500 K)

// Box-Muller normal sample
function gauss(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Sample one Cartesian velocity component at temp T (internal units)
function sampleV(T: number): number {
  // sigma = sqrt(kT/m), then vx = sigma * gauss
  const sigma = Math.sqrt(K * (T / T_REF) / M);
  return sigma * gauss();
}

export default function Collision() {
  const [T, setT] = useState(500);
  const [eaKJ, setEaKJ] = useState(30);
  const [N, setN] = useState(140);
  const [running, setRunning] = useState(true);
  const [simSpeed, setSimSpeed] = useState(1);
  const [resetTick, setResetTick] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const histRef = useRef<SVGSVGElement | null>(null);
  const particlesRef = useRef<P[]>([]);
  const statsRef = useRef({ vAvg: 0, vRms: 0, fracAbove: 0, effRate: 0 });
  const effHitsRef = useRef<number[]>([]); // timestamps (ms) of recent effective hits
  const [, force] = useState(0); // forces re-render of readouts

  const TRef = useRef(T); TRef.current = T;
  const eaRef = useRef(eaKJ); eaRef.current = eaKJ;
  const speedRef = useRef(simSpeed); speedRef.current = simSpeed;
  const runRef = useRef(running); runRef.current = running;

  // Internal Ea and v_thresh
  const eaInt = eaKJ * EA_KJ_TO_INT * (1 / T_REF); // scale so it's comparable to internal kT
  const vThreshInt = Math.sqrt(2 * eaInt / M);
  const vThreshMs = vThreshInt * SPEED_TO_MS;

  // Initialize / re-seed particles when N or resetTick changes
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const w = c.clientWidth, h = c.clientHeight;
    const r = Math.max(4, Math.min(8, 6 - (N - 100) / 80));
    const arr: P[] = [];
    for (let i = 0; i < N; i++) {
      arr.push({
        x: r + Math.random() * (w - 2 * r),
        y: r + Math.random() * (h - 2 * r),
        vx: sampleV(TRef.current),
        vy: sampleV(TRef.current),
        r,
        kind: i % 2 === 0 ? 0 : 1,
      });
    }
    particlesRef.current = arr;
    effHitsRef.current = [];
  }, [N, resetTick]);

  // When T changes, rescale velocities so distribution shifts in real time.
  // (Keep momentum direction; rescale magnitude to preserve MB shape relative to new T.)
  const lastTRef = useRef(T);
  useEffect(() => {
    const oldT = lastTRef.current;
    const ratio = Math.sqrt(T / oldT);
    for (const p of particlesRef.current) { p.vx *= ratio; p.vy *= ratio; }
    lastTRef.current = T;
  }, [T]);

  // Main animation loop
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    const dpr = Math.max(1, window.devicePixelRatio || 1);

    let raf = 0;
    let last = performance.now();
    const SUBSTEPS = 2;

    const step = (now: number) => {
      raf = requestAnimationFrame(step);
      if (document.hidden || !runRef.current) { last = now; return; }
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.05) dt = 0.05;
      dt *= speedRef.current;

      // HiDPI sizing
      const cssW = c.clientWidth, cssH = c.clientHeight;
      const wantW = Math.round(cssW * dpr), wantH = Math.round(cssH * dpr);
      if (c.width !== wantW || c.height !== wantH) {
        c.width = wantW; c.height = wantH;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const ps = particlesRef.current;
      const w = cssW, h = cssH;

      const sub = dt / SUBSTEPS;
      for (let s = 0; s < SUBSTEPS; s++) {
        // Move + wall bounce
        for (const p of ps) {
          p.x += p.vx * sub * 60;
          p.y += p.vy * sub * 60;
          if (p.x < p.r) { p.x = p.r; p.vx = -p.vx; }
          else if (p.x > w - p.r) { p.x = w - p.r; p.vx = -p.vx; }
          if (p.y < p.r) { p.y = p.r; p.vy = -p.vy; }
          else if (p.y > h - p.r) { p.y = h - p.r; p.vy = -p.vy; }
        }
        // Pair collisions O(n^2). Up to ~300 → 45k pairs/frame: fine.
        const vth = vThreshInt;
        for (let i = 0; i < ps.length; i++) {
          const a = ps[i];
          for (let j = i + 1; j < ps.length; j++) {
            const b = ps[j];
            const dx = b.x - a.x, dy = b.y - a.y;
            const min = a.r + b.r;
            if (Math.abs(dx) > min || Math.abs(dy) > min) continue;
            const d2 = dx * dx + dy * dy;
            if (d2 >= min * min || d2 === 0) continue;
            const dist = Math.sqrt(d2);
            const nx = dx / dist, ny = dy / dist;
            const overlap = (min - dist) / 2;
            a.x -= nx * overlap; a.y -= ny * overlap;
            b.x += nx * overlap; b.y += ny * overlap;
            const dvx = b.vx - a.vx, dvy = b.vy - a.vy;
            const vn = dvx * nx + dvy * ny;
            if (vn < 0) {
              a.vx += vn * nx; a.vy += vn * ny;
              b.vx -= vn * nx; b.vy -= vn * ny;
              // Effective collision: A-B with rel. speed > v_thresh
              if (a.kind !== b.kind) {
                const relSpeed = Math.hypot(dvx, dvy);
                if (relSpeed > vth) effHitsRef.current.push(now);
              }
            }
          }
        }
      }

      // Trim eff-hit log to last 1s
      const cutoff = now - 1000;
      const hits = effHitsRef.current;
      let cut = 0;
      while (cut < hits.length && hits[cut] < cutoff) cut++;
      if (cut > 0) hits.splice(0, cut);

      // Draw background (slight trail)
      ctx.fillStyle = 'rgba(16,14,12,0.55)';
      ctx.fillRect(0, 0, w, h);

      // Particles
      for (const p of ps) {
        const speed = Math.hypot(p.vx, p.vy);
        const fast = speed > vThreshInt;
        const base = p.kind === 0 ? COL_A : COL_B;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        const g = ctx.createRadialGradient(p.x - p.r / 3, p.y - p.r / 3, 0, p.x, p.y, p.r);
        g.addColorStop(0, '#ffffffcc');
        g.addColorStop(1, base);
        ctx.fillStyle = g;
        ctx.fill();
        if (fast) {
          ctx.strokeStyle = COL_HIT;
          ctx.lineWidth = 1.5;
        } else {
          ctx.strokeStyle = 'rgba(0,0,0,0.45)';
          ctx.lineWidth = 1;
        }
        ctx.stroke();
      }

      // Stats
      let sum = 0, sum2 = 0, above = 0;
      for (const p of ps) {
        const v = Math.hypot(p.vx, p.vy);
        sum += v; sum2 += v * v;
        if (v > vThreshInt) above++;
      }
      const n = Math.max(1, ps.length);
      statsRef.current.vAvg = (sum / n) * SPEED_TO_MS;
      statsRef.current.vRms = Math.sqrt(sum2 / n) * SPEED_TO_MS;
      statsRef.current.fracAbove = above / n;
      statsRef.current.effRate = hits.length;

      force(x => (x + 1) & 0xffff);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [vThreshInt]);

  // Build histogram data each render from current particles
  const hist = useMemo(() => {
    const ps = particlesRef.current;
    const bins = 32;
    const vMaxMs = Math.max(1500, statsRef.current.vRms * 2.4 || 1500);
    const counts = new Array<number>(bins).fill(0);
    for (const p of ps) {
      const vMs = Math.hypot(p.vx, p.vy) * SPEED_TO_MS;
      const idx = Math.min(bins - 1, Math.floor((vMs / vMaxMs) * bins));
      counts[idx]++;
    }
    return { counts, vMaxMs, bins };
    // recompute every readout tick (force triggers parent re-render)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statsRef.current.vAvg, statsRef.current.vRms, T, eaKJ, N]);

  // Theoretical MB curve sampled at the same x-axis
  const theory = useMemo(() => {
    const samples = 120;
    const xs: number[] = [], ys: number[] = [];
    // f(v) = 4π (m/2πkT)^{3/2} v² exp(-mv²/2kT)
    // Use SI-like form; keep mass unit (kg/mol-ish proxy) such that peak T=500 ≈ 515 m/s.
    // We pick m_eff so that <v> = sqrt(8kT/πm) matches our SPEED_TO_MS calibration.
    // <v> (m/s at T_REF) = SPEED_TO_MS * sqrt(8 K T/π m_internal). So m_eff in SI:
    const kB = 1.380649e-23;
    // From <v> = 515 at 500 K: m = 8 kT / (π <v>^2)
    const vMean500 = 515;
    const mEff = (8 * kB * 500) / (Math.PI * vMean500 * vMean500);
    const a = mEff / (2 * kB * T);
    const norm = 4 * Math.PI * Math.pow(a / Math.PI, 1.5);
    for (let i = 0; i < samples; i++) {
      const v = (i / (samples - 1)) * hist.vMaxMs;
      const f = norm * v * v * Math.exp(-a * v * v);
      xs.push(v); ys.push(f);
    }
    return { xs, ys };
  }, [T, hist.vMaxMs]);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 12 }}>
        <div className="serif" style={{ fontSize: 24, fontStyle: 'italic' }}>
          Collision theory · Maxwell–Boltzmann
        </div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--paper-dim)' }}>
          rate = Z · exp(−E<sub>a</sub>/RT)
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        {/* Particle scene */}
        <div style={{
          background: 'var(--ink-1)', border: '1px solid var(--line)',
          borderRadius: 6, aspectRatio: '1.5 / 1',
          position: 'relative', overflow: 'hidden',
        }}>
          <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
          <div className="eyebrow" style={{ position: 'absolute', top: 12, left: 14 }}>
            Sealed gas · {N} particles · T = {T} K
          </div>
          <div className="mono" style={{
            position: 'absolute', bottom: 12, left: 14,
            fontSize: 10, color: 'var(--paper-dim)',
          }}>
            <span style={{ color: COL_A }}>● A</span>{'  '}
            <span style={{ color: COL_B }}>● B</span>{'  '}
            <span style={{ color: COL_HIT }}>○ v &gt; v_thresh</span>
          </div>
          <div className="mono" style={{
            position: 'absolute', bottom: 12, right: 14,
            fontSize: 10, color: 'var(--paper-dim)',
          }}>
            elastic · momentum + KE conserved
          </div>
        </div>

        {/* Controls */}
        <div style={{
          background: 'var(--ink-1)', border: '1px solid var(--line)',
          borderRadius: 6, padding: 18,
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div className="eyebrow">Conditions</div>
          <Slider label="Temperature" unit="K" value={T} min={200} max={1000} step={10}
                  onChange={setT} accent="var(--hot)" />
          <Slider label="Activation energy E_a" unit="kJ/mol" value={eaKJ} min={0} max={80} step={1}
                  onChange={setEaKJ} accent={COL_HIT} />
          <Slider label="Number of particles" unit="" value={N} min={20} max={300} step={10}
                  onChange={setN} accent="var(--paper)" />
          <Slider label="Sim speed" unit="×" value={simSpeed} min={0.25} max={3} step={0.25}
                  onChange={setSimSpeed} accent="var(--paper-dim)" />

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <ControlBtn onClick={() => setRunning(r => !r)}>
              {running ? '❚❚ Pause' : '▶ Play'}
            </ControlBtn>
            <ControlBtn onClick={() => { setResetTick(x => x + 1); setRunning(true); }}>
              ↻ Reset
            </ControlBtn>
          </div>

          <div style={{
            marginTop: 4, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
            borderTop: '1px solid var(--line)', paddingTop: 12,
          }}>
            <Stat label="⟨v⟩" value={`${statsRef.current.vAvg.toFixed(0)} m/s`} />
            <Stat label="v_rms" value={`${statsRef.current.vRms.toFixed(0)} m/s`} />
            <Stat label="v_thresh" value={`${vThreshMs.toFixed(0)} m/s`} accent={COL_HIT} />
            <Stat label="fraction above" value={`${(statsRef.current.fracAbove * 100).toFixed(1)}%`} accent={COL_HIT} />
            <Stat label="eff. collisions/s" value={`${statsRef.current.effRate}`} accent="var(--phos)" />
            <Stat label="kT (relative)" value={`${(T / T_REF).toFixed(2)}`} />
          </div>
        </div>
      </div>

      {/* Histogram + theory curve */}
      <div style={{
        background: 'var(--ink-1)', border: '1px solid var(--line)',
        borderRadius: 6, padding: 20,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div className="eyebrow">Speed distribution · live histogram vs. theory</div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--paper-dim)' }}>
            f(v) = 4π(m/2πkT)<sup>3/2</sup> v² exp(−mv²/2kT)
          </div>
        </div>
        <Histogram svgRef={histRef}
                   counts={hist.counts}
                   vMax={hist.vMaxMs}
                   theoryX={theory.xs} theoryY={theory.ys}
                   vThresh={vThreshMs} />
      </div>

      {/* Educational caption */}
      <div style={{
        padding: 14, border: '1px dashed var(--line-strong)', borderRadius: 4,
        color: 'var(--paper-dim)', fontSize: 12, lineHeight: 1.55,
      }}>
        <span className="eyebrow" style={{ marginRight: 10, color: 'var(--phos)' }}>WHY 10 K MATTERS</span>
        Doubling T at modest temperatures multiplies the reactive fraction by ~2×–10× —
        this is why rate roughly doubles per 10 K. Slide T and watch the green-highlighted
        tail (above E<sub>a</sub>) grow much faster than the rest of the curve.
      </div>
    </div>
  );
}

// ───── Histogram (SVG) ─────

function Histogram({ svgRef, counts, vMax, theoryX, theoryY, vThresh }: {
  svgRef: React.RefObject<SVGSVGElement | null>;
  counts: number[]; vMax: number;
  theoryX: number[]; theoryY: number[];
  vThresh: number;
}) {
  const W = 800, H = 220;
  const padL = 44, padR = 16, padT = 12, padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const total = counts.reduce((a, b) => a + b, 0) || 1;
  const binW = vMax / counts.length;
  // Convert hist counts → density (area = 1) so it's comparable with theory.
  const hDensity = counts.map(c => c / total / binW);

  // Y-scale: max of either density
  const yMax = Math.max(
    ...hDensity,
    ...theoryY,
    1e-9,
  ) * 1.1;

  const x = (v: number) => padL + (v / vMax) * innerW;
  const y = (d: number) => padT + innerH - (d / yMax) * innerH;

  // Theory polyline
  const path = theoryX.map((vx, i) => `${i === 0 ? 'M' : 'L'} ${x(vx).toFixed(1)} ${y(theoryY[i]).toFixed(1)}`).join(' ');

  // Axis ticks
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => f * vMax);

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 220, marginTop: 10, display: 'block' }}>
      {/* grid */}
      {[0.25, 0.5, 0.75, 1].map(f => (
        <line key={f} x1={padL} x2={W - padR} y1={padT + innerH * (1 - f)} y2={padT + innerH * (1 - f)}
              stroke="rgba(245,241,232,0.07)" />
      ))}
      {/* threshold shaded band */}
      <rect x={x(vThresh)} y={padT}
            width={Math.max(0, (W - padR) - x(vThresh))}
            height={innerH}
            fill={COL_HIT} fillOpacity={0.06} />

      {/* bars */}
      {hDensity.map((d, i) => {
        const v0 = i * binW, v1 = (i + 1) * binW;
        const above = v0 >= vThresh;
        const straddle = v0 < vThresh && v1 > vThresh;
        const fill = above ? COL_HIT : '#ffb38a';
        const x0 = x(v0), x1 = x(v1);
        const y0 = y(d);
        return (
          <g key={i}>
            <rect x={x0 + 0.5} y={y0} width={Math.max(0.5, x1 - x0 - 1)}
                  height={padT + innerH - y0}
                  fill={fill} fillOpacity={above ? 0.55 : 0.35}
                  stroke={fill} strokeOpacity={above ? 0.9 : 0.5} />
            {straddle && (
              <rect x={x(vThresh)} y={y0} width={Math.max(0.5, x1 - x(vThresh) - 1)}
                    height={padT + innerH - y0}
                    fill={COL_HIT} fillOpacity={0.55} stroke={COL_HIT} strokeOpacity={0.9} />
            )}
          </g>
        );
      })}

      {/* theory curve */}
      <path d={path} fill="none" stroke="var(--paper)" strokeWidth={1.6} strokeOpacity={0.9} />

      {/* threshold line */}
      <line x1={x(vThresh)} x2={x(vThresh)} y1={padT} y2={padT + innerH}
            stroke={COL_HIT} strokeWidth={1.5} strokeDasharray="4 3" />
      <text x={x(vThresh) + 6} y={padT + 12}
            fontFamily="JetBrains Mono" fontSize={10} fill={COL_HIT}>
        v_thresh = {vThresh.toFixed(0)} m/s
      </text>

      {/* axes */}
      <line x1={padL} x2={W - padR} y1={padT + innerH} y2={padT + innerH} stroke="rgba(245,241,232,0.3)" />
      <line x1={padL} x2={padL} y1={padT} y2={padT + innerH} stroke="rgba(245,241,232,0.3)" />
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={x(t)} x2={x(t)} y1={padT + innerH} y2={padT + innerH + 4} stroke="rgba(245,241,232,0.4)" />
          <text x={x(t)} y={padT + innerH + 16} textAnchor="middle"
                fontFamily="JetBrains Mono" fontSize={10} fill="rgba(245,241,232,0.55)">
            {t.toFixed(0)}
          </text>
        </g>
      ))}
      <text x={(padL + W - padR) / 2} y={H - 4} textAnchor="middle"
            fontFamily="JetBrains Mono" fontSize={10} fill="rgba(245,241,232,0.55)">
        speed |v| (m/s)
      </text>
      <text x={padL - 8} y={padT + 4} textAnchor="end"
            fontFamily="JetBrains Mono" fontSize={10} fill="rgba(245,241,232,0.55)">
        f(v)
      </text>
    </svg>
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

function Slider({ label, unit, value, min, max, step, onChange, accent }: {
  label: string; unit: string;
  value: number; min: number; max: number; step: number;
  onChange: (n: number) => void; accent: string;
}) {
  return (
    <UISlider label={label} value={value} min={min} max={max} step={step}
              onChange={onChange} accent={accent} unit={` ${unit}`}
              format={(v) => `${Number.isInteger(v) ? v : v.toFixed(2)} ${unit}`} />
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 2 }}>{label}</div>
      <div className="serif" style={{ fontSize: 17, color: accent ?? 'var(--paper)' }}>{value}</div>
    </div>
  );
}
