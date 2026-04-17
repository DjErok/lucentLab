import { useEffect, useMemo, useRef, useState } from 'react';
import UISlider from '../components/ui/Slider';
import SlideTabs from '../components/ui/SlideTabs';

/**
 * Galvanic (voltaic) cell — interactive AP-Chem grade simulator.
 *
 *   Anode  (oxidation):  M(s)        → M^n+(aq) + n e⁻
 *   Cathode (reduction): X^m+(aq) + m e⁻ → X(s)
 *
 * E_cell  = E°_cell − (RT / nF) · ln(Q)
 *         = E°_cell − (0.0592 / n) · log10(Q)   at 298.15 K
 *
 * Q = [anode-ion]^a / [cathode-ion]^c   (activity of pure metals = 1)
 * with a, c balanced so the two half-reactions exchange n electrons.
 */

type Cell = {
  id: string;
  label: string;
  anodeMetal: string;
  cathodeMetal: string;
  anodeIon: string;          // e.g. "Zn²⁺"
  cathodeIon: string;        // e.g. "Cu²⁺"
  zAnode: number;            // ion charge magnitude on anode side
  zCathode: number;          // ion charge magnitude on cathode side
  EoxAnode: number;          // standard oxidation potential of anode metal (V)
  EredCathode: number;       // standard reduction potential of cathode metal (V)
  anodeColor: string;
  cathodeColor: string;
};

// E°_cell = E°_red(cathode) − E°_red(anode)
//        = E°_red(cathode) + E°_ox(anode)
const CELLS: Cell[] = [
  {
    id: 'zn-cu',  label: 'Zn | Cu²⁺',
    anodeMetal: 'Zn', cathodeMetal: 'Cu',
    anodeIon: 'Zn²⁺', cathodeIon: 'Cu²⁺',
    zAnode: 2, zCathode: 2,
    EoxAnode: +0.76, EredCathode: +0.34,
    anodeColor: '#a78bfa', cathodeColor: '#5dd0ff',
  },
  {
    id: 'mg-cu',  label: 'Mg | Cu²⁺',
    anodeMetal: 'Mg', cathodeMetal: 'Cu',
    anodeIon: 'Mg²⁺', cathodeIon: 'Cu²⁺',
    zAnode: 2, zCathode: 2,
    EoxAnode: +2.37, EredCathode: +0.34,
    anodeColor: '#9af1c0', cathodeColor: '#5dd0ff',
  },
  {
    id: 'zn-ag',  label: 'Zn | Ag⁺',
    anodeMetal: 'Zn', cathodeMetal: 'Ag',
    anodeIon: 'Zn²⁺', cathodeIon: 'Ag⁺',
    zAnode: 2, zCathode: 1,
    EoxAnode: +0.76, EredCathode: +0.80,
    anodeColor: '#a78bfa', cathodeColor: '#e8e6dc',
  },
  {
    id: 'cu-ag',  label: 'Cu | Ag⁺',
    anodeMetal: 'Cu', cathodeMetal: 'Ag',
    anodeIon: 'Cu²⁺', cathodeIon: 'Ag⁺',
    zAnode: 2, zCathode: 1,
    EoxAnode: -0.34, EredCathode: +0.80,
    anodeColor: '#ffb380', cathodeColor: '#e8e6dc',
  },
];

const F = 96485;       // C/mol
const R = 8.314;       // J/(mol·K)

