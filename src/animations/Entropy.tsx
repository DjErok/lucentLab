import { useEffect, useMemo, useRef, useState } from 'react';
import UISlider from '../components/ui/Slider';
import SlideTabs from '../components/ui/SlideTabs';

/**
 * Entropy — PhET-quality interactive sandbox.
 * Modes: Gas expansion · Mixing · Heat flow · Phase change ΔS.
 * Live microstate count W, S = k·ln(W), molar S = R·ln(W),
 * particle distribution histogram, 2nd Law banner.
 */

type Mode = 'expansion' | 'mixing' | 'heat' | 'phase';

const k_B = 1.380649e-23; // J/K
const R = 8.314462; // J/mol·K
const NA = 6.02214076e23;

const COLOR_A = '#5dd0ff';
const COLOR_B = '#ff7b6b';
const COLOR_HOT = '#ff9d3c';
const COLOR_COLD = '#74c0ff';

type Particle = {
  x: number; y: number; vx: number; vy: number;
  kind: 0 | 1; // for mixing / heat coloring
};

export default function Entropy() {
  const [mode, setMode] = useState<Mode>('expansion');
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <ModeTabs mode={mode} setMode={setMode} />
      <SecondLawBanner />
      {mode === 'expansion' && <GasExpansion />}
      {mode === 'mixing' && <Mixing />}
      {mode === 'heat' && <HeatFlow />}
      {mode === 'phase' && <PhaseChange />}
    </div>
  );
}

// ───── shared simulator ─────

type SimConfig = {
  N: number;
  speed: number;
  initFn: (w: number, h: number) => Particle[];
  partitionOpen: boolean;
  /** false = hard wall at midline; true = particles cross freely */
  midlineMode: 'wall' | 'open' | 'porous';
  /** kind 0 speed multiplier, kind 1 multiplier, applied on collision/reset */
  speedMul?: { 0: number; 1: number };
  drawKindColor: (k: 0 | 1) => string;
};

