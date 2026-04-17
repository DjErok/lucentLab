import { useEffect, useMemo, useRef, useState } from 'react';
import { ELEMENTS } from '../data/elements';
import UISlider from '../components/ui/Slider';

/**
 * Photoelectron Spectroscopy (PES)
 * X-axis: binding energy (MJ/mol), high → low (left → right) per AP convention.
 * Peak height = number of electrons in that subshell.
 * Peak position = binding energy.
 * Click a peak to eject an electron with KE = photon_energy − binding_energy.
 */

type Subshell = { n: number; l: number; label: string; e: number; be: number };

// Aufbau filling order: list of (n, l) pairs in order of increasing energy.
const FILL_ORDER: Array<[number, number]> = [
  [1,0], [2,0], [2,1], [3,0], [3,1], [4,0], [3,2], [4,1],
  [5,0], [4,2], [5,1], [6,0], [4,3], [5,2], [6,1],
  [7,0], [5,3], [6,2], [7,1],
];
const L_LABEL = ['s', 'p', 'd', 'f'];
const L_CAPACITY = [2, 6, 10, 14];

// Color by principal quantum number n.
const SHELL_COLOR: Record<number, string> = {
  1: '#5dd0ff', // n=1 — cool blue
  2: '#fbbf24', // n=2 — amber
  3: '#ff6b35', // n=3 — orange-red
  4: '#a78bfa', // n=4 — violet
  5: '#69e36b', // n=5 — green
  6: '#ec4899', // n=6 — pink
  7: '#f0e6d2', // n=7 — paper
};

// Empirical binding energies (MJ/mol) for the first 20 elements — AP-textbook ranges.
// Keyed as `${Z}-${n}${l}`. Values approximate from NIST / common AP tables.
const BE_TABLE: Record<string, number> = {
  // H, He
  '1-1s': 1.31, '2-1s': 2.37,
  // Li
  '3-1s': 6.26, '3-2s': 0.52,
  // Be
  '4-1s': 11.5, '4-2s': 0.90,
  // B
  '5-1s': 19.3, '5-2s': 1.36, '5-2p': 0.80,
  // C
  '6-1s': 28.6, '6-2s': 1.72, '6-2p': 1.09,
  // N
  '7-1s': 39.6, '7-2s': 2.45, '7-2p': 1.40,
  // O
  '8-1s': 52.6, '8-2s': 3.12, '8-2p': 1.31,
  // F
  '9-1s': 67.2, '9-2s': 3.88, '9-2p': 1.68,
  // Ne
  '10-1s': 84.0, '10-2s': 4.68, '10-2p': 2.08,
  // Na
  '11-1s': 104, '11-2s': 6.84, '11-2p': 3.67, '11-3s': 0.50,
  // Mg
  '12-1s': 126, '12-2s': 9.07, '12-2p': 5.31, '12-3s': 0.74,
  // Al
  '13-1s': 151, '13-2s': 12.1, '13-2p': 7.79, '13-3s': 1.09, '13-3p': 0.58,
  // Si
  '14-1s': 178, '14-2s': 15.1, '14-2p': 10.3, '14-3s': 1.46, '14-3p': 0.79,
  // P
  '15-1s': 208, '15-2s': 18.7, '15-2p': 13.5, '15-3s': 1.95, '15-3p': 1.06,
  // S
  '16-1s': 239, '16-2s': 22.7, '16-2p': 16.5, '16-3s': 2.05, '16-3p': 1.00,
  // Cl
  '17-1s': 273, '17-2s': 26.8, '17-2p': 20.2, '17-3s': 2.44, '17-3p': 1.25,
  // Ar
  '18-1s': 309, '18-2s': 31.5, '18-2p': 24.1, '18-3s': 2.82, '18-3p': 1.52,
  // K
  '19-1s': 347, '19-2s': 37.1, '19-2p': 29.1, '19-3s': 3.93, '19-3p': 2.38, '19-4s': 0.42,
  // Ca
  '20-1s': 390, '20-2s': 42.7, '20-2p': 34.0, '20-3s': 4.65, '20-3p': 2.90, '20-4s': 0.59,
};

