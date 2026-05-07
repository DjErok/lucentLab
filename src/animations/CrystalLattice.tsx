import { useState } from 'react';
import SlideTabs from '../components/ui/SlideTabs';

/**
 * Crystal Lattice — port of MW "Molecular Crystals" plus AP solid-types
 * comparison. Switches between four canonical solids and shows their
 * 2D-projected unit cells with characteristic properties.
 */

type LatticeId = 'ionic' | 'molecular' | 'metallic' | 'network';

type Lattice = {
  id: LatticeId;
  label: string;
  formula: string;
  bonding: string;
  mp: string;
  cond: string;
  hardness: string;
  example: string;
};

const LATTICES: Lattice[] = [
  { id: 'ionic',     label: 'Ionic',     formula: 'NaCl',     bonding: 'electrostatic (cation ↔ anion)',
    mp: '~800 °C', cond: 'insulating solid · conducts when molten', hardness: 'hard, brittle', example: 'NaCl rock-salt' },
  { id: 'molecular', label: 'Molecular', formula: 'I₂',       bonding: 'IMFs only (LDF / dipole)',
    mp: 'low (<400 °C)', cond: 'insulator', hardness: 'soft, waxy', example: 'I₂ · H₂O · CO₂(s)' },
  { id: 'metallic',  label: 'Metallic',  formula: 'Cu',       bonding: 'sea of delocalized e⁻',
    mp: 'wide (Hg→W)',   cond: 'electrical & thermal conductor', hardness: 'malleable, ductile', example: 'Cu, Fe, Au' },
  { id: 'network',   label: 'Network',   formula: 'C (diamond)', bonding: 'continuous covalent net',
    mp: 'very high (>1500 °C)', cond: 'insulator (graphite is exception)', hardness: 'extremely hard', example: 'diamond, SiO₂' },
];

const N = 7; // unit cells per side
const CELL = 90;

export default function CrystalLattice() {
  const [id, setId] = useState<LatticeId>('ionic');
  const lat = LATTICES.find(l => l.id === id)!;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <SlideTabs<LatticeId>
        tabs={LATTICES.map(l => ({ id: l.id, label: l.label }))}
        value={id}
        onChange={setId}
      />

      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'baseline', gap: 16, flexWrap: 'wrap',
      }}>
        <div className="serif" style={{ fontSize: 22, fontStyle: 'italic' }}>
          {lat.example}
        </div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--paper-dim)' }}>
          {lat.bonding}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
        <div style={{
          background: 'var(--ink-1)', border: '1px solid var(--line)',
          borderRadius: 6, padding: 18, aspectRatio: '1 / 1', position: 'relative',
        }}>
          <div className="eyebrow">Lattice projection</div>
          <svg viewBox={`0 0 ${N * CELL} ${N * CELL}`}
               style={{ position: 'absolute', inset: '40px 18px 18px',
                        width: 'calc(100% - 36px)', height: 'calc(100% - 58px)' }}>
            {renderLattice(id)}
          </svg>
        </div>

        <div style={{
          background: 'var(--ink-1)', border: '1px solid var(--line)',
          borderRadius: 6, padding: 20, display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div className="eyebrow">{lat.label} solid · {lat.formula}</div>
          <Stat label="Bonding"      value={lat.bonding} />
          <Stat label="Melting pt"   value={lat.mp} accent="var(--hot)" />
          <Stat label="Conductivity" value={lat.cond} accent="var(--phos)" />
          <Stat label="Hardness"     value={lat.hardness} />
          <Stat label="Examples"     value={lat.example} accent="var(--cool)" />
        </div>
      </div>
    </div>
  );
}

function renderLattice(id: LatticeId) {
  switch (id) {
    case 'ionic': {
      // Alternating Na+ / Cl- on a square grid.
      const out: React.ReactElement[] = [];
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        const cx = (i + 0.5) * CELL, cy = (j + 0.5) * CELL;
        const isCation = (i + j) % 2 === 0;
        out.push(
          <g key={`${i}-${j}`}>
            <circle cx={cx} cy={cy} r={isCation ? 18 : 28}
                    fill={isCation ? '#ff7a3c' : '#5dd0ff'}
                    stroke="rgba(0,0,0,0.45)" strokeWidth={1} />
            <text x={cx} y={cy + 4} textAnchor="middle"
                  fontFamily="JetBrains Mono" fontSize={11} fontWeight={600}
                  fill="#0a0908">{isCation ? 'Na⁺' : 'Cl⁻'}</text>
          </g>
        );
      }
      return out;
    }
    case 'molecular': {
      // I2 dumbbells in jittered orientations.
      const out: React.ReactElement[] = [];
      let seed = 1;
      const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return (seed / 0xffffffff); };
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        const cx = (i + 0.5) * CELL, cy = (j + 0.5) * CELL;
        const a = rnd() * Math.PI;
        const dx = Math.cos(a) * 22, dy = Math.sin(a) * 22;
        out.push(
          <g key={`${i}-${j}`}>
            <line x1={cx - dx} y1={cy - dy} x2={cx + dx} y2={cy + dy}
                  stroke="#a78bfa" strokeWidth={4} strokeLinecap="round" />
            <circle cx={cx - dx} cy={cy - dy} r={14} fill="#a78bfa"
                    stroke="rgba(0,0,0,0.45)" />
            <circle cx={cx + dx} cy={cy + dy} r={14} fill="#a78bfa"
                    stroke="rgba(0,0,0,0.45)" />
          </g>
        );
      }
      return out;
    }
    case 'metallic': {
      // Cation cores in close-packed grid + drifting electron dots.
      const out: React.ReactElement[] = [];
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        const cx = (i + 0.5) * CELL + (j % 2 ? CELL / 2 : 0), cy = (j + 0.5) * CELL;
        out.push(
          <g key={`c-${i}-${j}`}>
            <circle cx={cx} cy={cy} r={22} fill="#fbbf24"
                    stroke="rgba(0,0,0,0.45)" />
            <text x={cx} y={cy + 4} textAnchor="middle"
                  fontFamily="JetBrains Mono" fontSize={10} fontWeight={600}
                  fill="#0a0908">Cu⁺</text>
          </g>
        );
      }
      // Sea of electrons.
      let seed = 7;
      const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return (seed / 0xffffffff); };
      for (let k = 0; k < 60; k++) {
        out.push(
          <circle key={`e-${k}`}
                  cx={rnd() * N * CELL} cy={rnd() * N * CELL} r={3}
                  fill="#5dd0ff" opacity={0.85} />
        );
      }
      return out;
    }
    case 'network': {
      // Diamond-like sp3: each node connected to 4 neighbours, shown as planar.
      const out: React.ReactElement[] = [];
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        const cx = (i + 0.5) * CELL, cy = (j + 0.5) * CELL;
        for (const [dx, dy] of dirs) {
          const nx = cx + dx * CELL / 2, ny = cy + dy * CELL / 2;
          out.push(
            <line key={`l-${i}-${j}-${dx}-${dy}`}
                  x1={cx} y1={cy} x2={nx} y2={ny}
                  stroke="#69e36b" strokeWidth={2} opacity={0.55} />
          );
        }
      }
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        const cx = (i + 0.5) * CELL, cy = (j + 0.5) * CELL;
        out.push(
          <circle key={`a-${i}-${j}`} cx={cx} cy={cy} r={14}
                  fill="#0a0908" stroke="#69e36b" strokeWidth={2} />
        );
      }
      return out;
    }
  }
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, color: accent ?? 'var(--paper)' }}>{value}</div>
    </div>
  );
}
