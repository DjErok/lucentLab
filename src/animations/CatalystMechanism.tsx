import { useEffect, useMemo, useRef, useState } from 'react';
import UISlider from '../components/ui/Slider';

/**
 * Catalyst Mechanism — port of MW "Homogenous Catalysis".
 *
 * Two side-by-side reactors:
 *   • Uncatalysed:  A + B → AB  with high E_a, single hump.
 *   • Catalysed:    A + K → AK,  AK + B → ABK,  ABK → AB + K
 *                   double-hump but lower max barrier.
 *
 * Both panels share T. The animation tracks "products formed" so the user
 * sees the catalyst is faster (more products) and that K count is conserved.
 */

const N_PARTICLES = 30;
const E_A_UNCAT = 80;   // kJ/mol
const E_A_CAT_MAX = 35; // kJ/mol — peak of double hump

type Kind = 'A' | 'B' | 'K' | 'AK' | 'ABK' | 'AB';
type P = { kind: Kind; x: number; y: number; vx: number; vy: number };

export default function CatalystMechanism() {
  const [T, setT] = useState(400);
  const [productsUncat, setProductsUncat] = useState(0);
  const [productsCat, setProductsCat] = useState(0);
  const [kSeen, setKSeen] = useState(0);

  const uncatRef = useRef<P[]>([]);
  const catRef = useRef<P[]>([]);
  const c1Ref = useRef<HTMLCanvasElement | null>(null);
  const c2Ref = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);

  const reset = () => {
    uncatRef.current = seed(false);
    catRef.current = seed(true);
    setProductsUncat(0);
    setProductsCat(0);
    setKSeen(catRef.current.filter(p => p.kind === 'K').length);
  };
  useEffect(() => { reset(); }, []);

  useEffect(() => {
    const c1 = c1Ref.current!, c2 = c2Ref.current!;
    const ctx1 = c1.getContext('2d')!, ctx2 = c2.getContext('2d')!;
    const resize = () => {
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      for (const c of [c1, c2]) {
        c.width = c.clientWidth * dpr;
        c.height = c.clientHeight * dpr;
        c.getContext('2d')!.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(c1); ro.observe(c2);

    let frame = 0;
    const tick = () => {
      if (document.hidden) { rafRef.current = requestAnimationFrame(tick); return; }
      const dU = stepUncat(uncatRef.current, T);
      const dC = stepCat(catRef.current, T);
      if (dU) setProductsUncat(p => p + dU);
      if (dC) setProductsCat(p => p + dC);
      drawReactor(ctx1, c1, uncatRef.current, false);
      drawReactor(ctx2, c2, catRef.current, true);
      if ((++frame & 31) === 0) {
        setKSeen(catRef.current.filter(p => p.kind === 'K').length);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect(); };
  }, [T]);

  const arrhRatio = useMemo(() => {
    const R = 8.314e-3;
    return Math.exp((E_A_UNCAT - E_A_CAT_MAX) / (R * T));
  }, [T]);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'baseline', gap: 16, flexWrap: 'wrap',
      }}>
        <div className="serif" style={{ fontSize: 22, fontStyle: 'italic' }}>
          A + B → AB  ·  with vs without catalyst K
        </div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--paper-dim)' }}>
          k_cat / k_uncat ≈ {arrhRatio.toExponential(2)}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <ReactorPanel
          title="Uncatalyzed"
          subtitle={`E_a = ${E_A_UNCAT} kJ/mol  ·  single hump`}
          canvasRef={c1Ref}
          products={productsUncat}
          accent="var(--hot)"
        />
        <ReactorPanel
          title="Catalyzed (homogeneous)"
          subtitle={`E_a max = ${E_A_CAT_MAX} kJ/mol  ·  three steps`}
          canvasRef={c2Ref}
          products={productsCat}
          accent="var(--phos)"
        />
      </div>

      <div style={{
        background: 'var(--ink-1)', border: '1px solid var(--line)',
        borderRadius: 6, padding: 20, display: 'grid',
        gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'center',
      }}>
        <UISlider label="Temperature (K)" value={T} min={250} max={650} step={5}
                  onChange={setT} accent="var(--hot)" />
        <button onClick={reset} className="mono" style={{
          padding: '8px 14px', fontSize: 10, letterSpacing: '0.14em',
          textTransform: 'uppercase', border: '1px solid var(--line-strong)',
          background: 'transparent', color: 'var(--paper)', cursor: 'pointer',
        }}>■ reset</button>
      </div>

      <EnergyDiagram />

      <div className="mono" style={{ fontSize: 11, color: 'var(--paper-dim)', lineHeight: 1.5 }}>
        K (catalyst) count is conserved — currently {kSeen}. Catalyst lowers the activation
        energy without changing ΔH; both reactions still produce the same AB.
      </div>
    </div>
  );
}