// Slater-style screening + hydrogenic approximation for Z > 20 fallback.
function bindingEnergy(n: number, l: number, z: number): number {
  const key = `${z}-${n}${L_LABEL[l]}`;
  if (BE_TABLE[key] != null) return BE_TABLE[key];
  // Effective nuclear charge: subtract crude screening (electrons in lower shells).
  // sigma ~ (Z - 1) for outermost; for inner shells use n-dependent screening.
  const sigma = innerScreening(n, l, z);
  const zEff = Math.max(1, z - sigma);
  // Rydberg in MJ/mol = 1.312 MJ/mol for hydrogen 1s.
  const E = 1.312 * (zEff * zEff) / (n * n);
  return E;
}

function innerScreening(n: number, _l: number, z: number): number {
  // Count of electrons in shells with principal number < n (rough Slater).
  let count = 0;
  let remaining = z;
  for (const [nn, ll] of FILL_ORDER) {
    const cap = L_CAPACITY[ll];
    const fill = Math.min(cap, remaining);
    if (fill <= 0) break;
    if (nn < n) count += fill;
    else if (nn === n) count += 0.35 * fill; // same-shell partial screening
    remaining -= fill;
    if (remaining <= 0) break;
  }
  return count;
}

// Build occupied subshells for an element of atomic number Z by Aufbau filling.
function subshellsFor(z: number): Subshell[] {
  let remaining = z;
  const out: Subshell[] = [];
  for (const [n, l] of FILL_ORDER) {
    if (remaining <= 0) break;
    const cap = L_CAPACITY[l];
    const fill = Math.min(cap, remaining);
    out.push({
      n, l,
      label: `${n}${L_LABEL[l]}`,
      e: fill,
      be: bindingEnergy(n, l, z),
    });
    remaining -= fill;
  }
  // Sort by binding energy descending (deepest first → leftmost on plot).
  return out.sort((a, b) => b.be - a.be);
}

const QUICK_PICK = ['H', 'He', 'Li', 'C', 'N', 'O', 'Ne', 'Na', 'Cl', 'Ar', 'K', 'Ca', 'Cu'];

