import { useMemo, useState } from 'react';
import { ELEMENTS, EXTRA } from '../data/elements';
import type { Element } from '../data/elements';
import SlideTabs from '../components/ui/SlideTabs';

/**
 * Periodic trends visualizer — full 118-element table.
 * Cell glow + size encode the chosen trend; hover for exact value.
 */

type Trend = 'radius' | 'IE' | 'EN' | 'EA';

const META: Record<Trend, { name: string; unit: string; desc: string; rule: string; color: string }> = {
  radius: { name: 'Atomic Radius',     unit: 'pm',      color: '#a78bfa', desc: 'Distance from nucleus to outermost electron.',                                rule: '↑ DOWN a group · ↓ ACROSS a period →' },
  IE:     { name: 'Ionization Energy', unit: 'kJ/mol',  color: '#fbbf24', desc: 'Energy required to remove the most loosely-held electron from the atom.',     rule: '↓ DOWN a group · ↑ ACROSS a period →' },
  EN:     { name: 'Electronegativity', unit: 'Pauling', color: '#ff5b3c', desc: 'Tendency of an atom to pull bonding electrons toward itself in a covalent bond.', rule: '↓ DOWN a group · ↑ ACROSS a period →' },
  EA:     { name: 'Electron Affinity', unit: 'kJ/mol',  color: '#5dd0ff', desc: 'Energy released when a neutral atom in the gas phase gains an electron.',     rule: '↓ DOWN a group (mostly) · ↑ ACROSS a period →' },
};

