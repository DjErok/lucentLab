import { useEffect, useMemo, useRef, useState } from 'react';
import UISlider from '../components/ui/Slider';
import SlideTabs from '../components/ui/SlideTabs';

/**
 * Resonance — Lewis structures, the resonance hybrid, formal charge & bond order.
 * Cycle through individual resonance forms (LEFT), see the averaged hybrid
 * with fractional bond orders + partial charges (CENTER), and a numerical
 * breakdown with formal-charge arithmetic (RIGHT).
 */

// ───────── types ─────────

type Pt = { x: number; y: number };

type AtomSpec = {
  id: string;
  el: string;       // element symbol displayed
  pos: Pt;
  color: string;
  Z: number;        // valence electrons
  EN?: number;      // electronegativity (Pauling) — for stability commentary
};

type BondSpec = {
  a: string;        // atom id
  b: string;        // atom id
  order: 1 | 2 | 3; // in this resonance form
};

type Form = {
  bonds: BondSpec[];
  // lone pairs (count) per atom in this form
  lonePairs: Record<string, number>;
  // formal charge per atom in this form (computed; included for clarity)
  formalCharges: Record<string, number>;
};

type Molecule = {
  id: string;
  label: string;
  formula: React.ReactNode;
  charge: number;                  // overall charge
  atoms: AtomSpec[];
  forms: Form[];
  // averaged bond orders for the hybrid, keyed by "a-b" (a<b lexicographically)
  hybridBondOrders: Record<string, number>;
  // averaged partial charge per atom (signed, rough rational fractions for display)
  partialCharges: Record<string, string>;
  // measured / typical bond lengths (Å)
  bondLengths: { hybrid: number; single: number; double: number; label: string };
  caption: string;
};

// ───────── colors ─────────

const C_O = '#ff5b3c';
const C_N = '#5dd0ff';
const C_C = '#7d8d99';
const C_S = '#fbbf24';
const C_H = '#f0e6d2';

// ───────── molecule definitions ─────────

