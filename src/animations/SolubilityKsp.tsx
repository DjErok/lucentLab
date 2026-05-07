import { useEffect, useMemo, useRef, useState } from 'react';
import UISlider from '../components/ui/Slider';
import SlideTabs from '../components/ui/SlideTabs';

/**
 * Solubility & Ksp — companion to Dissolution. Shows the
 * dissolution ⇌ precipitation equilibrium as a function of added
 * dissolved ions, and tracks Q vs Ksp.
 *
 *    M_a X_b (s)  ⇌  a M^b+ (aq) + b X^a- (aq)
 *    K_sp = [M]^a [X]^b
 *
 * Compares undersaturated / saturated / supersaturated regimes.
 */

type SaltId = 'agcl' | 'caf2' | 'pbi2' | 'baso4';
type Salt = { id: SaltId; label: string; formula: string; Ksp: number; a: number; b: number; cat: string; an: string };

const SALTS: Salt[] = [
  { id: 'agcl',  label: 'AgCl',   formula: 'AgCl',  Ksp: 1.8e-10, a: 1, b: 1, cat: 'Ag⁺',  an: 'Cl⁻' },
  { id: 'caf2',  label: 'CaF₂',   formula: 'CaF₂',  Ksp: 3.9e-11, a: 1, b: 2, cat: 'Ca²⁺', an: 'F⁻'  },
  { id: 'pbi2',  label: 'PbI₂',   formula: 'PbI₂',  Ksp: 9.8e-9,  a: 1, b: 2, cat: 'Pb²⁺', an: 'I⁻'  },
  { id: 'baso4', label: 'BaSO₄',  formula: 'BaSO₄', Ksp: 1.1e-10, a: 1, b: 1, cat: 'Ba²⁺', an: 'SO₄²⁻' },
];

