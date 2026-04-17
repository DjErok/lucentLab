import { useEffect, useMemo, useRef, useState } from 'react';
import UISlider from '../components/ui/Slider';
import SlideTabs from '../components/ui/SlideTabs';

/**
 * Buffer — interactive simulation of how a conjugate weak-acid / weak-base
 * pair resists pH change.
 *
 *   pH = pKa + log10([A⁻] / [HA])      (Henderson–Hasselbalch)
 *
 * Add strong acid:  H⁺ + A⁻ → HA
 * Add strong base:  OH⁻ + HA → A⁻ + H₂O
 *
 * Compares the buffered pH against pure-water pH for the same dose.
 */

type PairId = 'acetic' | 'carbonic' | 'ammonium' | 'phosphate';
type Pair = { id: PairId; label: string; pKa: number; HA: string; A: string; note: string };

const PAIRS: Pair[] = [
  { id: 'acetic',    label: 'Acetic',    pKa: 4.76, HA: 'CH₃COOH',  A: 'CH₃COO⁻', note: 'Vinegar / acetate buffer' },
  { id: 'carbonic',  label: 'Carbonic',  pKa: 6.35, HA: 'H₂CO₃',    A: 'HCO₃⁻',  note: 'Blood plasma · pKa₁' },
  { id: 'phosphate', label: 'Phosphate', pKa: 7.20, HA: 'H₂PO₄⁻',   A: 'HPO₄²⁻', note: 'Cytosol · pKa₂' },
  { id: 'ammonium',  label: 'Ammonium',  pKa: 9.25, HA: 'NH₄⁺',     A: 'NH₃',    note: 'Ammonia buffer' },
];

const VOLUME_L = 1.0; // 1 L beaker — moles equal molarity numerically
const MAX_PARTICLES = 60;
const HISTORY_MAX = 60;

type ParticleType = 'HA' | 'A' | 'H' | 'OH';
type Particle = {
  type: ParticleType;
  x: number; y: number;
  vx: number; vy: number;
  life: number;          // frames since spawned (for dose visualization)
  target?: number;       // index of target particle for reactive ions
  reactingTimer?: number;// frames until reaction visualization completes
};

type Sample = { pH: number; pure: number };