function useSim(canvas: HTMLCanvasElement | null, cfg: SimConfig) {
  const psRef = useRef<Particle[]>([]);
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;
  const tickRef = useRef(0);
  const distRef = useRef<{ leftA: number; leftB: number; rightA: number; rightB: number }>({
    leftA: 0, leftB: 0, rightA: 0, rightB: 0,
  });

  // (Re)initialize particles when N or initFn identity changes
  useEffect(() => {
    if (!canvas) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    psRef.current = cfg.initFn(canvas.width, canvas.height);
    tickRef.current = 0;
  }, [canvas, cfg.N, cfg.initFn]);

  // Resize observer for HiDPI
  useEffect(() => {
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [canvas]);

  // RAF loop
  useEffect(() => {
    if (!canvas) return;
    let raf = 0;
    const ctx = canvas.getContext('2d')!;
    const step = () => {
      if (document.hidden) { raf = requestAnimationFrame(step); return; }
      const cur = cfgRef.current;
      const w = canvas.width, h = canvas.height;
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const r = 5 * dpr;
      const xMid = w / 2;
      const ps = psRef.current;
      const sp = cur.speed;
      let leftA = 0, leftB = 0, rightA = 0, rightB = 0;

      for (const p of ps) {
        p.x += p.vx * sp; p.y += p.vy * sp;
        if (p.x < r) { p.x = r; p.vx = -p.vx; }
        if (p.y < r) { p.y = r; p.vy = -p.vy; }
        if (p.y > h - r) { p.y = h - r; p.vy = -p.vy; }
        if (p.x > w - r) { p.x = w - r; p.vx = -p.vx; }
        if (cur.midlineMode === 'wall' && !cur.partitionOpen) {
          // Originally-left stay left; originally-right stay right (kind tracks side here only for mixing/heat).
          // For expansion (single kind), all start left.
          // We treat midline as bounce for everyone that's on left side.
          if (p.kind === 0) {
            if (p.x > xMid - r) { p.x = xMid - r; p.vx = -Math.abs(p.vx); }
          } else {
            if (p.x < xMid + r) { p.x = xMid + r; p.vx = Math.abs(p.vx); }
          }
        }
        // counts
        if (p.x < xMid) (p.kind === 0 ? leftA++ : leftB++); else (p.kind === 0 ? rightA++ : rightB++);
      }

      distRef.current = { leftA, leftB, rightA, rightB };
      tickRef.current++;

      // draw
      ctx.fillStyle = 'rgba(16,14,12,0.55)';
      ctx.fillRect(0, 0, w, h);

      // chamber outline
      ctx.strokeStyle = 'rgba(245,241,232,0.18)';
      ctx.lineWidth = 1 * dpr;
      ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

      for (const p of ps) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        const c = cur.drawKindColor(p.kind);
        const grad = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.3, 0, p.x, p.y, r);
        grad.addColorStop(0, '#ffffffcc');
        grad.addColorStop(0.4, c);
        grad.addColorStop(1, c + '88');
        ctx.fillStyle = grad;
        ctx.fill();
      }

      // partition
      if (!cur.partitionOpen && cur.midlineMode === 'wall') {
        ctx.fillStyle = 'rgba(245,241,232,0.85)';
        ctx.fillRect(xMid - 1.5 * dpr, 0, 3 * dpr, h);
      } else if (cur.midlineMode === 'porous') {
        ctx.strokeStyle = 'rgba(245,241,232,0.35)';
        ctx.setLineDash([6 * dpr, 6 * dpr]);
        ctx.beginPath(); ctx.moveTo(xMid, 0); ctx.lineTo(xMid, h); ctx.stroke();
        ctx.setLineDash([]);
      }

      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [canvas]);

  return { psRef, distRef, tickRef };
}

// ───── Gas expansion ─────

function GasExpansion() {
  const [N, setN] = useState(60);
  const [speed, setSpeed] = useState(1);
  const [open, setOpen] = useState(false);
  const [series, setSeries] = useState<{ tL: number[]; tR: number[] }>({ tL: [], tR: [] });
  const [tick, setTick] = useState(0);
  const [t0, setT0] = useState(0); // time when partition removed
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const initFn = useMemo(() => (w: number, h: number): Particle[] => {
    const ps: Particle[] = [];
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2;
      ps.push({
        x: 8 + Math.random() * (w / 2 - 16),
        y: 8 + Math.random() * (h - 16),
        vx: Math.cos(a) * 1.4,
        vy: Math.sin(a) * 1.4,
        kind: 0,
      });
    }
    return ps;
  }, [N]);

  const sim = useSim(canvasRef.current, {
    N, speed, initFn, partitionOpen: open, midlineMode: 'wall',
    drawKindColor: () => COLOR_A,
  });

  // sample distribution every ~120ms
  useEffect(() => {
    const iv = setInterval(() => {
      const d = sim.distRef.current;
      const L = d.leftA + d.leftB, Rn = d.rightA + d.rightB;
      setSeries(s => {
        const tL = [...s.tL, L].slice(-200);
        const tR = [...s.tR, Rn].slice(-200);
        return { tL, tR };
      });
      setTick(t => t + 1);
    }, 120);
    return () => clearInterval(iv);
  }, [sim]);

  const dist = sim.distRef.current;
  const nL = dist.leftA + dist.leftB;
  const nR = dist.rightA + dist.rightB;

  // microstate counts
  const W_binary = useMemo(() => binomial(N, nL), [N, nL]);
  const S_binary = k_B * Math.log(Math.max(1, W_binary));
  // Volume-based: ΔS for ideal gas doubling = N k ln 2
  const dS_ideal = open ? N * k_B * Math.log(2) : 0;
  const dS_molar = open ? R * Math.log(2) : 0;

  const elapsed = open ? ((tick - t0) * 0.12).toFixed(1) : '0.0';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
      <Panel>
        <PanelHeader title="Two-chamber box" right={open ? `t = ${elapsed}s · partition open` : 'partition closed'} />
        <div style={{ position: 'relative', flex: 1, minHeight: 280 }}>
          <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', borderRadius: 4 }} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <ActionBtn primary={!open} onClick={() => { setOpen(true); setT0(tick); }} disabled={open}>
            ↗ Remove partition
          </ActionBtn>
          <ActionBtn onClick={() => { setOpen(false); setSeries({ tL: [], tR: [] }); setT0(0);
            // re-init by toggling N briefly to force initFn rerun
            const cur = N; setN(cur === 60 ? 61 : 60); setTimeout(() => setN(cur), 0);
          }}>↺ Reset</ActionBtn>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
          <Slider label={`N · particles`} value={N} min={10} max={200} step={1} accent={COLOR_A}
            onChange={(v) => { setN(v); setOpen(false); setSeries({ tL: [], tR: [] }); }} />
          <Slider label="Speed" value={speed} min={0.2} max={3} step={0.1} accent="var(--phos)"
            onChange={setSpeed} />
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Boltzmann · S = k·ln(W)" />
        <Equation>S = k<sub>B</sub> · ln(W)</Equation>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Stat label="n_L · n_R" value={`${nL} · ${nR}`} />
          <Stat label="W = N!/(n_L! n_R!)" value={fmtBig(W_binary)} accent={COLOR_A} />
          <Stat label="S (J/K)" value={S_binary.toExponential(2)} />
          <Stat label="S/N (J/K per particle)" value={(S_binary / Math.max(1, N)).toExponential(2)} />
        </div>
        <div style={{ marginTop: 10, padding: 12, background: 'var(--ink-2)', borderRadius: 4 }}>
          <div className="eyebrow">Ideal-gas doubling (V → 2V)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 6 }}>
            <Stat label="ΔS so far (J/K)" value={dS_ideal.toExponential(2)} accent="var(--phos)" />
            <Stat label="ΔS molar (J/mol·K)" value={dS_molar.toFixed(2)} accent="var(--phos)" />
          </div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--paper-dim)', marginTop: 6 }}>
            ΔS = N·k·ln(V₂/V₁) = nR·ln 2 = {(R * Math.log(2)).toFixed(3)} J/mol·K
          </div>
        </div>
        <ConvergenceChart tL={series.tL} tR={series.tR} N={N} />
      </Panel>
    </div>
  );
}

