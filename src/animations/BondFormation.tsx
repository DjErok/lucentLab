import { useMemo, useState } from 'react';
import UISlider from '../components/ui/Slider';

/**
 * Bond Formation — port of MW "Quantum Origin of Chemical Bonds".
 *
 * Two H atoms on a 1D axis. Distance r is user-controlled.
 * Below: Morse potential V(r) = D_e[1 − exp(−a(r−r_e))]² − D_e
 * with marker that tracks r. Electron-cloud overlap visualised by
 * blending two radial gradients; at r = r_e the σ-bond region glows.
 */

const r_e = 0.74;       // Å, equilibrium H–H bond length
const D_e = 4.52;       // eV, dissociation energy
const a   = 1.93;       // Morse range parameter

function V(r: number) {
  const x = 1 - Math.exp(-a * (r - r_e));
  return D_e * x * x - D_e;
}

export default function BondFormation() {
  const [r, setR] = useState(2.5);
  const energy = useMemo(() => V(r), [r]);

  const W = 800, H = 240, padL = 50, padR = 16, padT = 18, padB = 28;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const rMin = 0.3, rMax = 3.0;
  const eMin = -D_e - 0.5, eMax = 4.0;
  const xAt = (r0: number) => padL + ((r0 - rMin) / (rMax - rMin)) * innerW;
  const yAt = (e: number) => padT + (1 - (e - eMin) / (eMax - eMin)) * innerH;

  const path = (() => {
    const steps = 240;
    let d = '';
    for (let i = 0; i <= steps; i++) {
      const r0 = rMin + (i / steps) * (rMax - rMin);
      d += `${i === 0 ? 'M' : 'L'}${xAt(r0).toFixed(1)},${yAt(V(r0)).toFixed(1)} `;
    }
    return d;
  })();

  const phase: 'far' | 'attract' | 'bonded' | 'repel' =
    r > 1.6 ? 'far' :
    r > r_e + 0.05 ? 'attract' :
    r >= r_e - 0.05 ? 'bonded' : 'repel';

  const phaseLabel = {
    far:     'Atoms too far apart — minimal orbital overlap, V → 0',
    attract: 'Wavefunctions overlap; constructive interference lowers energy',
    bonded:  '‹ σ bond ›  V at minimum  · ΔV = −D_e ≈ −4.52 eV',
    repel:   'Nuclei too close — Pauli repulsion dominates, V climbs steeply',
  }[phase];

  // Atom positions inside scene (Å mapped to 0..1 around centre at 0.5)
  const halfSep = (r / 2) / 3.2; // scale so r=3 fills the box
  const xL = 0.5 - halfSep;
  const xR = 0.5 + halfSep;
  const overlap = Math.max(0, Math.min(1, 1 - r / 1.4)); // 0 at r≥1.4, 1 at r=0

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'baseline', gap: 16, flexWrap: 'wrap',
      }}>
        <div className="serif" style={{ fontSize: 24, fontStyle: 'italic' }}>
          H + H ⇌ H<sub>2</sub>
        </div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--paper-dim)' }}>
          V(r) = D_e[1 − exp(−a(r − r_e))]² − D_e
        </div>
      </div>

      {/* Atomic scene */}
      <div style={{
        background: 'var(--ink-1)', border: '1px solid var(--line)',
        borderRadius: 6, height: 180, position: 'relative', overflow: 'hidden',
      }}>
        <svg viewBox="0 0 1000 180" preserveAspectRatio="none" width="100%" height="100%">
          <defs>
            <radialGradient id="cloudL" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#5dd0ff" stopOpacity={0.85} />
              <stop offset="100%" stopColor="#5dd0ff" stopOpacity={0} />
            </radialGradient>
            <radialGradient id="cloudR" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ff7a3c" stopOpacity={0.85} />
              <stop offset="100%" stopColor="#ff7a3c" stopOpacity={0} />
            </radialGradient>
            <radialGradient id="bond" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffd76b" stopOpacity={0.95} />
              <stop offset="100%" stopColor="#ffd76b" stopOpacity={0} />
            </radialGradient>
          </defs>
          <ellipse cx={xL * 1000} cy={90} rx={120} ry={70} fill="url(#cloudL)" />
          <ellipse cx={xR * 1000} cy={90} rx={120} ry={70} fill="url(#cloudR)" />
          {overlap > 0.05 && (
            <ellipse cx={500} cy={90} rx={80 * overlap + 20} ry={36 * overlap + 10}
                     fill="url(#bond)" opacity={0.6 + 0.4 * overlap} />
          )}
          <circle cx={xL * 1000} cy={90} r={6} fill="#0a0908" stroke="#5dd0ff" strokeWidth={2} />
          <circle cx={xR * 1000} cy={90} r={6} fill="#0a0908" stroke="#ff7a3c" strokeWidth={2} />
          <text x={xL * 1000} y={64} textAnchor="middle"
                fontFamily="JetBrains Mono" fontSize={11} fill="#5dd0ff">H</text>
          <text x={xR * 1000} y={64} textAnchor="middle"
                fontFamily="JetBrains Mono" fontSize={11} fill="#ff7a3c">H</text>
          <line x1={xL * 1000} y1={140} x2={xR * 1000} y2={140}
                stroke="rgba(245,241,232,0.5)" strokeWidth={1} markerStart="url(#tick)" />
          <text x={500} y={158} textAnchor="middle"
                fontFamily="JetBrains Mono" fontSize={11} fill="rgba(245,241,232,0.7)">
            r = {r.toFixed(2)} Å
          </text>
        </svg>
      </div>

      {/* Energy curve */}
      <div style={{
        background: 'var(--ink-1)', border: '1px solid var(--line)',
        borderRadius: 6, padding: 20,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <div className="eyebrow">Potential energy V(r)</div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--paper-dim)' }}>
            r_e = {r_e.toFixed(2)} Å · D_e = {D_e.toFixed(2)} eV
          </div>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet"
             style={{ display: 'block', maxHeight: 260 }}>
          {/* Grid */}
          {[-4, -2, 0, 2, 4].map(e => (
            <g key={e}>
              <line x1={padL} y1={yAt(e)} x2={W - padR} y2={yAt(e)}
                    stroke="rgba(245,241,232,0.06)" />
              <text x={padL - 6} y={yAt(e) + 3} textAnchor="end"
                    fontFamily="JetBrains Mono" fontSize={9}
                    fill="rgba(245,241,232,0.5)">{e}</text>
            </g>
          ))}
          {/* zero line */}
          <line x1={padL} y1={yAt(0)} x2={W - padR} y2={yAt(0)}
                stroke="rgba(245,241,232,0.2)" strokeDasharray="2 4" />
          {/* curve */}
          <path d={path} fill="none" stroke="var(--phos)" strokeWidth={2} />
          {/* r_e marker */}
          <line x1={xAt(r_e)} y1={padT} x2={xAt(r_e)} y2={H - padB}
                stroke="rgba(105,227,107,0.4)" strokeDasharray="3 5" />
          <text x={xAt(r_e)} y={padT + 12} textAnchor="middle"
                fontFamily="JetBrains Mono" fontSize={10}
                fill="rgba(105,227,107,0.8)">r_e</text>
          {/* live marker */}
          <circle cx={xAt(r)} cy={yAt(energy)} r={6} fill="var(--hot)"
                  stroke="var(--paper)" strokeWidth={1.5} />
          <text x={xAt(r) + 10} y={yAt(energy) + 4}
                fontFamily="JetBrains Mono" fontSize={10} fill="var(--hot)">
            V = {energy.toFixed(2)} eV
          </text>
          {/* axes labels */}
          <text x={W / 2} y={H - 6} textAnchor="middle"
                fontFamily="JetBrains Mono" fontSize={10}
                fill="rgba(245,241,232,0.6)">r (Å)</text>
          <text x={12} y={padT - 4}
                fontFamily="JetBrains Mono" fontSize={10}
                fill="rgba(245,241,232,0.6)">V (eV)</text>
        </svg>

        <div style={{ marginTop: 14 }}>
          <UISlider
            label="distance r (Å)"
            value={r} min={rMin} max={rMax} step={0.01}
            onChange={setR}
            accent="var(--phos)"
            format={v => `${v.toFixed(2)}`}
          />
        </div>

        <div className="mono" style={{
          marginTop: 10, fontSize: 11, color: 'var(--paper-dim)', lineHeight: 1.5,
        }}>
          {phaseLabel}
        </div>
      </div>
    </div>
  );
}