export default function PeriodicTrend() {
  const [trend, setTrend] = useState<Trend>('EN');
  const [hover, setHover] = useState<number | null>(9); // F by default — the EN extreme

  const trendVal = (z: number): number | undefined => {
    const ex = EXTRA[z] as any;
    return ex?.[trend];
  };

  const { vmin, vmax } = useMemo(() => {
    const vals = ELEMENTS.map(e => trendVal(e.z)).filter((v): v is number => v !== undefined && v > 0);
    if (vals.length === 0) return { vmin: 0, vmax: 1 };
    const lo = Math.min(...vals), hi = Math.max(...vals);
    return { vmin: lo, vmax: hi === lo ? lo + 1 : hi };
  }, [trend]);

  // Find global extremes for the highlight callouts
  const { hi, lo } = useMemo(() => {
    let hi: Element | null = null, lo: Element | null = null;
    let hiV = -Infinity, loV = Infinity;
    for (const e of ELEMENTS) {
      const v = trendVal(e.z);
      if (v === undefined || v <= 0) continue;
      if (v > hiV) { hiV = v; hi = e; }
      if (v < loV) { loV = v; lo = e; }
    }
    return { hi, lo };
  }, [trend]);

  const accent = META[trend].color;
  const focusEl = hover ? ELEMENTS.find(e => e.z === hover) ?? null : null;
  const focusVal = focusEl ? trendVal(focusEl.z) : undefined;

  const main = ELEMENTS.filter(e => e.period <= 7);
  const lanthanides = ELEMENTS.filter(e => e.category === 'lanthanide');
  const actinides   = ELEMENTS.filter(e => e.category === 'actinide');

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {/* Trend selector */}
      <SlideTabs<Trend>
        tabs={(Object.keys(META) as Trend[]).map(k => ({ id: k, label: META[k].name }))}
        value={trend}
        onChange={setTrend}
      />

      {/* Caption: rule + global extremes */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div className="mono" style={{ fontSize: 11, color: 'var(--paper-dim)', letterSpacing: '0.14em' }}>
          {META[trend].rule}
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          {hi && (
            <Pill el={hi} value={trendVal(hi.z)!} unit={META[trend].unit} color={accent} label="HIGHEST" onClick={() => setHover(hi.z)} />
          )}
          {lo && (
            <Pill el={lo} value={trendVal(lo.z)!} unit={META[trend].unit} color="var(--paper-dim)" label="LOWEST" onClick={() => setHover(lo.z)} />
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 16 }}>
        {/* The table */}
        <div style={{
          background: 'var(--ink-1)',
          border: '1px solid var(--line)',
          borderRadius: 6,
          padding: 14,
          overflowX: 'auto',
        }}>
          <div style={{ minWidth: 720 }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(18, minmax(28px, 1fr))',
              gridAutoRows: 'minmax(30px, 36px)',
              gap: 2,
            }}>
              {main.map(e => (
                <TrendCell
                  key={e.z}
                  el={e}
                  v={trendVal(e.z)}
                  vmin={vmin}
                  vmax={vmax}
                  accent={accent}
                  isHover={hover === e.z}
                  onHover={setHover}
                />
              ))}
              <Placeholder gridCol={3} gridRow={6} label="57–71" color={accent} />
              <Placeholder gridCol={3} gridRow={7} label="89–103" color={accent} />
            </div>

            <SubRow elements={lanthanides} marker="*" trendVal={trendVal} vmin={vmin} vmax={vmax} accent={accent} hover={hover} setHover={setHover} />
            <SubRow elements={actinides}   marker="**" trendVal={trendVal} vmin={vmin} vmax={vmax} accent={accent} hover={hover} setHover={setHover} />

            {/* Color scale legend */}
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="mono" style={{ fontSize: 10, color: 'var(--paper-dim)' }}>{vmin.toFixed(trend === 'EN' ? 2 : 0)}</span>
              <div style={{
                flex: 1, height: 8, borderRadius: 4,
                background: `linear-gradient(90deg, ${accent}11 0%, ${accent}ff 100%)`,
                border: '1px solid var(--line)',
              }} />
              <span className="mono" style={{ fontSize: 10, color: accent }}>{vmax.toFixed(trend === 'EN' ? 2 : 0)} {META[trend].unit}</span>
            </div>
          </div>
        </div>

        {/* Detail card */}
        <div style={{
          background: 'var(--ink-1)',
          border: '1px solid var(--line)',
          borderRadius: 6,
          padding: 22,
          display: 'flex', flexDirection: 'column', gap: 10,
          minHeight: 360,
        }}>
          <div className="eyebrow">Selected · Z = {focusEl?.z ?? '—'}</div>
          <div className="serif" style={{ fontSize: 38, lineHeight: 1, marginBottom: 4 }}>{focusEl?.name ?? '—'}</div>
          <div className="mono" style={{ fontSize: 13, color: 'var(--paper)' }}>{focusEl?.sym ?? ''}</div>

          <div style={{ marginTop: 12, padding: 16, background: 'var(--ink-2)', borderRadius: 4 }}>
            <div className="eyebrow">{META[trend].name}</div>
            <div className="serif" style={{ fontSize: 36, color: accent }}>
              {focusVal !== undefined && focusVal > 0 ? focusVal.toFixed(trend === 'EN' ? 2 : 0) : 'n/a'}
              <span style={{ fontSize: 14, color: 'var(--paper-dim)', marginLeft: 6 }}>{META[trend].unit}</span>
            </div>
          </div>

          {/* Mini bar gauge */}
          {focusVal !== undefined && focusVal > 0 && (
            <div style={{ marginTop: 4 }}>
              <div className="mono" style={{ fontSize: 9, color: 'var(--paper-faint)', letterSpacing: '0.12em', marginBottom: 4 }}>
                RELATIVE TO TABLE RANGE
              </div>
              <div style={{ height: 6, background: 'var(--ink-2)', borderRadius: 3, position: 'relative' }}>
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0,
                  width: `${Math.max(0, Math.min(100, ((focusVal - vmin) / (vmax - vmin)) * 100))}%`,
                  background: accent, borderRadius: 3,
                }} />
              </div>
            </div>
          )}

          <div style={{ marginTop: 'auto', borderTop: '1px solid var(--line)', paddingTop: 14, fontSize: 13, color: 'var(--paper-dim)', lineHeight: 1.55 }}>
            <strong style={{ color: 'var(--paper)' }}>{META[trend].name}.</strong> {META[trend].desc}
          </div>
        </div>
      </div>
    </div>
  );
}

