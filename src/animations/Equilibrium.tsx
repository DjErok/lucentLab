import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Equilibrium — dynamic equilibrium and Le Châtelier's principle.
 * Reaction: 2 NO₂ (orange) ⇌ N₂O₄ (blue dimer).
 *
 *   Forward: two NO₂ molecules collide → one N₂O₄     rate = kf · [NO₂]²
 *   Reverse: one N₂O₄ spontaneously splits → two NO₂  rate = kr · [N₂O₄]
 *
 * Live particle simulation, live concentration plot (30 s rolling),
 * stress buttons, live readouts (Kc, Q, verdict), reset, speed slider.
 */

type Species = 'NO2' | 'N2O4';
type Particle = {
  id: number; type: Species;
  x: number; y: number; vx: number; vy: number;
  r: number; angle: number; spin: number;
};
type Sample = { t: number; no2: number; n2o4: number };

const COL_NO2 = '#ff7a3c';   // orange — NO₂
const COL_N2O4 = '#6fb8ff';  // blue  — N₂O₄
const R_NO2 = 7;
const R_N2O4 = 10;
const WINDOW_SEC = 30;
const INITIAL_NO2 = 40;
const INITIAL_N2O4 = 0;

// Base rate constants (per second units, scaled against count^2 / count).
// Kc = kf/kr → with these defaults, Kc ≈ 0.02 so a mixed steady state.
const KF_BASE = 0.020;
const KR_BASE = 0.50;

let pidSeq = 0;
const nextId = () => ++pidSeq;

