import { useEffect, useMemo, useRef, useState } from 'react';
import { ELEMENTS, CATEGORY_COLOR, type Element } from '../data/elements';

/**
 * Orbital — electron-configuration + orbital-shape visualizer (Unit 1.4–1.7).
 *
 * Features:
 *   • Element selector (all 118) with quick-pick buttons.
 *   • Bohr-style shell diagram (left) — electrons orbit on shells.
 *   • Subshell filling chart (right) — Aufbau, Pauli, Hund. Animatable.
 *   • Orbital-shape panel — s, 2s, 2p_xyz, 3d_z², 3d_xy/xz/yz/x²−y² with
 *     rotating SVG isosurfaces.
 *   • Live readouts: full + noble-gas configs, valence, unpaired, n_max.
 *   • Special-case flags for Cr, Cu, Mo, Ag, Au, Pt, Pd, Nb, Ru, Rh, La, Ce, Gd.
 */

// ───── Aufbau ordering (Madelung n+l rule, ties broken by lower n) ─────
const AUFBAU: { name: string; cap: number; n: number; l: number }[] = [
  { name: '1s', cap: 2,  n: 1, l: 0 },
  { name: '2s', cap: 2,  n: 2, l: 0 },
  { name: '2p', cap: 6,  n: 2, l: 1 },
  { name: '3s', cap: 2,  n: 3, l: 0 },
  { name: '3p', cap: 6,  n: 3, l: 1 },
  { name: '4s', cap: 2,  n: 4, l: 0 },
  { name: '3d', cap: 10, n: 3, l: 2 },
  { name: '4p', cap: 6,  n: 4, l: 1 },
  { name: '5s', cap: 2,  n: 5, l: 0 },
  { name: '4d', cap: 10, n: 4, l: 2 },
  { name: '5p', cap: 6,  n: 5, l: 1 },
  { name: '6s', cap: 2,  n: 6, l: 0 },
  { name: '4f', cap: 14, n: 4, l: 3 },
  { name: '5d', cap: 10, n: 5, l: 2 },
  { name: '6p', cap: 6,  n: 6, l: 1 },
  { name: '7s', cap: 2,  n: 7, l: 0 },
  { name: '5f', cap: 14, n: 5, l: 3 },
  { name: '6d', cap: 10, n: 6, l: 2 },
  { name: '7p', cap: 6,  n: 7, l: 1 },
];

// Known anomalies (subset of the ~20 well-known ones). Each gives an explicit
// (subshell → electrons) override layered atop the strict Aufbau result.
const EXCEPTIONS: Record<number, { override: Record<string, number>; reason: string }> = {
  24: { override: { '4s': 1, '3d': 5  }, reason: 'Half-filled 3d⁵ is extra stable — promote one 4s electron.' },
  29: { override: { '4s': 1, '3d': 10 }, reason: 'Fully-filled 3d¹⁰ is extra stable — promote one 4s electron.' },
  41: { override: { '5s': 1, '4d': 4  }, reason: 'Niobium prefers 5s¹ 4d⁴ over 5s² 4d³.' },
  42: { override: { '5s': 1, '4d': 5  }, reason: 'Half-filled 4d⁵ stability (analogue of Cr).' },
  44: { override: { '5s': 1, '4d': 7  }, reason: 'Empirical: 5s¹ 4d⁷ lower energy than 5s² 4d⁶.' },
  45: { override: { '5s': 1, '4d': 8  }, reason: 'Empirical: 5s¹ 4d⁸ lower energy than 5s² 4d⁷.' },
  46: { override: { '5s': 0, '4d': 10 }, reason: 'Both 5s electrons promote — fully-filled 4d¹⁰ closes the shell.' },
  47: { override: { '5s': 1, '4d': 10 }, reason: 'Fully-filled 4d¹⁰ stability (analogue of Cu).' },
  57: { override: { '6s': 2, '5d': 1, '4f': 0 }, reason: 'La places its differentiating electron in 5d, not 4f.' },
  58: { override: { '6s': 2, '5d': 1, '4f': 1 }, reason: 'Ce: one electron in 5d in addition to 4f¹.' },
  64: { override: { '6s': 2, '5d': 1, '4f': 7 }, reason: 'Half-filled 4f⁷ stability — extra electron sits in 5d.' },
  78: { override: { '6s': 1, '5d': 9  }, reason: 'Pt favors 6s¹ 5d⁹.' },
  79: { override: { '6s': 1, '5d': 10 }, reason: 'Fully-filled 5d¹⁰ stability (analogue of Cu).' },
};