function ReactorPanel({ title, subtitle, canvasRef, products, accent }: {
  title: string; subtitle: string;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  products: number; accent: string;
}) {
  return (
    <div style={{
      background: 'var(--ink-1)', border: '1px solid var(--line)',
      borderRadius: 6, padding: 18, position: 'relative', aspectRatio: '1.2 / 1',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div className="eyebrow">{title}</div>
        <div className="mono" style={{ fontSize: 10, color: accent }}>
          AB · {products}
        </div>
      </div>
      <div className="mono" style={{ fontSize: 10, color: 'var(--paper-dim)', marginTop: 2 }}>
        {subtitle}
      </div>
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute', inset: '60px 18px 18px',
          width: 'calc(100% - 36px)', height: 'calc(100% - 78px)', display: 'block',
        }}
      />
    </div>
  );
}

// ───── reactor logic ─────

function seed(catalyst: boolean): P[] {
  const out: P[] = [];
  for (let i = 0; i < N_PARTICLES; i++) {
    const kind: Kind = i % 2 === 0 ? 'A' : 'B';
    out.push(rand(kind));
  }
  if (catalyst) {
    for (let i = 0; i < 6; i++) out.push(rand('K'));
  }
  return out;
}

function rand(kind: Kind): P {
  const a = Math.random() * Math.PI * 2;
  const sp = 0.004;
  return {
    kind,
    x: 0.05 + Math.random() * 0.9,
    y: 0.05 + Math.random() * 0.9,
    vx: Math.cos(a) * sp,
    vy: Math.sin(a) * sp,
  };
}

function stepUncat(parts: P[], T: number): number {
  const R = 8.314e-3;
  const pReact = Math.exp(-E_A_UNCAT / (R * T));
  let products = 0;
  move(parts, T);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    if (p.kind !== 'A') continue;
    for (let j = parts.length - 1; j >= 0; j--) {
      if (i === j) continue;
      const q = parts[j];
      if (q.kind !== 'B') continue;
      const dx = q.x - p.x, dy = q.y - p.y;
      if (dx * dx + dy * dy < 0.0025) {
        if (Math.random() < pReact) {
          // Form AB; remove the two and respawn fresh A,B to keep box busy.
          parts.splice(Math.max(i, j), 1);
          parts.splice(Math.min(i, j), 1);
          parts.push(rand('A'));
          parts.push(rand('B'));
          products++;
        }
        break;
      }
    }
  }
  return products;
}

function stepCat(parts: P[], T: number): number {
  const R = 8.314e-3;
  // Each step has lower E_a; rate-limit by the maximum of the three.
  const pStep = Math.exp(-E_A_CAT_MAX / (R * T));
  let products = 0;
  move(parts, T);

  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    // Step 1: A + K → AK
    if (p.kind === 'A') {
      for (let j = parts.length - 1; j >= 0; j--) {
        if (i === j) continue;
        const q = parts[j];
        if (q.kind !== 'K') continue;
        const dx = q.x - p.x, dy = q.y - p.y;
        if (dx * dx + dy * dy < 0.0025) {
          if (Math.random() < pStep) {
            parts.splice(Math.max(i, j), 1);
            parts.splice(Math.min(i, j), 1);
            parts.push({ ...rand('AK') });
          }
          break;
        }
      }
    }
    // Step 2: AK + B → ABK
    if (p.kind === 'AK') {
      for (let j = parts.length - 1; j >= 0; j--) {
        if (i === j) continue;
        const q = parts[j];
        if (q.kind !== 'B') continue;
        const dx = q.x - p.x, dy = q.y - p.y;
        if (dx * dx + dy * dy < 0.0025) {
          if (Math.random() < pStep) {
            parts.splice(Math.max(i, j), 1);
            parts.splice(Math.min(i, j), 1);
            parts.push({ ...rand('ABK') });
          }
          break;
        }
      }
    }
    // Step 3: ABK → AB + K (unimolecular dissociation)
    if (p.kind === 'ABK') {
      if (Math.random() < pStep * 0.4) {
        // Replace ABK with K, add fresh A & B to keep concentrations high; products++.
        p.kind = 'K';
        parts.push(rand('A'));
        parts.push(rand('B'));
        products++;
      }
    }
  }
  return products;
}