export default function Buffer() {
  const [pairId, setPairId] = useState<PairId>('acetic');
  const pair = PAIRS.find(p => p.id === pairId)!;

  // Initial composition (moles, in 1 L → molarity)
  const [HA0, setHA0] = useState(10);
  const [A0,  setA0]  = useState(10);

  // Live state — moles HA / A⁻ after stress
  const [HA, setHA] = useState(10);
  const [A,  setA]  = useState(10);

  // Net strong-acid (positive) or strong-base (negative) dose, in moles, ever applied
  const [acidDose, setAcidDose] = useState(0);
  const [baseDose, setBaseDose] = useState(0);

  // History buffer for the rolling chart
  const histRef = useRef<Sample[]>([]);
  const [, forceTick] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);
  const lastReseedRef = useRef<{ HA: number; A: number }>({ HA: 10, A: 10 });

  // Reset when pair or initial composition changes
  useEffect(() => {
    setHA(HA0); setA(A0); setAcidDose(0); setBaseDose(0);
    histRef.current = [];
    seedParticles(particlesRef, HA0, A0);
    lastReseedRef.current = { HA: HA0, A: A0 };
  }, [pairId, HA0, A0]);

  // Push a baseline sample whenever HA / A change discretely
  useEffect(() => {
    const buf = HA > 0 && A > 0
      ? pair.pKa + Math.log10(A / HA)
      : (HA <= 0 ? 14 - Math.max(0, -Math.log10(Math.max(1e-12, A / VOLUME_L))) : Math.max(0, -Math.log10(Math.max(1e-12, HA / VOLUME_L))));
    const pure = purePH(acidDose, baseDose);
    histRef.current.push({ pH: clampPH(buf), pure: clampPH(pure) });
    if (histRef.current.length > HISTORY_MAX) histRef.current.shift();
    forceTick(t => t + 1);
  }, [HA, A, acidDose, baseDose, pair.pKa]);

  // Reconcile particle counts with logical HA / A counts (for slider changes).
  useEffect(() => {
    const last = lastReseedRef.current;
    if (Math.abs(last.HA - HA) > 6 || Math.abs(last.A - A) > 6) {
      seedParticles(particlesRef, HA, A);
      lastReseedRef.current = { HA, A };
    } else {
      reconcileParticles(particlesRef, HA, A);
      lastReseedRef.current = { HA, A };
    }
  }, [HA, A]);

  // Animation loop
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
      stepAndDraw(ctx, canvas, particlesRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect(); };
  }, []);

  // Stress actions
  const stress = (n: number, kind: 'acid' | 'base') => {
    if (kind === 'acid') {
      const consumed = Math.min(n, A);
      setA(v => Math.max(0, v - n));
      setHA(v => v + consumed);
      setAcidDose(d => d + n);
      spawnDroplets(particlesRef, n, 'H');
    } else {
      const consumed = Math.min(n, HA);
      setHA(v => Math.max(0, v - n));
      setA(v => v + consumed);
      setBaseDose(d => d + n);
      spawnDroplets(particlesRef, n, 'OH');
    }
  };

  const reset = () => {
    setHA(HA0); setA(A0); setAcidDose(0); setBaseDose(0);
    histRef.current = [];
    seedParticles(particlesRef, HA0, A0);
  };

  // Derived
  const pH = useMemo(() => {
    if (HA <= 0 && A <= 0) return 7;
    if (HA <= 0) return clampPH(14 + Math.log10(Math.max(1e-12, A / VOLUME_L)));
    if (A  <= 0) return clampPH(-Math.log10(Math.max(1e-12, HA / VOLUME_L)));
    return clampPH(pair.pKa + Math.log10(A / HA));
  }, [HA, A, pair.pKa]);

  const ratio = HA > 0 ? A / HA : Infinity;
  const capacity = Math.min(HA, A);
  const headroomAcid = A;          // moles strong acid still neutralizable

  const totalStress = acidDose + baseDose;
  const status: 'OK' | 'WEAK' | 'EXHAUSTED' =
    capacity <= 0 ? 'EXHAUSTED'
    : (capacity < Math.max(1, totalStress * 0.25)) ? 'WEAK'
    : 'OK';

  const statusColor = status === 'OK' ? 'var(--phos)' : status === 'WEAK' ? 'var(--hot)' : 'var(--acid)';

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Pair selector */}
      <SlideTabs<PairId>
        tabs={PAIRS.map(p => ({ id: p.id, label: `${p.label} · pKa ${p.pKa.toFixed(2)}` }))}
        value={pairId}
        onChange={setPairId}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
        <div className="serif" style={{ fontSize: 24, fontStyle: 'italic' }}>
          {pair.HA} <span style={{ color: 'var(--paper-dim)' }}>⇌</span> H⁺ + {pair.A}
        </div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--paper-dim)' }}>
          pH = pKa + log([A⁻]/[HA])  ·  {pair.note}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        {/* Beaker scene */}
        <div style={{
          background: 'var(--ink-1)',
          border: '1px solid var(--line)',
          borderRadius: 6,
          aspectRatio: '1.4 / 1',
          padding: 18,
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="eyebrow">Beaker · 1 L</div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--paper-dim)' }}>
              <span style={{ color: 'var(--hot)' }}>● HA {HA.toFixed(0)}</span>
              {'   '}
              <span style={{ color: 'var(--cool)' }}>● A⁻ {A.toFixed(0)}</span>
            </div>
          </div>
          <canvas
            ref={canvasRef}
            style={{ position: 'absolute', inset: '46px 18px 64px', width: 'calc(100% - 36px)', height: 'calc(100% - 110px)', display: 'block' }}
          />
          {/* Stress buttons */}
          <div style={{ position: 'absolute', bottom: 14, left: 18, right: 18, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            <StressBtn label="+1 H⁺" accent="var(--hot)" onClick={() => stress(1, 'acid')} />
            <StressBtn label="+5 H⁺" accent="var(--hot)" onClick={() => stress(5, 'acid')} />
            <StressBtn label="+1 OH⁻" accent="var(--cool)" onClick={() => stress(1, 'base')} />
            <StressBtn label="+5 OH⁻" accent="var(--cool)" onClick={() => stress(5, 'base')} />
          </div>
        </div>

        {/* Right column: composition + readouts */}
        <div style={{
          background: 'var(--ink-1)',
          border: '1px solid var(--line)',
          borderRadius: 6,
          padding: 20,
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div className="eyebrow">Initial composition</div>
            <span className="mono" style={{
              fontSize: 10, padding: '2px 8px', border: `1px solid ${statusColor}`,
              color: statusColor, letterSpacing: '0.14em',
            }}>{status}</span>
          </div>
          <Slider label="moles HA" value={HA0} onChange={setHA0} min={1} max={20} accent="var(--hot)" />
          <Slider label="moles A⁻" value={A0}  onChange={setA0}  min={1} max={20} accent="var(--cool)" />

          <div style={{
            padding: 12, background: 'var(--ink-2)', borderRadius: 4,
            border: `1px solid var(--line)`,
          }}>
            <div className="eyebrow">Live pH</div>
            <div className="serif" style={{ fontSize: 38, color: 'var(--phos)', lineHeight: 1.1 }}>
              {pH.toFixed(2)}
            </div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--paper-dim)' }}>
              ΔpH from pKa = {(pH - pair.pKa).toFixed(2)}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Stat label="[HA]" value={`${(HA / VOLUME_L).toFixed(2)} M`} accent="var(--hot)" />
            <Stat label="[A⁻]" value={`${(A / VOLUME_L).toFixed(2)} M`} accent="var(--cool)" />
            <Stat label="ratio A⁻/HA" value={isFinite(ratio) ? ratio.toFixed(2) : '∞'} />
            <Stat label="pKa" value={pair.pKa.toFixed(2)} />
            <Stat label="capacity (mol)" value={capacity.toFixed(0)} accent={statusColor} />
            <Stat label="acid headroom" value={`${headroomAcid.toFixed(0)} mol`} />
          </div>

          <button
            onClick={reset}
            className="mono"
            style={{
              marginTop: 4, padding: '8px 10px', fontSize: 10, letterSpacing: '0.14em',
              textTransform: 'uppercase', border: '1px solid var(--line-strong)',
              background: 'transparent', color: 'var(--paper)', cursor: 'pointer',
            }}
          >■ Reset</button>
        </div>
      </div>

      {/* Rolling pH chart */}
      <Chart
        history={histRef.current}
        pKa={pair.pKa}
        acidDose={acidDose}
        baseDose={baseDose}
      />
    </div>
  );
}

// ───── pH math ─────

function clampPH(v: number) { return Math.min(14, Math.max(0, v)); }

/** pH of pure water after net dose of strong acid (positive) / base (negative), in 1 L. */
function purePH(acid: number, base: number) {
  const net = acid - base; // positive = excess H⁺
  if (net > 0) return clampPH(-Math.log10(Math.max(1e-12, net / VOLUME_L)));
  if (net < 0) return clampPH(14 + Math.log10(Math.max(1e-12, -net / VOLUME_L)));
  return 7;
}

// ───── Particle scene ─────

function seedParticles(ref: React.MutableRefObject<Particle[]>, HA: number, A: number) {
  const total = Math.min(MAX_PARTICLES, Math.max(2, HA + A));
  const haN = Math.round(total * (HA / Math.max(1, HA + A)));
  const aN  = total - haN;
  const list: Particle[] = [];
  for (let i = 0; i < haN; i++) list.push(makeRandom('HA'));
  for (let i = 0; i < aN; i++)  list.push(makeRandom('A'));
  ref.current = list;
}

function reconcileParticles(ref: React.MutableRefObject<Particle[]>, HA: number, A: number) {
  // Adjust counts of HA / A particles to roughly match logical numbers,
  // capping at MAX_PARTICLES, leaving transient H⁺ / OH⁻ alone.
  const list = ref.current;
  const total = Math.min(MAX_PARTICLES, Math.max(2, HA + A));
  const desiredHA = Math.round(total * (HA / Math.max(1, HA + A)));
  const desiredA  = total - desiredHA;

  let curHA = list.filter(p => p.type === 'HA').length;
  let curA  = list.filter(p => p.type === 'A').length;

  // Remove from oversupplied
  for (let i = list.length - 1; i >= 0 && curHA > desiredHA; i--) {
    if (list[i].type === 'HA') { list.splice(i, 1); curHA--; }
  }
  for (let i = list.length - 1; i >= 0 && curA > desiredA; i--) {
    if (list[i].type === 'A')  { list.splice(i, 1); curA--; }
  }
  // Add when undersupplied
  while (curHA < desiredHA) { list.push(makeRandom('HA')); curHA++; }
  while (curA  < desiredA)  { list.push(makeRandom('A'));  curA++; }
}

function makeRandom(type: ParticleType): Particle {
  const angle = Math.random() * Math.PI * 2;
  const speed = 0.25 + Math.random() * 0.4;
  return {
    type,
    x: 0.05 + Math.random() * 0.9,
    y: 0.1 + Math.random() * 0.85,
    vx: Math.cos(angle) * speed * 0.01,
    vy: Math.sin(angle) * speed * 0.01,
    life: 0,
  };
}

function spawnDroplets(ref: React.MutableRefObject<Particle[]>, n: number, type: 'H' | 'OH') {
  for (let i = 0; i < n; i++) {
    ref.current.push({
      type,
      x: 0.1 + Math.random() * 0.8,
      y: type === 'H' ? -0.05 - Math.random() * 0.1 : 1.05 + Math.random() * 0.1,
      vx: (Math.random() - 0.5) * 0.004,
      vy: type === 'H' ? 0.012 + Math.random() * 0.006 : -(0.012 + Math.random() * 0.006),
      life: 0,
    });
  }
}

function stepAndDraw(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, particles: Particle[]) {
  const w = canvas.clientWidth, h = canvas.clientHeight;

  // Beaker background
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(120, 180, 220, 0.06)';
  ctx.fillRect(0, 0, w, h);
  // Meniscus line
  ctx.strokeStyle = 'rgba(120, 180, 220, 0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, h * 0.08); ctx.lineTo(w, h * 0.08); ctx.stroke();

  // Update positions
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.life++;

    if (p.type === 'HA' || p.type === 'A') {
      // gentle thermal jitter
      p.vx += (Math.random() - 0.5) * 0.0008;
      p.vy += (Math.random() - 0.5) * 0.0008;
      p.vx = Math.max(-0.012, Math.min(0.012, p.vx));
      p.vy = Math.max(-0.012, Math.min(0.012, p.vy));
      // bounce
      const r = 0.035;
      if (p.x < r) { p.x = r; p.vx = -p.vx; }
      if (p.x > 1 - r) { p.x = 1 - r; p.vx = -p.vx; }
      if (p.y < 0.05 + r) { p.y = 0.05 + r; p.vy = -p.vy; }
      if (p.y > 1 - r) { p.y = 1 - r; p.vy = -p.vy; }
    }
  }

  // Reactions: H⁺ → finds A⁻ → becomes HA;  OH⁻ → finds HA → becomes A⁻
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    if (p.type !== 'H' && p.type !== 'OH') continue;
    // Once inside the beaker
    if (p.y > 0.1 && p.y < 0.95) {
      const targetType: ParticleType = p.type === 'H' ? 'A' : 'HA';
      let bestIdx = -1, bestD = Infinity;
      for (let j = 0; j < particles.length; j++) {
        if (j === i) continue;
        const q = particles[j];
        if (q.type !== targetType) continue;
        const dx = q.x - p.x, dy = q.y - p.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD) { bestD = d2; bestIdx = j; }
      }
      if (bestIdx >= 0) {
        // Steer the ion towards the partner
        const q = particles[bestIdx];
        const dx = q.x - p.x, dy = q.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        p.vx = (dx / dist) * 0.018;
        p.vy = (dy / dist) * 0.018;
        if (dist < 0.05) {
          // React: convert target, remove ion
          q.type = p.type === 'H' ? 'HA' : 'A';
          q.reactingTimer = 18;
          particles.splice(i, 1);
          continue;
        }
      }
    }
    // Remove if off-screen too long
    if (p.life > 280) particles.splice(i, 1);
  }

  // Render
  for (const p of particles) {
    drawParticle(ctx, p, w, h);
  }
}

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle, w: number, h: number) {
  const x = p.x * w, y = p.y * h;
  const isIon = p.type === 'H' || p.type === 'OH';
  const r = isIon ? 9 : 14;

  let base: string, bright: string, label: string;
  switch (p.type) {
    case 'HA': base = '#ff7a3c'; bright = '#ffd6b6'; label = 'HA'; break;
    case 'A':  base = '#5dd0ff'; bright = '#c5ecff'; label = 'A⁻'; break;
    case 'H':  base = '#ff4d4d'; bright = '#ffb3b3'; label = 'H⁺'; break;
    case 'OH': base = '#a78bfa'; bright = '#d8c8ff'; label = 'OH⁻'; break;
  }

  if (p.reactingTimer && p.reactingTimer > 0) {
    const t = p.reactingTimer / 18;
    ctx.beginPath();
    ctx.arc(x, y, r + 8 * t, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.6 * t})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    p.reactingTimer--;
  }

  const grad = ctx.createRadialGradient(x - r / 3, y - r / 3, 0, x, y, r);
  grad.addColorStop(0, bright);
  grad.addColorStop(1, base);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#0a0908';
  ctx.font = `600 ${isIon ? 9 : 10}px JetBrains Mono, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y + 0.5);
}

// ───── Chart ─────

function Chart({ history, pKa, acidDose, baseDose }:
  { history: Sample[]; pKa: number; acidDose: number; baseDose: number; }
) {
  const padL = 38, padR = 12, padT = 14, padB = 26;
  const W = 800, H = 220;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const n = Math.max(2, history.length);

  const xAt = (i: number) => padL + (i / (HISTORY_MAX - 1)) * innerW;
  const yAt = (pH: number) => padT + (1 - pH / 14) * innerH;

  const bufPath = history.map((s, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(s.pH).toFixed(1)}`).join(' ');
  const purePath = history.map((s, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(s.pure).toFixed(1)}`).join(' ');

  return (
    <div style={{
      background: 'var(--ink-1)', border: '1px solid var(--line)', borderRadius: 6, padding: 20,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div className="eyebrow">pH · last {HISTORY_MAX} events</div>
        <div className="mono" style={{ fontSize: 10, color: 'var(--paper-dim)' }}>
          <span style={{ color: 'var(--phos)' }}>━ buffered</span>
          {'   '}
          <span style={{ color: 'var(--paper-faint)' }}>┄ pure water</span>
          {'   '}cumulative: <span style={{ color: 'var(--hot)' }}>{acidDose} H⁺</span> · <span style={{ color: 'var(--cool)' }}>{baseDose} OH⁻</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxHeight: 280, display: 'block' }} preserveAspectRatio="xMidYMid meet">
        {/* Grid + axis */}
        {[0, 2, 4, 6, 7, 8, 10, 12, 14].map(p => (
          <g key={p}>
            <line x1={padL} y1={yAt(p)} x2={W - padR} y2={yAt(p)}
                  stroke="rgba(245,241,232,0.06)" strokeWidth={1} />
            <text x={padL - 6} y={yAt(p) + 3} textAnchor="end"
                  fontFamily="JetBrains Mono" fontSize={9} fill="rgba(245,241,232,0.5)">{p}</text>
          </g>
        ))}
        {/* pKa reference */}
        <line x1={padL} y1={yAt(pKa)} x2={W - padR} y2={yAt(pKa)}
              stroke="var(--phos)" strokeWidth={1} strokeDasharray="3 4" opacity={0.6} />
        <text x={W - padR} y={yAt(pKa) - 4} textAnchor="end"
              fontFamily="JetBrains Mono" fontSize={9} fill="var(--phos)">pKa = {pKa.toFixed(2)}</text>
        {/* Pure-water line */}
        {n > 1 && (
          <path d={purePath} fill="none" stroke="rgba(245,241,232,0.5)"
                strokeWidth={1.5} strokeDasharray="4 4" />
        )}
        {/* Buffered line */}
        {n > 1 && (
          <path d={bufPath} fill="none" stroke="var(--phos)" strokeWidth={2.2} />
        )}
        {/* Axis labels */}
        <text x={4} y={padT + 4} fontFamily="JetBrains Mono" fontSize={9} fill="rgba(245,241,232,0.5)">pH</text>
        <text x={W - padR} y={H - 6} textAnchor="end" fontFamily="JetBrains Mono" fontSize={9} fill="rgba(245,241,232,0.5)">events →</text>
      </svg>
    </div>
  );
}

// ───── small UI atoms ─────

function StressBtn({ label, accent, onClick }:
  { label: string; accent: string; onClick: () => void; }
) {
  return (
    <button
      onClick={onClick}
      className="mono"
      style={{
        padding: '8px 6px', fontSize: 10, letterSpacing: '0.12em',
        textTransform: 'uppercase',
        border: `1px solid ${accent}`,
        background: `${accent}14`,
        color: accent,
        cursor: 'pointer',
      }}
    >{label}</button>
  );
}

function Slider({ label, value, onChange, min, max, accent }:
  { label: string; value: number; onChange: (v: number) => void; min: number; max: number; accent: string; }
) {
  return (
    <UISlider label={label} value={value} min={min} max={max} step={1}
              onChange={onChange} accent={accent}
              format={(v) => Number.isInteger(v) ? `${v}` : v.toFixed(2)} />
  );
}

function Stat({ label, value, accent }:
  { label: string; value: string; accent?: string; }
) {
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 4 }}>{label}</div>
      <div className="serif" style={{ fontSize: 17, color: accent ?? 'var(--paper)' }}>{value}</div>
    </div>
  );
}