export default function Galvanic() {
  const [cellId, setCellId] = useState(CELLS[0].id);
  const cell = CELLS.find(c => c.id === cellId)!;

  const [cAnode, setCAnode] = useState(1);     // M
  const [cCathode, setCCathode] = useState(1); // M
  const [T, setT] = useState(298.15);          // K
  const [speed, setSpeed] = useState(1);
  const [running, setRunning] = useState(true);

  // Reset concentrations when cell changes
  useEffect(() => { setCAnode(1); setCCathode(1); }, [cellId]);

  // Electron transfer count balanced for the *full* cell reaction.
  // a · (M → M^zA + zA e⁻)  +  c · (X^zC + zC e⁻ → X)   with a·zA = c·zC
  const n = lcm(cell.zAnode, cell.zCathode);
  const aCoef = n / cell.zAnode;        // moles of anode metal per n e⁻
  const cCoef = n / cell.zCathode;      // moles of cathode ion per n e⁻

  // Q  = [M^zA]^aCoef / [X^zC]^cCoef
  const Q = Math.pow(cAnode, aCoef) / Math.pow(cCathode, cCoef);
  const Estd = cell.EoxAnode + cell.EredCathode;
  // Nernst at temperature T using natural-log form
  const Ecell = Estd - (R * T) / (n * F) * Math.log(Q);
  // Shortcut form at 298.15 K
  const E298 = Estd - (0.0592 / n) * Math.log10(Q);

  const spontaneous = Ecell > 0;

  // Animation timeline ---------------------------------------------------
  const tRef = useRef(0);
  const [, force] = useState(0);
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const onVis = () => { last = performance.now(); };
    document.addEventListener('visibilitychange', onVis);
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (running && !document.hidden) {
        // animation rate scales with |E_cell| (clamped) and user speed
        const rate = clamp(Math.abs(Ecell), 0.05, 3.0);
        tRef.current += dt * speed * rate;
        force(v => (v + 1) % 1_000_000);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [running, speed, Ecell]);

  const k = (tRef.current / 4) % 1;     // 0..1 cycle every 4 anim-seconds

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* ───── Cell selector tabs ───── */}
      <SlideTabs<string>
        tabs={CELLS.map(c => ({ id: c.id, label: c.label }))}
        value={cellId}
        onChange={setCellId}
      />

      {/* ───── Header line ───── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
        <div className="serif" style={{ fontSize: 22, fontStyle: 'italic' }}>
          {cell.anodeMetal}(s) | {cell.anodeIon}(aq) ‖ {cell.cathodeIon}(aq) | {cell.cathodeMetal}(s)
        </div>
        <Pill spontaneous={spontaneous} />
      </div>

      {/* ───── Main grid: cell SVG + side panel ───── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16 }}>
        {/* Cell scene */}
        <div style={{
          position: 'relative',
          background: 'var(--ink-1)',
          border: '1px solid var(--line)',
          borderRadius: 6,
          aspectRatio: '1.55 / 1',
          overflow: 'hidden',
        }}>
          <CellScene cell={cell} k={k} Ecell={Ecell} cAnode={cAnode} cCathode={cCathode} spontaneous={spontaneous} />
        </div>

        {/* Side panel: equation + readouts */}
        <div style={{
          background: 'var(--ink-1)', border: '1px solid var(--line)',
          borderRadius: 6, padding: 20,
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div className="eyebrow">Half-reactions</div>

          <Half
            label="Anode · OXIDATION"
            color={cell.anodeColor}
            eq={`${aCoef === 1 ? '' : aCoef + ' '}${cell.anodeMetal}(s) → ${aCoef === 1 ? '' : aCoef + ' '}${cell.anodeIon} + ${n} e⁻`}
            Eo={`E°red(${cell.anodeMetal}${'\u207F\u207A'}/${cell.anodeMetal}) = ${signed(-cell.EoxAnode)} V`}
          />
          <Half
            label="Cathode · REDUCTION"
            color={cell.cathodeColor}
            eq={`${cCoef === 1 ? '' : cCoef + ' '}${cell.cathodeIon} + ${n} e⁻ → ${cCoef === 1 ? '' : cCoef + ' '}${cell.cathodeMetal}(s)`}
            Eo={`E°red(${cell.cathodeMetal}${'\u207F\u207A'}/${cell.cathodeMetal}) = ${signed(cell.EredCathode)} V`}
          />

          <div style={{
            background: 'var(--ink-2)', border: '1px solid var(--line)',
            borderRadius: 4, padding: 10,
            fontSize: 11, fontFamily: 'JetBrains Mono, monospace',
            color: 'var(--paper-dim)', lineHeight: 1.6,
          }}>
            <div style={{ color: 'var(--phos)', letterSpacing: '0.12em', textTransform: 'uppercase', fontSize: 10 }}>AP form</div>
            <div style={{ marginTop: 4, color: 'var(--paper)' }}>
              E°cell = E°<sub>cathode</sub> − E°<sub>anode</sub>
              {' = ('}{signed(cell.EredCathode)}{') − ('}{signed(-cell.EoxAnode)}{') = '}<b style={{ color: 'var(--phos)' }}>{signed(cell.EredCathode + cell.EoxAnode)} V</b>
            </div>
          </div>

          <div style={{
            borderTop: '1px solid var(--line)', paddingTop: 10,
            fontSize: 12, color: 'var(--paper-dim)', lineHeight: 1.55,
          }}>
            <span className="eyebrow" style={{ color: 'var(--phos)' }}>Net</span>
            <div className="mono" style={{ marginTop: 4, color: 'var(--paper)' }}>
              {aCoef === 1 ? '' : aCoef + ' '}{cell.anodeMetal} + {cCoef === 1 ? '' : cCoef + ' '}{cell.cathodeIon} → {aCoef === 1 ? '' : aCoef + ' '}{cell.anodeIon} + {cCoef === 1 ? '' : cCoef + ' '}{cell.cathodeMetal}
            </div>
          </div>

          <div style={{ marginTop: 'auto', borderTop: '1px solid var(--line)', paddingTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Stat label="E°cell (standard)" value={`${signed(Estd)} V`} accent="var(--paper)" />
            <Stat label="E_cell (Nernst)" value={`${signed(Ecell)} V`} accent={spontaneous ? 'var(--phos)' : 'var(--hot)'} />
          </div>
        </div>
      </div>

      {/* ───── Controls row ───── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Concentrations + temperature */}
        <div style={{
          background: 'var(--ink-1)', border: '1px solid var(--line)',
          borderRadius: 6, padding: 20, display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div className="eyebrow">Conditions</div>
          <LogSlider
            label={`[${cell.anodeIon}]  (anode side)`}
            value={cAnode}
            onChange={setCAnode}
            accent={cell.anodeColor}
            unit="M"
          />
          <LogSlider
            label={`[${cell.cathodeIon}]  (cathode side)`}
            value={cCathode}
            onChange={setCCathode}
            accent={cell.cathodeColor}
            unit="M"
          />
          <Slider
            label="Temperature"
            value={T} min={273} max={373} step={1}
            onChange={setT} accent="var(--hot)"
            display={`${T.toFixed(0)} K  (${(T - 273.15).toFixed(0)} °C)`}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <ControlBtn onClick={() => { setCAnode(1); setCCathode(1); setT(298.15); }}>↻ Standard (1 M, 25°C)</ControlBtn>
          </div>
        </div>

        {/* Nernst + animation controls */}
        <div style={{
          background: 'var(--ink-1)', border: '1px solid var(--line)',
          borderRadius: 6, padding: 20, display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div className="eyebrow">Nernst equation</div>
          <div className="serif" style={{ fontSize: 18, fontStyle: 'italic', lineHeight: 1.4 }}>
            E = E° − (RT / nF) · ln Q
          </div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--paper-dim)', lineHeight: 1.7 }}>
            n = {n} mol e⁻ &nbsp;·&nbsp; T = {T.toFixed(1)} K<br />
            Q = [{cell.anodeIon}]<sup>{aCoef}</sup> / [{cell.cathodeIon}]<sup>{cCoef}</sup> = {fmtSci(Q)}<br />
            log Q = {Math.log10(Q).toFixed(3)}<br />
            (RT/nF) ln Q = {((R * T) / (n * F) * Math.log(Q)).toFixed(4)} V<br />
            <span style={{ opacity: 0.7 }}>at 298 K shortcut: (0.0592/n) log Q = {((0.0592 / n) * Math.log10(Q)).toFixed(4)} V</span>
          </div>

          <div style={{
            padding: 10, borderRadius: 4,
            background: 'var(--ink-2)',
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
          }}>
            <Stat label="E (Nernst, T)" value={`${signed(Ecell)} V`} accent={spontaneous ? 'var(--phos)' : 'var(--hot)'} />
            <Stat label="E (298 K shortcut)" value={`${signed(E298)} V`} accent="var(--cool)" />
          </div>

          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
            <Slider
              label="Animation speed"
              value={speed} min={0.25} max={4} step={0.05}
              onChange={setSpeed} accent="var(--phos)"
              display={`${speed.toFixed(2)}×`}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <ControlBtn onClick={() => setRunning(r => !r)}>{running ? '❚❚ Pause' : '▶ Play'}</ControlBtn>
              <ControlBtn onClick={() => { tRef.current = 0; force(v => v + 1); }}>■ Reset frame</ControlBtn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Cell scene (SVG)
   ────────────────────────────────────────────────────────────────── */

function CellScene({
  cell, k, Ecell, cAnode, cCathode, spontaneous,
}: {
  cell: Cell; k: number; Ecell: number; cAnode: number; cCathode: number; spontaneous: boolean;
}) {
  // Geometry
  const W = 600, H = 400;
  const wireY = 60;
  const anodeBeakerX = 70, beakerW = 140, beakerH = 250, beakerTop = 100;
  const cathodeBeakerX = 390;
  const anodeBarX = 130, cathodeBarX = 450;
  const barW = 22;

  // Direction of flow: by convention spontaneous direction goes anode→cathode along the wire.
  // If E_cell < 0 (driven backwards by user), reverse e⁻ visual direction.
  const dir = spontaneous ? 1 : -1;
  const k2 = ((dir > 0 ? k : (1 - k)) + 1) % 1;

  // Wire path (left bar top → up → across → down → right bar top)
  // We parameterize a piecewise path with total length used for electron position.
  const segments = useMemo(() => buildWirePath(anodeBarX, cathodeBarX, beakerTop, wireY, barW), [anodeBarX, cathodeBarX, beakerTop, wireY, barW]);

  // Salt bridge geometry (U-tube)
  const sbY = 130;
  const sbLeftX = 210, sbRightX = 390;
  const sbInnerY = 175;

  // Concentrations → solution opacity (visual cue)
  const opAnode = clamp(0.18 + 0.55 * (Math.log10(cAnode) + 3) / 4, 0.1, 0.85);
  const opCathode = clamp(0.18 + 0.55 * (Math.log10(cCathode) + 3) / 4, 0.1, 0.85);

  // Number of "in-flight" electrons in wire — proportional to current
  const nE = Math.max(3, Math.min(10, Math.round(3 + Math.abs(Ecell) * 4)));

  return (
    <>
      <div className="eyebrow" style={{ position: 'absolute', top: 14, left: 16, zIndex: 2 }}>
        Voltaic cell · {cell.anodeMetal} / {cell.cathodeIon}
      </div>
      <div className="mono" style={{ position: 'absolute', top: 14, right: 16, fontSize: 10, color: 'var(--paper-dim)', zIndex: 2 }}>
        T-bridge ions · K⁺ → cathode · NO₃⁻ → anode
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
        <defs>
          <linearGradient id="g-an" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={cell.anodeColor} stopOpacity="0" />
            <stop offset="100%" stopColor={cell.anodeColor} stopOpacity={opAnode} />
          </linearGradient>
          <linearGradient id="g-ca" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={cell.cathodeColor} stopOpacity="0" />
            <stop offset="100%" stopColor={cell.cathodeColor} stopOpacity={opCathode} />
          </linearGradient>
        </defs>

        {/* Wire */}
        <path d={segments.d} stroke="rgba(245,241,232,0.7)" strokeWidth="2.5" fill="none" />

        {/* Voltmeter */}
        <g>
          <circle cx={W / 2} cy={wireY} r="34" fill="var(--ink-2)" stroke="var(--line-strong)" />
          <text x={W / 2} y={wireY - 4} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="12"
                fill={spontaneous ? '#69e36b' : '#ff7a59'}>
            {signed(Ecell)} V
          </text>
          <text x={W / 2} y={wireY + 12} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="9"
                fill="rgba(245,241,232,0.55)" letterSpacing="0.14em">VOLTMETER</text>
        </g>

        {/* Beakers */}
        <Beaker x={anodeBeakerX} y={beakerTop} w={beakerW} h={beakerH} fillUrl="url(#g-an)" />
        <Beaker x={cathodeBeakerX} y={beakerTop} w={beakerW} h={beakerH} fillUrl="url(#g-ca)" />

        {/* Electrodes */}
        <rect x={anodeBarX - barW / 2} y={beakerTop - 20} width={barW} height={beakerH - 40} fill={cell.anodeColor} />
        <rect x={cathodeBarX - barW / 2} y={beakerTop - 20} width={barW} height={beakerH - 40} fill={cell.cathodeColor} />

        {/* Polarity labels */}
        <text x={anodeBarX} y={beakerTop - 28} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="14" fontWeight="600" fill={cell.anodeColor}>−</text>
        <text x={cathodeBarX} y={beakerTop - 28} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="14" fontWeight="600" fill={cell.cathodeColor}>+</text>

        {/* Bar labels */}
        <text x={anodeBarX} y={H - 18} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="11" fill={cell.anodeColor}>
          {cell.anodeMetal} (anode)
        </text>
        <text x={cathodeBarX} y={H - 18} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="11" fill={cell.cathodeColor}>
          {cell.cathodeMetal} (cathode)
        </text>

        {/* Salt bridge (U-tube) */}
        <SaltBridge leftX={sbLeftX} rightX={sbRightX} topY={sbY} innerY={sbInnerY} bottomY={beakerTop + 80} />
        <text x={(sbLeftX + sbRightX) / 2} y={sbY - 6} textAnchor="middle" fontFamily="JetBrains Mono"
              fontSize="10" fill="rgba(245,241,232,0.6)">salt bridge · KNO₃</text>

        {/* Salt-bridge ions: K⁺ flows toward cathode (right), NO₃⁻ toward anode (left) */}
        {[0, 0.33, 0.66].map((o) => {
          const kk = (k + o) % 1;
          const xK = sbLeftX + 30 + kk * (sbRightX - sbLeftX - 60);
          const xN = sbRightX - 30 - kk * (sbRightX - sbLeftX - 60);
          return (
            <g key={o}>
              <text x={xK} y={sbY + 22} fontFamily="JetBrains Mono" fontSize="11" fill="#fbbf24" textAnchor="middle">K⁺</text>
              <text x={xN} y={sbY + 38} fontFamily="JetBrains Mono" fontSize="10" fill="#9af1c0" textAnchor="middle">NO₃⁻</text>
            </g>
          );
        })}

        {/* Electrons in wire */}
        {Array.from({ length: nE }, (_, i) => {
          const off = i / nE;
          const kk = (k2 + off) % 1;
          const p = pointOnPath(segments, kk);
          return (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="5" fill="#69e36b"
                      style={{ filter: 'drop-shadow(0 0 4px rgba(105,227,107,0.7))' }} />
              <text x={p.x} y={p.y + 2} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="7" fontWeight="700" fill="#0a0908">e⁻</text>
            </g>
          );
        })}

        {/* Anode dissolution: a metal atom on the bar surface lifts off as M^z+ */}
        {(() => {
          const phase = k; // 0..1
          // Atom sits on bar 0..0.5 then floats off into solution 0.5..1
          if (phase < 0.5) {
            return (
              <g>
                <circle cx={anodeBarX + barW / 2 + 3} cy={beakerTop + 60} r="11" fill={lighten(cell.anodeColor)} stroke="rgba(0,0,0,0.4)" />
                <text x={anodeBarX + barW / 2 + 3} y={beakerTop + 64} textAnchor="middle" fontFamily="Fraunces" fontSize="10" fontWeight="600" fill="#0a0908">{cell.anodeMetal}</text>
              </g>
            );
          } else {
            const t = (phase - 0.5) / 0.5;
            const x = anodeBarX + barW / 2 + 3 + t * 50;
            const y = beakerTop + 60 + t * 100;
            return (
              <g>
                <circle cx={x} cy={y} r="11" fill={cell.anodeColor} stroke="rgba(0,0,0,0.4)" opacity={1 - t * 0.4} />
                <text x={x} y={y + 3} textAnchor="middle" fontFamily="Fraunces" fontSize="9" fontWeight="600" fill="#0a0908">{cell.anodeIon}</text>
              </g>
            );
          }
        })()}

        {/* Cathode deposition: a cation drifts to the bar then turns into solid M */}
        {(() => {
          const phase = k;
          if (phase < 0.6) {
            const t = phase / 0.6;
            const x = cathodeBarX + 80 - t * 65;
            const y = beakerTop + 160 - t * 100;
            return (
              <g>
                <circle cx={x} cy={y} r="11" fill={cell.cathodeColor} stroke="rgba(0,0,0,0.4)" />
                <text x={x} y={y + 3} textAnchor="middle" fontFamily="Fraunces" fontSize="9" fontWeight="600" fill="#0a0908">{cell.cathodeIon}</text>
              </g>
            );
          } else {
            return (
              <g>
                <circle cx={cathodeBarX - barW / 2 - 3} cy={beakerTop + 60} r="11" fill={lighten(cell.cathodeColor)} stroke="rgba(0,0,0,0.4)" />
                <text x={cathodeBarX - barW / 2 - 3} y={beakerTop + 64} textAnchor="middle" fontFamily="Fraunces" fontSize="10" fontWeight="600" fill="#0a0908">{cell.cathodeMetal}</text>
                <text x={cathodeBarX - barW / 2 - 3} y={beakerTop + 86} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="7" fill={cell.cathodeColor} letterSpacing="0.14em">PLATED</text>
              </g>
            );
          }
        })()}

        {/* Floating ions in each beaker (concentration cue) */}
        {floatingIons(cell.anodeIon, cell.anodeColor, anodeBeakerX + 12, anodeBeakerX + beakerW - 12, beakerTop + 110, beakerTop + beakerH - 20, cAnode, k)}
        {floatingIons(cell.cathodeIon, cell.cathodeColor, cathodeBeakerX + 12, cathodeBeakerX + beakerW - 12, beakerTop + 110, beakerTop + beakerH - 20, cCathode, k + 0.5)}
      </svg>
    </>
  );
}

function Beaker({ x, y, w, h, fillUrl }: { x: number; y: number; w: number; h: number; fillUrl: string }) {
  // Slightly tapered beaker
  const taper = 6;
  const d = `M ${x} ${y} L ${x + w} ${y} L ${x + w - taper} ${y + h} L ${x + taper} ${y + h} Z`;
  // Solution starts ~30 below the rim
  const sy = y + 30;
  const ds = `M ${x + (sy - y) * (taper / h)} ${sy} L ${x + w - (sy - y) * (taper / h)} ${sy} L ${x + w - taper} ${y + h} L ${x + taper} ${y + h} Z`;
  return (
    <g>
      <path d={d} fill="var(--ink-2)" stroke="var(--line-strong)" />
      <path d={ds} fill={fillUrl} />
    </g>
  );
}

function SaltBridge({ leftX, rightX, topY, innerY, bottomY }: { leftX: number; rightX: number; topY: number; innerY: number; bottomY: number }) {
  // U-tube: tube of width ~24, descends into both beakers.
  const w = 18;
  const d = `
    M ${leftX - w / 2} ${bottomY}
    L ${leftX - w / 2} ${topY}
    Q ${leftX - w / 2} ${topY - 12}, ${leftX + w / 2} ${topY - 12}
    L ${rightX - w / 2} ${topY - 12}
    Q ${rightX + w / 2} ${topY - 12}, ${rightX + w / 2} ${topY}
    L ${rightX + w / 2} ${bottomY}
    L ${rightX - w / 2} ${bottomY}
    L ${rightX - w / 2} ${innerY}
    L ${leftX + w / 2} ${innerY}
    L ${leftX + w / 2} ${bottomY}
    Z
  `;
  return <path d={d} fill="rgba(245,241,232,0.10)" stroke="var(--line-strong)" strokeWidth="1" />;
}

function floatingIons(label: string, color: string, x0: number, x1: number, y0: number, y1: number, conc: number, phase: number) {
  // Number scales with log10(conc). Range 0.001..10 → log spans -3..1 → map to 1..10 ions
  const n = clamp(Math.round(((Math.log10(conc) + 3) / 4) * 9 + 1), 1, 10);
  const out: React.ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const seed = (i * 97) % 1000 / 1000;
    const xx = x0 + ((seed + phase * 0.15) % 1) * (x1 - x0);
    const yy = y0 + (((seed * 1.7) + phase * 0.07) % 1) * (y1 - y0);
    out.push(
      <text key={i} x={xx} y={yy} fontFamily="JetBrains Mono" fontSize="9" fill={color} opacity="0.85" textAnchor="middle">{label}</text>
    );
  }
  return <g>{out}</g>;
}

/* ──────────────────────────────────────────────────────────────────
   Wire path utilities
   ────────────────────────────────────────────────────────────────── */

type Seg = { x1: number; y1: number; x2: number; y2: number; len: number };
type Path = { segs: Seg[]; total: number; d: string };

function buildWirePath(anodeBarX: number, cathodeBarX: number, beakerTop: number, wireY: number, _barW: number): Path {
  // Anode bar top is at y = beakerTop - 20; wire goes up to wireY, across to other side, down to cathode bar.
  const yTop = beakerTop - 20;
  const pts = [
    { x: anodeBarX, y: yTop },
    { x: anodeBarX, y: wireY },
    { x: cathodeBarX, y: wireY },
    { x: cathodeBarX, y: yTop },
  ];
  const segs: Seg[] = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    segs.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, len });
    total += len;
  }
  const d = `M ${pts[0].x} ${pts[0].y} ` + pts.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
  return { segs, total, d };
}

function pointOnPath(p: Path, t: number): { x: number; y: number } {
  // Direction: anode → cathode means t=0 at anode top, t=1 at cathode top
  const want = t * p.total;
  let acc = 0;
  for (const s of p.segs) {
    if (acc + s.len >= want) {
      const u = (want - acc) / s.len;
      return { x: s.x1 + (s.x2 - s.x1) * u, y: s.y1 + (s.y2 - s.y1) * u };
    }
    acc += s.len;
  }
  const last = p.segs[p.segs.length - 1];
  return { x: last.x2, y: last.y2 };
}

/* ──────────────────────────────────────────────────────────────────
   UI atoms
   ────────────────────────────────────────────────────────────────── */

function Pill({ spontaneous }: { spontaneous: boolean }) {
  const color = spontaneous ? 'var(--phos)' : 'var(--hot)';
  const text = spontaneous ? 'GALVANIC · spontaneous · ΔG < 0' : 'DRIVEN · non-spontaneous · ΔG > 0';
  return (
    <span className="mono" style={{
      fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
      padding: '6px 12px', border: `1px solid ${color}`, color, borderRadius: 999,
    }}>{text}</span>
  );
}

function Half({ label, color, eq, Eo }: { label: string; color: string; eq: string; Eo: string }) {
  return (
    <div style={{ borderLeft: `2px solid ${color}`, paddingLeft: 12 }}>
      <div className="eyebrow" style={{ color }}>{label}</div>
      <div className="mono" style={{ fontSize: 12, marginTop: 4 }}>{eq}</div>
      <div className="mono" style={{ fontSize: 10, color: 'var(--paper-dim)' }}>{Eo}</div>
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

function Slider({ label, value, min, max, step, onChange, accent, display }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; accent: string; display?: string;
}) {
  return (
    <UISlider label={label} value={value} min={min} max={max} step={step}
              onChange={onChange} accent={accent}
              format={display !== undefined ? () => display : (v) => String(v)} />
  );
}

function LogSlider({ label, value, onChange, accent, unit }: {
  label: string; value: number; onChange: (v: number) => void; accent: string; unit: string;
}) {
  // Map log10([0.001..10]) = [-3..1] to slider integer 0..400
  const sliderVal = Math.round(((Math.log10(value) + 3) / 4) * 400);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span className="eyebrow">{label}</span>
        <span className="mono" style={{ fontSize: 11, color: accent }}>{fmtConc(value)} {unit}</span>
      </div>
      <input type="range" min={0} max={400} step={1} value={sliderVal}
             onChange={(e) => {
               const f = Number(e.target.value) / 400;
               const c = Math.pow(10, -3 + f * 4);
               onChange(c);
             }}
             style={{ width: '100%', accentColor: accent }} />
      <div className="mono" style={{ fontSize: 9, color: 'var(--paper-dim)', display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
        <span>0.001</span><span>0.1</span><span>1</span><span>10</span>
      </div>
    </div>
  );
}

function ControlBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="mono"
      style={{
        flex: 1, padding: '8px 10px', fontSize: 10, letterSpacing: '0.14em',
        textTransform: 'uppercase', border: '1px solid var(--line-strong)',
        background: 'transparent', color: 'var(--paper)', cursor: 'pointer',
      }}>{children}</button>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Math + format helpers
   ────────────────────────────────────────────────────────────────── */

function gcd(a: number, b: number): number { return b === 0 ? a : gcd(b, a % b); }
function lcm(a: number, b: number): number { return (a * b) / gcd(a, b); }
function clamp(x: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, x)); }
function signed(v: number) { return (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(3); }
function fmtConc(v: number) {
  if (v >= 1) return v.toFixed(2);
  if (v >= 0.01) return v.toFixed(3);
  return v.toExponential(1);
}
function fmtSci(v: number) {
  if (!isFinite(v)) return '∞';
  if (v === 0) return '0';
  const abs = Math.abs(v);
  if (abs >= 0.01 && abs < 1000) return v.toFixed(3);
  return v.toExponential(2);
}
function lighten(hex: string) {
  // crude: blend with white 35%
  const m = hex.match(/^#([0-9a-f]{6})$/i);
  if (!m) return hex;
  const r = parseInt(m[1].slice(0, 2), 16);
  const g = parseInt(m[1].slice(2, 4), 16);
  const b = parseInt(m[1].slice(4, 6), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * 0.35);
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}
