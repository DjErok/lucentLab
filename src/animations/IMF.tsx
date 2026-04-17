import { useEffect, useMemo, useRef, useState, useCallback } from 'react';

/**
 * Intermolecular Forces — interactive Lennard-Jones / Coulombic playground.
 * Choose an IMF type (LDF, dipole-dipole, H-bond, ion-dipole), slide the
 * intermolecular separation and orientation, and watch the potential-energy
 * curve, the partial-charge alignment, and the strength ranking respond.
 */

type IMFType = 'ldf' | 'dipole' | 'hbond' | 'iondipole';

type IMFMeta = {
  id: IMFType;
  name: string;
  short: string;
  example: string;
  pair: string;
  energyMin: number; // kJ/mol
  energyMax: number; // kJ/mol
  wellDepth: number; // typical |U_min|, kJ/mol
  sigma: number;     // Å, equilibrium-ish separation
  color: string;
  desc: string;
  rangeMin: number;  // Å for slider
  rangeMax: number;  // Å for slider
  ldfFraction: number; // share of total cohesion contributed by LDF
};

const IMF_LIST: IMFMeta[] = [
  {
    id: 'ldf', name: 'London Dispersion', short: 'LDF',
    example: 'CH₄ ⋯ CH₄', pair: 'methane / methane',
    energyMin: 0.05, energyMax: 40, wellDepth: 1.2, sigma: 4.1,
    color: '#5dd0ff', rangeMin: 3.0, rangeMax: 10.0, ldfFraction: 1.0,
    desc: 'Instantaneous, fluctuating electron-cloud asymmetries induce transient dipoles in neighboring molecules. Present in every substance; grows with polarizability (size, electron count).',
  },
  {
    id: 'dipole', name: 'Dipole–Dipole', short: 'D-D',
    example: 'HCl ⋯ HCl', pair: 'hydrogen chloride / hydrogen chloride',
    energyMin: 5, energyMax: 25, wellDepth: 9, sigma: 3.7,
    color: '#fbbf24', rangeMin: 2.8, rangeMax: 9.0, ldfFraction: 0.35,
    desc: 'Permanent molecular dipoles align so the δ+ end of one molecule faces the δ− end of another. Requires a net molecular dipole moment.',
  },
  {
    id: 'hbond', name: 'Hydrogen Bonding', short: 'H-bond',
    example: 'H₂O ⋯ H₂O', pair: 'water / water',
    energyMin: 10, energyMax: 40, wellDepth: 22, sigma: 2.8,
    color: '#ff5b3c', rangeMin: 2.2, rangeMax: 8.0, ldfFraction: 0.19,
    desc: 'A special, strong dipole-dipole: H bonded directly to N, O, or F is attracted to a lone pair on N, O, or F of another molecule. Responsible for water’s anomalously high boiling point.',
  },
  {
    id: 'iondipole', name: 'Ion–Dipole', short: 'Ion-D',
    example: 'Na⁺ ⋯ H₂O', pair: 'sodium ion / water',
    energyMin: 40, energyMax: 600, wellDepth: 95, sigma: 2.4,
    color: '#a78bfa', rangeMin: 2.0, rangeMax: 8.0, ldfFraction: 0.08,
    desc: 'A full ionic charge interacts with the partial charge of a polar molecule. Dominates aqueous solvation of salts (Na⁺ surrounded by water’s δ− oxygens).',
  },
];

type BPRow = { formula: string; bp: number; dominant: IMFType; note: string };
const BPS: BPRow[] = [
  { formula: 'CH₄',  bp: -161, dominant: 'ldf',       note: 'Nonpolar, very small electron cloud → weak LDF only.' },
  { formula: 'Cl₂',  bp:  -34, dominant: 'ldf',       note: 'Larger polarizable cloud → stronger LDF than CH₄.' },
  { formula: 'HCl',  bp:  -85, dominant: 'dipole',    note: 'Permanent dipole; modest dipole–dipole on top of LDF.' },
  { formula: 'HF',   bp:   20, dominant: 'hbond',     note: 'H–F enables strong hydrogen bonding.' },
  { formula: 'H₂O',  bp:  100, dominant: 'hbond',     note: 'Two H-bond donors and two acceptors per molecule.' },
  { formula: 'NaCl(aq)', bp: 100, dominant: 'iondipole', note: 'Ion–dipole solvation; lattice broken by water.' },
];

const ATOM = { H: '#f0e6d2', O: '#ff5b3c', N: '#5dd0ff', C: '#7d8d99', Cl: '#69e36b', F: '#bef264', Na: '#a78bfa' };