// ───── components ─────

function TrendCell({ el, v, vmin, vmax, accent, isHover, onHover }: {
  el: Element; v: number | undefined; vmin: number; vmax: number; accent: string;
  isHover: boolean; onHover: (z: number) => void;
}) {
  const ratio = v !== undefined && v > 0 ? (v - vmin) / (vmax - vmin) : 0;
  return (
    <button
      type="button"
      onMouseEnter={() => onHover(el.z)}
      onFocus={() => onHover(el.z)}
      aria-label={`${el.name} ${v ?? 'unknown'}`}
      style={{
        gridColumn: el.group,
        gridRow: el.period,
        position: 'relative',
        background: v !== undefined && v > 0
          ? `rgba(${hexRGB(accent)}, ${0.08 + ratio * 0.55})`
          : 'rgba(245,241,232,0.04)',
        border: `1px solid ${isHover ? 'var(--paper)' : v !== undefined && v > 0 ? `rgba(${hexRGB(accent)}, ${0.3 + ratio * 0.5})` : 'var(--line)'}`,
        borderRadius: 2,
        cursor: 'pointer',
        padding: 0,
        font: 'inherit',
        color: 'inherit',
        boxShadow: isHover ? `0 0 0 2px var(--paper)` : 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'border-color 120ms, box-shadow 120ms',
      }}
    >
      <span className="serif" style={{ fontSize: 11, color: 'var(--paper)', fontWeight: 500 }}>{el.sym}</span>
    </button>
  );
}

function SubRow({ elements, marker, trendVal, vmin, vmax, accent, hover, setHover }: {
  elements: Element[]; marker: string;
  trendVal: (z: number) => number | undefined;
  vmin: number; vmax: number; accent: string;
  hover: number | null; setHover: (z: number) => void;
}) {
  return (
    <div style={{ marginTop: 10 }}>
      <div className="mono" style={{ fontSize: 9, color: 'var(--paper-faint)', letterSpacing: '0.14em', marginBottom: 4, paddingLeft: 4 }}>
        <span style={{ color: 'var(--paper-dim)', marginRight: 6 }}>{marker}</span>
        {elements[0]?.category === 'lanthanide' ? 'Lanthanides' : 'Actinides'}
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(18, minmax(28px, 1fr))',
        gridAutoRows: 'minmax(30px, 36px)',
        gap: 2,
      }}>
        {elements.map((e, i) => (
          <TrendCell
            key={e.z}
            el={{ ...e, group: i + 3, period: 1 }}
            v={trendVal(e.z)}
            vmin={vmin} vmax={vmax} accent={accent}
            isHover={hover === e.z}
            onHover={setHover}
          />
        ))}
      </div>
    </div>
  );
}

function Placeholder({ gridCol, gridRow, label, color }: { gridCol: number; gridRow: number; label: string; color: string }) {
  return (
    <div aria-hidden="true" style={{
      gridColumn: gridCol, gridRow: gridRow,
      border: `1px dashed ${color}55`,
      background: `${color}08`,
      borderRadius: 2,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: `${color}99`, fontFamily: 'JetBrains Mono', fontSize: 9,
    }}>
      {label}
    </div>
  );
}

function Pill({ el, value, unit, color, label, onClick }: { el: Element; value: number; unit: string; color: string; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="mono" style={{
      padding: '6px 10px', fontSize: 10, letterSpacing: '0.12em',
      border: `1px solid ${color}55`, background: 'transparent',
      color: 'var(--paper)', cursor: 'pointer', borderRadius: 3,
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <span style={{ color, fontSize: 9 }}>{label}</span>
      <span style={{ fontFamily: 'serif', fontSize: 13 }}>{el.sym}</span>
      <span style={{ color: 'var(--paper-dim)' }}>{value.toFixed(unit === 'Pauling' ? 2 : 0)} {unit}</span>
    </button>
  );
}

// ───── utils ─────

function hexRGB(hex: string): string {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}
