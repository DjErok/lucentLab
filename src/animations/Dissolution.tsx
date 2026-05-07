import { useEffect, useRef, useState } from 'react';

/**
 * Dissolution + Hydration Shell — port of MW "Dissolving Salt" and
 * "Formation of Water Shell Around Ions".
 *
 * Solid NaCl crystal at centre. Water dipoles approach, orient
 * (O end toward Na⁺, H end toward Cl⁻), then ions detach with a 6-water
 * hydration shell.
 */

const N_GRID = 4; // 4x4 ion grid
const ION_SPACING = 0.085; // crystal pitch in [0..1] coords

type Ion = {
  charge: 1 | -1;
  x: number; y: number;
  vx: number; vy: number;
  state: 'lattice' | 'detaching' | 'free';
  shell: number[]; // indices of water particles
};
type Water = {
  x: number; y: number;
  vx: number; vy: number;
  angle: number; // dipole angle (O→H midline)
  bound: number | null; // ion index if part of a shell
  bondAngle: number;     // angular offset around the bound ion
  bondR: number;         // radial distance
};

const N_WATER = 60;

export default function Dissolution() {
  const [running, setRunning] = useState(false);
  const ionsRef = useRef<Ion[]>([]);
  const watersRef = useRef<Water[]>([]);
  const [tick, setTick] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);

  const reset = () => {
    const ions: Ion[] = [];
    const cx = 0.5, cy = 0.5;
    for (let i = 0; i < N_GRID; i++) for (let j = 0; j < N_GRID; j++) {
      ions.push({
        charge: ((i + j) % 2 === 0 ? 1 : -1),
        x: cx + (i - (N_GRID - 1) / 2) * ION_SPACING,
        y: cy + (j - (N_GRID - 1) / 2) * ION_SPACING,
        vx: 0, vy: 0,
        state: 'lattice',
        shell: [],
      });
    }
    ionsRef.current = ions;
    const waters: Water[] = [];
    for (let k = 0; k < N_WATER; k++) {
      const a = Math.random() * Math.PI * 2;
      waters.push({
        x: 0.5 + Math.cos(a) * (0.42 + Math.random() * 0.06),
        y: 0.5 + Math.sin(a) * (0.42 + Math.random() * 0.06),
        vx: 0, vy: 0,
        angle: Math.random() * Math.PI * 2,
        bound: null, bondAngle: 0, bondR: 0.05,
      });
    }
    watersRef.current = waters;
    setRunning(false);
    setTick(t => t + 1);
  };

  useEffect(() => { reset(); }, []);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const resize = () => {
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const tick = () => {
      if (document.hidden) { rafRef.current = requestAnimationFrame(tick); return; }
      step(ionsRef.current, watersRef.current, running);
      draw(ctx, canvas, ionsRef.current, watersRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect(); };
  }, [running, tick]);

  // Counters for readout.
  const inLattice = ionsRef.current.filter(i => i.state === 'lattice').length;
  const detaching = ionsRef.current.filter(i => i.state === 'detaching').length;
  const free      = ionsRef.current.filter(i => i.state === 'free').length;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'baseline', gap: 16, flexWrap: 'wrap',
      }}>
        <div className="serif" style={{ fontSize: 22, fontStyle: 'italic' }}>
          NaCl(s) <span style={{ color: 'var(--paper-dim)' }}>—H₂O→</span> Na⁺(aq) + Cl⁻(aq)
        </div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--paper-dim)' }}>
          ion–dipole forces &gt; lattice energy ⇒ dissolution
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        <div style={{
          background: 'var(--ink-1)', border: '1px solid var(--line)',
          borderRadius: 6, aspectRatio: '1 / 1', padding: 18, position: 'relative',
        }}>
          <div className="eyebrow">Beaker · NaCl + 60 H₂O</div>
          <canvas
            ref={canvasRef}
            style={{
              position: 'absolute', inset: '40px 18px 18px',
              width: 'calc(100% - 36px)', height: 'calc(100% - 58px)', display: 'block',
            }}
          />
        </div>

        <div style={{
          background: 'var(--ink-1)', border: '1px solid var(--line)',
          borderRadius: 6, padding: 20, display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div className="eyebrow">Ions</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <Stat label="in lattice" value={`${inLattice}`} accent="var(--paper)" />
            <Stat label="detaching"  value={`${detaching}`} accent="var(--hot)" />
            <Stat label="dissolved"  value={`${free}`}      accent="var(--phos)" />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setRunning(r => !r)} className="mono"
                    style={btnStyle('var(--phos)')}>
              {running ? '❚❚ pause' : '▶ dissolve'}
            </button>
            <button onClick={reset} className="mono" style={btnStyle('var(--line-strong)')}>
              ■ reset
            </button>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--line)' }} />

          <div className="mono" style={{
            fontSize: 11, color: 'var(--paper-dim)', lineHeight: 1.5,
          }}>
            Polar water molecules orient their <span style={{ color: '#5dd0ff' }}>partial-negative O</span>{' '}
            toward Na⁺ and their <span style={{ color: '#ff7a3c' }}>partial-positive H</span>{' '}
            toward Cl⁻. Once the ion–dipole attraction exceeds the cation–anion bond, the ion peels
            off with a hydration shell of ~6 waters and drifts away.
          </div>
        </div>
      </div>
    </div>
  );
}

