import { useEffect, useRef, useState, type CSSProperties } from 'react';

/**
 * Phase changes: solid → liquid → gas
 * Heating curve graph + particle box.
 */

type Phase = 'solid' | 'liquid' | 'gas';

export default function PhaseChange() {
  const [t, setT] = useState(0);
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1); // 0.25–3×
  useEffect(() => {
    if (!running) return;
    let raf: number;
    let last = performance.now();
    const loop = (now: number) => {
      if (!document.hidden) {
        const dt = (now - last) / 12000 * speed;
        setT(prev => (prev + dt) % 1);
      }
      last = now;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running, speed]);

  // Phase by time
  const phase: Phase = t < 0.33 ? 'solid' : t < 0.66 ? 'liquid' : 'gas';
  const temp = phaseTemp(t);

  // Single SVG path for the heating curve — ball rides it via getPointAtLength
  // so x AND y stay perfectly on the line at every t.
  const curveD = 'M 40 180 L 100 160 L 180 160 L 220 80 L 300 80 L 360 40';
  const pathRef = useRef<SVGPathElement | null>(null);
  const [ball, setBall] = useState({ x: 40, y: 180 });
  useEffect(() => {
    if (!pathRef.current) return;
    const len = pathRef.current.getTotalLength();
    const p = pathRef.current.getPointAtLength(len * Math.max(0, Math.min(1, t)));
    setBall({ x: p.x, y: p.y });
  }, [t]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
      <Box phase={phase} temp={temp} />

      <div style={{
        background: 'var(--ink-1)',
        border: '1px solid var(--line)',
        borderRadius: 6,
        padding: 20,
        display: 'flex', flexDirection: 'column',
      }}>
        <div className="eyebrow">Heating curve · H₂O</div>
        <svg viewBox="0 0 400 220" style={{ width: '100%', flex: 1, marginTop: 8 }}>
          <defs>
            <pattern id="ph-grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(245,241,232,0.04)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="400" height="220" fill="url(#ph-grid)" />

          {/* Axes */}
          <line x1="40" y1="20" x2="40" y2="200" stroke="rgba(245,241,232,0.3)" />
          <line x1="40" y1="200" x2="380" y2="200" stroke="rgba(245,241,232,0.3)" />
          <text x="20" y="110" fill="rgba(245,241,232,0.5)" fontSize="9" fontFamily="JetBrains Mono" transform="rotate(-90 20 110)">TEMPERATURE</text>
          <text x="200" y="216" fill="rgba(245,241,232,0.5)" fontSize="9" fontFamily="JetBrains Mono" textAnchor="middle">HEAT ADDED →</text>

          {/* Plateau lines */}
          <line x1="40" y1="160" x2="380" y2="160" stroke="rgba(245,241,232,0.1)" strokeDasharray="2 4" />
          <line x1="40" y1="80" x2="380" y2="80" stroke="rgba(245,241,232,0.1)" strokeDasharray="2 4" />
          <text x="46" y="75" fontFamily="JetBrains Mono" fontSize="8" fill="rgba(245,241,232,0.5)">100°C</text>
          <text x="46" y="155" fontFamily="JetBrains Mono" fontSize="8" fill="rgba(245,241,232,0.5)">0°C</text>

          {/* Curve - 5 segments */}
          <path ref={pathRef} d={curveD} fill="none" stroke="#5dd0ff" strokeWidth="2" />

          {/* Segment labels */}
          <text x="60" y="178" fontFamily="JetBrains Mono" fontSize="8" fill="#5dd0ff">solid</text>
          <text x="125" y="156" fontFamily="JetBrains Mono" fontSize="8" fill="#5dd0ff">↑ q = mLf (melt)</text>
          <text x="195" y="120" fontFamily="JetBrains Mono" fontSize="8" fill="#5dd0ff">liquid</text>
          <text x="240" y="76" fontFamily="JetBrains Mono" fontSize="8" fill="#5dd0ff">↑ q = mLv (vaporize)</text>
          <text x="320" y="35" fontFamily="JetBrains Mono" fontSize="8" fill="#5dd0ff">gas</text>

          {/* Moving point — rides the path via getPointAtLength so it stays ON the curve */}
          <circle cx={ball.x} cy={ball.y} r="10" fill="#f5f1e8" opacity="0.18" />
          <circle cx={ball.x} cy={ball.y} r="5" fill="#f5f1e8" stroke="rgba(0,0,0,0.4)" />
        </svg>

        {/* Controls */}
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setRunning(r => !r)} className="mono" style={ctrlBtn}>{running ? '❚❚ Pause' : '▶ Play'}</button>
          <button onClick={() => setT(0)} className="mono" style={ctrlBtn}>↺ Reset</button>
          <button onClick={() => setT(0.05)}  className="mono" style={ctrlBtn}>Solid</button>
          <button onClick={() => setT(0.24)}  className="mono" style={ctrlBtn}>↑ Melt</button>
          <button onClick={() => setT(0.42)}  className="mono" style={ctrlBtn}>Liquid</button>
          <button onClick={() => setT(0.58)}  className="mono" style={ctrlBtn}>↑ Vaporize</button>
          <button onClick={() => setT(0.85)}  className="mono" style={ctrlBtn}>Gas</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
            <span className="mono" style={{ fontSize: 9, color: 'var(--paper-faint)', letterSpacing: '0.12em' }}>SPEED</span>
            <input type="range" min={0.25} max={3} step={0.25} value={speed} onChange={e => setSpeed(Number(e.target.value))} style={{ width: 90, accentColor: 'var(--phos)' }} />
            <span className="mono" style={{ fontSize: 11, color: 'var(--paper)', minWidth: 32 }}>{speed.toFixed(2)}×</span>
          </div>
        </div>
        <input type="range" min={0} max={1} step={0.001} value={t} onChange={e => { setT(Number(e.target.value)); setRunning(false); }}
               style={{ width: '100%', marginTop: 10, accentColor: phaseColor(phase) }} aria-label="Scrub heating curve" />

        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <Stat label="Phase" value={phase} accent={phaseColor(phase)} />
          <Stat label="T" value={`${temp.toFixed(0)}°C`} />
          <Stat label={t < 0.33 ? 'Next: ΔH(fus)' : t < 0.66 ? 'Next: ΔH(vap)' : 'ΔH(vap) past'} value={t < 0.33 ? '6.0 kJ/mol' : t < 0.66 ? '40.7 kJ/mol' : 'gas heating'} />
        </div>
      </div>
    </div>
  );
}