export default function Equilibrium() {
  const simCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const plotCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const particlesRef = useRef<Particle[]>([]);
  const historyRef = useRef<Sample[]>([]);
  const simTimeRef = useRef(0);
  const kfRef = useRef(KF_BASE);
  const krRef = useRef(KR_BASE);
  const speedRef = useRef(1);
  const pendingOpsRef = useRef<(() => void)[]>([]);
  const boxRef = useRef({ w: 600, h: 420 });

  const [speed, setSpeed] = useState(1);
  const [counts, setCounts] = useState({ no2: INITIAL_NO2, n2o4: INITIAL_N2O4 });
  const [rates, setRates] = useState({ kf: KF_BASE, kr: KR_BASE });
  const [temp, setTemp] = useState<'cool' | 'normal' | 'hot'>('normal');

  // keep refs synced with state for RAF loop
  useEffect(() => { speedRef.current = speed; }, [speed]);

  const resetSim = useCallback(() => {
    const { w, h } = boxRef.current;
    const parts: Particle[] = [];
    for (let i = 0; i < INITIAL_NO2; i++) parts.push(makeParticle('NO2', w, h));
    for (let i = 0; i < INITIAL_N2O4; i++) parts.push(makeParticle('N2O4', w, h));
    particlesRef.current = parts;
    historyRef.current = [];
    simTimeRef.current = 0;
    kfRef.current = KF_BASE;
    krRef.current = KR_BASE;
    pendingOpsRef.current = [];
    setTemp('normal');
    setRates({ kf: KF_BASE, kr: KR_BASE });
    setCounts({ no2: INITIAL_NO2, n2o4: INITIAL_N2O4 });
  }, []);

  // init once
  useEffect(() => {
    const sim = simCanvasRef.current;
    if (!sim) return;
    const rect = sim.getBoundingClientRect();
    boxRef.current = { w: rect.width, h: rect.height };
    resetSim();
  }, [resetSim]);

  // RAF loop
  useEffect(() => {
    let raf = 0;
    let lastT = performance.now();
    const sim = simCanvasRef.current!;
    const plot = plotCanvasRef.current!;
    const dpr = Math.max(1, window.devicePixelRatio || 1);

    const syncCanvasSize = (c: HTMLCanvasElement) => {
      const rect = c.getBoundingClientRect();
      const W = Math.max(1, Math.round(rect.width * dpr));
      const H = Math.max(1, Math.round(rect.height * dpr));
      if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
      return { rect, W, H };
    };

    let sampleAcc = 0;
    let uiAcc = 0;

    const step = (now: number) => {
      const rawDt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;

      if (document.hidden) {
        raf = requestAnimationFrame(step);
        return;
      }

      const dt = rawDt * speedRef.current;

      // --- simulation canvas sizing (use CSS rect for physics) ---
      const { rect: simRect, W: simW, H: simH } = syncCanvasSize(sim);
      boxRef.current = { w: simRect.width, h: simRect.height };
      const { w, h } = boxRef.current;

      // Apply any queued button ops (must run on sim thread, with current box).
      while (pendingOpsRef.current.length > 0) {
        const op = pendingOpsRef.current.shift()!;
        op();
      }

      const ps = particlesRef.current;

      for (const p of ps) {
        p.x += p.vx * dt; p.y += p.vy * dt; p.angle += p.spin * dt;
        if (p.x < p.r)     { p.x = p.r;     p.vx = Math.abs(p.vx); }
        if (p.x > w - p.r) { p.x = w - p.r; p.vx = -Math.abs(p.vx); }
        if (p.y < p.r)     { p.y = p.r;     p.vy = Math.abs(p.vy); }
        if (p.y > h - p.r) { p.y = h - p.r; p.vy = -Math.abs(p.vy); }
      }

      // Reaction kinetics — kf, kr → per-frame probabilities.
      const kf = kfRef.current, kr = krRef.current;

      // Forward: NO2 pairs that overlap may combine into N2O4.
      const used = new Set<number>();
      const no2s: Particle[] = [];
      for (const p of ps) if (p.type === 'NO2') no2s.push(p);
      for (let i = 0; i < no2s.length; i++) {
        const a = no2s[i];
        if (used.has(a.id)) continue;
        for (let j = i + 1; j < no2s.length; j++) {
          const b = no2s[j];
          if (used.has(b.id)) continue;
          const dx = b.x - a.x, dy = b.y - a.y;
          const rr = a.r + b.r + 2;
          if (dx * dx + dy * dy < rr * rr) {
            if (Math.random() < 1 - Math.exp(-kf * 8 * dt)) {
              used.add(a.id); used.add(b.id);
              const nd: Particle = {
                id: nextId(), type: 'N2O4',
                x: (a.x + b.x) / 2, y: (a.y + b.y) / 2,
                vx: (a.vx + b.vx) * 0.42, vy: (a.vy + b.vy) * 0.42,
                r: R_N2O4,
                angle: Math.atan2(dy, dx),
                spin: (Math.random() - 0.5) * 4,
              };
              pendingOpsRef.current.push(() => {
                const cur = particlesRef.current;
                const ai = cur.findIndex(p => p.id === a.id); if (ai >= 0) cur.splice(ai, 1);
                const bi = cur.findIndex(p => p.id === b.id); if (bi >= 0) cur.splice(bi, 1);
                cur.push(nd);
              });
              break;
            }
          }
        }
      }

      // Reverse: each N2O4 splits with prob 1 - exp(-kr·dt).
      const pSplit = 1 - Math.exp(-kr * dt);
      for (const p of ps) {
        if (p.type !== 'N2O4' || Math.random() >= pSplit) continue;
        const ang = Math.random() * Math.PI * 2;
        const sp = 60, cx = Math.cos(ang), cy = Math.sin(ang);
        const a: Particle = { id: nextId(), type: 'NO2', x: p.x + cx * 6, y: p.y + cy * 6, vx: p.vx + cx * sp, vy: p.vy + cy * sp, r: R_NO2, angle: 0, spin: 0 };
        const b: Particle = { id: nextId(), type: 'NO2', x: p.x - cx * 6, y: p.y - cy * 6, vx: p.vx - cx * sp, vy: p.vy - cy * sp, r: R_NO2, angle: 0, spin: 0 };
        const pid = p.id;
        pendingOpsRef.current.push(() => {
          const cur = particlesRef.current;
          const i = cur.findIndex(q => q.id === pid);
          if (i >= 0) cur.splice(i, 1);
          cur.push(a, b);
        });
      }

      // Process deferred structural ops now so render is consistent
      while (pendingOpsRef.current.length > 0) {
        const op = pendingOpsRef.current.shift()!;
        op();
      }

      // --- Draw sim ---
      const ctx = sim.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // subtle flask tint
      const grd = ctx.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, 'rgba(255,122,60,0.04)');
      grd.addColorStop(1, 'rgba(111,184,255,0.04)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);

      for (const p of particlesRef.current) {
        if (p.type === 'NO2') {
          drawNO2(ctx, p.x, p.y);
        } else {
          drawN2O4(ctx, p.x, p.y, p.angle);
        }
      }

      // Sample concentration (4x per sim second of sim time)
      simTimeRef.current += dt;
      sampleAcc += dt;
      if (sampleAcc >= 0.1) {
        sampleAcc = 0;
        let no2 = 0, n2o4 = 0;
        for (const p of particlesRef.current) {
          if (p.type === 'NO2') no2++; else n2o4++;
        }
        historyRef.current.push({ t: simTimeRef.current, no2, n2o4 });
        const cutoff = simTimeRef.current - WINDOW_SEC;
        while (historyRef.current.length > 0 && historyRef.current[0].t < cutoff) {
          historyRef.current.shift();
        }
      }

      // --- Draw plot ---
      drawPlot(plot, dpr, historyRef.current, simTimeRef.current);

      // UI readouts refresh ~5 Hz
      uiAcc += rawDt;
      if (uiAcc >= 0.2) {
        uiAcc = 0;
        let no2 = 0, n2o4 = 0;
        for (const p of particlesRef.current) {
          if (p.type === 'NO2') no2++; else n2o4++;
        }
        setCounts(prev =>
          prev.no2 === no2 && prev.n2o4 === n2o4 ? prev : { no2, n2o4 }
        );
      }

      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Button actions — queue on sim thread
  const queue = (fn: () => void) => { pendingOpsRef.current.push(fn); };

  const addNO2 = () => queue(() => {
    const { w, h } = boxRef.current;
    for (let i = 0; i < 10; i++) particlesRef.current.push(makeParticle('NO2', w, h));
  });
  const addN2O4 = () => queue(() => {
    const { w, h } = boxRef.current;
    for (let i = 0; i < 6; i++) particlesRef.current.push(makeParticle('N2O4', w, h));
  });
  const removeNO2 = () => queue(() => {
    const ps = particlesRef.current;
    let n = 10;
    for (let i = ps.length - 1; i >= 0 && n > 0; i--) {
      if (ps[i].type === 'NO2') { ps.splice(i, 1); n--; }
    }
  });

  // Forward (2 NO2 → N2O4) is exothermic — heat shifts reverse (Le Châtelier).
  // Implementation: heating multiplies kr more than kf (endothermic reverse benefits).
  const applyTemp = (t: 'cool' | 'normal' | 'hot', from: 'cool' | 'normal' | 'hot') => {
    let kf = KF_BASE, kr = KR_BASE;
    if (t === 'hot')  { kf = KF_BASE * 1.2; kr = KR_BASE * 3.2; }
    if (t === 'cool') { kf = KF_BASE * 0.9; kr = KR_BASE * 0.35; }
    kfRef.current = kf; krRef.current = kr;
    setRates({ kf, kr });
    const speedAt = (s: 'cool' | 'normal' | 'hot') => s === 'hot' ? 1.35 : s === 'cool' ? 0.72 : 1;
    const mul = speedAt(t) / speedAt(from);
    queue(() => { for (const p of particlesRef.current) { p.vx *= mul; p.vy *= mul; } });
  };
  const applyHeat = () => setTemp(t => {
    const n: 'cool' | 'normal' | 'hot' = t === 'cool' ? 'normal' : 'hot';
    applyTemp(n, t); return n;
  });
  const applyCool = () => setTemp(t => {
    const n: 'cool' | 'normal' | 'hot' = t === 'hot' ? 'normal' : 'cool';
    applyTemp(n, t); return n;
  });

  // Derived quantities
  const Kc = rates.kf / rates.kr; // in "particle-count" units (proportional to true Kc)
  // Q = [N2O4] / [NO2]^2 — in same count units
  const Q = counts.no2 > 0 ? counts.n2o4 / (counts.no2 * counts.no2) : Infinity;
  const verdict =
    counts.no2 + counts.n2o4 === 0 ? { text: 'empty flask', color: 'var(--paper-dim)' } :
    !isFinite(Q) ? { text: 'Q undefined (no NO₂)', color: 'var(--paper-dim)' } :
    Q < Kc * 0.85 ? { text: 'Q < K → forward shift (→ N₂O₄)', color: 'var(--cool)' } :
    Q > Kc * 1.15 ? { text: 'Q > K → reverse shift (→ NO₂)', color: 'var(--hot)' } :
                    { text: 'Q ≈ K → at equilibrium', color: 'var(--phos)' };

  const panel: React.CSSProperties = {
    background: 'var(--ink-1)', border: '1px solid var(--line)',
    borderRadius: 6, padding: 18,
  };
  const flexBetween: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center' };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ ...flexBetween, alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
        <div className="serif" style={{ fontSize: 26, fontStyle: 'italic' }}>
          2 NO<sub>2</sub><span style={{ color: COL_NO2 }}>(g)</span>{' '}⇌{' '}
          N<sub>2</sub>O<sub>4</sub><span style={{ color: COL_N2O4 }}>(g)</span>
        </div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--paper-dim)' }}>
          ΔH<sub>fwd</sub> &lt; 0 · forward exothermic · heat ⇒ reverse shift
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16 }}>
        {/* LEFT: flask */}
        <div style={{ ...panel, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 480 }}>
          <div style={flexBetween}>
            <div className="eyebrow">Reaction vessel · sealed</div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--paper-dim)' }}>
              t = {simTimeRef.current?.toFixed?.(1) ?? '0'}s · {temp.toUpperCase()}
            </div>
          </div>
          <div style={{
            position: 'relative', flex: 1, minHeight: 360,
            border: '1px solid var(--line)', borderRadius: 4,
            background: 'rgba(10,9,8,0.35)', overflow: 'hidden',
          }}>
            <canvas ref={simCanvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
            <div style={{
              position: 'absolute', left: 10, bottom: 10,
              display: 'flex', gap: 14, alignItems: 'center',
              padding: '6px 10px', background: 'rgba(10,9,8,0.55)',
              border: '1px solid var(--line)', borderRadius: 3,
            }}>
              <LegendDot color={COL_NO2} label="NO₂" />
              <LegendDimer label="N₂O₄" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
            <StressBtn onClick={addNO2} accent={COL_NO2}>+ NO₂</StressBtn>
            <StressBtn onClick={removeNO2} accent={COL_NO2}>− NO₂</StressBtn>
            <StressBtn onClick={addN2O4} accent={COL_N2O4}>+ N₂O₄</StressBtn>
            <StressBtn onClick={applyHeat} accent="var(--hot)" active={temp === 'hot'}>+ Heat</StressBtn>
            <StressBtn onClick={applyCool} accent="var(--cool)" active={temp === 'cool'}>− Cool</StressBtn>
          </div>
        </div>

        {/* RIGHT: readouts + plot + controls */}
        <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr auto', gap: 12 }}>
          <div style={panel}>
            <div className="eyebrow">Live readout</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
              <Readout label="[NO₂]" value={counts.no2.toString()} accent={COL_NO2} />
              <Readout label="[N₂O₄]" value={counts.n2o4.toString()} accent={COL_N2O4} />
              <Readout label="Kc = kf / kr" value={Kc.toExponential(2)} accent="var(--phos)" />
              <Readout label="Q = [N₂O₄]/[NO₂]²" value={isFinite(Q) ? Q.toExponential(2) : '—'} accent="var(--acid)" />
            </div>
            <div style={{
              marginTop: 12, padding: '8px 10px',
              border: `1px solid ${verdict.color}55`,
              background: `${verdict.color}15`, borderRadius: 3,
            }}>
              <div className="mono" style={{ fontSize: 10, color: verdict.color, letterSpacing: '0.12em' }}>
                {verdict.text.toUpperCase()}
              </div>
            </div>
          </div>

          <div style={{ ...panel, display: 'flex', flexDirection: 'column', minHeight: 220 }}>
            <div style={flexBetween}>
              <div className="eyebrow">Concentration · 30 s window</div>
              <div className="mono" style={{ fontSize: 10, color: 'var(--paper-dim)' }}>
                <span style={{ color: COL_NO2 }}>● NO₂</span>{'  '}
                <span style={{ color: COL_N2O4 }}>● N₂O₄</span>
              </div>
            </div>
            <canvas ref={plotCanvasRef} style={{ width: '100%', flex: 1, marginTop: 10, display: 'block', minHeight: 150 }} />
          </div>

          <div style={{ ...panel, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ ...flexBetween, marginBottom: 4 }}>
                <span className="eyebrow">Simulation speed</span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--paper)' }}>{speed.toFixed(2)}×</span>
              </div>
              <input type="range" min={0.25} max={4} step={0.05} value={speed}
                     onChange={e => setSpeed(Number(e.target.value))}
                     style={{ width: '100%', accentColor: 'var(--phos)' }} />
            </div>
            <button onClick={resetSim} className="mono" style={{
              padding: '10px 14px', fontSize: 11, letterSpacing: '0.14em',
              textTransform: 'uppercase', border: '1px solid var(--line-strong)',
              background: 'transparent', color: 'var(--paper)', cursor: 'pointer',
            }}>■ Reset</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ───── factory ─────