function ConvergenceChart({ tL, tR, N }: { tL: number[]; tR: number[]; N: number }) {
  const w = 320, h = 90;
  const len = Math.max(tL.length, 1);
  const path = (arr: number[], color: string) => {
    if (!arr.length) return null;
    const d = arr.map((v, i) => `${i === 0 ? 'M' : 'L'} ${(i / (len - 1 || 1)) * w} ${h - (v / N) * h}`).join(' ');
    return <path d={d} fill="none" stroke={color} strokeWidth="1.5" />;
  };
  return (
    <div style={{ marginTop: 'auto' }}>
      <div className="eyebrow" style={{ marginBottom: 4 }}>Particles per side · time →</div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 100, display: 'block' }}>
        <line x1="0" y1={h / 2} x2={w} y2={h / 2} stroke="rgba(245,241,232,0.18)" strokeDasharray="3 3" />
        <text x="2" y={h / 2 - 2} fontFamily="JetBrains Mono" fontSize="8" fill="rgba(245,241,232,0.5)">N/2</text>
        {path(tL, COLOR_A)}
        {path(tR, '#c9b3ff')}
      </svg>
      <div className="mono" style={{ fontSize: 10, color: 'var(--paper-dim)', display: 'flex', gap: 12 }}>
        <span style={{ color: COLOR_A }}>● left</span>
        <span style={{ color: '#c9b3ff' }}>● right</span>
      </div>
    </div>
  );
}

// ───── Mixing ─────

