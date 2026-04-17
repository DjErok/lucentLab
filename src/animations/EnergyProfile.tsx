import { useEffect, useRef, useState } from 'react';

/**
 * Reaction Energy Profile with optional catalyst.
 * Toggle: catalyzed/uncatalyzed.
 */

export default function EnergyProfile() {
  const [cat, setCat] = useState(false);
  const [t, setT] = useState(0);
  useEffect(() => {
    let raf: number;
    const start = performance.now();
    const loop = (now: number) => {
      setT(((now - start) / 5000) % 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const Ea = cat ? 35 : 80;
  const Ea_rev = cat ? 65 : 110;
  const dH = -30;

  // Curve geometry — kept in viewBox bounds (peak ~y=40 uncatalyzed, ~y=110 catalyzed)
  const uncatPath = 'M 40 220 C 130 220, 180 40, 250 40 S 370 175, 480 175';
  const catPath   = 'M 40 220 C 130 220, 200 110, 250 110 S 370 175, 480 175';
  const activePath = cat ? catPath : uncatPath;

  // Active-curve ref for getPointAtLength so the ball ACTUALLY rides the curve.
  const activeRef = useRef<SVGPathElement | null>(null);
  const [ball, setBall] = useState({ x: 40, y: 220 });
  useEffect(() => {
    if (!activeRef.current) return;
    const len = activeRef.current.getTotalLength();
    const p = activeRef.current.getPointAtLength(len * Math.max(0, Math.min(1, t)));
    setBall({ x: p.x, y: p.y });
  }, [t, cat]);

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div style={{ display: 'flex', gap: 0 }}>
        <button
          onClick={() => setCat(false)}
          className="mono"
          style={{
            padding: '10px 18px', fontSize: 11, letterSpacing: '0.16em',
            textTransform: 'uppercase', border: '1px solid var(--line-strong)',
            background: !cat ? 'var(--paper)' : 'transparent',
            color: !cat ? 'var(--ink-0)' : 'var(--paper-dim)',
          }}
        >
          Uncatalyzed
        </button>
        <button
          onClick={() => setCat(true)}
          className="mono"
          style={{
            padding: '10px 18px', fontSize: 11, letterSpacing: '0.16em',
            textTransform: 'uppercase', border: '1px solid var(--line-strong)',
            borderLeft: 0,
            background: cat ? 'var(--paper)' : 'transparent',
            color: cat ? 'var(--ink-0)' : 'var(--paper-dim)',
          }}
        >
          + Catalyst
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 20 }}>
        <div style={{
          background: 'var(--ink-1)',
          border: '1px solid var(--line)',
          borderRadius: 6,
          padding: 20,
          aspectRatio: '1.4 / 1',
          position: 'relative',
        }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Energy diagram</div>
          <svg viewBox="0 0 500 280" style={{ width: '100%', height: 'calc(100% - 28px)' }}>
            <defs>
              <pattern id="ep-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(245,241,232,0.04)" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="500" height="280" fill="url(#ep-grid)" />

            {/* Axes */}
            <line x1="40" y1="20" x2="40" y2="260" stroke="rgba(245,241,232,0.35)" />
            <line x1="40" y1="260" x2="480" y2="260" stroke="rgba(245,241,232,0.35)" />

            {/* Uncatalyzed */}
            <path
              ref={!cat ? activeRef : undefined}
              d={uncatPath}
              fill="none"
              stroke={!cat ? '#fbbf24' : 'rgba(245,241,232,0.18)'}
              strokeWidth="2.5"
              strokeDasharray={cat ? '4 4' : 'none'}
            />
            {/* Catalyzed */}
            <path
              ref={cat ? activeRef : undefined}
              d={catPath}
              fill="none"
              stroke={cat ? '#69e36b' : 'rgba(245,241,232,0.18)'}
              strokeWidth="2.5"
              strokeDasharray={!cat ? '4 4' : 'none'}
            />

            {/* Reactant + product labels */}
            <line x1="40" y1="220" x2="80" y2="220" stroke="rgba(245,241,232,0.6)" strokeDasharray="2 2" />
            <line x1="440" y1="175" x2="480" y2="175" stroke="rgba(245,241,232,0.6)" strokeDasharray="2 2" />
            <text x="50" y="215" fontFamily="JetBrains Mono" fontSize="10" fill="var(--paper)">REACTANTS</text>
            <text x="380" y="170" fontFamily="JetBrains Mono" fontSize="10" fill="var(--paper)">PRODUCTS</text>

            {/* Ea arrow — measured from reactant baseline (220) up to the active peak */}
            <line x1="135" y1="220" x2="135" y2={cat ? 110 : 40}
                  stroke={cat ? '#69e36b' : '#fbbf24'} strokeWidth="1" strokeDasharray="3 3" />
            <text x="142" y={cat ? 170 : 135} fontFamily="Fraunces" fontStyle="italic" fontSize="13" fill={cat ? '#69e36b' : '#fbbf24'}>
              Ea = {Ea} kJ/mol
            </text>

            {/* ΔH arrow */}
            <line x1="450" y1="220" x2="450" y2="175" stroke="#ff6b35" strokeWidth="1" markerEnd="url(#arr)" />
            <defs>
              <marker id="arr" markerWidth="10" markerHeight="10" refX="5" refY="3" orient="auto">
                <path d="M0,0 L0,6 L6,3 z" fill="#ff6b35" />
              </marker>
            </defs>
            <text x="455" y="200" fontFamily="Fraunces" fontStyle="italic" fontSize="13" fill="#ff6b35">ΔH</text>

            {/* Moving ball — rides the active curve via getPointAtLength */}
            <circle cx={ball.x} cy={ball.y} r="14" fill="#f5f1e8" opacity="0.18" />
            <circle cx={ball.x} cy={ball.y} r="6" fill="#f5f1e8" stroke="rgba(0,0,0,0.4)" />

            <text x="240" y="278" fontFamily="JetBrains Mono" fontSize="9" fill="rgba(245,241,232,0.5)" textAnchor="middle">
              REACTION COORDINATE →
            </text>
          </svg>
        </div>

        <div style={{
          background: 'var(--ink-1)',
          border: '1px solid var(--line)',
          borderRadius: 6,
          padding: 24,
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          <div className="eyebrow">Activation</div>
          <div className="serif" style={{ fontSize: 28, lineHeight: 1.1 }}>
            {cat ? 'Catalyst lowers Eₐ' : 'Threshold to react'}
          </div>
          <div style={{ color: 'var(--paper-dim)', fontSize: 14, lineHeight: 1.55 }}>
            {cat
              ? 'A catalyst provides an alternative pathway with a smaller activation energy. ΔH is unchanged, but k = A·e^(−Ea/RT) grows enormously.'
              : 'Only a fraction of collisions have enough kinetic energy to surmount the activation barrier and form products.'}
          </div>

          <div style={{ marginTop: 'auto', borderTop: '1px solid var(--line)', paddingTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Stat label="Eₐ forward" value={`${Ea} kJ/mol`} accent={cat ? 'var(--phos)' : 'var(--acid)'} />
            <Stat label="Eₐ reverse" value={`${Ea_rev} kJ/mol`} />
            <Stat label="ΔH" value={`${dH} kJ/mol`} accent="var(--hot)" />
            <Stat label="k @ 298K" value={cat ? '~10⁻⁴' : '~10⁻¹⁴'} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 4 }}>{label}</div>
      <div className="serif" style={{ fontSize: 18, color: accent ?? 'var(--paper)' }}>{value}</div>
    </div>
  );
}