// Orientation factor: how the second molecule's rotation modulates U.
// θ=0 → +1 (head-to-tail, max attraction). θ=180 → −1 (opposed).
function orientFactor(meta: IMFMeta, thetaDeg: number): number {
  if (meta.id === 'ldf') return 1; // LDF essentially orientation-independent
  return Math.cos((thetaDeg * Math.PI) / 180);
}

export default function IMF() {
  const [imfId, setImfId] = useState<IMFType>('hbond');
  const meta = IMF_LIST.find(m => m.id === imfId)!;
  const [r, setR] = useState<number>(meta.sigma);
  const [theta, setTheta] = useState<number>(0); // orientation, deg
  const [flicker, setFlicker] = useState<number>(0);
  const [hbondMode, setHbondMode] = useState<'single' | 'network'>('single');
  const rafRef = useRef<number>(0);
  const tRef = useRef<number>(0);

  useEffect(() => { setR(meta.sigma); setTheta(0); }, [imfId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let last = performance.now();
    const loop = (now: number) => {
      if (!document.hidden) {
        const dt = (now - last) / 1000;
        tRef.current += dt;
        if (imfId === 'ldf') {
          const phase = Math.floor(tRef.current * 5);
          setFlicker(((phase * 9301 + 49297) % 233280) / 233280);
        } else {
          setFlicker(0.5 + 0.5 * Math.sin(tRef.current * 1.4));
        }
      }
      last = now;
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    const onVis = () => { last = performance.now(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { cancelAnimationFrame(rafRef.current); document.removeEventListener('visibilitychange', onVis); };
  }, [imfId]);

  const oFactor = useMemo(() => orientFactor(meta, theta), [meta, theta]);
  const effectiveWell = meta.wellDepth * oFactor;
  const U = useMemo(() => potential(meta, r, oFactor), [meta, r, oFactor]);
  const force = useMemo(() => -dU(meta, r, oFactor), [meta, r, oFactor]);
  const direction: 'attract' | 'repel' | 'equilibrium' =
    Math.abs(force) < 0.05 ? 'equilibrium' : force < 0 ? 'attract' : 'repel';

  const ranking = [...IMF_LIST].sort((a, b) => a.wellDepth - b.wellDepth);
  const rankIndex = ranking.findIndex(m => m.id === imfId) + 1;

  // Predicted boiling point (very rough): linear map of |effectiveWell|.
  const predictedBP = Math.round(-180 + 3.4 * Math.max(0, effectiveWell));

  const reset = () => {
    setImfId('hbond');
    setR(IMF_LIST.find(m => m.id === 'hbond')!.sigma);
    setTheta(0);
    setHbondMode('single');
  };

  const showNetwork = imfId === 'hbond' && hbondMode === 'network';

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Tabs */}
      <div role="tablist" aria-label="IMF type" style={{ display: 'flex', flexWrap: 'wrap' }}>
        {IMF_LIST.map((m, i) => {
          const active = m.id === imfId;
          return (
            <button
              key={m.id}
              role="tab"
              aria-selected={active}
              onClick={() => setImfId(m.id)}
              className="mono"
              style={{
                padding: '10px 16px', fontSize: 11, letterSpacing: '0.14em',
                textTransform: 'uppercase',
                border: '1px solid var(--line-strong)',
                borderLeft: i === 0 ? '1px solid var(--line-strong)' : 0,
                background: active ? 'var(--paper)' : 'transparent',
                color: active ? 'var(--ink-0)' : 'var(--paper-dim)',
                fontWeight: active ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              {m.name}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
        <div className="serif" style={{ fontSize: 24, fontStyle: 'italic' }}>{meta.example}</div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--paper-dim)' }}>
          pair · {meta.pair} · typical {meta.energyMin}–{meta.energyMax} kJ/mol
        </div>
      </div>

      {/* H-bond mode toggle */}
      {imfId === 'hbond' && (
        <div style={{ display: 'flex', gap: 0, alignItems: 'center' }}>
          {(['single', 'network'] as const).map((mode, i) => {
            const active = hbondMode === mode;
            return (
              <button
                key={mode}
                onClick={() => setHbondMode(mode)}
                className="mono"
                style={{
                  padding: '6px 14px', fontSize: 10, letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  border: '1px solid var(--line-strong)',
                  borderLeft: i === 0 ? '1px solid var(--line-strong)' : 0,
                  background: active ? meta.color + '22' : 'transparent',
                  color: active ? meta.color : 'var(--paper-dim)',
                  fontWeight: active ? 600 : 400, cursor: 'pointer',
                }}
              >
                {mode === 'single' ? 'Single pair' : 'Network · 4 H₂O'}
              </button>
            );
          })}
          <span className="mono" style={{ fontSize: 10, color: 'var(--paper-faint)', marginLeft: 12 }}>
            {showNetwork ? 'H-bonds per molecule: 4 · tetrahedral coordination' : 'donor → acceptor pair'}
          </span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        {/* Scene */}
        <div style={{
          background: 'var(--ink-1)', border: '1px solid var(--line)',
          borderRadius: 6, aspectRatio: '1.5 / 1', padding: 18,
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div className="eyebrow">
              {showNetwork ? 'H-bond network · 4 H₂O' : `Two-particle box · r = ${r.toFixed(2)} Å · θ = ${theta.toFixed(0)}°`}
            </div>
            <div className="mono" style={{ fontSize: 10, color: meta.color }}>{meta.short}</div>
          </div>

          {showNetwork
            ? <NetworkScene color={meta.color} />
            : <Scene meta={meta} r={r} theta={theta} flicker={flicker} onRotate={setTheta} />}

          <div style={{
            position: 'absolute', left: 18, right: 18, bottom: 12,
            fontSize: 12, color: 'var(--paper-dim)', lineHeight: 1.4,
            borderTop: '1px solid var(--line)', paddingTop: 8,
          }}>
            <span className="eyebrow" style={{ color: meta.color }}>Note · </span>
            {showNetwork
              ? 'Each water molecule donates 2 H-bonds and accepts 2 → tetrahedral coordination, basis of ice’s open lattice and water’s high BP.'
              : meta.desc}
          </div>
        </div>

        {/* Controls + readouts */}
        <div style={{
          background: 'var(--ink-1)', border: '1px solid var(--line)',
          borderRadius: 6, padding: 20,
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div className="eyebrow">Molecular separation</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span className="serif" style={{ fontSize: 24, color: meta.color }}>{r.toFixed(2)} Å</span>
            <span className="mono" style={{ fontSize: 10, color: 'var(--paper-faint)' }}>
              σ ≈ {meta.sigma.toFixed(2)} Å
            </span>
          </div>
          <input
            type="range"
            min={meta.rangeMin} max={meta.rangeMax} step={0.05}
            value={r} onChange={(e) => setR(Number(e.target.value))}
            style={{ width: '100%', accentColor: meta.color }}
          />

          <div className="eyebrow" style={{ marginTop: 4 }}>Orientation θ</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span className="serif" style={{ fontSize: 20, color: meta.color }}>{theta.toFixed(0)}°</span>
            <span className="mono" style={{ fontSize: 9, color: 'var(--paper-faint)' }}>
              cos θ = {oFactor.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min={0} max={180} step={1}
            value={theta} onChange={(e) => setTheta(Number(e.target.value))}
            style={{ width: '100%', accentColor: meta.color }}
            disabled={showNetwork}
          />
          {meta.id === 'ldf' && (
            <div className="mono" style={{ fontSize: 9, color: 'var(--paper-faint)' }}>
              rotation has minimal effect on LDF (transient, isotropic)
            </div>
          )}

          {/* Potential curve */}
          <PotentialCurve meta={meta} r={r} oFactor={oFactor} />

          {/* Live readouts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
            <Stat label="U(r,θ)" value={`${U.toFixed(2)} kJ/mol`} accent={U < 0 ? 'var(--cool)' : 'var(--hot)'} />
            <Stat label="Force"
              value={direction === 'attract' ? '⟵ attract ⟶' : direction === 'repel' ? '← repel →' : 'equilibrium'}
              accent={direction === 'attract' ? meta.color : direction === 'repel' ? '#ff6b35' : 'var(--phos)'} />
            <Stat label="Eff. well" value={`${effectiveWell.toFixed(1)} kJ/mol`} accent={meta.color} />
            <Stat label="Rank" value={`${rankIndex} / ${IMF_LIST.length}`} />
          </div>

          {/* Energy contribution mini-bar + BP predictor pill */}
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10, display: 'grid', gap: 10 }}>
            <ContributionBar meta={meta} />
            <BPpill predictedBP={predictedBP} color={meta.color} />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={reset} className="mono" style={ctrlBtn}>■ Reset</button>
            <button onClick={() => { setR(meta.sigma); setTheta(0); }} className="mono" style={ctrlBtn}>↺ r,θ → 0</button>
          </div>
        </div>
      </div>

      {/* Strength comparison + boiling-point table */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16 }}>
        <StrengthChart selected={imfId} onPick={setImfId} />
        <BoilingTable selected={imfId} onPick={(row) => setImfId(row.dominant)} />
      </div>
    </div>
  );
}

// ────────── physics ──────────

function potential(meta: IMFMeta, r: number, oFactor = 1): number {
  // U(r) = 4ε[(σ/r)^p − (σ/r)^q]; ε scaled by orientation factor.
  const eps = meta.wellDepth * oFactor;
  const s = meta.sigma;
  const x = s / r;
  if (meta.id === 'iondipole') {
    return 4 * eps * (Math.pow(x, 12) - Math.pow(x, 4));
  }
  return 4 * eps * (Math.pow(x, 12) - Math.pow(x, 6));
}

function dU(meta: IMFMeta, r: number, oFactor = 1): number {
  const h = 0.005;
  return (potential(meta, r + h, oFactor) - potential(meta, r - h, oFactor)) / (2 * h);
}

// ────────── scene ──────────

function Scene({ meta, r, theta, flicker, onRotate }: {
  meta: IMFMeta; r: number; theta: number; flicker: number;
  onRotate: (deg: number) => void;
}) {
  const gapPct = (r - meta.rangeMin) / (meta.rangeMax - meta.rangeMin);
  const gapPx = 60 + gapPct * 220;

  const rightRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const startRef = useRef<{ cx: number; cy: number; baseTheta: number; startAngle: number } | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const el = rightRef.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx, dy = e.clientY - cy;
    const startAngle = Math.atan2(dy, dx) * 180 / Math.PI;
    startRef.current = { cx, cy, baseTheta: theta, startAngle };
    draggingRef.current = true;
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }, [theta]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current || !startRef.current) return;
    const { cx, cy, baseTheta, startAngle } = startRef.current;
    const dx = e.clientX - cx, dy = e.clientY - cy;
    const ang = Math.atan2(dy, dx) * 180 / Math.PI;
    let next = baseTheta + (ang - startAngle);
    // Clamp/wrap to 0..180
    next = ((next % 360) + 360) % 360;
    if (next > 180) next = 360 - next;
    onRotate(next);
  }, [onRotate]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    draggingRef.current = false;
    startRef.current = null;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  }, []);

  return (
    <div style={{
      position: 'absolute', inset: '40px 18px 80px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: gapPx, transition: 'gap 120ms ease' }}>
        <MoleculeLeft meta={meta} flicker={flicker} />
        <Connector meta={meta} flicker={flicker} r={r} />
        <div
          ref={rightRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{
            transform: `rotate(${theta}deg)`,
            transition: draggingRef.current ? 'none' : 'transform 120ms ease',
            cursor: 'grab', touchAction: 'none',
          }}
          title="Drag to rotate"
        >
          <MoleculeRight meta={meta} flicker={flicker} />
        </div>
      </div>
      {/* angle annotation */}
      <div className="mono" style={{
        position: 'absolute', right: 4, top: 4, fontSize: 9, color: 'var(--paper-faint)',
      }}>
        bond ≈ {meta.id === 'hbond' ? '0.96' : meta.id === 'dipole' ? '1.27' : meta.id === 'ldf' ? '1.09' : '0.96'} Å
        {meta.id === 'hbond' || meta.id === 'iondipole' ? ' · ∠HOH 104.5°' : ''}
      </div>
    </div>
  );
}

function Connector({ meta, flicker, r }: { meta: IMFMeta; flicker: number; r: number }) {
  const opacity = 0.35 + 0.55 * flicker;
  if (meta.id === 'hbond') {
    return (
      <svg width={70} height={40} style={{ overflow: 'visible' }}>
        <line x1={0} y1={20} x2={70} y2={20} stroke={meta.color} strokeWidth={2}
          strokeDasharray="4 4" opacity={opacity} />
        <text x={35} y={12} textAnchor="middle" fontFamily="JetBrains Mono"
          fontSize={9} fill={meta.color} letterSpacing="0.14em">H-BOND</text>
        <text x={35} y={34} textAnchor="middle" fontFamily="JetBrains Mono"
          fontSize={8} fill="rgba(245,241,232,0.55)">{r.toFixed(2)} Å</text>
      </svg>
    );
  }
  return (
    <svg width={50} height={28} style={{ overflow: 'visible' }}>
      <line x1={0} y1={10} x2={50} y2={10} stroke={meta.color} strokeWidth={1.4}
        strokeDasharray="3 4" opacity={opacity} />
      <text x={25} y={24} textAnchor="middle" fontFamily="JetBrains Mono"
        fontSize={8} fill="rgba(245,241,232,0.45)">{r.toFixed(2)} Å</text>
    </svg>
  );
}

function MoleculeLeft({ meta, flicker }: { meta: IMFMeta; flicker: number }) {
  switch (meta.id) {
    case 'ldf':       return <Methane flickerSign={flicker > 0.5 ? '+' : '−'} color={meta.color} />;
    case 'dipole':    return <HCl />;
    case 'hbond':     return <Water orient="hRight" />;
    case 'iondipole': return <NaIon />;
  }
}

function MoleculeRight({ meta, flicker }: { meta: IMFMeta; flicker: number }) {
  switch (meta.id) {
    case 'ldf':       return <Methane flickerSign={flicker > 0.5 ? '−' : '+'} color={meta.color} />;
    case 'dipole':    return <HCl />;
    case 'hbond':     return <Water orient="oxygenLeft" lonePair />;
    case 'iondipole': return <Water orient="oxygenLeft" />;
  }
}

// ────────── molecule renderers ──────────

function Atom({ symbol, color, size, glow }: { symbol: string; color: string; size: number; glow?: boolean }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `radial-gradient(circle at 35% 30%, #fff8 0%, ${color} 60%)`,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      color: '#0a0908', fontFamily: 'JetBrains Mono', fontSize: size * 0.42, fontWeight: 600,
      boxShadow: glow ? `0 0 ${size * 0.5}px ${color}77` : 'none',
      flexShrink: 0,
    }}>{symbol}</div>
  );
}

function ChargeTag({ sign, color, dx = 0, dy = 0 }: { sign: string; color: string; dx?: number; dy?: number }) {
  return (
    <span className="mono" style={{
      position: 'absolute', left: dx, top: dy, fontSize: 11,
      color, fontWeight: 600, textShadow: '0 0 6px rgba(0,0,0,0.7)',
    }}>{sign}</span>
  );
}

function Methane({ flickerSign, color }: { flickerSign: '+' | '−'; color: string }) {
  return (
    <div style={{ position: 'relative', width: 90, height: 90 }}>
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: `radial-gradient(circle at ${flickerSign === '+' ? '30%' : '70%'} 50%, ${color}33 0%, transparent 65%)`,
        transition: 'background 200ms',
      }} />
      <div style={{ position: 'absolute', left: 30, top: 30 }}><Atom symbol="C" color={ATOM.C} size={32} /></div>
      <div style={{ position: 'absolute', left: 6,  top: 6  }}><Atom symbol="H" color={ATOM.H} size={20} /></div>
      <div style={{ position: 'absolute', right: 6, top: 6  }}><Atom symbol="H" color={ATOM.H} size={20} /></div>
      <div style={{ position: 'absolute', left: 6,  bottom: 6 }}><Atom symbol="H" color={ATOM.H} size={20} /></div>
      <div style={{ position: 'absolute', right: 6, bottom: 6 }}><Atom symbol="H" color={ATOM.H} size={20} /></div>
      <ChargeTag sign={`δ${flickerSign}`} color={flickerSign === '+' ? '#ff6b35' : '#5dd0ff'}
        dx={flickerSign === '+' ? -4 : 78} dy={38} />
    </div>
  );
}

function HCl() {
  return (
    <div style={{ position: 'relative', width: 100, height: 60, display: 'flex', alignItems: 'center' }}>
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 30,
        background: 'linear-gradient(90deg, rgba(255,107,53,0.18) 0%, transparent 50%, rgba(93,208,255,0.20) 100%)',
      }} />
      <div style={{ position: 'absolute', left: 4 }}><Atom symbol="H" color={ATOM.H} size={26} /></div>
      <div style={{ position: 'absolute', left: 26, top: 26, width: 24, height: 3, background: 'rgba(245,241,232,0.6)' }} />
      <div style={{ position: 'absolute', left: 50 }}><Atom symbol="Cl" color={ATOM.Cl} size={42} glow /></div>
      <ChargeTag sign="δ+" color="#ff6b35" dx={2}  dy={-12} />
      <ChargeTag sign="δ−" color="#5dd0ff" dx={70} dy={-12} />
    </div>
  );
}