function Box({ phase, temp }: { phase: Phase; temp: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<{ x: number; y: number; vx: number; vy: number; ox: number; oy: number }[]>([]);

  useEffect(() => {
    const c = canvasRef.current!;
    const w = c.width = c.clientWidth * devicePixelRatio;
    const h = c.height = c.clientHeight * devicePixelRatio;
    const grid = 6;
    if (particlesRef.current.length === 0) {
      // Tight close-packed lattice centered horizontally near the bottom.
      // Solid spacing = particle diameter (12 dpr) + 1px gap → particles touch.
      const r = 6 * devicePixelRatio;
      const spacing = r * 2 + 1 * devicePixelRatio;
      const startX = (w - (grid - 1) * spacing) / 2;
      const bottomY = h - r - 8 * devicePixelRatio;
      for (let row = 0; row < grid; row++) {
        for (let col = 0; col < grid; col++) {
          // Hex-ish offset on alternating rows for a real close-packed look.
          const offset = row % 2 === 0 ? 0 : spacing * 0.5;
          const x = startX + col * spacing + offset;
          const y = bottomY - row * spacing * 0.92;
          particlesRef.current.push({ x, y, vx: 0, vy: 0, ox: x, oy: y });
        }
      }
    }
  }, []);

  useEffect(() => {
    let raf: number;
    const c = canvasRef.current!;
    const ctx = c.getContext('2d')!;

    const draw = () => {
      const w = c.width, h = c.height;
      ctx.fillStyle = 'rgba(16,14,12,0.4)';
      ctx.fillRect(0, 0, w, h);

      const ps = particlesRef.current;
      for (const p of ps) {
        if (phase === 'solid') {
          // Tiny vibration about lattice site — particles stay locked together.
          // Cap amplitude well below the 1px inter-particle gap so they don't visibly overlap.
          const amp = (0.6 + Math.max(-20, temp) * 0.012) * devicePixelRatio;
          p.x = p.ox + (Math.random() - 0.5) * amp;
          p.y = p.oy + (Math.random() - 0.5) * amp;
          p.vx = 0; p.vy = 0;
        } else if (phase === 'liquid') {
          // Flow but tend to bottom
          p.vx += (Math.random() - 0.5) * 0.3;
          p.vy += 0.05; // gravity-ish
          p.vx *= 0.96; p.vy *= 0.96;
          p.x += p.vx; p.y += p.vy;
          if (p.x < 8) { p.x = 8; p.vx = -p.vx * 0.5; }
          if (p.x > w - 8) { p.x = w - 8; p.vx = -p.vx * 0.5; }
          if (p.y > h - 16) { p.y = h - 16; p.vy = -p.vy * 0.5; }
          if (p.y < h * 0.3) { p.y = h * 0.3; p.vy *= -0.5; }
        } else {
          // Gas - free flight
          p.vx += (Math.random() - 0.5) * 0.6;
          p.vy += (Math.random() - 0.5) * 0.6;
          p.vx = Math.max(-3, Math.min(3, p.vx));
          p.vy = Math.max(-3, Math.min(3, p.vy));
          p.x += p.vx; p.y += p.vy;
          if (p.x < 8) { p.x = 8; p.vx = -p.vx; }
          if (p.x > w - 8) { p.x = w - 8; p.vx = -p.vx; }
          if (p.y < 8) { p.y = 8; p.vy = -p.vy; }
          if (p.y > h - 8) { p.y = h - 8; p.vy = -p.vy; }
        }

        const r = 6 * devicePixelRatio;
        const heat = Math.min(1, temp / 100);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        const grad = ctx.createRadialGradient(p.x - 2, p.y - 2, 0, p.x, p.y, r);
        grad.addColorStop(0, `rgb(${100 + heat * 155}, ${150}, ${230 - heat * 100})`);
        grad.addColorStop(1, `rgb(${60 + heat * 130}, ${90}, ${170})`);
        ctx.fillStyle = grad;
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [phase, temp]);

  return (
    <div style={{
      position: 'relative',
      background: 'var(--ink-1)',
      border: '1px solid var(--line)',
      borderRadius: 6,
      aspectRatio: '0.95 / 1',
      overflow: 'hidden',
    }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      <div style={{ position: 'absolute', top: 14, left: 16, right: 16, display: 'flex', justifyContent: 'space-between' }}>
        <span className="eyebrow">Particulate · {phase}</span>
        <span className="mono" style={{ fontSize: 11, color: phaseColor(phase) }}>{temp.toFixed(0)}°C</span>
      </div>
    </div>
  );
}

const ctrlBtn: CSSProperties = {
  padding: '5px 10px', fontSize: 10, letterSpacing: '0.1em',
  border: '1px solid var(--line-strong)', background: 'transparent',
  color: 'var(--paper)', cursor: 'pointer', borderRadius: 3,
};

function phaseTemp(t: number) {
  // Heating curve sample
  if (t < 0.15) return -20 + (t / 0.15) * 20;
  if (t < 0.33) return 0;
  if (t < 0.5) return ((t - 0.33) / 0.17) * 100;
  if (t < 0.66) return 100;
  return 100 + ((t - 0.66) / 0.34) * 80;
}
function phaseColor(p: Phase) {
  return p === 'solid' ? 'var(--cool)' : p === 'liquid' ? 'var(--phos)' : 'var(--hot)';
}
function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 4 }}>{label}</div>
      <div className="serif" style={{ fontSize: 18, color: accent ?? 'var(--paper)', textTransform: 'capitalize' }}>{value}</div>
    </div>
  );
}
