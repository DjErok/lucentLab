import { useEffect, useMemo, useRef, useState } from 'react';
import UISlider from '../components/ui/Slider';

/**
 * Vapor Pressure — port of MW "Vapor Pressure".
 *
 * Closed container, liquid pool at bottom. Molecules with kinetic
 * energy above the escape threshold leave the liquid; vapor
 * molecules that hit the surface with low energy condense.
 * The vapor count converges to a temperature-dependent equilibrium
 * (Clausius-Clapeyron: ln P = -ΔH_vap / (R T) + C).
 */

const N_TOTAL = 90;
const HEIGHT_LIQUID = 0.55; // liquid surface y in [0..1] (lower = larger liquid)

type M = { x: number; y: number; vx: number; vy: number; phase: 'liq' | 'vap' };

export default function VaporPressure() {
  const [T, setT] = useState(350);     // K
  const [hVap, setHVap] = useState(40); // kJ/mol — water-like default
  const moleculesRef = useRef<M[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);
  const [vaporCount, setVaporCount] = useState(0);

  // Initialize once.
  useEffect(() => {
    const list: M[] = [];
    for (let i = 0; i < N_TOTAL; i++) {
      list.push({
        x: 0.05 + Math.random() * 0.9,
        y: HEIGHT_LIQUID + 0.05 + Math.random() * (1 - HEIGHT_LIQUID - 0.1),
        vx: (Math.random() - 0.5) * 0.004,
        vy: (Math.random() - 0.5) * 0.004,
        phase: 'liq',
      });
    }
    moleculesRef.current = list;
  }, []);

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

    let frame = 0;
    const tick = () => {
      if (document.hidden) { rafRef.current = requestAnimationFrame(tick); return; }
      step(moleculesRef.current, T, hVap);
      draw(ctx, canvas, moleculesRef.current);
      if ((++frame & 7) === 0) {
        setVaporCount(moleculesRef.current.filter(m => m.phase === 'vap').length);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect(); };
  }, [T, hVap]);

  // Theoretical Clausius-Clapeyron pressure (relative scale, atm-ish).
  const pTheory = useMemo(() => {
    const R = 8.314e-3; // kJ/(mol·K)
    // Anchor: at 373 K with ΔH=40, P=1 atm.
    const C = 1 / Math.exp(-hVap / (R * 373));
    return C * Math.exp(-hVap / (R * T));
  }, [T, hVap]);

  const pSim = vaporCount / N_TOTAL; // 0..1 fraction in vapor

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'baseline', gap: 16, flexWrap: 'wrap',
      }}>
        <div className="serif" style={{ fontSize: 22, fontStyle: 'italic' }}>
          ln P = − ΔH<sub>vap</sub> / R · 1/T + C
        </div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--paper-dim)' }}>
          Clausius–Clapeyron
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16 }}>
        <div style={{
          background: 'var(--ink-1)', border: '1px solid var(--line)',
          borderRadius: 6, aspectRatio: '1.2 / 1', padding: 18, position: 'relative',
        }}>
          <div className="eyebrow">Sealed container</div>
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
          <UISlider label="Temperature (K)" value={T} min={250} max={550} step={5}
                    onChange={setT} accent="var(--hot)" />
          <UISlider label="ΔH_vap (kJ/mol)" value={hVap} min={15} max={60} step={1}
                    onChange={setHVap} accent="var(--cool)" />

          <div style={{
            padding: 12, background: 'var(--ink-2)', borderRadius: 4,
            border: '1px solid var(--line)',
          }}>
            <div className="eyebrow">P_vap (relative · 1 atm at T_b)</div>
            <div className="serif" style={{ fontSize: 30, color: 'var(--phos)', lineHeight: 1.1 }}>
              {pTheory.toFixed(3)} atm
            </div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--paper-dim)' }}>
              vapor fraction in box: {(pSim * 100).toFixed(0)}%
            </div>
          </div>

          <div className="mono" style={{
            fontSize: 11, color: 'var(--paper-dim)', lineHeight: 1.5,
          }}>
            Higher T → more molecules with KE &gt; ΔH_vap → faster evaporation →
            higher equilibrium vapor pressure. Equilibrium is reached when the rate
            of evaporation equals the rate of condensation.
          </div>
        </div>
      </div>
    </div>
  );
}

