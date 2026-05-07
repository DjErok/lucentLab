import { useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import SlideTabs from '../components/ui/SlideTabs';

/**
 * Atomic Orbital Shapes — port of MW "Atomic Orbitals".
 *
 * Renders a point cloud sampled from |ψ|² for hydrogenic orbitals.
 * Tabs: 1s, 2s, 2p, 3p, 3d_{z²}, 3d_{x²−y²}.
 * Drag to rotate. Hydrogenic radial / angular formulas, in atomic units (a₀=1).
 */

type OrbId = '1s' | '2s' | '2p' | '3p' | '3dz2' | '3dxy';

const ORBS: { id: OrbId; label: string; n: number; l: number; ml: string; nodes: string }[] = [
  { id: '1s',   label: '1s',           n: 1, l: 0, ml: '0',          nodes: '0 nodes' },
  { id: '2s',   label: '2s',           n: 2, l: 0, ml: '0',          nodes: '1 radial node' },
  { id: '2p',   label: '2p_z',         n: 2, l: 1, ml: '0',          nodes: '1 angular node' },
  { id: '3p',   label: '3p_z',         n: 3, l: 1, ml: '0',          nodes: '1 ang + 1 rad' },
  { id: '3dz2', label: '3d_{z²}',      n: 3, l: 2, ml: '0',          nodes: '2 angular nodes' },
  { id: '3dxy', label: '3d_{x²−y²}',   n: 3, l: 2, ml: '±2',         nodes: '2 angular nodes' },
];

const N_POINTS = 4500;

function psi2(orb: OrbId, x: number, y: number, z: number): number {
  const r = Math.sqrt(x * x + y * y + z * z) + 1e-9;
  const cosT = z / r;
  switch (orb) {
    case '1s': {
      // R_10 ∝ e^(-r) ; |ψ|² ∝ e^(-2r)
      return Math.exp(-2 * r);
    }
    case '2s': {
      // R_20 ∝ (2 - r) e^(-r/2); square it.
      const v = (2 - r) * Math.exp(-r / 2);
      return v * v;
    }
    case '2p': {
      // R_21 Y_10 ∝ r e^(-r/2) cosθ
      const v = r * Math.exp(-r / 2) * cosT;
      return v * v;
    }
    case '3p': {
      // R_31 ∝ (6 - r) r e^(-r/3)
      const v = (6 - r) * r * Math.exp(-r / 3) * cosT;
      return v * v;
    }
    case '3dz2': {
      // Y_20 ∝ 3cos²θ - 1 ; R_32 ∝ r² e^(-r/3)
      const ang = 3 * cosT * cosT - 1;
      const rad = r * r * Math.exp(-r / 3);
      const v = rad * ang;
      return v * v;
    }
    case '3dxy': {
      // Real form Y_22 ∝ sin²θ cos2φ ;  cos2φ = (x²-y²)/(x²+y²)
      const sinT2 = 1 - cosT * cosT;
      const xy = (x * x - y * y) / Math.max(1e-9, x * x + y * y);
      const ang = sinT2 * xy;
      const rad = r * r * Math.exp(-r / 3);
      const v = rad * ang;
      return v * v;
    }
  }
}

function samplePoints(orb: OrbId): { positions: Float32Array; colors: Float32Array } {
  // Rejection sample from |ψ|² inside a box.
  const positions = new Float32Array(N_POINTS * 3);
  const colors = new Float32Array(N_POINTS * 3);
  const box = orb.startsWith('1s') ? 4 : orb === '2s' || orb === '2p' ? 8 : 14;
  // Find rough max for normalisation.
  let maxP = 0;
  for (let s = 0; s < 600; s++) {
    const x = (Math.random() - 0.5) * 2 * box;
    const y = (Math.random() - 0.5) * 2 * box;
    const z = (Math.random() - 0.5) * 2 * box;
    maxP = Math.max(maxP, psi2(orb, x, y, z));
  }
  maxP = Math.max(maxP, 1e-9) * 1.05;

  let i = 0, attempts = 0;
  while (i < N_POINTS && attempts < N_POINTS * 200) {
    attempts++;
    const x = (Math.random() - 0.5) * 2 * box;
    const y = (Math.random() - 0.5) * 2 * box;
    const z = (Math.random() - 0.5) * 2 * box;
    const p = psi2(orb, x, y, z);
    if (Math.random() * maxP < p) {
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      // Phase color: positive lobe vs negative (only meaningful for non-s).
      const sign = signOf(orb, x, y, z);
      if (sign > 0) {
        colors[i * 3] = 0.36; colors[i * 3 + 1] = 0.81; colors[i * 3 + 2] = 1.0;
      } else {
        colors[i * 3] = 1.0;  colors[i * 3 + 1] = 0.48; colors[i * 3 + 2] = 0.24;
      }
      i++;
    }
  }
  return { positions, colors };
}

function signOf(orb: OrbId, x: number, y: number, z: number): number {
  const r = Math.sqrt(x * x + y * y + z * z) + 1e-9;
  switch (orb) {
    case '1s': return 1;
    case '2s': return Math.sign(2 - r);
    case '2p':
    case '3p': return Math.sign(z);
    case '3dz2': return Math.sign(3 * (z / r) * (z / r) - 1);
    case '3dxy': return Math.sign(x * x - y * y);
  }
}

export default function OrbitalShapes() {
  const [orb, setOrb] = useState<OrbId>('2p');
  const meta = ORBS.find(o => o.id === orb)!;

  const { positions, colors } = useMemo(() => samplePoints(orb), [orb]);
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
  }, [positions, colors]);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <SlideTabs<OrbId>
        tabs={ORBS.map(o => ({ id: o.id, label: o.label }))}
        value={orb}
        onChange={setOrb}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        <div style={{
          background: 'var(--ink-1)', border: '1px solid var(--line)',
          borderRadius: 6, aspectRatio: '1.3 / 1', position: 'relative', overflow: 'hidden',
        }}>
          <Canvas camera={{ position: [0, 0, 22], fov: 45 }}>
            <ambientLight intensity={0.6} />
            <points geometry={geom}>
              <pointsMaterial
                size={0.18}
                vertexColors
                transparent
                opacity={0.85}
                sizeAttenuation
              />
            </points>
            <axesHelper args={[6]} />
            <OrbitControls enablePan={false} />
          </Canvas>
          <div className="eyebrow" style={{ position: 'absolute', top: 14, left: 18 }}>
            |ψ|² point cloud · drag to rotate
          </div>
        </div>

        <div style={{
          background: 'var(--ink-1)', border: '1px solid var(--line)',
          borderRadius: 6, padding: 20, display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          <div className="eyebrow">Orbital · {meta.label}</div>
          <div className="serif" style={{ fontSize: 28, color: 'var(--phos)' }}>
            n = {meta.n} ·  l = {meta.l} ·  m_l = {meta.ml}
          </div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--paper-dim)' }}>
            {meta.nodes}
          </div>
          <hr style={{ border: 'none', borderTop: '1px solid var(--line)' }} />
          <div className="mono" style={{ fontSize: 11, lineHeight: 1.6, color: 'var(--paper-dim)' }}>
            <span style={{ color: '#5dd0ff' }}>● blue</span> = positive lobe ·{' '}
            <span style={{ color: '#ff7a3c' }}>● orange</span> = negative lobe.{' '}
            For s-orbitals only the radial sign matters (2s has a radial node where the colour flips).
          </div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--paper-faint)' }}>
            Density sampled from hydrogenic |ψ|²; scale in Bohr radii.
          </div>
        </div>
      </div>
    </div>
  );
}
