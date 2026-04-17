import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Beer–Lambert spectrophotometer.  A(λ) = ε(λ)·b·c, T = I/I₀ = 10^(-A).
 * ε(λ) is a Gaussian band on λmax (σ ≈ 25 nm). Transmitted color is built by
 * sampling the visible spectrum and weighting by 10^(-A(λ)). Stacked cuvettes
 * add path length. Linearity holds up to A ≈ 1; gentle bend above that.
 */

type Solution = {
  id: string;
  formula: React.ReactNode;
  name: string;
  lambdaMax: number;     // nm
  epsMax: number;        // M⁻¹ cm⁻¹
  hue: number;           // perceived hue (used as fallback tint)
  application: string;
  short?: string; // optional short tab label to avoid collisions
};

const SOLUTIONS: Solution[] = [
  { id: 'kmno4', formula: <>KMnO<sub>4</sub></>, name: 'Potassium permanganate', short: 'KMnO₄',
    lambdaMax: 525, epsMax: 2350, hue: 285,
    application: 'Iron(II) titrations and chemical-oxygen-demand assays — the deep purple band lets you see the endpoint by eye.' },
  { id: 'k2cr2o7', formula: <>K<sub>2</sub>Cr<sub>2</sub>O<sub>7</sub></>, name: 'Potassium dichromate', short: 'K₂Cr₂O₇',
    lambdaMax: 440, epsMax: 110, hue: 40,
    application: 'NIST-traceable absorbance standard for verifying spectrophotometer linearity from 235–350 nm.' },
  { id: 'cuso4', formula: <>CuSO<sub>4</sub>·5H<sub>2</sub>O</>, name: 'Copper(II) sulfate pentahydrate', short: 'CuSO₄',
    lambdaMax: 720, epsMax: 12, hue: 200,
    application: 'Biuret protein assay — Cu²⁺ chelated by peptide bonds gives a violet band proportional to [protein].' },
  { id: 'fescn', formula: <>[Fe(SCN)]<sup>2+</sup></>, name: 'Iron(III) thiocyanate', short: 'FeSCN²⁺',
    lambdaMax: 447, epsMax: 4700, hue: 5,
    application: 'Equilibrium-constant lab (Fe³⁺ + SCN⁻ ⇌ FeSCN²⁺) and ppm Fe in iron-fortified cereal extracts.' },
];

const SIGMA = 25;          // nm — band half-width parameter
const VIS_LO = 380;
const VIS_HI = 780;

// Source flux in photons / second (rough monochromator throughput at 1 nm bandpass)
const PHOTON_FLUX = 6.0e14;