function Water({ orient, lonePair }: { orient: 'oxygenLeft' | 'hRight'; lonePair?: boolean }) {
  // Two layouts: oxygenLeft (O on left, two Hs on right) or hRight (H on right, O on left)
  if (orient === 'hRight') {
    return (
      <div style={{ position: 'relative', width: 90, height: 70 }}>
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 35,
          background: 'radial-gradient(circle at 25% 50%, rgba(255,91,60,0.25) 0%, transparent 55%)',
        }} />
        <div style={{ position: 'absolute', left: 6, top: 18 }}><Atom symbol="O" color={ATOM.O} size={36} glow /></div>
        <div style={{ position: 'absolute', left: 50, top: 4 }}><Atom symbol="H" color={ATOM.H} size={22} /></div>
        <div style={{ position: 'absolute', left: 50, top: 40 }}><Atom symbol="H" color={ATOM.H} size={22} /></div>
        <ChargeTag sign="δ−" color="#5dd0ff" dx={4}  dy={2} />
        <ChargeTag sign="δ+" color="#ff6b35" dx={68} dy={-8} />
      </div>
    );
  }
  return (
    <div style={{ position: 'relative', width: 90, height: 70 }}>
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 35,
        background: 'radial-gradient(circle at 25% 50%, rgba(93,208,255,0.30) 0%, transparent 55%)',
      }} />
      <div style={{ position: 'absolute', left: 6, top: 18 }}><Atom symbol="O" color={ATOM.O} size={36} glow /></div>
      <div style={{ position: 'absolute', left: 50, top: 2 }}><Atom symbol="H" color={ATOM.H} size={22} /></div>
      <div style={{ position: 'absolute', left: 50, top: 42 }}><Atom symbol="H" color={ATOM.H} size={22} /></div>
      <ChargeTag sign="δ−" color="#5dd0ff" dx={2}  dy={4} />
      <ChargeTag sign="δ+" color="#ff6b35" dx={66} dy={-6} />
      {lonePair && (
        <span className="mono" style={{
          position: 'absolute', left: -2, top: 30, fontSize: 16, color: '#5dd0ff', letterSpacing: 1,
        }}>: :</span>
      )}
    </div>
  );
}