const MOLECULES: Molecule[] = [
  // ── NO3⁻ ─────────────────────────────────────────────
  (() => {
    const atoms: AtomSpec[] = [
      { id: 'N',  el: 'N', pos: { x: 200, y: 145 }, color: C_N, Z: 5, EN: 3.04 },
      { id: 'O1', el: 'O', pos: { x: 200, y: 50  }, color: C_O, Z: 6, EN: 3.44 },
      { id: 'O2', el: 'O', pos: { x: 110, y: 215 }, color: C_O, Z: 6, EN: 3.44 },
      { id: 'O3', el: 'O', pos: { x: 290, y: 215 }, color: C_O, Z: 6, EN: 3.44 },
    ];
    const mk = (dbl: 'O1'|'O2'|'O3'): Form => {
      const lp: Record<string, number> = { N: 0, O1: dbl==='O1'?2:3, O2: dbl==='O2'?2:3, O3: dbl==='O3'?2:3 };
      const fc: Record<string, number> = { N: +1, O1: dbl==='O1'?0:-1, O2: dbl==='O2'?0:-1, O3: dbl==='O3'?0:-1 };
      return {
        bonds: [
          { a: 'N', b: 'O1', order: dbl==='O1'?2:1 },
          { a: 'N', b: 'O2', order: dbl==='O2'?2:1 },
          { a: 'N', b: 'O3', order: dbl==='O3'?2:1 },
        ],
        lonePairs: lp, formalCharges: fc,
      };
    };
    return {
      id: 'no3', label: 'Nitrate · NO₃⁻',
      formula: <>NO<sub>3</sub><sup>−</sup></>,
      charge: -1,
      atoms,
      forms: [mk('O1'), mk('O2'), mk('O3')],
      hybridBondOrders: { 'N-O1': 4/3, 'N-O2': 4/3, 'N-O3': 4/3 },
      partialCharges: { N: '+1', O1: '−⅔', O2: '−⅔', O3: '−⅔' },
      bondLengths: { hybrid: 1.27, single: 1.40, double: 1.20, label: 'N–O' },
      caption: 'All three N–O bonds are EQUAL (1.27 Å, bond order 1.33). One double + two single, averaged.',
    };
  })(),

  // ── O3 ───────────────────────────────────────────────
  (() => {
    const atoms: AtomSpec[] = [
      { id: 'Oa', el: 'O', pos: { x: 110, y: 200 }, color: C_O, Z: 6, EN: 3.44 },
      { id: 'Ob', el: 'O', pos: { x: 200, y: 110 }, color: C_O, Z: 6, EN: 3.44 },
      { id: 'Oc', el: 'O', pos: { x: 290, y: 200 }, color: C_O, Z: 6, EN: 3.44 },
    ];
    const mk = (dbl: 'left'|'right'): Form => ({
      bonds: [
        { a: 'Oa', b: 'Ob', order: dbl==='left'?2:1 },
        { a: 'Ob', b: 'Oc', order: dbl==='right'?2:1 },
      ],
      lonePairs: {
        Oa: dbl==='left' ? 2 : 3,
        Ob: 1,
        Oc: dbl==='right'? 2 : 3,
      },
      formalCharges: {
        Oa: dbl==='left' ? 0 : -1,
        Ob: +1,
        Oc: dbl==='right'? 0 : -1,
      },
    });
    return {
      id: 'o3', label: 'Ozone · O₃',
      formula: <>O<sub>3</sub></>,
      charge: 0,
      atoms,
      forms: [mk('left'), mk('right')],
      hybridBondOrders: { 'Oa-Ob': 1.5, 'Ob-Oc': 1.5 },
      partialCharges: { Oa: '−½', Ob: '+1', Oc: '−½' },
      bondLengths: { hybrid: 1.28, single: 1.48, double: 1.21, label: 'O–O' },
      caption: 'Both O–O bonds are EQUAL (1.28 Å, bond order 1.5). Central O carries +1, end Os each share −1.',
    };
  })(),

  // ── CO3 2− ───────────────────────────────────────────
  (() => {
    const atoms: AtomSpec[] = [
      { id: 'C',  el: 'C', pos: { x: 200, y: 145 }, color: C_C, Z: 4, EN: 2.55 },
      { id: 'O1', el: 'O', pos: { x: 200, y: 50  }, color: C_O, Z: 6, EN: 3.44 },
      { id: 'O2', el: 'O', pos: { x: 110, y: 215 }, color: C_O, Z: 6, EN: 3.44 },
      { id: 'O3', el: 'O', pos: { x: 290, y: 215 }, color: C_O, Z: 6, EN: 3.44 },
    ];
    const mk = (dbl: 'O1'|'O2'|'O3'): Form => ({
      bonds: [
        { a: 'C', b: 'O1', order: dbl==='O1'?2:1 },
        { a: 'C', b: 'O2', order: dbl==='O2'?2:1 },
        { a: 'C', b: 'O3', order: dbl==='O3'?2:1 },
      ],
      lonePairs: { C: 0, O1: dbl==='O1'?2:3, O2: dbl==='O2'?2:3, O3: dbl==='O3'?2:3 },
      formalCharges: { C: 0, O1: dbl==='O1'?0:-1, O2: dbl==='O2'?0:-1, O3: dbl==='O3'?0:-1 },
    });
    return {
      id: 'co3', label: 'Carbonate · CO₃²⁻',
      formula: <>CO<sub>3</sub><sup>2−</sup></>,
      charge: -2,
      atoms,
      forms: [mk('O1'), mk('O2'), mk('O3')],
      hybridBondOrders: { 'C-O1': 4/3, 'C-O2': 4/3, 'C-O3': 4/3 },
      partialCharges: { C: '0', O1: '−⅔', O2: '−⅔', O3: '−⅔' },
      bondLengths: { hybrid: 1.29, single: 1.43, double: 1.23, label: 'C–O' },
      caption: 'All three C–O bonds are EQUAL (1.29 Å, bond order 1.33). The 2− charge is shared (−2/3 per O).',
    };
  })(),

  // ── SO2 ──────────────────────────────────────────────
  (() => {
    const atoms: AtomSpec[] = [
      { id: 'S',  el: 'S', pos: { x: 200, y: 110 }, color: C_S, Z: 6, EN: 2.58 },
      { id: 'Oa', el: 'O', pos: { x: 110, y: 210 }, color: C_O, Z: 6, EN: 3.44 },
      { id: 'Ob', el: 'O', pos: { x: 290, y: 210 }, color: C_O, Z: 6, EN: 3.44 },
    ];
    const mk = (dbl: 'left'|'right'): Form => ({
      bonds: [
        { a: 'S', b: 'Oa', order: dbl==='left'?2:1 },
        { a: 'S', b: 'Ob', order: dbl==='right'?2:1 },
      ],
      lonePairs: {
        S: 1,
        Oa: dbl==='left' ? 2 : 3,
        Ob: dbl==='right'? 2 : 3,
      },
      formalCharges: {
        S: +1,
        Oa: dbl==='left' ? 0 : -1,
        Ob: dbl==='right'? 0 : -1,
      },
    });
    return {
      id: 'so2', label: 'Sulfur dioxide · SO₂',
      formula: <>SO<sub>2</sub></>,
      charge: 0,
      atoms,
      forms: [mk('left'), mk('right')],
      hybridBondOrders: { 'Oa-S': 1.5, 'Ob-S': 1.5 },
      partialCharges: { S: '+1', Oa: '−½', Ob: '−½' },
      bondLengths: { hybrid: 1.43, single: 1.70, double: 1.40, label: 'S–O' },
      caption: 'Both S–O bonds are EQUAL (1.43 Å, bond order 1.5). One single + one double, averaged.',
    };
  })(),

  // ── Benzene C6H6 (Kekulé) ────────────────────────────
  (() => {
    const R = 78, cx = 200, cy = 140;
    const ringAt = (k: number) => ({
      x: cx + R * Math.cos(-Math.PI/2 + k * Math.PI/3),
      y: cy + R * Math.sin(-Math.PI/2 + k * Math.PI/3),
    });
    const Hr = 110;
    const hAt = (k: number) => ({
      x: cx + Hr * Math.cos(-Math.PI/2 + k * Math.PI/3),
      y: cy + Hr * Math.sin(-Math.PI/2 + k * Math.PI/3),
    });
    const atoms: AtomSpec[] = [];
    for (let i = 0; i < 6; i++) atoms.push({ id: `C${i}`, el: 'C', pos: ringAt(i), color: C_C, Z: 4, EN: 2.55 });
    for (let i = 0; i < 6; i++) atoms.push({ id: `H${i}`, el: 'H', pos: hAt(i), color: C_H, Z: 1, EN: 2.20 });
    const mk = (start: 0|1): Form => {
      const bonds: BondSpec[] = [];
      for (let i = 0; i < 6; i++) {
        const j = (i + 1) % 6;
        bonds.push({ a: `C${i}`, b: `C${j}`, order: ((i + start) % 2 === 0 ? 2 : 1) as 1|2 });
      }
      for (let i = 0; i < 6; i++) bonds.push({ a: `C${i}`, b: `H${i}`, order: 1 });
      const lp: Record<string, number> = {};
      const fc: Record<string, number> = {};
      atoms.forEach(a => { lp[a.id] = 0; fc[a.id] = 0; });
      return { bonds, lonePairs: lp, formalCharges: fc };
    };
    const hybridBO: Record<string, number> = {};
    for (let i = 0; i < 6; i++) {
      const j = (i + 1) % 6;
      hybridBO[`C${i}-C${j}`] = 1.5;
    }
    for (let i = 0; i < 6; i++) hybridBO[`C${i}-H${i}`] = 1;
    const partials: Record<string, string> = {};
    atoms.forEach(a => { partials[a.id] = '0'; });
    return {
      id: 'benzene', label: 'Benzene · C₆H₆',
      formula: <>C<sub>6</sub>H<sub>6</sub></>,
      charge: 0,
      atoms,
      forms: [mk(0), mk(1)],
      hybridBondOrders: hybridBO,
      partialCharges: partials,
      bondLengths: { hybrid: 1.40, single: 1.54, double: 1.34, label: 'C–C' },
      caption: 'All six C–C bonds are EQUAL (1.40 Å, bond order 1.5). The π electrons are delocalized around the ring.',
    };
  })(),

  // ── CH3COO⁻ acetate ──────────────────────────────────
  (() => {
    const atoms: AtomSpec[] = [
      { id: 'C1', el: 'C', pos: { x: 110, y: 145 }, color: C_C, Z: 4, EN: 2.55 },
      { id: 'C2', el: 'C', pos: { x: 210, y: 145 }, color: C_C, Z: 4, EN: 2.55 },
      { id: 'O1', el: 'O', pos: { x: 290, y: 80  }, color: C_O, Z: 6, EN: 3.44 },
      { id: 'O2', el: 'O', pos: { x: 290, y: 210 }, color: C_O, Z: 6, EN: 3.44 },
      { id: 'H1', el: 'H', pos: { x: 60,  y: 80  }, color: C_H, Z: 1, EN: 2.20 },
      { id: 'H2', el: 'H', pos: { x: 60,  y: 210 }, color: C_H, Z: 1, EN: 2.20 },
      { id: 'H3', el: 'H', pos: { x: 110, y: 50  }, color: C_H, Z: 1, EN: 2.20 },
    ];
    const mk = (dbl: 'O1'|'O2'): Form => ({
      bonds: [
        { a: 'C1', b: 'C2', order: 1 },
        { a: 'C2', b: 'O1', order: dbl==='O1'?2:1 },
        { a: 'C2', b: 'O2', order: dbl==='O2'?2:1 },
        { a: 'C1', b: 'H1', order: 1 },
        { a: 'C1', b: 'H2', order: 1 },
        { a: 'C1', b: 'H3', order: 1 },
      ],
      lonePairs: {
        C1: 0, C2: 0,
        O1: dbl==='O1' ? 2 : 3,
        O2: dbl==='O2' ? 2 : 3,
        H1: 0, H2: 0, H3: 0,
      },
      formalCharges: {
        C1: 0, C2: 0,
        O1: dbl==='O1' ? 0 : -1,
        O2: dbl==='O2' ? 0 : -1,
        H1: 0, H2: 0, H3: 0,
      },
    });
    return {
      id: 'acetate', label: 'Acetate · CH₃COO⁻',
      formula: <>CH<sub>3</sub>COO<sup>−</sup></>,
      charge: -1,
      atoms,
      forms: [mk('O1'), mk('O2')],
      hybridBondOrders: {
        'C1-C2': 1, 'C2-O1': 1.5, 'C2-O2': 1.5,
        'C1-H1': 1, 'C1-H2': 1, 'C1-H3': 1,
      },
      partialCharges: { C1: '0', C2: '+δ', O1: '−½', O2: '−½', H1: '0', H2: '0', H3: '0' },
      bondLengths: { hybrid: 1.26, single: 1.43, double: 1.23, label: 'C–O (carboxylate)' },
      caption: 'Both carboxylate C–O bonds are EQUAL (1.26 Å, bond order 1.5). The negative charge is shared across both oxygens.',
    };
  })(),
];

