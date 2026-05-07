import { useEffect, useMemo, useRef, useState } from 'react';
import UISlider from '../components/ui/Slider';
import SlideTabs from '../components/ui/SlideTabs';

/**
 * Maxwell-Boltzmann speed distribution — port of the Concord
 * Molecular Workbench "Maxwell Speed Distribution Law" simulation.
 *
 * Box of N particles with elastic wall collisions; live histogram of |v|.
 * Temperature slider rescales speeds (v ∝ √T). Three reference speeds:
 *   v_p   = √(2 k T / m)        most probable
 *   v_avg = √(8 k T / π m)
 *   v_rms = √(3 k T / m)
 */

type GasId = 'he' | 'n2' | 'co2' | 'xe';
type Gas = { id: GasId; label: string; M: number; color: string };
const GASES: Gas[] = [
  { id: 'he',  label: 'He · 4',    M: 4,    color: '#5dd0ff' },
  { id: 'n2',  label: 'N₂ · 28',   M: 28,   color: '#69e36b' },
  { id: 'co2', label: 'CO₂ · 44',  M: 44,   color: '#fbbf24' },
  { id: 'xe',  label: 'Xe · 131',  M: 131,  color: '#ff7a3c' },
];

const N = 80;
const BINS = 28;
const V_MAX = 0.022; // canvas-space speed cap

type P = { x: number; y: number; vx: number; vy: number };

export default function MaxwellBoltzmann() {
  const [gasId, setGasId] = useState<GasId>('n2');
  const gas = GASES.find(g => g.id === gasId)!;
  const [T, setT] = useState(300);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const histCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<P[]>([]);
  const rafRef = useRef<number>(0);

  // (Re)seed when gas / T changes substantially.
  useEffect(() => {
    // Target speed scale ∝ √(T / M).
    const scale = Math.sqrt(T / 300) * Math.sqrt(28 / gas.M) * 0.008;
    const list: P[] = [];
    for (let i = 0; i < N; i++) {
      // Box-Muller-ish: Gaussian in vx,vy → Maxwell speed.
      const u1 = Math.random() || 1e-6;
      const u2 = Math.random();
      const r = Math.sqrt(-2 * Math.log(u1)) * scale;
      const theta = 2 * Math.PI * u2;
      list.push({
        x: 0.05 + Math.random() * 0.9,
        y: 0.05 + Math.random() * 0.9,
        vx: r * Math.cos(theta),
        vy: r * Math.sin(theta),
      });
    }
    particlesRef.current = list;
  }, [gasId, T]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const histCanvas = histCanvasRef.current!;
    const hctx = histCanvas.getContext('2d')!;

    const resize = () => {
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      for (const c of [canvas, histCanvas]) {
        c.width = c.clientWidth * dpr;
        c.height = c.clientHeight * dpr;
        c.getContext('2d')!.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    ro.observe(histCanvas);

    const tick = () => {
      if (document.hidden) { rafRef.current = requestAnimationFrame(tick); return; }
      step(particlesRef.current);
      drawBox(ctx, canvas, particlesRef.current, gas.color);
      drawHistogram(hctx, histCanvas, particlesRef.current, gas.color);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect(); };
  }, [gas.color]);

  const stats = useMemo(() => {
    // Theoretical reference speeds in m/s using SI.
    const k = 1.380649e-23;
    const m = gas.M * 1.66054e-27;
    const vp   = Math.sqrt(2 * k * T / m);
    const vavg = Math.sqrt(8 * k * T / (Math.PI * m));
    const vrms = Math.sqrt(3 * k * T / m);
    return { vp, vavg, vrms };
  }, [gas.M, T]);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <SlideTabs<GasId>
        tabs={GASES.map(g => ({ id: g.id, label: g.label, accent: g.color }))}
        value={gasId}
        onChange={setGasId}
      />

      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'baseline', gap: 16, flexWrap: 'wrap',
      }}>
        <div className="serif" style={{ fontSize: 22, fontStyle: 'italic' }}>
          f(v) = 4π · n · (m / 2πkT)<sup>3/2</sup> · v² · e<sup>−mv²/2kT</sup>
        </div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--paper-dim)' }}>
          v ∝ √(T / M)
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 16 }}>
        {/* Particle box */}
        <div style={{
          background: 'var(--ink-1)', border: '1px solid var(--line)',
          borderRadius: 6, aspectRatio: '1 / 1', padding: 18, position: 'relative',
        }}>
          <div className="eyebrow">Box · N = {N}</div>
          <canvas
            ref={canvasRef}
            style={{
              position: 'absolute', inset: '40px 18px 18px',
              width: 'calc(100% - 36px)', height: 'calc(100% - 58px)', display: 'block',
            }}
          />
        </div>

        {/* Histogram */}
        <div style={{
          background: 'var(--ink-1)', border: '1px solid var(--line)',
          borderRadius: 6, padding: 18, display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div className="eyebrow">Speed distribution</div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--paper-dim)' }}>|v| (a.u.)</div>
          </div>
          <canvas ref={histCanvasRef} style={{ width: '100%', height: 240, display: 'block' }} />

          <UISlider
            label="Temperature (K)"
            value={T} min={50} max={1200} step={10}
            onChange={setT}
            accent={gas.color}
          />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            <Stat label="vₚ (most prob)" value={`${stats.vp.toFixed(0)} m/s`} accent={gas.color} />
            <Stat label="v̄ (mean)"     value={`${stats.vavg.toFixed(0)} m/s`} />
            <Stat label="v_rms"         value={`${stats.vrms.toFixed(0)} m/s`} />
          </div>
        </div>
      </div>
    </div>
  );
}