function step(mols: M[], T: number, hVap: number) {
  // Probability of a liquid molecule escaping per frame ∝ exp(-ΔH/(RT)).
  const R = 8.314e-3;
  const escapeP = 0.003 * Math.exp(-hVap / (R * T)) * 50; // arbitrary tuning
  const condenseP = 0.04;
  const speedScale = 0.0015 + 0.000008 * (T - 250);

  for (const m of mols) {
    // Thermal kicks.
    m.vx += (Math.random() - 0.5) * 0.0008;
    m.vy += (Math.random() - 0.5) * 0.0008;

    if (m.phase === 'liq') {
      // Confine to liquid region.
      m.x += m.vx;
      m.y += m.vy;
      m.vx = clamp(m.vx, -speedScale * 1.4, speedScale * 1.4);
      m.vy = clamp(m.vy, -speedScale * 1.4, speedScale * 1.4);
      const r = 0.018;
      if (m.x < r) { m.x = r; m.vx = -m.vx; }
      if (m.x > 1 - r) { m.x = 1 - r; m.vx = -m.vx; }
      if (m.y > 1 - r) { m.y = 1 - r; m.vy = -m.vy; }
      if (m.y < HEIGHT_LIQUID + r) {
        // At the surface — chance to escape.
        if (Math.random() < escapeP && m.vy < 0) {
          m.phase = 'vap';
          m.vy = -speedScale * 3;
        } else {
          m.y = HEIGHT_LIQUID + r;
          m.vy = -m.vy;
        }
      }
    } else {
      m.vx += 0; // gas — no gravity, just thermal
      m.vy += 0;
      m.vx = clamp(m.vx, -speedScale * 4, speedScale * 4);
      m.vy = clamp(m.vy, -speedScale * 4, speedScale * 4);
      // Boost vapor speeds with T.
      const sp = Math.hypot(m.vx, m.vy);
      const target = speedScale * 3;
      if (sp < target * 0.4) {
        const a = Math.random() * Math.PI * 2;
        m.vx = Math.cos(a) * target;
        m.vy = Math.sin(a) * target;
      }
      m.x += m.vx;
      m.y += m.vy;
      const r = 0.012;
      if (m.x < r) { m.x = r; m.vx = -m.vx; }
      if (m.x > 1 - r) { m.x = 1 - r; m.vx = -m.vx; }
      if (m.y < r) { m.y = r; m.vy = -m.vy; }
      if (m.y > HEIGHT_LIQUID - r) {
        // Hit the liquid — chance to condense (slower vapor more likely).
        if (Math.random() < condenseP) {
          m.phase = 'liq';
          m.y = HEIGHT_LIQUID + r;
          m.vy = Math.abs(m.vy) * 0.4;
        } else {
          m.y = HEIGHT_LIQUID - r;
          m.vy = -m.vy;
        }
      }
    }
  }
}

function draw(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, mols: M[]) {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);
  // Container.
  ctx.strokeStyle = 'rgba(245,241,232,0.4)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  // Liquid region.
  ctx.fillStyle = 'rgba(120, 180, 220, 0.16)';
  ctx.fillRect(0, HEIGHT_LIQUID * h, w, h * (1 - HEIGHT_LIQUID));
  ctx.strokeStyle = 'rgba(120, 180, 220, 0.5)';
  ctx.beginPath();
  ctx.moveTo(0, HEIGHT_LIQUID * h);
  ctx.lineTo(w, HEIGHT_LIQUID * h);
  ctx.stroke();
  // Molecules.
  for (const m of mols) {
    const x = m.x * w, y = m.y * h;
    if (m.phase === 'liq') {
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#5dd0ff';
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#fbbf24';
      ctx.fill();
    }
  }
}

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}
