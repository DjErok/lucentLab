import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * VSEPR — pure-SVG 3D-projected molecular geometry visualizer.
 * Auto-rotation via rAF (paused when document.hidden); drag to rotate.
 */

type ShapeKey =
  | 'linear' | 'trig' | 'bent3' | 'tet' | 'pyr' | 'bent'
  | 'tbp' | 'seesaw' | 'tshape' | 'lin5'
  | 'oct' | 'sqpyr' | 'sqplanar';
type Vec3 = [number, number, number];
type AtomDef = { sym: string; pos: Vec3; en: number };
type LoneDef = { pos: Vec3 };
type AnglePair = { i: number; j: number; label: string };
type Mol = {
  key: ShapeKey; formula: string; name: string;
  central: { sym: string; en: number };
  atoms: AtomDef[]; lones: LoneDef[];
  electronGeom: string; molecGeom: string;
  hyb: 'sp' | 'sp²' | 'sp³' | 'sp³d' | 'sp³d²';
  ang: string; domains: number; lp: number; polar: boolean;
  dipole?: Vec3; anglePairs?: AnglePair[]; notes: string;
};

// ───────── Element palette ─────────
const ELEM: Record<string, { color: string; ring: string; text: string }> = {
  H:  { color: '#f0e6d2', ring: '#d8cdb4', text: '#0a0908' },
  C:  { color: '#3a3128', ring: '#1f1b15', text: '#f5f1e8' },
  N:  { color: '#4ea8ff', ring: '#2c7fcc', text: '#0a0908' },
  O:  { color: '#ff5b3c', ring: '#cc3f24', text: '#0a0908' },
  F:  { color: '#9be39d', ring: '#6fbf72', text: '#0a0908' },
  B:  { color: '#ffb74d', ring: '#cc8e2e', text: '#0a0908' },
  Be: { color: '#d4d4aa', ring: '#a8a884', text: '#0a0908' },
  P:  { color: '#fbbf24', ring: '#c89812', text: '#0a0908' },
  S:  { color: '#f5c542', ring: '#c89c1b', text: '#0a0908' },
  Cl: { color: '#69e36b', ring: '#3fb244', text: '#0a0908' },
  Br: { color: '#d97757', ring: '#a8543c', text: '#f5f1e8' },
  Xe: { color: '#a78bfa', ring: '#7c5fd6', text: '#0a0908' },
};

// ───────── Geometry helpers ─────────
function tripod(sym: string, en: number, hAng: number, r: number): AtomDef[] {
  const half = (hAng / 2) * (Math.PI / 180);
  const rxy = r * Math.sin(half);
  const y = -r * Math.cos(half);
  return [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].map((a) => ({
    sym, en, pos: [rxy * Math.cos(a), y, rxy * Math.sin(a)] as Vec3,
  }));
}