// ───────── helpers ─────────

function bondKey(a: string, b: string) {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

// detect which atom/bond CHANGED between two forms (for highlight)
function diffForms(prev: Form, cur: Form): { atoms: Set<string>; bonds: Set<string> } {
  const atoms = new Set<string>();
  const bonds = new Set<string>();
  // formal charges
  for (const id of Object.keys(cur.formalCharges)) {
    if ((prev.formalCharges[id] ?? 0) !== cur.formalCharges[id]) atoms.add(id);
  }
  // bond order changes
  const prevMap = new Map(prev.bonds.map(b => [bondKey(b.a, b.b), b.order]));
  for (const b of cur.bonds) {
    const k = bondKey(b.a, b.b);
    if ((prevMap.get(k) ?? 0) !== b.order) bonds.add(k);
  }
  return { atoms, bonds };
}

// Formal charge: FC = Z − non-bonding e⁻ − ½(bonding e⁻)
function formalChargeArith(atom: AtomSpec, form: Form) {
  const lp = form.lonePairs[atom.id] ?? 0;
  const nonBonding = lp * 2;
  const bondsOnAtom = form.bonds.filter(b => b.a === atom.id || b.b === atom.id);
  const bondingE = bondsOnAtom.reduce((s, b) => s + b.order * 2, 0);
  const fc = atom.Z - nonBonding - bondingE / 2;
  return { Z: atom.Z, nonBonding, bondingE, fc };
}

// ───────── component ─────────

export default function Resonance() {
  const [molId, setMolId] = useState(MOLECULES[0].id);
  const mol = MOLECULES.find(m => m.id === molId)!;

  const [form, setForm] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1.5); // seconds per form
  const [showRules, setShowRules] = useState(true);

  // reset form on molecule change
  useEffect(() => { setForm(0); }, [molId]);

  // auto-cycle via rAF (pause when document.hidden)
  const lastTickRef = useRef<number>(0);
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    lastTickRef.current = performance.now();
    const loop = (now: number) => {
      if (!document.hidden) {
        const dt = (now - lastTickRef.current) / 1000;
        if (dt >= speed) {
          lastTickRef.current = now;
          setForm(f => (f + 1) % mol.forms.length);
        }
      } else {
        lastTickRef.current = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, mol.forms.length]);

  const curForm = mol.forms[form];
  const prevForm = mol.forms[(form - 1 + mol.forms.length) % mol.forms.length];
  const diff = useMemo(() => diffForms(prevForm, curForm), [prevForm, curForm]);

  const avgBO = useMemo(() => {
    const vals = Object.values(mol.hybridBondOrders).filter(v => v > 1);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 1;
  }, [mol]);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Molecule selector */}
      <SlideTabs<string>
        tabs={MOLECULES.map(m => ({ id: m.id, label: m.label }))}
        value={molId}
        onChange={setMolId}
      />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
        <div className="serif" style={{ fontSize: 24, fontStyle: 'italic' }}>{mol.formula}</div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--paper-dim)' }}>
          {mol.forms.length} resonance form{mol.forms.length === 1 ? '' : 's'} · overall charge {mol.charge >= 0 ? `+${mol.charge}` : mol.charge}
        </div>
      </div>

      {/* Three-panel display */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
        {/* LEFT: cycling resonance form */}
        <Panel>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="eyebrow">Resonance form {form + 1} of {mol.forms.length}</div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--paper-dim)' }}>
              {playing ? 'AUTO' : 'PAUSED'}
            </div>
          </div>
          <svg viewBox="0 0 400 280" style={{ width: '100%', height: 240, marginTop: 6 }}>
            <LewisStructure mol={mol} form={curForm} highlightAtoms={diff.atoms} highlightBonds={diff.bonds} />
            <BracketCharge charge={mol.charge} />
          </svg>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 4 }}>
            {mol.forms.map((_, i) => (
              <div key={i} style={{
                width: 8, height: 8, borderRadius: '50%',
                background: i === form ? 'var(--paper)' : 'var(--line-strong)',
                transition: 'background 200ms',
              }} />
            ))}
          </div>
        </Panel>

        {/* CENTER: hybrid */}
        <Panel>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="eyebrow">Resonance hybrid (real molecule)</div>
            <BondOrderPill value={avgBO} />
          </div>
          <svg viewBox="0 0 400 280" style={{ width: '100%', height: 240, marginTop: 6 }}>
            <HybridStructure mol={mol} />
            <BracketCharge charge={mol.charge} />
          </svg>
          <div className="mono" style={{ fontSize: 10, color: 'var(--paper-dim)', textAlign: 'center', marginTop: 4 }}>
            ↔ averaged · solid + dashed = partial π bond
          </div>
        </Panel>

        {/* RIGHT: numerical breakdown */}
        <Panel>
          <div className="eyebrow">Numerical breakdown</div>

          <div style={{ marginTop: 8, padding: 10, background: 'var(--ink-2)', borderRadius: 4 }}>
            <div className="eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>Bond orders (hybrid)</div>
            <div style={{ display: 'grid', gap: 3 }}>
              {Object.entries(mol.hybridBondOrders)
                .filter(([, v]) => v > 1 || mol.id === 'acetate' && v === 1)
                .slice(0, 6)
                .map(([k, v]) => (
                  <div key={k} className="mono" style={{ fontSize: 11, display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--paper-dim)' }}>{k.replace('-', '–')}</span>
                    <span style={{ color: v > 1 ? 'var(--phos)' : 'var(--paper)' }}>{v.toFixed(2)}</span>
                  </div>
                ))}
            </div>
          </div>

          <div style={{ marginTop: 8, padding: 10, background: 'var(--ink-2)', borderRadius: 4 }}>
            <div className="eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>Partial charges (hybrid)</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
              {mol.atoms.filter(a => a.el !== 'H').map(a => (
                <div key={a.id} className="mono" style={{ fontSize: 11, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: a.color }}>{a.el}{subscriptId(a.id)}</span>
                  <span style={{ color: 'var(--paper)' }}>δ {mol.partialCharges[a.id] ?? '0'}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 8, padding: 10, background: 'var(--ink-2)', borderRadius: 4 }}>
            <div className="eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>{mol.bondLengths.label} bond length (Å)</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              <Mini label="single" v={mol.bondLengths.single.toFixed(2)} />
              <Mini label="hybrid" v={mol.bondLengths.hybrid.toFixed(2)} accent="var(--phos)" />
              <Mini label="double" v={mol.bondLengths.double.toFixed(2)} />
            </div>
            <BondLengthBar single={mol.bondLengths.single} hybrid={mol.bondLengths.hybrid} double={mol.bondLengths.double} />
          </div>
        </Panel>
      </div>

      {/* Caption + controls */}
      <div style={{
        background: 'var(--ink-1)', border: '1px solid var(--line)',
        borderRadius: 6, padding: 16,
        display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16,
      }}>
        <div>
          <div className="eyebrow">Why this matters</div>
          <div className="serif" style={{ fontSize: 17, marginTop: 6, lineHeight: 1.4, fontStyle: 'italic' }}>
            {mol.caption}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <ControlBtn onClick={() => setForm(f => (f - 1 + mol.forms.length) % mol.forms.length)}>← Prev</ControlBtn>
            <ControlBtn onClick={() => setPlaying(p => !p)}>{playing ? '❚❚ Pause' : '▶ Play'}</ControlBtn>
            <ControlBtn onClick={() => setForm(f => (f + 1) % mol.forms.length)}>Next →</ControlBtn>
          </div>
          <UISlider label="Cycle speed" value={speed} min={0.5} max={4} step={0.1}
                    onChange={setSpeed} accent="var(--phos)"
                    format={(v) => `${v.toFixed(1)} s/form`} />
        </div>
      </div>

      {/* Formal charge calculator */}
      <FormalChargeTable mol={mol} form={curForm} formIdx={form} />

      {/* Stability rules — collapsible */}
      <div style={{ background: 'var(--ink-1)', border: '1px solid var(--line)', borderRadius: 6 }}>
        <button
          onClick={() => setShowRules(s => !s)}
          className="mono"
          style={{
            width: '100%', padding: '12px 16px', fontSize: 11, letterSpacing: '0.14em',
            textTransform: 'uppercase', border: 0, background: 'transparent',
            color: 'var(--paper)', cursor: 'pointer', textAlign: 'left',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}
        >
          <span>Stability rules · ranking resonance forms</span>
          <span style={{ color: 'var(--paper-dim)' }}>{showRules ? '▾' : '▸'}</span>
        </button>
        {showRules && (
          <div style={{ padding: '0 16px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Rule
              n="1"
              title="Charges close to zero"
              body="The most stable resonance form has formal charges as close to 0 as possible. Forms with large |FC| contribute less to the hybrid."
            />
            <Rule
              n="2"
              title="Negative on more EN atom"
              body="If a negative formal charge must exist, it should sit on the more electronegative atom (e.g. O, F, N) — not on C or H."
            />
            <Rule
              n="3"
              title="Minimal charge separation"
              body="Avoid forms with adjacent like charges or large + / − separations. The sum of formal charges always equals the overall ion charge."
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ───────── sub-components ─────────

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--ink-1)', border: '1px solid var(--line)',
      borderRadius: 6, padding: 16,
      display: 'flex', flexDirection: 'column',
    }}>
      {children}
    </div>
  );
}

function ControlBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mono"
      style={{
        flex: 1, padding: '8px 10px', fontSize: 10, letterSpacing: '0.14em',
        textTransform: 'uppercase',
        border: '1px solid var(--line-strong)',
        background: 'transparent', color: 'var(--paper)', cursor: 'pointer',
      }}
    >{children}</button>
  );
}

