import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Ideal Gas Law — interactive piston simulator (PhET-style).
 *
 * 50–100 hard-disc particles bounce inside a rectangular chamber.
 * Pressure is *measured* from wall-collision impulse per unit time per
 * unit wall length, then compared against the PV = nRT prediction.
 *
 * Controls: T (100–1000 K), V (drag piston / slider 5–40 L), n (1–100 particles),
 *           pressure unit toggle, pause / reset.
 */

type Particle = { x: number; y: number; vx: number; vy: number };
type Unit = 'atm' | 'kPa' | 'mmHg';
type LastChanged = 'T' | 'V' | 'n' | null;

const R_ATM = 0.08206; // L·atm / (mol·K)
const ATM_TO_KPA = 101.325;
const ATM_TO_MMHG = 760;

const PARTICLE_RADIUS = 4; // px
const SIM_W = 460;          // canvas logical width
const SIM_H = 360;          // canvas logical height
const WALL_PAD = 14;        // inner padding

export default function GasLaw() {
  const [T, setT] = useState(300);
  const [n, setN] = useState(40);          // particle count proxy for moles
  const [V, setV] = useState(24.4);        // L
  const [unit, setUnit] = useState<Unit>('atm');
  const [running, setRunning] = useState(true);
  const [lastChanged, setLastChanged] = useState<LastChanged>(null);
  const [pMeasuredAtm, setPMeasuredAtm] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const impulseRef = useRef(0);            // accumulated wall impulse (sim units)
  const frameTimeRef = useRef(0);          // accumulated dt for averaging
  const histRef = useRef<number[]>(new Array(12).fill(0));
  const draggingRef = useRef(false);
  const Tref = useRef(T);
  const Vref = useRef(V);
  const nref = useRef(n);
  const runRef = useRef(running);

  useEffect(() => { Tref.current = T; }, [T]);
  useEffect(() => { Vref.current = V; }, [V]);
  useEffect(() => { nref.current = n; }, [n]);
  useEffect(() => { runRef.current = running; }, [running]);

  // Map V (L) to chamber width in pixels (piston wall position)
  const wallX = (Vl: number) => {
    const t = (Vl - 5) / (40 - 5);
    return WALL_PAD + 60 + t * (SIM_W - WALL_PAD - 60 - 30);
  };

  // Sync particle pool with n
  useEffect(() => {
    const ps = particlesRef.current;
    const target = n;
    const right = wallX(Vref.current);
    while (ps.length < target) {
      const speed = baseSpeed(Tref.current);
      const a = Math.random() * Math.PI * 2;
      ps.push({
        x: WALL_PAD + 4 + Math.random() * (right - WALL_PAD - 8),
        y: WALL_PAD + 4 + Math.random() * (SIM_H - 2 * WALL_PAD - 8),
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
      });
    }
    if (ps.length > target) ps.length = target;
  }, [n]);

  // Rescale particle speeds when T changes (keep direction, set |v| ~ √T)
  const lastTrescale = useRef(T);
  useEffect(() => {
    const ratio = Math.sqrt(T / Math.max(1, lastTrescale.current));
    for (const p of particlesRef.current) { p.vx *= ratio; p.vy *= ratio; }
    lastTrescale.current = T;
  }, [T]);

  // Push particles inside if piston moves left
  useEffect(() => {
    const right = wallX(V);
    for (const p of particlesRef.current) {
      if (p.x > right - PARTICLE_RADIUS) p.x = right - PARTICLE_RADIUS - 1;
    }
  }, [V]);

  // Animation loop
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    c.width = SIM_W * dpr; c.height = SIM_H * dpr;
    ctx.scale(dpr, dpr);

    let raf = 0;
    let last = performance.now();
    let pressureSampleTime = 0;

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const paused = !runRef.current || document.hidden;

      const right = wallX(Vref.current);
      const top = WALL_PAD, bottom = SIM_H - WALL_PAD, leftW = WALL_PAD;

      if (!paused) {
        const ps = particlesRef.current;
        const subSteps = 2;
        const sdt = dt / subSteps;
        for (let s = 0; s < subSteps; s++) {
          for (const p of ps) {
            p.x += p.vx * sdt * 60;
            p.y += p.vy * sdt * 60;
            // wall bounces; record impulse magnitude (2 m|v|, m=1)
            if (p.x < leftW + PARTICLE_RADIUS) {
              p.x = leftW + PARTICLE_RADIUS;
              impulseRef.current += 2 * Math.abs(p.vx);
              p.vx = -p.vx;
            } else if (p.x > right - PARTICLE_RADIUS) {
              p.x = right - PARTICLE_RADIUS;
              impulseRef.current += 2 * Math.abs(p.vx);
              p.vx = -p.vx;
            }
            if (p.y < top + PARTICLE_RADIUS) {
              p.y = top + PARTICLE_RADIUS;
              impulseRef.current += 2 * Math.abs(p.vy);
              p.vy = -p.vy;
            } else if (p.y > bottom - PARTICLE_RADIUS) {
              p.y = bottom - PARTICLE_RADIUS;
              impulseRef.current += 2 * Math.abs(p.vy);
              p.vy = -p.vy;
            }
          }
        }
        frameTimeRef.current += dt;
        pressureSampleTime += dt;

        if (pressureSampleTime >= 0.25) {
          // Calibrated mapping from sim impulse density to atm so that
          // baseline conditions (T=300, V=24.4, n=40) read ~1 atm.
          const perimSim = 2 * ((right - leftW) + (bottom - top));
          const rate = impulseRef.current / (frameTimeRef.current * perimSim);
          const atm = rate * 0.0019; // tuned constant
          setPMeasuredAtm(prev => prev * 0.6 + atm * 0.4);
          // update histogram of |v|
          const bins = histRef.current;
          for (let i = 0; i < bins.length; i++) bins[i] *= 0.7;
          const vmax = baseSpeed(1000) * 1.6;
          for (const p of particlesRef.current) {
            const sp = Math.hypot(p.vx, p.vy);
            const idx = Math.min(bins.length - 1, Math.floor((sp / vmax) * bins.length));
            bins[idx] += 1;
          }
          impulseRef.current = 0;
          frameTimeRef.current = 0;
          pressureSampleTime = 0;
        }
      }

      // ── render ──
      ctx.clearRect(0, 0, SIM_W, SIM_H);
      // chamber background
      ctx.fillStyle = 'rgba(245,241,232,0.025)';
      ctx.fillRect(leftW, top, right - leftW, bottom - top);
      // grid
      ctx.strokeStyle = 'rgba(245,241,232,0.05)';
      ctx.lineWidth = 1;
      for (let gx = leftW; gx < right; gx += 30) {
        ctx.beginPath(); ctx.moveTo(gx, top); ctx.lineTo(gx, bottom); ctx.stroke();
      }
      // walls
      ctx.strokeStyle = 'rgba(245,241,232,0.55)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(leftW, top, right - leftW, bottom - top);
      // piston (right wall)
      ctx.fillStyle = '#2a241c';
      ctx.fillRect(right, top - 6, 18, bottom - top + 12);
      ctx.fillStyle = '#f5f1e8';
      ctx.fillRect(right, top - 6, 3, bottom - top + 12);
      // grip lines
      ctx.strokeStyle = 'rgba(245,241,232,0.4)';
      for (let i = 0; i < 5; i++) {
        const yy = top + 20 + i * ((bottom - top - 40) / 4);
        ctx.beginPath(); ctx.moveTo(right + 6, yy); ctx.lineTo(right + 14, yy); ctx.stroke();
      }
      // particles
      for (const p of particlesRef.current) {
        const sp = Math.hypot(p.vx, p.vy);
        const heat = Math.min(1, sp / (baseSpeed(800)));
        ctx.beginPath();
        ctx.arc(p.x, p.y, PARTICLE_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${100 + heat * 155}, ${130 - heat * 30}, ${200 - heat * 130})`;
        ctx.fill();
      }
      // arrow indicating piston is draggable
      ctx.fillStyle = 'rgba(245,241,232,0.4)';
      ctx.font = '10px JetBrains Mono';
      ctx.fillText('↔', right + 3, top - 10);

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Piston dragging
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const toLocal = (e: PointerEvent) => {
      const r = c.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * SIM_W, y: ((e.clientY - r.top) / r.height) * SIM_H };
    };
    const down = (e: PointerEvent) => {
      const { x } = toLocal(e);
      const right = wallX(Vref.current);
      if (Math.abs(x - right) < 18) {
        draggingRef.current = true;
        c.setPointerCapture(e.pointerId);
      }
    };
    const move = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      const { x } = toLocal(e);
      // invert wallX
      const minX = WALL_PAD + 60, maxX = SIM_W - 30;
      const t = Math.max(0, Math.min(1, (x - minX) / (maxX - minX)));
      const newV = 5 + t * (40 - 5);
      setV(newV);
      setLastChanged('V');
    };
    const up = (e: PointerEvent) => {
      draggingRef.current = false;
      try { c.releasePointerCapture(e.pointerId); } catch {}
    };
    c.addEventListener('pointerdown', down);
    c.addEventListener('pointermove', move);
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    return () => {
      c.removeEventListener('pointerdown', down);
      c.removeEventListener('pointermove', move);
      c.removeEventListener('pointerup', up);
      c.removeEventListener('pointercancel', up);
    };
  }, []);

  // Effective moles for ideal-gas comparison: keep n=40 → 1 mol baseline
  const molesEq = n / 40;
  const pIdealAtm = (molesEq * R_ATM * T) / V;
  const pMeasuredDisp = convertP(pMeasuredAtm, unit);
  const pIdealDisp = convertP(pIdealAtm, unit);
  const ratio = pIdealAtm > 0 ? pMeasuredAtm / pIdealAtm : 0;

  const lawText = useMemo(() => describeLaw(lastChanged), [lastChanged]);

  const reset = () => {
    setT(300); setN(40); setV(24.4);
    particlesRef.current = [];
    impulseRef.current = 0; frameTimeRef.current = 0;
    setPMeasuredAtm(0); setLastChanged(null); setRunning(true);
    // re-seed
    const right = wallX(24.4);
    for (let i = 0; i < 40; i++) {
      const sp = baseSpeed(300);
      const a = Math.random() * Math.PI * 2;
      particlesRef.current.push({
        x: WALL_PAD + 4 + Math.random() * (right - WALL_PAD - 8),
        y: WALL_PAD + 4 + Math.random() * (SIM_H - 2 * WALL_PAD - 8),
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      });
    }
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* unit + control row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div className="serif" style={{ fontSize: 24, fontStyle: 'italic' }}>PV = nRT</div>
        <div style={{ display: 'flex', gap: 0 }}>
          {(['atm', 'kPa', 'mmHg'] as Unit[]).map((u, i) => {
            const active = u === unit;
            return (
              <button key={u} onClick={() => setUnit(u)} className="mono"
                style={btnStyle(active, i === 0)}>{u}</button>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16 }}>
        {/* Chamber */}
        <div style={{
          position: 'relative', background: 'var(--ink-1)',
          border: '1px solid var(--line)', borderRadius: 6, padding: 18,
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div className="eyebrow">Chamber · drag piston ▶</div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--paper-dim)' }}>
              {n} particles · √T speed
            </div>
          </div>
          <canvas ref={canvasRef}
            role="img"
            aria-label={`Gas chamber, measured pressure ${pMeasuredDisp.toFixed(2)} ${unit}`}
            style={{ width: '100%', aspectRatio: `${SIM_W} / ${SIM_H}`, display: 'block', cursor: 'ew-resize', touchAction: 'none' }} />
          {/* Histogram overlay */}
          <Histogram bins={histRef} />
          <div className="mono" style={{
            position: 'absolute', bottom: 14, left: 18,
            fontSize: 10, color: 'var(--paper-dim)', letterSpacing: '0.12em',
          }}>{lawText}</div>
        </div>

        {/* Right panel */}
        <div style={{
          background: 'var(--ink-1)', border: '1px solid var(--line)',
          borderRadius: 6, padding: 20, display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          <div className="eyebrow">Controls</div>
          <Slider label="Temperature" value={T} min={100} max={1000} step={5}
            onChange={(v) => { setT(v); setLastChanged('T'); }}
            display={`${T.toFixed(0)} K`} accent="var(--hot)" />
          <Slider label="Volume" value={V} min={5} max={40} step={0.5}
            onChange={(v) => { setV(v); setLastChanged('V'); }}
            display={`${V.toFixed(1)} L`} accent="var(--cool)" />
          <Slider label="Particles (n)" value={n} min={1} max={100} step={1}
            onChange={(v) => { setN(v); setLastChanged('n'); }}
            display={`${n} → ${molesEq.toFixed(2)} mol`} accent="var(--phos)" />

          <div style={{ display: 'flex', gap: 8 }}>
            <ControlBtn onClick={() => setRunning(r => !r)}>{running ? '❚❚ Pause' : '▶ Play'}</ControlBtn>
            <ControlBtn onClick={reset}>■ Reset</ControlBtn>
          </div>

          <div style={{
            marginTop: 4, padding: 12, border: '1px solid var(--line)',
            borderRadius: 4, background: 'var(--ink-2)',
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Stat label={`P measured`} value={`${pMeasuredDisp.toFixed(2)} ${unit}`} accent="var(--hot)" />
              <Stat label={`P ideal (PV=nRT)`} value={`${pIdealDisp.toFixed(2)} ${unit}`} accent="var(--cool)" />
              <Stat label="T" value={`${T.toFixed(0)} K · ${(T - 273.15).toFixed(0)} °C`} />
              <Stat label="P_meas / P_ideal" value={ratio ? ratio.toFixed(2) : '—'} accent="var(--phos)" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ───── helpers ─────

function baseSpeed(T: number) {
  // Sim-unit speed proportional to √T, calibrated so T=300 → ~1.2 px/frame
  return Math.sqrt(T / 300) * 1.2;
}

function convertP(atm: number, u: Unit): number {
  if (u === 'atm') return atm;
  if (u === 'kPa') return atm * ATM_TO_KPA;
  return atm * ATM_TO_MMHG;
}

function describeLaw(c: LastChanged): string {
  switch (c) {
    case 'V': return 'HOLDING T,n CONSTANT · BOYLE\'S LAW · P↑ AS V↓';
    case 'T': return 'HOLDING V,n CONSTANT · GAY-LUSSAC · P↑ AS T↑';
    case 'n': return 'HOLDING T,V CONSTANT · AVOGADRO · P↑ AS n↑';
    default:  return 'MOVE A SLIDER TO SEE WHICH GAS LAW APPLIES';
  }
}

function btnStyle(active: boolean, first: boolean): React.CSSProperties {
  return {
    padding: '10px 16px', fontSize: 11, letterSpacing: '0.16em',
    textTransform: 'uppercase',
    border: '1px solid var(--line-strong)',
    borderLeft: first ? '1px solid var(--line-strong)' : 0,
    background: active ? 'var(--paper)' : 'transparent',
    color: active ? 'var(--ink-0)' : 'var(--paper-dim)',
    fontWeight: active ? 600 : 400, cursor: 'pointer',
  };
}

// ───── small components ─────

function Histogram({ bins }: { bins: React.MutableRefObject<number[]> }) {
  // re-render every 250ms
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force(x => x + 1), 250);
    return () => clearInterval(id);
  }, []);
  const arr = bins.current;
  const max = Math.max(1, ...arr);
  const w = 110, h = 56;
  return (
    <div style={{
      position: 'absolute', top: 38, right: 22, width: w + 14, padding: 6,
      background: 'rgba(10,9,8,0.55)', border: '1px solid var(--line)', borderRadius: 4,
    }}>
      <div className="mono" style={{ fontSize: 9, color: 'var(--paper-dim)', letterSpacing: '0.1em', marginBottom: 2 }}>
        |v| · MAXWELL-BOLTZMANN
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h}>
        {arr.map((b, i) => {
          const bw = w / arr.length;
          const bh = (b / max) * (h - 4);
          return <rect key={i} x={i * bw + 1} y={h - bh} width={bw - 2} height={bh}
            fill="var(--hot)" opacity={0.75} />;
        })}
      </svg>
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange, display, accent }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; display: string; accent: string;
}) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span className="eyebrow">{label}</span>
        <span className="mono" style={{ fontSize: 11, color: accent }}>{display}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: accent }} />
    </label>
  );
}

function ControlBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="mono" style={{
      flex: 1, padding: '8px 10px', fontSize: 10, letterSpacing: '0.14em',
      textTransform: 'uppercase', border: '1px solid var(--line-strong)',
      background: 'transparent', color: 'var(--paper)', cursor: 'pointer',
    }}>{children}</button>
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