export default function PES() {
  const [sym, setSym] = useState('C');
  const element = useMemo(() => ELEMENTS.find(e => e.sym === sym) ?? ELEMENTS[5], [sym]);
  const subshells = useMemo(() => subshellsFor(element.z), [element.z]);
  const totalE = subshells.reduce((s, p) => s + p.e, 0);

  const [logAxis, setLogAxis] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [photonE, setPhotonE] = useState(50);
  const [selected, setSelected] = useState<number | null>(null);
  const [ejection, setEjection] = useState<{ shellIdx: number; t: number } | null>(null);
  const rafRef = useRef<number>(0);
  const lastTime = useRef<number>(0);

  // Ejection animation loop
  useEffect(() => {
    if (!ejection) return;
    lastTime.current = performance.now();
    const loop = (now: number) => {
      if (document.hidden) {
        lastTime.current = now;
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      const dt = (now - lastTime.current) / 1000;
      lastTime.current = now;
      setEjection(prev => {
        if (!prev) return null;
        const next = prev.t + dt / 2.4; // ~2.4s animation
        if (next >= 1) return null;
        return { ...prev, t: next };
      });
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [ejection?.shellIdx]);

  // When element changes, reset selection
  useEffect(() => { setSelected(null); setEjection(null); }, [element.z]);

  // Plot domain
  const allBE = subshells.map(s => s.be);
  const dataMax = Math.max(...allBE, 10);
  const dataMin = Math.min(...allBE, 0.3);
  const domainMax = Math.max(dataMax * 1.3, 100);
  const domainMin = Math.max(0.1, Math.min(dataMin * 0.5, 0.3));

  const PLOT_W = 720, PLOT_H = 280;
  const PAD_L = 44, PAD_R = 24, PAD_T = 24, PAD_B = 48;
  const innerW = PLOT_W - PAD_L - PAD_R;
  const innerH = PLOT_H - PAD_T - PAD_B;

  // x: high BE on left → low BE on right. Log or linear toggle.
  const xPos = (e: number) => {
    const eClamped = Math.max(domainMin, Math.min(domainMax, e));
    if (logAxis) {
      const t = Math.log10(eClamped / domainMin) / Math.log10(domainMax / domainMin);
      return PAD_L + (1 - t) * innerW;
    }
    const t = (eClamped - domainMin) / (domainMax - domainMin);
    return PAD_L + (1 - t) * innerW;
  };

  const maxECount = Math.max(...subshells.map(s => s.e), 2);
  const yForCount = (c: number) => PAD_T + innerH - (c / maxECount) * innerH * 0.85;

  // Gaussian peak: width inversely proportional to sqrt(BE) — resolution-limited.
  const peakPath = (cx: number, height: number, energy: number): string => {
    // sigma in pixels. Higher BE → broader physically, but plot in log-x makes width stable.
    const sigmaX = logAxis ? 8 + 4 * Math.log10(1 + energy / 10) : Math.max(4, 6 + 0.001 * energy);
    const baseY = PAD_T + innerH;
    const peakY = baseY - height;
    const pts: string[] = [];
    const N = 40;
    for (let i = 0; i <= N; i++) {
      const x = cx - 4 * sigmaX + (8 * sigmaX) * (i / N);
      const dx = x - cx;
      const y = baseY - height * Math.exp(-(dx * dx) / (2 * sigmaX * sigmaX));
      pts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${Math.min(baseY, Math.max(peakY, y)).toFixed(1)}`);
    }
    pts.push(`L ${cx + 4 * sigmaX} ${baseY}`);
    pts.push(`L ${cx - 4 * sigmaX} ${baseY}`);
    pts.push('Z');
    return pts.join(' ');
  };

  // Tick values for axis
  const ticks = logAxis
    ? [0.1, 0.3, 1, 3, 10, 30, 100, 300, 1000, 3000].filter(t => t >= domainMin * 0.99 && t <= domainMax * 1.01)
    : niceTicks(domainMin, domainMax, 6);

  const triggerEjection = (idx: number) => {
    setSelected(idx);
    setEjection({ shellIdx: idx, t: 0 });
  };
  const demo = () => {
    // Eject from outermost (lowest BE) — last in sorted list
    const idx = subshells.length - 1;
    triggerEjection(idx);
  };

  const selectedShell = selected != null ? subshells[selected] : null;
  const canIonize = (be: number) => photonE >= be;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Banner */}
      <div className="mono" style={{
        fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
        color: 'var(--paper-dim)', padding: '10px 14px',
        border: '1px solid var(--line)', borderLeft: '3px solid var(--phos)',
        background: 'var(--ink-1)', borderRadius: 4,
      }}>
        Bigger peak = more electrons in that subshell · Further left (higher BE) = closer to the nucleus
      </div>

      {/* Quick-pick + dropdown */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div role="tablist" aria-label="Quick element" style={{ display: 'flex', flexWrap: 'wrap' }}>
          {QUICK_PICK.map((s, i) => {
            const active = sym === s;
            return (
              <button
                key={s}
                role="tab"
                aria-selected={active}
                onClick={() => setSym(s)}
                className="mono"
                style={{
                  padding: '8px 12px', fontSize: 11, letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  border: '1px solid var(--line-strong)',
                  borderLeft: i === 0 ? '1px solid var(--line-strong)' : 0,
                  background: active ? 'var(--paper)' : 'transparent',
                  color: active ? 'var(--ink-0)' : 'var(--paper-dim)',
                  fontWeight: active ? 600 : 400,
                  cursor: 'pointer',
                }}
              >{s}</button>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span className="eyebrow">All elements</span>
          <select
            value={sym}
            onChange={(e) => setSym(e.target.value)}
            className="mono"
            style={{
              padding: '6px 10px', fontSize: 12,
              background: 'var(--ink-1)', color: 'var(--paper)',
              border: '1px solid var(--line-strong)', borderRadius: 3,
              cursor: 'pointer',
            }}
          >
            {ELEMENTS.map(e => (
              <option key={e.z} value={e.sym}>
                {e.z.toString().padStart(3, ' ')} · {e.sym} · {e.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 16 }}>
        {/* Spectrum chart */}
        <div style={{
          background: 'var(--ink-1)', border: '1px solid var(--line)',
          borderRadius: 6, padding: 18, position: 'relative',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div className="eyebrow">Simulated PES · {element.name}</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <Toggle on={logAxis} onClick={() => setLogAxis(v => !v)}>Log axis</Toggle>
              <Toggle on={showLabels} onClick={() => setShowLabels(v => !v)}>Labels</Toggle>
            </div>
          </div>

          <svg viewBox={`0 0 ${PLOT_W} ${PLOT_H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
            <defs>
              <pattern id="pes-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(245,241,232,0.04)" strokeWidth="1" />
              </pattern>
            </defs>
            <rect x={PAD_L} y={PAD_T} width={innerW} height={innerH} fill="url(#pes-grid)" />

            {/* Photon energy threshold line */}
            {photonE >= domainMin && photonE <= domainMax && (
              <g>
                <line
                  x1={xPos(photonE)} y1={PAD_T} x2={xPos(photonE)} y2={PAD_T + innerH}
                  stroke="var(--phos)" strokeWidth="1.2" strokeDasharray="4 3" opacity="0.7"
                />
                <text
                  x={xPos(photonE)} y={PAD_T - 6}
                  fontFamily="JetBrains Mono" fontSize="9" fill="var(--phos)"
                  textAnchor="middle"
                >hν = {photonE} MJ/mol</text>
              </g>
            )}

            {/* Axes */}
            <line x1={PAD_L} y1={PAD_T + innerH} x2={PAD_L + innerW} y2={PAD_T + innerH} stroke="rgba(245,241,232,0.4)" />
            <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + innerH} stroke="rgba(245,241,232,0.4)" />

            {/* Y ticks (electron count) */}
            {[2, 6, 10, 14].filter(c => c <= maxECount + 0.5).map(c => (
              <g key={c}>
                <line x1={PAD_L - 4} y1={yForCount(c)} x2={PAD_L} y2={yForCount(c)} stroke="rgba(245,241,232,0.4)" />
                <text x={PAD_L - 7} y={yForCount(c) + 3}
                      fontFamily="JetBrains Mono" fontSize="9" fill="rgba(245,241,232,0.5)" textAnchor="end">{c}</text>
              </g>
            ))}
            <text
              x={14} y={PAD_T + innerH / 2}
              fontFamily="JetBrains Mono" fontSize="9" fill="rgba(245,241,232,0.5)"
              textAnchor="middle" transform={`rotate(-90 14 ${PAD_T + innerH / 2})`}
            >
              # ELECTRONS
            </text>

            {/* X ticks */}
            {ticks.map(t => (
              <g key={t}>
                <line x1={xPos(t)} y1={PAD_T + innerH} x2={xPos(t)} y2={PAD_T + innerH + 4} stroke="rgba(245,241,232,0.4)" />
                <text x={xPos(t)} y={PAD_T + innerH + 14}
                      fontFamily="JetBrains Mono" fontSize="9" fill="rgba(245,241,232,0.5)" textAnchor="middle">
                  {fmtTick(t)}
                </text>
              </g>
            ))}
            <text x={PAD_L + innerW / 2} y={PAD_T + innerH + 32}
                  fontFamily="JetBrains Mono" fontSize="10" fill="rgba(245,241,232,0.55)" textAnchor="middle">
              ← BINDING ENERGY (MJ/mol)
            </text>

            {/* Peaks */}
            {subshells.map((s, i) => {
              const cx = xPos(s.be);
              const heightPx = (s.e / maxECount) * innerH * 0.85;
              const color = SHELL_COLOR[s.n] ?? 'var(--paper)';
              const isSel = selected === i;
              const ionizable = canIonize(s.be);
              return (
                <g key={s.label + i} style={{ cursor: 'pointer' }} onClick={() => triggerEjection(i)}>
                  <path
                    d={peakPath(cx, heightPx, s.be)}
                    fill={color}
                    fillOpacity={isSel ? 0.9 : 0.55}
                    stroke={color}
                    strokeWidth={isSel ? 2 : 1}
                  />
                  {showLabels && (
                    <>
                      <text x={cx} y={yForCount(s.e) - 8}
                            fontFamily="JetBrains Mono" fontSize="11" fontWeight="600"
                            fill={color} textAnchor="middle">{s.label}</text>
                      <text x={cx} y={yForCount(s.e) - 22}
                            fontFamily="JetBrains Mono" fontSize="9"
                            fill="rgba(245,241,232,0.55)" textAnchor="middle">{s.e} e⁻</text>
                    </>
                  )}
                  {/* Ionization indicator above each peak */}
                  <circle cx={cx} cy={PAD_T + 6} r={3}
                          fill={ionizable ? 'var(--phos)' : 'rgba(245,241,232,0.15)'}
                          opacity={ionizable ? 1 : 0.6} />
                </g>
              );
            })}
          </svg>

          <div className="mono" style={{
            fontSize: 10, color: 'var(--paper-faint)',
            marginTop: 4, textAlign: 'right',
          }}>
            click any peak to eject an electron · green dot = photon can ionize
          </div>
        </div>

        {/* Right column: element + ejection animation + controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            background: 'var(--ink-1)', border: '1px solid var(--line)',
            borderRadius: 6, padding: 18,
          }}>
            <div className="eyebrow">Element</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 4 }}>
              <div className="serif" style={{ fontSize: 38, lineHeight: 1 }}>{element.sym}</div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span className="serif" style={{ fontSize: 16 }}>{element.name}</span>
                <span className="mono" style={{ fontSize: 10, color: 'var(--paper-dim)' }}>
                  Z = {element.z} · {totalE} electrons {totalE === element.z ? '✓' : `(check: ${element.z})`}
                </span>
              </div>
            </div>

            {/* Configuration row — clickable highlight */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
              {[...subshells].sort((a, b) => a.n - b.n || a.l - b.l).map((s, i) => {
                const origIdx = subshells.indexOf(s);
                const isSel = selected === origIdx;
                const color = SHELL_COLOR[s.n];
                return (
                  <button
                    key={i}
                    onClick={() => triggerEjection(origIdx)}
                    className="mono"
                    style={{
                      padding: '5px 8px', fontSize: 11,
                      border: `1px solid ${isSel ? color : 'var(--line-strong)'}`,
                      background: isSel ? `${color}22` : 'transparent',
                      color: isSel ? color : 'var(--paper)',
                      cursor: 'pointer',
                      borderRadius: 3,
                    }}
                  >
                    {s.label}<sup>{s.e}</sup>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ejection animation panel */}
          <div style={{
            background: 'var(--ink-1)', border: '1px solid var(--line)',
            borderRadius: 6, padding: 18,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="eyebrow">Photoionization</div>
              <button
                onClick={demo}
                className="mono"
                style={{
                  padding: '5px 10px', fontSize: 10, letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  border: '1px solid var(--line-strong)',
                  background: 'transparent', color: 'var(--paper)',
                  cursor: 'pointer',
                }}
              >▶ Demo</button>
            </div>

            <EjectionScene
              element={element}
              shell={selectedShell}
              t={ejection?.t ?? 0}
              photonE={photonE}
              active={!!ejection}
            />

            {/* Photon energy slider */}
            <div style={{ marginTop: 10 }}>
              <UISlider label="Photon energy hν" value={photonE} min={1} max={100} step={1}
                        onChange={setPhotonE} accent="var(--phos)"
                        format={(v) => `${v} MJ/mol`} />
            </div>
          </div>
        </div>
      </div>

      {/* Callout — full width below */}
      <Callout
        shell={selectedShell}
        photonE={photonE}
        z={element.z}
        sym={element.sym}
      />
    </div>
  );
}

// ───── ejection scene ─────

function nMaxForZ(z: number): number {
  if (z <= 2) return 1;
  if (z <= 10) return 2;
  if (z <= 18) return 3;
  if (z <= 36) return 4;
  if (z <= 54) return 5;
  if (z <= 86) return 6;
  return 7;
}

function EjectionScene({
  element, shell, t, photonE, active,
}: {
  element: { z: number; sym: string };
  shell: Subshell | null;
  t: number; // 0..1
  photonE: number;
  active: boolean;
}) {
  const W = 360, H = 150;
  const cx = W / 2, cy = H / 2;
  const photonStart = { x: 16, y: cy };
  const photonEnd = { x: cx, y: cy };

  // Physics gate — no electron leaves if photon is below threshold.
  const ke = shell ? photonE - shell.be : 0;
  const ionizable = shell ? ke >= 0 : false;

  // Phase 1: photon flies in (t: 0..0.4). Phase 2: electron flies out (0.4..1).
  const photonT = Math.min(1, t / 0.4);
  const electronT = Math.max(0, Math.min(1, (t - 0.4) / 0.6));
  const photonX = photonStart.x + (photonEnd.x - photonStart.x) * photonT;

  // Shells actually drawn for this element.
  const nMax = nMaxForZ(element.z);
  const shellRadius = (n: number) => 12 + n * Math.min(16, 70 / nMax);

  // Exit speed scales with KE (clamped). Electron starts at its shell radius,
  // not from the nucleus, and flies away along the same angle.
  const angle = -0.35; // slight upward — so it doesn't overlap the equation
  const r0 = shell ? shellRadius(shell.n) : 0;
  const sx0 = cx + r0 * Math.cos(angle);
  const sy0 = cy + r0 * Math.sin(angle);
  const exitDist = Math.min(160, 10 + Math.max(0, ke) * 5);
  const eX = sx0 + Math.cos(angle) * exitDist * electronT;
  const eY = sy0 + Math.sin(angle) * exitDist * electronT;

  const shellColor = shell ? SHELL_COLOR[shell.n] : 'var(--paper-dim)';
  const electronArrived = active && t > 0.4 && ionizable;
  const photonAbsorbed = active && t > 0.4 && !ionizable;

  return (
    <div style={{ marginTop: 10 }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {/* Atom — concentric shells matching this element's shell count */}
        {Array.from({ length: nMax }, (_, i) => i + 1).map(n => {
          const isActive = shell?.n === n;
          return (
            <circle key={n} cx={cx} cy={cy}
                    r={shellRadius(n)}
                    fill="none"
                    stroke={isActive ? shellColor : 'rgba(245,241,232,0.12)'}
                    strokeWidth={isActive ? '1.2' : '1'}
                    strokeDasharray={isActive ? '3 2' : undefined}
                    opacity={isActive ? 0.75 : 1} />
          );
        })}
        <circle cx={cx} cy={cy} r={11} fill="#ff8d54" />
        <text x={cx} y={cy + 3.5} textAnchor="middle"
              fontFamily="Fraunces" fontSize="11" fontWeight="600" fill="#0a0908">
          {element.sym}
        </text>

        {/* Incoming photon (squiggle line) */}
        {active && photonT < 1 && (
          <g>
            <Squiggle x1={photonStart.x} x2={photonX} y={cy} color="var(--phos)" />
            <circle cx={photonX} cy={cy} r="4" fill="var(--phos)" />
            <text x={photonStart.x} y={cy - 12}
                  fontFamily="JetBrains Mono" fontSize="9" fill="var(--phos)">hν</text>
          </g>
        )}

        {/* Ejected electron — only when hν ≥ BE */}
        {electronArrived && shell && (
          <g>
            <line x1={sx0} y1={sy0} x2={eX} y2={eY}
                  stroke={shellColor} strokeWidth="1" strokeDasharray="2 2" opacity="0.6" />
            <circle cx={eX} cy={eY} r="5"
                    fill={shellColor} stroke="var(--paper)" strokeWidth="1" />
            <text x={eX + 8} y={eY + 3}
                  fontFamily="JetBrains Mono" fontSize="10" fill={shellColor}>e⁻</text>
          </g>
        )}

        {/* Absorbed-only indication — photon below threshold, no ejection */}
        {photonAbsorbed && shell && (
          <g>
            <circle cx={cx} cy={cy} r={shellRadius(shell.n) + 3}
                    fill="none" stroke="var(--hot)" strokeWidth="0.8"
                    strokeDasharray="2 2" opacity={0.8 - Math.max(0, t - 0.4)} />
            <text x={cx} y={cy - shellRadius(shell.n) - 8} textAnchor="middle"
                  fontFamily="JetBrains Mono" fontSize="9" fill="var(--hot)">
              hν &lt; BE · no ejection
            </text>
          </g>
        )}

        {/* Equation overlay */}
        {shell && (
          <g>
            <text x={W - 8} y={16} textAnchor="end"
                  fontFamily="JetBrains Mono" fontSize="10" fill="var(--paper-dim)">
              KE = hν − BE
            </text>
            <text x={W - 8} y={H - 8} textAnchor="end"
                  fontFamily="JetBrains Mono" fontSize="10"
                  fill={ionizable ? 'var(--phos)' : 'var(--hot)'}>
              {photonE.toFixed(0)} − {shell.be.toFixed(2)} = {ke.toFixed(2)} MJ/mol
            </text>
          </g>
        )}

        {!shell && (
          <text x={cx} y={H - 14} textAnchor="middle"
                fontFamily="JetBrains Mono" fontSize="10" fill="var(--paper-faint)">
            click a peak or press Demo
          </text>
        )}
      </svg>
    </div>
  );
}

function Squiggle({ x1, x2, y, color }: { x1: number; x2: number; y: number; color: string }) {
  const len = x2 - x1;
  if (len < 4) return null;
  const wavelength = 8, amp = 4;
  const segs = Math.max(1, Math.floor(len / wavelength));
  let d = `M ${x1} ${y}`;
  for (let i = 0; i < segs; i++) {
    const sx = x1 + i * wavelength;
    const ex = sx + wavelength;
    const my = y + (i % 2 === 0 ? -amp : amp);
    d += ` Q ${(sx + ex) / 2} ${my}, ${ex} ${y}`;
  }
  return <path d={d} fill="none" stroke={color} strokeWidth="1.5" />;
}

// ───── callout ─────

function Callout({
  shell, photonE, z, sym,
}: {
  shell: Subshell | null;
  photonE: number;
  z: number;
  sym: string;
}) {
  if (!shell) {
    return (
      <div style={{
        background: 'var(--ink-1)', border: '1px solid var(--line)',
        borderRadius: 6, padding: 14,
        fontSize: 12, color: 'var(--paper-dim)', lineHeight: 1.6,
      }}>
        <span className="eyebrow">Tip · </span>
        Click any peak above to inspect it. Peaks farther left have higher binding energies — those electrons sit closer to the nucleus and are hardest to remove. Peak height counts how many electrons live in that subshell.
      </div>
    );
  }
  const color = SHELL_COLOR[shell.n];
  const ke = photonE - shell.be;
  const ionizable = ke >= 0;
  const reason =
    shell.n === 1
      ? 'closest to the nucleus, hardest to remove'
      : 'further from the nucleus, more easily removed';

  return (
    <div style={{
      background: 'var(--ink-1)',
      border: `1px solid ${color}66`,
      borderLeft: `3px solid ${color}`,
      borderRadius: 6, padding: 14,
      display: 'grid', gridTemplateColumns: '1fr auto', gap: 14, alignItems: 'center',
    }}>
      <div>
        <div className="eyebrow" style={{ color }}>{sym} · {shell.label} peak</div>
        <div className="serif" style={{ fontSize: 18, marginTop: 4 }}>
          {shell.label}<sup>{shell.e}</sup> peak — {shell.e} electron{shell.e === 1 ? '' : 's'} at binding energy {shell.be.toFixed(2)} MJ/mol
        </div>
        <div style={{ fontSize: 12, color: 'var(--paper-dim)', marginTop: 4, lineHeight: 1.5 }}>
          {reason}. {ionizable
            ? `A ${photonE} MJ/mol photon ejects this electron with KE = ${ke.toFixed(2)} MJ/mol.`
            : `A ${photonE} MJ/mol photon is ${(shell.be - photonE).toFixed(2)} MJ/mol short of the binding energy — no ejection.`}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div className="eyebrow">Z = {z}</div>
        <div className="mono" style={{ fontSize: 14, color, marginTop: 2 }}>
          n = {shell.n}, ℓ = {shell.l}
        </div>
      </div>
    </div>
  );
}

// ───── small UI atoms ─────

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="mono"
      style={{
        padding: '5px 10px', fontSize: 10, letterSpacing: '0.14em',
        textTransform: 'uppercase',
        border: '1px solid var(--line-strong)',
        background: on ? 'var(--paper)' : 'transparent',
        color: on ? 'var(--ink-0)' : 'var(--paper-dim)',
        cursor: 'pointer',
        borderRadius: 3,
      }}
    >{children}</button>
  );
}

// ───── numeric helpers ─────

function fmtTick(t: number): string {
  if (t >= 1000) return `${(t / 1000).toFixed(t >= 10000 ? 0 : 1)}k`;
  if (t >= 10) return `${t.toFixed(0)}`;
  if (t >= 1) return `${t.toFixed(0)}`;
  return t.toFixed(1);
}

function niceTicks(min: number, max: number, n: number): number[] {
  const step = niceStep((max - min) / n);
  const start = Math.ceil(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max + 1e-9; v += step) out.push(Number(v.toFixed(6)));
  return out;
}

function niceStep(raw: number): number {
  const exp = Math.floor(Math.log10(raw));
  const f = raw / Math.pow(10, exp);
  const nf = f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10;
  return nf * Math.pow(10, exp);
}