function BondOrderPill({ value }: { value: number }) {
  return (
    <div className="mono" style={{
      padding: '3px 9px', fontSize: 10, letterSpacing: '0.14em',
      border: '1px solid var(--phos)', borderRadius: 999,
      color: 'var(--phos)', background: 'rgba(120,200,140,0.07)',
    }}>
      BO = {value.toFixed(2)}
    </div>
  );
}

function Mini({ label, v, accent }: { label: string; v: string; accent?: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div className="eyebrow" style={{ fontSize: 8 }}>{label}</div>
      <div className="serif" style={{ fontSize: 15, color: accent ?? 'var(--paper)' }}>{v}</div>
    </div>
  );
}

function BondLengthBar({ single, hybrid, double }: { single: number; hybrid: number; double: number }) {
  // map single..double range onto a horizontal track with hybrid marker
  const min = double, max = single;
  const pct = ((hybrid - min) / (max - min)) * 100;
  return (
    <div style={{ marginTop: 8, position: 'relative', height: 18 }}>
      <div style={{
        position: 'absolute', left: 0, right: 0, top: 8, height: 2,
        background: 'linear-gradient(90deg, #ff6b35 0%, var(--paper-dim) 100%)',
        borderRadius: 1,
      }} />
      <div style={{
        position: 'absolute', left: `${pct}%`, top: 2, transform: 'translateX(-50%)',
        width: 12, height: 12, borderRadius: '50%', background: 'var(--phos)',
        border: '2px solid var(--ink-1)', boxShadow: '0 0 8px rgba(120,200,140,0.6)',
      }} />
      <div className="mono" style={{ position: 'absolute', left: 0, top: 14, fontSize: 8, color: 'var(--paper-dim)' }}>double</div>
      <div className="mono" style={{ position: 'absolute', right: 0, top: 14, fontSize: 8, color: 'var(--paper-dim)' }}>single</div>
    </div>
  );
}