export default function SolubilityKsp() {
  const [id, setId] = useState<SaltId>('agcl');
  const salt = SALTS.find(s => s.id === id)!;
  // log10([cation]) on a slider — easier than linear molarity.
  const [logC, setLogC] = useState(-5);
  const [logA, setLogA] = useState(-5);

  const C = Math.pow(10, logC);
  const A = Math.pow(10, logA);
  const Q = Math.pow(C, salt.a) * Math.pow(A, salt.b);
  const ratio = Q / salt.Ksp;

  let regime: 'under' | 'sat' | 'super';
  if (ratio < 0.85) regime = 'under';
  else if (ratio > 1.15) regime = 'super';
  else regime = 'sat';

  const regimeLabel = {
    under: 'UNDERSATURATED · more salt will dissolve',
    sat:   'SATURATED · dynamic equilibrium',
    super: 'SUPERSATURATED · precipitate forms',
  }[regime];

  const regimeColor = regime === 'under' ? 'var(--cool)'
                    : regime === 'sat' ? 'var(--phos)'
                    : 'var(--hot)';

  // Particle scene tuning.
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);
  const partsRef = useRef<{ x: number; y: number; vx: number; vy: number; type: 'cat' | 'an' | 'solid' }[]>([]);

  // Reseed when ion concentrations or salt change. Number of free ions ≈ log scale.
  const targetC = useMemo(() => Math.min(40, Math.max(2, Math.round((logC + 8) * 5))), [logC]);
  const targetA = useMemo(() => Math.min(40, Math.max(2, Math.round((logA + 8) * 5 * salt.b))), [logA, salt.b]);
  const targetSolid = regime === 'super' ? 18 : regime === 'sat' ? 6 : 0;

  useEffect(() => {
    const list: typeof partsRef.current = [];
    for (let i = 0; i < targetC; i++) list.push(rand('cat'));
    for (let i = 0; i < targetA; i++) list.push(rand('an'));
    for (let i = 0; i < targetSolid; i++) list.push({ ...rand('solid'), x: 0.3 + Math.random() * 0.4, y: 0.7 + Math.random() * 0.2 });
    partsRef.current = list;
  }, [targetC, targetA, targetSolid]);

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
      stepScene(partsRef.current);
      drawScene(ctx, canvas, partsRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect(); };
  }, []);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <SlideTabs<SaltId>
        tabs={SALTS.map(s => ({ id: s.id, label: s.label }))}
        value={id}
        onChange={setId}
      />

      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'baseline', gap: 16, flexWrap: 'wrap',
      }}>
        <div className="serif" style={{ fontSize: 22, fontStyle: 'italic' }}>
          {salt.formula}(s) ⇌ {salt.a > 1 ? salt.a : ''}{salt.cat} + {salt.b > 1 ? salt.b : ''}{salt.an}
        </div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--paper-dim)' }}>
          K_sp = {salt.Ksp.toExponential(1)}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
        <div style={{
          background: 'var(--ink-1)', border: '1px solid var(--line)',
          borderRadius: 6, aspectRatio: '1.2 / 1', padding: 18, position: 'relative',
        }}>
          <div className="eyebrow">Solution</div>
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
          <UISlider label={`log [${salt.cat}]`} value={logC} min={-8} max={-1} step={0.1}
                    onChange={setLogC} accent="#ff7a3c" format={v => v.toFixed(2)} />
          <UISlider label={`log [${salt.an}]`} value={logA} min={-8} max={-1} step={0.1}
                    onChange={setLogA} accent="#5dd0ff" format={v => v.toFixed(2)} />

          <div style={{
            padding: 12, background: 'var(--ink-2)', borderRadius: 4,
            border: `1px solid ${regimeColor}`,
          }}>
            <div className="eyebrow">Q vs K_sp</div>
            <div className="serif" style={{ fontSize: 30, color: regimeColor, lineHeight: 1.1 }}>
              {Q.toExponential(2)}
            </div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--paper-dim)' }}>
              Q / K_sp = {ratio.toExponential(2)}
            </div>
            <div className="mono" style={{
              marginTop: 6, fontSize: 11, letterSpacing: '0.12em', color: regimeColor,
            }}>
              {regimeLabel}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function rand(type: 'cat' | 'an' | 'solid') {
  const a = Math.random() * Math.PI * 2;
  return {
    type,
    x: 0.05 + Math.random() * 0.9,
    y: 0.05 + Math.random() * 0.9,
    vx: Math.cos(a) * 0.0035,
    vy: Math.sin(a) * 0.0035,
  };
}

function stepScene(parts: { x: number; y: number; vx: number; vy: number; type: 'cat' | 'an' | 'solid' }[]) {
  for (const p of parts) {
    if (p.type === 'solid') {
      p.x += p.vx * 0.05;
      p.y = Math.min(0.95, p.y + 0.0005); // slowly settle
      continue;
    }
    p.x += p.vx;
    p.y += p.vy;
    p.vx += (Math.random() - 0.5) * 0.0006;
    p.vy += (Math.random() - 0.5) * 0.0006;
    const r = 0.022;
    if (p.x < r) { p.x = r; p.vx = -p.vx; }
    if (p.x > 1 - r) { p.x = 1 - r; p.vx = -p.vx; }
    if (p.y < r) { p.y = r; p.vy = -p.vy; }
    if (p.y > 1 - r) { p.y = 1 - r; p.vy = -p.vy; }
  }
}

function drawScene(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement,
                   parts: { x: number; y: number; vx: number; vy: number; type: 'cat' | 'an' | 'solid' }[]) {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(120, 180, 220, 0.06)';
  ctx.fillRect(0, 0, w, h);
  for (const p of parts) {
    const x = p.x * w, y = p.y * h;
    if (p.type === 'solid') {
      ctx.fillStyle = '#888';
      ctx.fillRect(x - 6, y - 6, 12, 12);
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.strokeRect(x - 6, y - 6, 12, 12);
    } else {
      ctx.beginPath();
      ctx.arc(x, y, p.type === 'cat' ? 7 : 9, 0, Math.PI * 2);
      ctx.fillStyle = p.type === 'cat' ? '#ff7a3c' : '#5dd0ff';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.stroke();
    }
  }
}