function step(particles: P[]) {
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    const r = 0.018;
    if (p.x < r) { p.x = r; p.vx = -p.vx; }
    if (p.x > 1 - r) { p.x = 1 - r; p.vx = -p.vx; }
    if (p.y < r) { p.y = r; p.vy = -p.vy; }
    if (p.y > 1 - r) { p.y = 1 - r; p.vy = -p.vy; }
  }
  // Cheap pairwise elastic collisions between random pairs (keeps distribution alive).
  for (let k = 0; k < 8; k++) {
    const i = (Math.random() * particles.length) | 0;
    const j = (Math.random() * particles.length) | 0;
    if (i === j) continue;
    const a = particles[i], b = particles[j];
    const dx = b.x - a.x, dy = b.y - a.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < 0.0016 && d2 > 1e-8) {
      const d = Math.sqrt(d2);
      const nx = dx / d, ny = dy / d;
      const dvx = b.vx - a.vx, dvy = b.vy - a.vy;
      const vn = dvx * nx + dvy * ny;
      if (vn < 0) {
        a.vx += vn * nx; a.vy += vn * ny;
        b.vx -= vn * nx; b.vy -= vn * ny;
      }
    }
  }
}

function drawBox(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, particles: P[], color: string) {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);
  for (const p of particles) {
    const speed = Math.hypot(p.vx, p.vy);
    const t = Math.min(1, speed / V_MAX);
    const x = p.x * w, y = p.y * h;
    ctx.beginPath();
    ctx.arc(x, y, 4 + t * 1.5, 0, Math.PI * 2);
    ctx.fillStyle = mix(color, '#ffffff', t * 0.6);
    ctx.fill();
  }
}

function drawHistogram(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, particles: P[], color: string) {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);
  const counts = new Array(BINS).fill(0);
  let maxSpeed = 1e-6;
  for (const p of particles) maxSpeed = Math.max(maxSpeed, Math.hypot(p.vx, p.vy));
  const cap = maxSpeed * 1.1;
  for (const p of particles) {
    const s = Math.hypot(p.vx, p.vy);
    const idx = Math.min(BINS - 1, ((s / cap) * BINS) | 0);
    counts[idx]++;
  }
  const maxCount = Math.max(...counts, 1);
  const padB = 18, padL = 28;
  const barW = (w - padL - 6) / BINS;
  ctx.font = '9px JetBrains Mono, monospace';
  ctx.fillStyle = 'rgba(245,241,232,0.5)';
  ctx.textAlign = 'right';
  for (let g = 0; g <= 4; g++) {
    const y = padB + (1 - g / 4) * (h - padB - 6);
    ctx.fillText(`${((g / 4) * maxCount) | 0}`, padL - 4, y + 3);
    ctx.strokeStyle = 'rgba(245,241,232,0.06)';
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - 6, y); ctx.stroke();
  }
  for (let i = 0; i < BINS; i++) {
    const frac = counts[i] / maxCount;
    const bh = frac * (h - padB - 6);
    ctx.fillStyle = color;
    ctx.fillRect(padL + i * barW + 1, h - padB - bh, barW - 2, bh);
  }
  // theoretical curve overlay
  ctx.strokeStyle = 'rgba(245,241,232,0.7)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  // f(v) ∝ v² exp(−v²/(2 σ²)) with σ chosen from observed.
  let mean2 = 0; for (const p of particles) mean2 += p.vx*p.vx + p.vy*p.vy;
  const sigma2 = Math.max(1e-10, mean2 / particles.length / 2);
  let peak = 0;
  for (let i = 0; i < BINS; i++) {
    const v = ((i + 0.5) / BINS) * cap;
    const f = v * v * Math.exp(-v * v / (2 * sigma2));
    peak = Math.max(peak, f);
  }
  for (let i = 0; i < BINS; i++) {
    const v = ((i + 0.5) / BINS) * cap;
    const f = v * v * Math.exp(-v * v / (2 * sigma2));
    const x = padL + i * barW + barW / 2;
    const y = h - padB - (f / peak) * (h - padB - 6);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function mix(a: string, b: string, t: number) {
  const pa = parse(a), pb = parse(b);
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return `rgb(${r},${g},${bl})`;
}
function parse(c: string): [number, number, number] {
  if (c.startsWith('#')) {
    const v = c.slice(1);
    return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
  }
  return [128, 128, 128];
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 4 }}>{label}</div>
      <div className="serif" style={{ fontSize: 16, color: accent ?? 'var(--paper)' }}>{value}</div>
    </div>
  );
}