function BracketCharge({ charge }: { charge: number }) {
  if (charge === 0) return null;
  const sign = charge > 0 ? `${charge}+` : (charge === -1 ? '−' : `${Math.abs(charge)}−`);
  return (
    <g>
      <text x="14" y="160" fontFamily="Fraunces" fontSize="44" fill="rgba(245,241,232,0.4)">[</text>
      <text x="376" y="160" fontFamily="Fraunces" fontSize="44" fill="rgba(245,241,232,0.4)">]</text>
      <text x="380" y="100" fontFamily="JetBrains Mono" fontSize="13" fill="rgba(245,241,232,0.7)">{sign}</text>
    </g>
  );
}

// ───────── Lewis structure rendering ─────────

function getAtom(mol: Molecule, id: string) { return mol.atoms.find(a => a.id === id)!; }

function LewisStructure({
  mol, form, highlightAtoms, highlightBonds,
}: { mol: Molecule; form: Form; highlightAtoms: Set<string>; highlightBonds: Set<string> }) {
  return (
    <g>
      {/* bonds */}
      {form.bonds.map((b, i) => {
        const A = getAtom(mol, b.a), B = getAtom(mol, b.b);
        const k = bondKey(b.a, b.b);
        const glow = highlightBonds.has(k);
        return <BondLines key={i} a={A.pos} b={B.pos} order={b.order} glow={glow} />;
      })}
      {/* atoms */}
      {mol.atoms.map(a => {
        const lp = form.lonePairs[a.id] ?? 0;
        const fc = form.formalCharges[a.id] ?? 0;
        return (
          <AtomNode key={a.id} a={a} lonePairs={lp} formalCharge={fc} glow={highlightAtoms.has(a.id)} />
        );
      })}
    </g>
  );
}