function step(ions: Ion[], waters: Water[], running: boolean) {
  // 1. Water motion.
  for (let k = 0; k < waters.length; k++) {
    const w = waters[k];
    if (w.bound !== null) {
      const ion = ions[w.bound];
      if (!ion || ion.state === 'lattice') {
        w.bound = null;
      } else {
        // Orbit the ion.
        w.bondAngle += 0.04;
        w.x = ion.x + Math.cos(w.bondAngle) * w.bondR;
        w.y = ion.y + Math.sin(w.bondAngle) * w.bondR;
        w.angle = ion.charge > 0 ? w.bondAngle + Math.PI : w.bondAngle;
        continue;
      }
    }
    w.x += w.vx;
    w.y += w.vy;
    w.vx *= 0.96; w.vy *= 0.96;
    w.vx += (Math.random() - 0.5) * 0.001;
    w.vy += (Math.random() - 0.5) * 0.001;

    // Drift toward nearest detaching/free ion.
    let bestI = -1, bestD = Infinity;
    for (let i = 0; i < ions.length; i++) {
      const ion = ions[i];
      if (ion.state === 'lattice') continue;
      const dx = ion.x - w.x, dy = ion.y - w.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD) { bestD = d2; bestI = i; }
    }
    if (bestI >= 0 && bestD < 0.06) {
      const ion = ions[bestI];
      const dx = ion.x - w.x, dy = ion.y - w.y;
      const d = Math.sqrt(bestD) || 1;
      w.vx += (dx / d) * 0.0015;
      w.vy += (dy / d) * 0.0015;
      // Snap into shell when close enough and shell has room.
      if (d < 0.05 && ion.shell.length < 6) {
        ion.shell.push(k);
        w.bound = bestI;
        w.bondR = 0.045;
        w.bondAngle = Math.atan2(dy, dx);
      }
    } else {
      // Orient toward nearest lattice ion to set up the dipole.
      let nx = -1, nd = Infinity;
      for (let i = 0; i < ions.length; i++) {
        const ion = ions[i];
        if (ion.state !== 'lattice') continue;
        const dx = ion.x - w.x, dy = ion.y - w.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < nd) { nd = d2; nx = i; }
      }
      if (nx >= 0) {
        const ion = ions[nx];
        const dx = ion.x - w.x, dy = ion.y - w.y;
        const target = ion.charge > 0 ? Math.atan2(dy, dx) + Math.PI : Math.atan2(dy, dx);
        const da = ((target - w.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        w.angle += da * 0.12;
      }
    }

    // Wall.
    const r = 0.025;
    if (w.x < r) { w.x = r; w.vx = -w.vx; }
    if (w.x > 1 - r) { w.x = 1 - r; w.vx = -w.vx; }
    if (w.y < r) { w.y = r; w.vy = -w.vy; }
    if (w.y > 1 - r) { w.y = 1 - r; w.vy = -w.vy; }
  }

  if (!running) return;

  // 2. Ion detachment from edges.
  for (let i = 0; i < ions.length; i++) {
    const ion = ions[i];
    if (ion.state !== 'lattice') {
      // Move free / detaching ions outward.
      ion.x += ion.vx;
      ion.y += ion.vy;
      ion.vx *= 0.992; ion.vy *= 0.992;
      const r = 0.03;
      if (ion.x < r) { ion.x = r; ion.vx = -ion.vx; }
      if (ion.x > 1 - r) { ion.x = 1 - r; ion.vx = -ion.vx; }
      if (ion.y < r) { ion.y = r; ion.vy = -ion.vy; }
      if (ion.y > 1 - r) { ion.y = 1 - r; ion.vy = -ion.vy; }
      if (ion.state === 'detaching') {
        const dx = ion.x - 0.5, dy = ion.y - 0.5;
        if (Math.hypot(dx, dy) > 0.32) ion.state = 'free';
      }
      continue;
    }
    // Edge ion check: missing same-charge or opposite neighbours = exposed.
    const isEdge = ion.x < 0.5 - 1.5 * ION_SPACING || ion.x > 0.5 + 1.5 * ION_SPACING ||
                   ion.y < 0.5 - 1.5 * ION_SPACING || ion.y > 0.5 + 1.5 * ION_SPACING;
    if (isEdge && Math.random() < 0.0025) {
      ion.state = 'detaching';
      const a = Math.atan2(ion.y - 0.5, ion.x - 0.5);
      ion.vx = Math.cos(a) * 0.003;
      ion.vy = Math.sin(a) * 0.003;
    }
  }
}