// ───────── Molecule catalog ─────────
const R = 1.7;
const MOLS: Record<ShapeKey, Mol> = {
  linear: {
    key: 'linear', formula: 'CO₂', name: 'Carbon Dioxide',
    central: { sym: 'C', en: 2.55 },
    atoms: [{ sym: 'O', en: 3.44, pos: [R, 0, 0] }, { sym: 'O', en: 3.44, pos: [-R, 0, 0] }],
    lones: [], electronGeom: 'Linear', molecGeom: 'Linear',
    hyb: 'sp', ang: '180°', domains: 2, lp: 0, polar: false,
    notes: 'Two C=O bonds 180° apart. Bond dipoles equal & opposite → cancel → nonpolar overall.',
  },
  trig: {
    key: 'trig', formula: 'BF₃', name: 'Boron Trifluoride',
    central: { sym: 'B', en: 2.04 },
    atoms: [
      { sym: 'F', en: 3.98, pos: [R, 0, 0] },
      { sym: 'F', en: 3.98, pos: [-R/2, 0,  R*Math.sqrt(3)/2] },
      { sym: 'F', en: 3.98, pos: [-R/2, 0, -R*Math.sqrt(3)/2] },
    ],
    lones: [], electronGeom: 'Trigonal Planar', molecGeom: 'Trigonal Planar',
    hyb: 'sp²', ang: '120°', domains: 3, lp: 0, polar: false,
    notes: 'Three B–F bonds at 120° in one plane. Symmetric → vectors cancel → nonpolar.',
  },
  bent3: {
    key: 'bent3', formula: 'SO₂', name: 'Sulfur Dioxide',
    central: { sym: 'S', en: 2.58 },
    atoms: [{ sym: 'O', en: 3.44, pos: [1.5, 0.5, 0] }, { sym: 'O', en: 3.44, pos: [-1.5, 0.5, 0] }],
    lones: [{ pos: [0, -1.4, 0] }],
    electronGeom: 'Trigonal Planar', molecGeom: 'Bent',
    hyb: 'sp²', ang: '~119°', domains: 3, lp: 1, polar: true,
    dipole: [0, 1, 0], anglePairs: [{ i: 0, j: 1, label: '~119°' }],
    notes: '2 bonded + 1 lone pair → bent. The lone pair pushes the O atoms together; net dipole present.',
  },
  tet: (() => {
    const k = 1.55 / Math.sqrt(3);
    return {
      key: 'tet', formula: 'CH₄', name: 'Methane',
      central: { sym: 'C', en: 2.55 },
      atoms: [
        { sym: 'H', en: 2.20, pos: [ k,  k,  k] as Vec3 },
        { sym: 'H', en: 2.20, pos: [-k, -k,  k] as Vec3 },
        { sym: 'H', en: 2.20, pos: [-k,  k, -k] as Vec3 },
        { sym: 'H', en: 2.20, pos: [ k, -k, -k] as Vec3 },
      ],
      lones: [],
      electronGeom: 'Tetrahedral', molecGeom: 'Tetrahedral',
      hyb: 'sp³', ang: '109.5°', domains: 4, lp: 0, polar: false,
      anglePairs: [{ i: 0, j: 1, label: '109.5°' }],
      notes: 'Perfect tetrahedron. All bond dipoles cancel by symmetry → nonpolar.',
    };
  })(),
  pyr: {
    key: 'pyr', formula: 'NH₃', name: 'Ammonia',
    central: { sym: 'N', en: 3.04 },
    atoms: tripod('H', 2.20, 107, 1.5),
    lones: [{ pos: [0, 1.4, 0] }],
    electronGeom: 'Tetrahedral', molecGeom: 'Trigonal Pyramidal',
    hyb: 'sp³', ang: '~107°', domains: 4, lp: 1, polar: true,
    dipole: [0, 1, 0],
    anglePairs: [{ i: 0, j: 1, label: '107°' }],
    notes: 'Lone pair on N points up; the H tripod points down. Asymmetric → polar (μ ≈ 1.47 D).',
  },
  bent: (() => {
    const ha = (104.5 / 2) * (Math.PI / 180);
    const r = 1.0, hx = r * Math.sin(ha), hy = -r * Math.cos(ha);
    const lh = (109.5 / 2) * (Math.PI / 180), lr = 0.95;
    const lz = lr * Math.sin(lh), ly = lr * Math.cos(lh);
    return {
      key: 'bent', formula: 'H₂O', name: 'Water',
      central: { sym: 'O', en: 3.44 },
      atoms: [
        { sym: 'H', en: 2.20, pos: [ hx, hy, 0] as Vec3 },
        { sym: 'H', en: 2.20, pos: [-hx, hy, 0] as Vec3 },
      ],
      lones: [
        { pos: [0, ly,  lz] as Vec3 },
        { pos: [0, ly, -lz] as Vec3 },
      ],
      electronGeom: 'Tetrahedral', molecGeom: 'Bent',
      hyb: 'sp³', ang: '104.5°', domains: 4, lp: 2, polar: true,
      dipole: [0, -1, 0],
      anglePairs: [{ i: 0, j: 1, label: '104.5°' }],
      notes: 'Two lone pairs squeeze H–O–H from 109.5° down to 104.5°. Strongly polar (μ = 1.85 D).',
    };
  })(),
  tbp: {
    key: 'tbp', formula: 'PCl₅', name: 'Phosphorus Pentachloride',
    central: { sym: 'P', en: 2.19 },
    atoms: [
      { sym: 'Cl', en: 3.16, pos: [0, R, 0] }, { sym: 'Cl', en: 3.16, pos: [0, -R, 0] },
      { sym: 'Cl', en: 3.16, pos: [R, 0, 0] },
      { sym: 'Cl', en: 3.16, pos: [-R/2, 0,  R*Math.sqrt(3)/2] },
      { sym: 'Cl', en: 3.16, pos: [-R/2, 0, -R*Math.sqrt(3)/2] },
    ],
    lones: [], electronGeom: 'Trigonal Bipyramidal', molecGeom: 'Trigonal Bipyramidal',
    hyb: 'sp³d', ang: '90° / 120° / 180°', domains: 5, lp: 0, polar: false,
    anglePairs: [{ i: 0, j: 2, label: '90°' }, { i: 2, j: 3, label: '120°' }],
    notes: '3 equatorial (120°) + 2 axial (90° to equatorial). Symmetric → nonpolar.',
  },
  seesaw: {
    key: 'seesaw', formula: 'SF₄', name: 'Sulfur Tetrafluoride',
    central: { sym: 'S', en: 2.58 },
    atoms: [
      { sym: 'F', en: 3.98, pos: [0, R, 0] }, { sym: 'F', en: 3.98, pos: [0, -R, 0] },
      { sym: 'F', en: 3.98, pos: [R, 0, 0] },
      { sym: 'F', en: 3.98, pos: [-R/2, 0,  R*Math.sqrt(3)/2] },
    ],
    lones: [{ pos: [-R/2*0.9, 0, -R*Math.sqrt(3)/2*0.9] }],
    electronGeom: 'Trigonal Bipyramidal', molecGeom: 'See-saw',
    hyb: 'sp³d', ang: '<90° / <120°', domains: 5, lp: 1, polar: true,
    dipole: [0.6, 0, 0.4],
    anglePairs: [{ i: 2, j: 3, label: '~102°' }, { i: 0, j: 2, label: '~89°' }],
    notes: 'Lone pair takes an equatorial slot. 2 axial + 2 equatorial F → see-saw shape, polar.',
  },
  tshape: {
    key: 'tshape', formula: 'ClF₃', name: 'Chlorine Trifluoride',
    central: { sym: 'Cl', en: 3.16 },
    atoms: [
      { sym: 'F', en: 3.98, pos: [0, R, 0] }, { sym: 'F', en: 3.98, pos: [0, -R, 0] },
      { sym: 'F', en: 3.98, pos: [R, 0, 0] },
    ],
    lones: [
      { pos: [-R/2*0.9, 0,  R*Math.sqrt(3)/2*0.9] },
      { pos: [-R/2*0.9, 0, -R*Math.sqrt(3)/2*0.9] },
    ],
    electronGeom: 'Trigonal Bipyramidal', molecGeom: 'T-shape',
    hyb: 'sp³d', ang: '~87°', domains: 5, lp: 2, polar: true,
    dipole: [1, 0, 0], anglePairs: [{ i: 0, j: 2, label: '~87°' }],
    notes: 'Both lone pairs equatorial. 3 F atoms form a T. Polar.',
  },
  lin5: {
    key: 'lin5', formula: 'XeF₂', name: 'Xenon Difluoride',
    central: { sym: 'Xe', en: 2.60 },
    atoms: [{ sym: 'F', en: 3.98, pos: [0, R, 0] }, { sym: 'F', en: 3.98, pos: [0, -R, 0] }],
    lones: [{ pos: [1.5, 0, 0] }, { pos: [-0.75, 0, 1.30] }, { pos: [-0.75, 0, -1.30] }],
    electronGeom: 'Trigonal Bipyramidal', molecGeom: 'Linear',
    hyb: 'sp³d', ang: '180°', domains: 5, lp: 3, polar: false,
    notes: '3 lone pairs occupy all equatorial spots; F atoms sit axial → linear, nonpolar.',
  },
  oct: {
    key: 'oct', formula: 'SF₆', name: 'Sulfur Hexafluoride',
    central: { sym: 'S', en: 2.58 },
    atoms: [
      { sym: 'F', en: 3.98, pos: [R, 0, 0] }, { sym: 'F', en: 3.98, pos: [-R, 0, 0] },
      { sym: 'F', en: 3.98, pos: [0, R, 0] }, { sym: 'F', en: 3.98, pos: [0, -R, 0] },
      { sym: 'F', en: 3.98, pos: [0, 0, R] }, { sym: 'F', en: 3.98, pos: [0, 0, -R] },
    ],
    lones: [], electronGeom: 'Octahedral', molecGeom: 'Octahedral',
    hyb: 'sp³d²', ang: '90°', domains: 6, lp: 0, polar: false,
    anglePairs: [{ i: 0, j: 2, label: '90°' }],
    notes: '6 F at the vertices of an octahedron. All 90° apart. Symmetric → nonpolar.',
  },
  sqpyr: {
    key: 'sqpyr', formula: 'BrF₅', name: 'Bromine Pentafluoride',
    central: { sym: 'Br', en: 2.96 },
    atoms: [
      { sym: 'F', en: 3.98, pos: [0, R, 0] },
      { sym: 'F', en: 3.98, pos: [1.5, -0.4, 0] }, { sym: 'F', en: 3.98, pos: [-1.5, -0.4, 0] },
      { sym: 'F', en: 3.98, pos: [0, -0.4, 1.5] }, { sym: 'F', en: 3.98, pos: [0, -0.4, -1.5] },
    ],
    lones: [{ pos: [0, -R, 0] }],
    electronGeom: 'Octahedral', molecGeom: 'Square Pyramidal',
    hyb: 'sp³d²', ang: '~85°/90°', domains: 6, lp: 1, polar: true,
    dipole: [0, 1, 0], anglePairs: [{ i: 0, j: 1, label: '~90°' }],
    notes: 'Lone pair below the square base; 5 F form an upward pyramid. Polar.',
  },
  sqplanar: {
    key: 'sqplanar', formula: 'XeF₄', name: 'Xenon Tetrafluoride',
    central: { sym: 'Xe', en: 2.60 },
    atoms: [
      { sym: 'F', en: 3.98, pos: [R, 0, 0] }, { sym: 'F', en: 3.98, pos: [-R, 0, 0] },
      { sym: 'F', en: 3.98, pos: [0, 0, R] }, { sym: 'F', en: 3.98, pos: [0, 0, -R] },
    ],
    lones: [{ pos: [0, R, 0] }, { pos: [0, -R, 0] }],
    electronGeom: 'Octahedral', molecGeom: 'Square Planar',
    hyb: 'sp³d²', ang: '90°', domains: 6, lp: 2, polar: false,
    anglePairs: [{ i: 0, j: 2, label: '90°' }],
    notes: 'Lone pairs above and below cancel; 4 F form a square in one plane. Nonpolar.',
  },
};