export default function BeerLambert() {
  const [solId, setSolId] = useState(SOLUTIONS[0].id);
  const sol = SOLUTIONS.find(s => s.id === solId)!;

  const [c, setC] = useState(0.0010);     // mol / L  (typical UV-vis range)
  const [b, setB] = useState(1.0);        // cm
  const [lambda, setLambda] = useState(525); // nm
  const [stack, setStack] = useState(1);  // 1..5 stacked cuvettes
  const [compareOn, setCompareOn] = useState(false);
  const [compareId, setCompareId] = useState(SOLUTIONS[1].id);
  const compareSol = SOLUTIONS.find(s => s.id === compareId)!;

  // When solution changes, snap λ to its λmax for instant feedback.
  useEffect(() => { setLambda(sol.lambdaMax); }, [solId]);

  // Gentle "shimmer" on the transmitted beam — noticeable, not distracting.
  const [phase, setPhase] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    let mounted = true;
    const tick = () => {
      if (!mounted) return;
      if (!document.hidden) setPhase(p => (p + 0.04) % (Math.PI * 2));
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { mounted = false; cancelAnimationFrame(raf.current); };
  }, []);

  const bEff = b * stack;

  // ε(λ) model — Gaussian band on top of a tiny baseline so off-peak ≠ 0.
  const epsAt = (s: Solution, l: number) => {
    const x = (l - s.lambdaMax) / SIGMA;
    return s.epsMax * Math.exp(-0.5 * x * x) + 0.5;
  };

  const eps    = epsAt(sol, lambda);
  const A_lin  = eps * bEff * c;
  const A      = beerWithDeviation(A_lin);   // gentle bend above A≈1
  const T      = Math.pow(10, -A);
  const photonsAbsorbed = PHOTON_FLUX * (1 - T);

  // Calibration table — 5 points at chosen b, λ.
  const calPoints = useMemo(() => {
    const pts: { c: number; A: number }[] = [];
    for (let i = 0; i < 5; i++) {
      const ci = (i + 1) * 0.0005;          // 0.5, 1.0, 1.5, 2.0, 2.5 mM
      pts.push({ c: ci, A: beerWithDeviation(epsAt(sol, lambda) * bEff * ci) });
    }
    return pts;
  }, [sol, lambda, bEff]);

  // Linear regression on the points the model treats as linear (A ≤ 1).
  const linearPts = calPoints.filter(p => p.A <= 1);
  const slope = linearPts.length >= 2
    ? linearPts.reduce((s, p) => s + p.A * p.c, 0) / linearPts.reduce((s, p) => s + p.c * p.c, 0)
    : eps * bEff;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Solution tabs */}
      <div role="tablist" aria-label="Solution" style={{ display: 'flex', flexWrap: 'wrap' }}>
        {SOLUTIONS.map((s, i) => {
          const active = s.id === solId;
          return (
            <button key={s.id} role="tab" aria-selected={active} onClick={() => setSolId(s.id)} className="mono"
              style={{ padding: '10px 16px', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase',
                border: '1px solid var(--line-strong)', borderLeft: i === 0 ? '1px solid var(--line-strong)' : 0,
                background: active ? 'var(--paper)' : 'transparent',
                color: active ? 'var(--ink-0)' : 'var(--paper-dim)',
                fontWeight: active ? 600 : 400, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%',
                background: wlToHex(complementOf(s.lambdaMax)),
                boxShadow: `0 0 6px ${wlToHex(complementOf(s.lambdaMax))}` }} />
              {(s.short ?? s.name.split(' ')[0])} · {wavelengthName(complementOf(s.lambdaMax))}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
        <div className="serif" style={{ fontSize: 24, fontStyle: 'italic' }}>
          A(λ) = ε(λ)·b·c &nbsp;·&nbsp; {sol.formula}
        </div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--paper-dim)' }}>
          λmax {sol.lambdaMax} nm · ε_max {sol.epsMax.toLocaleString()} M⁻¹cm⁻¹
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: 16 }}>
        {/* Left column: spectrum strip + cuvette */}
        <div style={{
          background: 'var(--ink-1)', border: '1px solid var(--line)',
          borderRadius: 6, padding: 18, display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          <SpectrumStrip
            sol={sol}
            compareSol={compareOn ? compareSol : null}
            lambda={lambda}
            sigma={SIGMA}
            epsAt={epsAt}
            onPick={setLambda}
          />

          <CuvetteScene
            sol={sol}
            lambda={lambda}
            b={b}
            stack={stack}
            T={T}
            phase={phase}
            epsAt={epsAt}
            c={c}
          />

          <div className="mono" style={{ fontSize: 10, color: 'var(--paper-faint)', textAlign: 'center' }}>
            CLICK SPECTRUM TO RETUNE λ · STACKED CUVETTES SHOW PATH-LENGTH ADDITIVITY
          </div>
        </div>

        {/* Right column: controls + readouts */}
        <div style={{
          background: 'var(--ink-1)', border: '1px solid var(--line)',
          borderRadius: 6, padding: 20, display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div className="eyebrow">Sample &amp; geometry</div>
          <Slider label="Concentration · c" value={c} min={0} max={0.005} step={0.00005}
                  unit="M" decimals={4} accent="var(--base)" onChange={setC} />
          <Slider label="Path length · b" value={b} min={0.2} max={4} step={0.05}
                  unit="cm" decimals={2} accent="var(--phos)" onChange={setB} />
          <Slider label="Wavelength · λ" value={lambda} min={VIS_LO} max={VIS_HI} step={1}
                  unit="nm" decimals={0} accent={wlToHex(lambda)} onChange={setLambda} />

          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Stacked cuvettes (b_eff = n · b)</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => setStack(n)} className="mono"
                  style={{ flex: 1, padding: '6px 0', fontSize: 11, border: '1px solid var(--line-strong)',
                    background: stack === n ? 'var(--paper)' : 'transparent',
                    color: stack === n ? 'var(--ink-0)' : 'var(--paper-dim)', cursor: 'pointer' }}>×{n}</button>
              ))}
            </div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--paper-faint)', marginTop: 4 }}>
              b_eff = {bEff.toFixed(2)} cm
            </div>
          </div>

          {/* Comparison toggle */}
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
            <label className="eyebrow" style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
              <input type="checkbox" checked={compareOn} onChange={e => setCompareOn(e.target.checked)} />
              Overlay comparison
            </label>
            {compareOn && (
              <select value={compareId} onChange={e => setCompareId(e.target.value)} className="mono"
                style={{ marginTop: 6, width: '100%', padding: '6px 8px', fontSize: 11,
                  background: 'var(--ink-2)', color: 'var(--paper)', border: '1px solid var(--line-strong)' }}>
                {SOLUTIONS.filter(s => s.id !== solId).map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}
              </select>
            )}
          </div>

          {/* Detector readouts */}
          <div style={{
            marginTop: 4, padding: 12, background: 'var(--ink-2)', borderRadius: 4,
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
          }}>
            <Stat label="Absorbance · A" value={A.toFixed(3)} accent="var(--base)" />
            <Stat label="Transmittance · T" value={T.toFixed(3)} accent="var(--acid)" />
            <Stat label="%T" value={`${(T * 100).toFixed(2)} %`} accent="var(--acid)" />
            <Stat label="I / I₀" value={`${(T * 100).toFixed(1)} %`} />
            <Stat label="ε(λ)" value={`${eps.toFixed(0)}`} />
            <Stat label="photons / s absorbed" value={fmtSci(photonsAbsorbed)} accent="var(--plasma)" />
          </div>

          <Verdict sol={sol} A={A} lambda={lambda} />
        </div>
      </div>

      {/* Bottom: calibration plot + table + application */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        <CalibrationPlot
          calPoints={calPoints}
          c={c}
          A={A}
          slope={slope}
          bEff={bEff}
          eps={eps}
        />
        <div style={{
          background: 'var(--ink-1)', border: '1px solid var(--line)',
          borderRadius: 6, padding: 18, display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div className="eyebrow">Standard curve · 5 points @ b_eff = {bEff.toFixed(2)} cm, λ = {lambda} nm</div>
          <table className="mono" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ color: 'var(--paper-dim)', textAlign: 'left' }}>
                <th style={{ padding: '4px 0' }}>c (mM)</th>
                <th>A</th>
                <th>%T</th>
              </tr>
            </thead>
            <tbody>
              {calPoints.map((p, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--line)' }}>
                  <td style={{ padding: '4px 0' }}>{(p.c * 1000).toFixed(2)}</td>
                  <td style={{ color: p.A > 1 ? 'var(--hot)' : 'var(--paper)' }}>{p.A.toFixed(3)}</td>
                  <td style={{ color: 'var(--paper-dim)' }}>{(Math.pow(10, -p.A) * 100).toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mono" style={{ fontSize: 11, color: 'var(--paper-dim)' }}>
            slope &nbsp;=&nbsp; <span style={{ color: 'var(--phos)' }}>ε·b = {slope.toFixed(0)} M⁻¹</span>
            <br />R² (linear fit) ≈ <span style={{ color: 'var(--paper)' }}>{rSquared(linearPts, slope).toFixed(4)}</span>
          </div>
          <div style={{
            marginTop: 'auto', padding: 12, background: 'var(--ink-2)',
            borderLeft: '2px solid var(--plasma)', borderRadius: 2,
          }}>
            <div className="eyebrow" style={{ color: 'var(--plasma)' }}>Application</div>
            <div style={{ fontSize: 12, color: 'var(--paper-dim)', marginTop: 6, lineHeight: 1.55 }}>
              {sol.application}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ────────────────────── visible spectrum strip ──────────────────────

function SpectrumStrip({
  sol, compareSol, lambda, sigma, epsAt, onPick,
}: {
  sol: Solution; compareSol: Solution | null; lambda: number; sigma: number;
  epsAt: (s: Solution, l: number) => number;
  onPick: (l: number) => void;
}) {
  const W = 600, H = 84;
  const wlToX = (l: number) => ((l - VIS_LO) / (VIS_HI - VIS_LO)) * W;

  // Sample envelope curves (ε normalised to 1 at λmax for both species)
  const curveFor = (s: Solution) => {
    const pts: string[] = [];
    for (let l = VIS_LO; l <= VIS_HI; l += 4) {
      const norm = epsAt(s, l) / s.epsMax;
      const y = H - 6 - norm * (H - 18);
      pts.push(`${wlToX(l).toFixed(1)},${y.toFixed(1)}`);
    }
    return pts.join(' ');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div className="eyebrow">Visible spectrum · ε(λ) absorption band</div>
        <div className="mono" style={{ fontSize: 10, color: 'var(--paper-faint)' }}>
          {VIS_LO} – {VIS_HI} nm · σ = {sigma} nm
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', marginTop: 6, cursor: 'crosshair' }}
        onClick={(e) => {
          const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * W;
          onPick(Math.max(VIS_LO, Math.min(VIS_HI, Math.round(VIS_LO + (x / W) * (VIS_HI - VIS_LO)))));
        }}>
        {/* Rainbow swatch */}
        {Array.from({ length: 80 }, (_, i) => {
          const l = VIS_LO + (i / 80) * (VIS_HI - VIS_LO);
          return <rect key={i} x={wlToX(l)} y={0} width={W / 80 + 0.5} height={H - 18}
                       fill={wlToHex(l)} opacity={0.85} />;
        })}

        {/* Primary band — dark mask where solution absorbs */}
        <polygon
          points={`${wlToX(VIS_LO)},${H - 18} ${curveFor(sol)} ${wlToX(VIS_HI)},${H - 18}`}
          fill="rgba(10,9,8,0.78)"
        />
        <polyline points={curveFor(sol)} fill="none" stroke="var(--paper)" strokeWidth={1.2} />

        {/* Comparison overlay */}
        {compareSol && (
          <polyline
            points={curveFor(compareSol)}
            fill="none"
            stroke={wlToHex(complementOf(compareSol.lambdaMax))}
            strokeWidth={1.4}
            strokeDasharray="3 3"
          />
        )}

        {/* λ cursor */}
        <line x1={wlToX(lambda)} x2={wlToX(lambda)} y1={0} y2={H - 18}
              stroke="var(--paper)" strokeWidth={1.5} />
        <circle cx={wlToX(lambda)} cy={4} r={3} fill="var(--paper)" />

        {/* Axis ticks */}
        {[400, 500, 600, 700].map(l => (
          <g key={l}>
            <line x1={wlToX(l)} x2={wlToX(l)} y1={H - 18} y2={H - 14} stroke="var(--paper-dim)" />
            <text x={wlToX(l)} y={H - 4} textAnchor="middle"
                  fontFamily="JetBrains Mono" fontSize={9} fill="var(--paper-dim)">{l}</text>
          </g>
        ))}

        {/* λmax marker */}
        <text x={wlToX(sol.lambdaMax)} y={H - 22} textAnchor="middle"
              fontFamily="JetBrains Mono" fontSize={9} fill="var(--paper)">
          λmax {sol.lambdaMax}
        </text>
      </svg>
    </div>
  );
}

// ────────────────────── cuvette scene ──────────────────────

function CuvetteScene({
  sol, lambda, b, stack, T, phase, epsAt, c,
}: {
  sol: Solution; lambda: number; b: number; stack: number; T: number; phase: number;
  epsAt: (s: Solution, l: number) => number; c: number;
}) {
  const SVG_W = 600, SVG_H = 220;
  const cuvetteX = 110;
  const cuvetteW = Math.min(360, b * 60 * stack);   // visual width grows with b·n
  const cuvetteY = 50;
  const cuvetteH = 120;

  // Transmitted color: integrate I₀(λ) · 10^(-A(λ)) across visible.
  const transmittedColor = useMemo(() => {
    let r = 0, g = 0, bl = 0, w = 0;
    for (let l = VIS_LO; l <= VIS_HI; l += 8) {
      const A = beerWithDeviation(epsAt(sol, l) * b * stack * c);
      const t = Math.pow(10, -A);
      const [rr, gg, bb] = wlToRGB(l);
      r += rr * t; g += gg * t; bl += bb * t; w += 1;
    }
    return `rgb(${Math.round(r / w)}, ${Math.round(g / w)}, ${Math.round(bl / w)})`;
  }, [sol, b, stack, c, epsAt]);

  const beamColor = wlToHex(lambda);
  const shimmer = 0.85 + 0.15 * Math.sin(phase * 4);

  // Stacked cuvette outlines
  const slabW = cuvetteW / stack;

  return (
    <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ width: '100%' }}>
      <defs>
        <linearGradient id="bl-incident" x1="0" x2="1">
          <stop offset="0%" stopColor={beamColor} stopOpacity="0" />
          <stop offset="100%" stopColor={beamColor} stopOpacity="1" />
        </linearGradient>
        <linearGradient id="bl-cuvette" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={transmittedColor} stopOpacity="0.95" />
          <stop offset="100%" stopColor={transmittedColor} stopOpacity="0.65" />
        </linearGradient>
      </defs>

      {/* Source housing */}
      <rect x={10} y={cuvetteY + 30} width={50} height={50}
            fill="var(--ink-2)" stroke="var(--line-strong)" />
      <circle cx={55} cy={cuvetteY + 55} r={5} fill={beamColor} opacity={0.9} />
      <text x={35} y={cuvetteY + 100} textAnchor="middle"
            fontFamily="JetBrains Mono" fontSize={9} fill="var(--paper-faint)">SOURCE</text>
      <text x={35} y={cuvetteY + 112} textAnchor="middle"
            fontFamily="JetBrains Mono" fontSize={9} fill={beamColor}>{lambda} nm</text>

      {/* Incident beam */}
      <rect x={60} y={cuvetteY + 53} width={cuvetteX - 60} height={4}
            fill="url(#bl-incident)" />

      {/* Cuvette slabs (stacked) */}
      {Array.from({ length: stack }, (_, i) => (
        <g key={i}>
          <rect x={cuvetteX + i * slabW} y={cuvetteY} width={slabW} height={cuvetteH}
                fill="url(#bl-cuvette)" stroke="var(--line-strong)" strokeWidth={1} />
          <rect x={cuvetteX + i * slabW + 2} y={cuvetteY + 2}
                width={4} height={cuvetteH - 4} fill="rgba(255,255,255,0.18)" />
        </g>
      ))}
      <text x={cuvetteX + cuvetteW / 2} y={cuvetteY + cuvetteH + 16}
            textAnchor="middle" fontFamily="JetBrains Mono" fontSize={10}
            fill="var(--paper-dim)">
        b_eff = {(b * stack).toFixed(2)} cm {stack > 1 ? `(${stack} × ${b.toFixed(2)})` : ''}
      </text>

      {/* Inside-cuvette beam dimming */}
      {Array.from({ length: 12 }, (_, i) => {
        const xFrac = i / 11;
        const localT = Math.pow(10, -beerWithDeviation(epsAt(sol, lambda) * b * stack * c * xFrac));
        return <rect key={i} x={cuvetteX + xFrac * cuvetteW - 1} y={cuvetteY + cuvetteH / 2 - 1.5}
                     width={cuvetteW / 12} height={3} fill={beamColor} opacity={localT * shimmer} />;
      })}

      {/* Transmitted beam */}
      <rect x={cuvetteX + cuvetteW} y={cuvetteY + 53}
            width={Math.max(0, SVG_W - 60 - (cuvetteX + cuvetteW))}
            height={4} fill={beamColor} opacity={T * shimmer} />

      {/* Detector */}
      <rect x={SVG_W - 60} y={cuvetteY + 30} width={50} height={50}
            fill="var(--ink-2)" stroke="var(--line-strong)" />
      <text x={SVG_W - 35} y={cuvetteY + 100} textAnchor="middle"
            fontFamily="JetBrains Mono" fontSize={9} fill="var(--paper-faint)">DETECTOR</text>

      {/* Detector LED bar showing %T */}
      <rect x={SVG_W - 55} y={cuvetteY + 38} width={40} height={6}
            fill="var(--ink-3)" stroke="var(--line)" />
      <rect x={SVG_W - 54} y={cuvetteY + 39} width={38 * T} height={4}
            fill="var(--phos)" />
      <text x={SVG_W - 35} y={cuvetteY + 24} textAnchor="middle"
            fontFamily="JetBrains Mono" fontSize={11} fill="var(--phos)">
        {(T * 100).toFixed(1)}%
      </text>

      {/* Solute particles */}
      <defs><clipPath id="cuv-clip"><rect x={cuvetteX} y={cuvetteY} width={cuvetteW} height={cuvetteH} /></clipPath></defs>
      <g clipPath="url(#cuv-clip)">
        {Array.from({ length: Math.min(40, Math.round(c * 6000)) }, (_, i) => (
          <circle key={i} cx={cuvetteX + ((i * 37) % (cuvetteW - 8)) + 4}
                  cy={cuvetteY + ((i * 53) % (cuvetteH - 8)) + 4} r={1.4}
                  fill={wlToHex(complementOf(sol.lambdaMax))} opacity={0.85} />
        ))}
      </g>
    </svg>
  );
}

// ────────────────────── calibration plot ──────────────────────

function CalibrationPlot({
  calPoints, c, A, slope, bEff, eps,
}: {
  calPoints: { c: number; A: number }[]; c: number; A: number;
  slope: number; bEff: number; eps: number;
}) {
  const W = 520, H = 240, M = 36;
  const cMax = 0.005;             // x-axis: 0..5 mM
  const aMax = Math.max(2, Math.ceil(Math.max(A, ...calPoints.map(p => p.A)) + 0.4));
  const xOf = (cv: number) => M + (cv / cMax) * (W - M - 12);
  const yOf = (av: number) => H - M - (av / aMax) * (H - M - 16);

  // Linear path (extrapolated through origin)
  const linearPath = `M ${xOf(0)} ${yOf(0)} L ${xOf(cMax)} ${yOf(slope * cMax)}`;

  // Actual model curve (with deviation bend)
  const modelPath = (() => {
    const pts: string[] = [];
    for (let i = 0; i <= 60; i++) {
      const ci = (i / 60) * cMax;
      const av = beerWithDeviation(eps * bEff * ci);
      pts.push(`${i === 0 ? 'M' : 'L'} ${xOf(ci).toFixed(1)} ${yOf(av).toFixed(1)}`);
    }
    return pts.join(' ');
  })();

  return (
    <div style={{
      background: 'var(--ink-1)', border: '1px solid var(--line)',
      borderRadius: 6, padding: 18,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div className="eyebrow">Beer's-law calibration · A vs c</div>
        <div className="mono" style={{ fontSize: 10, color: 'var(--paper-faint)' }}>
          ideal (dashed) · model with non-linearity (solid)
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', marginTop: 6 }}>
        {/* axes */}
        <line x1={M} y1={H - M} x2={W - 12} y2={H - M} stroke="var(--line-strong)" />
        <line x1={M} y1={H - M} x2={M} y2={16} stroke="var(--line-strong)" />

        {[0.25, 0.5, 0.75, 1.0].map(f => (
          <line key={f} x1={M} y1={yOf(f * aMax)} x2={W - 12} y2={yOf(f * aMax)} stroke="var(--line)" strokeDasharray="2 4" />
        ))}

        {/* A = 1 linearity threshold */}
        <line x1={M} y1={yOf(1)} x2={W - 12} y2={yOf(1)}
              stroke="var(--hot)" strokeDasharray="4 3" opacity={0.6} />
        <text x={W - 14} y={yOf(1) - 4} textAnchor="end"
              fontFamily="JetBrains Mono" fontSize={9} fill="var(--hot)">
          A = 1 · linearity limit
        </text>

        {/* ideal linear line */}
        <path d={linearPath} stroke="var(--paper-dim)" strokeWidth={1}
              strokeDasharray="4 4" fill="none" />

        {/* model curve */}
        <path d={modelPath} stroke="var(--base)" strokeWidth={2} fill="none" />

        {calPoints.map((p, i) => (
          <circle key={i} cx={xOf(p.c)} cy={yOf(p.A)} r={3.5} fill="var(--phos)" stroke="var(--ink-1)" strokeWidth={1} />
        ))}
        {c <= cMax && (<>
          <line x1={xOf(c)} y1={H - M} x2={xOf(c)} y2={yOf(A)} stroke="var(--acid)" strokeDasharray="2 3" />
          <line x1={M} y1={yOf(A)} x2={xOf(c)} y2={yOf(A)} stroke="var(--acid)" strokeDasharray="2 3" />
          <circle cx={xOf(c)} cy={yOf(A)} r={5} fill="var(--acid)" />
        </>)}

        {/* axis labels */}
        <text x={W / 2} y={H - 6} textAnchor="middle"
              fontFamily="JetBrains Mono" fontSize={10} fill="var(--paper-dim)">
          c (mol / L) → max {cMax.toFixed(3)}
        </text>
        <text x={10} y={H / 2} textAnchor="middle"
              transform={`rotate(-90 10 ${H / 2})`}
              fontFamily="JetBrains Mono" fontSize={10} fill="var(--paper-dim)">
          Absorbance A
        </text>

        {/* deviation annotation */}
        {aMax > 1.5 && (
          <text x={xOf(cMax * 0.75)} y={yOf(aMax * 0.92)} textAnchor="middle"
                fontFamily="JetBrains Mono" fontSize={9} fill="var(--hot)">
            ↑ deviates from linearity (stray light, aggregation)
          </text>
        )}
      </svg>

      <div className="mono" style={{ fontSize: 11, color: 'var(--paper-dim)', marginTop: 4 }}>
        live · c = <span style={{ color: 'var(--acid)' }}>{(c * 1000).toFixed(3)} mM</span> ·
        &nbsp;A = <span style={{ color: 'var(--acid)' }}>{A.toFixed(3)}</span>
      </div>
    </div>
  );
}

// ────────────────────── verdict line ──────────────────────

function Verdict({ sol, A, lambda }: { sol: Solution; A: number; lambda: number }) {
  const compHex = wlToHex(complementOf(sol.lambdaMax));
  const compName = wavelengthName(complementOf(sol.lambdaMax));
  const absName  = wavelengthName(sol.lambdaMax);

  const intensity = A < 0.05 ? 'nearly colorless' :
                    A < 0.3  ? 'pale' :
                    A < 1.0  ? 'visibly tinted' :
                    A < 2.0  ? 'deeply colored' :
                               'optically opaque';
  const offPeak = Math.abs(lambda - sol.lambdaMax) > 50;

  return (
    <div style={{
      borderTop: '1px solid var(--line)', paddingTop: 12,
      fontSize: 12, color: 'var(--paper-dim)', lineHeight: 1.55,
    }}>
      <div className="eyebrow" style={{ color: compHex }}>Verdict</div>
      <div style={{ marginTop: 6 }}>
        Solution appears <span style={{ color: compHex, fontWeight: 600 }}>{intensity} {compName}</span> because
        the <span style={{ color: wlToHex(sol.lambdaMax) }}>{absName}</span> region near {sol.lambdaMax} nm is
        absorbed; the eye sees the complementary transmitted light.
        {offPeak && ' · Off-peak λ → ε(λ) drops, reducing A even at the same c.'}
      </div>
    </div>
  );
}

// ────────────────────── small UI atoms ──────────────────────

function Slider({
  label, value, min, max, step, unit, decimals = 2, accent, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number;
  unit: string; decimals?: number; accent: string; onChange: (n: number) => void;
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span className="eyebrow">{label}</span>
        <span className="mono" style={{ fontSize: 11, color: accent }}>
          {value.toFixed(decimals)} {unit}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
             onChange={(e) => onChange(Number(e.target.value))}
             style={{ width: '100%', accentColor: accent }} />
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 4 }}>{label}</div>
      <div className="serif" style={{ fontSize: 17, color: accent ?? 'var(--paper)' }}>{value}</div>
    </div>
  );
}

// ────────────────────── physics + color helpers ──────────────────────

/** Apply gentle bend above A=1 to mimic real spectrophotometer non-linearity. */
function beerWithDeviation(Alin: number): number {
  if (Alin <= 1) return Alin;
  // Soft saturation: above A=1, growth slows; asymptotes near A_max ≈ 3.5
  const excess = Alin - 1;
  return 1 + 2.5 * (1 - Math.exp(-excess / 2.5));
}

function rSquared(pts: { c: number; A: number }[], slope: number): number {
  if (pts.length < 2) return 1;
  const meanA = pts.reduce((s, p) => s + p.A, 0) / pts.length;
  let ssRes = 0, ssTot = 0;
  pts.forEach(p => {
    const pred = slope * p.c;
    ssRes += (p.A - pred) ** 2;
    ssTot += (p.A - meanA) ** 2;
  });
  return ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);
}

function fmtSci(n: number): string {
  if (n <= 0) return '0';
  const e = Math.floor(Math.log10(n));
  return `${(n / Math.pow(10, e)).toFixed(2)}e${e}`;
}

/** Complementary wavelength (rough reflection across visible center ≈ 560 nm). */
function complementOf(l: number): number {
  if (l < 500) return 560 + (500 - l) * 0.9;
  if (l > 580) return 480 - (l - 580) * 0.5;
  return 700 - (l - 500) * 4;
}

/** Approximate visible-light wavelength → sRGB (0–255). */
function wlToRGB(l: number): [number, number, number] {
  let r = 0, g = 0, b = 0;
  if (l < 440)      { r = -(l - 440) / 60; b = 1; }
  else if (l < 490) { g = (l - 440) / 50; b = 1; }
  else if (l < 510) { g = 1; b = -(l - 510) / 20; }
  else if (l < 580) { r = (l - 510) / 70; g = 1; }
  else if (l < 645) { r = 1; g = -(l - 645) / 65; }
  else              { r = 1; }
  const factor = l < 420 ? 0.3 + 0.7 * (l - 380) / 40
               : l > 700 ? 0.3 + 0.7 * (780 - l) / 80 : 1;
  const G = 0.8;
  return [Math.round(255 * Math.pow(Math.max(0, r) * factor, G)),
          Math.round(255 * Math.pow(Math.max(0, g) * factor, G)),
          Math.round(255 * Math.pow(Math.max(0, b) * factor, G))];
}

function wlToHex(l: number): string {
  const [r, g, b] = wlToRGB(Math.max(VIS_LO, Math.min(VIS_HI, l)));
  return `rgb(${r}, ${g}, ${b})`;
}

function wavelengthName(l: number): string {
  return l < 425 ? 'violet' : l < 490 ? 'blue' : l < 510 ? 'cyan'
       : l < 565 ? 'green'  : l < 590 ? 'yellow' : l < 625 ? 'orange' : 'red';
}