function HybridStructure({ mol }: { mol: Molecule }) {
  return (
    <g>
      {Object.entries(mol.hybridBondOrders).map(([k, bo]) => {
        const [a, b] = k.split('-');
        const A = getAtom(mol, a), B = getAtom(mol, b);
        return <FractionalBond key={k} a={A.pos} b={B.pos} order={bo} />;
      })}
      {mol.atoms.map(a => (
        <AtomNode key={a.id} a={a} lonePairs={0} hideLonePairs partial={mol.partialCharges[a.id]} />
      ))}
    </g>
  );
}

function BondLines({ a, b, order, glow }: { a: Pt; b: Pt; order: 1|2|3; glow?: boolean }) {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
  const nx = -dy / len, ny = dx / len;
  // pull bonds out of atom circles
  const r = 22;
  const ux = dx / len, uy = dy / len;
  const ax = a.x + ux * r, ay = a.y + uy * r;
  const bx = b.x - ux * r, by = b.y - uy * r;

  const color = glow ? '#ffd166' : (order >= 2 ? '#ff6b35' : 'rgba(245,241,232,0.65)');
  const glowFilter = glow ? 'drop-shadow(0 0 6px rgba(255,209,102,0.9))' : undefined;
  const offsets = order === 1 ? [0] : order === 2 ? [-4, 4] : [-6, 0, 6];

  return (
    <g style={{ filter: glowFilter }}>
      {offsets.map((o, i) => (
        <line key={i}
          x1={ax + nx * o} y1={ay + ny * o}
          x2={bx + nx * o} y2={by + ny * o}
          stroke={color} strokeWidth="2.4" strokeLinecap="round" />
      ))}
    </g>
  );
}