function move(parts: P[], T: number) {
  const sp = 0.0028 + (T - 250) * 0.000007;
  for (const p of parts) {
    // Re-energise to T-correlated speed.
    const cur = Math.hypot(p.vx, p.vy) || 1;
    const f = sp / cur;
    p.vx *= f; p.vy *= f;
    p.x += p.vx;
    p.y += p.vy;
    const r = 0.025;
    if (p.x < r) { p.x = r; p.vx = -p.vx; }
    if (p.x > 1 - r) { p.x = 1 - r; p.vx = -p.vx; }
    if (p.y < r) { p.y = r; p.vy = -p.vy; }
    if (p.y > 1 - r) { p.y = 1 - r; p.vy = -p.vy; }
  }
}

function drawReactor(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, parts: P[], catalyst: boolean) {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = catalyst ? 'rgba(105,227,107,0.04)' : 'rgba(255,123,60,0.04)';
  ctx.fillRect(0, 0, w, h);
  for (const p of parts) {
    const x = p.x * w, y = p.y * h;
    const meta = META[p.kind];
    ctx.beginPath();
    ctx.arc(x, y, meta.r, 0, Math.PI * 2);
    ctx.fillStyle = meta.color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.stroke();
    ctx.fillStyle = '#0a0908';
    ctx.font = `600 ${meta.fs}px JetBrains Mono, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.kind, x, y + 0.5);
  }
}

const META: Record<Kind, { color: string; r: number; fs: number }> = {
  A:   { color: '#5dd0ff', r: 9,  fs: 9 },
  B:   { color: '#ff7a3c', r: 9,  fs: 9 },
  K:   { color: '#fbbf24', r: 8,  fs: 9 },
  AK:  { color: '#a78bfa', r: 11, fs: 8 },
  ABK: { color: '#f0abfc', r: 13, fs: 8 },
  AB:  { color: '#69e36b', r: 11, fs: 8 },
};

// ───── energy diagram ─────

function EnergyDiagram() {
  const W = 800, H = 220, padL = 50, padR = 16, padT = 18, padB = 28;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const xAt = (t: number) => padL + t * innerW;
  const yAt = (e: number) => padT + (1 - e / 100) * innerH;

  // Uncatalysed: smooth bump up to E_A_UNCAT and back down to ΔH = -20.
  const uncat = (t: number) => {
    if (t < 0.5) return Math.sin(t * Math.PI) * E_A_UNCAT;
    return Math.sin(t * Math.PI) * E_A_UNCAT + (t - 0.5) * 2 * -20;
  };
  // Catalysed: 3 humps, each ≤ E_A_CAT_MAX.
  const cat = (t: number) => {
    const seg = t * 3;
    const peakHeights = [E_A_CAT_MAX, E_A_CAT_MAX * 0.85, E_A_CAT_MAX * 0.9];
    const k = Math.min(2, Math.floor(seg));
    const sub = seg - k;
    return Math.sin(sub * Math.PI) * peakHeights[k] - 7 * k;
  };

  const path = (fn: (t: number) => number) => {
    const steps = 240;
    let d = '';
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      d += `${i === 0 ? 'M' : 'L'}${xAt(t).toFixed(1)},${yAt(fn(t)).toFixed(1)} `;
    }
    return d;
  };

  return (
    <div style={{
      background: 'var(--ink-1)', border: '1px solid var(--line)',
      borderRadius: 6, padding: 20,
    }}>
      <div className="eyebrow" style={{ marginBottom: 8 }}>Energy profile · uncatalyzed vs catalyzed</div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet"
           style={{ display: 'block', maxHeight: 260 }}>
        <line x1={padL} y1={yAt(0)} x2={W - padR} y2={yAt(0)}
              stroke="rgba(245,241,232,0.2)" strokeDasharray="2 4" />
        <path d={path(uncat)} fill="none" stroke="var(--hot)" strokeWidth={2} />
        <path d={path(cat)}   fill="none" stroke="var(--phos)" strokeWidth={2} />
        <text x={padL + 4} y={yAt(E_A_UNCAT) - 4}
              fontFamily="JetBrains Mono" fontSize={10} fill="var(--hot)">
          E_a = {E_A_UNCAT}
        </text>
        <text x={padL + 4} y={yAt(E_A_CAT_MAX) - 4}
              fontFamily="JetBrains Mono" fontSize={10} fill="var(--phos)">
          E_a (cat) = {E_A_CAT_MAX}
        </text>
        <text x={W / 2} y={H - 6} textAnchor="middle"
              fontFamily="JetBrains Mono" fontSize={10}
              fill="rgba(245,241,232,0.6)">reaction coordinate →</text>
      </svg>
    </div>
  );
}