function NaIon() {
  return (
    <div style={{ position: 'relative', width: 60, height: 60 }}>
      <div style={{
        position: 'absolute', inset: -6, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(167,139,250,0.35) 0%, transparent 70%)',
      }} />
      <div style={{ position: 'absolute', left: 4, top: 4 }}><Atom symbol="Na" color={ATOM.Na} size={52} glow /></div>
      <span className="mono" style={{
        position: 'absolute', right: -2, top: -4, fontSize: 14, color: '#a78bfa', fontWeight: 700,
      }}>+</span>
    </div>
  );
}

// ────────── network scene ──────────

function NetworkScene({ color }: { color: string }) {
  // 4 waters: one central + 3 around in tetrahedral-ish 2D projection.
  // Central donates 2 H-bonds (down-left, down-right) and accepts 2 (up-left, up-right).
  const W = 420, H = 240;
  const cx = W / 2, cy = H / 2 + 6;
  const R = 92;
  const positions = [
    { x: cx,        y: cy,           label: 'central' },
    { x: cx - R,    y: cy - R * 0.65, label: 'acc-L' }, // accepts H from central
    { x: cx + R,    y: cy - R * 0.65, label: 'acc-R' },
    { x: cx - R,    y: cy + R * 0.65, label: 'don-L' }, // donates H to central
    { x: cx + R,    y: cy + R * 0.65, label: 'don-R' },
  ];
  // Tiny water glyph for SVG
  const waterGlyph = (px: number, py: number, key: string, rot = 0) => (
    <g key={key} transform={`translate(${px} ${py}) rotate(${rot})`}>
      <circle r={14} fill="url(#oGrad)" stroke="#ff5b3c" strokeOpacity={0.5} />
      <text x={0} y={4} textAnchor="middle" fontFamily="JetBrains Mono" fontSize={11} fill="#0a0908" fontWeight={600}>O</text>
      <circle cx={14} cy={-10} r={6} fill={ATOM.H} stroke="#fff3" />
      <text x={14} y={-7} textAnchor="middle" fontFamily="JetBrains Mono" fontSize={7} fill="#0a0908" fontWeight={600}>H</text>
      <circle cx={14} cy={10} r={6} fill={ATOM.H} stroke="#fff3" />
      <text x={14} y={13} textAnchor="middle" fontFamily="JetBrains Mono" fontSize={7} fill="#0a0908" fontWeight={600}>H</text>
      <text x={-22} y={-8} fontFamily="JetBrains Mono" fontSize={8} fill="#5dd0ff">δ−</text>
      <text x={22} y={-14} fontFamily="JetBrains Mono" fontSize={8} fill="#ff6b35">δ+</text>
      {/* lone pair lobes */}
      <circle cx={-12} cy={-6} r={2} fill="#5dd0ff" opacity={0.7} />
      <circle cx={-12} cy={6} r={2} fill="#5dd0ff" opacity={0.7} />
    </g>
  );
  // 4 H-bonds between central and the four neighbors
  const bonds = positions.slice(1).map((p, i) => ({
    x1: cx, y1: cy, x2: p.x, y2: p.y, key: `b${i}`,
  }));
  return (
    <div style={{ position: 'absolute', inset: '40px 18px 80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxHeight: '100%' }}>
        <defs>
          <radialGradient id="oGrad" cx="35%" cy="30%">
            <stop offset="0%" stopColor="#fff8" />
            <stop offset="60%" stopColor={ATOM.O} />
          </radialGradient>
        </defs>
        {bonds.map(b => (
          <g key={b.key}>
            <line x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2}
              stroke={color} strokeWidth={2} strokeDasharray="4 4" opacity={0.7} />
            <text x={(b.x1 + b.x2) / 2} y={(b.y1 + b.y2) / 2 - 4}
              textAnchor="middle" fontFamily="JetBrains Mono" fontSize={8}
              fill="rgba(245,241,232,0.7)">1.97 Å</text>
          </g>
        ))}
        {positions.map((p, i) => waterGlyph(p.x, p.y, `w${i}`, i === 0 ? 0 : (i % 2 === 0 ? -20 : 20)))}
      </svg>
    </div>
  );
}

// ────────── potential curve ──────────

function PotentialCurve({ meta, r, oFactor }: { meta: IMFMeta; r: number; oFactor: number }) {
  const W = 320, H = 110, PAD = 22;
  const N = 120;
  const rs: number[] = [];
  const us: number[] = [];
  const wellAbs = Math.abs(meta.wellDepth);
  for (let i = 0; i < N; i++) {
    const rr = meta.rangeMin + (meta.rangeMax - meta.rangeMin) * (i / (N - 1));
    rs.push(rr);
    us.push(Math.max(-wellAbs * 1.3, Math.min(wellAbs * 1.5, potential(meta, rr, oFactor))));
  }
  const uMin = Math.min(...us, -0.1);
  const uMax = Math.max(...us, 0.1);
  const xOf = (rr: number) => PAD + ((rr - meta.rangeMin) / (meta.rangeMax - meta.rangeMin)) * (W - 2 * PAD);
  const yOf = (uu: number) => PAD + (1 - (uu - uMin) / (uMax - uMin)) * (H - 2 * PAD);
  const path = us.map((u, i) => `${i === 0 ? 'M' : 'L'} ${xOf(rs[i]).toFixed(1)} ${yOf(u).toFixed(1)}`).join(' ');
  const zeroY = yOf(0);
  const cx = xOf(r);
  const cy = yOf(Math.max(uMin, Math.min(uMax, potential(meta, r, oFactor))));

  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 4 }}>Potential energy U(r,θ)</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 110, display: 'block' }}>
        <rect x={0} y={0} width={W} height={H} fill="var(--ink-2)" />
        <line x1={PAD} y1={zeroY} x2={W - PAD} y2={zeroY} stroke="rgba(245,241,232,0.25)" strokeDasharray="2 3" />
        <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="rgba(245,241,232,0.4)" />
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="rgba(245,241,232,0.4)" />
        <path d={path} fill="none" stroke={meta.color} strokeWidth={2} />
        <line x1={cx} y1={PAD} x2={cx} y2={H - PAD} stroke={meta.color} strokeDasharray="3 3" opacity={0.5} />
        <circle cx={cx} cy={cy} r={5} fill={meta.color} stroke="var(--ink-0)" strokeWidth={1.5} />
        <text x={W - PAD} y={H - 6} textAnchor="end" fontFamily="JetBrains Mono" fontSize={9} fill="rgba(245,241,232,0.5)">r (Å)</text>
        <text x={PAD + 4} y={PAD + 8} fontFamily="JetBrains Mono" fontSize={9} fill="rgba(245,241,232,0.5)">U</text>
        <text x={PAD - 4} y={zeroY - 2} textAnchor="end" fontFamily="JetBrains Mono" fontSize={8} fill="rgba(245,241,232,0.4)">0</text>
      </svg>
    </div>
  );
}