function FractionalBond({ a, b, order }: { a: Pt; b: Pt; order: number }) {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
  const nx = -dy / len, ny = dx / len;
  const r = 22;
  const ux = dx / len, uy = dy / len;
  const ax = a.x + ux * r, ay = a.y + uy * r;
  const bx = b.x - ux * r, by = b.y - uy * r;

  // Always one solid σ line. If order > 1, add a dashed line representing
  // the delocalized π density. Dash length scales with the fractional part.
  const frac = order - 1;
  return (
    <g>
      <line x1={ax} y1={ay} x2={bx} y2={by}
        stroke="rgba(245,241,232,0.7)" strokeWidth="2.4" strokeLinecap="round" />
      {frac > 0.01 && (
        <line
          x1={ax + nx * 5} y1={ay + ny * 5}
          x2={bx + nx * 5} y2={by + ny * 5}
          stroke="#ff6b35" strokeWidth="2.4" strokeLinecap="round"
          strokeDasharray={`${Math.max(2, 6 * frac)} ${Math.max(2, 6 * (1 - frac))}`}
          opacity={0.55 + 0.45 * frac}
        />
      )}
    </g>
  );
}

function AtomNode({
  a, lonePairs, formalCharge, glow, hideLonePairs, partial,
}: {
  a: AtomSpec; lonePairs: number; formalCharge?: number; glow?: boolean;
  hideLonePairs?: boolean; partial?: string;
}) {
  const r = a.el === 'H' ? 14 : 20;
  const fontSize = a.el === 'H' ? 13 : 18;

  // lone-pair dots placed around atom
  const lpAngles: number[] = [];
  for (let i = 0; i < (lonePairs ?? 0); i++) lpAngles.push(-Math.PI / 2 + (i * Math.PI) / 2);
  return (
    <g style={{ filter: glow ? 'drop-shadow(0 0 8px rgba(255,209,102,0.9))' : undefined }}>
      {!hideLonePairs && lpAngles.map((ang, i) => {
        const cx = a.pos.x + Math.cos(ang) * (r + 12);
        const cy = a.pos.y + Math.sin(ang) * (r + 12);
        return (
          <g key={i}>
            <circle cx={cx - 3} cy={cy} r="1.6" fill="#a78bfa" />
            <circle cx={cx + 3} cy={cy} r="1.6" fill="#a78bfa" />
          </g>
        );
      })}

      <circle cx={a.pos.x} cy={a.pos.y} r={r}
        fill={a.color} stroke="rgba(0,0,0,0.5)" />
      <text x={a.pos.x} y={a.pos.y + fontSize / 3}
        textAnchor="middle" fontFamily="Fraunces" fontWeight="600"
        fontSize={fontSize} fill="#0a0908">{a.el}</text>

      {formalCharge !== undefined && formalCharge !== 0 && (
        <g>
          <circle cx={a.pos.x + r * 0.85} cy={a.pos.y - r * 0.85} r={9}
            fill="#0a0908" stroke="#fbbf24" strokeWidth="1" />
          <text x={a.pos.x + r * 0.85} y={a.pos.y - r * 0.85 + 3}
            textAnchor="middle" fontFamily="JetBrains Mono" fontSize="9"
            fill="#fbbf24">{formalCharge > 0 ? `+${formalCharge}` : formalCharge}</text>
        </g>
      )}

      {partial && partial !== '0' && (
        <text x={a.pos.x + r + 4} y={a.pos.y - r - 2}
          fontFamily="JetBrains Mono" fontSize="10" fill="#a78bfa">δ{partial}</text>
      )}
    </g>
  );
}