function Mixing() {
  const [N, setN] = useState(80);
  const [speed, setSpeed] = useState(1);
  const [open, setOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const initFn = useMemo(() => (w: number, h: number): Particle[] => {
    const ps: Particle[] = [];
    const half = Math.floor(N / 2);
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2;
      const left = i < half;
      ps.push({
        x: left ? 8 + Math.random() * (w / 2 - 16) : w / 2 + 8 + Math.random() * (w / 2 - 16),
        y: 8 + Math.random() * (h - 16),
        vx: Math.cos(a) * 1.4,
        vy: Math.sin(a) * 1.4,
        kind: left ? 0 : 1,
      });
    }
    return ps;
  }, [N]);

  const sim = useSim(canvasRef.current, {
    N, speed, initFn, partitionOpen: open, midlineMode: 'wall',
    drawKindColor: (k) => k === 0 ? COLOR_A : COLOR_B,
  });

  // mole fractions over whole box
  const nA = Math.floor(N / 2), nB = N - nA;
  const xA = nA / N, xB = nB / N;
  const dS_mix_molar = open ? -R * (xA * Math.log(xA) + xB * Math.log(xB)) : 0;
  const dS_mix_total = dS_mix_molar * (N / NA);

  const d = sim.distRef.current;
  const leftFracA = (d.leftA + d.leftB) > 0 ? d.leftA / (d.leftA + d.leftB) : 0;
  const rightFracA = (d.rightA + d.rightB) > 0 ? d.rightA / (d.rightA + d.rightB) : 0;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
      <Panel>
        <PanelHeader title="Two-gas mixing" right={open ? 'mixing' : 'separated'} />
        <div style={{ position: 'relative', flex: 1, minHeight: 280 }}>
          <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', borderRadius: 4 }} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <ActionBtn primary={!open} onClick={() => setOpen(true)} disabled={open}>↗ Remove partition</ActionBtn>
          <ActionBtn onClick={() => { setOpen(false); const c = N; setN(c === 80 ? 81 : 80); setTimeout(() => setN(c), 0); }}>↺ Reset</ActionBtn>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
          <Slider label="N · total particles" value={N} min={20} max={200} step={2} accent={COLOR_A}
            onChange={(v) => { setN(v); setOpen(false); }} />
          <Slider label="Speed" value={speed} min={0.2} max={3} step={0.1} accent="var(--phos)" onChange={setSpeed} />
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Entropy of mixing" />
        <Equation>ΔS<sub>mix</sub> = −R · (x<sub>A</sub> ln x<sub>A</sub> + x<sub>B</sub> ln x<sub>B</sub>)</Equation>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Stat label="x_A (blue)" value={xA.toFixed(3)} accent={COLOR_A} />
          <Stat label="x_B (red)" value={xB.toFixed(3)} accent={COLOR_B} />
          <Stat label="ΔS (J/mol·K)" value={dS_mix_molar.toFixed(3)} accent="var(--phos)" />
          <Stat label="ΔS (J/K, this box)" value={dS_mix_total.toExponential(2)} />
        </div>
        <div style={{ marginTop: 10, padding: 12, background: 'var(--ink-2)', borderRadius: 4 }}>
          <div className="eyebrow">Live composition by side</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
            <CompositionBar label="Left chamber" fracA={leftFracA} />
            <CompositionBar label="Right chamber" fracA={rightFracA} />
          </div>
        </div>
        <div className="mono" style={{ fontSize: 10, color: 'var(--paper-dim)', marginTop: 'auto' }}>
          Equimolar mix maximizes ΔS<sub>mix</sub> = R ln 2 ≈ 5.76 J/mol·K.
        </div>
      </Panel>
    </div>
  );
}