// ────────── contribution bar + BP pill ──────────

function ContributionBar({ meta }: { meta: IMFMeta }) {
  const ldfPct = Math.round(meta.ldfFraction * 100);
  const otherPct = 100 - ldfPct;
  const otherLabel = meta.id === 'ldf' ? '—' : meta.short;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span className="eyebrow">Energy contribution</span>
        <span className="mono" style={{ fontSize: 9, color: 'var(--paper-faint)' }}>
          LDF {ldfPct}% · {otherLabel} {otherPct}%
        </span>
      </div>
      <div style={{ display: 'flex', height: 10, borderRadius: 2, overflow: 'hidden', border: '1px solid var(--line)' }}>
        <div style={{ width: `${ldfPct}%`, background: '#5dd0ff' }} />
        <div style={{ width: `${otherPct}%`, background: meta.color }} />
      </div>
    </div>
  );
}

function BPpill({ predictedBP, color }: { predictedBP: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span className="eyebrow">BP predictor</span>
      <span className="mono" style={{
        padding: '4px 10px', borderRadius: 999,
        border: `1px solid ${color}`, color,
        fontSize: 11, fontWeight: 600, background: `${color}11`,
      }}>
        ≈ {predictedBP > 0 ? '+' : ''}{predictedBP} °C
      </span>
      <span className="mono" style={{ fontSize: 9, color: 'var(--paper-faint)' }}>from eff. well depth</span>
    </div>
  );
}