// ───────── formal charge table ─────────

function FormalChargeTable({ mol, form, formIdx }: { mol: Molecule; form: Form; formIdx: number }) {
  const heavy = mol.atoms.filter(a => a.el !== 'H');
  const total = heavy.reduce((s, a) => s + (form.formalCharges[a.id] ?? 0), 0);
  return (
    <div style={{ background: 'var(--ink-1)', border: '1px solid var(--line)', borderRadius: 6, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div className="eyebrow">Formal charge calculator · form {formIdx + 1}</div>
        <div className="mono" style={{ fontSize: 10, color: 'var(--paper-dim)' }}>
          FC = Z<sub>val</sub> − e<sub>nb</sub> − ½·e<sub>bond</sub>
        </div>
      </div>
      <div style={{
        marginTop: 10,
        display: 'grid',
        gridTemplateColumns: `120px repeat(5, minmax(0, 1fr))`,
        rowGap: 6, columnGap: 10,
      }}>
        <Cell head>Atom</Cell>
        <Cell head>Z (valence)</Cell>
        <Cell head>Lone-pair e⁻</Cell>
        <Cell head>Bonding e⁻</Cell>
        <Cell head>Arithmetic</Cell>
        <Cell head>FC</Cell>
        {heavy.map(a => {
          const { Z, nonBonding, bondingE, fc } = formalChargeArith(a, form);
          return (
            <FCRow key={a.id} a={a} Z={Z} nb={nonBonding} be={bondingE} fc={fc} />
          );
        })}
      </div>
      <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderTop: '1px solid var(--line)', paddingTop: 8 }}>
        <div className="mono" style={{ fontSize: 11, color: 'var(--paper-dim)' }}>
          Σ FC = {total >= 0 ? `+${total}` : total} (must equal overall charge {mol.charge >= 0 ? `+${mol.charge}` : mol.charge})
        </div>
        <div className="mono" style={{ fontSize: 11, color: total === mol.charge ? 'var(--phos)' : '#ff6b35' }}>
          {total === mol.charge ? '✓ balanced' : '✗ imbalanced'}
        </div>
      </div>
    </div>
  );
}

function FCRow({ a, Z, nb, be, fc }: { a: AtomSpec; Z: number; nb: number; be: number; fc: number }) {
  return (
    <>
      <Cell>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: 14, height: 14, borderRadius: '50%', background: a.color,
            display: 'inline-block', border: '1px solid rgba(0,0,0,0.4)',
          }} />
          <span className="serif" style={{ fontSize: 14 }}>{a.el}{subscriptId(a.id)}</span>
        </span>
      </Cell>
      <Cell mono>{Z}</Cell>
      <Cell mono>{nb}</Cell>
      <Cell mono>{be}</Cell>
      <Cell mono dim>{Z} − {nb} − {be}/2</Cell>
      <Cell mono accent={fc === 0 ? 'var(--phos)' : (fc > 0 ? '#ff6b35' : '#fbbf24')}>
        {fc > 0 ? `+${fc}` : fc}
      </Cell>
    </>
  );
}

function Cell({
  children, head, mono, dim, accent,
}: { children: React.ReactNode; head?: boolean; mono?: boolean; dim?: boolean; accent?: string }) {
  return (
    <div
      className={mono || head ? 'mono' : undefined}
      style={{
        fontSize: head ? 9 : 12,
        letterSpacing: head ? '0.14em' : undefined,
        textTransform: head ? 'uppercase' : undefined,
        color: head ? 'var(--paper-dim)' : (dim ? 'var(--paper-dim)' : (accent ?? 'var(--paper)')),
        padding: '4px 0',
        borderBottom: head ? '1px solid var(--line)' : undefined,
      }}
    >
      {children}
    </div>
  );
}

function Rule({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div style={{ padding: 12, background: 'var(--ink-2)', borderRadius: 4, borderLeft: '2px solid var(--phos)' }}>
      <div className="mono" style={{ fontSize: 10, color: 'var(--phos)', letterSpacing: '0.14em' }}>RULE {n}</div>
      <div className="serif" style={{ fontSize: 15, marginTop: 4 }}>{title}</div>
      <div style={{ fontSize: 12, color: 'var(--paper-dim)', marginTop: 6, lineHeight: 1.5 }}>{body}</div>
    </div>
  );
}

function subscriptId(id: string): string {
  // strip leading element letters, return any digit OR letter suffix (e.g. O1, Oa)
  const m = id.match(/^[A-Z][a-z]?(.+)$/);
  return m ? m[1] : '';
}