const ALL_KEYS = Object.keys(MOLS) as ShapeKey[];

// VSEPR chart cells: rows = total domains 2..6, cols = lone pairs 0..4
const CHART = (() => {
  const rows: { d: number; cells: (ShapeKey | null)[] }[] = [];
  for (let d = 2; d <= 6; d++) {
    const cells: (ShapeKey | null)[] = [];
    for (let lp = 0; lp <= 4; lp++) {
      cells.push(ALL_KEYS.find(k => MOLS[k].domains === d && MOLS[k].lp === lp) ?? null);
    }
    rows.push({ d, cells });
  }
  return rows;
})();

// ───────── 3D math ─────────
function rotate(v: Vec3, yaw: number, pitch: number): Vec3 {
  // yaw around Y, then pitch around X
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const [x, y, z] = v;
  // Y rotation
  const x1 = cy * x + sy * z;
  const y1 = y;
  const z1 = -sy * x + cy * z;
  // X rotation
  const x2 = x1;
  const y2 = cp * y1 - sp * z1;
  const z2 = sp * y1 + cp * z1;
  return [x2, y2, z2];
}

function project(v: Vec3, cx: number, cy: number, scale: number): { x: number; y: number; z: number; s: number } {
  // perspective: closer atoms (z > 0 toward viewer) appear bigger
  const camZ = 6;
  const persp = camZ / (camZ - v[2]);
  return { x: cx + v[0] * scale * persp, y: cy - v[1] * scale * persp, z: v[2], s: persp };
}