// ────────── strength chart ──────────

function StrengthChart({ selected, onPick }: { selected: IMFType; onPick: (id: IMFType) => void }) {
  const sorted = [...IMF_LIST].sort((a, b) => b.energyMax - a.energyMax);
  const maxAll = Math.max(...sorted.map(m => m.energyMax));
  return (
    <div style={{ background: 'var(--ink-1)', border: '1px solid var(--line)', borderRadius: 6, padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="eyebrow">Typical IMF strength · kJ/mol</div>
        <div className="mono" style={{ fontSize: 10, color: 'var(--paper-faint)' }}>log scale</div>
      </div>
      <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
        {sorted.map(m => {
          const active = m.id === selected;
          const lo = Math.log10(Math.max(0.01, m.energyMin));
          const hi = Math.log10(m.energyMax);
          const totalLo = Math.log10(0.05);
          const totalHi = Math.log10(maxAll);
          const left  = ((lo - totalLo) / (totalHi - totalLo)) * 100;
          const right = ((hi - totalLo) / (totalHi - totalLo)) * 100;
          return (
            <button
              key={m.id}
              onClick={() => onPick(m.id)}
              style={{
                background: 'transparent', border: 'none', textAlign: 'left',
                padding: 0, cursor: 'pointer', color: 'var(--paper)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span className="mono" style={{ fontSize: 11, color: active ? m.color : 'var(--paper-dim)', fontWeight: active ? 600 : 400 }}>
                  {m.name}
                </span>
                <span className="mono" style={{ fontSize: 10, color: 'var(--paper-faint)' }}>
                  {m.energyMin}–{m.energyMax}
                </span>
              </div>
              <div style={{ position: 'relative', height: 14, background: 'var(--ink-2)', borderRadius: 2 }}>
                <div style={{
                  position: 'absolute', left: `${left}%`, width: `${right - left}%`, top: 0, bottom: 0,
                  background: active
                    ? `linear-gradient(90deg, ${m.color}cc, ${m.color}66)`
                    : `linear-gradient(90deg, ${m.color}55, ${m.color}22)`,
                  border: active ? `1px solid ${m.color}` : '1px solid transparent',
                  borderRadius: 2,
                  transition: 'all 150ms',
                }} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ────────── boiling-point table ──────────

function BoilingTable({ selected, onPick }: { selected: IMFType; onPick: (row: BPRow) => void }) {
  const bpMin = Math.min(...BPS.map(r => r.bp));
  const bpMax = Math.max(...BPS.map(r => r.bp));
  return (
    <div style={{ background: 'var(--ink-1)', border: '1px solid var(--line)', borderRadius: 6, padding: 20 }}>
      <div className="eyebrow">Representative boiling points</div>
      <div className="mono" style={{ fontSize: 10, color: 'var(--paper-faint)', marginTop: 4 }}>
        click a row to load the dominant IMF
      </div>
      <div style={{ marginTop: 12, display: 'grid', gap: 6 }}>
        {BPS.map(row => {
          const m = IMF_LIST.find(x => x.id === row.dominant)!;
          const active = m.id === selected;
          const w = ((row.bp - bpMin) / (bpMax - bpMin)) * 100;
          return (
            <button
              key={row.formula}
              onClick={() => onPick(row)}
              title={row.note}
              style={{
                background: active ? 'var(--ink-2)' : 'transparent',
                border: `1px solid ${active ? m.color : 'var(--line)'}`,
                borderRadius: 4, padding: '6px 10px',
                display: 'grid', gridTemplateColumns: '70px 1fr 60px', alignItems: 'center', gap: 8,
                cursor: 'pointer', color: 'var(--paper)', textAlign: 'left',
              }}
            >
              <span className="serif" style={{ fontSize: 15, fontStyle: 'italic' }}>{row.formula}</span>
              <span style={{ position: 'relative', height: 8, background: 'var(--ink-2)', borderRadius: 2 }}>
                <span style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0, width: `${w}%`,
                  background: m.color, opacity: 0.6, borderRadius: 2,
                }} />
              </span>
              <span className="mono" style={{ fontSize: 10, color: m.color, textAlign: 'right' }}>
                {row.bp > 0 ? '+' : ''}{row.bp}°C
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ────────── small atoms ──────────

const ctrlBtn: React.CSSProperties = {
  flex: 1, padding: '8px 10px', fontSize: 10, letterSpacing: '0.14em',
  textTransform: 'uppercase', border: '1px solid var(--line-strong)',
  background: 'transparent', color: 'var(--paper)', cursor: 'pointer',
};

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 4 }}>{label}</div>
      <div className="serif" style={{ fontSize: 16, color: accent ?? 'var(--paper)' }}>{value}</div>
    </div>
  );
}