// Noble gases (used for shorthand)
const NOBLE: { z: number; sym: string }[] = [
  { z: 2, sym: 'He' }, { z: 10, sym: 'Ne' }, { z: 18, sym: 'Ar' },
  { z: 36, sym: 'Kr' }, { z: 54, sym: 'Xe' }, { z: 86, sym: 'Rn' },
];

type FilledShell = { name: string; cap: number; n: number; l: number; e: number };

function fillElectrons(z: number): FilledShell[] {
  const filled: FilledShell[] = AUFBAU.map(s => ({ ...s, e: 0 }));
  let remaining = z;
  for (const s of filled) {
    if (remaining <= 0) break;
    const e = Math.min(s.cap, remaining);
    s.e = e;
    remaining -= e;
  }
  // Apply exception override
  const ex = EXCEPTIONS[z];
  if (ex) {
    // Sum of overrides — the rest of the orbitals retain Aufbau values that
    // would have summed to (z - sum(override target subshells before fix)).
    // Strategy: find the subshells touched, set them; redistribute remainder
    // across the previously-filled lower subshells (which keep their value).
    const touched = new Set(Object.keys(ex.override));
    let acc = 0;
    for (const s of filled) {
      if (touched.has(s.name)) continue;
      acc += s.e;
    }
    const overrideSum = Object.values(ex.override).reduce((a, b) => a + b, 0);
    const expected = z - overrideSum;
    // If acc > expected, trim from highest-Madelung untouched filled subshell.
    if (acc !== expected) {
      let diff = acc - expected;
      for (let i = filled.length - 1; i >= 0 && diff > 0; i--) {
        const s = filled[i];
        if (touched.has(s.name) || s.e === 0) continue;
        const take = Math.min(s.e, diff);
        s.e -= take; diff -= take;
      }
    }
    for (const s of filled) {
      if (touched.has(s.name)) s.e = ex.override[s.name];
    }
  }
  return filled.filter(s => s.e > 0 || (ex && Object.prototype.hasOwnProperty.call(ex.override, s.name)));
}

// Sort filled subshells by principal quantum number / l for the configuration string.
function sortByNL(filled: FilledShell[]): FilledShell[] {
  return [...filled].sort((a, b) => a.n - b.n || a.l - b.l);
}

const SUPER = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
function sup(n: number): string {
  return String(n).split('').map(c => SUPER[Number(c)]).join('');
}

function configString(filled: FilledShell[]): string {
  return sortByNL(filled).filter(s => s.e > 0).map(s => `${s.name}${sup(s.e)}`).join(' ');
}

function nobleShorthand(z: number, filled: FilledShell[]): string {
  const sorted = sortByNL(filled).filter(s => s.e > 0);
  const noble = [...NOBLE].reverse().find(g => g.z < z);
  if (!noble) return configString(filled);
  // Compute the noble's filled config to know what to strip.
  const nobleFilled = sortByNL(fillElectrons(noble.z)).filter(s => s.e > 0);
  const nobleNames = new Set(nobleFilled.map(s => `${s.name}${s.e}`));
  const tail = sorted.filter(s => !nobleNames.has(`${s.name}${s.e}`));
  return `[${noble.sym}] ${tail.map(s => `${s.name}${sup(s.e)}`).join(' ')}`;
}

function valenceElectrons(filled: FilledShell[], period?: number): number {
  const sorted = sortByNL(filled).filter(s => s.e > 0);
  if (sorted.length === 0) return 0;
  // Outer shell = element's period (e.g. Pd is period 5 even though 5s is empty).
  const nOuter = period ?? Math.max(...sorted.map(s => s.n));
  // Valence = ns + np electrons in the outer shell (inner d/f not counted).
  let v = 0;
  for (const s of sorted) if (s.n === nOuter && (s.l === 0 || s.l === 1)) v += s.e;
  return v;
}