function makeParticle(type: Species, w: number, h: number): Particle {
  const r = type === 'NO2' ? R_NO2 : R_N2O4;
  const ang = Math.random() * Math.PI * 2;
  const sp = type === 'NO2' ? 90 : 60;
  return {
    id: nextId(), type, r,
    x: r + Math.random() * Math.max(1, w - 2 * r),
    y: r + Math.random() * Math.max(1, h - 2 * r),
    vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
    angle: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 3,
  };
}

// ───── drawing ─────

function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, hi: string, lo: string) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, r);
  g.addColorStop(0, hi); g.addColorStop(1, lo);
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1; ctx.stroke();
}
function drawNO2(ctx: CanvasRenderingContext2D, x: number, y: number) {
  drawBall(ctx, x, y, R_NO2, '#ffd2b3', COL_NO2);
}
function drawN2O4(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number) {
  const off = 6, dx = Math.cos(angle) * off, dy = Math.sin(angle) * off;
  ctx.strokeStyle = 'rgba(245,241,232,0.35)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x - dx, y - dy); ctx.lineTo(x + dx, y + dy); ctx.stroke();
  for (const s of [-1, 1]) drawBall(ctx, x + s * dx, y + s * dy, R_N2O4 - 2, '#d2e9ff', COL_N2O4);
}