// ───────── Component ─────────
export default function VSEPR() {
  const [shapeKey, setShapeKey] = useState<ShapeKey>('tet');
  const [showAngles, setShowAngles] = useState(true);
  const [showLones, setShowLones] = useState(true);
  const [autoRot, setAutoRot] = useState(true);
  const [showDipole, setShowDipole] = useState(true);

  const m = MOLS[shapeKey];

  // Rotation state
  const [yaw, setYaw] = useState(0.6);
  const [pitch, setPitch] = useState(-0.3);
  const yawRef = useRef(yaw); yawRef.current = yaw;
  const pitchRef = useRef(pitch); pitchRef.current = pitch;

  // Drag state
  const dragging = useRef<{ x: number; y: number } | null>(null);

  // Auto-rotation loop
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (autoRot && !document.hidden && !dragging.current) {
        setYaw(y => y + dt * 0.45);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [autoRot]);

  // Pause on tab hidden — handled implicitly by the document.hidden check above.

  // Pointer drag
  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragging.current = { x: e.clientX, y: e.clientY };
  }
  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!dragging.current) return;
    const dx = e.clientX - dragging.current.x;
    const dy = e.clientY - dragging.current.y;
    dragging.current = { x: e.clientX, y: e.clientY };
    setYaw(y => y + dx * 0.01);
    setPitch(p => Math.max(-1.4, Math.min(1.4, p + dy * 0.01)));
  }
  function onPointerUp() {
    dragging.current = null;
  }

  // Search/dropdown molecule list
  const dropdown = useMemo(() => {
    const base = ALL_KEYS.map(k => ({
      key: k,
      label: `${MOLS[k].formula} — ${MOLS[k].name} (${MOLS[k].molecGeom})`,
    }));
    return base;
  }, []);

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {/* Top: dropdown + chart */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
        <div style={{
          background: 'var(--ink-1)', border: '1px solid var(--line)',
          borderRadius: 6, padding: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div className="eyebrow">VSEPR chart · click any cell</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="eyebrow">Or pick:</span>
              <select
                value={shapeKey}
                onChange={(e) => setShapeKey(e.target.value as ShapeKey)}
                className="mono"
                style={{
                  background: 'var(--ink-2)', color: 'var(--paper)',
                  border: '1px solid var(--line-strong)', borderRadius: 4,
                  padding: '6px 10px', fontSize: 11, letterSpacing: '0.06em',
                }}
              >
                {dropdown.map(o => (
                  <option key={o.key} value={o.key}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginTop: 12, overflowX: 'auto' }}>
            <table style={{
              width: '100%', borderCollapse: 'separate', borderSpacing: 4,
              fontFamily: 'JetBrains Mono', fontSize: 11,
            }}>
              <thead>
                <tr>
                  <th style={th()}>Domains ↓ / LPs →</th>
                  {[0, 1, 2, 3, 4].map(c => <th key={c} style={th()}>{c} lone</th>)}
                </tr>
              </thead>
              <tbody>
                {CHART.map(row => (
                  <tr key={row.d}>
                    <th style={th()}>{row.d} domain</th>
                    {row.cells.map((k, i) => {
                      if (!k) return <td key={i} style={td(false, false)}>—</td>;
                      const active = k === shapeKey;
                      return (
                        <td key={i} style={{ padding: 0 }}>
                          <button
                            type="button"
                            onClick={() => setShapeKey(k)}
                            aria-pressed={active}
                            style={{
                              ...td(true, active),
                              cursor: 'pointer', width: '100%', textAlign: 'left',
                              font: 'inherit',
                            }}
                          >
                            <div className="serif" style={{ fontSize: 13, marginBottom: 2, color: active ? 'var(--ink-0)' : 'var(--paper)' }}>
                              {MOLS[k].molecGeom}
                            </div>
                            <div style={{ fontSize: 10, color: active ? 'var(--ink-0)' : 'var(--paper-dim)' }}>
                              {MOLS[k].formula}
                            </div>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Scene + side panel */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 }}>
        {/* SVG scene */}
        <div style={{
          position: 'relative',
          background: 'radial-gradient(circle at 50% 60%, #1a1612 0%, var(--ink-1) 75%)',
          border: '1px solid var(--line)', borderRadius: 6,
          aspectRatio: '1.3 / 1', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: 14, left: 16, right: 16, zIndex: 4,
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', pointerEvents: 'none',
          }}>
            <div>
              <div className="eyebrow">{m.name}</div>
              <div className="serif" style={{ fontSize: 28, fontStyle: 'italic', lineHeight: 1, marginTop: 4 }}>
                {m.formula}
              </div>
            </div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--paper-faint)', letterSpacing: '0.14em' }}>
              DRAG TO ROTATE
            </div>
          </div>

          <Scene
            mol={m}
            yaw={yaw}
            pitch={pitch}
            showAngles={showAngles}
            showLones={showLones}
            showDipole={showDipole}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          />

          {/* Toggles */}
          <div style={{
            position: 'absolute', bottom: 14, left: 16, right: 16, zIndex: 5,
            display: 'flex', gap: 6, flexWrap: 'wrap',
          }}>
            <Toggle on={showAngles} onChange={setShowAngles}>Angles</Toggle>
            <Toggle on={showLones} onChange={setShowLones}>Lone pairs</Toggle>
            <Toggle on={autoRot} onChange={setAutoRot}>Auto-rotate</Toggle>
            <Toggle on={showDipole} onChange={setShowDipole}>Dipole</Toggle>
          </div>
        </div>

        {/* Side panel */}
        <div style={{
          background: 'var(--ink-1)', border: '1px solid var(--line)',
          borderRadius: 6, padding: 24,
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          <div className="eyebrow">Molecular Geometry</div>
          <div className="serif" style={{ fontSize: 28, lineHeight: 1.05 }}>{m.molecGeom}</div>
          <div style={{ color: 'var(--paper-dim)', fontSize: 13, lineHeight: 1.55 }}>{m.notes}</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <Mini label="Domains" value={`${m.domains}`} />
            <Mini label="Bonded" value={`${m.atoms.length}`} />
            <Mini label="Lone pairs" value={`${m.lp}`} accent={m.lp > 0 ? '#a78bfa' : undefined} />
          </div>

          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Stat label="Electron geometry" value={m.electronGeom} />
            <Stat label="Hybridization" value={m.hyb} />
            <Stat label="Bond angle" value={m.ang} />
            <Stat
              label="Polarity"
              value={m.polar ? 'Polar' : 'Nonpolar'}
              accent={m.polar ? '#ff6b35' : '#9be39d'}
            />
          </div>

          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Legend</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <LegendRow color={ELEM[m.central.sym]?.color ?? '#fff'} sym={m.central.sym} label="Central atom" />
              {Array.from(new Set(m.atoms.map(a => a.sym))).map(sym => (
                <LegendRow key={sym} color={ELEM[sym]?.color ?? '#fff'} sym={sym} label="Bonded atom" />
              ))}
              {m.lones.length > 0 && (
                <LegendRow color="#a78bfa" sym=":" label={`Lone pair × ${m.lones.length}`} dashed />
              )}
              {m.polar && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                  <svg width="22" height="22" viewBox="0 0 22 22">
                    <line x1="3" y1="11" x2="17" y2="11" stroke="#ff6b35" strokeWidth="2" />
                    <polygon points="17,11 13,8 13,14" fill="#ff6b35" />
                  </svg>
                  <span style={{ color: 'var(--paper)' }}>Net dipole μ</span>
                </div>
              )}
            </div>
          </div>

          <div className="mono" style={{ marginTop: 'auto', fontSize: 10, color: 'var(--paper-faint)', letterSpacing: '0.14em' }}>
            {shapeKey === 'linear' ? 'ALSO: BeCl₂ — same AX₂ linear geometry' : 'AP CHEM · VSEPR THEORY'}
          </div>
        </div>
      </div>
    </div>
  );
}

// ───────── SVG scene ─────────
function Scene({
  mol, yaw, pitch, showAngles, showLones, showDipole,
  onPointerDown, onPointerMove, onPointerUp,
}: {
  mol: Mol; yaw: number; pitch: number;
  showAngles: boolean; showLones: boolean; showDipole: boolean;
  onPointerDown: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerMove: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerUp: () => void;
}) {
  const W = 600, H = 460;
  const cx = W / 2, cy = H / 2;
  const SCALE = 70;

  // Project all renderable elements with depth for painter's-algorithm sort
  type Item =
    | { kind: 'atom'; depth: number; sym: string; px: number; py: number; r: number; central: boolean }
    | { kind: 'bond'; depth: number; ax: number; ay: number; bx: number; by: number; az: number; bz: number }
    | { kind: 'lone'; depth: number; px: number; py: number; r: number }
    | { kind: 'angle'; depth: number; px: number; py: number; label: string };

  const items: Item[] = [];

  // Central atom
  const centralR = 26;
  items.push({ kind: 'atom', depth: 0, sym: mol.central.sym, px: cx, py: cy, r: centralR, central: true });

  // Bonds + bonded atoms
  const projectedAtoms = mol.atoms.map((a) => {
    const r3 = rotate(a.pos, yaw, pitch);
    const p = project(r3, cx, cy, SCALE);
    return { atom: a, r3, p };
  });

  projectedAtoms.forEach(({ atom, r3, p }) => {
    items.push({
      kind: 'bond',
      depth: r3[2] / 2,
      ax: cx, ay: cy, bx: p.x, by: p.y, az: 0, bz: r3[2],
    });
    const atomR = (atom.sym === 'H' ? 16 : 22) * p.s;
    items.push({
      kind: 'atom', depth: r3[2], sym: atom.sym,
      px: p.x, py: p.y, r: atomR, central: false,
    });
  });

  // Lone pairs
  if (showLones) {
    mol.lones.forEach((l) => {
      const r3 = rotate(l.pos, yaw, pitch);
      const p = project(r3, cx, cy, SCALE);
      items.push({ kind: 'lone', depth: r3[2], px: p.x, py: p.y, r: 22 * p.s });
    });
  }

  // Angle labels (between bond pairs)
  if (showAngles) {
    const pairs: AnglePair[] = mol.anglePairs ?? (mol.atoms.length >= 2
      ? [{ i: 0, j: 1, label: mol.ang }]
      : []);
    pairs.forEach((pair) => {
      const a = projectedAtoms[pair.i];
      const b = projectedAtoms[pair.j];
      if (!a || !b) return;
      // Place label at midpoint of arc (average direction × small radius)
      const mid: Vec3 = [
        (a.r3[0] + b.r3[0]) / 2,
        (a.r3[1] + b.r3[1]) / 2,
        (a.r3[2] + b.r3[2]) / 2,
      ];
      const len = Math.hypot(mid[0], mid[1], mid[2]) || 1;
      const k = 1.05 / len;
      const labelP = project([mid[0] * k, mid[1] * k, mid[2] * k], cx, cy, SCALE);
      items.push({ kind: 'angle', depth: 999, px: labelP.x, py: labelP.y, label: pair.label });
    });
  }

  // Sort back-to-front
  items.sort((a, b) => a.depth - b.depth);

  // Dipole arrow (in molecule frame, then rotated)
  let dipoleSvg: React.ReactNode = null;
  if (showDipole && mol.polar && mol.dipole) {
    const tip = rotate([mol.dipole[0] * 2.4, mol.dipole[1] * 2.4, mol.dipole[2] * 2.4], yaw, pitch);
    const tipP = project(tip, cx, cy, SCALE);
    const tail = project(rotate([0, 0, 0], yaw, pitch), cx, cy, SCALE);
    const ang = Math.atan2(tipP.y - tail.y, tipP.x - tail.x);
    const ah = 10;
    const ax1 = tipP.x - ah * Math.cos(ang - 0.4);
    const ay1 = tipP.y - ah * Math.sin(ang - 0.4);
    const ax2 = tipP.x - ah * Math.cos(ang + 0.4);
    const ay2 = tipP.y - ah * Math.sin(ang + 0.4);
    dipoleSvg = (
      <g opacity="0.95">
        <line x1={tail.x} y1={tail.y} x2={tipP.x} y2={tipP.y}
              stroke="#ff6b35" strokeWidth="2.5" strokeLinecap="round"
              strokeDasharray="4 4" />
        <polygon points={`${tipP.x},${tipP.y} ${ax1},${ay1} ${ax2},${ay2}`} fill="#ff6b35" />
        <text x={tipP.x + 6} y={tipP.y - 6} fontFamily="JetBrains Mono"
              fontSize="11" fill="#ff6b35">μ</text>
      </g>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      width="100%" height="100%"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{ touchAction: 'none', cursor: 'grab', display: 'block' }}
    >
      <defs>
        {Object.entries(ELEM).map(([sym, c]) => (
          <radialGradient key={sym} id={`g-${sym}`} cx="35%" cy="30%" r="65%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
            <stop offset="35%" stopColor={c.color} stopOpacity="1" />
            <stop offset="100%" stopColor={c.ring} stopOpacity="1" />
          </radialGradient>
        ))}
        <radialGradient id="g-lone" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#e0d2ff" stopOpacity="0.85" />
          <stop offset="60%" stopColor="#a78bfa" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* faint floor */}
      <ellipse cx={cx} cy={H - 36} rx={120} ry={14} fill="#000" opacity="0.35" />

      {items.map((it, idx) => {
        if (it.kind === 'bond') {
          return (
            <line key={idx}
                  x1={it.ax} y1={it.ay} x2={it.bx} y2={it.by}
                  stroke="#d6c9b3" strokeOpacity={0.55 + 0.25 * Math.max(0, (it.bz + 2) / 4)}
                  strokeWidth={3} strokeLinecap="round" />
          );
        }
        if (it.kind === 'atom') {
          const e = ELEM[it.sym] ?? { color: '#888', ring: '#444', text: '#000' };
          return (
            <g key={idx}>
              <circle cx={it.px} cy={it.py} r={it.r + 1.5} fill="rgba(0,0,0,0.5)" />
              <circle cx={it.px} cy={it.py} r={it.r} fill={`url(#g-${it.sym})`}
                      stroke={e.ring} strokeWidth="1" />
              <text x={it.px} y={it.py + it.r * 0.32}
                    textAnchor="middle"
                    fontFamily="Fraunces, serif" fontWeight="700"
                    fontSize={it.r * 0.95}
                    fill={e.text}>
                {it.sym}
              </text>
            </g>
          );
        }
        if (it.kind === 'lone') {
          return (
            <g key={idx}>
              <circle cx={it.px} cy={it.py} r={it.r * 1.6} fill="url(#g-lone)" />
              <circle cx={it.px - it.r * 0.32} cy={it.py} r={it.r * 0.18} fill="#e0d2ff" />
              <circle cx={it.px + it.r * 0.32} cy={it.py} r={it.r * 0.18} fill="#e0d2ff" />
            </g>
          );
        }
        if (it.kind === 'angle') {
          const pad = 4;
          const text = it.label;
          const w = text.length * 6 + pad * 2;
          return (
            <g key={idx}>
              <rect x={it.px - w / 2} y={it.py - 9}
                    width={w} height={16} rx={3}
                    fill="rgba(10,9,8,0.85)" stroke="#fbbf2466" />
              <text x={it.px} y={it.py + 3}
                    textAnchor="middle"
                    fontFamily="JetBrains Mono" fontSize="10" fill="#fbbf24">
                {text}
              </text>
            </g>
          );
        }
        return null;
      })}

      {dipoleSvg}
    </svg>
  );
}

// ───────── UI atoms ─────────
function Toggle({ on, onChange, children }: { on: boolean; onChange: (b: boolean) => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      aria-pressed={on}
      className="mono"
      style={{
        padding: '6px 12px', fontSize: 10, letterSpacing: '0.14em',
        textTransform: 'uppercase',
        border: `1px solid ${on ? 'var(--paper)' : 'var(--line-strong)'}`,
        background: on ? 'var(--paper)' : 'rgba(10,9,8,0.6)',
        color: on ? 'var(--ink-0)' : 'var(--paper)',
        cursor: 'pointer',
        backdropFilter: 'blur(6px)',
        borderRadius: 4,
      }}
    >
      {on ? '● ' : '○ '}{children}
    </button>
  );
}

function th(): React.CSSProperties {
  return {
    background: 'var(--ink-2)', color: 'var(--paper-dim)',
    fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
    padding: '8px 10px', border: '1px solid var(--line)',
    textAlign: 'left', fontWeight: 400, whiteSpace: 'nowrap',
  };
}
function td(filled: boolean, active: boolean): React.CSSProperties {
  return {
    padding: '10px 12px',
    border: `1px solid ${active ? 'var(--paper)' : 'var(--line)'}`,
    background: active ? 'var(--paper)' : (filled ? 'var(--ink-2)' : 'transparent'),
    color: filled ? (active ? 'var(--ink-0)' : 'var(--paper)') : 'var(--paper-faint)',
    minWidth: 130, transition: 'all 150ms ease',
  };
}
function LegendRow({ color, sym, label, dashed }: { color: string; sym: string; label: string; dashed?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
      <div style={{
        width: 22, height: 22, borderRadius: '50%',
        background: dashed ? 'transparent' : color,
        border: dashed ? '1.5px dashed #a78bfa' : 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, fontSize: 11,
        color: dashed ? '#a78bfa' : (ELEM[sym]?.text ?? '#0a0908'),
        flexShrink: 0,
      }}>{sym}</div>
      <span style={{ color: 'var(--paper)' }}>{label}</span>
    </div>
  );
}
function Mini({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ padding: '8px 10px', background: 'var(--ink-2)', borderRadius: 4, border: '1px solid var(--line)' }}>
      <div className="eyebrow" style={{ marginBottom: 2, fontSize: 9 }}>{label}</div>
      <div className="serif" style={{ fontSize: 18, color: accent ?? 'var(--paper)' }}>{value}</div>
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