function unpairedElectrons(filled: FilledShell[]): number {
  let u = 0;
  for (const s of filled) {
    const orbitals = s.cap / 2;
    if (s.e <= orbitals) u += s.e; // Hund: all single
    else u += 2 * orbitals - s.e;  // remaining unpaired = orbitals - (paired orbitals)
  }
  return u;
}

// Group shells by principal quantum number for the Bohr diagram.
function shellPopulations(filled: FilledShell[]): number[] {
  const pop: number[] = [];
  for (const s of filled) {
    if (s.e === 0) continue;
    pop[s.n - 1] = (pop[s.n - 1] ?? 0) + s.e;
  }
  return pop.map(p => p ?? 0);
}

// ───── Quick-pick set ─────
const QUICK = ['H', 'C', 'N', 'O', 'Na', 'Cl', 'Fe', 'Cu'];

// ───── Component ─────
export default function Orbital() {
  const [z, setZ] = useState<number>(6); // Carbon
  const element = ELEMENTS.find(e => e.z === z) ?? ELEMENTS[5];

  const [shorthand, setShorthand] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [orbitalTab, setOrbitalTab] = useState<string>('2p_z');

  // Fill animation
  const [animating, setAnimating] = useState(false);
  const [animZ, setAnimZ] = useState<number>(z);
  const animTarget = useRef<number>(z);

  useEffect(() => { setAnimZ(z); animTarget.current = z; }, [z]);

  useEffect(() => {
    if (!animating) return;
    let raf = 0; let last = performance.now();
    const loop = (now: number) => {
      if (!document.hidden) {
        const dt = now - last;
        if (dt > 180) {
          setAnimZ(prev => {
            if (prev >= animTarget.current) { setAnimating(false); return animTarget.current; }
            return prev + 1;
          });
          last = now;
        }
      } else {
        last = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [animating]);

  const startAnimation = () => {
    animTarget.current = z;
    setAnimZ(1);
    setAnimating(true);
  };

  const displayedZ = animating ? animZ : z;
  const filled = useMemo(() => fillElectrons(displayedZ), [displayedZ]);
  const fullCfg = useMemo(() => configString(filled), [filled]);
  const shortCfg = useMemo(() => nobleShorthand(displayedZ, filled), [displayedZ, filled]);
  const valence = useMemo(() => valenceElectrons(filled, element.period), [filled, element.period]);
  const unpaired = useMemo(() => unpairedElectrons(filled), [filled]);
  const nMax = useMemo(() => Math.max(...filled.filter(s => s.e > 0).map(s => s.n), 0), [filled]);
  const exception = EXCEPTIONS[displayedZ];

  const accent = CATEGORY_COLOR[element.category];

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Quick-pick + element header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <span className="serif" style={{ fontSize: 30, color: accent }}>{element.sym}</span>
          <span className="serif" style={{ fontSize: 18, color: 'var(--paper)' }}>{element.name}</span>
          <span className="mono" style={{ fontSize: 11, color: 'var(--paper-dim)' }}>Z = {element.z} · {element.mass.toFixed(2)} u</span>
        </div>
        <div style={{ display: 'flex', gap: 0 }}>
          {QUICK.map((sym, i) => {
            const el = ELEMENTS.find(e => e.sym === sym);
            if (!el) return null;
            const active = el.z === z;
            return (
              <button key={sym} onClick={() => setZ(el.z)} className="mono"
                style={{
                  padding: '7px 11px', fontSize: 10, letterSpacing: '0.14em',
                  border: '1px solid var(--line-strong)',
                  borderLeft: i === 0 ? '1px solid var(--line-strong)' : 0,
                  background: active ? 'var(--paper)' : 'transparent',
                  color: active ? 'var(--ink-0)' : 'var(--paper-dim)',
                  cursor: 'pointer', fontWeight: active ? 600 : 400,
                }}>{sym}</button>
            );
          })}
        </div>
      </div>

      {/* Selector + toggles */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={z}
          onChange={(e) => setZ(Number(e.target.value))}
          className="mono"
          style={{
            padding: '9px 12px',
            background: 'var(--ink-2)',
            border: '1px solid var(--line-strong)',
            color: 'var(--paper)',
            fontSize: 11, letterSpacing: '0.1em', flex: 1, minWidth: 240,
          }}
        >
          {ELEMENTS.map(e => (
            <option key={e.z} value={e.z}>Z = {String(e.z).padStart(3, ' ')} · {e.sym} · {e.name}</option>
          ))}
        </select>
        <ControlBtn onClick={startAnimation}>{animating ? `■ z=${animZ}` : '↻ Animate fill'}</ControlBtn>
        <Toggle label="Noble shorthand" on={shorthand} onChange={setShorthand} />
        <Toggle label="Auto-rotate" on={autoRotate} onChange={setAutoRotate} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '0.9fr 1.4fr', gap: 16 }}>
        {/* Left: Bohr shell diagram */}
        <BohrDiagram filled={filled} z={displayedZ} accent={accent} />

        {/* Right: Subshell chart */}
        <div style={{
          background: 'var(--ink-1)', border: '1px solid var(--line)',
          borderRadius: 6, padding: 18,
          display: 'flex', flexDirection: 'column', gap: 12, minHeight: 380,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div className="eyebrow">Subshell filling · Aufbau</div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--paper-faint)' }}>
              n = {nMax} · valence {valence} e⁻ · unpaired {unpaired}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
            {AUFBAU.map((row) => {
              const f = filled.find(s => s.name === row.name);
              const e = f?.e ?? 0;
              if (e === 0 && row.n > nMax) return null;
              const orbitals = row.cap / 2;
              return (
                <div key={row.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="mono" style={{ width: 30, fontSize: 12, color: e > 0 ? 'var(--paper)' : 'var(--paper-faint)' }}>{row.name}</div>
                  <div style={{ display: 'flex', gap: 3 }}>
                    {Array.from({ length: orbitals }).map((_, oi) => {
                      // Hund: distribute one electron per orbital first, then pair
                      const singleCount = Math.min(orbitals, e);
                      const doubleCount = Math.max(0, e - orbitals);
                      const hasUp = oi < singleCount;
                      const hasDown = oi < doubleCount;
                      const filledBox = hasUp && hasDown;
                      return (
                        <div key={oi}
                          style={{
                            width: 24, height: 22,
                            border: '1px solid var(--line-strong)',
                            borderRadius: 2,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1,
                            background: filledBox ? `${accent}18` : hasUp ? `${accent}08` : 'transparent',
                          }}>
                          {hasUp && <span style={{ color: accent, fontSize: 12, lineHeight: 1, fontFamily: 'serif' }}>↑</span>}
                          {hasDown && <span style={{ color: '#fbbf24', fontSize: 12, lineHeight: 1, fontFamily: 'serif' }}>↓</span>}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mono" style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--paper-faint)' }}>
                    {e}/{row.cap}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Configuration readout */}
          <div style={{ marginTop: 'auto', borderTop: '1px solid var(--line)', paddingTop: 12 }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>{shorthand ? 'Noble-gas shorthand' : 'Full configuration'}</div>
            <div className="mono" style={{ fontSize: 13, color: accent, lineHeight: 1.5, wordBreak: 'break-all' }}>
              {shorthand ? shortCfg : fullCfg || '—'}
            </div>
          </div>

          {exception && (
            <div style={{
              padding: 10, borderRadius: 4,
              border: `1px solid ${accent}55`, background: `${accent}12`,
            }}>
              <div className="eyebrow" style={{ color: accent }}>EXCEPTION · Z = {displayedZ}</div>
              <div style={{ fontSize: 11, color: 'var(--paper)', marginTop: 4, lineHeight: 1.5 }}>
                {exception.reason}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Orbital shapes panel */}
      <OrbitalShapes tab={orbitalTab} setTab={setOrbitalTab} accent={accent} autoRotate={autoRotate} />

      {/* Caption */}
      <div className="mono" style={{
        fontSize: 10, color: 'var(--paper-faint)', letterSpacing: '0.14em',
        textTransform: 'uppercase', borderTop: '1px solid var(--line)', paddingTop: 12,
        textAlign: 'center',
      }}>
        AUFBAU: low-energy first · PAULI: 2 e⁻ per orbital, opposite spin · HUND: one per orbital before pairing
      </div>
    </div>
  );
}

// ───── Bohr shell diagram ─────
function BohrDiagram({ filled, z, accent }: { filled: FilledShell[]; z: number; accent: string }) {
  const pops = shellPopulations(filled);
  return (
    <div style={{
      background: 'var(--ink-1)', border: '1px solid var(--line)',
      borderRadius: 6, aspectRatio: '1 / 1', position: 'relative', overflow: 'hidden', minHeight: 320,
    }}>
      <div className="eyebrow" style={{ position: 'absolute', top: 14, left: 16 }}>
        Bohr model · Z = {z}
      </div>
      <div className="mono" style={{ position: 'absolute', top: 14, right: 16, fontSize: 10, color: 'var(--paper-faint)' }}>
        shells: {pops.map(p => p).join('·')}
      </div>
      <svg viewBox="-110 -110 220 220" style={{ width: '100%', height: '100%' }}>
        <defs>
          <radialGradient id="orb-nuc" cx="0.4" cy="0.4">
            <stop offset="0%" stopColor="#fff8d2" />
            <stop offset="50%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#ff5b3c" />
          </radialGradient>
          <radialGradient id="orb-e" cx="0.5" cy="0.5">
            <stop offset="0%" stopColor="#fff" stopOpacity="1" />
            <stop offset="40%" stopColor={accent} stopOpacity="1" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Shell rings */}
        {pops.map((_, i) => {
          const r = 22 + i * 16;
          return (
            <circle key={i} cx="0" cy="0" r={r}
              fill="none" stroke="rgba(245,241,232,0.15)" strokeWidth="0.5"
              strokeDasharray="2 3" />
          );
        })}

        {/* Nucleus */}
        <circle cx="0" cy="0" r="11" fill="url(#orb-nuc)" filter="drop-shadow(0 0 14px rgba(255,107,53,0.55))" />
        <text x="0" y="3.2" textAnchor="middle" fontSize="6.5" fill="#0a0908" fontFamily="JetBrains Mono" fontWeight="700">
          {z}+
        </text>

        {/* Electrons orbiting */}
        {pops.map((p, i) => {
          if (p === 0) return null;
          const r = 22 + i * 16;
          const dur = 6 + i * 2.5;
          return (
            <g key={i}>
              {Array.from({ length: p }).map((_, k) => {
                const offset = (k / p) * dur;
                return (
                  <circle key={k} r="2.4" fill="url(#orb-e)">
                    <animateMotion
                      dur={`${dur}s`}
                      repeatCount="indefinite"
                      path={`M ${r} 0 A ${r} ${r} 0 1 1 -${r} 0 A ${r} ${r} 0 1 1 ${r} 0`}
                      begin={`-${offset}s`}
                    />
                  </circle>
                );
              })}
              {/* Shell label */}
              <text x={r + 4} y="-3" fontSize="6" fontFamily="JetBrains Mono" fill="rgba(245,241,232,0.5)">
                n={i + 1}·{p}e⁻
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ───── Orbital shapes panel ─────
const SHAPE_TABS = ['1s', '2s', '2p_x', '2p_y', '2p_z', '3d_z²', '3d_xy', '3d_xz', '3d_yz', '3d_x²−y²'];

function OrbitalShapes({ tab, setTab, accent, autoRotate }: {
  tab: string; setTab: (t: string) => void; accent: string; autoRotate: boolean;
}) {
  // Self-rotating wrapper using requestAnimationFrame.
  const [angle, setAngle] = useState(0);
  useEffect(() => {
    if (!autoRotate) return;
    let raf = 0; let last = performance.now();
    const loop = (now: number) => {
      if (!document.hidden) {
        const dt = (now - last) / 1000;
        last = now;
        setAngle(a => (a + dt * 28) % 360);
      } else {
        last = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [autoRotate]);

  return (
    <div style={{
      background: 'var(--ink-1)', border: '1px solid var(--line)',
      borderRadius: 6, padding: 18,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div className="eyebrow">Orbital shape · ψ² isosurface</div>
        <div className="mono" style={{ fontSize: 10, color: 'var(--paper-faint)' }}>
          {orbitalDescription(tab)}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 0, marginBottom: 14 }}>
        {SHAPE_TABS.map((t, i) => {
          const active = t === tab;
          return (
            <button key={t} onClick={() => setTab(t)} className="mono"
              style={{
                padding: '7px 10px', fontSize: 10, letterSpacing: '0.1em',
                border: '1px solid var(--line-strong)',
                borderLeft: i === 0 ? '1px solid var(--line-strong)' : 0,
                background: active ? 'var(--paper)' : 'transparent',
                color: active ? 'var(--ink-0)' : 'var(--paper-dim)',
                fontWeight: active ? 600 : 400, cursor: 'pointer',
              }}>{t}</button>
          );
        })}
      </div>

      <div style={{
        background: 'var(--ink-2)', borderRadius: 4,
        aspectRatio: '2.4 / 1', display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden',
      }}>
        <svg viewBox="-100 -50 200 100" style={{ width: '100%', height: '100%' }}>
          <defs>
            <radialGradient id="lobe-pos" cx="0.35" cy="0.35">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.95" />
              <stop offset="40%" stopColor={accent} stopOpacity="0.85" />
              <stop offset="100%" stopColor={accent} stopOpacity="0.15" />
            </radialGradient>
            <radialGradient id="lobe-neg" cx="0.35" cy="0.35">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.9" />
              <stop offset="40%" stopColor="#fbbf24" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.1" />
            </radialGradient>
            <radialGradient id="lobe-shell" cx="0.5" cy="0.5">
              <stop offset="0%" stopColor={accent} stopOpacity="0.0" />
              <stop offset="70%" stopColor={accent} stopOpacity="0.4" />
              <stop offset="100%" stopColor={accent} stopOpacity="0" />
            </radialGradient>
          </defs>
          {/* Cartesian axes */}
          <g stroke="rgba(245,241,232,0.18)" strokeWidth="0.4">
            <line x1="-90" y1="0" x2="90" y2="0" />
            <line x1="0" y1="-45" x2="0" y2="45" />
          </g>
          <g fontFamily="JetBrains Mono" fontSize="5" fill="rgba(245,241,232,0.4)">
            <text x="92" y="2">x</text>
            <text x="-2" y="-46">z</text>
          </g>
          <g transform={`rotate(${angle * 0.5})`}>
            {renderShape(tab)}
          </g>
        </svg>
      </div>

      {/* Quantum number table */}
      <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        <Stat label="n" value={String(quantumOf(tab).n)} />
        <Stat label="ℓ" value={String(quantumOf(tab).l)} />
        <Stat label="orbital type" value={quantumOf(tab).type} />
        <Stat label="nodes" value={String(quantumOf(tab).nodes)} />
      </div>
    </div>
  );
}

function quantumOf(tab: string): { n: number; l: number; type: string; nodes: number } {
  if (tab === '1s')  return { n: 1, l: 0, type: 's', nodes: 0 };
  if (tab === '2s')  return { n: 2, l: 0, type: 's', nodes: 1 };
  if (tab.startsWith('2p')) return { n: 2, l: 1, type: 'p', nodes: 1 };
  if (tab.startsWith('3d')) return { n: 3, l: 2, type: 'd', nodes: 2 };
  return { n: 0, l: 0, type: '?', nodes: 0 };
}

function orbitalDescription(tab: string): string {
  const map: Record<string, string> = {
    '1s': 'spherically symmetric · no nodes',
    '2s': 'spherical with one radial node',
    '2p_x': 'two lobes along x · 1 angular node (yz plane)',
    '2p_y': 'two lobes along y',
    '2p_z': 'two lobes along z · 1 angular node (xy plane)',
    '3d_z²': 'two lobes on z + toroidal ring',
    '3d_xy': 'four lobes between x and y axes',
    '3d_xz': 'four lobes between x and z',
    '3d_yz': 'four lobes between y and z',
    '3d_x²−y²': 'four lobes along x and y axes',
  };
  return map[tab] ?? '';
}

function renderShape(tab: string): React.ReactNode {
  // 1s — single sphere
  if (tab === '1s') {
    return <ellipse cx="0" cy="0" rx="26" ry="26" fill="url(#lobe-pos)" />;
  }
  // 2s — sphere with inner shell (radial node)
  if (tab === '2s') {
    return (
      <>
        <ellipse cx="0" cy="0" rx="36" ry="36" fill="url(#lobe-shell)" />
        <ellipse cx="0" cy="0" rx="28" ry="28" fill="none" stroke={'rgba(245,241,232,0.35)'} strokeWidth="0.4" strokeDasharray="1.5 2" />
        <ellipse cx="0" cy="0" rx="14" ry="14" fill="url(#lobe-neg)" />
      </>
    );
  }
  // 2p — dumbbell along an axis
  if (tab.startsWith('2p')) {
    const axis = tab.slice(-1);
    // For x: lobes left/right; y: into-page (depict tilted); z: top/bottom
    if (axis === 'x') {
      return (
        <>
          <ellipse cx="-22" cy="0" rx="22" ry="14" fill="url(#lobe-pos)" />
          <ellipse cx="22"  cy="0" rx="22" ry="14" fill="url(#lobe-neg)" />
        </>
      );
    }
    if (axis === 'z') {
      return (
        <>
          <ellipse cx="0" cy="-20" rx="14" ry="22" fill="url(#lobe-pos)" />
          <ellipse cx="0" cy="20"  rx="14" ry="22" fill="url(#lobe-neg)" />
        </>
      );
    }
    // y — depict perspective dumbbell
    return (
      <>
        <ellipse cx="-14" cy="6" rx="18" ry="11" fill="url(#lobe-pos)" transform="rotate(-25)" />
        <ellipse cx="14"  cy="-6" rx="18" ry="11" fill="url(#lobe-neg)" transform="rotate(-25)" />
      </>
    );
  }
  // 3d_z² — donut + axial lobes
  if (tab === '3d_z²') {
    return (
      <>
        <ellipse cx="0" cy="0" rx="34" ry="9" fill="url(#lobe-shell)" />
        <ellipse cx="0" cy="0" rx="34" ry="9" fill="none" stroke={'rgba(245,241,232,0.3)'} strokeWidth="0.5" />
        <ellipse cx="0" cy="-22" rx="10" ry="20" fill="url(#lobe-pos)" />
        <ellipse cx="0" cy="22"  rx="10" ry="20" fill="url(#lobe-pos)" />
      </>
    );
  }
  // 3d clovers — four lobes
  if (tab === '3d_xy' || tab === '3d_xz' || tab === '3d_yz') {
    // Lobes between axes: rotated 45°
    return (
      <g transform="rotate(45)">
        <ellipse cx="-22" cy="0" rx="20" ry="11" fill="url(#lobe-pos)" />
        <ellipse cx="22"  cy="0" rx="20" ry="11" fill="url(#lobe-pos)" />
        <ellipse cx="0" cy="-22" rx="11" ry="20" fill="url(#lobe-neg)" />
        <ellipse cx="0" cy="22"  rx="11" ry="20" fill="url(#lobe-neg)" />
      </g>
    );
  }
  if (tab === '3d_x²−y²') {
    return (
      <>
        <ellipse cx="-26" cy="0" rx="22" ry="11" fill="url(#lobe-pos)" />
        <ellipse cx="26"  cy="0" rx="22" ry="11" fill="url(#lobe-pos)" />
        <ellipse cx="0" cy="-22" rx="11" ry="20" fill="url(#lobe-neg)" />
        <ellipse cx="0" cy="22"  rx="11" ry="20" fill="url(#lobe-neg)" />
      </>
    );
  }
  return null;
}

// ───── Small UI atoms ─────
function ControlBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="mono" style={{
      padding: '9px 14px', fontSize: 10, letterSpacing: '0.14em',
      textTransform: 'uppercase',
      border: '1px solid var(--line-strong)',
      background: 'transparent', color: 'var(--paper)', cursor: 'pointer',
    }}>{children}</button>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (b: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} className="mono" style={{
      padding: '9px 12px', fontSize: 10, letterSpacing: '0.14em',
      textTransform: 'uppercase',
      border: '1px solid var(--line-strong)',
      background: on ? 'var(--paper)' : 'transparent',
      color: on ? 'var(--ink-0)' : 'var(--paper-dim)',
      cursor: 'pointer', fontWeight: on ? 600 : 400,
    }}>{on ? '◉ ' : '○ '}{label}</button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 4 }}>{label}</div>
      <div className="serif" style={{ fontSize: 16, color: 'var(--paper)' }}>{value}</div>
    </div>
  );
}

// Suppress unused warning for typed import (kept for re-export consumers).
export type { Element };