function CompositionBar({ label, fracA }: { label: string; fracA: number }) {
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 4 }}>{label}</div>
      <div style={{ height: 16, background: COLOR_A, borderRadius: 3, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${fracA * 100}%`, background: COLOR_B }} />
      </div>
      <div className="mono" style={{ fontSize: 10, color: 'var(--paper-dim)', marginTop: 4 }}>
        {(fracA * 100).toFixed(0)}% red · {((1 - fracA) * 100).toFixed(0)}% blue
      </div>
    </div>
  );
}

// ───── Heat flow ─────

function HeatFlow() {
  const [N, setN] = useState(80);
  const [speed, setSpeed] = useState(1);
  const [Thot, setThot] = useState(600);
  const [Tcold, setTcold] = useState(200);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tick, setTick] = useState(0);

  // initial speeds proportional to √T (left = hot, right = cold)
  const initFn = useMemo(() => (w: number, h: number): Particle[] => {
    const ps: Particle[] = [];
    const vH = 0.6 * Math.sqrt(Thot / 300);
    const vC = 0.6 * Math.sqrt(Tcold / 300);
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2;
      const left = i < N / 2;
      const v = left ? vH : vC;
      ps.push({
        x: left ? 8 + Math.random() * (w / 2 - 16) : w / 2 + 8 + Math.random() * (w / 2 - 16),
        y: 8 + Math.random() * (h - 16),
        vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        kind: left ? 0 : 1,
      });
    }
    return ps;
  }, [N, Thot, Tcold]);

  // For heat flow we use 'porous' midline (always open, but we visually mark it).
  // We do NOT classify by kind for confinement, only for color tracking.
  const sim = useSim(canvasRef.current, {
    N, speed, initFn, partitionOpen: true, midlineMode: 'porous',
    drawKindColor: (k) => k === 0 ? COLOR_HOT : COLOR_COLD,
  });

  useEffect(() => { const iv = setInterval(() => setTick(t => t + 1), 200); return () => clearInterval(iv); }, []);

  // Compute live "temperature" of each side from average KE
  const { Tl, Tr } = useMemo(() => {
    const ps = sim.psRef.current;
    let nl = 0, nr = 0, kel = 0, ker = 0;
    const xMidPx = canvasRef.current ? canvasRef.current.width / 2 : 0;
    for (const p of ps) {
      const ke = p.vx * p.vx + p.vy * p.vy;
      if (p.x < xMidPx) { nl++; kel += ke; } else { nr++; ker += ke; }
    }
    const avgL = nl > 0 ? kel / nl : 0;
    const avgR = nr > 0 ? ker / nr : 0;
    // map avg(v²) back to T: v ∝ √T  =>  T ∝ v² ; calibrate via initial T=300 -> v=0.6 -> v² = 0.36
    const Tl = avgL * 300 / 0.36;
    const Tr = avgR * 300 / 0.36;
    return { Tl, Tr };
  }, [tick, sim]);

  // Heat transferred so far (rough): q ≈ (3/2) n k (Tl_init - Tl_now) using kind 0 count
  const qApprox = (3 / 2) * (N / 2) * k_B * Math.max(0, Thot - Tl);
  const Tcold_K = Math.max(1, Tcold);
  const Thot_K = Math.max(1, Thot);
  const dS_universe = qApprox * (1 / Tcold_K - 1 / Thot_K);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
      <Panel>
        <PanelHeader title="Heat flow · hot ↔ cold" right={`T_hot ≈ ${Tl.toFixed(0)} K · T_cold ≈ ${Tr.toFixed(0)} K`} />
        <div style={{ position: 'relative', flex: 1, minHeight: 280 }}>
          <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', borderRadius: 4 }} />
          <div style={{ position: 'absolute', top: 8, left: 12, right: 12, display: 'flex', justifyContent: 'space-between', pointerEvents: 'none' }}>
            <span className="mono" style={{ fontSize: 10, color: COLOR_HOT, letterSpacing: '0.14em' }}>HOT · {Thot} K</span>
            <span className="mono" style={{ fontSize: 10, color: COLOR_COLD, letterSpacing: '0.14em' }}>COLD · {Tcold} K</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <ActionBtn primary onClick={() => { const c = N; setN(c === 80 ? 81 : 80); setTimeout(() => setN(c), 0); }}>↺ Restart</ActionBtn>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
          <Slider label="T_hot (K)" value={Thot} min={300} max={1200} step={10} accent={COLOR_HOT} onChange={setThot} />
          <Slider label="T_cold (K)" value={Tcold} min={50} max={500} step={10} accent={COLOR_COLD} onChange={setTcold} />
          <Slider label="N · particles" value={N} min={20} max={200} step={2} accent={COLOR_A} onChange={setN} />
          <Slider label="Speed" value={speed} min={0.2} max={3} step={0.1} accent="var(--phos)" onChange={setSpeed} />
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Clausius · ΔS = q/T" />
        <Equation>ΔS<sub>univ</sub> = q · (1/T<sub>cold</sub> − 1/T<sub>hot</sub>) &gt; 0</Equation>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Stat label="q transferred ≈" value={`${qApprox.toExponential(2)} J`} />
          <Stat label="ΔS_universe" value={`${dS_universe.toExponential(2)} J/K`} accent="var(--phos)" />
          <Stat label="T_hot now" value={`${Tl.toFixed(0)} K`} accent={COLOR_HOT} />
          <Stat label="T_cold now" value={`${Tr.toFixed(0)} K`} accent={COLOR_COLD} />
        </div>
        <div style={{ marginTop: 10, padding: 12, background: 'var(--ink-2)', borderRadius: 4 }}>
          <div className="eyebrow">Why only hot → cold?</div>
          <div style={{ fontSize: 12, color: 'var(--paper-dim)', lineHeight: 1.55, marginTop: 6 }}>
            A unit of heat q at high T removes less entropy from the source than it gives the cold sink (1/T<sub>cold</sub> &gt; 1/T<sub>hot</sub>). The reverse would lower S — forbidden.
          </div>
        </div>
        <TempBars Tl={Tl} Tr={Tr} Tinit={(Thot + Tcold) / 2} />
      </Panel>
    </div>
  );
}

function TempBars({ Tl, Tr, Tinit }: { Tl: number; Tr: number; Tinit: number }) {
  const max = Math.max(Tl, Tr, Tinit, 1) * 1.1;
  return (
    <div style={{ marginTop: 'auto' }}>
      <div className="eyebrow" style={{ marginBottom: 6 }}>Temperatures equalize</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'end', height: 80 }}>
        {[
          { l: 'Hot side', v: Tl, c: COLOR_HOT },
          { l: 'Cold side', v: Tr, c: COLOR_COLD },
        ].map(b => (
          <div key={b.l} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ width: '60%', height: (b.v / max) * 70, background: b.c, borderRadius: 3, transition: 'height 200ms' }} />
            <div className="mono" style={{ fontSize: 10, color: b.c }}>{b.v.toFixed(0)} K</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ───── Phase change ─────

function PhaseChange() {
  // Standard molar entropy values for water (J/mol·K)
  // S°(ice, 273 K) ≈ 41 ; S°(liquid, 298 K) ≈ 69.95 ; S°(vapor, 373 K) ≈ 188.83
  const S_solid = 41;
  const S_liquid = 69.95;
  const S_gas = 188.83;
  const dS_fus = (333.55e3) / 273.15; // ΔH_fus ≈ 6.01 kJ/mol → /T = 22.0 J/mol·K
  const dS_vap = (40.65e3) / 373.15;  // ΔH_vap ≈ 40.65 kJ/mol → /T = 109.0 J/mol·K
  const max = S_gas * 1.1;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
      <Panel>
        <PanelHeader title="H₂O · standard molar entropy" right="bigger volume → bigger S" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, alignItems: 'end', height: 320, padding: '20px 0' }}>
          {[
            { phase: 'Solid (ice)', S: S_solid, c: '#9bd5ff', desc: 'Lattice — fixed positions' },
            { phase: 'Liquid', S: S_liquid, c: COLOR_A, desc: 'Free to slide past one another' },
            { phase: 'Gas (steam)', S: S_gas, c: COLOR_HOT, desc: 'Translational chaos · huge V' },
          ].map(p => (
            <div key={p.phase} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
              <PhaseGlyph phase={p.phase} color={p.c} />
              <div style={{
                width: '70%', height: (p.S / max) * 200,
                background: `linear-gradient(180deg, ${p.c}cc 0%, ${p.c}66 100%)`,
                borderTop: `2px solid ${p.c}`, borderRadius: 3,
              }} />
              <div className="mono" style={{ fontSize: 11, color: p.c }}>S° = {p.S.toFixed(2)}</div>
              <div className="mono" style={{ fontSize: 9, color: 'var(--paper-dim)' }}>J/mol·K</div>
              <div className="serif" style={{ fontSize: 13, fontStyle: 'italic' }}>{p.phase}</div>
              <div style={{ fontSize: 10, color: 'var(--paper-dim)', textAlign: 'center' }}>{p.desc}</div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Phase-transition ΔS" />
        <Equation>ΔS = ΔH<sub>trans</sub> / T</Equation>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Stat label="ΔS_fusion (273 K)" value={`+${dS_fus.toFixed(1)} J/mol·K`} accent="#9bd5ff" />
          <Stat label="ΔS_vaporization (373 K)" value={`+${dS_vap.toFixed(1)} J/mol·K`} accent={COLOR_HOT} />
          <Stat label="ΔH_fus" value="6.01 kJ/mol" />
          <Stat label="ΔH_vap" value="40.65 kJ/mol" />
        </div>
        <div style={{ marginTop: 10, padding: 12, background: 'var(--ink-2)', borderRadius: 4 }}>
          <div className="eyebrow">Trend</div>
          <div className="serif" style={{ fontSize: 18, fontStyle: 'italic', marginTop: 4 }}>
            S<sub>solid</sub> &lt; S<sub>liquid</sub> ≪ S<sub>gas</sub>
          </div>
          <div style={{ fontSize: 12, color: 'var(--paper-dim)', marginTop: 6, lineHeight: 1.55 }}>
            Vaporization unlocks ~5× more positional freedom than fusion — molecules gain a ~1000× volume jump, so ΔS_vap ≫ ΔS_fus.
          </div>
        </div>
        <div className="mono" style={{ fontSize: 10, color: 'var(--paper-dim)', marginTop: 'auto' }}>
          Source: NIST standard molar entropies of H₂O at 1 atm.
        </div>
      </Panel>
    </div>
  );
}

function PhaseGlyph({ phase, color }: { phase: string; color: string }) {
  const dots = phase.startsWith('Solid')
    ? Array.from({ length: 9 }, (_, i) => ({ x: (i % 3) * 14 + 6, y: Math.floor(i / 3) * 14 + 6 }))
    : phase.startsWith('Liquid')
    ? Array.from({ length: 9 }, (_, i) => ({ x: (i % 3) * 14 + 6 + (i * 13) % 5, y: Math.floor(i / 3) * 14 + 8 + (i * 7) % 4 }))
    : Array.from({ length: 9 }, (_, i) => ({ x: ((i * 31) % 40) + 4, y: ((i * 17) % 36) + 4 }));
  return (
    <svg viewBox="0 0 50 50" style={{ width: 60, height: 60 }}>
      <rect x="0.5" y="0.5" width="49" height="49" fill="rgba(0,0,0,0.3)" stroke="rgba(245,241,232,0.2)" />
      {dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r="2.6" fill={color} />)}
    </svg>
  );
}

// ───── shared UI atoms ─────

function ModeTabs({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  return (
    <SlideTabs<Mode>
      tabs={[
        { id: 'expansion', label: 'Gas expansion' },
        { id: 'mixing', label: 'Mixing' },
        { id: 'heat', label: 'Heat flow' },
        { id: 'phase', label: 'Phase change ΔS' },
      ]}
      value={mode}
      onChange={setMode}
    />
  );
}

function SecondLawBanner() {
  return (
    <div style={{
      padding: '10px 16px', border: '1px solid var(--phos)', background: 'rgba(122,224,166,0.08)',
      borderRadius: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
    }}>
      <span className="eyebrow" style={{ color: 'var(--phos)' }}>2nd Law of Thermodynamics</span>
      <span className="serif" style={{ fontSize: 16, fontStyle: 'italic' }}>
        ΔS<sub>universe</sub> &gt; 0 — disorder increases.
      </span>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--ink-1)', border: '1px solid var(--line)', borderRadius: 6, padding: 18,
      display: 'flex', flexDirection: 'column', gap: 10, minHeight: 480,
    }}>{children}</div>
  );
}

function PanelHeader({ title, right }: { title: string; right?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
      <span className="eyebrow">{title}</span>
      {right && <span className="mono" style={{ fontSize: 10, color: 'var(--paper-dim)' }}>{right}</span>}
    </div>
  );
}

function Equation({ children }: { children: React.ReactNode }) {
  return (
    <div className="serif" style={{ fontSize: 22, fontStyle: 'italic', padding: '6px 0' }}>{children}</div>
  );
}

function ActionBtn({ children, onClick, primary, disabled }: { children: React.ReactNode; onClick: () => void; primary?: boolean; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className="mono"
      style={{
        flex: 1, padding: '10px 12px', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase',
        border: '1px solid var(--line-strong)',
        background: primary && !disabled ? 'var(--phos)' : 'transparent',
        color: primary && !disabled ? 'var(--ink-0)' : (disabled ? 'var(--paper-faint)' : 'var(--paper)'),
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1,
      }}>{children}</button>
  );
}

function Slider({ label, value, min, max, step, onChange, accent }:
  { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; accent: string }) {
  return (
    <UISlider label={label} value={value} min={min} max={max} step={step}
              onChange={onChange} accent={accent}
              format={(v) => Number.isInteger(v) ? `${v}` : v.toFixed(2)} />
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 4 }}>{label}</div>
      <div className="serif" style={{ fontSize: 16, color: accent ?? 'var(--paper)' }}>{value}</div>
    </div>
  );
}

// ───── numeric helpers ─────

/** log of binomial coefficient via lgamma */
function lnBinomial(n: number, k: number): number {
  if (k < 0 || k > n) return -Infinity;
  return lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1);
}
function binomial(n: number, k: number): number {
  return Math.exp(lnBinomial(n, k));
}
// Stirling-ish lgamma (Lanczos approximation)
function lgamma(z: number): number {
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
  z -= 1;
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  let x = c[0];
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function fmtBig(n: number): string {
  if (!isFinite(n) || n <= 0) return '—';
  if (n < 1e6) return n.toFixed(0);
  return n.toExponential(2);
}