function drawPlot(c: HTMLCanvasElement, dpr: number, hist: Sample[], nowT: number) {
  const rect = c.getBoundingClientRect();
  const W = Math.max(1, Math.round(rect.width * dpr));
  const H = Math.max(1, Math.round(rect.height * dpr));
  if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
  const ctx = c.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const w = rect.width, h = rect.height;
  ctx.clearRect(0, 0, w, h);

  const padL = 28, padR = 8, padT = 6, padB = 18;
  const plotW = w - padL - padR, plotH = h - padT - padB;

  let maxY = 20;
  for (const s of hist) maxY = Math.max(maxY, s.no2, s.n2o4);
  maxY = Math.ceil(maxY / 10) * 10;

  ctx.strokeStyle = 'rgba(245,241,232,0.08)'; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padT + (i / 4) * plotH;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + plotW, y); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(245,241,232,0.4)';
  ctx.font = '10px JetBrains Mono, monospace';
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  for (let i = 0; i <= 4; i++) {
    ctx.fillText((maxY * (1 - i / 4)).toFixed(0), padL - 4, padT + (i / 4) * plotH);
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  const tMin = Math.max(nowT, WINDOW_SEC) - WINDOW_SEC;
  for (let i = 0; i <= 3; i++) {
    ctx.fillText(`${(tMin + (i / 3) * WINDOW_SEC).toFixed(0)}s`, padL + (i / 3) * plotW, padT + plotH + 3);
  }
  if (hist.length < 2) return;
  const drawLine = (key: 'no2' | 'n2o4', color: string) => {
    ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 2;
    for (let i = 0; i < hist.length; i++) {
      const s = hist[i];
      const x = padL + ((s.t - tMin) / WINDOW_SEC) * plotW;
      const y = padT + (1 - s[key] / maxY) * plotH;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };
  drawLine('no2', COL_NO2);
  drawLine('n2o4', COL_N2O4);
}

// ───── UI atoms ─────

const LEGEND_LABEL: React.CSSProperties = { fontSize: 10, color: 'var(--paper-dim)', display: 'inline-flex', alignItems: 'center', gap: 6 };

function StressBtn({ children, onClick, accent, active }: {
  children: React.ReactNode; onClick: () => void; accent?: string; active?: boolean;
}) {
  return (
    <button onClick={onClick} className="mono" style={{
      padding: '9px 6px', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
      border: `1px solid ${active && accent ? accent : 'var(--line-strong)'}`,
      background: active ? `${accent}22` : 'transparent',
      color: active && accent ? accent : 'var(--paper)',
      cursor: 'pointer', whiteSpace: 'nowrap',
    }}>{children}</button>
  );
}

function Readout({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 4 }}>{label}</div>
      <div className="serif" style={{ fontSize: 20, color: accent ?? 'var(--paper)' }}>{value}</div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="mono" style={LEGEND_LABEL}>
      <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}66` }} />
      {label}
    </span>
  );
}

function LegendDimer({ label }: { label: string }) {
  const dot = { width: 8, height: 8, borderRadius: '50%', background: COL_N2O4 } as React.CSSProperties;
  return (
    <span className="mono" style={LEGEND_LABEL}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
        <span style={dot} />
        <span style={{ width: 5, height: 1, background: 'rgba(245,241,232,0.4)' }} />
        <span style={dot} />
      </span>
      {label}
    </span>
  );
}