function draw(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, ions: Ion[], waters: Water[]) {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(120, 180, 220, 0.05)';
  ctx.fillRect(0, 0, w, h);

  // Waters as bent triangles with dipole arrow.
  for (const wm of waters) {
    const x = wm.x * w, y = wm.y * h;
    const len = 14;
    const ax = Math.cos(wm.angle), ay = Math.sin(wm.angle);
    // O end (red, partial-)
    ctx.beginPath();
    ctx.arc(x - ax * len * 0.35, y - ay * len * 0.35, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#5dd0ff';
    ctx.fill();
    // H ends (orange, partial+) — two H's at ±104.5° / 2.
    const half = 0.911; // half of H–O–H angle in rad
    for (const sign of [-1, 1]) {
      const ang = wm.angle + Math.PI + sign * half;
      const hx = x - ax * len * 0.35 + Math.cos(ang) * len * 0.55;
      const hy = y - ay * len * 0.35 + Math.sin(ang) * len * 0.55;
      ctx.beginPath();
      ctx.arc(hx, hy, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#ff7a3c';
      ctx.fill();
    }
  }

  // Ions.
  for (const ion of ions) {
    const x = ion.x * w, y = ion.y * h;
    const isCation = ion.charge > 0;
    ctx.beginPath();
    ctx.arc(x, y, isCation ? 9 : 13, 0, Math.PI * 2);
    ctx.fillStyle = isCation ? '#ff7a3c' : '#5dd0ff';
    ctx.fill();
    ctx.strokeStyle = ion.state === 'lattice'
      ? 'rgba(0,0,0,0.45)'
      : 'rgba(255,255,255,0.85)';
    ctx.lineWidth = ion.state === 'lattice' ? 1 : 2;
    ctx.stroke();
    ctx.fillStyle = '#0a0908';
    ctx.font = '600 9px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isCation ? 'Na⁺' : 'Cl⁻', x, y + 0.5);
  }
}

function btnStyle(accent: string) {
  return {
    flex: 1, padding: '8px 10px', fontSize: 10, letterSpacing: '0.14em',
    textTransform: 'uppercase' as const, border: `1px solid ${accent}`,
    background: 'transparent', color: 'var(--paper)', cursor: 'pointer',
  };
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 4 }}>{label}</div>
      <div className="serif" style={{ fontSize: 24, color: accent ?? 'var(--paper)' }}>{value}</div>
    </div>
  );
}
